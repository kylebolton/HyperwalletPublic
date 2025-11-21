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
  // Add more common tokens as they're deployed on HyperEVM
  // USDT: { address: "0x...", symbol: "USDT", name: "Tether USD", decimals: 6 },
  // USDC: { address: "0x...", symbol: "USDC", name: "USD Coin", decimals: 6 },
};

export class TokenService {
  private static readonly HYPEREVM_RPC = "https://eth.llamarpc.com";

  /**
   * Get all tokens for a wallet address on HyperEVM
   */
  static async getHyperEVMTokens(walletAddress: string): Promise<TokenInfo[]> {
    const provider = new ethers.JsonRpcProvider(this.HYPEREVM_RPC);
    const tokens: TokenInfo[] = [];

    // Get native HYPE balance
    try {
      const balance = await provider.getBalance(walletAddress);
      const balanceStr = ethers.formatEther(balance);
      if (parseFloat(balanceStr) > 0) {
        tokens.push({
          address: ethers.ZeroAddress,
          symbol: "HYPE",
          name: "HyperEVM",
          decimals: 18,
          balance: balanceStr,
        });
      }
    } catch (e) {
      console.error("Failed to get native HYPE balance:", e);
    }

    // Check common token contracts
    for (const [symbol, tokenInfo] of Object.entries(COMMON_TOKENS)) {
      if (tokenInfo.address === ethers.ZeroAddress) {
        continue; // Skip native token (already added)
      }

      try {
        const tokenContract = new ethers.Contract(
          tokenInfo.address,
          ERC20_ABI,
          provider
        );

        const [balance, decimals, symbolResult, name] = await Promise.all([
          tokenContract.balanceOf(walletAddress),
          tokenContract.decimals(),
          tokenContract.symbol(),
          tokenContract.name(),
        ]);

        const balanceBigInt = BigInt(balance.toString());
        if (balanceBigInt > 0n) {
          const decimalsNum = Number(decimals);
          const formattedBalance = ethers.formatUnits(balance, decimalsNum);

          tokens.push({
            address: tokenInfo.address,
            symbol: symbolResult || tokenInfo.symbol,
            name: name || tokenInfo.name,
            decimals: decimalsNum,
            balance: formattedBalance,
          });
        }
      } catch (e) {
        // Token contract might not exist or failed to query
        console.warn(`Failed to check token ${symbol}:`, e);
        continue;
      }
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
      throw new Error(`Failed to add token: ${e.message}`);
    }
  }
}
