import { createServer, type Server, type ServerResponse } from 'node:http';
import type { AppConfig } from './config';

export interface AppState {
  /** Flipped to false on shutdown so Kubernetes stops routing traffic here. */
  ready: boolean;
}

export function createApp(config: AppConfig, state: AppState = { ready: true }): Server {
  const startedAt = Date.now();

  return createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return sendJson(res, 405, { error: 'method not allowed' });
    }

    const { pathname } = new URL(req.url ?? '/', 'http://localhost');

    switch (pathname) {
      case '/':
        return sendJson(res, 200, {
          message: config.greeting,
          app: config.appName,
          build: { number: config.buildNumber, commit: config.gitCommit },
          pod: { name: config.podName, namespace: config.podNamespace, node: config.nodeName },
          uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
        });
      case '/healthz':
        return sendJson(res, 200, { status: 'ok' });
      case '/readyz':
        return state.ready
          ? sendJson(res, 200, { status: 'ready' })
          : sendJson(res, 503, { status: 'shutting down' });
      default:
        return sendJson(res, 404, { error: 'not found' });
    }
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}
