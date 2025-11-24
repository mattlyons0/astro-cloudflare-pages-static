# Changelog

All notable changes to this project will be documented in this file.

## [1.0.1] - 2025-11-23

### Fixed

- Fixed an issue with static content collections where they were incorrectly identified as dynamic routes.

## [1.0.0] - 2025-11-19

### Added

- Initial release of astro-cloudflare-pages-static.
- Automatic detection and handling of dynamic routes using `[param]` syntax.
- Automatic `getStaticPaths` injection for dynamic routes.
- Support for `Astro.params` in client-side dynamic routes.
- Worker chaining support for existing Cloudflare Workers.
- Development mode support without Wrangler.
