import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';
import { init, parse } from 'es-module-lexer';
import type { Plugin, ResolvedConfig } from 'vite';
import type { AstroConfig } from 'astro';
import { type AstroIntegrationLogger } from 'astro';
import type { DynamicRoute, DynamicRoutesOptions } from './types.js';
import {
  generateCloudflareWorker,
  generateRoutesConfig,
} from './generators.js';
import {
  createPlaceholder,
  escapeHtml,
  PLACEHOLDER_REGEX,
  PAGE_FILES_GLOB,
  PAGE_FILES_REGEX,
} from './constants.js';
import { RouteConverter } from './routes/converter.js';
import { serveDynamicRoute } from './dev/middleware.js';

/**
 * Regular expression to match Astro dynamic route patterns in file paths.
 * Matches [id], [...slug], etc.
 */
const DYNAMIC_ROUTE_PATTERN = /\[.*?\]/;

export function createVitePlugin(
  options: DynamicRoutesOptions,
  astroConfig: AstroConfig,
  logger?: AstroIntegrationLogger
): Plugin {
  if (
    options.excludePaths &&
    (!Array.isArray(options.excludePaths) ||
      !options.excludePaths.every((p) => typeof p === 'string'))
  ) {
    throw new Error('excludePaths must be an array of strings');
  }

  const routeConverter = new RouteConverter(astroConfig);

  let config: ResolvedConfig;
  /** Map of file path to DynamicRoute */
  let routesMap = new Map<string, DynamicRoute>();

  const scanRoutes = async () => {
    const pagesDir = path.join(fileURLToPath(astroConfig.srcDir), 'pages');
    logger?.debug(`Scanning pages in: ${pagesDir}`);

    let files: string[];
    try {
      files = await glob(PAGE_FILES_GLOB, { cwd: pagesDir });
      logger?.debug(`Scanned files: ${JSON.stringify(files)}`);
    } catch (error) {
      logger?.warn(`Failed to scan pages directory: ${error}`);
      return;
    }

    const potentialFiles = files.filter((file) => DYNAMIC_ROUTE_PATTERN.test(file));
    const updatedRoutesMap = new Map<string, DynamicRoute>();

    for (const file of potentialFiles) {
      const fullPath = path.join(pagesDir, file);
      
      const route = routeConverter.fileToRoute(file);
      const patternRegex = routeConverter.createRoutePattern(route);
      const shellPath = routeConverter.fileToShellPath(file);
      const params = routeConverter.extractParamsFromRoute(route);
      
      updatedRoutesMap.set(fullPath, {
        file: fullPath,
        route,
        pattern: patternRegex,
        shellPath,
        params,
        isDynamic: routesMap.get(fullPath)?.isDynamic,
      });
    }
    
    routesMap = updatedRoutesMap;
    
    logger?.info(`Detected ${routesMap.size} potential dynamic routes.`);
  };

  return {
    name: 'astro-cloudflare-pages-static',
    enforce: 'post',

    async configResolved(resolvedConfig) {
      config = resolvedConfig;
      await init;
    },

    transform(code, id) {
      if (!PAGE_FILES_REGEX.test(id)) return;

      // id is absolute path
      const routeInfo = routesMap.get(id);
      
      if (!routeInfo) {
          // If it's not in the map, it's not a dynamic route we care about
          return;
      }

      logger?.debug(`Transforming: ${id}`);

      if (hasExportedFunction(code, 'getStaticPaths')) {
        routeInfo.isDynamic = false;
        return;
      }

      routeInfo.isDynamic = true;

      logger?.debug(`Injecting getStaticPaths into ${id}`);

      const params = routeConverter.extractParamsFromFile(path.relative(config.root, id));

      if (params.length === 0) return;

      const injection = generateGetStaticPathsInjection(params);
      const newCode = code + '\n' + injection;

      logger?.debug(
        `Injected code:\n${newCode.substring(newCode.length - 200)}`
      );

      return {
        code: newCode,
        map: null,
      };
    },

    async buildStart() {
      await scanRoutes();
    },

    async closeBundle() {
      if (config.command === 'build') {
        const dynamicRoutes = Array.from(routesMap.values()).filter(r => r.isDynamic);
        
        if (dynamicRoutes.length > 0) {
            const distDir = fileURLToPath(astroConfig.outDir);

            logger?.info(`Detected ${dynamicRoutes.length} client-side dynamic routes:`);
            dynamicRoutes.forEach((r) => {
                const displayPath = r.shellPath.replace(PLACEHOLDER_REGEX, ':$1');
                logger?.info(`  ${r.route} -> ${displayPath}`);
            });

            await generateCloudflareWorker(distDir, dynamicRoutes, options, logger);
            await generateRoutesConfig(distDir, dynamicRoutes, options);

            logger?.info('Generated Cloudflare Pages assets');
        }
      }
    },

    configureServer(server) {
      const handleFileChange = (file: string) => {
        if (file.includes('src/pages') && file.endsWith('.astro')) {
          scanRoutes();
        }
      };

      server.watcher.on('add', handleFileChange);
      server.watcher.on('unlink', handleFileChange);

      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';
        const host = req.headers.host;
        if (!host) {
          return next();
        }

        const urlObj = new URL(url, `http://${host}`);
        const pathname = urlObj.pathname;
        const protocol = req.headers['x-forwarded-proto'] as string || 'http';

        try {
          const potentialMatch = Array.from(routesMap.values()).find(r => r.pattern.test(pathname));
          
          if (potentialMatch) {
             if (potentialMatch.isDynamic === undefined) {
                 // Load module to trigger transform and determine if dynamic
                 try {
                     await server.ssrLoadModule(potentialMatch.file);
                 } catch (e) {
                     logger?.error(`Failed to load module ${potentialMatch.file}: ${e}`);
                 }
             }
             
             if (!potentialMatch.isDynamic) {
                 return next();
             }
             
             const result = await serveDynamicRoute(
                pathname,
                host,
                protocol,
                [potentialMatch],
                logger
              );

              if (!result) {
                return next();
              }

              let html = result.html.replace(
                PLACEHOLDER_REGEX,
                (match: string, key: string) => {
                  const value = result.params[key];
                  return value !== undefined ? escapeHtml(value) : match;
                }
              );
              res.setHeader('Content-Type', 'text/html; charset=utf-8');
              res.end(html);
              return;
          }
          
          return next();

        } catch (error) {
          logger?.error(`Error handling dynamic route: ${error}`);
          res.statusCode = 500;
          res.end('Internal Server Error');
        }
      });
    },
  };
}

function hasExportedFunction(code: string, functionName: string): boolean {
  try {
    const [_imports, exports] = parse(code);
    return exports.some((e) => e.n === functionName);
  } catch {
    return false;
  }
}

function generateGetStaticPathsInjection(params: string[]): string {
  const paramsObj = params.reduce((acc, param) => {
    acc[param] = createPlaceholder(param);
    return acc;
  }, {} as Record<string, string>);

  return `
export async function getStaticPaths() {
  return [{ params: ${JSON.stringify(paramsObj)} }];
}
`;
}
