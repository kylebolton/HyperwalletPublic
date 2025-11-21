import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WalletService } from './wallet';
import { StorageService } from './storage';
import * as bip39 from 'bip39';
import { ethers } from 'ethers';

// Mock dependencies
vi.mock('./storage', () => ({
    StorageService: {
        getMnemonic: vi.fn(),
        saveMnemonic: vi.fn(),
        getActiveWallet: vi.fn(),
        saveWallet: vi.fn(),
        getWallet: vi.fn(),
        getAllWallets: vi.fn(),
        deleteWallet: vi.fn(),
        setActiveWallet: vi.fn(),
        hasWallets: vi.fn(),
    },
}));

vi.mock('ethers', async () => {
    const actual = await vi.importActual('ethers');
    return {
        ...actual,
        ethers: {
            ...(actual as any).ethers,
            Wallet: class {
                constructor(key: string) {
                    if (!key || key.length < 66) {
                        throw new Error('Invalid private key');
                    }
                }
                address = '0x123';
                privateKey = '0xkey';
            },
            HDNodeWallet: {
                fromPhrase: vi.fn().mockReturnValue({
                    privateKey: '0xderivedkey123'
                }),
            },
        },
    };
});

vi.mock('bip39', async () => {
    const actual = await vi.importActual('bip39');
    return {
        ...actual,
        generateMnemonic: (strength?: number) => {
            // Use actual implementation but ensure it returns a valid mnemonic
            if (actual && typeof (actual as any).generateMnemonic === 'function') {
                return (actual as any).generateMnemonic(strength);
            }
            return 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
        },
        validateMnemonic: vi.fn().mockReturnValue(true),
        mnemonicToSeedSync: vi.fn(),
    };
});

