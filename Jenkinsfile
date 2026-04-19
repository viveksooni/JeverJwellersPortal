pipeline {
    agent any

    triggers {
        githubPush()
    }

    environment {
        COMPOSE_FILE = 'docker-compose.prod.yml'
    }

    stages {
        stage('Setup') {
            steps {
                script {
                    def out = sh(
                        script: 'command -v docker-compose 2>/dev/null || docker compose version > /dev/null 2>&1 && echo "docker compose" || true',
                        returnStdout: true
                    ).trim()
                    if (out.contains('docker compose')) {
                        env.COMPOSE_CMD = 'docker compose'
                    } else if (out) {
                        env.COMPOSE_CMD = out   // full path from command -v
                    } else {
                        error 'Neither docker-compose nor docker compose plugin found'
                    }
                    echo "Using compose command: ${env.COMPOSE_CMD}"
                }
            }
        }

        stage('Checkout') {
            steps {
                echo '── Pulling latest code ──'
                git branch: 'main',
                    credentialsId: 'github-credentials',
                    url: 'https://github.com/viveksooni/JeverJwellersPortal.git'
            }
        }

        stage('Tag Previous Images') {
            steps {
                sh '''
                    docker tag jever_server:latest jever_server:rollback || true
                    docker tag jever_admin:latest  jever_admin:rollback  || true
                '''
            }
        }

       stage('Build Images') {
    steps {
        withCredentials([file(credentialsId: 'jever-env-file', variable: 'ENV_FILE')]) {
            sh """
                ${COMPOSE_CMD} -f ${WORKSPACE}/${COMPOSE_FILE} --env-file \${ENV_FILE} \
                    build --no-cache
            """
        }
    }
}

        stage('Deploy') {
            steps {
                withCredentials([file(credentialsId: 'jever-env-file', variable: 'ENV_FILE')]) {
                    sh """
                        ${COMPOSE_CMD} -f ${WORKSPACE}/${COMPOSE_FILE} --env-file \${ENV_FILE} \
                            up -d
                    """
                }
            }
        }

        stage('Run Migrations') {
            steps {
                sh '''
                    sleep 5
                    docker exec jever_server node dist/db/migrate.js
                '''
            }
        }

        stage('Health Check') {
            steps {
                retry(3) {
                    sh '''
                        sleep 5
                        curl -f http://127.0.0.1:3001/health || exit 1
                    '''
                }
            }
        }
    }

    post {
        success {
            echo '✅ Deployed successfully!'
            sh 'docker image prune -f'
        }
        failure {
            echo '❌ Rolling back...'
            withCredentials([file(credentialsId: 'jever-env-file', variable: 'ENV_FILE')]) {
                sh """
                    ${COMPOSE_CMD} -f ${WORKSPACE}/${COMPOSE_FILE} --env-file \${ENV_FILE} down
                    docker tag jever_server:rollback jever_server:latest || true
                    docker tag jever_admin:rollback  jever_admin:latest  || true
                    ${COMPOSE_CMD} -f ${WORKSPACE}/${COMPOSE_FILE} --env-file \${ENV_FILE} up -d --no-build
                """
            }
        }
    }
}