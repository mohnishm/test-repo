// Builds, tests and deploys test-repo to Kubernetes.
// Agent requirements: docker and kubectl on PATH (plus minikube when REGISTRY is empty).
// Works on both Linux (sh) and Windows (bat) agents.

def run(String cmd) {
  if (isUnix()) {
    sh cmd
  } else {
    bat cmd
  }
}

def withKube(Closure body) {
  if (params.KUBECONFIG_CREDENTIAL_ID?.trim()) {
    withCredentials([file(credentialsId: params.KUBECONFIG_CREDENTIAL_ID.trim(), variable: 'KUBECONFIG')]) {
      body()
    }
  } else {
    body()
  }
}

pipeline {
  agent any

  options {
    buildDiscarder(logRotator(numToKeepStr: '10'))
    timeout(time: 15, unit: 'MINUTES')
    disableConcurrentBuilds()
  }

  parameters {
    string(name: 'K8S_NAMESPACE', defaultValue: 'default',
           description: 'Namespace to deploy into (created if missing).')
    string(name: 'REGISTRY', defaultValue: '',
           description: 'Registry to push to, e.g. localhost:5000. Leave empty to load the image straight into minikube.')
    string(name: 'MINIKUBE_PROFILE', defaultValue: 'minikube',
           description: 'minikube profile used when REGISTRY is empty.')
    string(name: 'KUBECONFIG_CREDENTIAL_ID', defaultValue: '',
           description: 'Optional "Secret file" credential holding a kubeconfig. Leave empty to use the agent\'s default kubeconfig.')
  }

  environment {
    APP_NAME = 'test-repo'
  }

  stages {
    stage('Prepare') {
      steps {
        script {
          env.COMMIT = env.GIT_COMMIT ?: 'unknown'
          env.IMAGE_TAG = "${env.BUILD_NUMBER}-${env.COMMIT.take(7)}"
          def repo = params.REGISTRY?.trim() ? "${params.REGISTRY.trim()}/${env.APP_NAME}" : env.APP_NAME
          env.IMAGE = "${repo}:${env.IMAGE_TAG}"
          echo "Image: ${env.IMAGE}"
        }
      }
    }

    stage('Test') {
      steps {
        run "docker build --target test -t ${env.APP_NAME}:test ."
      }
    }

    stage('Build image') {
      steps {
        run "docker build --build-arg BUILD_NUMBER=${env.BUILD_NUMBER} --build-arg GIT_COMMIT=${env.COMMIT} -t ${env.IMAGE} ."
      }
    }

    stage('Publish image') {
      steps {
        script {
          if (params.REGISTRY?.trim()) {
            run "docker push ${env.IMAGE}"
          } else {
            // Piped via stdin: `minikube image load <name>` fails on Windows 11 builds without wmic.
            run "docker save ${env.IMAGE} | minikube -p ${params.MINIKUBE_PROFILE} image load -"
          }
        }
      }
    }

    stage('Deploy') {
      steps {
        script {
          def deployment = readFile('k8s/deployment.yaml').replace('IMAGE_PLACEHOLDER', env.IMAGE)
          writeFile file: 'k8s-rendered/deployment.yaml', text: deployment
          writeFile file: 'k8s-rendered/service.yaml', text: readFile('k8s/service.yaml')

          withKube {
            run "kubectl create namespace ${params.K8S_NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -"
            run "kubectl apply -n ${params.K8S_NAMESPACE} -f k8s-rendered/"
            run "kubectl rollout status deployment/${env.APP_NAME} -n ${params.K8S_NAMESPACE} --timeout=120s"
          }
        }
      }
    }

    stage('Smoke test') {
      steps {
        script {
          withKube {
            run "kubectl exec -n ${params.K8S_NAMESPACE} deploy/${env.APP_NAME} -- wget -qO- http://127.0.0.1:3000/"
          }
        }
      }
    }
  }

  post {
    failure {
      script {
        withKube {
          // Best-effort diagnostics; don't mask the original failure.
          catchError(buildResult: 'FAILURE', stageResult: 'FAILURE') {
            run "kubectl get pods -n ${params.K8S_NAMESPACE} -o wide"
            run "kubectl describe deployment/${env.APP_NAME} -n ${params.K8S_NAMESPACE}"
          }
        }
      }
    }
  }
}
