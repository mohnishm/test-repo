import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp, type AppState } from '../src/app';
import { loadConfig } from '../src/config';

describe('app', () => {
  const state: AppState = { ready: true };
  let server: Server;
  let baseUrl: string;

  before(async () => {
    const config = loadConfig({
      PORT: '0',
      BUILD_NUMBER: '42',
      GIT_COMMIT: 'abc1234',
      POD_NAME: 'test-pod',
      POD_NAMESPACE: 'test-ns',
    });
    server = createApp(config, state);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(() => new Promise<void>((resolve) => server.close(() => resolve())));

  test('GET / returns build and pod info', async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.build, { number: '42', commit: 'abc1234' });
    assert.equal(body.pod.name, 'test-pod');
    assert.equal(body.pod.namespace, 'test-ns');
  });

  test('GET /healthz returns ok', async () => {
    const res = await fetch(`${baseUrl}/healthz`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: 'ok' });
  });

  test('GET /readyz reflects readiness state', async () => {
    assert.equal((await fetch(`${baseUrl}/readyz`)).status, 200);
    state.ready = false;
    try {
      assert.equal((await fetch(`${baseUrl}/readyz`)).status, 503);
    } finally {
      state.ready = true;
    }
  });

  test('unknown path returns 404', async () => {
    const res = await fetch(`${baseUrl}/nope`);
    assert.equal(res.status, 404);
  });

  test('non-GET method returns 405', async () => {
    const res = await fetch(`${baseUrl}/`, { method: 'POST' });
    assert.equal(res.status, 405);
  });
});

describe('loadConfig', () => {
  test('rejects an invalid port', () => {
    assert.throws(() => loadConfig({ PORT: 'abc' }), /Invalid PORT/);
  });
});
