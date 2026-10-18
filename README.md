# test-repo
A small app for devOps purposes.

A small Node.js + TypeScript HTTP service for testing a Jenkins to Kubernetes pipeline. It has no runtime dependencies. Each response shows which Jenkins build produced the image and which pod served the request, so you can see a deploy land.

## Endpoints

| Path       | Purpose                                                                 |
|------------|-------------------------------------------------------------------------|
| `/`        | Greeting, build number, git commit, pod name, namespace, node, uptime   |
| `/healthz` | Liveness probe                                                          |
| `/readyz`  | Readiness probe (returns `503` while the pod is shutting down)          |

Example response:

```json
{"message":"Hello from Jenkins + Kubernetes!","app":"test-repo","build":{"number":"99","commit":"deadbeef"},"pod":{"name":"test-repo-665f647f68-8gp5j","namespace":"jenkins-demo","node":"minikube"},"uptimeSeconds":2}
```

## Layout

```
src/            app.ts (routes), config.ts (env), server.ts (startup + graceful SIGTERM)
test/           node:test unit tests
Dockerfile      build -> test -> runtime stages (node:24-alpine, runs as non-root)
k8s/            Deployment (2 replicas, probes, Downward API) + NodePort Service (30080)
Jenkinsfile     Test -> Build image -> Publish -> Deploy -> Smoke test
```

## Run locally

With Node 24+:

```bash
npm ci
npm test
npm start
```

Or with only Docker:

```bash
docker build --target test .
```

```bash
docker build -t test-repo:local .
```

```bash
docker run --rm -p 3000:3000 test-repo:local
```

## Jenkins setup

The agent that runs the pipeline needs `docker` and `kubectl` on its PATH. It also needs `minikube` if you load the image straight into minikube instead of pushing to a registry. The Jenkinsfile works on both Linux (`sh`) and Windows (`bat`) agents.

1. Create a **Pipeline** job (or Multibranch Pipeline) pointing at this repo, with *Pipeline script from SCM* and the `Jenkinsfile` path.
2. Run it once so Jenkins picks up the parameters, then use **Build with Parameters**:

| Parameter                  | Default        | Meaning                                                                                   |
|----------------------------|----------------|-------------------------------------------------------------------------------------------|
| `K8S_NAMESPACE`            | `default`      | Namespace to deploy into (created if missing)                                             |
| `REGISTRY`                 | *(empty)*      | Leave empty to load the image into minikube; otherwise e.g. `localhost:5000` to push there |
| `MINIKUBE_PROFILE`         | `minikube`     | minikube profile used when `REGISTRY` is empty                                            |
| `KUBECONFIG_CREDENTIAL_ID` | *(empty)*      | Optional *Secret file* credential holding a kubeconfig                                    |

### Cluster access

If Jenkins runs as a Windows service (by default as *Local System*), it can't see your user's `~/.kube/config` or `~/.minikube`. Either:

- run the Jenkins service as your own Windows user, or
- upload a kubeconfig as a *Secret file* credential and set `KUBECONFIG_CREDENTIAL_ID`. A minikube kubeconfig points at certificate files under `~/.minikube`, so flatten it first: `kubectl config view --minify --flatten`.

The default image-loading path (`docker save | minikube image load -`) still needs the Jenkins user to have access to the minikube profile.

## Check the deployment

```bash
kubectl get pods -n default
```

The Service is a `NodePort` on port `30080`. Get a URL for it with:

```bash
minikube service test-repo -n default --url
```

With minikube's Docker driver on Windows or macOS, the node isn't reachable from the host directly, so this command opens a tunnel and prints a `http://127.0.0.1:<port>` URL. Keep that terminal open while you use the URL. On Linux (or with a VM driver) you can open `http://<minikube ip>:30080` directly.

Refresh a few times to see requests answered by different pods. If you only need to reach the app quickly, `kubectl port-forward -n default svc/test-repo 3000:80` also works, but it always talks to a single pod.

## Clean up

```bash
kubectl delete -n default deployment/test-repo service/test-repo
```
