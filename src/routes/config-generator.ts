import fs from 'fs/promises';
import path from 'path';
import type { DynamicRoute, DynamicRoutesOptions } from '../types.js';

export async function generateRoutesConfig(
  distDir: string,
  routes: DynamicRoute[],
  options: DynamicRoutesOptions
): Promise<void> {
  const excludePaths: string[] = options.excludePaths || [];

  const routesConfig = {
    version: 1,
    include: ['/*'],
    exclude: [
      '/favicon.ico',
      '/_astro/*',
      '/assets/*',
      ...excludePaths,
      // Exclude shell paths so they're served as static assets
      ...routes.map((r) => r.shellPath + '.html'),
    ],
  };

  await fs.writeFile(
    path.join(distDir, '_routes.json'),
    JSON.stringify(routesConfig, null, 2),
    'utf-8'
  );
}
