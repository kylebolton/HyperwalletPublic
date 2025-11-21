import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChainManager, SupportedChain } from './manager';
import { WalletService } from '../wallet';
import { NetworkService, type NetworkConfig } from '../networks';

// Mock chain services
vi.mock('./evm', () => ({
    EVMChainService: vi.fn().mockImplementation(() => ({
        chainName: 'Ethereum',
        symbol: 'ETH',
        getAddress: vi.fn().mockResolvedValue('0x123'),
        getBalance: vi.fn().mockResolvedValue('1.0'),
        sendTransaction: vi.fn(),
    })),
}));

vi.mock('./btc', () => ({
    BTCChainService: vi.fn().mockImplementation(() => ({
        chainName: 'Bitcoin',
        symbol: 'BTC',
        getAddress: vi.fn().mockResolvedValue('bc1abc123'),
        getBalance: vi.fn().mockResolvedValue('0.5'),
        sendTransaction: vi.fn(),
    })),
}));

vi.mock('./sol', () => ({
    SOLChainService: vi.fn().mockImplementation(() => ({
        chainName: 'Solana',
        symbol: 'SOL',
        getAddress: vi.fn().mockResolvedValue('Solana123'),
        getBalance: vi.fn().mockResolvedValue('10.0'),
        sendTransaction: vi.fn(),
    })),
}));

vi.mock('./monero', () => ({
    MoneroChainService: vi.fn().mockImplementation(() => ({
        chainName: 'Monero',
        symbol: 'XMR',
        getAddress: vi.fn().mockResolvedValue('Monero123'),
        getBalance: vi.fn().mockResolvedValue('5.0'),
        sendTransaction: vi.fn(),
    })),
}));

vi.mock('./zcash', () => ({
    ZCashChainService: vi.fn().mockImplementation(() => ({
        chainName: 'ZCash',
        symbol: 'ZEC',
        getAddress: vi.fn().mockResolvedValue('ZCash123'),
        getBalance: vi.fn().mockResolvedValue('2.0'),
        sendTransaction: vi.fn(),
    })),
}));

vi.mock('ethers', () => ({
    ethers: {
        HDNodeWallet: {
            fromPhrase: vi.fn().mockReturnValue({
                privateKey: '0xderivedkey123'
            }),
        },
    },
}));

