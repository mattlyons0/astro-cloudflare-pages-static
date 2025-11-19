import type { AstroConfig } from 'astro';
import {
  INDEX_SUFFIX,
  createPlaceholder,
  PAGE_FILES_REGEX,
  PAGE_RENDER_FILES_REGEX,
} from '../constants.js';

/**
 * Regular expression with capture group to extract parameter names from Astro dynamic routes.
 * Matches [id] and captures "id", [...slug] and captures "...slug", etc.
 */
const DYNAMIC_ROUTE_PARAM_PATTERN = /\[(.*?)\]/g;

export class RouteConverter {
  constructor(private config: AstroConfig) {}

  /**
   * Converts a file path to a route pattern (e.g., "users/[id].astro" -> "/users/:id")
   */
  fileToRoute(file: string): string {
    let route =
      '/' + file.replace(PAGE_FILES_REGEX, '').replace(/\/index$/, '');

    route = this.prependBase(route);

    route = route.replace(DYNAMIC_ROUTE_PARAM_PATTERN, (_match, param) => {
      if (param.startsWith('...')) {
        const cleanParam = param.replace(/^\.\.\./, '');
        return ':' + cleanParam + '*';
      }
      return ':' + param;
    });

    return route;
  }

  /**
   * Creates a regex pattern from a route string (e.g., "/users/:id" -> /^\/users\/([^\/]+)$/)
   */
  createRoutePattern(route: string): RegExp {
    let pattern = route.replace(/:(\w+)\*/g, '(.+)');
    pattern = pattern.replace(/:(\w+)/g, '([^/]+)');
    return new RegExp(`^${pattern}$`);
  }

  /**
   * Converts a file path to a shell path with placeholders
   * (e.g., "users/[id].astro" -> "/users/__ACPS_id__")
   */
  fileToShellPath(file: string): string {
    const isPage = PAGE_RENDER_FILES_REGEX.test(file);
    let shellPath = '/' + file.replace(PAGE_FILES_REGEX, '');

    shellPath = shellPath.replace(
      DYNAMIC_ROUTE_PARAM_PATTERN,
      (_match, param) => {
        return createPlaceholder(param.replace(/^\.\.\./, ''));
      }
    );

    if (shellPath.endsWith('/index')) {
      shellPath = shellPath.substring(0, shellPath.length - 6);
    }

    shellPath = this.prependBase(shellPath);

    if (this.config.build.format === 'file' || !isPage) {
      return shellPath;
    }

    return shellPath + INDEX_SUFFIX;
  }

  /**
   * Extracts parameter names from a route string (e.g., "/users/:id/:post*" -> ["id", "post"])
   */
  extractParamsFromRoute(route: string): string[] {
    return [...route.matchAll(/:(\w+)\*?/g)].map((m) => m[1]);
  }

  /**
   * Extracts parameter names from a file path (e.g., "users/[id].astro" -> ["id"])
   */
  extractParamsFromFile(relativePath: string): string[] {
    const paramMatches = [
      ...relativePath.matchAll(DYNAMIC_ROUTE_PARAM_PATTERN),
    ];

    return paramMatches.map((match) => {
      const param = match[1];
      return param.replace(/^\.\.\./, '');
    });
  }

  private prependBase(pathSegment: string): string {
    if (this.config.base && this.config.base !== '/') {
      const base = this.config.base.endsWith('/')
        ? this.config.base.slice(0, -1)
        : this.config.base;
      return base + pathSegment;
    }
    return pathSegment;
  }
}
