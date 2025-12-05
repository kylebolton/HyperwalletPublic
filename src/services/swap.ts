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
  // SwapZone: Revenue is automatically routed via API key to this address
  // HyperSwap: This address is used as the builder code for fee collection
  private static PLATFORM_REVENUE_ADDRESS =
    "0x0e7FCDC85f296004Bc235cc86cfA69da2c39324a";

  // Platform API key - hardcoded for platform use
  // This API key routes SwapZone swap revenue to PLATFORM_REVENUE_ADDRESS
  private static PLATFORM_API_KEY = "f_plk-ONA";

  // Swapzone API base URL
  private static SWAPZONE_API = "https://api.swapzone.io/v1";

  // Get platform API key (always returns the platform key)
  private static getPlatformApiKey(): string {
    return this.PLATFORM_API_KEY;
  }

  /**
   * Check if a symbol is a HyperEVM token
   */
  private static isHyperEVMToken(symbol: string): boolean {
    const upper = symbol.toUpperCase();
    // Common HyperEVM tokens (this list should match TokenService)
    const hyperEVMTokens = [
      "HYPE", "USDT", "USDC", "DAI", "WBTC", "WETH", "UNI", "LINK", "AAVE", "WHYPE"
    ];
    return hyperEVMTokens.includes(upper);
  }

  /**
   * Get swap quote - routes to HyperSwap for HyperEVM token swaps, SwapZone for cross-chain swaps
   * @param from - Token symbol to swap from
   * @param to - Token symbol to swap to
   * @param amount - Amount to swap
   * @param walletAddress - Optional wallet address for token discovery
   * @param fromTokenAddress - Optional token address (if provided, will be used for HyperSwap)
   * @param toTokenAddress - Optional token address (if provided, will be used for HyperSwap)
   */
  static async getQuote(
    from: string,
    to: string,
    amount: string,
    walletAddress?: string,
    fromTokenAddress?: string,
    toTokenAddress?: string
  ): Promise<SwapQuote> {
    // Check if this is a HyperEVM token swap (both from and to are HyperEVM tokens)
    const isHyperEVMSwap =
      this.isHyperEVMToken(from) && this.isHyperEVMToken(to);

    if (isHyperEVMSwap) {
      // Use HyperSwap for HyperEVM swaps
      try {
        const hyperSwapQuote = await HyperSwapService.getQuote(
          from,
          to,
          amount,
          walletAddress,
          fromTokenAddress,
          toTokenAddress
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
        console.error("HyperSwap quote failed:", {
          error: error.message,
          stack: error.stack,
          from,
          to,
          amount,
          fromTokenAddress,
          toTokenAddress,
        });
        console.warn(
          "HyperSwap quote failed, falling back to market rates:",
          error.message
        );
        return await this.getMarketBasedQuote(from, to, amount, "hyperswap");
      }
    }

    // Use SwapZone for all non-HyperEVM swaps
    // Map our symbols to Swapzone format (outside try block for error handling)
    const fromSymbol = this.mapToSwapzoneSymbol(from);
    const toSymbol = this.mapToSwapzoneSymbol(to);

    if (!fromSymbol || !toSymbol) {
      // Fallback to market-based calculation if symbols not supported
      return this.getMarketBasedQuote(from, to, amount, "swapzone");
    }

    try {
      // Get quote from Swapzone API (using platform API key for revenue)
      // The API key routes swap revenue to PLATFORM_REVENUE_ADDRESS automatically
      const response = await axios.get(
        `${this.SWAPZONE_API}/exchange/get-amount`,
        {
          params: {
            from: fromSymbol,
            to: toSymbol,
            amount: amount,
            apiKey: this.getPlatformApiKey(), // Platform API key - revenue automatically routed to PLATFORM_REVENUE_ADDRESS
          },
          timeout: 10000,
        }
      );

      // Log full response for debugging
      console.log("SwapZone API response:", JSON.stringify(response.data, null, 2));

      const swapzoneQuote = response.data;
      
      // Comprehensive response parsing - check multiple possible fields
      let amountOutFromPartner: number | null = null;
      
      // Try different possible response formats
      if (swapzoneQuote) {
        // Direct amount fields
        if (swapzoneQuote.toAmount !== undefined && swapzoneQuote.toAmount !== null) {
          amountOutFromPartner = parseFloat(String(swapzoneQuote.toAmount));
        } else if (swapzoneQuote.estimatedAmount !== undefined && swapzoneQuote.estimatedAmount !== null) {
          amountOutFromPartner = parseFloat(String(swapzoneQuote.estimatedAmount));
        } else if (swapzoneQuote.amount !== undefined && swapzoneQuote.amount !== null) {
          amountOutFromPartner = parseFloat(String(swapzoneQuote.amount));
        }
        // Nested data fields
        else if (swapzoneQuote.data?.toAmount !== undefined && swapzoneQuote.data?.toAmount !== null) {
          amountOutFromPartner = parseFloat(String(swapzoneQuote.data.toAmount));
        } else if (swapzoneQuote.data?.estimatedAmount !== undefined && swapzoneQuote.data?.estimatedAmount !== null) {
          amountOutFromPartner = parseFloat(String(swapzoneQuote.data.estimatedAmount));
        } else if (swapzoneQuote.data?.amount !== undefined && swapzoneQuote.data?.amount !== null) {
          amountOutFromPartner = parseFloat(String(swapzoneQuote.data.amount));
        }
        // Result field
        else if (swapzoneQuote.result?.toAmount !== undefined && swapzoneQuote.result?.toAmount !== null) {
          amountOutFromPartner = parseFloat(String(swapzoneQuote.result.toAmount));
        } else if (swapzoneQuote.result?.estimatedAmount !== undefined && swapzoneQuote.result?.estimatedAmount !== null) {
          amountOutFromPartner = parseFloat(String(swapzoneQuote.result.estimatedAmount));
        }
      }

      // Validate the parsed amount
      if (amountOutFromPartner === null || isNaN(amountOutFromPartner) || amountOutFromPartner <= 0) {
        console.error("SwapZone API: Invalid or missing amount in response", {
          response: swapzoneQuote,
          from: fromSymbol,
          to: toSymbol,
          amount: amount,
        });
        throw new Error(
          `SwapZone API returned invalid response: ${JSON.stringify(swapzoneQuote)}`
        );
      }

      console.log(`SwapZone quote: ${amount} ${fromSymbol} → ${amountOutFromPartner} ${toSymbol}`);

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
      console.error("SwapZone API failed:", {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status,
        from: fromSymbol,
        to: toSymbol,
        amount: amount,
      });
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
      console.log(`Getting market-based quote for ${from} → ${to}, amount: ${amount}`);
      const prices = await MarketService.getPrices([from, to]);
      const fromPrice = prices[from]?.current_price || 0;
      const toPrice = prices[to]?.current_price || 1;

      console.log(`Market prices: ${from} = $${fromPrice}, ${to} = $${toPrice}`);

      if (!fromPrice || fromPrice <= 0) {
        throw new Error(`Price for ${from} not found or invalid: ${fromPrice}`);
      }

      if (!toPrice || toPrice <= 0) {
        console.warn(`Invalid price for ${to}: ${toPrice}, using 1.0 as fallback`);
      }

      const rate = fromPrice / (toPrice || 1);
      const amountNum = parseFloat(amount);
      
      if (isNaN(amountNum) || amountNum <= 0) {
        throw new Error(`Invalid amount: ${amount}`);
      }

      const platformFee = amountNum * this.PLATFORM_FEE_PERCENT;
      const amountAfterFee = amountNum - platformFee;
      const amountOut = amountAfterFee * rate;

      console.log(`Market quote calculated: ${amount} ${from} → ${amountOut.toFixed(6)} ${to} (rate: ${rate.toFixed(6)})`);

      return {
        fromCurrency: from,
        toCurrency: to,
        amountIn: amount,
        amountOut: amountOut.toFixed(6),
        rate: rate.toFixed(6),
        fee: platformFee.toFixed(6) + " " + from,
        provider: provider,
      };
    } catch (error: any) {
      console.error("Market-based quote failed:", {
        error: error.message,
        from,
        to,
        amount,
        provider,
      });
      // Final fallback: simple calculation without market data
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        throw new Error(`Invalid amount for fallback calculation: ${amount}`);
      }
      const platformFee = amountNum * this.PLATFORM_FEE_PERCENT;
      const fallbackQuote = {
        fromCurrency: from,
        toCurrency: to,
        amountIn: amount,
        amountOut: (amountNum - platformFee).toFixed(6), // Simplified
        rate: "1.0", // Placeholder
        fee: platformFee.toFixed(6) + " " + from,
        provider: provider,
      };
      console.warn("Using final fallback quote (1:1 rate):", fallbackQuote);
      return fallbackQuote;
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
      (this.isHyperEVMToken(quote.fromCurrency) && this.isHyperEVMToken(quote.toCurrency));

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
      // Revenue share goes to platform via hardcoded API key (routes to PLATFORM_REVENUE_ADDRESS)
      const response = await axios.post(
        `${this.SWAPZONE_API}/exchange/create-exchange`,
        {
          from: fromSymbol,
          to: toSymbol,
          address: destinationAddress,
          amount: quote.amountIn,
          flow: "standard",
          apiKey: this.getPlatformApiKey(), // Platform API key - revenue automatically routed to PLATFORM_REVENUE_ADDRESS
        },
        {
          timeout: 15000,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      // Log full response for debugging
      console.log("SwapZone create-exchange response:", JSON.stringify(response.data, null, 2));

      const swapData = response.data;

      // Comprehensive parsing for deposit address - check multiple possible fields
      let depositAddr: string | undefined;
      
      if (swapData) {
        // Direct fields
        if (swapData.depositAddress) {
          depositAddr = String(swapData.depositAddress);
        } else if (swapData.payinAddress) {
          depositAddr = String(swapData.payinAddress);
        } else if (swapData.address) {
          depositAddr = String(swapData.address);
        } else if (swapData.deposit) {
          depositAddr = String(swapData.deposit);
        }
        // Nested fields
        else if (swapData.data?.depositAddress) {
          depositAddr = String(swapData.data.depositAddress);
        } else if (swapData.data?.payinAddress) {
          depositAddr = String(swapData.data.payinAddress);
        } else if (swapData.data?.address) {
          depositAddr = String(swapData.data.address);
        }
        // Result fields
        else if (swapData.result?.depositAddress) {
          depositAddr = String(swapData.result.depositAddress);
        } else if (swapData.result?.payinAddress) {
          depositAddr = String(swapData.result.payinAddress);
        }
      }

      // Get swap ID
      const swapId = swapData.id || swapData.exchangeId || swapData.transactionId || `swap_${Date.now()}`;

      // If no deposit address found, use destination address as fallback
      if (!depositAddr) {
        console.warn("SwapZone API did not return deposit address, using destination address as fallback");
        depositAddr = destinationAddress;
      }

      console.log(`SwapZone swap created: ID=${swapId}, DepositAddress=${depositAddr}`);

      return {
        id: swapId,
        depositAddress: depositAddr,
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
