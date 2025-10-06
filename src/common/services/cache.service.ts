import { Injectable, Inject, Logger, BadRequestException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly prefix = 'app-cache:'; // Namespacing to prevent key collisions

  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  async set(key: string, value: any, ttlSeconds = 300): Promise<void> {
    if (!key || typeof key !== 'string') {
      throw new BadRequestException('Invalid cache key');
    }
    if (value === undefined) {
      throw new BadRequestException('Cache value cannot be undefined');
    }

    const prefixedKey = this.prefix + key;
    try {
      // Cache-manager handles serialization for Redis
      await this.cacheManager.set(prefixedKey, value, ttlSeconds);
      this.logger.log(`Cache set for key: ${prefixedKey} with TTL: ${ttlSeconds}s`);
    } catch (error: any) {
      this.logger.error(`Error setting cache for key: ${prefixedKey}`, error.stack);
      throw error;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!key || typeof key !== 'string') {
      throw new BadRequestException('Invalid cache key');
    }

    const prefixedKey = this.prefix + key;
    try {
      const value = await this.cacheManager.get<T>(prefixedKey);
      if (value !== undefined) {
        this.logger.log(`Cache hit for key: ${prefixedKey}`);
        // For in-memory, consider deep cloning if needed; Redis deserializes automatically
        return value;
      } else {
        this.logger.log(`Cache miss for key: ${prefixedKey}`);
        return null;
      }
    } catch (error: any) {
      this.logger.error(`Error getting cache for key: ${prefixedKey}`, error.stack);
      throw error;
    }
  }

  async delete(key: string): Promise<boolean> {
    if (!key || typeof key !== 'string') {
      throw new BadRequestException('Invalid cache key');
    }

    const prefixedKey = this.prefix + key;
    try {
      await this.cacheManager.del(prefixedKey);
      this.logger.log(`Cache deleted for key: ${prefixedKey}`);
      return true; // Assume success; cache-manager doesn't return existence
    } catch (error: any) {
      this.logger.error(`Error deleting cache for key: ${prefixedKey}`, error.stack);
      return false;
    }
  }

  async clear(): Promise<void> {
    try {
      await this.cacheManager.clear();
      this.logger.log('Entire cache cleared');
    } catch (error: any) {
      this.logger.error('Error clearing cache', error.stack);
      throw error;
    }
  }

  async has(key: string): Promise<boolean> {
    if (!key || typeof key !== 'string') {
      throw new BadRequestException('Invalid cache key');
    }

    const value = await this.get(key);
    return value !== null;
  }
}
