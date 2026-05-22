/**
 * Cloudflare Workers entry point.
 * Exports the Hono app as default fetch handler.
 */
import { createApp } from './app.js';

const app = createApp();

export default app;
