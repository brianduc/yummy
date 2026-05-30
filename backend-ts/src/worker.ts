// LEGACY: Cloudflare Workers deployment path — gated as part of AWS migration (T11).
// This entry point was used with `wrangler dev` / `wrangler deploy`.
// The active runtime is Node.js via @hono/node-server (src/index.ts).
// Do not use without restoring wrangler to devDependencies.
import { createApp } from './app.js';

export default createApp();
