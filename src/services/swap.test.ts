import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SwapService } from './swap';
import { HyperSwapService } from './hyperswap';

// Mock dependencies
vi.mock('./hyperswap', () => ({
    HyperSwapService: {
        getQuote: vi.fn(),
        executeSwap: vi.fn(),
    },
}));

vi.mock('./market', () => ({
    MarketService: {
        getPrices: vi.fn().mockResolvedValue({
            HYPEREVM: { current_price: 3000 },
            ETH: { current_price: 3000 },
            BTC: { current_price: 60000 },
            SOL: { current_price: 150 },
            XMR: { current_price: 150 },
            ZEC: { current_price: 50 },
        }),
    },
}));

vi.mock('axios', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
    },
}));

describe('SwapService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getQuote - Routing Logic', () => {
        it('should route HyperEVM token swaps to HyperSwap', async () => {
            (HyperSwapService.getQuote as any).mockResolvedValue({
                fromCurrency: 'HYPE',
                toCurrency: 'USDT',
                amountIn: '1.0',
                amountOut: '0.99',
                rate: '0.99',
                fee: '0',
                builderFee: '0.01',
                path: []
            });

            const quote = await SwapService.getQuote('HYPE', 'USDT', '1.0');
            
            expect(HyperSwapService.getQuote).toHaveBeenCalledWith('HYPE', 'USDT', '1.0');
            expect(quote.provider).toBe('hyperswap');
            expect(quote.builderFee).toBeDefined();
        });

        it('should route swaps between HyperEVM tokens to HyperSwap', async () => {
            (HyperSwapService.getQuote as any).mockResolvedValue({
                fromCurrency: 'USDT',
                toCurrency: 'USDC',
                amountIn: '100.0',
                amountOut: '99.5',
                rate: '0.995',
                fee: '0',
                builderFee: '0.5',
                path: []
            });

            const quote = await SwapService.getQuote('USDT', 'USDC', '100.0');
            
            expect(quote.provider).toBe('hyperswap');
            expect(quote.builderFee).toBeDefined();
        });

        it('should route cross-chain swaps to SwapZone', async () => {
            const axios = await import('axios');
            (axios.default.get as any).mockResolvedValue({
                data: {
                    toAmount: '0.99',
                    estimatedAmount: '0.99'
                }
            });

            const quote = await SwapService.getQuote('BTC', 'ETH', '1.0');
            
            expect(axios.default.get).toHaveBeenCalled();
            expect(quote.provider).toBe('swapzone');
            expect(quote.fee).toBeDefined();
        });

        it('should route swaps from HyperEVM token to base chain to SwapZone', async () => {
            const axios = await import('axios');
            (axios.default.get as any).mockResolvedValue({
                data: {
                    toAmount: '0.99',
                    estimatedAmount: '0.99'
                }
            });

            const quote = await SwapService.getQuote('HYPE', 'BTC', '1.0');
            
            expect(quote.provider).toBe('swapzone');
        });

        it('should route swaps from base chain to HyperEVM token to SwapZone', async () => {
            const axios = await import('axios');
            (axios.default.get as any).mockResolvedValue({
                data: {
                    toAmount: '0.99',
                    estimatedAmount: '0.99'
                }
            });

            const quote = await SwapService.getQuote('ETH', 'USDT', '1.0');
            
            expect(quote.provider).toBe('swapzone');
        });
    });

    describe('getQuote - Fee Calculation', () => {
        it('should include builder fee for HyperSwap quotes', async () => {
            (HyperSwapService.getQuote as any).mockResolvedValue({
                fromCurrency: 'HYPE',
                toCurrency: 'USDT',
                amountIn: '100.0',
                amountOut: '99.0',
                rate: '0.99',
                fee: '0',
                builderFee: '1.0',
                path: []
            });

            const quote = await SwapService.getQuote('HYPE', 'USDT', '100.0');
            
            expect(quote.builderFee).toBe('1.0');
            expect(quote.fee).toBe('0');
        });

        it('should include platform fee for SwapZone quotes', async () => {
            const axios = await import('axios');
            (axios.default.get as any).mockResolvedValue({
                data: {
                    toAmount: '99.0',
                    estimatedAmount: '99.0'
                }
            });

            const quote = await SwapService.getQuote('BTC', 'ETH', '100.0');
            
            expect(quote.fee).toBeDefined();
            expect(quote.provider).toBe('swapzone');
        });
    });

    describe('createSwap - Routing Logic', () => {
        it('should execute HyperSwap swaps when provider is hyperswap', async () => {
            const mockWallet = {} as any;
            (HyperSwapService.executeSwap as any).mockResolvedValue('0x123');

            const quote = {
                fromCurrency: 'HYPEREVM',
                toCurrency: 'ETH',
                amountIn: '1.0',
                amountOut: '0.99',
                rate: '0.99',
                fee: '0',
                builderFee: '0.01',
                provider: 'hyperswap' as const
            };

            const result = await SwapService.createSwap(quote, '0x456', mockWallet);
            
            expect(HyperSwapService.executeSwap).toHaveBeenCalled();
            expect(result.txHash).toBe('0x123');
        });

        it('should require wallet for HyperSwap swaps', async () => {
            const quote = {
                fromCurrency: 'HYPEREVM',
                toCurrency: 'ETH',
                amountIn: '1.0',
                amountOut: '0.99',
                rate: '0.99',
                fee: '0',
                builderFee: '0.01',
                provider: 'hyperswap' as const
            };

            await expect(
                SwapService.createSwap(quote, '0x456')
            ).rejects.toThrow('Wallet required for HyperSwap swaps');
        });

        it('should create SwapZone swaps for non-HyperEVM', async () => {
            const axios = await import('axios');
            (axios.default.post as any).mockResolvedValue({
                data: {
                    id: 'swap123',
                    depositAddress: '0x789'
                }
            });

            const quote = {
                fromCurrency: 'BTC',
                toCurrency: 'ETH',
                amountIn: '1.0',
                amountOut: '0.99',
                rate: '0.99',
                fee: '0.01 BTC',
                provider: 'swapzone' as const
            };

            const result = await SwapService.createSwap(quote, '0x456');
            
            expect(axios.default.post).toHaveBeenCalled();
            expect(result.id).toBe('swap123');
            expect(result.depositAddress).toBe('0x789');
        });
    });

    describe('getPlatformRevenueAddress', () => {
        it('should return platform revenue address', () => {
            const address = SwapService.getPlatformRevenueAddress();
            expect(address).toBe('0x0e7FCDC85f296004Bc235cc86cfA69da2c39324a');
        });
    });
});


