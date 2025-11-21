import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SOLChainService } from './sol';
import { PublicKey } from '@solana/web3.js';

// Mock ed25519-hd-key
vi.mock('ed25519-hd-key', () => ({
  default: {
    derivePath: vi.fn().mockReturnValue({
      key: Buffer.from('1'.repeat(64), 'hex'),
    }),
  },
}));

describe('SOLChainService - Address Validation', () => {
  const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  let service: SOLChainService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SOLChainService(testMnemonic);
  });

  describe('getAddress', () => {
    it('should return a valid Solana address', async () => {
      const address = await service.getAddress();
      expect(address).toBeDefined();
      expect(typeof address).toBe('string');
      expect(address.length).toBeGreaterThanOrEqual(32);
      expect(address.length).toBeLessThanOrEqual(44);
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
    it('should validate correct Solana address format', () => {
      // Valid Solana address (base58 encoded public key)
      const validAddress = '11111111111111111111111111111111';
      expect(service.validateAddress(validAddress)).toBe(true);
    });

    it('should validate longer Solana addresses', () => {
      // Typical Solana address length is 32-44 base58 characters
      const validAddress = 'So11111111111111111111111111111111111111112';
      expect(service.validateAddress(validAddress)).toBe(true);
    });

    it('should reject addresses shorter than 32 characters', () => {
      const shortAddress = '1111111111111111111111111111111'; // 31 chars
      expect(service.validateAddress(shortAddress)).toBe(false);
    });

    it('should reject addresses longer than 44 characters', () => {
      const longAddress = '1'.repeat(45);
      expect(service.validateAddress(longAddress)).toBe(false);
    });

    it('should reject invalid base58 characters', () => {
      // Base58 doesn't include 0, O, I, l
      const invalidAddress = '0OIl1111111111111111111111111111111111111';
      expect(service.validateAddress(invalidAddress)).toBe(false);
    });

    it('should reject empty addresses', () => {
      expect(service.validateAddress('')).toBe(false);
    });

    it('should validate generated address', async () => {
      const address = await service.getAddress();
      expect(service.validateAddress(address)).toBe(true);
    });
  });
});

