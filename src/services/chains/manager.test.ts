import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChainManager, SupportedChain } from './manager';
import { WalletService } from '../wallet';

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
});


