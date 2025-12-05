import { STORAGE_KEYS } from './storage';

interface CachedBalance {
  balance: string;
  timestamp: number;
}

interface BalanceCache {
  [walletId: string]: {
    [chain: string]: CachedBalance;
  };
}

export class BalanceCacheService {
  private static readonly CACHE_KEY = STORAGE_KEYS.BALANCE_CACHE || 'hyperwallet_balance_cache';
  private static readonly CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Get cached balance for a wallet and chain
   */
  static getCachedBalance(walletId: string, chain: string): string | null {
    try {
      const cache = this.loadCache();
      const cached = cache[walletId]?.[chain];
      
      if (cached) {
        // Check if cache is still valid (not expired)
        const age = Date.now() - cached.timestamp;
        if (age < this.CACHE_EXPIRY_MS) {
          return cached.balance;
        }
        // Cache expired, remove it
        delete cache[walletId][chain];
        if (Object.keys(cache[walletId]).length === 0) {
          delete cache[walletId];
        }
        this.saveCache(cache);
      }
      
      return null;
    } catch (e) {
      console.error('[BalanceCache] Error getting cached balance:', e);
      return null;
    }
  }

  /**
   * Set cached balance for a wallet and chain
   */
  static setCachedBalance(walletId: string, chain: string, balance: string): void {
    try {
      const cache = this.loadCache();
      
      if (!cache[walletId]) {
        cache[walletId] = {};
      }
      
      cache[walletId][chain] = {
        balance,
        timestamp: Date.now(),
      };
      
      this.saveCache(cache);
    } catch (e) {
      console.error('[BalanceCache] Error setting cached balance:', e);
    }
  }

  /**
   * Get all cached balances for a wallet
   */
  static getAllCachedBalances(walletId: string): Record<string, string> {
    try {
      const cache = this.loadCache();
      const walletCache = cache[walletId];
      
      if (!walletCache) {
        return {};
      }
      
      const balances: Record<string, string> = {};
      const now = Date.now();
      
      for (const [chain, cached] of Object.entries(walletCache)) {
        // Only return non-expired balances
        const age = now - cached.timestamp;
        if (age < this.CACHE_EXPIRY_MS) {
          balances[chain] = cached.balance;
        }
      }
      
      return balances;
    } catch (e) {
      console.error('[BalanceCache] Error getting all cached balances:', e);
      return {};
    }
  }

  /**
   * Clear cached balance for a specific wallet and chain
   */
  static clearBalance(walletId: string, chain?: string): void {
    try {
      const cache = this.loadCache();
      
      if (!cache[walletId]) {
        return;
      }
      
      if (chain) {
        delete cache[walletId][chain];
      } else {
        // Clear all balances for this wallet
        delete cache[walletId];
      }
      
      // Clean up empty wallet entries
      if (chain && Object.keys(cache[walletId]).length === 0) {
        delete cache[walletId];
      }
      
      this.saveCache(cache);
    } catch (e) {
      console.error('[BalanceCache] Error clearing balance:', e);
    }
  }

  /**
   * Clear all cached balances for a wallet
   */
  static clearWallet(walletId: string): void {
    this.clearBalance(walletId);
  }

  private static loadCache(): BalanceCache {
    try {
      const stored = localStorage.getItem(this.CACHE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('[BalanceCache] Error loading cache:', e);
    }
    return {};
  }

  private static saveCache(cache: BalanceCache): void {
    try {
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(cache));
    } catch (e) {
      console.error('[BalanceCache] Error saving cache:', e);
    }
  }
}

