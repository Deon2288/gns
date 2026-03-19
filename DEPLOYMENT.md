# Deployment Instructions

## Environment Setup
1. Ensure you have Docker and Docker Compose installed on your machine.
2. Clone the repository:
   ```bash
   git clone https://github.com/Deon2288/gns.git
   cd gns
   ```

## Docker Compose Commands
- To build the application:
   ```bash
   docker-compose build
   ```
- To start the application:
   ```bash
   docker-compose up
   ```
- To run the application in detached mode:
   ```bash
   docker-compose up -d
   ```
- To stop the application:
   ```bash
   docker-compose down
   ```

## Database Migrations
- To run migrations, use the following command:
   ```bash
   docker-compose run web python manage.py migrate
   ```

## Troubleshooting Guide
- If you experience issues starting the containers, check the logs using:
   ```bash
   docker-compose logs
   ```
- Ensure that the correct environment variables are set in your `.env` file. Refer to the sample `.env.example` provided in the repository.
- If the application does not respond, ensure that the ports are not being used by other applications on your machine.