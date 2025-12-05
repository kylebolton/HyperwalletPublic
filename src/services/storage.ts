export const STORAGE_KEYS = {
  MNEMONIC: 'hyperwallet_mnemonic',
  PRIVATE_KEY: 'hyperwallet_privkey',
  NETWORKS: 'hyperwallet_networks',
  SETTINGS: 'hyperwallet_settings',
  WALLETS: 'hyperwallet_wallets',
  ACTIVE_WALLET_ID: 'hyperwallet_active_wallet_id',
  ADDRESS_CACHE: 'hyperwallet_address_cache',
  BALANCE_CACHE: 'hyperwallet_balance_cache'
};

export interface Wallet {
  id: string;
  name: string;
  mnemonic: string | null;
  privateKey: string | null;
  createdAt: number;
}

interface WalletStorage {
  wallets: Wallet[];
  activeWalletId: string | null;
}

export class StorageService {
  // Legacy methods for backward compatibility
  static saveMnemonic(mnemonic: string): void {
    // In a real app, encrypt this! For now, we use localStorage for prototype speed.
    // ideally use keytar via IPC
    localStorage.setItem(STORAGE_KEYS.MNEMONIC, mnemonic);
  }

  static getMnemonic(): string | null {
    return localStorage.getItem(STORAGE_KEYS.MNEMONIC);
  }

  static clearMnemonic(): void {
    localStorage.removeItem(STORAGE_KEYS.MNEMONIC);
  }
  
  static save(key: string, value: any) {
      localStorage.setItem(key, JSON.stringify(value));
  }
  
  static get(key: string) {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : null;
  }

  // Multi-wallet methods
  private static ensureWalletStorage(): WalletStorage {
    const stored = localStorage.getItem(STORAGE_KEYS.WALLETS);
    if (stored) {
      return JSON.parse(stored);
    }
    
    // Migration: Convert single wallet to multi-wallet structure
    const legacyMnemonic = localStorage.getItem(STORAGE_KEYS.MNEMONIC);
    const legacyPrivateKey = localStorage.getItem(STORAGE_KEYS.PRIVATE_KEY);
    
    if (legacyMnemonic || legacyPrivateKey) {
      const wallet: Wallet = {
        id: `wallet-${Date.now()}`,
        name: 'My Wallet',
        mnemonic: legacyMnemonic,
        privateKey: legacyPrivateKey,
        createdAt: Date.now()
      };
      
      const storage: WalletStorage = {
        wallets: [wallet],
        activeWalletId: wallet.id
      };
      
      localStorage.setItem(STORAGE_KEYS.WALLETS, JSON.stringify(storage));
      localStorage.setItem(STORAGE_KEYS.ACTIVE_WALLET_ID, wallet.id);
      
      // Optionally clear legacy keys after migration (commented for safety)
      // localStorage.removeItem(STORAGE_KEYS.MNEMONIC);
      // localStorage.removeItem(STORAGE_KEYS.PRIVATE_KEY);
      
      return storage;
    }
    
    // No existing wallet
    return {
      wallets: [],
      activeWalletId: null
    };
  }

  private static saveWalletStorage(storage: WalletStorage): void {
    localStorage.setItem(STORAGE_KEYS.WALLETS, JSON.stringify(storage));
  }

  static saveWallet(wallet: Wallet): void {
    const storage = this.ensureWalletStorage();
    const existingIndex = storage.wallets.findIndex(w => w.id === wallet.id);
    
    if (existingIndex >= 0) {
      storage.wallets[existingIndex] = wallet;
    } else {
      storage.wallets.push(wallet);
    }
    
    this.saveWalletStorage(storage);
  }

  static getWallet(walletId: string): Wallet | null {
    const storage = this.ensureWalletStorage();
    return storage.wallets.find(w => w.id === walletId) || null;
  }

  static getAllWallets(): Wallet[] {
    const storage = this.ensureWalletStorage();
    return [...storage.wallets];
  }

  static deleteWallet(walletId: string): boolean {
    const storage = this.ensureWalletStorage();
    
    // Prevent deleting last wallet
    if (storage.wallets.length <= 1) {
      return false;
    }
    
    const index = storage.wallets.findIndex(w => w.id === walletId);
    if (index < 0) {
      return false;
    }
    
    storage.wallets.splice(index, 1);
    
    // If deleted wallet was active, switch to first remaining wallet
    if (storage.activeWalletId === walletId) {
      storage.activeWalletId = storage.wallets.length > 0 ? storage.wallets[0].id : null;
      if (storage.activeWalletId) {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_WALLET_ID, storage.activeWalletId);
      }
    }
    
    this.saveWalletStorage(storage);
    return true;
  }

  static setActiveWallet(walletId: string): boolean {
    const storage = this.ensureWalletStorage();
    const walletExists = storage.wallets.some(w => w.id === walletId);
    
    if (!walletExists) {
      return false;
    }
    
    storage.activeWalletId = walletId;
    localStorage.setItem(STORAGE_KEYS.ACTIVE_WALLET_ID, walletId);
    this.saveWalletStorage(storage);
    return true;
  }

  static getActiveWallet(): Wallet | null {
    const storage = this.ensureWalletStorage();
    
    if (!storage.activeWalletId) {
      // If no active wallet but wallets exist, set first as active
      if (storage.wallets.length > 0) {
        const firstWallet = storage.wallets[0];
        this.setActiveWallet(firstWallet.id);
        return firstWallet;
      }
      return null;
    }
    
    const activeWallet = storage.wallets.find(w => w.id === storage.activeWalletId);
    
    // If active wallet ID doesn't exist, reset to first wallet
    if (!activeWallet && storage.wallets.length > 0) {
      const firstWallet = storage.wallets[0];
      this.setActiveWallet(firstWallet.id);
      return firstWallet;
    }
    
    return activeWallet || null;
  }

  static hasWallets(): boolean {
    const storage = this.ensureWalletStorage();
    return storage.wallets.length > 0;
  }
}


