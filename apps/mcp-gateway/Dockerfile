FROM node:22-alpine

WORKDIR /workspace

COPY package.json package-lock.json tsconfig.json ./
COPY apps/mcp-gateway/package.json apps/mcp-gateway/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/plugin-desktop/package.json apps/plugin-desktop/package.json
COPY apps/ashfox/package.json apps/ashfox/package.json
COPY packages/runtime/package.json packages/runtime/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/conformance/package.json packages/conformance/package.json
COPY packages/backend-core/package.json packages/backend-core/package.json
COPY packages/backend-blockbench/package.json packages/backend-blockbench/package.json
COPY packages/backend-engine/package.json packages/backend-engine/package.json

RUN npm install --no-audit --no-fund

COPY . .

CMD ["npm", "--workspace", "@ashfox/mcp-gateway", "run", "start"]
