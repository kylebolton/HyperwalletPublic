import axios, { AxiosError } from 'axios';
import { SupportedChain } from '../services/chains/manager';

export type Transaction = {
    id: string;
    type: 'send' | 'receive' | 'swap';
    asset: string;
    amount: string;
    date: string;
    status: 'Confirmed' | 'Pending' | 'Failed';
    hash: string;
    chain: SupportedChain;
};

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

export class HistoryService {
    
    static async getHistory(chain: SupportedChain, address: string): Promise<Transaction[]> {
        try {
            switch(chain) {
                case SupportedChain.ETH: return await this.getEthHistory(address);
                case SupportedChain.BTC: return await this.getBtcHistory(address);
                case SupportedChain.SOL: return await this.getSolHistory(address);
                default: return [];
            }
        } catch (e: any) {
            console.error(`Failed to fetch history for ${chain}:`, e.message);
            return [];
        }
    }

    private static async getEthHistory(address: string): Promise<Transaction[]> {
        // ETH history requires API key for reliable access
        // For production, integrate with Etherscan, Alchemy, or Infura
        return []; 
    }

    private static async getBtcHistory(address: string): Promise<Transaction[]> {
        const apiUrls = [
            'https://mempool.space/api',
            'https://blockstream.info/api'
        ];

        for (const apiUrl of apiUrls) {
            try {
                return await retry(async () => {
                    const res = await axios.get(`${apiUrl}/address/${address}/txs`, {
                        timeout: 10000,
                        headers: { 'Accept': 'application/json' }
                    });
                    
                    if (!Array.isArray(res.data)) return [];
                    
                    return res.data.slice(0, 20).map((tx: any) => {
                        const isReceive = tx.vout?.some((out: any) => out.scriptpubkey_address === address);
                        const value = isReceive 
                            ? tx.vout.find((out: any) => out.scriptpubkey_address === address)?.value || 0
                            : tx.vin?.reduce((acc: number, vin: any) => acc + (vin.prevout?.value || 0), 0) || 0;

                        return {
                            id: tx.txid || tx.hash || '',
                            type: isReceive ? 'receive' : 'send' as const,
                            asset: 'BTC',
                            amount: (value / 100000000).toFixed(8),
                            date: tx.status?.block_time 
                                ? new Date(tx.status.block_time * 1000).toLocaleString()
                                : new Date().toLocaleString(),
                            status: tx.status?.confirmed ? 'Confirmed' : 'Pending' as const,
                            hash: tx.txid || tx.hash || '',
                            chain: SupportedChain.BTC
                        };
                    });
                }, 2, 1000);
            } catch (error) {
                console.warn(`BTC history API ${apiUrl} failed:`, error);
                continue;
            }
        }
        
        return [];
    }

    private static async getSolHistory(address: string): Promise<Transaction[]> {
        // Solana history requires dedicated indexer or RPC with transaction history
        // For production, use Helius, Solscan API, or similar
        return [];
    }
}
