import axios, { AxiosError } from 'axios';
import { ethers } from 'ethers';
import { SupportedChain } from '../services/chains/manager';
import { NetworkService } from './networks';

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
                case SupportedChain.HYPEREVM: return await this.getHyperEVMHistory(address);
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
        return await this.getEVMHistory(address, SupportedChain.ETH, 'ETH');
    }

    private static async getHyperEVMHistory(address: string): Promise<Transaction[]> {
        return await this.getEVMHistory(address, SupportedChain.HYPEREVM, 'HYPE');
    }

    private static async getEVMHistory(
        address: string,
        chain: SupportedChain,
        symbol: string
    ): Promise<Transaction[]> {
        try {
            // Get RPC URL from network config
            const networkConfig = NetworkService.getNetworkConfig(chain);
            if (!networkConfig?.rpcUrl) {
                console.warn(`No RPC URL configured for ${chain}`);
                return [];
            }

            const provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);
            const transactions: Transaction[] = [];

            // Get current block number
            const currentBlock = await provider.getBlockNumber();
            const fromBlock = Math.max(0, currentBlock - 10000); // Last 10k blocks

            // ERC20 Transfer event signature
            const TRANSFER_EVENT_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
            const addressPadded = ethers.zeroPadValue(address, 32);

            // Get Transfer events where address is recipient
            const receiveFilter = {
                fromBlock,
                toBlock: currentBlock,
                topics: [
                    TRANSFER_EVENT_TOPIC,
                    null, // from (any)
                    addressPadded, // to (our address)
                ],
            };

            // Get Transfer events where address is sender
            const sendFilter = {
                fromBlock,
                toBlock: currentBlock,
                topics: [
                    TRANSFER_EVENT_TOPIC,
                    addressPadded, // from (our address)
                    null, // to (any)
                ],
            };

            // Query logs with timeout
            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error("History query timeout")), 30000)
            );

            const [receiveLogs, sendLogs] = await Promise.all([
                Promise.race([provider.getLogs(receiveFilter), timeoutPromise]).catch(() => []),
                Promise.race([provider.getLogs(sendFilter), timeoutPromise]).catch(() => []),
            ]);

            // Process receive logs (token transfers)
            for (const log of receiveLogs as ethers.Log[]) {
                try {
                    const block = await provider.getBlock(log.blockNumber);
                    const tx = await provider.getTransaction(log.transactionHash);
                    if (!tx || !block) continue;

                    // Decode Transfer event: Transfer(address indexed from, address indexed to, uint256 value)
                    const iface = new ethers.Interface([
                        "event Transfer(address indexed from, address indexed to, uint256 value)"
                    ]);
                    const decoded = iface.parseLog({
                        topics: log.topics as string[],
                        data: log.data
                    });

                    if (decoded) {
                        const amount = ethers.formatEther(decoded.args.value || 0n);
                        transactions.push({
                            id: log.transactionHash,
                            type: 'receive',
                            asset: symbol, // Could enhance to detect token symbol
                            amount: parseFloat(amount).toFixed(6),
                            date: new Date(block.timestamp * 1000).toLocaleString(),
                            status: 'Confirmed',
                            hash: log.transactionHash,
                            chain: chain
                        });
                    }
                } catch (e) {
                    console.warn(`Failed to process receive log:`, e);
                }
            }

            // Process send logs (token transfers)
            for (const log of sendLogs as ethers.Log[]) {
                try {
                    const block = await provider.getBlock(log.blockNumber);
                    const tx = await provider.getTransaction(log.transactionHash);
                    if (!tx || !block) continue;

                    // Decode Transfer event
                    const iface = new ethers.Interface([
                        "event Transfer(address indexed from, address indexed to, uint256 value)"
                    ]);
                    const decoded = iface.parseLog({
                        topics: log.topics as string[],
                        data: log.data
                    });

                    if (decoded) {
                        const amount = ethers.formatEther(decoded.args.value || 0n);
                        transactions.push({
                            id: log.transactionHash,
                            type: 'send',
                            asset: symbol, // Could enhance to detect token symbol
                            amount: parseFloat(amount).toFixed(6),
                            date: new Date(block.timestamp * 1000).toLocaleString(),
                            status: 'Confirmed',
                            hash: log.transactionHash,
                            chain: chain
                        });
                    }
                } catch (e) {
                    console.warn(`Failed to process send log:`, e);
                }
            }

            // Get native token transfers (ETH/HYPE)
            // Query transactions sent from this address
            try {
                const txHistory = await Promise.race([
                    provider.getHistory(address, fromBlock),
                    timeoutPromise
                ]).catch(() => []);

                for (const tx of txHistory as ethers.TransactionResponse[]) {
                    try {
                        const receipt = await provider.getTransactionReceipt(tx.hash);
                        if (!receipt) continue;

                        const block = await provider.getBlock(receipt.blockNumber);
                        if (!block) continue;

                        const isReceive = tx.to?.toLowerCase() === address.toLowerCase() && 
                                         tx.from.toLowerCase() !== address.toLowerCase();
                        const isSend = tx.from.toLowerCase() === address.toLowerCase();

                        if (isReceive || isSend) {
                            const value = ethers.formatEther(tx.value || 0n);
                            if (parseFloat(value) > 0) {
                                transactions.push({
                                    id: tx.hash,
                                    type: isReceive ? 'receive' : 'send',
                                    asset: symbol,
                                    amount: parseFloat(value).toFixed(6),
                                    date: new Date(block.timestamp * 1000).toLocaleString(),
                                    status: receipt.status === 1 ? 'Confirmed' : 'Failed',
                                    hash: tx.hash,
                                    chain: chain
                                });
                            }
                        }
                    } catch (e) {
                        console.warn(`Failed to process native transfer:`, e);
                    }
                }
            } catch (e) {
                console.warn(`Failed to get native transfer history:`, e);
            }

            // Remove duplicates and sort by date
            const uniqueTxs = new Map<string, Transaction>();
            for (const tx of transactions) {
                if (!uniqueTxs.has(tx.hash) || 
                    new Date(tx.date).getTime() > new Date(uniqueTxs.get(tx.hash)!.date).getTime()) {
                    uniqueTxs.set(tx.hash, tx);
                }
            }

            return Array.from(uniqueTxs.values())
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, 50); // Limit to 50 most recent
        } catch (e: any) {
            console.error(`Failed to fetch EVM history for ${chain}:`, e);
            return [];
        }
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
