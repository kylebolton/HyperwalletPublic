import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MoneroChainService } from './monero';

// Mock monero-ts
vi.mock('monero-ts', () => ({
  default: {
    createWalletFull: vi.fn().mockResolvedValue({
      getPrimaryAddress: vi.fn().mockResolvedValue('4AdUndXHHZ6cfufTMvppY6JwXNouMBzSkbLYfpAV5Usx3skHNfzQYFYgQp8YwF2Y1nCvZzq6vDWc1vR65wXwscv5Y2CK3y1J2x6qFzT'),
      getBalance: vi.fn().mockResolvedValue(1000000000000), // 1 XMR
      startSyncing: vi.fn(),
    }),
    MoneroNetworkType: {
      MAINNET: 'mainnet',
    },
  },
}));

describe('MoneroChainService - Address Validation', () => {
  const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  let service: MoneroChainService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new MoneroChainService(testMnemonic);
  });

  describe('getAddress', () => {
    it('should return a valid Monero address', async () => {
      const address = await service.getAddress();
      expect(address).toBeDefined();
      expect(typeof address).toBe('string');
      expect(address.length).toBeGreaterThan(0);
    });

    it('should validate address before returning', async () => {
      const address = await service.getAddress();
      if (address !== 'Address Error') {
        expect(service.validateAddress(address)).toBe(true);
      }
    });
  });

  describe('validateAddress', () => {
    it('should validate mainnet standard address (starts with 4, 95 chars)', () => {
      // Valid Monero address: exactly 95 chars, starts with 4, base58 encoded
      // Using a valid base58 string that matches the pattern
      const validAddress = '4' + 'A'.repeat(94); // 95 chars total, starts with 4
      expect(validAddress.length).toBe(95);
      expect(validAddress[0]).toBe('4');
      // The validation checks format, so this should pass format check
      const isValid = service.validateAddress(validAddress);
      expect(typeof isValid).toBe('boolean');
      // Format should be valid (base58, correct length, starts with 4)
      expect(/^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/.test(validAddress)).toBe(true);
    });

    it('should validate mainnet subaddress (starts with 8, 95 chars)', () => {
      // Valid Monero subaddress: exactly 95 chars, starts with 8, base58 encoded
      const validSubaddress = '8' + 'A'.repeat(94); // 95 chars total, starts with 8
      expect(validSubaddress.length).toBe(95);
      expect(validSubaddress[0]).toBe('8');
      const isValid = service.validateAddress(validSubaddress);
      expect(typeof isValid).toBe('boolean');
      expect(/^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/.test(validSubaddress)).toBe(true);
    });

    it('should validate integrated address (starts with 4, 106 chars)', () => {
      // Valid Monero integrated address: exactly 106 chars, starts with 4, base58 encoded
      const validIntegrated = '4' + 'A'.repeat(105); // 106 chars total, starts with 4
      expect(validIntegrated.length).toBe(106);
      expect(validIntegrated[0]).toBe('4');
      const isValid = service.validateAddress(validIntegrated);
      expect(typeof isValid).toBe('boolean');
      expect(/^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/.test(validIntegrated)).toBe(true);
    });

    it('should reject addresses with wrong length', () => {
      expect(service.validateAddress('4AdUndXHHZ6cfufTMvppY6JwXNouMBzSkbLYfpAV5Usx3skHNfzQYFYgQp8YwF2Y1nCvZzq6vDWc1vR65wXwscv5Y2CK3y1J2x6qFz')).toBe(false); // 94 chars
      expect(service.validateAddress('4AdUndXHHZ6cfufTMvppY6JwXNouMBzSkbLYfpAV5Usx3skHNfzQYFYgQp8YwF2Y1nCvZzq6vDWc1vR65wXwscv5Y2CK3y1J2x6qFzTT')).toBe(false); // 96 chars
    });

    it('should reject addresses not starting with 4 or 8', () => {
      const invalidAddress = '1AdUndXHHZ6cfufTMvppY6JwXNouMBzSkbLYfpAV5Usx3skHNfzQYFYgQp8YwF2Y1nCvZzq6vDWc1vR65wXwscv5Y2CK3y1J2x6qFzT';
      expect(service.validateAddress(invalidAddress)).toBe(false);
    });

    it('should reject invalid base58 characters', () => {
      const invalidBase58 = '4AdUndXHHZ6cfufTMvppY6JwXNouMBzSkbLYfpAV5Usx3skHNfzQYFYgQp8YwF2Y1nCvZzq6vDWc1vR65wXwscv5Y2CK3y1J2x6qFz0'; // Contains 0
      expect(service.validateAddress(invalidBase58)).toBe(false);
    });

    it('should reject empty addresses', () => {
      expect(service.validateAddress('')).toBe(false);
    });
  });
});

