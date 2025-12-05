export interface IChainService {
    chainName: string;
    symbol: string;
    getAddress(): Promise<string>;
    getBalance(): Promise<string>;
    sendTransaction(to: string, amount: string): Promise<string>; // returns txHash
}

export type ChainConfig = {
    rpcUrl: string;
    chainId?: number;
    name: string;
    symbol: string;
    explorerUrl?: string;
};

