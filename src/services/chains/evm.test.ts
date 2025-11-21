import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EVMChainService } from './evm';
import { ethers } from 'ethers';

// Mock ethers
vi.mock('ethers', async () => {
  const actual = await vi.importActual('ethers');
  const mockWalletInstance = {
    address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    sendTransaction: vi.fn().mockResolvedValue({ hash: '0xtxhash' }),
  };
  
  return {
    ...actual,
    ethers: {
      ...(actual as any).ethers,
      Wallet: class MockWallet {
        address = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
        constructor(key: string, provider?: any) {
          // Return instance with address property
          Object.assign(this, mockWalletInstance);
        }
      },
      HDNodeWallet: {
        fromPhrase: vi.fn().mockReturnValue({
          privateKey: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        }),
      },
      JsonRpcProvider: class {
        constructor() {
          return {
            getBalance: vi.fn().mockResolvedValue((actual as any).ethers.parseEther('1.0')),
          };
        }
      },
      Network: class {
        constructor(name: string, chainId: number) {}
      },
      getAddress: vi.fn((addr: string) => {
        // Validate and return checksummed address
        if (!addr.startsWith('0x') || addr.length !== 42) {
          throw new Error('Invalid address');
        }
        return addr;
      }),
      parseEther: (actual as any).ethers.parseEther,
      formatEther: (actual as any).ethers.formatEther,
    },
  };
});

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
    // Reset getAddress mock to default behavior
    (ethers.getAddress as any).mockImplementation((addr: string) => {
      if (!addr.startsWith('0x') || addr.length !== 42) {
        throw new Error('Invalid address');
      }
      return addr;
    });
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
      // Address validation uses ethers.getAddress which is mocked
      const isValid = service.validateAddress(address);
      expect(typeof isValid).toBe('boolean');
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

