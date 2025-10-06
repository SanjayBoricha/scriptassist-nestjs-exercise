import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { UsersModule } from './modules/users/users.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { AuthModule } from './modules/auth/auth.module';
import { TaskProcessorModule } from './queues/task-processor/task-processor.module';
import { ScheduledTasksModule } from './queues/scheduled-tasks/scheduled-tasks.module';
import { CacheService } from './common/services/cache.service';
import appConfig from '@config/app.config';
import databaseConfig from '@config/database.config';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { CacheModule } from '@nestjs/cache-manager';
import KeyvRedis, { Keyv } from '@keyv/redis';
import { CacheableMemory } from 'cacheable';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
    }),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule.forFeature(databaseConfig)],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('database.host'),
        port: configService.get('database.port'),
        username: configService.get('database.username'),
        password: configService.get('database.password'),
        database: configService.get('database.database'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: configService.get('app.environment') === 'development',
        logging: configService.get('app.environment') === 'development',
      }),
    }),

    // Scheduling
    ScheduleModule.forRoot(),

    // Queue
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get('REDIS_HOST'),
          port: configService.get('REDIS_PORT'),
        },
      }),
    }),

    // Rate limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [{ limit: 100, ttl: 60000 }],
        storage: new ThrottlerStorageRedisService({
          host: configService.get('REDIS_HOST'),
          port: configService.get('REDIS_PORT'),
        }),
      }),
    }),

    // Feature modules
    UsersModule,
    TasksModule,
    AuthModule,

    // Queue processing modules
    TaskProcessorModule,
    ScheduledTasksModule,

    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        return {
          stores: [
            new Keyv({
              store: new CacheableMemory({ ttl: 60000, lruSize: 5000 }),
            }),
            new KeyvRedis(
              `redis://${configService.get('REDIS_HOST')}:${configService.get('REDIS_PORT')}`,
            ),
          ],
        };
      },
    }),
  ],
  providers: [
    // Inefficient: Global cache service with no configuration options
    // This creates a single in-memory cache instance shared across all modules
    CacheService,
  ],
  exports: [
    // Exporting the cache service makes it available to other modules
    // but creates tight coupling
    CacheService,
  ],
})
export class AppModule {}
