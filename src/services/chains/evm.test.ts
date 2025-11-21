import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EVMChainService } from './evm';
import { ethers } from 'ethers';

// Mock ethers
vi.mock('ethers', () => ({
  ethers: {
    Wallet: vi.fn().mockImplementation((key) => ({
      address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      sendTransaction: vi.fn(),
    })),
    HDNodeWallet: {
      fromPhrase: vi.fn().mockReturnValue({
        privateKey: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      }),
    },
    JsonRpcProvider: vi.fn().mockImplementation(() => ({
      getBalance: vi.fn().mockResolvedValue(ethers.parseEther('1.0')),
    })),
    Network: vi.fn(),
    getAddress: vi.fn((addr) => addr),
    parseEther: vi.fn((val) => BigInt(val) * BigInt(10 ** 18)),
    formatEther: vi.fn((val) => (Number(val) / 10 ** 18).toString()),
  },
}));

describe('EVMChainService - Address Validation', () => {
  const testPrivateKey = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  const testConfig = {
    name: 'Ethereum',
    symbol: 'ETH',
    rpcUrl: 'https://eth.llamarpc.com',
    chainId: 1,
  };
  let service: EVMChainService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new EVMChainService(testPrivateKey, testConfig, true);
  });

  describe('getAddress', () => {
    it('should return a valid address', async () => {
      const address = await service.getAddress();
      expect(address).toBeDefined();
      expect(typeof address).toBe('string');
      expect(address.startsWith('0x')).toBe(true);
      expect(address.length).toBe(42);
    });

    it('should validate address before returning', async () => {
      const address = await service.getAddress();
      expect(service.validateAddress(address)).toBe(true);
    });
  });

  describe('validateAddress', () => {
    it('should validate correct EVM address format', () => {
      const validAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
      (ethers.getAddress as any).mockReturnValueOnce(validAddress);
      expect(service.validateAddress(validAddress)).toBe(true);
    });

    it('should validate address with checksum', () => {
      const checksummedAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
      (ethers.getAddress as any).mockReturnValueOnce(checksummedAddress);
      expect(service.validateAddress(checksummedAddress)).toBe(true);
    });

    it('should reject invalid address format', () => {
      (ethers.getAddress as any).mockImplementationOnce(() => {
        throw new Error('Invalid address');
      });
      expect(service.validateAddress('invalid')).toBe(false);
    });

    it('should reject addresses that are not 42 characters', () => {
      expect(service.validateAddress('0x123')).toBe(false);
      expect(service.validateAddress('0x' + '1'.repeat(41))).toBe(false);
    });

    it('should reject addresses without 0x prefix', () => {
      const addressWithoutPrefix = '742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
      expect(service.validateAddress(addressWithoutPrefix)).toBe(false);
    });

    it('should reject non-hexadecimal characters', () => {
      const invalidHex = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bGz';
      (ethers.getAddress as any).mockImplementationOnce(() => {
        throw new Error('Invalid address');
      });
      expect(service.validateAddress(invalidHex)).toBe(false);
    });
  });
});

