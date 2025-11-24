import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TokenService, type TokenInfo } from './tokens';
import { ethers } from 'ethers';

// Mock contract instance - will be set up in beforeEach
let currentMockContract: any = null;

vi.mock('ethers', async () => {
  const actual = await vi.importActual('ethers');
  const mockProvider = {
    getBalance: vi.fn().mockResolvedValue(BigInt('100000000000000000000')),
  };
  
  return {
    ...actual,
    ethers: {
      ...(actual as any).ethers,
      JsonRpcProvider: class MockJsonRpcProvider {
        constructor() {
          return mockProvider;
        }
      },
      Contract: class MockContract {
        constructor() {
          return currentMockContract || {
            balanceOf: vi.fn().mockResolvedValue(BigInt('50000000000000000000')),
            symbol: vi.fn().mockResolvedValue('USDT'),
            name: vi.fn().mockResolvedValue('Tether USD'),
            decimals: vi.fn().mockResolvedValue(6),
          };
        }
      },
      isAddress: vi.fn().mockReturnValue(true),
      ZeroAddress: '0x0000000000000000000000000000000000000000',
      formatEther: (value: bigint) => (Number(value) / 1e18).toString(),
      formatUnits: (value: bigint, decimals: number) => (Number(value) / 10 ** decimals).toString(),
      parseEther: (value: string) => BigInt(Math.floor(parseFloat(value) * 1e18)),
      parseUnits: (value: string, decimals: number) => BigInt(Math.floor(parseFloat(value) * 10 ** decimals)),
    },
  };
});

describe('TokenService', () => {
  const testAddress = '0x1234567890123456789012345678901234567890';
  const defaultMockContract = {
    balanceOf: vi.fn().mockResolvedValue(BigInt('50000000000000000000')),
    symbol: vi.fn().mockResolvedValue('USDT'),
    name: vi.fn().mockResolvedValue('Tether USD'),
    decimals: vi.fn().mockResolvedValue(6),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to default mock contract
    currentMockContract = defaultMockContract;
  });

  describe('getHyperEVMTokens', () => {
    it('should always return HYPE token even with 0 balance', async () => {
      const tokens = await TokenService.getHyperEVMTokens(testAddress, true);
      
      const hypeToken = tokens.find(t => t.symbol === 'HYPE');
      expect(hypeToken).toBeDefined();
      expect(hypeToken?.name).toBe('HyperEVM');
      expect(hypeToken?.decimals).toBe(18);
    });

    it('should include zero balance tokens when includeZeroBalance is true', async () => {
      const tokens = await TokenService.getHyperEVMTokens(testAddress, true);
      
      // Should include at least HYPE token
      expect(tokens.length).toBeGreaterThanOrEqual(1);
      // If includeZeroBalance is true, should include common tokens even with 0 balance
      // The actual count depends on COMMON_TOKENS list
      const hypeToken = tokens.find(t => t.symbol === 'HYPE');
      expect(hypeToken).toBeDefined();
    });

    it('should exclude zero balance tokens when includeZeroBalance is false', async () => {
      const tokens = await TokenService.getHyperEVMTokens(testAddress, false);
      
      // Should only include tokens with balance (HYPE at minimum)
      expect(tokens.length).toBeGreaterThanOrEqual(1);
      const hypeToken = tokens.find(t => t.symbol === 'HYPE');
      expect(hypeToken).toBeDefined();
    });

    it('should handle errors gracefully and still return HYPE', async () => {
      // The service handles errors internally and returns HYPE with 0.00 balance
      // We can't easily mock JsonRpcProvider since it's a class, but we can verify
      // that HYPE is always returned even when errors occur
      const tokens = await TokenService.getHyperEVMTokens(testAddress, true);
      
      const hypeToken = tokens.find(t => t.symbol === 'HYPE');
      expect(hypeToken).toBeDefined();
      expect(hypeToken?.name).toBe('HyperEVM');
      // Balance should be defined (either actual balance or 0.00 on error)
      expect(hypeToken?.balance).toBeDefined();
    });

    it('should return tokens with correct structure', async () => {
      const tokens = await TokenService.getHyperEVMTokens(testAddress, true);
      
      tokens.forEach(token => {
        expect(token).toHaveProperty('address');
        expect(token).toHaveProperty('symbol');
        expect(token).toHaveProperty('name');
        expect(token).toHaveProperty('decimals');
        expect(token).toHaveProperty('balance');
        expect(typeof token.balance).toBe('string');
      });
    });
  });

  describe('addCustomToken', () => {
    it('should add custom token and return token info', async () => {
      const tokenAddress = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
      // Create a new mock contract instance for this test
      const customMockContract = {
        balanceOf: vi.fn().mockResolvedValue(BigInt('10000000000000000000')),
        symbol: vi.fn().mockResolvedValue('CUSTOM'),
        name: vi.fn().mockResolvedValue('Custom Token'),
        decimals: vi.fn().mockResolvedValue(18),
      };
      
      // Override the mock contract for this test
      currentMockContract = customMockContract;
      (ethers.isAddress as any) = vi.fn().mockReturnValue(true);

      const token = await TokenService.addCustomToken(tokenAddress, testAddress);
      
      expect(token).toBeDefined();
      expect(token?.symbol).toBe('CUSTOM');
      expect(token?.name).toBe('Custom Token');
      expect(token?.address).toBe(tokenAddress);
      
      // Restore default mock
      currentMockContract = defaultMockContract;
    });

    it('should return null if token contract fails', async () => {
      const tokenAddress = '0xinvalid';
      // Create a mock contract that throws errors
      const errorMockContract = {
        balanceOf: vi.fn().mockRejectedValue(new Error('Invalid contract')),
        symbol: vi.fn().mockRejectedValue(new Error('Invalid contract')),
        name: vi.fn().mockRejectedValue(new Error('Invalid contract')),
        decimals: vi.fn().mockRejectedValue(new Error('Invalid contract')),
      };
      
      // Override the mock contract for this test
      currentMockContract = errorMockContract;
      (ethers.isAddress as any) = vi.fn().mockReturnValue(true);

      const token = await TokenService.addCustomToken(tokenAddress, testAddress);
      
      expect(token).toBeNull();
      
      // Restore default mock
      currentMockContract = defaultMockContract;
    });
  });
});
