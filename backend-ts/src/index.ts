import 'dotenv/config';
import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { checkDbConnection, closePostgresClient, createDb } from './db/client.js';

const isWorker = typeof process === 'undefined';

let app: ReturnType<typeof createApp>;

function describeStartupError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);

  const details: string[] = [error.name];
  const maybeCode = (error as { code?: unknown }).code;
  if (typeof maybeCode === 'string' && maybeCode.length > 0) {
    details.push(maybeCode);
  }
  if (error.message.length > 0) {
    details.push(error.message);
  }

  return details.join(': ');
}

if (isWorker) {
  app = createApp();
} else {
  const port = parseInt(process.env.PORT ?? '8000', 10);

  try {
    const runtimeDb = createDb();
    await checkDbConnection();
    app = createApp({ db: runtimeDb });
  } catch (e) {
    console.error(
      `Unable to connect to Postgres with DATABASE_URL: ${describeStartupError(e)}. ` +
        'Verify DATABASE_URL and database availability before starting the backend.',
    );
    await closePostgresClient();
    process.exit(1);
  }

  const server = serve({ fetch: app.fetch, port }, (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
    console.log(`API docs at http://localhost:${info.port}/docs`);
  });

  let isShuttingDown = false;
  const shutdown = (signal: NodeJS.Signals) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(`Received ${signal}; shutting down HTTP server and Postgres pool.`);

    const forceExit = setTimeout(() => {
      console.error('Graceful shutdown timed out; forcing exit.');
      process.exit(1);
    }, 10_000);
    forceExit.unref();

    if ('closeIdleConnections' in server && typeof server.closeIdleConnections === 'function') {
      server.closeIdleConnections();
    }

    server.close((error?: Error) => {
      closePostgresClient()
        .then(() => {
          clearTimeout(forceExit);
          if (error) console.error(error);
          process.exit(error ? 1 : 0);
        })
        .catch((e: unknown) => {
          clearTimeout(forceExit);
          console.error(e);
          process.exit(1);
        });
    });
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

export default app;
