# Static Public Site

Status: **Accepted**

## Purpose

`apps/site` owns the public landing page and the browser-readable documentation
site. It is a separate static delivery surface and cannot import Web Studio,
engine, Blockbench, React, or Three.js code.

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

- `/` is the product landing page;
- `/docs/` is the documentation entry;
- `/docs/<source-path>/` maps to `docs/<source-path>.md`;
- `/studio/` is reserved for the independently built Web Studio deployment.

The public site uses `/studio/` as its default product link. A production build
may set `ASHFOX_STUDIO_URL` to an absolute studio origin without changing site
source.

## CDN behavior

HTML is always revalidated. Content-hashed CSS and JavaScript are immutable.
The build emits security and cache headers beside the static files so the CDN
can serve the directory directly without application code.
