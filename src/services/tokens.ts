import { ethers } from "ethers";
import { WalletService } from "./wallet";
import { ChainManager, SupportedChain } from "./chains/manager";
import { NetworkService } from "./networks";

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

// ERC20 Transfer event signature for event scanning
const TRANSFER_EVENT_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

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
  private static readonly TOKEN_REGISTRY_URL = "https://tokens.coingecko.com/ethereum/all.json";
  private static readonly MAX_BLOCKS_TO_SCAN = 50000; // Scan last 50k blocks for Transfer events

  /**
   * Scan Transfer events to discover tokens with balance > 0
   */
  private static async scanTransferEvents(
    provider: ethers.JsonRpcProvider,
    walletAddress: string
  ): Promise<Set<string>> {
    const discoveredTokens = new Set<string>();
    
    try {
      // Get current block number
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - this.MAX_BLOCKS_TO_SCAN);
      
      // Create filter for Transfer events where 'to' is the wallet address
      const filter = {
        fromBlock,
        toBlock: currentBlock,
        topics: [
          TRANSFER_EVENT_TOPIC,
          null, // from address (any)
          ethers.zeroPadValue(walletAddress, 32), // to address (our wallet)
        ],
      };
      
      // Query logs with increased timeout for better discovery
      const logsPromise = provider.getLogs(filter);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Event scan timeout")), 30000)
      );
      
      const logs = await Promise.race([logsPromise, timeoutPromise]);
      
      // Extract unique token addresses from logs
      for (const log of logs) {
        if (log.address && ethers.isAddress(log.address)) {
          discoveredTokens.add(log.address.toLowerCase());
        }
      }
      
      // Also check Transfer events where 'from' is the wallet address (for outgoing transfers)
      const filterFrom = {
        fromBlock,
        toBlock: currentBlock,
        topics: [
          TRANSFER_EVENT_TOPIC,
          ethers.zeroPadValue(walletAddress, 32), // from address (our wallet)
          null, // to address (any)
        ],
      };
      
      const logsFromPromise = provider.getLogs(filterFrom);
      const logsFromTimeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Event scan timeout")), 30000)
      );
      const logsFrom = await Promise.race([logsFromPromise, logsFromTimeoutPromise]).catch(() => []);
      
      for (const log of logsFrom) {
        if (log.address && ethers.isAddress(log.address)) {
          discoveredTokens.add(log.address.toLowerCase());
        }
      }
    } catch (e) {
      console.warn("Failed to scan Transfer events for token discovery:", e);
      // Continue without event scanning - not critical
    }
    
    return discoveredTokens;
  }

  /**
   * Fetch token metadata from registry (deprecated - HyperEVM doesn't have a public token registry)
   * This method is kept for potential future use but returns empty map
   * We rely on on-chain queries for token metadata instead
   */
  private static async fetchTokenRegistry(): Promise<Map<string, { symbol: string; name: string; decimals: number; logoURI?: string }>> {
    // HyperEVM doesn't have a public token registry like Ethereum
    // We rely on on-chain queries for token metadata
    return new Map();
  }

  /**
   * Get token info for a discovered address
   */
  private static async getTokenInfo(
    provider: ethers.JsonRpcProvider,
    tokenAddress: string,
    walletAddress: string,
    registryMetadata?: { symbol: string; name: string; decimals: number; logoURI?: string }
  ): Promise<TokenInfo | null> {
    try {
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
      
      // Query with timeout
      const queryPromise = Promise.all([
        tokenContract.balanceOf(walletAddress),
        tokenContract.decimals().catch(() => registryMetadata?.decimals || 18),
        tokenContract.symbol().catch(() => registryMetadata?.symbol || "UNKNOWN"),
        tokenContract.name().catch(() => registryMetadata?.name || "Unknown Token"),
      ]);
      
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Token query timeout")), 5000)
      );
      
      const [balance, decimals, symbol, name] = (await Promise.race([
        queryPromise,
        timeoutPromise,
      ])) as [bigint, number, string, string];
      
      const balanceBigInt = BigInt(balance.toString());
      const decimalsNum = Number(decimals);
      const formattedBalance = ethers.formatUnits(balance, decimalsNum);
      
      // Only return tokens with balance > 0
      if (balanceBigInt > 0n) {
        return {
          address: tokenAddress,
          symbol: symbol || registryMetadata?.symbol || "UNKNOWN",
          name: name || registryMetadata?.name || "Unknown Token",
          decimals: decimalsNum,
          balance: formattedBalance,
          logoURI: registryMetadata?.logoURI,
        };
      }
    } catch (e) {
      // Token might not be ERC20 compliant or query failed
      console.warn(`Failed to get info for token ${tokenAddress}:`, e);
    }
    
    return null;
  }

  /**
   * Get all tokens for a wallet address on HyperEVM
   * @param walletAddress - The wallet address to check
   * @param includeZeroBalance - Whether to include common tokens with zero balance (default: true)
   */
  static async getHyperEVMTokens(
    walletAddress: string,
    includeZeroBalance: boolean = true
  ): Promise<TokenInfo[]> {
    // Get RPC URL from network config
    const hyperEVMConfig = NetworkService.getNetworkConfig(SupportedChain.HYPEREVM);
    const rpcUrl = hyperEVMConfig?.rpcUrl || "https://rpc.hyperliquid.xyz/evm";
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const tokens: TokenInfo[] = [];
    const processedAddresses = new Set<string>();
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
      processedAddresses.add(ethers.ZeroAddress.toLowerCase());
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
      processedAddresses.add(ethers.ZeroAddress.toLowerCase());
    }

    // Fetch token registry in parallel with event scanning
    const [discoveredTokenAddresses, tokenRegistry] = await Promise.all([
      this.scanTransferEvents(provider, walletAddress),
      this.fetchTokenRegistry(),
    ]);

    // Process discovered tokens from event scanning
    const discoveredTokenPromises = Array.from(discoveredTokenAddresses)
      .filter(addr => !processedAddresses.has(addr.toLowerCase()))
      .map(async (tokenAddress) => {
        const registryMetadata = tokenRegistry.get(tokenAddress.toLowerCase());
        const tokenInfo = await this.getTokenInfo(provider, tokenAddress, walletAddress, registryMetadata);
        if (tokenInfo) {
          processedAddresses.add(tokenAddress.toLowerCase());
          return tokenInfo;
        }
        return null;
      });

    const discoveredTokens = (await Promise.all(discoveredTokenPromises)).filter(
      (token): token is TokenInfo => token !== null
    );
    tokens.push(...discoveredTokens);

    // Check common token contracts (for tokens that might not have Transfer events)
    for (const [symbol, tokenInfo] of Object.entries(COMMON_TOKENS)) {
      if (tokenInfo.address === ethers.ZeroAddress) {
        continue; // Skip native token (already added)
      }

      const tokenAddressLower = tokenInfo.address.toLowerCase();
      if (processedAddresses.has(tokenAddressLower)) {
        continue; // Already processed
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
          processedAddresses.add(tokenAddressLower);
        }
        continue;
      }

      try {
        const registryMetadata = tokenRegistry.get(tokenAddressLower);
        const tokenContract = new ethers.Contract(
          tokenInfo.address,
          ERC20_ABI,
          provider
        );

        // Add timeout to prevent hanging
        const queryPromise = Promise.all([
          tokenContract.balanceOf(walletAddress),
          tokenContract.decimals().catch(() => registryMetadata?.decimals || tokenInfo.decimals),
          tokenContract.symbol().catch(() => registryMetadata?.symbol || tokenInfo.symbol),
          tokenContract.name().catch(() => registryMetadata?.name || tokenInfo.name),
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
            logoURI: registryMetadata?.logoURI,
          });
          processedAddresses.add(tokenAddressLower);
        } else if (includeZeroBalance) {
          // Add token with 0 balance if includeZeroBalance is true
          tokens.push({
            address: tokenInfo.address,
            symbol: symbolResult || tokenInfo.symbol,
            name: name || tokenInfo.name,
            decimals: decimalsNum,
            balance: "0.00",
            logoURI: registryMetadata?.logoURI,
          });
          processedAddresses.add(tokenAddressLower);
        }
      } catch (e) {
        // Token contract might not exist or failed to query
        // If includeZeroBalance is true, add it with 0 balance anyway
        if (includeZeroBalance) {
          const registryMetadata = tokenRegistry.get(tokenAddressLower);
          tokens.push({
            address: tokenInfo.address,
            symbol: registryMetadata?.symbol || tokenInfo.symbol,
            name: registryMetadata?.name || tokenInfo.name,
            decimals: registryMetadata?.decimals || tokenInfo.decimals,
            balance: "0.00",
            logoURI: registryMetadata?.logoURI,
          });
          processedAddresses.add(tokenAddressLower);
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
    // Get RPC URL from network config
    const hyperEVMConfig = NetworkService.getNetworkConfig(SupportedChain.HYPEREVM);
    const rpcUrl = hyperEVMConfig?.rpcUrl || "https://rpc.hyperliquid.xyz/evm";
    const provider = new ethers.JsonRpcProvider(rpcUrl);

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
