pipeline {
    agent any

    triggers {
        githubPush()
    }

    environment {
        VPS_HOST    = '187.77.185.238'
        VPS_USER    = 'vivek_soniLess'
        APP_DIR     = '/home/vivek_soniLess/apps/JeverJwellersPortal'
        COMPOSE_FILE = 'docker-compose.prod.yml'
    }

    stages {
        stage('Checkout') {
            steps {
                echo 'Pulling latest pipeline code'
                git branch: 'main',
                    credentialsId: 'github-credentials',
                    url: 'https://github.com/viveksooni/JeverJwellersPortal.git'
            }
        }

        stage('Deploy on VPS') {
            steps {
                sshagent(credentials: ['vps-ssh-key']) {
                    sh '''
                        ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} "
                            set -e
                            cd ${APP_DIR}

                            git fetch origin
                            git reset --hard origin/main
                            git clean -fd

                            docker compose -f ${COMPOSE_FILE} down || true
                            docker compose -f ${COMPOSE_FILE} up -d --build

                            sleep 8
                            docker compose -f ${COMPOSE_FILE} ps
                        "
                    '''
                }
            }
        }

        stage('Run Migrations on VPS') {
            steps {
                sshagent(credentials: ['vps-ssh-key']) {
                    sh '''
                        ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} "
                            set -e
                            cd ${APP_DIR}
                            docker compose -f ${COMPOSE_FILE} exec -T server node dist/db/migrate.js
                        "
                    '''
                }
            }
        }

        stage('Health Check on VPS') {
            steps {
                sshagent(credentials: ['vps-ssh-key']) {
                    retry(3) {
                        sh '''
                            ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} "
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
            echo 'Deployment successful'
        }
        failure {
            echo 'Deployment failed'
        }
    }
}