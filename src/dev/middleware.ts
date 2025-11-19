import type { AstroIntegrationLogger } from 'astro';
import type { DynamicRoute } from '../types.js';
import { INDEX_SUFFIX } from '../constants.js';

export interface DevServerRequestResult {
  html: string;
  params: Record<string, string>;
}

export async function serveDynamicRoute(
  pathname: string,
  host: string,
  protocol: string,
  dynamicRoutes: DynamicRoute[],
  logger?: AstroIntegrationLogger
): Promise<DevServerRequestResult | null> {
  logger?.debug(`Checking request: ${pathname}`);

  const match = dynamicRoutes.find((route) => route.pattern.test(pathname));

  if (!match) {
    logger?.debug('No matching dynamic route found');
    return null;
  }

  const shellUrlPath = getShellUrlPath(match.shellPath);

  if (pathname === shellUrlPath) {
    logger?.debug('Request is for shell itself, skipping middleware');
    return null;
  }

  logger?.debug(`Matched route: ${match.route}`);

  const params = extractParamsFromPath(pathname, match);
  const html = await fetchShellHtml(shellUrlPath, host, protocol, logger);

  if (!html) {
    return null;
  }

  return { html, params };
}

function getShellUrlPath(shellPath: string): string {
  if (shellPath.endsWith(INDEX_SUFFIX)) {
    return shellPath.substring(0, shellPath.length - INDEX_SUFFIX.length);
  }
  return shellPath;
}

function extractParamsFromPath(
  pathname: string,
  route: DynamicRoute
): Record<string, string> {
  const paramValues = pathname.match(route.pattern)?.slice(1) || [];
  const params: Record<string, string> = {};

  route.params.forEach((name, i) => {
    params[name] = decodeURIComponent(paramValues[i]);
  });

  return params;
}

async function fetchShellHtml(
  shellUrlPath: string,
  host: string,
  protocol: string,
  logger?: AstroIntegrationLogger
): Promise<string | null> {
  const fetchUrl = `${protocol}://${host}${shellUrlPath}`;

  logger?.debug(`Fetching shell from ${fetchUrl}`);

  try {
    const response = await fetch(fetchUrl);

    if (!response.ok) {
      logger?.error(
        `Failed to fetch shell from ${fetchUrl}: ${response.status}`
      );
      return null;
    }

    return await response.text();
  } catch (error) {
    logger?.error(`Error fetching shell: ${error}`);
    return null;
  }
}
