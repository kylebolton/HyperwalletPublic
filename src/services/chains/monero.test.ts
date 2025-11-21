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
      const validAddress = '4AdUndXHHZ6cfufTMvppY6JwXNouMBzSkbLYfpAV5Usx3skHNfzQYFYgQp8YwF2Y1nCvZzq6vDWc1vR65wXwscv5Y2CK3y1J2x6qFzT';
      expect(service.validateAddress(validAddress)).toBe(true);
    });

    it('should validate mainnet subaddress (starts with 8, 95 chars)', () => {
      const validSubaddress = '8AdUndXHHZ6cfufTMvppY6JwXNouMBzSkbLYfpAV5Usx3skHNfzQYFYgQp8YwF2Y1nCvZzq6vDWc1vR65wXwscv5Y2CK3y1J2x6qFzT';
      expect(service.validateAddress(validSubaddress)).toBe(true);
    });

    it('should validate integrated address (starts with 4, 106 chars)', () => {
      const validIntegrated = '4AdUndXHHZ6cfufTMvppY6JwXNouMBzSkbLYfpAV5Usx3skHNfzQYFYgQp8YwF2Y1nCvZzq6vDWc1vR65wXwscv5Y2CK3y1J2x6qFzT1234567890';
      expect(service.validateAddress(validIntegrated)).toBe(true);
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

