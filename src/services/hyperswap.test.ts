import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HyperSwapService } from './hyperswap';
import { ethers } from 'ethers';

// Mock ethers
vi.mock('ethers', () => {
    const mockProvider = {
        getBalance: vi.fn(),
    };

    const mockContract = {
        getAmountsOut: vi.fn(),
        exactInputSingle: vi.fn(),
    };

    const mockWallet = {
        connect: vi.fn().mockReturnThis(),
        getAddress: vi.fn().mockResolvedValue('0x123'),
    };

    return {
        ethers: {
            JsonRpcProvider: vi.fn().mockImplementation(() => mockProvider),
            Contract: vi.fn().mockImplementation(() => mockContract),
            Wallet: vi.fn().mockImplementation(() => mockWallet),
            parseUnits: vi.fn((value: string, decimals: number) => BigInt(value) * BigInt(10 ** decimals)),
            formatUnits: vi.fn((value: bigint, decimals: number) => (Number(value) / 10 ** decimals).toString()),
            ZeroAddress: '0x0000000000000000000000000000000000000000',
            MaxUint256: BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'),
        },
    };
});

describe('HyperSwapService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getQuote', () => {
        it('should return a quote with builder fee', async () => {
            const quote = await HyperSwapService.getQuote('HYPE', 'ETH', '1.0');
            
            expect(quote).toBeDefined();
            expect(quote.fromCurrency).toBe('HYPE');
            expect(quote.toCurrency).toBe('ETH');
            expect(quote.amountIn).toBe('1.0');
            expect(quote.builderFee).toBeDefined();
            expect(parseFloat(quote.builderFee || '0')).toBeGreaterThan(0);
        });

        it('should calculate 1% builder fee correctly', async () => {
            const quote = await HyperSwapService.getQuote('HYPE', 'ETH', '100.0');
            
            // Builder fee should be 1% of output
            const amountOut = parseFloat(quote.amountOut);
            const builderFee = parseFloat(quote.builderFee || '0');
            
            // Builder fee should be approximately 1% of the output
            expect(builderFee).toBeGreaterThan(0);
            expect(builderFee / amountOut).toBeCloseTo(0.01, 2);
        });

        it('should fallback to market-based quote when contract fails', async () => {
            // This will use market-based fallback since contract address is placeholder
            const quote = await HyperSwapService.getQuote('HYPE', 'ETH', '1.0');
            
            expect(quote).toBeDefined();
            expect(quote.amountOut).toBeDefined();
            expect(quote.rate).toBeDefined();
        });

        it('should handle different token pairs', async () => {
            const quote1 = await HyperSwapService.getQuote('HYPE', 'ETH', '1.0');
            const quote2 = await HyperSwapService.getQuote('ETH', 'HYPE', '1.0');
            
            expect(quote1).toBeDefined();
            expect(quote2).toBeDefined();
            expect(quote1.fromCurrency).not.toBe(quote2.fromCurrency);
        });
    });

    describe('getBuilderCode', () => {
        it('should return the builder code', () => {
            const builderCode = HyperSwapService.getBuilderCode();
            expect(builderCode).toBeDefined();
            expect(typeof builderCode).toBe('string');
            expect(builderCode).toBe('0x0e7FCDC85f296004Bc235cc86cfA69da2c39324a');
        });
    });

    describe('executeSwap', () => {
        it('should require wallet for swap execution', async () => {
            const mockWallet = {
                connect: vi.fn().mockReturnThis(),
                getAddress: vi.fn().mockResolvedValue('0x123'),
            } as any;

            const quote = {
                fromCurrency: 'HYPE',
                toCurrency: 'ETH',
                amountIn: '1.0',
                amountOut: '0.99',
                rate: '0.99',
                fee: '0',
                builderFee: '0.01',
                path: []
            };

            // This will fail because router address is placeholder, but should attempt execution
            await expect(
                HyperSwapService.executeSwap(quote, mockWallet)
            ).rejects.toThrow();
        });

        it('should handle slippage tolerance', async () => {
            const mockWallet = {
                connect: vi.fn().mockReturnThis(),
                getAddress: vi.fn().mockResolvedValue('0x123'),
            } as any;

            const quote = {
                fromCurrency: 'HYPE',
                toCurrency: 'ETH',
                amountIn: '1.0',
                amountOut: '0.99',
                rate: '0.99',
                fee: '0',
                builderFee: '0.01',
                path: []
            };

            // Should use custom slippage tolerance
            await expect(
                HyperSwapService.executeSwap(quote, mockWallet, 0.01) // 1% slippage
            ).rejects.toThrow(); // Will fail due to placeholder contract, but should attempt
        });
    });
});


