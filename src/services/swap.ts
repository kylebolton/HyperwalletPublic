import { MarketService } from "./market";
import { HyperSwapService, type HyperSwapQuote } from "./hyperswap";
import axios from "axios";

export interface SwapQuote {
  fromCurrency: string;
  toCurrency: string;
  amountIn: string;
  amountOut: string; // After fee
  rate: string;
  fee: string;
  partnerFee?: string; // Fee from swap partner
  builderFee?: string; // Builder fee for HyperSwap
  provider?: "swapzone" | "hyperswap"; // Which provider was used
}

export class SwapService {
  // Platform fee (1% - goes to platform owner)
  private static PLATFORM_FEE_PERCENT = 0.01;

  // Platform revenue address - all fees go here
  private static PLATFORM_REVENUE_ADDRESS =
    "0x0e7FCDC85f296004Bc235cc86cfA69da2c39324a";

  // Platform API key - hardcoded for platform use
  private static PLATFORM_API_KEY = "f_plk-ONA";

  // Swapzone API base URL
  private static SWAPZONE_API = "https://api.swapzone.io/v1";

  // Get platform API key (always returns the platform key)
  private static getPlatformApiKey(): string {
    return this.PLATFORM_API_KEY;
  }

  /**
   * Get swap quote - routes to HyperSwap for HyperEVM swaps, SwapZone for others
   */
  static async getQuote(
    from: string,
    to: string,
    amount: string
  ): Promise<SwapQuote> {
    // Check if this is a HyperEVM swap (either from or to is HYPEREVM)
    const isHyperEVMSwap =
      from.toUpperCase() === "HYPEREVM" ||
      from.toUpperCase() === "HYPE" ||
      to.toUpperCase() === "HYPEREVM" ||
      to.toUpperCase() === "HYPE";

    if (isHyperEVMSwap) {
      // Use HyperSwap for HyperEVM swaps
      try {
        const hyperSwapQuote = await HyperSwapService.getQuote(
          from,
          to,
          amount
        );
        return {
          fromCurrency: hyperSwapQuote.fromCurrency,
          toCurrency: hyperSwapQuote.toCurrency,
          amountIn: hyperSwapQuote.amountIn,
          amountOut: hyperSwapQuote.amountOut,
          rate: hyperSwapQuote.rate,
          fee: hyperSwapQuote.fee,
          builderFee: hyperSwapQuote.builderFee,
          provider: "hyperswap",
        };
      } catch (error: any) {
        console.warn(
          "HyperSwap quote failed, falling back to market rates:",
          error.message
        );
        return await this.getMarketBasedQuote(from, to, amount, "hyperswap");
      }
    }

    // Use SwapZone for all non-HyperEVM swaps
    try {
      // Map our symbols to Swapzone format
      const fromSymbol = this.mapToSwapzoneSymbol(from);
      const toSymbol = this.mapToSwapzoneSymbol(to);

      if (!fromSymbol || !toSymbol) {
        // Fallback to market-based calculation if symbols not supported
        return this.getMarketBasedQuote(from, to, amount, "swapzone");
      }

      // Get quote from Swapzone API (using platform API key for revenue)
      const response = await axios.get(
        `${this.SWAPZONE_API}/exchange/get-amount`,
        {
          params: {
            from: fromSymbol,
            to: toSymbol,
            amount: amount,
            apiKey: this.getPlatformApiKey(), // Platform API key - always used
          },
          timeout: 10000,
        }
      );

      const swapzoneQuote = response.data;
      const amountOutFromPartner = parseFloat(
        swapzoneQuote.toAmount || swapzoneQuote.estimatedAmount || "0"
      );

      // Calculate platform fee (1% of input - goes to platform owner)
      const amountNum = parseFloat(amount);
      const platformFee = amountNum * this.PLATFORM_FEE_PERCENT;

      // Platform fee is deducted from output
      const amountAfterPlatformFee =
        amountOutFromPartner * (1 - this.PLATFORM_FEE_PERCENT);

      const rate = amountAfterPlatformFee / amountNum;

      return {
        fromCurrency: from,
        toCurrency: to,
        amountIn: amount,
        amountOut: amountAfterPlatformFee.toFixed(6),
        rate: rate.toFixed(6),
        fee: platformFee.toFixed(6) + " " + from,
        provider: "swapzone",
      };
    } catch (error: any) {
      console.warn(
        "Swapzone API failed, falling back to market rates:",
        error.message
      );
      // Fallback to market-based calculation
      return await this.getMarketBasedQuote(from, to, amount, "swapzone");
    }
  }

