import { STORAGE_KEYS } from './storage';

interface CachedAddress {
  address: string;
  derivationIndex: number;
  timestamp: number;
}

interface AddressCache {
  [walletId: string]: {
    [chain: string]: {
      [derivationIndex: string]: CachedAddress;
    };
  };
}

export class AddressCacheService {
  private static readonly CACHE_KEY = STORAGE_KEYS.ADDRESS_CACHE || 'hyperwallet_address_cache';
  private static readonly DEFAULT_DERIVATION_INDEX = 0;

  /**
   * Get cached address for a wallet, chain, and derivation index
   */
  static getCachedAddress(
    walletId: string,
    chain: string,
    derivationIndex: number = this.DEFAULT_DERIVATION_INDEX
  ): string | null {
    try {
      const cache = this.loadCache();
      const addressData = cache[walletId]?.[chain]?.[derivationIndex.toString()];
      
      if (addressData?.address) {
        return addressData.address;
      }
      
      return null;
    } catch (e) {
      console.error('[AddressCache] Error getting cached address:', e);
      return null;
    }
  }

  /**
   * Set cached address for a wallet, chain, and derivation index
   */
  static setCachedAddress(
    walletId: string,
    chain: string,
    address: string,
    derivationIndex: number = this.DEFAULT_DERIVATION_INDEX
  ): void {
    try {
      const cache = this.loadCache();
      
      if (!cache[walletId]) {
        cache[walletId] = {};
      }
      if (!cache[walletId][chain]) {
        cache[walletId][chain] = {};
      }
      
      cache[walletId][chain][derivationIndex.toString()] = {
        address,
        derivationIndex,
        timestamp: Date.now(),
      };
      
      this.saveCache(cache);
    } catch (e) {
      console.error('[AddressCache] Error setting cached address:', e);
    }
  }

  /**
   * Get all cached addresses for a wallet and chain
   */
  static getAllCachedAddresses(walletId: string, chain: string): CachedAddress[] {
    try {
      const cache = this.loadCache();
      const chainCache = cache[walletId]?.[chain];
      
      if (!chainCache) {
        return [];
      }
      
      return Object.values(chainCache);
    } catch (e) {
      console.error('[AddressCache] Error getting all cached addresses:', e);
      return [];
    }
  }

  /**
   * Get the next available derivation index for a wallet and chain
   */
  static getNextDerivationIndex(walletId: string, chain: string): number {
    try {
      const addresses = this.getAllCachedAddresses(walletId, chain);
      if (addresses.length === 0) {
        return this.DEFAULT_DERIVATION_INDEX;
      }
      
      const maxIndex = Math.max(...addresses.map(a => a.derivationIndex));
      return maxIndex + 1;
    } catch (e) {
      console.error('[AddressCache] Error getting next derivation index:', e);
      return this.DEFAULT_DERIVATION_INDEX;
    }
  }

  /**
   * Clear cached address for a specific wallet, chain, and derivation index
   */
  static clearAddress(
    walletId: string,
    chain: string,
    derivationIndex?: number
  ): void {
    try {
      const cache = this.loadCache();
      
      if (!cache[walletId]?.[chain]) {
        return;
      }
      
      if (derivationIndex !== undefined) {
        delete cache[walletId][chain][derivationIndex.toString()];
      } else {
        // Clear all addresses for this chain
        delete cache[walletId][chain];
      }
      
      // Clean up empty wallet entries
      if (Object.keys(cache[walletId]).length === 0) {
        delete cache[walletId];
      }
      
      this.saveCache(cache);
    } catch (e) {
      console.error('[AddressCache] Error clearing address:', e);
    }
  }

  /**
   * Clear all cached addresses for a wallet
   */
  static clearWallet(walletId: string): void {
    try {
      const cache = this.loadCache();
      delete cache[walletId];
      this.saveCache(cache);
    } catch (e) {
      console.error('[AddressCache] Error clearing wallet:', e);
    }
  }

  /**
   * Get all cached addresses for a wallet (all chains)
   */
  static getAllAddressesForWallet(walletId: string): Record<string, CachedAddress[]> {
    try {
      const cache = this.loadCache();
      const walletCache = cache[walletId];
      
      if (!walletCache) {
        return {};
      }
      
      const result: Record<string, CachedAddress[]> = {};
      for (const [chain, chainAddresses] of Object.entries(walletCache)) {
        result[chain] = Object.values(chainAddresses);
      }
      
      return result;
    } catch (e) {
      console.error('[AddressCache] Error getting all addresses for wallet:', e);
      return {};
    }
  }

  private static loadCache(): AddressCache {
    try {
      const stored = localStorage.getItem(this.CACHE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('[AddressCache] Error loading cache:', e);
    }
    return {};
  }

  private static saveCache(cache: AddressCache): void {
    try {
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(cache));
    } catch (e) {
      console.error('[AddressCache] Error saving cache:', e);
    }
  }
}

