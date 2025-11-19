import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import cloudflarePagesStatic from 'astro-cloudflare-pages-static';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  adapter: cloudflare(),
  integrations: [cloudflarePagesStatic()],
});
