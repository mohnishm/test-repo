import { hostname } from 'node:os';

export interface AppConfig {
  port: number;
  appName: string;
  greeting: string;
  buildNumber: string;
  gitCommit: string;
  podName: string;
  podNamespace: string;
  nodeName: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid PORT: ${env.PORT}`);
  }

  return {
    port,
    appName: env.APP_NAME ?? 'test-repo',
    greeting: env.GREETING ?? 'Hello from Jenkins + Kubernetes!',
    // Baked into the image at build time by Jenkins (see Dockerfile).
    buildNumber: env.BUILD_NUMBER ?? 'local',
    gitCommit: env.GIT_COMMIT ?? 'unknown',
    // Injected by the Kubernetes Downward API (see k8s/deployment.yaml).
    podName: env.POD_NAME ?? hostname(),
    podNamespace: env.POD_NAMESPACE ?? 'n/a',
    nodeName: env.NODE_NAME ?? 'n/a',
  };
}
