import { ethers } from "ethers";
import { WalletService } from "./wallet";
import { ChainManager, SupportedChain } from "./chains/manager";

export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  logoURI?: string;
}

// Standard ERC20 ABI for token detection
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
];

// Common HyperEVM token addresses (this would ideally come from a token list or registry)
// Note: Placeholder addresses - these should be updated with actual HyperEVM token addresses when available
const COMMON_TOKENS: Record<
  string,
  { address: string; symbol: string; name: string; decimals: number }
> = {
  HYPE: {
    address: ethers.ZeroAddress, // Native token
    symbol: "HYPE",
    name: "HyperEVM",
    decimals: 18,
  },
  USDT: {
    address: "0x0000000000000000000000000000000000000000", // Placeholder - update with actual address
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
  },
  USDC: {
    address: "0x0000000000000000000000000000000000000000", // Placeholder - update with actual address
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
  },
  DAI: {
    address: "0x0000000000000000000000000000000000000000", // Placeholder - update with actual address
    symbol: "DAI",
    name: "Dai Stablecoin",
    decimals: 18,
  },
  WBTC: {
    address: "0x0000000000000000000000000000000000000000", // Placeholder - update with actual address
    symbol: "WBTC",
    name: "Wrapped Bitcoin",
    decimals: 8,
  },
  WETH: {
    address: "0x0000000000000000000000000000000000000000", // Placeholder - update with actual address
    symbol: "WETH",
    name: "Wrapped Ethereum",
    decimals: 18,
  },
  UNI: {
    address: "0x0000000000000000000000000000000000000000", // Placeholder - update with actual address
    symbol: "UNI",
    name: "Uniswap",
    decimals: 18,
  },
  LINK: {
    address: "0x0000000000000000000000000000000000000000", // Placeholder - update with actual address
    symbol: "LINK",
    name: "Chainlink",
    decimals: 18,
  },
  AAVE: {
    address: "0x0000000000000000000000000000000000000000", // Placeholder - update with actual address
    symbol: "AAVE",
    name: "Aave Token",
    decimals: 18,
  },
  wHYPE: {
    address: "0x0000000000000000000000000000000000000000", // Placeholder - update with actual wHYPE address
    symbol: "wHYPE",
    name: "Wrapped HYPE",
    decimals: 18,
  },
};

export class TokenService {
  private static readonly HYPEREVM_RPC = "https://eth.llamarpc.com";

