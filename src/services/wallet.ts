import * as bip39 from 'bip39';
import { StorageService, type Wallet } from './storage';
import { ethers } from 'ethers';

export class WalletService {
  static generateMnemonic(): string {
    return bip39.generateMnemonic(256); // 24 words
  }

  static validateMnemonic(mnemonic: string): boolean {
    return bip39.validateMnemonic(mnemonic);
  }

  static validatePrivateKey(key: string): boolean {
      try {
          // Simple EVM check for now - 64 hex chars
          // Or try to load it
          if (!key.startsWith('0x')) key = '0x' + key;
          new ethers.Wallet(key);
          return true;
      } catch (e) {
          return false;
      }
  }

  static validateWalletName(name: string): boolean {
    if (!name || typeof name !== 'string') return false;
    const trimmed = name.trim();
    if (trimmed.length === 0 || trimmed.length > 50) return false;
    // Prevent special characters that could cause issues
    if (/[<>:"/\\|?*]/.test(trimmed)) return false;
    return true;
  }
  
  // Legacy methods for backward compatibility
  static getStoredMnemonic(): string | null {
      const activeWallet = StorageService.getActiveWallet();
      return activeWallet?.mnemonic || null;
  }

  static getStoredPrivateKey(): string | null {
      const activeWallet = StorageService.getActiveWallet();
      return activeWallet?.privateKey || null;
  }
  
  // Legacy createWallet - now creates and sets as active
  static async createWallet(): Promise<string> {
      const mnemonic = this.generateMnemonic();
      const wallet = await this.createNewWallet('My Wallet', mnemonic);
      return mnemonic;
  }

  // Multi-wallet methods
  static async createNewWallet(name: string, mnemonic?: string): Promise<Wallet> {
    if (!this.validateWalletName(name)) {
      throw new Error('Invalid wallet name. Must be 1-50 characters and contain no special characters.');
    }

    const walletMnemonic = mnemonic || this.generateMnemonic();
    let derivedPrivateKey: string | null = null;

    // Automatically derive EVM private key from mnemonic for EVM chains
    try {
      const hdNode = ethers.HDNodeWallet.fromPhrase(walletMnemonic, undefined, "m/44'/60'/0'/0/0");
      derivedPrivateKey = hdNode.privateKey;
    } catch (e) {
      console.error("Failed to derive EVM private key from mnemonic:", e);
    }

    const wallet: Wallet = {
      id: `wallet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: name.trim(),
      mnemonic: walletMnemonic,
      privateKey: derivedPrivateKey,
      createdAt: Date.now()
    };

    StorageService.saveWallet(wallet);
    StorageService.setActiveWallet(wallet.id);

    return wallet;
  }

  static async importNewWallet(name: string, input: string, isPrivateKey: boolean = false): Promise<Wallet> {
    if (!this.validateWalletName(name)) {
      throw new Error('Invalid wallet name. Must be 1-50 characters and contain no special characters.');
    }

    let walletMnemonic: string | null = null;
    let walletPrivateKey: string | null = null;

    if (isPrivateKey) {
      // Importing private key - automatically generate mnemonic for non-EVM chains
      let pk = input.trim();
      if (!pk.startsWith('0x')) pk = '0x' + pk;
      
      if (!this.validatePrivateKey(pk)) {
        throw new Error('Invalid private key format');
      }
      
      walletPrivateKey = pk;
      
      // Automatically generate a mnemonic for non-EVM chains (BTC, SOL, XMR, ZEC)
      walletMnemonic = this.generateMnemonic();
    } else {
      // Importing mnemonic - automatically derive EVM private key for EVM chains
      if (!this.validateMnemonic(input)) {
        throw new Error('Invalid mnemonic phrase');
      }
      
      walletMnemonic = input;
      
      // Automatically derive EVM private key from mnemonic for EVM chains
      try {
        const hdNode = ethers.HDNodeWallet.fromPhrase(input, undefined, "m/44'/60'/0'/0/0");
        walletPrivateKey = hdNode.privateKey;
      } catch (e) {
        console.error("Failed to derive EVM private key from mnemonic:", e);
      }
    }

    const wallet: Wallet = {
      id: `wallet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: name.trim(),
      mnemonic: walletMnemonic,
      privateKey: walletPrivateKey,
      createdAt: Date.now()
    };

    StorageService.saveWallet(wallet);
    StorageService.setActiveWallet(wallet.id);

    return wallet;
  }
  
  static switchWallet(walletId: string): boolean {
    return StorageService.setActiveWallet(walletId);
  }

  static deleteWallet(walletId: string): boolean {
    return StorageService.deleteWallet(walletId);
  }

  static renameWallet(walletId: string, newName: string): boolean {
    if (!this.validateWalletName(newName)) {
      return false;
    }

    const wallet = StorageService.getWallet(walletId);
    if (!wallet) {
      return false;
    }

    wallet.name = newName.trim();
    StorageService.saveWallet(wallet);
    return true;
  }

  static getAllWallets(): Wallet[] {
    return StorageService.getAllWallets();
  }

  static getActiveWallet(): Wallet | null {
    return StorageService.getActiveWallet();
  }

  static getWallet(walletId: string): Wallet | null {
    return StorageService.getWallet(walletId);
  }

  static hasWallets(): boolean {
    return StorageService.hasWallets();
  }
  
  // Legacy import methods - now work with active wallet
  static async importWallet(input: string, isPrivateKey: boolean = false): Promise<boolean> {
      try {
        const name = isPrivateKey ? 'Imported Wallet (PK)' : 'Imported Wallet';
        await this.importNewWallet(name, input, isPrivateKey);
        return true;
      } catch (e) {
        console.error('Failed to import wallet:', e);
        return false;
      }
  }
  
  static async importPrivateKey(privateKey: string): Promise<boolean> {
      return this.importWallet(privateKey, true);
  }
  
  static async importMnemonic(mnemonic: string): Promise<boolean> {
      return this.importWallet(mnemonic, false);
  }
}
