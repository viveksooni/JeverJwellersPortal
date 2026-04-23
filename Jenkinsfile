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
        ENV_FILE     = '.env.production'
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
                    sh '''
                        ssh -o StrictHostKeyChecking=no -T ${VPS_USER}@${VPS_HOST} "
                            set -e

                            echo '── Moving to project directory ──'
                            cd ${APP_DIR}

                            echo '── Pulling latest code ──'
                            git fetch origin
                            git reset --hard origin/main
                            git clean -fd

                            echo '── Building and starting containers ──'
                            docker compose -f ${COMPOSE_FILE} --env-file ${ENV_FILE} up -d --build --remove-orphans

                            echo '── Container status ──'
                            docker compose -f ${COMPOSE_FILE} --env-file ${ENV_FILE} ps
                        "
                    '''
                }
            }
        }

        stage('Run Migrations') {
            steps {
                sshagent(credentials: ['vps-ssh-key']) {
                    sh '''
                        ssh -o StrictHostKeyChecking=no -T ${VPS_USER}@${VPS_HOST} "
                            set -e
                            cd ${APP_DIR}

                            echo '── Running migrations ──'
                            docker compose -f ${COMPOSE_FILE} --env-file ${ENV_FILE} run --rm server node dist/db/migrate.js
                        "
                    '''
                }
            }
        }

        stage('Health Check') {
            steps {
                sshagent(credentials: ['vps-ssh-key']) {
                    retry(5) {
                        sh '''
                            ssh -o StrictHostKeyChecking=no -T ${VPS_USER}@${VPS_HOST} "
                                set -e
                                echo '── Waiting for app to be ready ──'
                                sleep 8

                                echo '── Checking container status ──'
                                cd ${APP_DIR}
                                docker compose -f ${COMPOSE_FILE} --env-file ${ENV_FILE} ps

                                echo '── Running health check ──'
                                curl -f http://127.0.0.1:3001/health
                            "
                        '''
                    }
                }
            }
        }
    }

    post {
        success {
            echo '✅ Deployed successfully!'
        }

        failure {
            echo '❌ Deployment failed — printing container logs'
            sshagent(credentials: ['vps-ssh-key']) {
                sh '''
                    ssh -o StrictHostKeyChecking=no -T ${VPS_USER}@${VPS_HOST} "
                        cd ${APP_DIR}
                        docker compose -f ${COMPOSE_FILE} --env-file ${ENV_FILE} logs --tail=100
                    " || true
                '''
            }
        }
    }
}