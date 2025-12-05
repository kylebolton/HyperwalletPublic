import type { Transaction } from './history';
import type { TokenInfo } from './tokens';
import * as ChainManager from './chains/manager';
const { SupportedChain } = ChainManager;

export class PreviewDataService {
  static getMockBalances(): Record<string, string> {
    return {
      BTC: '12.54321',        // ~$564,000
      ETH: '125.789',         // ~$352,000
      SOL: '5250.45',         // ~$498,000
      XMR: '1892.5',          // ~$283,875
      ZEC: '2450.34',         // ~$85,762
      HYPE: '1250000.0',      // ~$625,000
      USDT: '250000.0',       // ~$250,000
      USDC: '150000.0',       // ~$150,000
      DAI: '100000.0',        // ~$100,000
      WBTC: '8.5',            // ~$382,500
      WETH: '45.0',           // ~$126,000
      UNI: '15000.0',        // ~$127,500
      LINK: '25000.0',       // ~$380,000
      AAVE: '2500.0',        // ~$237,500
      wHYPE: '500000.0',     // ~$250,000
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
      wHYPE: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
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
      // Generate 5-8 transactions per chain for more activity
      const txCount = 5 + Math.floor(Math.random() * 4);
      for (let i = 0; i < txCount; i++) {
        const daysAgo = chainIdx * 2 + i;
        const date = new Date(now - daysAgo * 24 * 60 * 60 * 1000);
        const isReceive = Math.random() > 0.4;
        
        // Generate larger amounts matching the big balances
        let amount: string;
        if (symbol === 'BTC') {
          amount = (Math.random() * 2 + 0.5).toFixed(8);
        } else if (symbol === 'ETH') {
          amount = (Math.random() * 20 + 5).toFixed(4);
        } else if (symbol === 'SOL') {
          amount = (Math.random() * 500 + 50).toFixed(2);
        } else if (symbol === 'HYPE') {
          amount = (Math.random() * 50000 + 10000).toFixed(2);
        } else {
          amount = (Math.random() * 1000 + 100).toFixed(4);
        }
        
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
      wHYPE: 0.5, // Same as HYPE
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
      { address: '0x9999999999999999999999999999999999999999', symbol: 'wHYPE', name: 'Wrapped HYPE', decimals: 18, balance: balances.wHYPE || '0' },
    ];

    return tokens.filter(t => parseFloat(t.balance) > 0);
  }

  /**
   * Get a fake wallet object for preview mode
   * This creates a mock wallet with fake credentials for demonstration
   */
  static getMockWallet(): {
    id: string;
    name: string;
    mnemonic: string;
    privateKey: string;
    createdAt: number;
    isActive: boolean;
  } {
    return {
      id: 'preview-wallet-001',
      name: 'Demo Wallet',
      mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art',
      privateKey: '0x0000000000000000000000000000000000000000000000000000000000000001',
      createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago
      isActive: true,
    };
  }

  /**
   * Format balance with commas for display
   */
  static formatBalance(balance: string): string {
    const num = parseFloat(balance);
    if (isNaN(num)) return balance;
    
    // Format with commas for large numbers
    if (num >= 1000) {
      return num.toLocaleString('en-US', {
        maximumFractionDigits: 8,
        minimumFractionDigits: 0,
      });
    }
    
    // For smaller numbers, show more precision
    return num.toFixed(8).replace(/\.?0+$/, '');
  }
}

