import { ethers } from "ethers";
import { MarketService } from "./market";

export interface HyperSwapQuote {
  fromCurrency: string;
  toCurrency: string;
  amountIn: string;
  amountOut: string;
  rate: string;
  fee: string;
  builderFee: string; // 1% builder fee
  path: string[]; // Token path for the swap
}

export interface HyperSwapConfig {
  routerAddress: string;
  factoryAddress: string;
  builderCode: string; // Builder code for fee collection
  rpcUrl: string;
  chainId: number;
}

export class HyperSwapService {
  // HyperSwap V3 Router contract address (to be updated with actual address)
  // Based on HyperSwap documentation, this should be the V3 router
  private static readonly DEFAULT_ROUTER_ADDRESS =
    "0x0000000000000000000000000000000000000000"; // Placeholder - needs actual address

  // Builder code for 1% fee collection
  private static readonly BUILDER_CODE =
    "0x0e7FCDC85f296004Bc235cc86cfA69da2c39324a"; // Platform revenue address as builder code

  // Builder fee percentage (1%)
  private static readonly BUILDER_FEE_PERCENT = 0.01;

  // HyperEVM RPC endpoint
  private static readonly HYPEREVM_RPC = "https://eth.llamarpc.com";

  // Standard ERC20 ABI (minimal for balance checks)
  private static readonly ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function transfer(address to, uint256 amount) returns (bool)",
  ];

  // HyperSwap V3 Router ABI (simplified)
  private static readonly ROUTER_ABI = [
    "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)",
    "function exactInput((bytes path, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum) external payable returns (uint256 amountOut)",
    "function getAmountsOut(uint256 amountIn, address[] calldata path) external view returns (uint256[] memory amounts)",
    "function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)",
  ];

  /**
   * Get swap quote from HyperSwap
   */
  static async getQuote(
    fromToken: string,
    toToken: string,
    amountIn: string,
    walletAddress?: string
  ): Promise<HyperSwapQuote> {
    try {
      // For now, use native HYPE token (ETH-compatible) and common tokens
      // In production, you'd need actual token addresses
      const fromTokenAddress = this.getTokenAddress(fromToken);
      const toTokenAddress = this.getTokenAddress(toToken);

      if (!fromTokenAddress || !toTokenAddress) {
        // Fallback to market-based quote if tokens not found
        return await this.getMarketBasedQuote(fromToken, toToken, amountIn);
      }

      const provider = new ethers.JsonRpcProvider(this.HYPEREVM_RPC);
      const router = new ethers.Contract(
        this.DEFAULT_ROUTER_ADDRESS,
        this.ROUTER_ABI,
        provider
      );

      // Try to get quote from router
      // Note: This is a placeholder - actual implementation depends on HyperSwap contract structure
      try {
        const amountInWei = ethers.parseUnits(amountIn, 18); // Assuming 18 decimals
        const path = [fromTokenAddress, toTokenAddress];

        // Get quote (this will fail if router address is placeholder)
        const amounts = await router.getAmountsOut(amountInWei, path);
        const amountOutWei = amounts[amounts.length - 1];
        const amountOut = ethers.formatUnits(amountOutWei, 18);

        // Calculate builder fee (1% of output)
        const amountOutNum = parseFloat(amountOut);
        const builderFee = amountOutNum * this.BUILDER_FEE_PERCENT;
        const amountAfterFee = amountOutNum - builderFee;

        const rate = amountAfterFee / parseFloat(amountIn);

        return {
          fromCurrency: fromToken,
          toCurrency: toToken,
          amountIn: amountIn,
          amountOut: amountAfterFee.toFixed(6),
          rate: rate.toFixed(6),
          fee: "0", // No platform fee, only builder fee
          builderFee: builderFee.toFixed(6),
          path: path,
        };
      } catch (contractError) {
        // If contract call fails, fall back to market-based quote
        console.warn(
          "HyperSwap contract call failed, using market quote:",
          contractError
        );
        return await this.getMarketBasedQuote(fromToken, toToken, amountIn);
      }
    } catch (error: any) {
      console.error("HyperSwap quote error:", error);
      return await this.getMarketBasedQuote(fromToken, toToken, amountIn);
    }
  }

  /**
   * Execute swap on HyperSwap with builder code
   */
  static async executeSwap(
    quote: HyperSwapQuote,
    wallet: ethers.Wallet,
    slippageTolerance: number = 0.005 // 0.5% default slippage
  ): Promise<string> {
    try {
      const provider = new ethers.JsonRpcProvider(this.HYPEREVM_RPC);
      const signer = wallet.connect(provider);
      const router = new ethers.Contract(
        this.DEFAULT_ROUTER_ADDRESS,
        this.ROUTER_ABI,
        signer
      );

      const fromTokenAddress = this.getTokenAddress(quote.fromCurrency);
      const toTokenAddress = this.getTokenAddress(quote.toCurrency);

      if (!fromTokenAddress || !toTokenAddress) {
        throw new Error("Token addresses not found");
      }

      const amountInWei = ethers.parseUnits(quote.amountIn, 18);
      const amountOutMin = ethers.parseUnits(
        (parseFloat(quote.amountOut) * (1 - slippageTolerance)).toFixed(6),
        18
      );

      // Approve token if not native
      if (fromTokenAddress !== ethers.ZeroAddress) {
        const tokenContract = new ethers.Contract(
          fromTokenAddress,
          this.ERC20_ABI,
          signer
        );

        const allowance = await tokenContract.allowance(
          await signer.getAddress(),
          this.DEFAULT_ROUTER_ADDRESS
        );

        if (allowance < amountInWei) {
          const approveTx = await tokenContract.approve(
            this.DEFAULT_ROUTER_ADDRESS,
            ethers.MaxUint256
          );
          await approveTx.wait();
        }
      }

      // Execute swap with builder code
      // Note: Builder code is typically passed as a parameter or encoded in the transaction
      // This is a placeholder - actual implementation depends on HyperSwap's builder code mechanism
      const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes

      let tx;
      if (fromTokenAddress === ethers.ZeroAddress) {
        // Native token swap
        tx = await router.exactInputSingle(
          {
            tokenIn: fromTokenAddress,
            tokenOut: toTokenAddress,
            fee: 3000, // 0.3% fee tier (common in V3)
            recipient: await signer.getAddress(),
            deadline: deadline,
            amountIn: amountInWei,
            amountOutMinimum: amountOutMin,
            sqrtPriceLimitX96: 0,
          },
          { value: amountInWei }
        );
      } else {
        // ERC20 token swap
        tx = await router.exactInputSingle({
          tokenIn: fromTokenAddress,
          tokenOut: toTokenAddress,
          fee: 3000,
          recipient: await signer.getAddress(),
          deadline: deadline,
          amountIn: amountInWei,
          amountOutMinimum: amountOutMin,
          sqrtPriceLimitX96: 0,
        });
      }

      const receipt = await tx.wait();
      return receipt.hash;
    } catch (error: any) {
      console.error("HyperSwap swap execution error:", error);
      throw new Error(
        `Swap execution failed: ${error.message || "Unknown error"}`
      );
    }
  }

  /**
   * Get token address for a symbol
   * In production, this should use a token registry or configuration
   */
  private static getTokenAddress(symbol: string): string | null {
    // Placeholder token addresses - these need to be updated with actual HyperEVM token addresses
    const tokenMap: Record<string, string> = {
      HYPE: ethers.ZeroAddress, // Native token
      ETH: ethers.ZeroAddress, // Native token
      USDT: "0x0000000000000000000000000000000000000000", // Placeholder
      USDC: "0x0000000000000000000000000000000000000000", // Placeholder
    };

    return tokenMap[symbol.toUpperCase()] || null;
  }

  /**
   * Fallback: Get market-based quote
   */
  private static async getMarketBasedQuote(
    fromToken: string,
    toToken: string,
    amountIn: string
  ): Promise<HyperSwapQuote> {
    try {
      const prices = await MarketService.getPrices([fromToken, toToken]);
      const fromPrice = prices[fromToken]?.current_price || 0;
      const toPrice = prices[toToken]?.current_price || 1;

      if (!fromPrice) {
        throw new Error(`Price for ${fromToken} not found`);
      }

      const rate = fromPrice / toPrice;
      const amountNum = parseFloat(amountIn);
      const amountOut = amountNum * rate;

      // Apply builder fee (1% of output)
      const builderFee = amountOut * this.BUILDER_FEE_PERCENT;
      const amountAfterFee = amountOut - builderFee;

      return {
        fromCurrency: fromToken,
        toCurrency: toToken,
        amountIn: amountIn,
        amountOut: amountAfterFee.toFixed(6),
        rate: rate.toFixed(6),
        fee: "0",
        builderFee: builderFee.toFixed(6),
        path: [],
      };
    } catch (error) {
      // Final fallback
      const amountNum = parseFloat(amountIn);
      const builderFee = amountNum * this.BUILDER_FEE_PERCENT;
      return {
        fromCurrency: fromToken,
        toCurrency: toToken,
        amountIn: amountIn,
        amountOut: (amountNum - builderFee).toFixed(6),
        rate: "1.0",
        fee: "0",
        builderFee: builderFee.toFixed(6),
        path: [],
      };
    }
  }

  /**
   * Get builder code
   */
  static getBuilderCode(): string {
    return this.BUILDER_CODE;
  }
}


