import { ethers } from "ethers";
import { MarketService } from "./market";
import { TokenService, type TokenInfo } from "./tokens";

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
  // NOTE: This is the platform revenue address that should receive builder fees
  // The builder code mechanism needs to be implemented in executeSwap() to actually collect fees
  private static readonly BUILDER_CODE =
    "0x0e7FCDC85f296004Bc235cc86cfA69da2c39324a"; // Platform revenue address as builder code

  // Builder fee percentage (1%)
  private static readonly BUILDER_FEE_PERCENT = 0.01;

  // HyperEVM RPC endpoint (fallback, should use NetworkService in production)
  private static readonly HYPEREVM_RPC = "https://rpc.hyperliquid.xyz/evm";

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
   * @param fromToken - Token symbol to swap from
   * @param toToken - Token symbol to swap to
   * @param amountIn - Amount to swap
   * @param walletAddress - Optional wallet address for token discovery
   * @param fromTokenAddress - Optional token address (if provided, will be used instead of lookup)
   * @param toTokenAddress - Optional token address (if provided, will be used instead of lookup)
   */
  static async getQuote(
    fromToken: string,
    toToken: string,
    amountIn: string,
    walletAddress?: string,
    fromTokenAddress?: string,
    toTokenAddress?: string
  ): Promise<HyperSwapQuote> {
    try {
      // Get token addresses - use provided addresses first, then try to look them up
      let fromAddr = fromTokenAddress;
      let toAddr = toTokenAddress;

      if (!fromAddr) {
        fromAddr = await this.getTokenAddress(fromToken, walletAddress);
      }
      if (!toAddr) {
        toAddr = await this.getTokenAddress(toToken, walletAddress);
      }

      console.log(`HyperSwap quote request: ${fromToken} (${fromAddr}) → ${toToken} (${toAddr})`);

      if (!fromAddr || !toAddr) {
        console.warn(
          `HyperSwap: Token addresses not found for ${fromToken} (${fromAddr}) or ${toToken} (${toAddr}), using market quote`
        );
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
        // Get token decimals for proper amount calculation
        const fromDecimals = await this.getTokenDecimals(fromAddr, provider);
        const toDecimals = await this.getTokenDecimals(toAddr, provider);
        
        const amountInWei = ethers.parseUnits(amountIn, fromDecimals);
        const path = [fromAddr, toAddr];

        // Get quote (this will fail if router address is placeholder)
        const amounts = await router.getAmountsOut(amountInWei, path);
        const amountOutWei = amounts[amounts.length - 1];
        const amountOut = ethers.formatUnits(amountOutWei, toDecimals);

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
      } catch (contractError: any) {
        // If contract call fails, fall back to market-based quote
        console.warn(
          "HyperSwap contract call failed, using market quote:",
          contractError?.message || contractError
        );
        return await this.getMarketBasedQuote(fromToken, toToken, amountIn);
      }
    } catch (error: any) {
      console.error("HyperSwap quote error:", error?.message || error);
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

      // Try to get token addresses from quote path if available
      let fromTokenAddress = quote.path?.[0];
      let toTokenAddress = quote.path?.[quote.path.length - 1];
      
      // Fallback to lookup if not in path
      if (!fromTokenAddress) {
        fromTokenAddress = await this.getTokenAddress(quote.fromCurrency, await signer.getAddress());
      }
      if (!toTokenAddress) {
        toTokenAddress = await this.getTokenAddress(quote.toCurrency, await signer.getAddress());
      }

      if (!fromTokenAddress || !toTokenAddress) {
        throw new Error(`Token addresses not found: ${quote.fromCurrency} (${fromTokenAddress}) or ${quote.toCurrency} (${toTokenAddress})`);
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
      // TODO: Implement builder code parameter to route 1% builder fee to BUILDER_CODE address
      // Currently, builder code is not passed to the router contract - fees may not be collected
      // Builder code mechanism depends on HyperSwap's contract implementation
      // The builder fee (1%) should be automatically routed to BUILDER_CODE during swap execution
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
   * First checks if it's a native token (HYPE), then tries to get from TokenService,
   * finally falls back to placeholder map
   */
  private static async getTokenAddress(
    symbol: string,
    walletAddress?: string
  ): Promise<string | null> {
    const upperSymbol = symbol.toUpperCase();

    // Native token (HYPE) is always ZeroAddress
    if (upperSymbol === "HYPE" || upperSymbol === "ETH") {
      return ethers.ZeroAddress;
    }

    // Try to get from TokenService if wallet address is provided
    if (walletAddress) {
      try {
        const tokens = await TokenService.getHyperEVMTokens(walletAddress, true);
        const token = tokens.find((t) => t.symbol.toUpperCase() === upperSymbol);
        if (token && token.address !== "0x0000000000000000000000000000000000000000") {
          console.log(`Found token address for ${symbol}: ${token.address}`);
          return token.address;
        }
      } catch (error) {
        console.warn(`Failed to get token address from TokenService for ${symbol}:`, error);
      }
    }

    // Fallback to placeholder map (last resort)
    const tokenMap: Record<string, string> = {
      HYPE: ethers.ZeroAddress, // Native token
      ETH: ethers.ZeroAddress, // Native token
      USDT: "0x0000000000000000000000000000000000000000", // Placeholder
      USDC: "0x0000000000000000000000000000000000000000", // Placeholder
    };

    const address = tokenMap[upperSymbol];
    if (address && address !== "0x0000000000000000000000000000000000000000") {
      return address;
    }

    return null;
  }

  /**
   * Get token decimals from on-chain contract
   */
  private static async getTokenDecimals(
    tokenAddress: string,
    provider: ethers.JsonRpcProvider
  ): Promise<number> {
    // Native token has 18 decimals
    if (tokenAddress === ethers.ZeroAddress) {
      return 18;
    }

    try {
      const tokenContract = new ethers.Contract(
        tokenAddress,
        this.ERC20_ABI,
        provider
      );
      const decimals = await tokenContract.decimals();
      return Number(decimals);
    } catch (error) {
      console.warn(`Failed to get decimals for token ${tokenAddress}, defaulting to 18`);
      return 18; // Default to 18 decimals
    }
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
      } catch (error: any) {
      console.error(`Market-based quote failed for ${fromToken} → ${toToken}:`, error?.message || error);
      // Final fallback - use 1:1 rate with builder fee
      const amountNum = parseFloat(amountIn);
      if (isNaN(amountNum) || amountNum <= 0) {
        throw new Error(`Invalid amount: ${amountIn}`);
      }
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
















