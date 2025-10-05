# TaskFlow API - Senior Backend Engineer Coding Challenge

## Analysis of the core problems

1. Nest can't resolve dependencies of the OverdueTasksModule
    - Nest requires exporting TypeOrmModule to use repository in other module
    - Fix: Export TypeOrmModule from TaskModule

2. JwtStrategy requires a secret or key
    - configs from src/config from is not loaded in AuthModule
    - Fix: import and load src/config in AppModule, AuthModule

3. Current tasks controller is not using AuthGuard and CurrentUser decorator
    - Protect tasks api using AuthGuard
    - Only allow user to view their tasks using CurrentUser decorator

4. Anti-pattern in controller
    - Move repository query to service instead of controllers
