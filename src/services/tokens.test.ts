import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TokenService, type TokenInfo } from './tokens';
import { ethers } from 'ethers';

// Mock ethers
vi.mock('ethers', async () => {
  const actual = await vi.importActual('ethers');
  return {
    ...actual,
    ethers: {
      ...(actual as any).ethers,
      JsonRpcProvider: vi.fn().mockImplementation(() => ({
        getBalance: vi.fn().mockResolvedValue(ethers.parseEther('100')),
        call: vi.fn().mockResolvedValue('0x0000000000000000000000000000000000000000000000000000000000000000'),
      })),
      Contract: vi.fn().mockImplementation(() => ({
        balanceOf: vi.fn().mockResolvedValue(ethers.parseEther('50')),
        symbol: vi.fn().mockResolvedValue('USDT'),
        name: vi.fn().mockResolvedValue('Tether USD'),
        decimals: vi.fn().mockResolvedValue(6),
      })),
      ZeroAddress: '0x0000000000000000000000000000000000000000',
      formatEther: (value: bigint) => ethers.formatEther(value),
      formatUnits: (value: bigint, decimals: number) => ethers.formatUnits(value, decimals),
      parseEther: (value: string) => BigInt(value) * BigInt(10 ** 18),
      parseUnits: (value: string, decimals: number) => BigInt(value) * BigInt(10 ** decimals),
    },
  };
});

describe('TokenService', () => {
  const testAddress = '0x1234567890123456789012345678901234567890';

  beforeEach(() => {
    vi.clearAllMocks();
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
      
      // Should include common tokens even with 0 balance
      expect(tokens.length).toBeGreaterThan(1);
    });

    it('should exclude zero balance tokens when includeZeroBalance is false', async () => {
      const tokens = await TokenService.getHyperEVMTokens(testAddress, false);
      
      // Should only include tokens with balance (HYPE at minimum)
      expect(tokens.length).toBeGreaterThanOrEqual(1);
      const hypeToken = tokens.find(t => t.symbol === 'HYPE');
      expect(hypeToken).toBeDefined();
    });

    it('should handle errors gracefully and still return HYPE', async () => {
      // Mock provider to throw error
      const mockProvider = {
        getBalance: vi.fn().mockRejectedValue(new Error('Network error')),
      };
      (ethers.JsonRpcProvider as any).mockImplementationOnce(() => mockProvider);

      const tokens = await TokenService.getHyperEVMTokens(testAddress, true);
      
      const hypeToken = tokens.find(t => t.symbol === 'HYPE');
      expect(hypeToken).toBeDefined();
      expect(hypeToken?.balance).toBe('0.00');
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
      const mockContract = {
        balanceOf: vi.fn().mockResolvedValue(ethers.parseEther('10')),
        symbol: vi.fn().mockResolvedValue('CUSTOM'),
        name: vi.fn().mockResolvedValue('Custom Token'),
        decimals: vi.fn().mockResolvedValue(18),
      };
      (ethers.Contract as any).mockImplementationOnce(() => mockContract);

      const token = await TokenService.addCustomToken(tokenAddress, testAddress);
      
      expect(token).toBeDefined();
      expect(token?.symbol).toBe('CUSTOM');
      expect(token?.name).toBe('Custom Token');
      expect(token?.address).toBe(tokenAddress);
    });

    it('should return null if token contract fails', async () => {
      const tokenAddress = '0xinvalid';
      const mockContract = {
        balanceOf: vi.fn().mockRejectedValue(new Error('Invalid contract')),
      };
      (ethers.Contract as any).mockImplementationOnce(() => mockContract);

      const token = await TokenService.addCustomToken(tokenAddress, testAddress);
      
      expect(token).toBeNull();
    });
  });
});