  /**
   * Fallback: Calculate quote based on market prices (async)
   */
  private static async getMarketBasedQuote(
    from: string,
    to: string,
    amount: string,
    provider: "swapzone" | "hyperswap" = "swapzone"
  ): Promise<SwapQuote> {
    try {
      const prices = await MarketService.getPrices([from, to]);
      const fromPrice = prices[from]?.current_price || 0;
      const toPrice = prices[to]?.current_price || 1;

      if (!fromPrice) {
        throw new Error(`Price for ${from} not found`);
      }

      const rate = fromPrice / toPrice;
      const amountNum = parseFloat(amount);
      const platformFee = amountNum * this.PLATFORM_FEE_PERCENT;
      const amountAfterFee = amountNum - platformFee;
      const amountOut = amountAfterFee * rate;

      return {
        fromCurrency: from,
        toCurrency: to,
        amountIn: amount,
        amountOut: amountOut.toFixed(6),
        rate: rate.toFixed(6),
        fee: platformFee.toFixed(6) + " " + from,
        provider: provider,
      };
    } catch (error) {
      // Final fallback: simple calculation without market data
      const amountNum = parseFloat(amount);
      const platformFee = amountNum * this.PLATFORM_FEE_PERCENT;
      return {
        fromCurrency: from,
        toCurrency: to,
        amountIn: amount,
        amountOut: (amountNum - platformFee).toFixed(6), // Simplified
        rate: "1.0", // Placeholder
        fee: platformFee.toFixed(6) + " " + from,
        provider: provider,
      };
    }
  }

  /**
   * Create a swap transaction - routes to HyperSwap for HyperEVM swaps, SwapZone for others
   */
  static async createSwap(
    quote: SwapQuote,
    destinationAddress: string,
    wallet?: any // ethers.Wallet for HyperSwap swaps
  ): Promise<{ id: string; depositAddress: string; txHash?: string }> {
    // Check if this is a HyperEVM swap
    const isHyperEVMSwap =
      quote.provider === "hyperswap" ||
      quote.fromCurrency.toUpperCase() === "HYPEREVM" ||
      quote.fromCurrency.toUpperCase() === "HYPE" ||
      quote.toCurrency.toUpperCase() === "HYPEREVM" ||
      quote.toCurrency.toUpperCase() === "HYPE";

    if (isHyperEVMSwap) {
      // Use HyperSwap for HyperEVM swaps
      if (!wallet) {
        throw new Error("Wallet required for HyperSwap swaps");
      }

      try {
        const hyperSwapQuote: HyperSwapQuote = {
          fromCurrency: quote.fromCurrency,
          toCurrency: quote.toCurrency,
          amountIn: quote.amountIn,
          amountOut: quote.amountOut,
          rate: quote.rate,
          fee: quote.fee || "0",
          builderFee: quote.builderFee || "0",
          path: [],
        };

        const txHash = await HyperSwapService.executeSwap(
          hyperSwapQuote,
          wallet
        );

        return {
          id: `hyperswap_${Date.now()}`,
          depositAddress: destinationAddress,
          txHash: txHash,
        };
      } catch (error: any) {
        console.error("Failed to create swap via HyperSwap:", error.message);
        throw new Error(
          `HyperSwap execution failed: ${error.message || "Unknown error"}`
        );
      }
    }

    // Use SwapZone for all non-HyperEVM swaps
    try {
      const fromSymbol = this.mapToSwapzoneSymbol(quote.fromCurrency);
      const toSymbol = this.mapToSwapzoneSymbol(quote.toCurrency);

      if (!fromSymbol || !toSymbol) {
        throw new Error(
          `Swap not supported for ${quote.fromCurrency} to ${quote.toCurrency}`
        );
      }

      // Create swap transaction via Swapzone API
      // Revenue share goes to platform via hardcoded API key
      const response = await axios.post(
        `${this.SWAPZONE_API}/exchange/create-exchange`,
        {
          from: fromSymbol,
          to: toSymbol,
          address: destinationAddress,
          amount: quote.amountIn,
          flow: "standard",
          apiKey: this.getPlatformApiKey(), // Platform API key - always used
        },
        {
          timeout: 15000,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const swapData = response.data;

      return {
        id: swapData.id || swapData.exchangeId || `swap_${Date.now()}`,
        depositAddress:
          swapData.depositAddress || swapData.payinAddress || swapData.address,
      };
    } catch (error: any) {
      console.error("Failed to create swap via Swapzone:", error.message);
      throw new Error(
        `Swap creation failed: ${error.message || "Unknown error"}`
      );
    }
  }

  /**
   * Map our currency symbols to Swapzone format
   */
  private static mapToSwapzoneSymbol(symbol: string): string | null {
    const symbolMap: Record<string, string> = {
      BTC: "btc",
      ETH: "eth",
      SOL: "sol",
      XMR: "xmr",
      ZEC: "zec",
      HYPE: "eth", // Hyperliquid may use ETH-compatible addresses (but use HyperSwap instead)
      USDT: "usdt",
      USDC: "usdc",
    };
    return symbolMap[symbol.toUpperCase()] || null;
  }

  /**
   * Get platform revenue address
   */
  static getPlatformRevenueAddress(): string {
    return this.PLATFORM_REVENUE_ADDRESS;
  }
}
