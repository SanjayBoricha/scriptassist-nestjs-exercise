# TaskFlow API - Senior Backend Engineer Coding Challenge

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
