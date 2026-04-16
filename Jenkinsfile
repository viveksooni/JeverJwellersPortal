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
                git branch: 'main',
                    credentialsId: 'github-credentials',
                    url: 'https://github.com/vivek-soni/JeverJwellersPortal.git'
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
                sh """
                    sleep 3
                    curl -f http://127.0.0.1:3001/health || exit 1
                """
            }
        }
    }

    post {
        success {
            echo '✅ Deployment successful!'
        }
        failure {
            echo '❌ Deployment failed — rolling back'
            sh """
                cd ${PROJECT_DIR}
                docker compose -f ${COMPOSE_FILE} --env-file ${ENV_FILE} \
                    up -d --no-build
            """
        }
        always {
            sh 'docker system prune -f --filter "until=24h"'
        }
    }
}
