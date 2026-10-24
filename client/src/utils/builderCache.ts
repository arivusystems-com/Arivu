/**
 * ============================================================================
 * PLATFORM BUILDER CACHE: Memoization Utility
 * ============================================================================
 * 
 * Provides pure-function memoization for all platform builders.
 * 
 * Rules:
 * - Same inputs → same output object reference
 * - No global mutation
 * - Cache invalidates when permissions or registry change
 * - Deterministic and fast
 * 
 * ============================================================================
 */

import type { AppRegistry } from '@/types/sidebar.types';
import type { PermissionSnapshot } from '@/types/permission-snapshot.types';

/**
 * Cache key components for memoization
 */
interface CacheKey {
  /** Registry version/hash */
  registryHash: string;
  /** Permission snapshot hash */
  permissionHash: string;
  /** Optional app key */
  appKey?: string;
  /** Optional module key */
  moduleKey?: string;
  /** Builder function identifier */
  builderName: string;
}

/**
 * Generate a deterministic hash from an object
 */
function hashObject(obj: object): string {
  // Simple hash function for objects
  // In production, consider using a more robust hashing library
  const str = JSON.stringify(obj, Object.keys(obj).sort());
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Generate registry hash from app registry
 */
function generateRegistryHash(registry: AppRegistry): string {
  return hashObject(registry);
}

/**
 * Generate permission hash from permission snapshot
 */
function generatePermissionHash(snapshot: PermissionSnapshot): string {
  return hashObject({
    userId: snapshot.userId,
    roles: snapshot.roles.sort(),
    permissions: Object.keys(snapshot.permissions).sort().reduce((acc, key) => {
      acc[key] = snapshot.permissions[key] ?? false;
      return acc;
    }, {} as Record<string, boolean>),
  });
}

/**
 * Generate cache key from inputs
 */
function generateCacheKey(
  builderName: string,
  registry: AppRegistry,
  snapshot: PermissionSnapshot,
  appKey?: string,
  moduleKey?: string
): string {
  const registryHash = generateRegistryHash(registry);
  const permissionHash = generatePermissionHash(snapshot);
  
  const key: CacheKey = {
    registryHash,
    permissionHash,
    appKey,
    moduleKey,
    builderName,
  };
  
  return JSON.stringify(key);
}

/**
 * Cache entry
 */
interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
}

/**
 * Builder cache with LRU eviction
 */
class BuilderCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private maxSize: number = 100; // Maximum cache entries
  private ttl: number = 5 * 60 * 1000; // 5 minutes TTL

  /**
   * Get cached value
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Check TTL
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value as T;
  }

  /**
   * Set cached value
   */
  set<T>(key: string, value: T): void {
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    
    this.cache.set(key, {
      key,
      value,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Clear cache entries for a specific registry hash
   */
  clearByRegistryHash(registryHash: string): void {
    for (const [key, _entry] of this.cache.entries()) {
      const cacheKey: CacheKey = JSON.parse(key);
      if (cacheKey.registryHash === registryHash) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear cache entries for a specific permission hash
   */
  clearByPermissionHash(permissionHash: string): void {
    for (const [key, _entry] of this.cache.entries()) {
      const cacheKey: CacheKey = JSON.parse(key);
      if (cacheKey.permissionHash === permissionHash) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxSize: number; ttl: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttl: this.ttl,
    };
  }
}

// Singleton cache instance
const cache = new BuilderCache();

/**
 * Memoize a builder function
 * 
 * @param builderName - Unique identifier for the builder
 * @param registry - App registry
 * @param snapshot - Permission snapshot
 * @param appKey - Optional app key
 * @param moduleKey - Optional module key
 * @param builderFn - Builder function to memoize
 * @returns Cached or computed result
 */
export function memoizeBuilder<T>(
  builderName: string,
  registry: AppRegistry,
  snapshot: PermissionSnapshot,
  appKey: string | undefined,
  moduleKey: string | undefined,
  builderFn: () => T
): T {
  const cacheKey = generateCacheKey(builderName, registry, snapshot, appKey, moduleKey);
  
  // Check cache
  const cached = cache.get<T>(cacheKey);
  if (cached !== null) {
    return cached;
  }
  
  // Compute and cache
  const result = builderFn();
  cache.set(cacheKey, result);
  
  return result;
}

/**
 * Clear all cache entries
 */
export function clearBuilderCache(): void {
  cache.clear();
}

/**
 * Clear cache for a specific registry
 */
export function clearCacheByRegistry(registry: AppRegistry): void {
  const registryHash = generateRegistryHash(registry);
  cache.clearByRegistryHash(registryHash);
}

/**
 * Clear cache for a specific permission snapshot
 */
export function clearCacheByPermissions(snapshot: PermissionSnapshot): void {
  const permissionHash = generatePermissionHash(snapshot);
  cache.clearByPermissionHash(permissionHash);
}

/**
 * Get cache statistics (for debugging)
 */
export function getCacheStats() {
  return cache.getStats();
}

