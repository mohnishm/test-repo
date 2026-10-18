import { createApp, type AppState } from './app';
import { loadConfig } from './config';

const SHUTDOWN_TIMEOUT_MS = 10_000;

const config = loadConfig();
const state: AppState = { ready: true };
const server = createApp(config, state);

server.listen(config.port, () => {
  console.log(
    `${config.appName} listening on :${config.port} ` +
      `(build ${config.buildNumber}, commit ${config.gitCommit}, pod ${config.podName})`,
  );
});

function shutdown(signal: NodeJS.Signals): void {
  console.log(`Received ${signal}, shutting down gracefully`);
  state.ready = false;

  server.close((err) => {
    if (err) {
      console.error('Error while closing server', err);
      process.exit(1);
    }
    process.exit(0);
  });

  setTimeout(() => {
    console.error('Forced exit after shutdown timeout');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS).unref();
}

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
