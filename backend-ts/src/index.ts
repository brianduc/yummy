/**
 * YUMMY Backend Entry Point.
 *
 * - Local dev:   starts an HTTP server via @hono/node-server on process.env.PORT (default 8000).
 * - Cloudflare Workers: exports the Hono app as default fetch handler.
 */
import 'dotenv/config';
import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { createDb } from './db/client.js';

const app = createApp();

const isWorker = typeof process === 'undefined';

if (!isWorker) {
  const port = parseInt(process.env.PORT || '8000', 10);
  createDb();

  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
    console.log(`API docs at http://localhost:${info.port}/docs`);
  });
}

export default app;