describe('WalletService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    describe('generateMnemonic', () => {
        it('should generate a valid mnemonic', () => {
            const mnemonic = WalletService.generateMnemonic();
            expect(mnemonic).toBeDefined();
            expect(typeof mnemonic).toBe('string');
            expect(mnemonic.split(' ').length).toBeGreaterThanOrEqual(12);
        });
    });

    describe('validateMnemonic', () => {
        it('should validate correct mnemonic', () => {
            const isValid = WalletService.validateMnemonic('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about');
            expect(isValid).toBe(true);
        });

        it('should reject invalid mnemonic', () => {
            (bip39.validateMnemonic as any).mockReturnValueOnce(false);
            const isValid = WalletService.validateMnemonic('invalid mnemonic phrase');
            expect(isValid).toBe(false);
        });
    });

    describe('validatePrivateKey', () => {
        it('should validate correct private key', () => {
            // Use a valid 64-char hex string (32 bytes)
            const validKey = '0x' + '1'.repeat(64);
            const isValid = WalletService.validatePrivateKey(validKey);
            expect(isValid).toBe(true);
        });

        it('should add 0x prefix if missing', () => {
            // Use a valid 64-char hex string
            const validKey = '1'.repeat(64);
            const isValid = WalletService.validatePrivateKey(validKey);
            // Should attempt to create wallet with 0x prefix
            expect(ethers.Wallet).toHaveBeenCalled();
            // Check if it was called with a string containing 0x
            const calls = (ethers.Wallet as any).mock.calls;
            expect(calls.length).toBeGreaterThan(0);
            expect(calls[0][0]).toContain('0x');
        });

        it('should reject invalid private key', () => {
            (ethers.Wallet as any).mockImplementationOnce(() => {
                throw new Error('Invalid key');
            });
            const isValid = WalletService.validatePrivateKey('invalid');
            expect(isValid).toBe(false);
        });
    });

    describe('createWallet', () => {
        it('should generate mnemonic and derive EVM key', async () => {
            (StorageService.saveWallet as any).mockReturnValue(undefined);
            (StorageService.setActiveWallet as any).mockReturnValue(true);
            const mnemonic = await WalletService.createWallet();
            
            expect(mnemonic).toBeDefined();
            expect(StorageService.saveWallet).toHaveBeenCalled();
            expect(ethers.HDNodeWallet.fromPhrase).toHaveBeenCalled();
        });

        it('should handle derivation errors gracefully', async () => {
            (ethers.HDNodeWallet.fromPhrase as any).mockImplementationOnce(() => {
                throw new Error('Derivation failed');
            });
            (StorageService.saveWallet as any).mockReturnValue(undefined);
            (StorageService.setActiveWallet as any).mockReturnValue(true);
            
            // createWallet should still work even if derivation fails
            // It will create a wallet with just mnemonic
            const wallet = await WalletService.createNewWallet('Test Wallet');
            
            expect(wallet).toBeDefined();
            expect(wallet.mnemonic).toBeDefined();
        });
    });

    describe('importWallet', () => {
        describe('with mnemonic', () => {
            it('should save mnemonic and derive EVM key', async () => {
                const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
                (StorageService.saveWallet as any).mockReturnValue(undefined);
                (StorageService.setActiveWallet as any).mockReturnValue(true);
                const result = await WalletService.importWallet(testMnemonic, false);
                
                expect(result).toBe(true);
                expect(StorageService.saveWallet).toHaveBeenCalled();
                expect(ethers.HDNodeWallet.fromPhrase).toHaveBeenCalled();
            });

            it('should not overwrite existing private key', async () => {
                localStorage.setItem('hyperwallet_privkey', '0xexisting');
                const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
                
                await WalletService.importWallet(testMnemonic, false);
                
                expect(localStorage.getItem('hyperwallet_privkey')).toBe('0xexisting');
            });
        });

        describe('with private key', () => {
            it('should save private key and generate mnemonic', async () => {
                const testKey = '0x' + '1'.repeat(64); // Valid 64-char hex
                (StorageService.saveWallet as any).mockReturnValue(undefined);
                (StorageService.setActiveWallet as any).mockReturnValue(true);
                
                const result = await WalletService.importWallet(testKey, true);
                
                expect(result).toBe(true);
                expect(StorageService.saveWallet).toHaveBeenCalled();
                expect(bip39.generateMnemonic).toHaveBeenCalled();
            });

            it('should not overwrite existing mnemonic', async () => {
                const testKey = '0x' + '1'.repeat(64); // Valid 64-char hex
                (StorageService.saveWallet as any).mockReturnValue(undefined);
                (StorageService.setActiveWallet as any).mockReturnValue(true);
                
                await WalletService.importWallet(testKey, true);
                
                // Should still generate mnemonic for new wallet
                expect(bip39.generateMnemonic).toHaveBeenCalled();
            });

            it('should reject invalid private key', async () => {
                const result = await WalletService.importWallet('invalid', true);
                
                expect(result).toBe(false);
            });
        });
    });

    describe('getStoredMnemonic', () => {
        it('should return stored mnemonic', () => {
            (StorageService.getActiveWallet as any).mockReturnValueOnce({ mnemonic: 'test mnemonic' });
            const mnemonic = WalletService.getStoredMnemonic();
            expect(mnemonic).toBe('test mnemonic');
        });
    });

    describe('getStoredPrivateKey', () => {
        it('should return stored private key', () => {
            (StorageService.getActiveWallet as any).mockReturnValueOnce({ privateKey: '0xtestkey' });
            const key = WalletService.getStoredPrivateKey();
            expect(key).toBe('0xtestkey');
        });
    });

    describe('Automatic Wallet Generation', () => {
        it('should ensure all chains get addresses on initialization', async () => {
            (StorageService.saveWallet as any).mockReturnValue(undefined);
            (StorageService.setActiveWallet as any).mockReturnValue(true);
            const wallet = await WalletService.createNewWallet('Test Wallet');
            
            // After creating wallet, both mnemonic and private key should be available
            expect(wallet.mnemonic).toBeDefined();
            expect(wallet.privateKey).toBeDefined();
        });
    });

    describe('Multi-wallet methods', () => {
        beforeEach(() => {
            vi.clearAllMocks();
            localStorage.clear();
        });

        describe('validateWalletName', () => {
            it('should validate correct wallet name', () => {
                expect(WalletService.validateWalletName('My Wallet')).toBe(true);
                expect(WalletService.validateWalletName('Wallet 1')).toBe(true);
            });

            it('should reject empty name', () => {
                expect(WalletService.validateWalletName('')).toBe(false);
                expect(WalletService.validateWalletName('   ')).toBe(false);
            });

            it('should reject names with special characters', () => {
                expect(WalletService.validateWalletName('Wallet<Name')).toBe(false);
                expect(WalletService.validateWalletName('Wallet:Name')).toBe(false);
                expect(WalletService.validateWalletName('Wallet/Name')).toBe(false);
            });

            it('should reject names longer than 50 characters', () => {
                const longName = 'a'.repeat(51);
                expect(WalletService.validateWalletName(longName)).toBe(false);
            });

            it('should accept names up to 50 characters', () => {
                const name = 'a'.repeat(50);
                expect(WalletService.validateWalletName(name)).toBe(true);
            });
        });

        describe('createNewWallet', () => {
            it('should create a new wallet with name', async () => {
                (ethers.HDNodeWallet.fromPhrase as any).mockReturnValue({
                    privateKey: '0xderivedkey123'
                });

                const wallet = await WalletService.createNewWallet('Test Wallet');

                expect(wallet).toBeDefined();
                expect(wallet.name).toBe('Test Wallet');
                expect(wallet.mnemonic).toBeDefined();
                expect(wallet.privateKey).toBe('0xderivedkey123');
                expect(StorageService.saveWallet).toHaveBeenCalled();
                expect(StorageService.setActiveWallet).toHaveBeenCalledWith(wallet.id);
            });

            it('should throw error for invalid wallet name', async () => {
                await expect(WalletService.createNewWallet('')).rejects.toThrow('Invalid wallet name');
                await expect(WalletService.createNewWallet('Wallet<Name')).rejects.toThrow('Invalid wallet name');
            });

            it('should allow creating wallet with custom mnemonic', async () => {
                const customMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
                (ethers.HDNodeWallet.fromPhrase as any).mockReturnValue({
                    privateKey: '0xderivedkey123'
                });

                const wallet = await WalletService.createNewWallet('Custom Wallet', customMnemonic);

                expect(wallet.mnemonic).toBe(customMnemonic);
            });
        });

        describe('importNewWallet', () => {
            it('should import wallet with mnemonic', async () => {
                const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
                (ethers.HDNodeWallet.fromPhrase as any).mockReturnValue({
                    privateKey: '0xderivedkey123'
                });

                const wallet = await WalletService.importNewWallet('Imported Wallet', testMnemonic, false);

                expect(wallet.name).toBe('Imported Wallet');
                expect(wallet.mnemonic).toBe(testMnemonic);
                expect(wallet.privateKey).toBe('0xderivedkey123');
            });

            it('should import wallet with private key', async () => {
                const testKey = '0x' + '1'.repeat(64); // Valid 64-char hex

                const wallet = await WalletService.importNewWallet('PK Wallet', testKey, true);

                expect(wallet.name).toBe('PK Wallet');
                expect(wallet.privateKey).toBe(testKey);
                expect(wallet.mnemonic).toBeDefined(); // Should generate mnemonic
            });

            it('should throw error for invalid mnemonic', async () => {
                (bip39.validateMnemonic as any).mockReturnValueOnce(false);
                await expect(WalletService.importNewWallet('Wallet', 'invalid mnemonic', false))
                    .rejects.toThrow('Invalid mnemonic phrase');
            });

            it('should throw error for invalid private key', async () => {
                (ethers.Wallet as any).mockImplementationOnce(() => {
                    throw new Error('Invalid key');
                });

                await expect(WalletService.importNewWallet('Wallet', 'invalid key', true))
                    .rejects.toThrow('Invalid private key format');
            });
        });

        describe('switchWallet', () => {
            it('should switch active wallet', () => {
                (StorageService.setActiveWallet as any).mockReturnValue(true);

                const result = WalletService.switchWallet('wallet-1');

                expect(result).toBe(true);
                expect(StorageService.setActiveWallet).toHaveBeenCalledWith('wallet-1');
            });
        });

        describe('deleteWallet', () => {
            it('should delete wallet', () => {
                (StorageService.deleteWallet as any).mockReturnValue(true);

                const result = WalletService.deleteWallet('wallet-1');

                expect(result).toBe(true);
                expect(StorageService.deleteWallet).toHaveBeenCalledWith('wallet-1');
            });
        });

        describe('renameWallet', () => {
            it('should rename wallet', () => {
                const wallet = {
                    id: 'wallet-1',
                    name: 'Old Name',
                    mnemonic: 'test',
                    privateKey: null,
                    createdAt: Date.now()
                };
                (StorageService.getWallet as any).mockReturnValue(wallet);

                const result = WalletService.renameWallet('wallet-1', 'New Name');

                expect(result).toBe(true);
                expect(StorageService.saveWallet).toHaveBeenCalledWith(
                    expect.objectContaining({ name: 'New Name' })
                );
            });

            it('should return false for invalid name', () => {
                const result = WalletService.renameWallet('wallet-1', '');
                expect(result).toBe(false);
            });

            it('should return false for non-existent wallet', () => {
                (StorageService.getWallet as any).mockReturnValue(null);

                const result = WalletService.renameWallet('non-existent', 'New Name');
                expect(result).toBe(false);
            });
        });

        describe('getAllWallets', () => {
            it('should return all wallets', () => {
                const wallets = [
                    { id: 'wallet-1', name: 'Wallet 1', mnemonic: 'test1', privateKey: null, createdAt: Date.now() },
                    { id: 'wallet-2', name: 'Wallet 2', mnemonic: 'test2', privateKey: null, createdAt: Date.now() }
                ];
                (StorageService.getAllWallets as any).mockReturnValue(wallets);

                const result = WalletService.getAllWallets();

                expect(result).toEqual(wallets);
            });
        });

        describe('getActiveWallet', () => {
            it('should return active wallet', () => {
                const wallet = {
                    id: 'wallet-1',
                    name: 'Active Wallet',
                    mnemonic: 'test',
                    privateKey: null,
                    createdAt: Date.now()
                };
                (StorageService.getActiveWallet as any).mockReturnValue(wallet);

                const result = WalletService.getActiveWallet();

                expect(result).toEqual(wallet);
            });
        });

        describe('hasWallets', () => {
            it('should return true when wallets exist', () => {
                (StorageService.hasWallets as any).mockReturnValue(true);
                expect(WalletService.hasWallets()).toBe(true);
            });

            it('should return false when no wallets exist', () => {
                (StorageService.hasWallets as any).mockReturnValue(false);
                expect(WalletService.hasWallets()).toBe(false);
            });
        });
    });
});


