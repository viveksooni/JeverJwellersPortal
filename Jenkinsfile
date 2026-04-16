pipeline {
    agent any

    environment {
        COMPOSE_FILE = 'docker-compose.prod.yml'
        ENV_FILE     = '/home/vivek_soniLess/projects/JeverJwellersPortal/.env.production'
        PROJECT_DIR  = '/home/vivek_soniLess/projects/JeverJwellersPortal'
    }

    stages {
        stage('Checkout') {
            steps {
                echo '── Pulling latest code ──'
                sh """
                    cd ${PROJECT_DIR}
                    git pull origin main
                """
            }
        }

        stage('Tag Previous Images') {
            steps {
                echo '── Tagging current images as rollback targets ──'
                sh """
                    docker tag jever_server:latest jever_server:rollback || true
                    docker tag jever_admin:latest  jever_admin:rollback  || true
                """
            }
        }

        stage('Build Images') {
            steps {
                echo '── Building Docker images ──'
                sh """
                    cd ${PROJECT_DIR}
                    docker compose -f ${COMPOSE_FILE} --env-file ${ENV_FILE} \
                        build --no-cache
                """
            }
        }

        stage('Deploy') {
            steps {
                echo '── Deploying containers ──'
                sh """
                    cd ${PROJECT_DIR}
                    docker compose -f ${COMPOSE_FILE} --env-file ${ENV_FILE} \
                        up -d
                """
            }
        }

        stage('Run Migrations') {
            steps {
                echo '── Running database migrations ──'
                sh """
                    sleep 5
                    docker exec jever_server node dist/db/migrate.js
                """
            }
        }

        stage('Health Check') {
            steps {
                echo '── Checking API health ──'
                // Retry 3 times with 5s gap before failing
                retry(3) {
                    sh """
                        sleep 5
                        curl -f http://127.0.0.1:3001/health || exit 1
                    """
                }
            }
        }
    }

    post {
        success {
            echo '✅ Deployment successful!'
            // Clean up only old dangling images, scoped safely
            sh 'docker image prune -f'
        }
        failure {
            echo '❌ Deployment failed — rolling back to previous images'
            sh """
                cd ${PROJECT_DIR}
                docker compose -f ${COMPOSE_FILE} --env-file ${ENV_FILE} \
                    down
                docker tag jever_server:rollback jever_server:latest || true
                docker tag jever_admin:rollback  jever_admin:latest  || true
                docker compose -f ${COMPOSE_FILE} --env-file ${ENV_FILE} \
                    up -d --no-build
            """
        }
    }
}