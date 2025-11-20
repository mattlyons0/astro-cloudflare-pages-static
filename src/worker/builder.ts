import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { GENERATED_FILE_MARKER, PLACEHOLDER_REGEX } from '../constants.js';

const TEMPLATE_PATH = fileURLToPath(new URL('./template.js', import.meta.url));

export interface WorkerBuildConfig {
  routesData: Array<{ pattern: string; shellPath: string; params: string[] }>;
  upstreamImport: string;
  fallbackCode: string;
}

export async function buildWorkerCode(
  config: WorkerBuildConfig
): Promise<string> {
  let template = await fs.readFile(TEMPLATE_PATH, 'utf-8');

  // Remove @ts-check comment for production
  template = template.replace(/\/\/ @ts-check\n/, '');

  template =
    `${GENERATED_FILE_MARKER}\n// Do not edit manually - regenerated on each build\n` +
    template;

  template = template.replace(
    /\/\* __UPSTREAM_IMPORT__ \*\//g,
    config.upstreamImport
  );

  template = template.replace(
    /\/\* __ROUTES_DATA__ \*\/ \[\]/,
    JSON.stringify(config.routesData, null, 2)
  );

  template = template.replace(
    /\/\* __FALLBACK_CODE__ \*\/\n\s+return env\.ASSETS\.fetch\(request\);/g,
    config.fallbackCode
  );

  template = template.replace(
    /\/\* __PLACEHOLDER_REGEX__ \*\/ \/__ACPS_\(\[\^_\]\+\)__\/g/,
    PLACEHOLDER_REGEX.toString()
  );

  return template;
}
