import 'dotenv/config';
import { serve } from '@hono/node-server';
import { createApp } from './app.js';

const app = createApp();

const isWorker = typeof process === 'undefined';

if (!isWorker) {
  const port = parseInt(process.env.PORT ?? '8000', 10);

  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
    console.log(`API docs at http://localhost:${info.port}/docs`);
  });
}

export default app;
