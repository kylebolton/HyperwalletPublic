import * as bitcoin from 'bitcoinjs-lib';
import * as bip39 from 'bip39';
import { BIP32Factory } from 'bip32';
import * as ecc from 'tiny-secp256k1';
import { type IChainService } from './types';
import { AddressCacheService } from '../addressCache';

const bip32 = BIP32Factory(ecc);

// Retry helper
async function retry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
    try {
        return await fn();
    } catch (error) {
        if (retries <= 0) throw error;
        await new Promise(resolve => setTimeout(resolve, delay));
        return retry(fn, retries - 1, delay * 2);
    }
}

export class BTCChainService implements IChainService {
    chainName = "Bitcoin";
    symbol = "BTC";
    private network: bitcoin.Network;
    private address: string | null = null;
    private keyPair: any;
    private apiUrls: string[];
    private walletId: string | null = null;
    private derivationIndex: number = 0;
    private mnemonic: string;

    constructor(
        mnemonic: string,
        network: 'mainnet' | 'testnet' = 'mainnet',
        walletId?: string,
        derivationIndex: number = 0
    ) {
        this.mnemonic = mnemonic;
        this.walletId = walletId || null;
        this.derivationIndex = derivationIndex;
        this.network = network === 'mainnet' ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;
        
        // Multiple API endpoints for redundancy
        this.apiUrls = network === 'mainnet' 
            ? [
                'https://mempool.space/api',
                'https://blockstream.info/api',
                'https://mempool.space/api' // fallback
            ]
            : ['https://mempool.space/testnet/api'];
        
        // Initialize keyPair (address will be generated on demand or from cache)
        const seed = bip39.mnemonicToSeedSync(mnemonic);
        const root = bip32.fromSeed(seed, this.network);
        const basePath = network === 'mainnet' ? "m/84'/0'/0'/0" : "m/84'/1'/0'/0";
        const path = `${basePath}/${derivationIndex}`;
        const child = root.derivePath(path);
        
        this.keyPair = child;
        
        // Generate address immediately (will be cached if walletId provided)
        const { address } = bitcoin.payments.p2wpkh({ 
            pubkey: child.publicKey,
            network: this.network 
        });
        this.address = address!;
        
        // Cache the address if walletId is provided
        if (this.walletId && this.address) {
            AddressCacheService.setCachedAddress(
                this.walletId,
                this.symbol,
                this.address,
                this.derivationIndex
            );
        }
    }

    async getAddress(): Promise<string> {
        // Check cache first if walletId is available
        if (this.walletId) {
            const cached = AddressCacheService.getCachedAddress(
                this.walletId,
                this.symbol,
                this.derivationIndex
            );
            if (cached) {
                this.address = cached;
                return cached;
            }
        }
        
        // Use generated address or generate if not set
        if (!this.address) {
            const { address } = bitcoin.payments.p2wpkh({ 
                pubkey: this.keyPair.publicKey,
                network: this.network 
            });
            this.address = address!;
        }
        
        // Cache the address if walletId is provided
        if (this.walletId && this.address) {
            AddressCacheService.setCachedAddress(
                this.walletId,
                this.symbol,
                this.address,
                this.derivationIndex
            );
        }
        
        // Validate address before returning (non-blocking - warn but still return)
        if (!this.validateAddress(this.address)) {
            console.warn(`BTC address validation failed for: ${this.address}, but returning anyway`);
        }
        return this.address;
    }

    validateAddress(address: string): boolean {
        try {
            // Validate address format and network compatibility
            const decoded = bitcoin.address.fromBech32(address);
            if (decoded) {
                // Bech32 address (native segwit)
                const version = decoded.version;
                const hrp = decoded.prefix;
                // Mainnet: bc1, Testnet: tb1
                if (this.network === bitcoin.networks.bitcoin && hrp !== 'bc') {
                    return false;
                }
                if (this.network === bitcoin.networks.testnet && hrp !== 'tb') {
                    return false;
                }
                return version === 0; // P2WPKH
            }
        } catch (e) {
            // Not bech32, try legacy formats
        }

        try {
            // Try legacy address formats
            const decoded = bitcoin.address.fromBase58Check(address);
            if (decoded) {
                const version = decoded.version;
                // Mainnet: version 0 (P2PKH) or 5 (P2SH)
                // Testnet: version 111 (P2PKH) or 196 (P2SH)
                if (this.network === bitcoin.networks.bitcoin) {
                    return version === 0 || version === 5;
                } else {
                    return version === 111 || version === 196;
                }
            }
        } catch (e) {
            return false;
        }

        return false;
    }

    async getBalance(): Promise<string> {
        for (const apiUrl of this.apiUrls) {
            try {
                const balance = await retry(async () => {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
                    
                    try {
                        const response = await fetch(`${apiUrl}/address/${this.address}`, {
                            signal: controller.signal,
                            headers: {
                                'Accept': 'application/json',
                            }
                        });
                        
                        clearTimeout(timeoutId);
                        
                        if (!response.ok) {
                            throw new Error(`HTTP ${response.status}`);
                        }
                        
                        const data = await response.json();
                        const funded = data.chain_stats?.funded_txo_sum || 0;
                        const spent = data.chain_stats?.spent_txo_sum || 0;
                        return ((funded - spent) / 100000000).toFixed(8);
                    } catch (error: any) {
                        clearTimeout(timeoutId);
                        if (error.name === 'AbortError') {
                            throw new Error('Request timeout');
                        }
                        throw error;
                    }
                }, 2, 1000);
                
                return balance;
            } catch (error) {
                console.warn(`BTC API ${apiUrl} failed:`, error);
                continue; // Try next API
            }
        }
        
        console.error("All BTC APIs failed");
        return "0.0";
    }

    async sendTransaction(to: string, amount: string): Promise<string> {
       throw new Error("BTC transaction sending requires full node implementation");
    }
}