  /**
   * Get all tokens for a wallet address on HyperEVM
   * @param walletAddress - The wallet address to check
   * @param includeZeroBalance - Whether to include common tokens with zero balance (default: true)
   */
  static async getHyperEVMTokens(
    walletAddress: string,
    includeZeroBalance: boolean = true
  ): Promise<TokenInfo[]> {
    const provider = new ethers.JsonRpcProvider(this.HYPEREVM_RPC);
    const tokens: TokenInfo[] = [];
    const tokensWithBalance = new Set<string>();

    // Get native HYPE balance - always include HYPE even with 0 balance
    try {
      const balance = await provider.getBalance(walletAddress);
      const balanceStr = ethers.formatEther(balance);
      tokens.push({
        address: ethers.ZeroAddress,
        symbol: "HYPE",
        name: "HyperEVM",
        decimals: 18,
        balance: balanceStr,
      });
      if (parseFloat(balanceStr) > 0) {
        tokensWithBalance.add("HYPE");
      }
    } catch (e) {
      console.error("Failed to get native HYPE balance:", e);
      // Always add HYPE with 0 balance as fallback
      tokens.push({
        address: ethers.ZeroAddress,
        symbol: "HYPE",
        name: "HyperEVM",
        decimals: 18,
        balance: "0.00",
      });
    }

    // Check common token contracts
    for (const [symbol, tokenInfo] of Object.entries(COMMON_TOKENS)) {
      if (tokenInfo.address === ethers.ZeroAddress) {
        continue; // Skip native token (already added)
      }

      // For placeholder addresses (all zeros), always add them with 0 balance if includeZeroBalance is true
      if (tokenInfo.address === "0x0000000000000000000000000000000000000000") {
        if (includeZeroBalance) {
          tokens.push({
            address: tokenInfo.address,
            symbol: tokenInfo.symbol,
            name: tokenInfo.name,
            decimals: tokenInfo.decimals,
            balance: "0.00",
          });
        }
        continue;
      }

      try {
        const tokenContract = new ethers.Contract(
          tokenInfo.address,
          ERC20_ABI,
          provider
        );

        // Add timeout to prevent hanging
        const queryPromise = Promise.all([
          tokenContract.balanceOf(walletAddress),
          tokenContract.decimals(),
          tokenContract.symbol(),
          tokenContract.name(),
        ]);

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Token query timeout")), 5000)
        );

        const [balance, decimals, symbolResult, name] = (await Promise.race([
          queryPromise,
          timeoutPromise,
        ])) as [bigint, number, string, string];

        const balanceBigInt = BigInt(balance.toString());
        const decimalsNum = Number(decimals);
        const formattedBalance = ethers.formatUnits(balance, decimalsNum);

        if (balanceBigInt > 0n) {
          tokensWithBalance.add(symbol);
          tokens.push({
            address: tokenInfo.address,
            symbol: symbolResult || tokenInfo.symbol,
            name: name || tokenInfo.name,
            decimals: decimalsNum,
            balance: formattedBalance,
          });
        } else if (includeZeroBalance) {
          // Add token with 0 balance if includeZeroBalance is true
          tokens.push({
            address: tokenInfo.address,
            symbol: symbolResult || tokenInfo.symbol,
            name: name || tokenInfo.name,
            decimals: decimalsNum,
            balance: "0.00",
          });
        }
      } catch (e) {
        // Token contract might not exist or failed to query
        // If includeZeroBalance is true, add it with 0 balance anyway
        if (includeZeroBalance) {
          tokens.push({
            address: tokenInfo.address,
            symbol: tokenInfo.symbol,
            name: tokenInfo.name,
            decimals: tokenInfo.decimals,
            balance: "0.00",
          });
        }
        // Only log warnings for non-placeholder addresses
        if (
          tokenInfo.address !== "0x0000000000000000000000000000000000000000"
        ) {
          console.warn(`Failed to check token ${symbol}:`, e);
        }
      }
    }

    // Always return at least HYPE token
    if (tokens.length === 0) {
      tokens.push({
        address: ethers.ZeroAddress,
        symbol: "HYPE",
        name: "HyperEVM",
        decimals: 18,
        balance: "0.00",
      });
    }

    return tokens;
  }

  /**
   * Add a custom token to track
   */
  static async addCustomToken(
    tokenAddress: string,
    walletAddress: string
  ): Promise<TokenInfo | null> {
    const provider = new ethers.JsonRpcProvider(this.HYPEREVM_RPC);

    try {
      if (!ethers.isAddress(tokenAddress)) {
        throw new Error("Invalid token address");
      }

      const tokenContract = new ethers.Contract(
        tokenAddress,
        ERC20_ABI,
        provider
      );

      const [balance, decimals, symbol, name] = await Promise.all([
        tokenContract.balanceOf(walletAddress),
        tokenContract.decimals(),
        tokenContract.symbol(),
        tokenContract.name(),
      ]);

      const balanceBigInt = BigInt(balance.toString());
      const decimalsNum = Number(decimals);
      const formattedBalance = ethers.formatUnits(balance, decimalsNum);

      return {
        address: tokenAddress,
        symbol,
        name,
        decimals: decimalsNum,
        balance: formattedBalance,
      };
    } catch (e: any) {
      console.error("Failed to add custom token:", e);
      return null;
    }
  }
}
