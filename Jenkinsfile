pipeline {
    agent any

    triggers {
        githubPush()
    }

    environment {
        VPS_HOST     = '187.77.185.238'
        VPS_USER     = 'vivek_soniLess'
        APP_DIR      = '/home/vivek_soniLess/projects/JeverJwellersPortal'
        COMPOSE_FILE = 'docker-compose.prod.yml'
        ENV_FILE     = '/home/vivek_soniLess/projects/JeverJwellersPortal/.env.production'
    }

    stages {

        stage('Checkout') {
            steps {
                echo '── Pulling latest pipeline code ──'
                git branch: 'main',
                    credentialsId: 'github-credentials',
                    url: 'https://github.com/viveksooni/JeverJwellersPortal.git'
            }
        }

        stage('Deploy on VPS') {
            steps {
                sshagent(credentials: ['vps-ssh-key']) {
                    sh """
                        ssh -o StrictHostKeyChecking=no -T ${VPS_USER}@${VPS_HOST} '
                            set -e

                            echo "── Pulling latest code ──"
                            sudo chown -R \$(whoami):\$(whoami) ${APP_DIR} || true
                            cd ${APP_DIR}
                            git fetch origin
                            git reset --hard origin/main
                            git clean -fd

                            echo "── Building and starting containers ──"
                            docker compose -f ${APP_DIR}/${COMPOSE_FILE} --env-file ${ENV_FILE} up -d --build --remove-orphans

                            echo "── Container status ──"
                            docker compose -f ${APP_DIR}/${COMPOSE_FILE} ps
                        '
                    """
                }
            }
        }

        stage('Run Migrations') {
            steps {
                sshagent(credentials: ['vps-ssh-key']) {
                    sh """
                        ssh -o StrictHostKeyChecking=no -T ${VPS_USER}@${VPS_HOST} '
                            set -e
                            sleep 8
                            docker compose -f ${APP_DIR}/${COMPOSE_FILE} exec -T server node dist/db/migrate.js
                        '
                    """
                }
            }
        }

        stage('Health Check') {
            steps {
                sshagent(credentials: ['vps-ssh-key']) {
                    retry(3) {
                        sh """
                            ssh -o StrictHostKeyChecking=no -T ${VPS_USER}@${VPS_HOST} '
                                sleep 5
                                curl -sf http://127.0.0.1:3001/health || exit 1
                            '
                        """
                    }
                }
            }
        }
    }

    post {
        success {
            echo '✅ Deployment successful'
        }
        failure {
            echo '❌ Deployment failed — printing container logs'
            sshagent(credentials: ['vps-ssh-key']) {
                sh """
                    ssh -o StrictHostKeyChecking=no -T ${VPS_USER}@${VPS_HOST} '
                        docker compose -f ${APP_DIR}/${COMPOSE_FILE} logs --tail=50
                    ' || true
                """
            }
        }
    }
}