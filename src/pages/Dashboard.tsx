import React, { useEffect, useState, useCallback } from "react";
import { ChainManager, SupportedChain } from "../services/chains/manager";
import { StorageService } from "../services/storage";
import { WalletService } from "../services/wallet";
import { NetworkService } from "../services/networks";
import { TokenService, type TokenInfo } from "../services/tokens";
import { MarketService, type MarketData } from "../services/market";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowUpRight,
  ArrowDownLeft,
  ChevronDown,
  ChevronUp,
  Shield,
  RefreshCw,
  Wallet as WalletIcon,
  AlertCircle,
} from "lucide-react";
import ReceiveModal from "../components/ReceiveModal";
import SendModal from "../components/SendModal";
import AssetLogo from "../components/AssetLogo";
import { usePreviewMode } from "../contexts/PreviewModeContext";
import { PreviewDataService } from "../services/previewData";

interface Asset {
  symbol: string;
  name: string;
  color: string;
  chainKey: SupportedChain;
}

interface AssetCardProps {
  asset: Asset;
  balance: string | undefined;
  address: string | undefined;
  isLoading: boolean;
  onSend: () => void;
  onReceive: () => void;
  animationIndex: number;
  isPrivacyCoin?: boolean;
  hasShieldSwap?: boolean; // For ZEC only
  marketData?: Record<string, MarketData>;
}

function AssetCard({
  asset,
  balance,
  address,
  isLoading,
  onSend,
  onReceive,
  animationIndex,
  isPrivacyCoin = false,
  hasShieldSwap = false,
  marketData,
}: AssetCardProps) {
  // Calculate USD value
  const usdValue = React.useMemo(() => {
    if (isLoading || !marketData) return null;
    if (!balance || balance === "Error" || balance === "N/A") return 0;

    const balanceNum = parseFloat(balance);
    if (isNaN(balanceNum) || balanceNum === 0) return 0;

    // Try asset.symbol first, then fallback to common aliases
    const price =
      marketData[asset.symbol]?.current_price ||
      marketData[asset.symbol === "HYPEREVM" ? "HYPE" : asset.symbol]
        ?.current_price ||
      0;

    if (!price || price === 0) return null;

    return balanceNum * price;
  }, [balance, marketData, asset.symbol, isLoading]);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: animationIndex * 0.05 }}
      className="flex items-center justify-between p-4 transition-all duration-200 group hover:bg-[var(--hover-bg)]"
    >
      <div className="flex items-center gap-4 min-w-[200px] flex-shrink-0">
        <AssetLogo symbol={asset.symbol} size={48} />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <div className="font-bold text-lg">{asset.name}</div>
            {isPrivacyCoin && (
              <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 dark:text-purple-300 text-xs font-bold rounded-full border border-purple-500/30">
                PRIVACY
              </span>
            )}
            {hasShieldSwap && (
              <span className="px-2 py-0.5 bg-hyper-green/20 text-hyper-green text-xs font-bold rounded-full border border-hyper-green/30 flex items-center gap-1">
                <Shield size={12} />
                SHIELD SWAP
              </span>
            )}
          </div>
          <div className="text-[var(--text-secondary)] text-sm font-mono">
            {asset.symbol}
          </div>
        </div>
      </div>

      <div className="text-center min-w-[150px] flex-1">
        <div className="text-2xl font-bold tracking-tight">
          {isLoading ? (
            <div className="h-8 w-24 bg-[var(--bg-tertiary)] rounded animate-pulse mx-auto"></div>
          ) : (
            balance || "0.00"
          )}
        </div>
      </div>

      <div className="text-right min-w-[120px] flex-shrink-0">
        <div className="text-xs text-[var(--text-secondary)]">
          {isLoading ? (
            <div className="h-4 w-16 bg-[var(--bg-tertiary)] rounded animate-pulse"></div>
          ) : usdValue !== null ? (
            `≈ $${usdValue.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })} USD`
          ) : (
            "≈ $0.00 USD"
          )}
        </div>
      </div>

      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0">
        <button
          onClick={onSend}
          disabled={balance === "Error" || parseFloat(balance || "0") === 0}
          className="p-3 bg-[var(--bg-tertiary)] rounded-xl hover:bg-[var(--text-primary)] hover:text-[var(--bg-primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Send"
        >
          <ArrowUpRight size={20} />
        </button>
        <button
          onClick={onReceive}
          disabled={balance === "N/A" || balance === "Error"}
          className="p-3 bg-[var(--bg-tertiary)] rounded-xl hover:bg-[var(--text-primary)] hover:text-[var(--bg-primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Receive"
        >
          <ArrowDownLeft size={20} />
        </button>
      </div>
    </motion.div>
  );
}

