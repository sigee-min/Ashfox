# ashfox Public Site

This workspace builds the `/` landing page and `/docs/` documentation
fragment used by the single ashfox static deployment.

- Landing copy is owned by `src/content.mjs`.
- Technical documentation is read from the repository `docs/` directory.
- The site imports no product or engine package.
- `dist/` contains the site fragment consumed by `npm run build:public`.

Product links always target `/workbench/` on the same origin.
Canonical and social metadata use `https://ashfox.io`.
