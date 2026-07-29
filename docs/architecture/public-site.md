# Static Public Site

Status: **Accepted**

## Purpose

`apps/site` owns the public landing page and browser-readable documentation for
the AI-native low-poly workbench. It is an independently built source fragment
and cannot import the product workbench, engine, Blockbench, React, or Three.js
code.

## Authority

Marketing copy lives inside `apps/site`. Technical documentation remains
authoritative in the root `docs/` directory. The site generator reads those
Markdown files at build time, creates navigation from their headings and paths,
and emits one HTML document per source file.

No second documentation content tree is maintained.

## Build boundary

The site build may use a Markdown compiler. Its deploy output contains only:

- static HTML;
- content-hashed CSS and browser JavaScript;
- raster metadata assets;
- CDN header and redirect rules.

There are no server functions, runtime environment variables, databases,
accounts, or product bundles in this output.

## Routes

- `/` is the Ashfox workbench;
- `/home/` is the product landing page;
- `/docs/` is the documentation entry;
- `/docs/<source-path>/` maps to `docs/<source-path>.md`;
- `/agent-manifest.json` publishes the workbench contract.

All internal links use same-origin absolute paths. `scripts/build-public.js`
combines the independently built workbench and site fragment into one
deployable directory.

## CDN behavior

HTML is always revalidated. Content-hashed CSS and JavaScript are immutable.
The build emits security and cache headers beside the static files so the CDN
can serve the directory directly without application code.

## Deployment

`npm run build:public` emits the only deployable directory at `dist/public`.
Cloudflare Pages watches `main`, runs that command, and publishes the directory.
The Pages project owns the `ashfox.io` custom domain, DNS, CDN, and deployment
history without a second hosting authority.
