# TaskFlow API - Senior Backend Engineer Coding Challenge

## Tech Stack

- **Language**: TypeScript
- **Framework**: NestJS
- **ORM**: TypeORM with PostgreSQL
- **Queue System**: BullMQ with Redis
- **API Style**: REST with JSON
- **Package Manager**: Bun
- **Testing**: Bun test

## Getting Started

### Prerequisites

- Node.js (v16+)
- Bun (latest version)
- PostgreSQL
- Redis

### Setup Instructions

1. Clone this repository
2. Install dependencies:
   ```bash
   bun install
   ```
3. Configure environment variables by copying `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   # Update the .env file with your database and Redis connection details
   ```
4. Database Setup:
   
   Ensure your PostgreSQL database is running, then create a database:
   ```bash
   # Using psql
   psql -U postgres
   CREATE DATABASE taskflow;
   \q
   
   # Or using createdb
   createdb -U postgres taskflow
   ```
   
   Build the TypeScript files to ensure the migrations can be run:
   ```bash
   bun run build
   ```

5. Run database migrations:
   ```bash
   # Option 1: Standard migration (if "No migrations are pending" but tables aren't created)
   bun run migration:run
   
   # Option 2: Force table creation with our custom script
   bun run migration:custom
   ```
   
   Our custom migration script will:
   - Try to run formal migrations first
   - If no migrations are executed, it will directly create the necessary tables
   - It provides detailed logging to help troubleshoot database setup issues

6. Seed the database with initial data:
   ```bash
   bun run seed
   ```
   
7. Start the development server:
   ```bash
   bun run start:dev
   ```


## Analysis of the core problems

1. Nest can't resolve dependencies of the OverdueTasksModule
    - Nest requires exporting TypeOrmModule to use repository in other module
    - Fix: Export TypeOrmModule from TaskModule
    - Update: instead of using TaskRespository in OverdueTaskService use TaskService

2. JwtStrategy requires a secret or key
    - configs from src/config from is not loaded in AuthModule
    - Fix: import and load src/config in AppModule, AuthModule

3. Current tasks controller is not using AuthGuard and CurrentUser decorator
    - Protect tasks api using AuthGuard
    - Only allow user to view their tasks using CurrentUser decorator

4. Anti-pattern in controller
    - Move repository query to service instead of controllers

## Performance and security improvements made

1. Add concurrency in task queue
2. Use refresh token rotation for auth
3. Batch process database query
4. Add role based authorization and protect users CRUD APIs.
5. Implement rate limiting using @nestjs/throttler
6. Implement proper caching machanism using @nestjs/cache-manager 
7. Update error response

## Architectural approach

1. Remove repository usage from controller
2. Use well established packages for rate limiting instead of custom implementation

## API Endpoints

The API should expose the following endpoints:

### Authentication
- `POST /auth/login` - Authenticate a user
- `POST /auth/register` - Register a new user
- `POST /auth/refresh` - Refresh access token

### Tasks
- `GET /tasks` - List tasks with filtering and pagination
- `GET /tasks/:id` - Get task details
- `POST /tasks` - Create a task
- `PATCH /tasks/:id` - Update a task
- `DELETE /tasks/:id` - Delete a task
- `POST /tasks/batch` - Batch operations on tasks