export default function Dashboard() {
  const { isPreviewMode } = usePreviewMode();
  const [balances, setBalances] = useState<Record<string, string>>({});
  const [addresses, setAddresses] = useState<Record<string, string>>({});
  const [hyperEVMTokens, setHyperEVMTokens] = useState<TokenInfo[]>([]);
  const [loadingAssets, setLoadingAssets] = useState<Set<string>>(new Set());
  const [isHyperEVMExpanded, setIsHyperEVMExpanded] = useState(true);
  const [totalBalance, setTotalBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [marketData, setMarketData] = useState<Record<string, MarketData>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Calculate total balance in USD
  const calculateTotalBalance = useCallback(
    async (balanceData: Record<string, string>) => {
      try {
        setLoadingBalance(true);

        // Get all unique symbols from balances
        const symbols = Object.keys(balanceData).filter(
          symbol =>
            balanceData[symbol] &&
            balanceData[symbol] !== "Error" &&
            balanceData[symbol] !== "N/A"
        );

        if (symbols.length === 0) {
          setTotalBalance(0);
          setLoadingBalance(false);
          return;
        }

        // Fetch prices for all symbols
        const prices = await MarketService.getPrices(symbols);

        // Calculate total
        let total = 0;
        for (const symbol of symbols) {
          const balanceStr = balanceData[symbol];
          if (balanceStr && balanceStr !== "Error" && balanceStr !== "N/A") {
            const balance = parseFloat(balanceStr);
            const price = prices[symbol]?.current_price || 0;
            if (!isNaN(balance) && !isNaN(price)) {
              total += balance * price;
            }
          }
        }

        setTotalBalance(total);
      } catch (e) {
        console.error("Failed to calculate total balance:", e);
        setTotalBalance(null);
      } finally {
        setLoadingBalance(false);
      }
    },
    []
  );

  const [receiveModal, setReceiveModal] = useState<{
    isOpen: boolean;
    symbol: string;
    address: string;
    loading: boolean;
  }>({
    isOpen: false,
    symbol: "",
    address: "",
    loading: false,
  });
  const [sendModal, setSendModal] = useState<{
    isOpen: boolean;
    symbol: string;
    chainKey: string;
  }>({
    isOpen: false,
    symbol: "",
    chainKey: "",
  });

  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    const loadData = async () => {
      // If preview mode is enabled, use mock data
      if (isPreviewMode) {
        const mockBalances = PreviewDataService.getMockBalances();
        const mockAddresses = PreviewDataService.getMockAddresses();
        const mockTokens = PreviewDataService.getMockHyperEVMTokens();

        setBalances(mockBalances);
        setAddresses(mockAddresses);
        setHyperEVMTokens(mockTokens);
        setLoadingAssets(new Set());

        // Get mock market data for USD calculations
        const mockMarketData = PreviewDataService.getMockMarketData();
        setMarketData(mockMarketData);

        // Calculate total balance with mock data
        let total = 0;
        for (const [symbol, balance] of Object.entries(mockBalances)) {
          const price = mockMarketData[symbol]?.current_price || 0;
          total += parseFloat(balance) * price;
        }
        setTotalBalance(total);
        setLoadingBalance(false);
        return;
      }

      try {
        const activeWallet = WalletService.getActiveWallet();

        if (!activeWallet) {
          if (isMounted) setLoadingAssets(new Set());
          return;
        }

        // Use active wallet's mnemonic and private key
        const mnemonic = activeWallet.mnemonic;
        const privKey = activeWallet.privateKey;

        // Support all-in-one wallet: use private key for EVM, mnemonic for non-EVM
        // Need at least one of them
        if (!mnemonic && !privKey) {
          if (isMounted) setLoadingAssets(new Set());
          return;
        }

        // Get enabled network configs
        const enabledNetworks = NetworkService.getEnabledNetworks();

        // Create manager with both secrets if available
        const manager = new ChainManager(
          privKey || undefined, // EVM secret (prefer private key)
          !!privKey, // Is private key
          mnemonic || undefined, // Non-EVM secret (mnemonic)
          enabledNetworks // Network configurations
        );
        const services = manager.getAllServices();

        const newBalances: Record<string, string> = {};
        const newAddresses: Record<string, string> = {};

        // Initialize loading state for all services
        const initialLoadingAssets = new Set(services.map(s => s.symbol));
        if (isMounted) setLoadingAssets(initialLoadingAssets);

        // Add timeout to prevent hanging
        const loadPromise = Promise.all(
          services.map(async service => {
            try {
              // Initialize wallet if it has an init method (e.g., Monero)
              if ("init" in service && typeof service.init === "function") {
                try {
                  // For Monero, give much more time (90 seconds) due to remote node connections
                  // For other services, use 30 seconds
                  const initTimeout = service.symbol === "XMR" ? 90000 : 30000;
                  
                  await Promise.race([
                    service.init(),
                    new Promise((_, reject) =>
                      setTimeout(() => reject(new Error("Init timeout")), initTimeout)
                    ),
                  ]);
                } catch (initError: any) {
                  // For Monero, log more details and allow retry
                  if (service.symbol === "XMR") {
                    console.error(`Monero initialization failed:`, initError);
                    // Don't continue if it's a critical error (library not available)
                    if (initError.message?.includes("not available") || initError.message?.includes("Cannot find module")) {
                      throw initError;
                    }
                    // For other errors (node connection issues), continue and try to get address anyway
                    console.warn(`Monero init failed but continuing: ${initError.message}`);
                  } else {
                    // Suppress warning for other services - they can still work without init
                    console.warn(`Init failed for ${service.symbol}, continuing anyway:`, initError.message);
                  }
                }
              }

              // Fetch address first - this will validate the address
              // For Monero, use longer timeout and retry logic
              let addr: string;
              
              if (service.symbol === "XMR") {
                // Monero-specific handling with retries
                let retries = 0;
                const maxRetries = 3;
                const addressTimeout = 20000; // 20 seconds per attempt
                
                while (retries < maxRetries) {
                  try {
                    addr = await Promise.race([
                      service.getAddress(),
                      new Promise<string>((_, reject) =>
                        setTimeout(() => reject(new Error("Address timeout")), addressTimeout)
                      ),
                    ]);
                    
                    // Check if address is valid
                    if (addr && addr !== "Address Error" && !addr.includes("Address Error:")) {
                      break; // Success
                    }
                    
                    // If address is still invalid, wait and retry
                    if (retries < maxRetries - 1) {
                      console.log(`Monero address invalid, retrying... (attempt ${retries + 1}/${maxRetries})`);
                      await new Promise(resolve => setTimeout(resolve, 3000));
                    }
                    retries++;
                  } catch (addrError: any) {
                    console.warn(`Monero address retrieval attempt ${retries + 1} failed:`, addrError.message);
                    if (retries < maxRetries - 1) {
                      await new Promise(resolve => setTimeout(resolve, 3000));
                    }
                    retries++;
                    if (retries >= maxRetries) {
                      addr = "Address Error";
                    }
                  }
                }
                
                // Final check
                if (!addr || addr === "Address Error" || addr.includes("Address Error:")) {
                  addr = "Address Error";
                }
              } else {
                // For other services, use standard timeout
                try {
                  addr = await Promise.race([
                    service.getAddress(),
                    new Promise<string>((_, reject) =>
                      setTimeout(() => reject(new Error("Address timeout")), 15000)
                    ),
                  ]);
                } catch {
                  // Fallback to regular call without timeout
                  addr = await service.getAddress();
                }
                
                // If address is still invalid and service has init, retry once
                if ((!addr || addr === "Address Error") && "init" in service && typeof service.init === "function") {
                  await new Promise(resolve => setTimeout(resolve, 2000));
                  addr = await service.getAddress();
                }
              }

              newAddresses[service.symbol] = addr || "Address Error";

              const bal = await service.getBalance();
              newBalances[service.symbol] = bal;

              // Only remove from loading set when address is valid
              if (isMounted) {
                setLoadingAssets(prev => {
                  const next = new Set(prev);
                  // Keep in loading if address is still invalid
                  // For Monero, be more strict - only remove if address is definitely valid
                  if (addr && addr !== "Address Error" && addr !== "Loading..." && !addr.includes("Address Error:")) {
                    next.delete(service.symbol);
                  } else if (service.symbol === "XMR") {
                    // For Monero, keep in loading state if address is invalid
                    // This allows the UI to show loading spinner
                    console.log(`Monero address still invalid, keeping in loading state: ${addr}`);
                  }
                  return next;
                });
              }
            } catch (e: any) {
              console.error(`Failed to load ${service.symbol}:`, e);
              
              // For Monero, be more graceful - show 0.0 balance instead of "Error"
              // This is because monero-ts may not work in all browser environments
              if (service.symbol === "XMR") {
                console.warn(`Monero loading failed, using fallback values:`, e.message);
                newBalances[service.symbol] = "0.0";
                if (!newAddresses[service.symbol]) {
                  // Try to get address anyway - it might work even if balance doesn't
                  try {
                    const fallbackAddr = await service.getAddress();
                    if (fallbackAddr && !fallbackAddr.includes("Address Error")) {
                      newAddresses[service.symbol] = fallbackAddr;
                    } else {
                      newAddresses[service.symbol] = "Address Error";
                    }
                  } catch {
                    newAddresses[service.symbol] = "Address Error";
                  }
                }
              } else {
                // For other chains, show error state
                newBalances[service.symbol] = "Error";
                if (!newAddresses[service.symbol])
                  newAddresses[service.symbol] = "Address Error";
              }

              // Remove from loading set even on error (after a longer delay for Monero)
              if (isMounted) {
                // For Monero, keep loading longer in case it's still initializing
                const delay = service.symbol === "XMR" ? 10000 : 0;
                setTimeout(() => {
                  setLoadingAssets(prev => {
                    const next = new Set(prev);
                    next.delete(service.symbol);
                    return next;
                  });
                }, delay);
              }
            }
          })
        );

        // Race between loading and timeout
        // Use longer timeout to accommodate Monero initialization (120 seconds)
        try {
          await Promise.race([
            loadPromise,
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Load timeout")), 120000)
            ),
          ]);
        } catch (e) {
          // Suppress warning during sync - will be shown after sync completes if needed
          // Clear all loading states on timeout - ensure all services are removed
          if (isMounted) {
            setLoadingAssets(prev => {
              const next = new Set(prev);
              // Remove all service symbols from loading set
              services.forEach(service => next.delete(service.symbol));
              return next;
            });
          }
        }

        if (!isMounted) return;

        setBalances(newBalances);
        setAddresses(newAddresses);

        // Fetch market data for all symbols
        try {
          const allSymbols = Object.keys(newBalances).filter(
            symbol =>
              newBalances[symbol] &&
              newBalances[symbol] !== "Error" &&
              newBalances[symbol] !== "N/A"
          );
          if (allSymbols.length > 0) {
            const prices = await MarketService.getPrices(allSymbols);
            if (isMounted) {
              setMarketData(prices);
            }
          }
        } catch (e) {
          console.error("Failed to fetch market data:", e);
          // Continue without market data
        }

        // Load HyperEVM tokens separately - include common tokens even with 0 balance
        try {
          const hyperEVMService = manager.getService(SupportedChain.HYPEREVM);
          const hyperEVMAddress = await hyperEVMService.getAddress();

          // Add HyperEVM tokens to loading set
          if (isMounted) {
            setLoadingAssets(prev => {
              const next = new Set(prev);
              // Add placeholder for tokens that will be loaded
              next.add("HYPE");
              return next;
            });
          }

          // Add timeout for token loading (increased to 30 seconds for better discovery)
          const tokenLoadPromise = TokenService.getHyperEVMTokens(
            hyperEVMAddress,
            true
          );
          const tokens = await Promise.race([
            tokenLoadPromise,
            new Promise<TokenInfo[]>((_, reject) =>
              setTimeout(() => reject(new Error("Token load timeout")), 30000)
            ),
          ]).catch(() => {
            // Return at least HYPE token on timeout
            return [
              {
                address: "0x0000000000000000000000000000000000000000",
                symbol: "HYPE",
                name: "HyperEVM",
                decimals: 18,
                balance: "0.00",
              },
            ];
          });

          if (!isMounted) return;

          setHyperEVMTokens(tokens);

          // Update balances and addresses for HyperEVM tokens
          tokens.forEach(token => {
            newBalances[token.symbol] = token.balance;
            newAddresses[token.symbol] = hyperEVMAddress; // All tokens use same address
            // Remove from loading set
            if (isMounted) {
              setLoadingAssets(prev => {
                const next = new Set(prev);
                next.delete(token.symbol);
                return next;
              });
            }
          });
          setBalances(newBalances);
          setAddresses(newAddresses);

          // Update market data to include tokens
          if (isMounted) {
            try {
              const allSymbols = Object.keys(newBalances).filter(
                symbol =>
                  newBalances[symbol] &&
                  newBalances[symbol] !== "Error" &&
                  newBalances[symbol] !== "N/A"
              );
              if (allSymbols.length > 0) {
                const prices = await MarketService.getPrices(allSymbols);
                if (isMounted) {
                  setMarketData(prev => ({ ...prev, ...prices }));
                }
              }
            } catch (e) {
              console.error("Failed to fetch market data for tokens:", e);
            }
          }
        } catch (e) {
          console.error("Failed to load HyperEVM tokens:", e);
          // Ensure at least HYPE is available
          if (!isMounted) return;
          const hyperEVMService = manager.getService(SupportedChain.HYPEREVM);
          try {
            // Try to initialize if needed
            if (
              "init" in hyperEVMService &&
              typeof hyperEVMService.init === "function"
            ) {
              try {
                await hyperEVMService.init();
              } catch (initError) {
                // Suppress warning during sync - will be shown after sync completes if needed
                // Continue anyway
              }
            }
            const hyperEVMAddress = await hyperEVMService.getAddress();
            setHyperEVMTokens([
              {
                address: "0x0000000000000000000000000000000000000000",
                symbol: "HYPE",
                name: "HyperEVM",
                decimals: 18,
                balance: "0.00",
              },
            ]);
            setBalances(prev => ({ ...prev, HYPE: "0.00" }));
            setAddresses(prev => ({ ...prev, HYPE: hyperEVMAddress }));
            // Remove HYPE from loading
            if (isMounted) {
              setLoadingAssets(prev => {
                const next = new Set(prev);
                next.delete("HYPE");
                return next;
              });
            }
          } catch (e2) {
            console.error("Failed to get HyperEVM address:", e2);
            // Clear loading on error
            if (isMounted) {
              setLoadingAssets(prev => {
                const next = new Set(prev);
                next.delete("HYPE");
                return next;
              });
            }
          }
        }
      } catch (e) {
        console.error("Failed to load dashboard data:", e);
        if (isMounted) {
          setLoadingAssets(new Set());
          setHasError(true);
        }
      }
    };

    loadData();

    // Refresh when active wallet changes (polling approach)
    const interval = setInterval(() => {
      const currentActive = WalletService.getActiveWallet();
      if (currentActive?.id !== WalletService.getActiveWallet()?.id) {
        loadData();
      }
    }, 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isPreviewMode]);

  // Calculate total balance when balances change
  useEffect(() => {
    if (Object.keys(balances).length > 0) {
      calculateTotalBalance(balances);
    }
  }, [balances, calculateTotalBalance]);

  const refreshBalances = () => {
    setIsRefreshing(true);
    setHasError(false);
    // Reload page to refresh all data
    window.location.reload();
  };

  // Build base assets (non-HyperEVM chains) - separated into regular chains and privacy coins
  const baseChains: Asset[] = [
    {
      symbol: "BTC",
      name: "Bitcoin",
      color: "#F7931A",
      chainKey: SupportedChain.BTC,
    },
    {
      symbol: "ETH",
      name: "Ethereum",
      color: "#627EEA",
      chainKey: SupportedChain.ETH,
    },
    {
      symbol: "SOL",
      name: "Solana",
      color: "#9945FF",
      chainKey: SupportedChain.SOL,
    },
  ];

  // Privacy coins
  const privacyCoins: Asset[] = [
    {
      symbol: "XMR",
      name: "Monero",
      color: "#FF6600",
      chainKey: SupportedChain.XMR,
    },
    {
      symbol: "ZEC",
      name: "ZCash",
      color: "#F4B728",
      chainKey: SupportedChain.ZEC,
    },
  ];

  // Convert HyperEVM tokens to assets and sort by USD value
  const hyperEVMAssets: Asset[] = [...hyperEVMTokens]
    .sort((tokenA, tokenB) => {
      // Sort by USD value (highest first)
      const balanceA = parseFloat(balances[tokenA.symbol] || "0");
      const balanceB = parseFloat(balances[tokenB.symbol] || "0");
      
      // Get USD values
      const priceA = marketData[tokenA.symbol]?.current_price || 0;
      const priceB = marketData[tokenB.symbol]?.current_price || 0;
      const usdValueA = balanceA * priceA;
      const usdValueB = balanceB * priceB;
      
      // First, separate tokens with balance > 0 from zero-balance tokens
      const hasBalanceA = balanceA > 0;
      const hasBalanceB = balanceB > 0;
      
      if (hasBalanceA && !hasBalanceB) return -1;
      if (!hasBalanceA && hasBalanceB) return 1;
      
      // Within each group, sort by USD value
      if (hasBalanceA && hasBalanceB) {
        return usdValueB - usdValueA;
      }
      
      // For zero-balance tokens, sort alphabetically
      return tokenA.symbol.localeCompare(tokenB.symbol);
    })
    .map(token => ({
      symbol: token.symbol,
      name: token.name || token.symbol,
      color: "#00FF9D",
      chainKey: SupportedChain.HYPEREVM,
    }));

  // Ensure HYPE is always present and at the top if it has balance
  const hasHYPE = hyperEVMAssets.some(asset => asset.symbol === "HYPE");
  if (!hasHYPE && !loadingAssets.has("HYPE")) {
    const hypeBalance = parseFloat(balances["HYPE"] || "0");
    if (hypeBalance > 0) {
      hyperEVMAssets.unshift({
        symbol: "HYPE",
        name: "HyperEVM",
        color: "#00FF9D",
        chainKey: SupportedChain.HYPEREVM,
      });
    } else {
      hyperEVMAssets.push({
        symbol: "HYPE",
        name: "HyperEVM",
        color: "#00FF9D",
        chainKey: SupportedChain.HYPEREVM,
      });
    }
  }

  const activeWallet = WalletService.getActiveWallet();

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tighter">Portfolio</h1>
          {activeWallet && (
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              {activeWallet.name}
            </p>
          )}
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={refreshBalances}
            disabled={isRefreshing}
            className="p-3 bg-[var(--bg-secondary)] hover:bg-[var(--hover-bg)] border border-[var(--border-primary)] rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refresh balances"
          >
            <RefreshCw
              size={20}
              className={`text-[var(--text-primary)] ${
                isRefreshing ? "animate-spin" : ""
              }`}
            />
          </button>
          <div className="text-right">
            {loadingBalance ? (
              <div className="h-8 w-32 bg-[var(--bg-tertiary)] rounded animate-pulse"></div>
            ) : (
              <div>
                <div className="text-3xl font-bold tracking-tight">
                  $
                  {totalBalance !== null
                    ? totalBalance.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    : "0.00"}
                </div>
                <div className="text-xs text-[var(--text-secondary)] mt-1">
                  Total Balance
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {hasError && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3 transition-colors"
        >
          <AlertCircle
            size={20}
            className="text-red-500 dark:text-red-400 flex-shrink-0"
          />
          <div className="flex-1">
            <p className="text-sm font-bold text-red-700 dark:text-red-400">
              Failed to load some balances
            </p>
            <p className="text-xs text-red-600 dark:text-red-500 mt-1">
              Some assets may not be displayed correctly. Click refresh to try
              again.
            </p>
          </div>
          <button
            onClick={refreshBalances}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </motion.div>
      )}

      {Object.keys(balances).length === 0 &&
        hyperEVMAssets.length === 0 &&
        baseChains.length === 0 &&
        privacyCoins.length === 0 &&
        !loadingAssets.size && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20 bg-[var(--bg-secondary)] rounded-3xl border border-[var(--border-primary)] transition-colors"
          >
            <WalletIcon
              size={64}
              className="mx-auto mb-6 text-[var(--text-tertiary)]"
            />
            <h2 className="text-2xl font-bold mb-2">No Assets Found</h2>
            <p className="text-[var(--text-secondary)] mb-6 max-w-md mx-auto">
              Your portfolio is empty. Start by receiving some assets or swap to
              get started.
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => (window.location.href = "/swap")}
                className="px-6 py-3 bg-hyper-green text-black rounded-xl font-bold hover:bg-hyper-dark transition-colors"
              >
                Go to Swap
              </button>
              <button
                onClick={refreshBalances}
                className="px-6 py-3 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-xl font-bold hover:bg-[var(--hover-bg)] border border-[var(--border-primary)] transition-colors"
              >
                Refresh
              </button>
            </div>
          </motion.div>
        )}

      <div className="flex flex-col gap-4">
        {/* HyperEVM Category Section */}
        {hyperEVMAssets.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] overflow-hidden transition-colors"
          >
            {/* Category Header */}
            <button
              onClick={() => setIsHyperEVMExpanded(!isHyperEVMExpanded)}
              className="w-full flex items-center justify-between p-4 hover:bg-[var(--hover-bg)] transition-colors group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-hyper-green flex items-center justify-center font-bold text-black text-lg">
                  H
                </div>
                <div className="text-left">
                  <div className="font-bold text-lg">HyperEVM</div>
                  <div className="text-xs text-[var(--text-secondary)]">
                    {hyperEVMTokens.length} token
                    {hyperEVMTokens.length !== 1 ? "s" : ""}
                    {hyperEVMTokens.length > 0 && (
                      <span className="ml-2">
                        (
                        {hyperEVMTokens.filter(
                          token => parseFloat(balances[token.symbol] || "0") > 0
                        ).length}{" "}
                        with balance)
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {isHyperEVMExpanded ? (
                <ChevronUp
                  size={20}
                  className="text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors"
                />
              ) : (
                <ChevronDown
                  size={20}
                  className="text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors"
                />
              )}
            </button>

            {/* Collapsible Token List */}
            <AnimatePresence>
              {isHyperEVMExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-[var(--border-primary)]">
                    {hyperEVMAssets.length === 0 && loadingAssets.has("HYPE") ? (
                      <div className="p-6 text-center text-[var(--text-secondary)]">
                        <div className="h-8 w-24 bg-[var(--bg-tertiary)] rounded animate-pulse mx-auto mb-2"></div>
                        <div className="text-sm">Loading tokens...</div>
                      </div>
                    ) : hyperEVMAssets.length === 0 ? (
                      <div className="p-6 text-center text-[var(--text-secondary)]">
                        <div className="text-sm">No tokens found</div>
                      </div>
                    ) : (
                      <div className="divide-y divide-[var(--border-primary)]">
                        {hyperEVMAssets.map((asset, i) => {
                          const balance = parseFloat(balances[asset.symbol] || "0");
                          const hasBalance = balance > 0;
                          return (
                            <AssetCard
                        key={asset.symbol}
                        asset={asset}
                        balance={balances[asset.symbol]}
                        address={addresses[asset.symbol]}
                        isLoading={loadingAssets.has(asset.symbol)}
                        marketData={marketData}
                        onSend={() =>
                          setSendModal({
                            isOpen: true,
                            symbol: asset.symbol,
                            chainKey: asset.chainKey,
                          })
                        }
                        onReceive={async () => {
                          let address = addresses[asset.symbol];
                          if (!address || address === "Address Error") {
                            setReceiveModal({
                              isOpen: true,
                              symbol: asset.symbol,
                              address: "",
                              loading: true,
                            });

                            try {
                              const activeWallet =
                                WalletService.getActiveWallet();
                              if (!activeWallet) {
                                setReceiveModal(prev => ({
                                  ...prev,
                                  loading: false,
                                  address: "No wallet",
                                }));
                                return;
                              }

                              const mnemonic = activeWallet.mnemonic;
                              const privKey = activeWallet.privateKey;

                              if (!mnemonic && !privKey) {
                                setReceiveModal(prev => ({
                                  ...prev,
                                  loading: false,
                                  address: "No credentials",
                                }));
                                return;
                              }

                              const enabledNetworks =
                                NetworkService.getEnabledNetworks();
                              const manager = new ChainManager(
                                privKey || undefined,
                                !!privKey,
                                mnemonic || undefined,
                                enabledNetworks
                              );

                              const service = manager.getService(
                                asset.chainKey
                              );

                              // Check if service has init method and initialize if needed
                              if (
                                "init" in service &&
                                typeof service.init === "function"
                              ) {
                                setReceiveModal(prev => ({
                                  ...prev,
                                  address: `Initializing ${asset.name} wallet...`,
                                  loading: true,
                                }));

                                try {
                                  // For services that need init (like Monero), give more time
                                  let initSuccess = false;
                                  for (let attempt = 0; attempt < 2; attempt++) {
                                    try {
                                      await Promise.race([
                                        service.init(),
                                        new Promise((_, reject) =>
                                          setTimeout(() => reject(new Error("Init timeout")), 30000)
                                        ),
                                      ]);
                                      initSuccess = true;
                                      break;
                                    } catch (initError: any) {
                                      if (attempt === 0) {
                                        setReceiveModal(prev => ({
                                          ...prev,
                                          address: `Retrying ${asset.name} wallet initialization...`,
                                          loading: true,
                                        }));
                                        await new Promise(resolve => setTimeout(resolve, 2000));
                                      } else {
                                        throw initError;
                                      }
                                    }
                                  }

                                  if (initSuccess) {
                                    setReceiveModal(prev => ({
                                      ...prev,
                                      address: `${asset.name} wallet initialized successfully!`,
                                      loading: true,
                                    }));
                                    await new Promise(resolve =>
                                      setTimeout(resolve, 1000)
                                    );
                                  }
                                } catch (initError: any) {
                                  console.error(
                                    "Failed to initialize wallet:",
                                    initError
                                  );
                                  // Don't return - try to get address anyway
                                  setReceiveModal(prev => ({
                                    ...prev,
                                    address: `Getting address (initialization may have failed)...`,
                                    loading: true,
                                  }));
                                }
                              }

                              setReceiveModal(prev => ({
                                ...prev,
                                address: "Getting address...",
                                loading: true,
                              }));

                              // Try to get address with timeout and retry
                              try {
                                address = await Promise.race([
                                  service.getAddress(),
                                  new Promise<string>((_, reject) =>
                                    setTimeout(() => reject(new Error("Address timeout")), 15000)
                                  ),
                                ]);

                                // Validate address
                                if (address && address !== "Address Error" && address !== "Loading...") {
                                  setAddresses(prev => ({
                                    ...prev,
                                    [asset.symbol]: address,
                                  }));
                                  setReceiveModal({
                                    isOpen: true,
                                    symbol: asset.symbol,
                                    address: address,
                                    loading: false,
                                  });
                                } else {
                                  // Retry once more
                                  await new Promise(resolve => setTimeout(resolve, 2000));
                                  address = await service.getAddress();
                                  if (address && address !== "Address Error") {
                                    setAddresses(prev => ({
                                      ...prev,
                                      [asset.symbol]: address,
                                    }));
                                    setReceiveModal({
                                      isOpen: true,
                                      symbol: asset.symbol,
                                      address: address,
                                      loading: false,
                                    });
                                  } else {
                                    throw new Error("Failed to get valid address");
                                  }
                                }
                              } catch (e) {
                                console.error(
                                  `Failed to get ${asset.symbol} address:`,
                                  e
                                );
                                setReceiveModal({
                                  isOpen: true,
                                  symbol: asset.symbol,
                                  address: "Address Error",
                                  loading: false,
                                });
                              }
                            } catch (e) {
                              console.error(`Failed to process ${asset.symbol} receive:`, e);
                              setReceiveModal(prev => ({
                                ...prev,
                                address: "Address Error",
                                loading: false,
                              }));
                            }
                          } else {
                            setReceiveModal({
                              isOpen: true,
                              symbol: asset.symbol,
                              address: address,
                              loading: false,
                            });
                          }
                        }}
                        animationIndex={i}
                      />
                          );
                        })}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Base Chains */}
        {baseChains.map((asset, i) => (
          <AssetCard
            key={asset.symbol}
            asset={asset}
            balance={balances[asset.symbol]}
            address={addresses[asset.symbol]}
            isLoading={loadingAssets.has(asset.symbol)}
            marketData={marketData}
            animationIndex={i}
            onSend={() =>
              setSendModal({
                isOpen: true,
                symbol: asset.symbol,
                chainKey: asset.chainKey,
              })
            }
            onReceive={async () => {
              let address = addresses[asset.symbol];
              if (!address || address === "Address Error") {
                setReceiveModal({
                  isOpen: true,
                  symbol: asset.symbol,
                  address: "",
                  loading: true,
                });

                try {
                  const activeWallet = WalletService.getActiveWallet();
                  if (!activeWallet) {
                    setReceiveModal(prev => ({
                      ...prev,
                      loading: false,
                      address: "No wallet",
                    }));
                    return;
                  }

                  const mnemonic = activeWallet.mnemonic;
                  const privKey = activeWallet.privateKey;

                  if (!mnemonic && !privKey) {
                    setReceiveModal(prev => ({
                      ...prev,
                      loading: false,
                      address: "No credentials",
                    }));
                    return;
                  }

                  const enabledNetworks = NetworkService.getEnabledNetworks();
                  const manager = new ChainManager(
                    privKey || undefined,
                    !!privKey,
                    mnemonic || undefined,
                    enabledNetworks
                  );

                  const service = manager.getService(asset.chainKey);

                  // Check if service has init method and initialize if needed
                  if ("init" in service && typeof service.init === "function") {
                    setReceiveModal(prev => ({
                      ...prev,
                      address: `Initializing ${asset.name} wallet...`,
                      loading: true,
                    }));

                    try {
                      await service.init();
                      setReceiveModal(prev => ({
                        ...prev,
                        address: `${asset.name} wallet initialized successfully!`,
                        loading: true,
                      }));
                      // Small delay to show success message
                      await new Promise(resolve => setTimeout(resolve, 1000));
                    } catch (initError: any) {
                      console.error("Failed to initialize wallet:", initError);
                      setReceiveModal(prev => ({
                        ...prev,
                        address: `Initialization failed: ${
                          initError.message || "Unknown error"
                        }`,
                        loading: false,
                      }));
                      return;
                    }
                  }

                  setReceiveModal(prev => ({
                    ...prev,
                    address: "Getting address...",
                    loading: true,
                  }));

                  address = await service.getAddress();

                  setAddresses(prev => ({
                    ...prev,
                    [asset.symbol]: address,
                  }));
                } catch (e) {
                  console.error(`Failed to get ${asset.symbol} address:`, e);
                  address = "Address Error";
                }

                setReceiveModal({
                  isOpen: true,
                  symbol: asset.symbol,
                  address: address || "Address Error",
                  loading: false,
                });
              } else {
                setReceiveModal({
                  isOpen: true,
                  symbol: asset.symbol,
                  address: address,
                  loading: false,
                });
              }
            }}
          />
        ))}

        {/* Privacy Coins Section */}
        {privacyCoins.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] overflow-hidden transition-colors"
          >
            {/* Category Header */}
            <div className="w-full flex items-center justify-between p-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <Shield size={24} className="text-purple-400" />
                </div>
                <div className="text-left">
                  <div className="font-bold text-lg">Privacy Coins</div>
                  <div className="text-xs text-[var(--text-secondary)]">
                    {privacyCoins.length} coin
                    {privacyCoins.length !== 1 ? "s" : ""}
                  </div>
                </div>
              </div>
            </div>

            {/* Privacy Coins List */}
            <div className="border-t border-[var(--border-primary)] divide-y divide-[var(--border-primary)]">
              {privacyCoins.map((asset, i) => (
                <AssetCard
                  key={asset.symbol}
                  asset={asset}
                  balance={balances[asset.symbol]}
                  address={addresses[asset.symbol]}
                  isLoading={loadingAssets.has(asset.symbol)}
                  marketData={marketData}
                  isPrivacyCoin={true}
                  hasShieldSwap={asset.symbol === "ZEC"}
                  onSend={() =>
                    setSendModal({
                      isOpen: true,
                      symbol: asset.symbol,
                      chainKey: asset.chainKey,
                    })
                  }
                  onReceive={async () => {
                    let address = addresses[asset.symbol];
                    if (!address || address === "Address Error") {
                      setReceiveModal({
                        isOpen: true,
                        symbol: asset.symbol,
                        address: "",
                        loading: true,
                      });

                      try {
                        const activeWallet = WalletService.getActiveWallet();
                        if (!activeWallet) {
                          setReceiveModal(prev => ({
                            ...prev,
                            loading: false,
                            address: "No wallet",
                          }));
                          return;
                        }

                        const mnemonic = activeWallet.mnemonic;
                        const privKey = activeWallet.privateKey;

                        if (!mnemonic && !privKey) {
                          setReceiveModal(prev => ({
                            ...prev,
                            loading: false,
                            address: "No credentials",
                          }));
                          return;
                        }

                        const enabledNetworks =
                          NetworkService.getEnabledNetworks();
                        const manager = new ChainManager(
                          privKey || undefined,
                          !!privKey,
                          mnemonic || undefined,
                          enabledNetworks
                        );

                        const service = manager.getService(asset.chainKey);

                        // Check if service has init method and initialize if needed
                        if (
                          "init" in service &&
                          typeof service.init === "function"
                        ) {
                          setReceiveModal(prev => ({
                            ...prev,
                            address: `Initializing ${asset.name} wallet...`,
                            loading: true,
                          }));

                          try {
                            // For Monero, give it more time and retry if needed
                            let initSuccess = false;
                            for (let attempt = 0; attempt < 2; attempt++) {
                              try {
                                await Promise.race([
                                  service.init(),
                                  new Promise((_, reject) =>
                                    setTimeout(() => reject(new Error("Init timeout")), 30000)
                                  ),
                                ]);
                                initSuccess = true;
                                break;
                              } catch (initError: any) {
                                if (attempt === 0) {
                                  // First attempt failed, wait a bit and try again
                                  setReceiveModal(prev => ({
                                    ...prev,
                                    address: `Retrying ${asset.name} wallet initialization...`,
                                    loading: true,
                                  }));
                                  await new Promise(resolve => setTimeout(resolve, 2000));
                                } else {
                                  throw initError;
                                }
                              }
                            }

                            if (initSuccess) {
                              setReceiveModal(prev => ({
                                ...prev,
                                address: `${asset.name} wallet initialized successfully!`,
                                loading: true,
                              }));
                              await new Promise(resolve =>
                                setTimeout(resolve, 1000)
                              );
                            }
                          } catch (initError: any) {
                            console.error(`Failed to initialize ${asset.name}:`, initError);
                            // Don't return immediately - try to get address anyway
                            setReceiveModal(prev => ({
                              ...prev,
                              address: `Getting address (initialization may have failed)...`,
                              loading: true,
                            }));
                          }
                        }

                        setReceiveModal(prev => ({
                          ...prev,
                          address: "Getting address...",
                          loading: true,
                        }));

                        // Try to get address with timeout
                        try {
                          address = await Promise.race([
                            service.getAddress(),
                            new Promise<string>((_, reject) =>
                              setTimeout(() => reject(new Error("Address timeout")), 15000)
                            ),
                          ]);

                          // Validate address - if it's an error, keep trying
                          if (address && address !== "Address Error" && address !== "Loading...") {
                            setAddresses(prev => ({
                              ...prev,
                              [asset.symbol]: address,
                            }));
                            setReceiveModal(prev => ({
                              ...prev,
                              address: address,
                              loading: false,
                            }));
                          } else {
                            // Address is still invalid, keep loading
                            setReceiveModal(prev => ({
                              ...prev,
                              address: "Still loading address...",
                              loading: true,
                            }));
                            // Retry once more
                            await new Promise(resolve => setTimeout(resolve, 2000));
                            address = await service.getAddress();
                            if (address && address !== "Address Error") {
                              setAddresses(prev => ({
                                ...prev,
                                [asset.symbol]: address,
                              }));
                              setReceiveModal(prev => ({
                                ...prev,
                                address: address,
                                loading: false,
                              }));
                            } else {
                              throw new Error("Failed to get valid address");
                            }
                          }
                        } catch (e) {
                          console.error(`Failed to get ${asset.symbol} address:`, e);
                          setReceiveModal(prev => ({
                            ...prev,
                            address: "Address Error",
                            loading: false,
                          }));
                        }
                      } catch (e) {
                        console.error(`Failed to get ${asset.symbol} address:`, e);
                        setReceiveModal(prev => ({
                          ...prev,
                          address: "Address Error",
                          loading: false,
                        }));
                      }
                    } else {
                      setReceiveModal({
                        isOpen: true,
                        symbol: asset.symbol,
                        address: address,
                        loading: false,
                      });
                    }
                  }}
                  animationIndex={i}
                />
              ))}
            </div>
          </motion.div>
        )}
      </div>

      <ReceiveModal
        isOpen={receiveModal.isOpen}
        onClose={() => setReceiveModal({ ...receiveModal, isOpen: false })}
        address={receiveModal.address}
        symbol={receiveModal.symbol}
      />

      <SendModal
        isOpen={sendModal.isOpen}
        onClose={() => setSendModal({ ...sendModal, isOpen: false })}
        symbol={sendModal.symbol}
        chainKey={sendModal.chainKey}
      />
    </div>
  );
}
