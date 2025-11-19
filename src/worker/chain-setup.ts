import fs from 'fs/promises';
import path from 'path';
import type { AstroIntegrationLogger } from 'astro';
import { GENERATED_FILE_MARKER } from '../constants.js';

/**
 * Name for the upstream worker file when chaining workers.
 */
const UPSTREAM_WORKER_FILENAME = '_cloudflare_static_upstream.js';

export interface WorkerChainConfig {
  upstreamImport: string;
  fallbackCode: string;
}

export async function setupWorkerChain(
  outDir: string,
  workerDir: string,
  logger?: AstroIntegrationLogger
): Promise<WorkerChainConfig> {
  const workerType = await getWorkerFileType(workerDir);

  if (workerType === 'none') {
    return createDefaultChainConfig();
  }

  const isUserDefined = await isUserDefinedWorker(workerDir);
  if (!isUserDefined) {
    return createDefaultChainConfig();
  }

  return prepareWorkerChain(outDir, workerDir, workerType, logger);
}

async function getWorkerFileType(
  workerDir: string
): Promise<'none' | 'directory' | 'file'> {
  try {
    const stats = await fs.stat(workerDir);
    return stats.isDirectory() ? 'directory' : 'file';
  } catch {
    return 'none';
  }
}

async function isUserDefinedWorker(workerDir: string): Promise<boolean> {
  const existingIndex = path.join(workerDir, 'index.js');
  try {
    await fs.access(existingIndex);
    const existingContent = await fs.readFile(existingIndex, 'utf-8');
    return !existingContent.includes(GENERATED_FILE_MARKER);
  } catch {
    return false;
  }
}

function createDefaultChainConfig(): WorkerChainConfig {
  return {
    upstreamImport: '',
    fallbackCode: 'return env.ASSETS.fetch(request);',
  };
}

async function prepareWorkerChain(
  outDir: string,
  workerDir: string,
  workerType: 'directory' | 'file',
  logger?: AstroIntegrationLogger
): Promise<WorkerChainConfig> {
  const upstreamPath = path.join(workerDir, UPSTREAM_WORKER_FILENAME);

  if (workerType === 'directory') {
    const existingIndex = path.join(workerDir, 'index.js');
    await fs.copyFile(existingIndex, upstreamPath);
    logger?.info(`Chaining existing worker as ${UPSTREAM_WORKER_FILENAME}`);
  } else {
    logger?.info('Converting _worker.js file to directory structure');
    const tempPath = path.join(outDir, '_worker.js.backup');
    await fs.copyFile(workerDir, tempPath);
    await fs.rm(workerDir);
    await fs.mkdir(workerDir, { recursive: true });
    await fs.copyFile(tempPath, upstreamPath);
    await fs.rm(tempPath);
  }

  return {
    upstreamImport: `import cloudflareStaticUpstream from "./${UPSTREAM_WORKER_FILENAME}";`,
    fallbackCode: `
    if (cloudflareStaticUpstream && cloudflareStaticUpstream.fetch) {
      return cloudflareStaticUpstream.fetch(request, env, ctx);
    }
    return env.ASSETS.fetch(request);`,
  };
}
