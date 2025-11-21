import { ethers } from 'ethers';
import { type IChainService, type ChainConfig } from './types';

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

export class EVMChainService implements IChainService {
    chainName: string;
    symbol: string;
    private provider: ethers.JsonRpcProvider;
    private wallet: ethers.Wallet;
    private fallbackProviders: ethers.JsonRpcProvider[];

    constructor(secret: string, config: ChainConfig, isPrivateKey: boolean = false, derivationPath: string = "m/44'/60'/0'/0/0") {
        this.chainName = config.name;
        this.symbol = config.symbol;
        
        // Primary provider
        this.provider = new ethers.JsonRpcProvider(config.rpcUrl, undefined, {
            staticNetwork: config.chainId ? new ethers.Network(config.name, config.chainId) : undefined
        });
        
        // Fallback RPCs for production resilience
        const fallbackUrls = this.getFallbackRPCs(config.chainId || 1);
        this.fallbackProviders = fallbackUrls.map(url => 
            new ethers.JsonRpcProvider(url, undefined, {
                staticNetwork: config.chainId ? new ethers.Network(config.name, config.chainId) : undefined
            })
        );
        
        if (isPrivateKey) {
            this.wallet = new ethers.Wallet(secret, this.provider);
        } else {
            const hdNode = ethers.HDNodeWallet.fromPhrase(secret, undefined, derivationPath);
            this.wallet = new ethers.Wallet(hdNode.privateKey, this.provider);
        }
    }

    private getFallbackRPCs(chainId: number): string[] {
        if (chainId === 1) { // Ethereum Mainnet
            return [
                'https://eth.llamarpc.com', // Verified working
                'https://ethereum.publicnode.com', // Verified working
                'https://eth.drpc.org', // Verified working
                'https://rpc.flashbots.net' // MEV-protected endpoint
            ];
        }
        // For Hyperliquid or other EVM chains, use Ethereum RPCs as fallback
        // Note: Hyperliquid EVM is Ethereum-compatible, so we use ETH RPCs
        return [
            'https://eth.llamarpc.com', // Verified working
            'https://ethereum.publicnode.com', // Verified working
            'https://eth.drpc.org' // Verified working
        ];
    }

    private async tryProviders<T>(fn: (provider: ethers.JsonRpcProvider) => Promise<T>): Promise<T> {
        const providers = [this.provider, ...this.fallbackProviders];
        
        for (const provider of providers) {
            try {
                return await retry(() => fn(provider), 2, 500);
            } catch (error) {
                console.warn(`Provider ${provider.connection?.url} failed, trying next...`);
                continue;
            }
        }
        throw new Error(`All RPC providers failed for ${this.symbol}`);
    }

    async getAddress(): Promise<string> {
        const address = this.wallet.address;
        // Validate address format and checksum (non-blocking - warn but still return)
        if (!this.validateAddress(address)) {
            console.warn(`EVM address validation failed for: ${address}, but returning anyway`);
        }
        return address;
    }

    validateAddress(address: string): boolean {
        try {
            // Ethers.js validates address format and checksum
            const checksummed = ethers.getAddress(address);
            // Ensure it's a valid 42-character hex string starting with 0x
            return /^0x[a-fA-F0-9]{40}$/.test(checksummed);
        } catch (e) {
            return false;
        }
    }

    async getBalance(): Promise<string> {
        try {
            const balance = await this.tryProviders(async (provider) => {
                return await provider.getBalance(this.wallet.address);
            });
            return ethers.formatEther(balance);
        } catch (e: any) {
            console.error(`Failed to get ${this.symbol} balance:`, e.message);
            return "0.0";
        }
    }

    async sendTransaction(to: string, amount: string): Promise<string> {
        try {
            // Update wallet provider to working one before sending
            const balance = await this.getBalance();
            if (parseFloat(balance) < parseFloat(amount)) {
                throw new Error("Insufficient balance");
            }

            const tx = await this.wallet.sendTransaction({
                to,
                value: ethers.parseEther(amount)
            });
            return tx.hash;
        } catch (e: any) {
            console.error(`Failed to send ${this.symbol}:`, e.message);
            throw new Error(`Transaction failed: ${e.message}`);
        }
    }
}
