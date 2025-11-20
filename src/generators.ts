import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import type { AstroIntegrationLogger } from 'astro';
import type { DynamicRoute, DynamicRoutesOptions } from './types.js';
import { buildWorkerCode } from './worker/builder.js';
import { setupWorkerChain } from './worker/chain-setup.js';

/**
 * Name of the generated worker directory.
 */
const WORKER_DIR_NAME = '_worker.js';

export async function generateCloudflareWorker(
  outDir: string,
  routes: DynamicRoute[],
  _options: DynamicRoutesOptions,
  logger?: AstroIntegrationLogger
): Promise<void> {
  await fs.mkdir(outDir, { recursive: true });

  const routesData = routes.map((r) => ({
    pattern: r.pattern.source,
    shellPath: r.shellPath,
    params: r.params,
  }));

  const workerDir = path.join(outDir, WORKER_DIR_NAME);
  const workerFile = path.join(workerDir, 'index.js');

  const chainConfig = await setupWorkerChain(outDir, workerDir, logger);

  await fs.mkdir(workerDir, { recursive: true });

  const workerCode = await buildWorkerCode({
    routesData,
    upstreamImport: chainConfig.upstreamImport,
    fallbackCode: chainConfig.fallbackCode,
  });

  logger?.info(`Writing worker to ${workerFile}`);
  await fs.writeFile(workerFile, workerCode, 'utf-8');

  // Copy escape.js and its types to worker directory
  const escapeSourcePath = fileURLToPath(
    new URL('./worker/escape.js', import.meta.url)
  );
  const escapeTypesPath = fileURLToPath(
    new URL('./worker/escape.d.ts', import.meta.url)
  );
  const escapeDestPath = path.join(workerDir, 'escape.js');
  const escapeTypesDestPath = path.join(workerDir, 'escape.d.ts');
  await fs.copyFile(escapeSourcePath, escapeDestPath);
  await fs.copyFile(escapeTypesPath, escapeTypesDestPath);
}

export { generateRoutesConfig } from './routes/config-generator.js';
