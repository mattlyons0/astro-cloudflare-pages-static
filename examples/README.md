# Astro Cloudflare Pages Static Examples

Demonstrates `astro-cloudflare-pages-static` usage patterns.

## Preview without Cloudflare Worker (dev mode)

```bash
npm install
npm run dev
```

Visit `http://localhost:4321`

## Preview with Cloudflare Worker

```bash
npm run build
npm run preview
```

## Examples

- **`/users/[id]`** - Basic dynamic route with client-side data fetching
- **`/docs/[...slug]`** - Rest parameters for nested paths
- **`/products/[category]/[id]`** - Multiple dynamic segments

All routes use standard Astro `[param]` syntax.
The integration automatically generates a Cloudflare Worker to inject parameters at runtime.
