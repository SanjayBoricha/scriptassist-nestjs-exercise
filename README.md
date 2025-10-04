# TaskFlow API - Senior Backend Engineer Coding Challenge

1. Analysis of the core problems

- Nest can't resolve dependencies of the OverdueTasksModule
    - Nest requires exporting TypeOrmModule to use repository in other module
    - Fix: Export TypeOrmModule from TaskModule

- JwtStrategy requires a secret or key
    - configs from src/config from is not loaded in AuthModule
    - Fix: import and load src/config in AppModule, AuthModule
