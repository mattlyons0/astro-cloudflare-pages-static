# astro-cloudflare-pages-static

An Astro integration for client-side dynamic routes with Cloudflare Pages.

Without this integration, Astro [dynamic routes](https://docs.astro.build/en/guides/routing/#static-ssg-mode) are only supported two scenarios:

1. Itemizing every path using `getStaticPaths()`
2. Using server-side rendering without itemizing every path

This integration offers a third option: Using static rendering without itemizing every path.
This enables lightweight routing similar to SvelteKit's adapter-static, serving the same HTML shell for dynamic paths and handling content client-side.

By making use of [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/functions/get-started/) exclusively for lightweight routing, cost, execution time and complexity remains minimal.
Compared to full SSR, this approach is **significantly cheaper** (invoking functions only for routing) and **faster** (sub-1ms latency for hot starts), making it ideal for SaaS dashboards and other dynamic routes that can tolerate loading progressively.

All pages in your Astro project remain rendered statically, while benefiting from some server-side rendering features (such as dynamic path pre-rendering).

## Features

- 🚀 **Automatic Route Detection** - Uses [standard Astro `[param]` syntax](https://docs.astro.build/en/guides/routing/#on-demand-dynamic-routes)
- 📦 **Zero Config** - Works out of the box
- 🪄 **Auto-Injection** - Automatically handles `getStaticPaths` for you
- 🎨 **Real Astro Pages** - Your dynamic routes are actual `.astro` files with full styling and pre-rendering
- 🔧 **Client-Side First** - Serves pre-rendered HTML shell, you handle data fetching in the browser
- 🌐 **Dev Mode Support** - No Wrangler needed during development
- ⚡ **Lightweight** - Generates minimal Cloudflare Worker code (typically <1ms execution time)

## Installation

```bash
npm install astro-cloudflare-pages-static
```

## Usage

### 1. Add to Astro Config

```js
// astro.config.mjs
import { defineConfig } from 'astro';
import cloudflare from "@astrojs/cloudflare";
import cloudflarePagesStatic from 'astro-cloudflare-pages-static';

export default defineConfig({
  output: 'static',
  adapter: cloudflare(), // optional
  integrations: [
    cloudflarePagesStatic()
  ]
});
```

### 2. Create Dynamic Routes

Just like using Astro with server-side rendering, creating routes is as simple as naming a file or folder `[slug].astro` or `[...slug].astro`.

You can access route parameters using `Astro.params`:

```astro
<!-- src/pages/user/[id].astro -->
---
import Layout from '../../layouts/Layout.astro';
const { id } = Astro.params;
---

<Layout title={`User ${id}`}>
  <div id="app">
    <p>Loading user {id}...</p>
  </div>
  
  <script define:vars={{ id }}>
    // Fetch your data client-side
    async function loadUser() {
      const response = await fetch(`/api/users/${id}`);
      const user = await response.json();
      
      // Render your content
      document.getElementById('app').innerHTML = `
        <h1>${user.name}</h1>
        <p>User ID: ${id}</p>
      `;
    }
    
    loadUser();
  </script>
</Layout>
```

### 3. Build and Deploy

```bash
npm run build
# Deploy dist/ to Cloudflare Pages
```

## Cloudflare Adapter Compatibility

This integration is designed for **static output** with client-side routing.
When used with `@astrojs/cloudflare` adapter `output: 'static'` configuration **must be used**.

If you are using server-side rendering (`output: 'server'`) this integration is redundant, dynamic pages already work for you.

## Security Considerations

This integration works cheaply by using simple regex string replacement.
While cost effective, only light content sanitation is done (escaping basic HTML tokens).
Use caution when working with parameter values as they are user generated content, do **not** use them for `innerHTML` without sanitizing first.

## API

### Options

```typescript
interface DynamicRoutesOptions {
  // Additional paths to exclude from routing
  excludePaths?: string[];
}
```

## Examples

You can find a complete working example in the [examples/](./examples/) directory.

```bash
cd examples
npm install
npm run dev
```

## Advanced Features

### Worker Chaining

If you have an existing `_worker.js` in your project, this integration will automatically chain it in the `dist` directory.
This allows you to combine multiple Cloudflare Workers.

*This behavior is experimental, if you have issues open an issue containing a minimal reproduction.*

### Excluding Paths

Additional paths to [avoid running Cloudflare Pages Functions](https://developers.cloudflare.com/pages/functions/routing/#create-a-_routesjson-file):

```javascript
cloudflarePagesStatic({
  excludePaths: ['/api/*', '/admin/*']
})
```

## Limitations

This integration relies on string replacement of an "encoded" static parameter stub at the edge.
If you modify the parameter string in your pre-rendered component logic, the parameter will not be correctly replaced until client-side hydration completes.

To avoid this, delay manipulation of the parameter value until client-side render.
Or better yet, use CSS to visually manipulate the parameter value while maintaining the full source.