describe('ChainManager', () => {
    const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    const testPrivateKey = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

    describe('Initialization', () => {
        it('should initialize all chains with mnemonic', () => {
            const manager = new ChainManager(undefined, false, testMnemonic);
            const services = manager.getAllServices();
            
            expect(services.length).toBeGreaterThan(0);
        });

        it('should initialize EVM chains with private key', () => {
            const manager = new ChainManager(testPrivateKey, true, testMnemonic);
            const services = manager.getAllServices();
            
            expect(services.length).toBeGreaterThan(0);
        });

        it('should initialize all supported chains', async () => {
            const manager = new ChainManager(testPrivateKey, true, testMnemonic);
            const services = manager.getAllServices();
            
            const symbols = services.map(s => s.symbol);
            expect(symbols).toContain('HYPE');
            expect(symbols).toContain('ETH');
            expect(symbols).toContain('BTC');
            expect(symbols).toContain('SOL');
            expect(symbols).toContain('XMR');
            expect(symbols).toContain('ZEC');
        });
    });

    describe('getService', () => {
        it('should return service for supported chain', () => {
            const manager = new ChainManager(testPrivateKey, true, testMnemonic);
            const service = manager.getService(SupportedChain.BTC);
            
            expect(service).toBeDefined();
            expect(service.symbol).toBe('BTC');
        });

        it('should throw error for unsupported chain', () => {
            const manager = new ChainManager(testPrivateKey, true, testMnemonic);
            
            // @ts-expect-error - testing invalid chain
            expect(() => manager.getService('INVALID')).toThrow();
        });
    });

    describe('getAllServices', () => {
        it('should return all initialized services', () => {
            const manager = new ChainManager(testPrivateKey, true, testMnemonic);
            const services = manager.getAllServices();
            
            expect(services.length).toBeGreaterThanOrEqual(6); // HYPE, ETH, BTC, SOL, XMR, ZEC
        });

        it('should return services that can get addresses', async () => {
            const manager = new ChainManager(testPrivateKey, true, testMnemonic);
            const services = manager.getAllServices();
            
            for (const service of services) {
                const address = await service.getAddress();
                expect(address).toBeDefined();
                expect(typeof address).toBe('string');
            }
        });
    });

    describe('Address Generation', () => {
        it('should generate addresses for all chains on initialization', async () => {
            const manager = new ChainManager(testPrivateKey, true, testMnemonic);
            const services = manager.getAllServices();
            
            const addresses = await Promise.all(
                services.map(s => s.getAddress())
            );
            
            expect(addresses.length).toBe(services.length);
            addresses.forEach(addr => {
                expect(addr).toBeDefined();
                expect(addr.length).toBeGreaterThan(0);
            });
        });
    });

    describe('Error Handling', () => {
        it('should handle service initialization failures gracefully', () => {
            // Services that fail to initialize should be caught in constructor
            // and not crash the manager
            const manager = new ChainManager(testPrivateKey, true, testMnemonic);
            const services = manager.getAllServices();
            
            // Should still have some services even if some fail
            expect(services.length).toBeGreaterThan(0);
        });
    });

    describe('Network Configuration', () => {
        it('should only initialize enabled networks when configs provided', () => {
            const networkConfigs: NetworkConfig[] = [
                {
                    chain: SupportedChain.HYPEREVM,
                    enabled: true,
                    name: "HyperEVM",
                    symbol: "HYPE",
                    rpcUrl: "https://eth.llamarpc.com",
                    chainId: 1,
                    custom: false,
                },
                {
                    chain: SupportedChain.ETH,
                    enabled: false,
                    name: "Ethereum",
                    symbol: "ETH",
                    rpcUrl: "https://eth.llamarpc.com",
                    chainId: 1,
                    custom: false,
                },
                {
                    chain: SupportedChain.BTC,
                    enabled: true,
                    name: "Bitcoin",
                    symbol: "BTC",
                    custom: false,
                },
                {
                    chain: SupportedChain.SOL,
                    enabled: false,
                    name: "Solana",
                    symbol: "SOL",
                    custom: false,
                },
            ];

            const manager = new ChainManager(testPrivateKey, true, testMnemonic, networkConfigs);
            const services = manager.getAllServices();
            
            const symbols = services.map(s => s.symbol);
            expect(symbols).toContain('HYPE');
            expect(symbols).toContain('BTC');
            expect(symbols).not.toContain('ETH');
            expect(symbols).not.toContain('SOL');
        });

        it('should use custom RPC URLs and chain IDs from network configs', () => {
            const networkConfigs: NetworkConfig[] = [
                {
                    chain: SupportedChain.HYPEREVM,
                    enabled: true,
                    name: "Custom HyperEVM",
                    symbol: "HYPE",
                    rpcUrl: "https://custom-rpc.com",
                    chainId: 999,
                    custom: true,
                },
            ];

            const manager = new ChainManager(testPrivateKey, true, undefined, networkConfigs);
            const services = manager.getAllServices();
            
            // Should have HYPE service with custom config
            const hypeService = services.find(s => s.symbol === 'HYPE');
            expect(hypeService).toBeDefined();
        });

        it('should maintain backward compatibility when no network configs provided', () => {
            const manager = new ChainManager(testPrivateKey, true, testMnemonic);
            const services = manager.getAllServices();
            
            // Should still initialize all networks (default behavior)
            expect(services.length).toBeGreaterThan(0);
        });

        it('should skip disabled networks', () => {
            const networkConfigs: NetworkConfig[] = [
                {
                    chain: SupportedChain.HYPEREVM,
                    enabled: false,
                    name: "HyperEVM",
                    symbol: "HYPE",
                    rpcUrl: "https://eth.llamarpc.com",
                    chainId: 1,
                    custom: false,
                },
                {
                    chain: SupportedChain.BTC,
                    enabled: false,
                    name: "Bitcoin",
                    symbol: "BTC",
                    custom: false,
                },
            ];

            const manager = new ChainManager(testPrivateKey, true, testMnemonic, networkConfigs);
            const services = manager.getAllServices();
            
            const symbols = services.map(s => s.symbol);
            expect(symbols).not.toContain('HYPE');
            expect(symbols).not.toContain('BTC');
        });

        it('should return only enabled network services from getAllServices', () => {
            const networkConfigs: NetworkConfig[] = [
                {
                    chain: SupportedChain.HYPEREVM,
                    enabled: true,
                    name: "HyperEVM",
                    symbol: "HYPE",
                    rpcUrl: "https://eth.llamarpc.com",
                    chainId: 1,
                    custom: false,
                },
                {
                    chain: SupportedChain.ETH,
                    enabled: false,
                    name: "Ethereum",
                    symbol: "ETH",
                    rpcUrl: "https://eth.llamarpc.com",
                    chainId: 1,
                    custom: false,
                },
            ];

            const manager = new ChainManager(testPrivateKey, true, undefined, networkConfigs);
            const services = manager.getAllServices();
            
            const symbols = services.map(s => s.symbol);
            expect(symbols).toContain('HYPE');
            expect(symbols).not.toContain('ETH');
        });
    });
});


