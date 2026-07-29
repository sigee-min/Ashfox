# Ashfox Public Site

This workspace builds the public landing page and the documentation site as one
static CDN directory.

- Landing copy is owned by `src/content.mjs`.
- Technical documentation is read from the repository `docs/` directory.
- The site imports no product or engine package.
- `dist/` contains the complete deployable output.

`ASHFOX_STUDIO_URL` may set the product CTA at build time. It defaults to the
reserved `/studio/` route. `ASHFOX_SITE_ORIGIN` may set the absolute public
origin used by canonical and social metadata.
