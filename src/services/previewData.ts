import type { Transaction } from './history';
import type { TokenInfo } from './tokens';
import * as ChainManager from './chains/manager';
const { SupportedChain } = ChainManager;

export class PreviewDataService {
  static getMockBalances(): Record<string, string> {
    return {
      BTC: '2.54321',
      ETH: '15.789',
      SOL: '125.45',
      XMR: '8.92',
      ZEC: '12.34',
      HYPE: '1000.0',
      USDT: '5000.0',
      USDC: '3000.0',
      DAI: '2000.0',
      WBTC: '0.5',
      WETH: '5.0',
      UNI: '150.0',
      LINK: '250.0',
      AAVE: '50.0',
    };
  }

  static getMockAddresses(): Record<string, string> {
    return {
      BTC: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
      ETH: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      SOL: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      XMR: '48e9qUMBxUj3w5VbNnFw7Hyrm4t9nkeW8vGmFKjfb7wj3kP5rN2mM8pL9qR5tY7v',
      ZEC: 'zs1a7p6xq8v9r2t3y4u5w6e7r8t9y0u1i2o3p4a5s6d7f8g9h0j1k2l3m4n5',
      HYPE: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      USDT: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      USDC: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      DAI: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      WBTC: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      WETH: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      UNI: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      LINK: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      AAVE: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    };
  }

  static getMockTransactions(): Transaction[] {
    const now = Date.now();
    const transactions: Transaction[] = [];
    
    const chains: { chain: SupportedChain; symbol: string }[] = [
      { chain: SupportedChain.BTC, symbol: 'BTC' },
      { chain: SupportedChain.ETH, symbol: 'ETH' },
      { chain: SupportedChain.SOL, symbol: 'SOL' },
      { chain: SupportedChain.HYPEREVM, symbol: 'HYPE' },
    ];

    chains.forEach(({ chain, symbol }, chainIdx) => {
      // Generate 3-5 transactions per chain
      const txCount = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < txCount; i++) {
        const daysAgo = chainIdx * 2 + i;
        const date = new Date(now - daysAgo * 24 * 60 * 60 * 1000);
        const isReceive = Math.random() > 0.4;
        const amount = (Math.random() * 10 + 0.1).toFixed(chain === SupportedChain.BTC ? 8 : 4);
        
        transactions.push({
          id: `${chain}-${i}-${Math.random().toString(36).slice(2, 11)}`,
          type: isReceive ? 'receive' : 'send',
          asset: symbol,
          amount,
          date: date.toLocaleString(),
          status: Math.random() > 0.1 ? 'Confirmed' : 'Pending',
          hash: `0x${Math.random().toString(16).slice(2, 66)}`,
          chain,
        });
      }
    });

    return transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  static getMockMarketData(): Record<string, any> {
    const prices: Record<string, number> = {
      BTC: 45000,
      ETH: 2800,
      SOL: 95,
      XMR: 150,
      ZEC: 35,
      HYPE: 0.5,
      HYPEREVM: 0.5, // Alias for HYPE
      USDT: 1.0,
      USDC: 1.0,
      DAI: 1.0,
      WBTC: 45000,
      WETH: 2800,
      UNI: 8.5,
      LINK: 15.2,
      AAVE: 95.0,
    };

    return Object.entries(prices).reduce((acc, [symbol, price]) => {
      const change = (Math.random() - 0.5) * 10; // -5% to +5%
      acc[symbol] = {
        current_price: price,
        price_change_percentage_24h: change,
      };
      return acc;
    }, {} as Record<string, any>);
  }

  static getMockPortfolio(): { name: string; value: number; symbol: string }[] {
    const balances = this.getMockBalances();
    const prices = this.getMockMarketData();
    
    return Object.entries(balances)
      .map(([symbol, balance]) => {
        const price = prices[symbol]?.current_price || 0;
        const value = parseFloat(balance) * price;
        return {
          name: symbol,
          symbol,
          value: value > 0 ? value : 0,
        };
      })
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }

  static getMockHyperEVMTokens(): TokenInfo[] {
    const balances = this.getMockBalances();
    const addresses = this.getMockAddresses();
    
    const tokens: TokenInfo[] = [
      { address: '0x0000000000000000000000000000000000000000', symbol: 'HYPE', name: 'HyperEVM', decimals: 18, balance: balances.HYPE || '0' },
      { address: '0x1111111111111111111111111111111111111111', symbol: 'USDT', name: 'Tether USD', decimals: 6, balance: balances.USDT || '0' },
      { address: '0x2222222222222222222222222222222222222222', symbol: 'USDC', name: 'USD Coin', decimals: 6, balance: balances.USDC || '0' },
      { address: '0x3333333333333333333333333333333333333333', symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18, balance: balances.DAI || '0' },
      { address: '0x4444444444444444444444444444444444444444', symbol: 'WBTC', name: 'Wrapped Bitcoin', decimals: 8, balance: balances.WBTC || '0' },
      { address: '0x5555555555555555555555555555555555555555', symbol: 'WETH', name: 'Wrapped Ethereum', decimals: 18, balance: balances.WETH || '0' },
      { address: '0x6666666666666666666666666666666666666666', symbol: 'UNI', name: 'Uniswap', decimals: 18, balance: balances.UNI || '0' },
      { address: '0x7777777777777777777777777777777777777777', symbol: 'LINK', name: 'Chainlink', decimals: 18, balance: balances.LINK || '0' },
      { address: '0x8888888888888888888888888888888888888888', symbol: 'AAVE', name: 'Aave', decimals: 18, balance: balances.AAVE || '0' },
    ];

    return tokens.filter(t => parseFloat(t.balance) > 0);
  }
}

