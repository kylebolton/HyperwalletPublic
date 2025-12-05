import { Connection, Keypair, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as bip39 from 'bip39';
import { type IChainService } from './types';
import { AddressCacheService } from '../addressCache';

// Retry helper
async function retry<T>(fn: () => Promise<T>, retries = 2, delay = 1000): Promise<T> {
    try {
        return await fn();
    } catch (error) {
        if (retries <= 0) throw error;
        await new Promise(resolve => setTimeout(resolve, delay));
        return retry(fn, retries - 1, delay * 2);
    }
}

export class SOLChainService implements IChainService {
    chainName = "Solana";
    symbol = "SOL";
    private connections: Connection[];
    private keypair: Keypair;
    private keypairPromise: Promise<Keypair>;
    private walletId: string | null = null;
    private derivationIndex: number = 0;
    private mnemonic: string;

    constructor(mnemonic: string, rpcUrl?: string, walletId?: string, derivationIndex: number = 0) {
        this.mnemonic = mnemonic;
        this.walletId = walletId || null;
        this.derivationIndex = derivationIndex;
        // Reliable Solana RPC endpoints (public and free tier)
        // Using endpoints that don't require API keys and have better rate limits
        const rpcUrls = rpcUrl 
            ? [rpcUrl]
            : [
                'https://solana-api.projectserum.com', // Project Serum endpoint - more reliable
                'https://rpc.ankr.com/solana', // Ankr public RPC (no API key needed for basic requests)
                'https://solana-mainnet.g.alchemy.com/v2/demo', // Alchemy demo endpoint (rate limited but works)
                'https://api.mainnet-beta.solana.com', // Official Solana RPC (rate limited, fallback)
                'https://rpc.solana.com' // Alternative Solana RPC
            ];
        
        this.connections = rpcUrls.map(url => new Connection(url, 'confirmed'));
        
        // Initialize keypair asynchronously to handle dynamic import
        this.keypairPromise = this.initializeKeypair(mnemonic);
        // Set a temporary keypair that will be replaced
        this.keypair = Keypair.generate();
    }

    private async initializeKeypair(mnemonic: string): Promise<Keypair> {
        try {
            // Try dynamic import to handle CommonJS/ES module compatibility
            let ed25519: any;
            try {
                ed25519 = await import('ed25519-hd-key');
            } catch (importError) {
                console.warn("Failed to import ed25519-hd-key, Solana wallet will be disabled:", importError);
                throw new Error("Solana key derivation library not available in browser environment");
            }
            
            const derivePath = ed25519.derivePath || (ed25519 as any).default?.derivePath;
            
            if (!derivePath || typeof derivePath !== 'function') {
                throw new Error("derivePath function is not available");
            }
            
            const seed = bip39.mnemonicToSeedSync(mnemonic);
            const seedHex = Buffer.isBuffer(seed) ? seed.toString('hex') : String(seed);
            
            if (!seedHex || seedHex.length === 0) {
                throw new Error("Invalid seed generated from mnemonic");
            }
            
            // Use derivation index in the path
            const derivationPath = `m/44'/501'/${this.derivationIndex}'/0'`;
            const derived = derivePath(derivationPath, seedHex);
            
            if (!derived || !derived.key) {
                throw new Error("Failed to derive key from path");
            }
            
            let seedBytes: Uint8Array;
            if (derived.key instanceof Uint8Array) {
                seedBytes = derived.key;
            } else if (Buffer.isBuffer(derived.key)) {
                seedBytes = new Uint8Array(derived.key);
            } else if (typeof derived.key === 'string') {
                seedBytes = new Uint8Array(Buffer.from(derived.key, 'hex'));
            } else {
                throw new Error(`Unexpected key type: ${typeof derived.key}`);
            }
            
            if (seedBytes.length !== 32) {
                throw new Error(`Invalid seed length: ${seedBytes.length}, expected 32`);
            }
            
            const keypair = Keypair.fromSeed(seedBytes);
            this.keypair = keypair; // Update the instance keypair
            
            // Cache the address if walletId is provided
            if (this.walletId && keypair.publicKey) {
                const address = keypair.publicKey.toBase58();
                AddressCacheService.setCachedAddress(
                    this.walletId,
                    this.symbol,
                    address,
                    this.derivationIndex
                );
            }
            
            return keypair;
        } catch (error: any) {
            console.error("Failed to derive Solana keypair:", error);
            // Generate a dummy keypair for fallback (don't throw to prevent unhandled rejections)
            try {
                const dummyKeypair = Keypair.generate();
                this.keypair = dummyKeypair;
            } catch (genError) {
                // If even dummy generation fails, create a minimal keypair
                const fallbackSeed = new Uint8Array(32).fill(1);
                this.keypair = Keypair.fromSeed(fallbackSeed);
            }
            // Don't throw error here - let it fail gracefully on operations
            console.warn(`Solana wallet initialization failed: ${error.message}`);
        }
    }

    private async tryConnections<T>(fn: (conn: Connection) => Promise<T>): Promise<T> {
        for (const conn of this.connections) {
            try {
                return await retry(() => fn(conn), 2, 500);
            } catch (error) {
                console.warn(`Solana RPC ${conn.rpcEndpoint} failed, trying next...`);
                continue;
            }
        }
        throw new Error('All Solana RPC endpoints failed');
    }

    private async ensureKeypair(): Promise<Keypair> {
        await this.keypairPromise;
        return this.keypair;
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
                return cached;
            }
        }
        
        const keypair = await this.ensureKeypair();
        const address = keypair.publicKey.toBase58();
        
        // Cache the address if walletId is provided
        if (this.walletId && address) {
            AddressCacheService.setCachedAddress(
                this.walletId,
                this.symbol,
                address,
                this.derivationIndex
            );
        }
        
        // Validate address format (non-blocking - warn but still return)
        if (!this.validateAddress(address)) {
            console.warn(`SOL address validation failed for: ${address}, but returning anyway`);
        }
        return address;
    }

    validateAddress(address: string): boolean {
        try {
            // Solana addresses are base58 encoded public keys (32 bytes = 44 base58 chars)
            const publicKey = new PublicKey(address);
            // Verify it's a valid public key and has correct length
            return publicKey.toBase58().length >= 32 && publicKey.toBase58().length <= 44;
        } catch (e) {
            return false;
        }
    }

    async getBalance(): Promise<string> {
        try {
            const keypair = await this.ensureKeypair();
            const balance = await this.tryConnections(async (conn) => {
                return await conn.getBalance(keypair.publicKey);
            });
            return (balance / LAMPORTS_PER_SOL).toString();
        } catch (error: any) {
            console.error(`Failed to get SOL balance:`, error.message);
            return "0.0";
        }
    }

    async sendTransaction(to: string, amount: string): Promise<string> {
        try {
            const keypair = await this.ensureKeypair();
            const transaction = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: keypair.publicKey,
                    toPubkey: new PublicKey(to),
                    lamports: parseFloat(amount) * LAMPORTS_PER_SOL,
                })
            );

            const signature = await this.tryConnections(async (conn) => {
                return await conn.sendTransaction(transaction, [keypair]);
            });
            
            return signature;
        } catch (error: any) {
            console.error(`Failed to send SOL:`, error.message);
            throw new Error(`Transaction failed: ${error.message}`);
        }
    }
}
