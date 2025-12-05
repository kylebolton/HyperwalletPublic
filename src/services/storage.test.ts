import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StorageService, type Wallet } from './storage';

describe('StorageService - Multi-Wallet', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('Migration from single wallet', () => {
    it('should migrate legacy mnemonic to multi-wallet structure', () => {
      localStorage.setItem('hyperwallet_mnemonic', 'test mnemonic phrase');
      
      // Migration happens when accessing wallets
      const wallets = StorageService.getAllWallets();
      const active = StorageService.getActiveWallet();
      
      expect(wallets).toHaveLength(1);
      expect(wallets[0].mnemonic).toBe('test mnemonic phrase');
      expect(wallets[0].name).toBe('My Wallet');
      expect(active?.id).toBe(wallets[0].id);
    });

    it('should migrate legacy private key to multi-wallet structure', () => {
      localStorage.setItem('hyperwallet_privkey', '0x1234567890abcdef');
      
      const wallets = StorageService.getAllWallets();
      const active = StorageService.getActiveWallet();
      
      expect(wallets).toHaveLength(1);
      expect(wallets[0].privateKey).toBe('0x1234567890abcdef');
      expect(wallets[0].name).toBe('My Wallet');
      expect(active?.id).toBe(wallets[0].id);
    });

    it('should migrate both mnemonic and private key', () => {
      localStorage.setItem('hyperwallet_mnemonic', 'test mnemonic');
      localStorage.setItem('hyperwallet_privkey', '0x1234567890abcdef');
      
      const wallets = StorageService.getAllWallets();
      
      expect(wallets).toHaveLength(1);
      expect(wallets[0].mnemonic).toBe('test mnemonic');
      expect(wallets[0].privateKey).toBe('0x1234567890abcdef');
    });

    it('should return empty storage if no legacy wallet exists', () => {
      const wallets = StorageService.getAllWallets();
      const active = StorageService.getActiveWallet();
      
      expect(wallets).toHaveLength(0);
      expect(active).toBeNull();
    });
  });

  describe('Wallet CRUD operations', () => {
    it('should save a new wallet', () => {
      const wallet: Wallet = {
        id: 'wallet-1',
        name: 'Test Wallet',
        mnemonic: 'test mnemonic',
        privateKey: '0x123',
        createdAt: Date.now()
      };

      StorageService.saveWallet(wallet);
      const retrieved = StorageService.getWallet('wallet-1');
      
      expect(retrieved).toEqual(wallet);
    });

    it('should update existing wallet', () => {
      const wallet: Wallet = {
        id: 'wallet-1',
        name: 'Test Wallet',
        mnemonic: 'test mnemonic',
        privateKey: '0x123',
        createdAt: Date.now()
      };

      StorageService.saveWallet(wallet);
      
      const updated: Wallet = {
        ...wallet,
        name: 'Updated Wallet'
      };
      
      StorageService.saveWallet(updated);
      const retrieved = StorageService.getWallet('wallet-1');
      
      expect(retrieved?.name).toBe('Updated Wallet');
    });

    it('should get all wallets', () => {
      const wallet1: Wallet = {
        id: 'wallet-1',
        name: 'Wallet 1',
        mnemonic: 'mnemonic 1',
        privateKey: null,
        createdAt: Date.now()
      };

      const wallet2: Wallet = {
        id: 'wallet-2',
        name: 'Wallet 2',
        mnemonic: 'mnemonic 2',
        privateKey: null,
        createdAt: Date.now()
      };

      StorageService.saveWallet(wallet1);
      StorageService.saveWallet(wallet2);
      
      const allWallets = StorageService.getAllWallets();
      
      expect(allWallets).toHaveLength(2);
      expect(allWallets.map(w => w.id)).toContain('wallet-1');
      expect(allWallets.map(w => w.id)).toContain('wallet-2');
    });

    it('should delete a wallet', () => {
      const wallet1: Wallet = {
        id: 'wallet-1',
        name: 'Wallet 1',
        mnemonic: 'mnemonic 1',
        privateKey: null,
        createdAt: Date.now()
      };

      const wallet2: Wallet = {
        id: 'wallet-2',
        name: 'Wallet 2',
        mnemonic: 'mnemonic 2',
        privateKey: null,
        createdAt: Date.now()
      };

      StorageService.saveWallet(wallet1);
      StorageService.saveWallet(wallet2);
      StorageService.setActiveWallet('wallet-1');
      
      const deleted = StorageService.deleteWallet('wallet-1');
      
      expect(deleted).toBe(true);
      expect(StorageService.getWallet('wallet-1')).toBeNull();
      expect(StorageService.getAllWallets()).toHaveLength(1);
      // Should switch to remaining wallet
      expect(StorageService.getActiveWallet()?.id).toBe('wallet-2');
    });

    it('should prevent deleting last wallet', () => {
      const wallet: Wallet = {
        id: 'wallet-1',
        name: 'Wallet 1',
        mnemonic: 'mnemonic 1',
        privateKey: null,
        createdAt: Date.now()
      };

      StorageService.saveWallet(wallet);
      
      const deleted = StorageService.deleteWallet('wallet-1');
      
      expect(deleted).toBe(false);
      expect(StorageService.getWallet('wallet-1')).not.toBeNull();
    });

    it('should return false when deleting non-existent wallet', () => {
      const deleted = StorageService.deleteWallet('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('Active wallet management', () => {
    it('should set active wallet', () => {
      const wallet: Wallet = {
        id: 'wallet-1',
        name: 'Wallet 1',
        mnemonic: 'mnemonic 1',
        privateKey: null,
        createdAt: Date.now()
      };

      StorageService.saveWallet(wallet);
      const set = StorageService.setActiveWallet('wallet-1');
      
      expect(set).toBe(true);
      expect(StorageService.getActiveWallet()?.id).toBe('wallet-1');
    });

    it('should return false when setting non-existent wallet as active', () => {
      const set = StorageService.setActiveWallet('non-existent');
      expect(set).toBe(false);
    });

    it('should get active wallet', () => {
      const wallet: Wallet = {
        id: 'wallet-1',
        name: 'Wallet 1',
        mnemonic: 'mnemonic 1',
        privateKey: null,
        createdAt: Date.now()
      };

      StorageService.saveWallet(wallet);
      StorageService.setActiveWallet('wallet-1');
      
      const active = StorageService.getActiveWallet();
      
      expect(active).not.toBeNull();
      expect(active?.id).toBe('wallet-1');
    });

    it('should return null when no wallets exist', () => {
      const active = StorageService.getActiveWallet();
      expect(active).toBeNull();
    });

    it('should auto-set first wallet as active if none is set', () => {
      const wallet1: Wallet = {
        id: 'wallet-1',
        name: 'Wallet 1',
        mnemonic: 'mnemonic 1',
        privateKey: null,
        createdAt: Date.now()
      };

      const wallet2: Wallet = {
        id: 'wallet-2',
        name: 'Wallet 2',
        mnemonic: 'mnemonic 2',
        privateKey: null,
        createdAt: Date.now()
      };

      StorageService.saveWallet(wallet1);
      StorageService.saveWallet(wallet2);
      // Don't set active wallet
      
      const active = StorageService.getActiveWallet();
      
      expect(active).not.toBeNull();
      expect(active?.id).toBe('wallet-1');
    });

    it('should switch active wallet when deleting active wallet', () => {
      const wallet1: Wallet = {
        id: 'wallet-1',
        name: 'Wallet 1',
        mnemonic: 'mnemonic 1',
        privateKey: null,
        createdAt: Date.now()
      };

      const wallet2: Wallet = {
        id: 'wallet-2',
        name: 'Wallet 2',
        mnemonic: 'mnemonic 2',
        privateKey: null,
        createdAt: Date.now()
      };

      StorageService.saveWallet(wallet1);
      StorageService.saveWallet(wallet2);
      StorageService.setActiveWallet('wallet-1');
      
      StorageService.deleteWallet('wallet-1');
      
      const active = StorageService.getActiveWallet();
      expect(active?.id).toBe('wallet-2');
    });
  });

  describe('hasWallets', () => {
    it('should return false when no wallets exist', () => {
      expect(StorageService.hasWallets()).toBe(false);
    });

    it('should return true when wallets exist', () => {
      const wallet: Wallet = {
        id: 'wallet-1',
        name: 'Wallet 1',
        mnemonic: 'mnemonic 1',
        privateKey: null,
        createdAt: Date.now()
      };

      StorageService.saveWallet(wallet);
      expect(StorageService.hasWallets()).toBe(true);
    });
  });
});

