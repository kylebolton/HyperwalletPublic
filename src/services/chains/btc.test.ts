import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BTCChainService } from './btc';

// Mock fetch globally
global.fetch = vi.fn();

describe('BTCChainService - Address Validation', () => {
  const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  let service: BTCChainService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new BTCChainService(testMnemonic);
  });

  describe('getAddress', () => {
    it('should return a valid address', async () => {
      const address = await service.getAddress();
      expect(address).toBeDefined();
      expect(typeof address).toBe('string');
      expect(address.length).toBeGreaterThan(0);
    });

    it('should return the same address on multiple calls', async () => {
      const address1 = await service.getAddress();
      const address2 = await service.getAddress();
      expect(address1).toBe(address2);
    });

    it('should validate address before returning', async () => {
      const address = await service.getAddress();
      expect(service.validateAddress(address)).toBe(true);
    });
  });

  describe('validateAddress', () => {
    it('should validate mainnet bech32 addresses (bc1)', () => {
      // Valid mainnet bech32 address (P2WPKH)
      const validBech32 = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
      expect(service.validateAddress(validBech32)).toBe(true);
    });

    it('should validate testnet bech32 addresses (tb1)', () => {
      const testnetService = new BTCChainService(testMnemonic, 'testnet');
      const validTestnetBech32 = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';
      expect(testnetService.validateAddress(validTestnetBech32)).toBe(true);
    });

    it('should validate mainnet legacy P2PKH addresses', () => {
      // Valid mainnet P2PKH address (version 0)
      const validP2PKH = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa';
      expect(service.validateAddress(validP2PKH)).toBe(true);
    });

    it('should validate mainnet P2SH addresses', () => {
      // Valid mainnet P2SH address (version 5)
      const validP2SH = '3J98t1WpEZ45CNUQnn7WpgaDR8K3F8Zk';
      expect(service.validateAddress(validP2SH)).toBe(true);
    });

    it('should reject invalid address formats', () => {
      expect(service.validateAddress('invalid')).toBe(false);
      expect(service.validateAddress('')).toBe(false);
      expect(service.validateAddress('0x1234567890abcdef')).toBe(false);
    });

    it('should reject testnet address on mainnet', () => {
      const testnetAddress = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';
      expect(service.validateAddress(testnetAddress)).toBe(false);
    });

    it('should reject mainnet address on testnet', () => {
      const testnetService = new BTCChainService(testMnemonic, 'testnet');
      const mainnetAddress = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
      expect(testnetService.validateAddress(mainnetAddress)).toBe(false);
    });
  });
});

