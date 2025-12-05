import axios, { AxiosError } from 'axios';

export type MarketData = {
    current_price: number;
    price_change_percentage_24h: number;
    sparkline_in_7d?: { price: number[] };
};

// Retry helper with exponential backoff
async function retry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
    try {
        return await fn();
    } catch (error) {
        if (retries <= 0) throw error;
        await new Promise(resolve => setTimeout(resolve, delay));
        return retry(fn, retries - 1, delay * 2);
    }
}

export class MarketService {
    private static BASE_URL = 'https://api.coingecko.com/api/v3';
    private static TIMEOUT = 10000; // 10 seconds
    
    // Map internal symbols to CoinGecko IDs
    private static COIN_MAP: Record<string, string> = {
        'HYPE': 'hyperliquid',
        'HYPEREVM': 'hyperliquid',
        'BTC': 'bitcoin',
        'ETH': 'ethereum',
        'SOL': 'solana',
        'XMR': 'monero',
        'ZEC': 'zcash',
        'USDT': 'tether',
        'USDC': 'usd-coin',
        'DAI': 'dai',
        'WBTC': 'wrapped-bitcoin',
        'WETH': 'weth',
        'UNI': 'uniswap',
        'LINK': 'chainlink',
        'AAVE': 'aave',
        'WHYPE': 'hyperliquid' // Use HYPE price for wHYPE
    };

    // Fallback prices when API fails (reasonable market prices)
    private static FALLBACK_PRICES: Record<string, number> = {
        'HYPE': 10.0,
        'HYPEREVM': 10.0,
        'BTC': 60000,
        'ETH': 3000,
        'SOL': 150,
        'XMR': 150,
        'ZEC': 50,
        'USDT': 1.0,
        'USDC': 1.0,
        'DAI': 1.0,
        'WBTC': 60000,
        'WETH': 3000,
        'UNI': 10.0,
        'LINK': 15.0,
        'AAVE': 100.0,
        'WHYPE': 10.0
    };

    static async getPrices(symbols: string[]): Promise<Record<string, MarketData>> {
        const ids = symbols.map(s => this.COIN_MAP[s]).filter(Boolean).join(',');
        if (!ids) return {};

        return retry(async () => {
            try {
                const res = await axios.get(`${this.BASE_URL}/coins/markets`, {
                    params: {
                        vs_currency: 'usd',
                        ids: ids,
                        order: 'market_cap_desc',
                        per_page: 100,
                        page: 1,
                        sparkline: true
                    },
                    timeout: this.TIMEOUT,
                    headers: {
                        'Accept': 'application/json',
                    }
                });

                const data: Record<string, MarketData> = {};
                if (Array.isArray(res.data)) {
                    res.data.forEach((coin: any) => {
                        const symbol = Object.keys(this.COIN_MAP).find(key => this.COIN_MAP[key] === coin.id);
                        if (symbol) {
                            const price = coin.current_price;
                            // Validate price is a valid number
                            if (price !== null && price !== undefined && !isNaN(price) && price > 0) {
                                data[symbol] = {
                                    current_price: price,
                                    price_change_percentage_24h: coin.price_change_percentage_24h || 0,
                                    sparkline_in_7d: coin.sparkline_in_7d
                                };
                            } else {
                                console.warn(`Invalid price for ${symbol}: ${price}, using fallback`);
                            }
                        }
                    });
                }
                
                // Ensure all requested symbols have prices (use fallback if missing)
                symbols.forEach(sym => {
                    if (!data[sym]) {
                        const fallbackPrice = this.FALLBACK_PRICES[sym] || this.FALLBACK_PRICES[sym.toUpperCase()];
                        if (fallbackPrice !== undefined) {
                            data[sym] = {
                                current_price: fallbackPrice,
                                price_change_percentage_24h: 0
                            };
                            console.log(`Using fallback price for ${sym}: ${fallbackPrice}`);
                        } else {
                            // Last resort: use a reasonable default (1.0 for stablecoins, 10.0 for others)
                            const defaultPrice = ['USDT', 'USDC', 'DAI'].includes(sym.toUpperCase()) ? 1.0 : 10.0;
                            data[sym] = {
                                current_price: defaultPrice,
                                price_change_percentage_24h: 0
                            };
                            console.warn(`No fallback price for ${sym}, using default: ${defaultPrice}`);
                        }
                    }
                });

                return data;
            } catch (error) {
                const axiosError = error as AxiosError;
                if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT') {
                    throw new Error('Request timeout - please check your connection');
                }
                throw error;
            }
        }).catch((error) => {
            console.error("Market fetch failed after retries", error);
            // Return fallback data with reasonable prices (never zero)
            const fallback: Record<string, MarketData> = {};
            symbols.forEach(sym => {
                const upperSym = sym.toUpperCase();
                const fallbackPrice = this.FALLBACK_PRICES[upperSym] || this.FALLBACK_PRICES[sym];
                
                if (fallbackPrice !== undefined) {
                    fallback[sym] = {
                        current_price: fallbackPrice,
                        price_change_percentage_24h: 0
                    };
                } else {
                    // Last resort: use reasonable defaults (never zero)
                    // Stablecoins get 1.0, others get 10.0
                    const defaultPrice = ['USDT', 'USDC', 'DAI'].includes(upperSym) ? 1.0 : 10.0;
                    fallback[sym] = {
                        current_price: defaultPrice,
                        price_change_percentage_24h: 0
                    };
                    console.warn(`No fallback price configured for ${sym}, using default: ${defaultPrice}`);
                }
            });
            console.log(`Using fallback prices for all symbols:`, fallback);
            return fallback;
        });
    }
}
