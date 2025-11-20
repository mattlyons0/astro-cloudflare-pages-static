import type { AstroIntegration } from 'astro';
import type { DynamicRoutesOptions } from './types.js';
import { createVitePlugin } from './vite-plugin.js';

export type { DynamicRoutesOptions } from './types.js';

export default function cloudflarePagesStatic(
  options: DynamicRoutesOptions = {}
): AstroIntegration {
  return {
    name: 'astro-cloudflare-pages-static',
    hooks: {
      'astro:config:setup': ({ config, updateConfig, logger }) => {
        if (config.output !== 'static') {
          logger.warn(
            'astro-cloudflare-pages-static is designed for output: "static". ' +
              'For output: "server", remove the astro-cloudflare-pages-static integration to server-side render dynamic pages.'
          );
        }

        updateConfig({
          vite: {
            plugins: [createVitePlugin(options, config, logger)],
          },
        });
      },
    },
  };
}
