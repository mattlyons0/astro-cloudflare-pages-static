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
  let dynamicRoutes: DynamicRoute[] = [];

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

    dynamicRoutes = files
      .filter((file) => DYNAMIC_ROUTE_PATTERN.test(file))
      .map((file) => {
        const route = routeConverter.fileToRoute(file);
        const patternRegex = routeConverter.createRoutePattern(route);
        const shellPath = routeConverter.fileToShellPath(file);
        const params = routeConverter.extractParamsFromRoute(route);

        return {
          file,
          route,
          pattern: patternRegex,
          shellPath,
          params,
        };
      });

    if (dynamicRoutes.length > 0) {
      logger?.info(`Detected ${dynamicRoutes.length} dynamic routes:`);
      dynamicRoutes.forEach((r) => {
        const displayPath = r.shellPath.replace(PLACEHOLDER_REGEX, ':$1');
        logger?.info(`  ${r.route} -> ${displayPath}`);
      });
    }
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

      logger?.debug(`Transforming: ${id}`);

      const relativePath = path.relative(config.root, id);

      if (!relativePath.startsWith('src/pages/')) return;

      const isDynamic = DYNAMIC_ROUTE_PATTERN.test(relativePath);

      if (!isDynamic) return;

      logger?.debug(`Processing ${relativePath}`);

      if (hasExportedFunction(code, 'getStaticPaths')) {
        return;
      }

      logger?.debug(`Injecting getStaticPaths into ${relativePath}`);

      const params = routeConverter.extractParamsFromFile(relativePath);

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
      if (config.command === 'build' && dynamicRoutes.length > 0) {
        const distDir = fileURLToPath(astroConfig.outDir);

        await generateCloudflareWorker(distDir, dynamicRoutes, options, logger);
        await generateRoutesConfig(distDir, dynamicRoutes, options);

        logger?.info('Generated Cloudflare Pages assets');
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
          const result = await serveDynamicRoute(
            pathname,
            host,
            protocol,
            dynamicRoutes,
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
