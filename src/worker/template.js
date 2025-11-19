// @ts-check
// Cloudflare Pages Worker Template
// This file is used as a template and will have dynamic content injected at build time.
// Keep this as valid JavaScript for linting and type checking.
// __***__ patterns are replaced during the build process in src/worker/builder.ts

import { escapeHtml } from './escape.js';

/* __UPSTREAM_IMPORT__ */

/** @type {Array<{pattern: string, shellPath: string, params: string[]}>} */
const DYNAMIC_ROUTES = /* __ROUTES_DATA__ */ [];

// Pre-compile regex patterns for performance
const COMPILED_ROUTES = DYNAMIC_ROUTES.map((route) => ({
  ...route,
  regex: new RegExp(route.pattern),
}));

// Cache for HTML shells to reduce Cloudflare Pages Functions internal network latency
const SHELL_CACHE = new Map();

/**
 * @typedef {Object} Env
 * @property {Fetcher} ASSETS - Cloudflare Pages ASSETS binding
 */

/**
 * @typedef {Object} Fetcher
 * @property {(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>} fetch
 */

/**
 * @typedef {Object} ExecutionContext
 * @property {(promise: Promise<any>) => void} waitUntil
 * @property {() => void} passThroughOnException
 */

export default {
  /**
   * Handle incoming requests
   * @param {Request} request - The incoming request
   * @param {Env} env - Environment bindings
   * @param {ExecutionContext} ctx - Execution context
   * @returns {Promise<Response>} The response
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (pathname.length > 1024) {
      return new Response('URL Too Long', { status: 414 });
    }

    // Find matching dynamic route
    let matchedRoute = null;
    /** @type {Record<string, string>} */
    let params = {};

    for (const route of COMPILED_ROUTES) {
      const match = pathname.match(route.regex);

      if (match) {
        const paramValues = match.slice(1);
        /** @type {Record<string, string>} */
        const currentParams = {};
        try {
          route.params.forEach((name, i) => {
            currentParams[name] = decodeURIComponent(paramValues[i]);
          });
          matchedRoute = route;
          params = currentParams;
          break;
        } catch (e) {
          // Malformed URI component, skip this route
          continue;
        }
      }
    }

    // If no dynamic route matched, fall back to upstream or static asset
    if (!matchedRoute) {
      /* __FALLBACK_CODE__ */
      return env.ASSETS.fetch(request);
    }

    try {
      // Fetch pre-built HTML shell
      let html;
      const shellPath = matchedRoute.shellPath;

      if (SHELL_CACHE.has(shellPath)) {
        html = SHELL_CACHE.get(shellPath);
      } else {
        const shellUrl = new URL(shellPath + '.html', url.origin);
        const shellResponse = await env.ASSETS.fetch(shellUrl.toString());

        if (!shellResponse.ok) {
          // If shell not found, fall back
          /* __FALLBACK_CODE__ */
        }

        html = await shellResponse.text();
        SHELL_CACHE.set(shellPath, html);
      }

      // Replace placeholders with actual param values (HTML-escaped for security)
      const placeholderRegex = /* __PLACEHOLDER_REGEX__ */ /__ACPS_([^_]+)__/g;
      html = html.replace(
        placeholderRegex,
        (/** @type {string} */ match, /** @type {string} */ key) => {
          const value = params[key];
          return value !== undefined ? escapeHtml(value) : match;
        }
      );

      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=0, must-revalidate',
        },
      });
    } catch (error) {
      console.error('[Cloudflare Worker] Error:', error);
      return new Response('Internal Server Error', {
        status: 500,
        headers: { 'Content-Type': 'text/plain' },
      });
    }
  },
};
