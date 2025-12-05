import React, { useEffect, useState, useCallback } from "react";
import { SupportedChain } from "../services/chains/manager";
import { WalletService } from "../services/wallet";
import { createChainManagerFromActiveWallet } from "../services/chains/factory";
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
import type { IChainService } from "../services/chains/types";
import { AddressCacheService } from "../services/addressCache";
import { ConnectionStatusService } from "../services/connectionStatus";
import { BalanceCacheService } from "../services/balanceCache";

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
  const [copied, setCopied] = React.useState(false);
  const isAddressReady =
    address &&
    !address.startsWith("Address Error") &&
    !address.includes("Initializing") &&
    !address.includes("Getting address") &&
    !address.includes("No wallet") &&
    !address.includes("No credentials");
  const shortAddress =
    isAddressReady && address
      ? `${address.slice(0, 6)}...${address.slice(-6)}`
      : "Address unavailable";

  const status = React.useMemo(() => {
    if (isLoading) {
      return {
        label: "Syncing",
        border: "border-yellow-500/40",
        text: "text-yellow-400",
        dot: "bg-yellow-500",
      };
    }
    if (!isAddressReady || balance === "Error") {
      return {
        label: "Needs attention",
        border: "border-red-500/30",
        text: "text-red-400",
        dot: "bg-red-500",
      };
    }
    return {
      label: "Ready",
      border: "border-green-500/30",
      text: "text-green-400",
      dot: "bg-green-500",
    };
  }, [balance, isAddressReady, isLoading]);

  const handleCopyAddress = async () => {
    if (!address || !isAddressReady) {
      onReceive();
      return;
    }
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch (err) {
      console.error("Failed to copy address", err);
      onReceive();
    }
  };

  // Format balance number nicely
  const formatBalance = (bal: string | undefined): string => {
    if (!bal || bal === "Error" || bal === "N/A") return "0.00";
    
    const num = parseFloat(bal);
    if (isNaN(num)) return "0.00";
    
    if (num === 0) return "0.00";
    
    // For very small numbers, show more decimals
    if (num < 0.000001) {
      return num.toExponential(2);
    }
    
    // For numbers less than 1, show up to 8 decimals but remove trailing zeros
    if (num < 1) {
      return num.toFixed(8).replace(/\.?0+$/, "");
    }
    
    // For numbers 1-1000, show 2-4 decimals
    if (num < 1000) {
      return num.toFixed(4).replace(/\.?0+$/, "");
    }
    
    // For larger numbers, use locale string with commas
    return num.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

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

  // Get asset color for background
  const assetColors: Record<string, string> = {
    BTC: "#F7931A",
    ETH: "#627EEA",
    SOL: "#9945FF",
    XMR: "#FF6600",
    ZEC: "#F4B728",
    HYPE: "#00FF9D",
    HYPEREVM: "#00FF9D",
    USDT: "#26a17b",
    USDC: "#2775ca",
    DAI: "#f5ac37",
    WBTC: "#f7931a",
    WETH: "#627eea",
    UNI: "#ff007a",
    LINK: "#2e5cea",
    AAVE: "#b6509e",
    wHYPE: "#00FF9D",
    WHYPE: "#00FF9D",
  };

  const assetColor = assetColors[asset.symbol.toUpperCase()] || "#6b7280";
  
  // Convert hex to rgba for background gradient
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: animationIndex * 0.05 }}
      className="group relative overflow-hidden rounded-2xl border border-[var(--border-primary)] transition-all duration-300 hover:shadow-xl hover:shadow-black/5 dark:hover:shadow-black/20 hover:scale-[1.02]"
      style={{
        background: `linear-gradient(135deg, ${hexToRgba(assetColor, 0.12)} 0%, ${hexToRgba(assetColor, 0.06)} 50%, var(--bg-secondary) 100%)`,
      }}
    >
      {/* Card Content */}
      <div className="p-6">
        {/* Header Section */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <AssetLogo symbol={asset.symbol} size={56} />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-xl text-[var(--text-primary)]">
                  {asset.name}
                </h3>
                {isPrivacyCoin && (
                  <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs font-bold rounded-full border border-purple-500/30">
                    PRIVACY
                  </span>
                )}
                {hasShieldSwap && (
                  <span className="px-2 py-0.5 bg-hyper-green/20 text-hyper-green text-xs font-bold rounded-full border border-hyper-green/30 flex items-center gap-1">
                    <Shield size={12} />
                    SHIELD
                  </span>
                )}
              </div>
              <div className="text-[var(--text-secondary)] text-sm font-mono">
                {asset.symbol}
              </div>
            </div>
          </div>
        </div>

        {/* Balance Section */}
        <div className="mb-4">
          <div className="text-3xl font-bold tracking-tight text-[var(--text-primary)] mb-1">
            {isLoading ? (
              <div className="h-9 w-32 bg-[var(--bg-tertiary)] rounded animate-pulse"></div>
            ) : (
              formatBalance(balance)
            )}
          </div>
          <div className="text-sm text-[var(--text-secondary)]">
            {isLoading ? (
              <div className="h-4 w-24 bg-[var(--bg-tertiary)] rounded animate-pulse"></div>
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

        {/* Address Section */}
        <div className="mb-4">
          <button
            onClick={handleCopyAddress}
            className="w-full px-3 py-2 rounded-xl bg-[var(--bg-tertiary)]/50 border border-[var(--border-primary)] hover:border-hyper-green transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between"
            disabled={!address}
          >
            <span className="font-mono text-xs text-[var(--text-primary)] truncate flex-1 text-left">
              {shortAddress}
            </span>
            {copied ? (
              <span className="text-hyper-green font-bold text-xs ml-2 flex-shrink-0">Copied</span>
            ) : (
              <span className="text-[var(--text-secondary)] text-xs ml-2 flex-shrink-0">Copy</span>
            )}
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={onSend}
            disabled={balance === "Error" || parseFloat(balance || "0") === 0}
            className="flex-1 py-3 bg-[var(--bg-tertiary)] rounded-xl hover:bg-[var(--text-primary)] hover:text-[var(--bg-primary)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-bold text-sm"
            title="Send"
          >
            <ArrowUpRight size={18} />
            Send
          </button>
          <button
            onClick={onReceive}
            disabled={balance === "N/A" || balance === "Error"}
            className="flex-1 py-3 bg-[var(--bg-tertiary)] rounded-xl hover:bg-[var(--text-primary)] hover:text-[var(--bg-primary)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-bold text-sm"
            title="Receive"
          >
            <ArrowDownLeft size={18} />
            Receive
          </button>
        </div>
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
        // Don't set to null, keep previous value or set to 0
        setTotalBalance(prev => prev !== null ? prev : 0);
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

  const isAddressUsable = (addr?: string) => {
    if (!addr) return false;
    return (
      !addr.startsWith("Address Error") &&
      !addr.includes("No wallet") &&
      !addr.includes("No credentials") &&
      !addr.includes("Initializing") &&
      !addr.includes("Getting address") &&
      addr !== "Loading..."
    );
  };

  const resolveServiceForAsset = async (asset: Asset) => {
    const manager = createChainManagerFromActiveWallet();
    return manager.getService(asset.chainKey) as IChainService & {
      init?: () => Promise<void>;
    };
  };

  const initServiceIfNeeded = async (service: IChainService & { init?: () => Promise<void> }, asset: Asset) => {
    if (!("init" in service) || typeof service.init !== "function") return;

    const initTimeout = asset.symbol === "XMR" ? 90000 : 30000;
    try {
      await Promise.race([
        service.init(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Init timeout")), initTimeout)),
      ]);
    } catch (initError: any) {
      if (asset.symbol !== "XMR") throw initError;
      // For Monero, bubble up critical errors but allow retries for transient ones
      if (
        initError?.message?.includes("not available") ||
        initError?.message?.includes("Cannot find module")
      ) {
        throw initError;
      }
    }
  };

  const fetchAddressForAsset = async (asset: Asset): Promise<string> => {
    const service = await resolveServiceForAsset(asset);
    await initServiceIfNeeded(service, asset);

    const attempts = asset.symbol === "XMR" ? 3 : 1;
    const timeout = asset.symbol === "XMR" ? 20000 : 15000;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const address = await Promise.race([
          service.getAddress(),
          new Promise<string>((_, reject) => setTimeout(() => reject(new Error("Address timeout")), timeout)),
        ]);

        if (isAddressUsable(address)) {
          return address;
        }

        lastError = new Error("Address not ready");
      } catch (err: any) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }

      if (asset.symbol === "XMR") {
        await new Promise(resolve => setTimeout(resolve, 2500));
      }
    }

    throw lastError || new Error("Failed to load address");
  };

  // Map symbol to chain key
  const getChainKeyForSymbol = (symbol: string): SupportedChain => {
    const symbolToChain: Record<string, SupportedChain> = {
      BTC: SupportedChain.BTC,
      ETH: SupportedChain.ETH,
      SOL: SupportedChain.SOL,
      XMR: SupportedChain.XMR,
      ZEC: SupportedChain.ZEC,
      HYPE: SupportedChain.HYPEREVM,
    };
    
    // For HyperEVM tokens, check if it's in the tokens list
    if (!symbolToChain[symbol]) {
      const token = hyperEVMTokens.find(t => t.symbol === symbol);
      if (token) {
        return SupportedChain.HYPEREVM;
      }
    }
    
    return symbolToChain[symbol] || SupportedChain.HYPEREVM;
  };

  const generateNewAddress = async (symbol: string): Promise<string> => {
    const activeWallet = WalletService.getActiveWallet();
    if (!activeWallet) {
      throw new Error("No active wallet");
    }

    // Get chain key for symbol
    const chainKey = getChainKeyForSymbol(symbol);
    
    // Get next derivation index
    const nextIndex = AddressCacheService.getNextDerivationIndex(activeWallet.id, symbol);
    
    // Create new chain manager with new derivation index
    const manager = createChainManagerFromActiveWallet(nextIndex);
    const service = manager.getService(chainKey) as IChainService & {
      init?: () => Promise<void>;
    };

    // Create asset object for initialization
    const asset: Asset = {
      symbol,
      name: symbol,
      color: "#00FF9D",
      chainKey,
    };

    // Initialize if needed
    await initServiceIfNeeded(service, asset);

    // Get new address
    const newAddress = await service.getAddress();
    
    // Update addresses state
    setAddresses(prev => ({ ...prev, [symbol]: newAddress }));
    
    return newAddress;
  };

  const handleReceive = async (asset: Asset) => {
    const existing = addresses[asset.symbol];
    if (isAddressUsable(existing)) {
      setReceiveModal({
        isOpen: true,
        symbol: asset.symbol,
        address: existing,
        loading: false,
      });
      return;
    }

    if (isPreviewMode) {
      const mockAddress =
        PreviewDataService.getMockAddresses()[asset.symbol] || "Preview address";
      setReceiveModal({
        isOpen: true,
        symbol: asset.symbol,
        address: mockAddress,
        loading: false,
      });
      return;
    }

    setReceiveModal({
      isOpen: true,
      symbol: asset.symbol,
      address: "Loading...",
      loading: true,
    });

    try {
      const address = await fetchAddressForAsset(asset);
      setAddresses(prev => ({ ...prev, [asset.symbol]: address }));
      setReceiveModal({
        isOpen: true,
        symbol: asset.symbol,
        address,
        loading: false,
      });
    } catch (err: any) {
      console.error(`Failed to get ${asset.symbol} address:`, err);
      const errorMessage =
        err?.message && typeof err.message === "string"
          ? err.message
          : "Failed to load address";
      setReceiveModal({
        isOpen: true,
        symbol: asset.symbol,
        address: errorMessage.startsWith("Address Error:")
          ? errorMessage
          : `Address Error: ${errorMessage}`,
        loading: false,
      });
    }
  };

  useEffect(() => {
    let isMounted = true;

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
          if (isMounted) {
            setLoadingAssets(new Set());
            setLoadingBalance(false);
          }
          return;
        }

        // Load cached addresses immediately (synchronous)
        const cachedAddresses = AddressCacheService.getAllAddressesForWallet(activeWallet.id);
        const initialAddresses: Record<string, string> = {};
        
        // Map cached addresses by symbol
        for (const [chain, addresses] of Object.entries(cachedAddresses)) {
          if (addresses.length > 0) {
            // Use the first (default) address for each chain
            initialAddresses[chain] = addresses[0].address;
          }
        }

        // Load cached balances immediately (synchronous)
        const cachedBalances = BalanceCacheService.getAllCachedBalances(activeWallet.id);

        // Display cached addresses and balances immediately
        if (isMounted) {
          if (Object.keys(initialAddresses).length > 0) {
            setAddresses(initialAddresses);
          }
          if (Object.keys(cachedBalances).length > 0) {
            setBalances(cachedBalances);
            // Calculate total balance with cached data
            calculateTotalBalance(cachedBalances);
          }
        }

        const manager = createChainManagerFromActiveWallet();
        const services = manager.getAllServices();

        // Start with cached balances (including token balances)
        const newBalances: Record<string, string> = { ...cachedBalances };
        const newAddresses: Record<string, string> = { ...initialAddresses };

        // Initialize loading state for all services
        const initialLoadingAssets = new Set(services.map(s => s.symbol));
        if (isMounted) setLoadingAssets(initialLoadingAssets);

        // Report initial connection status
        services.forEach(service => {
          ConnectionStatusService.setChainStatus(service.symbol, 'connecting', 'Connecting...');
        });

        // Load all services in parallel - only initialize services that need it
        const loadPromise = Promise.all(
          services.map(async service => {
            try {
              // Only Monero needs initialization - skip for other services
              const needsInit = service.symbol === "XMR" && "init" in service && typeof service.init === "function";
              
              if (needsInit) {
                try {
                  // Reduced timeout since Monero is working now (30 seconds)
                  await Promise.race([
                    service.init(),
                    new Promise((_, reject) =>
                      setTimeout(() => reject(new Error("Init timeout")), 30000)
                    ),
                  ]);
                } catch (initError: any) {
                  console.warn(`Monero initialization failed but continuing:`, initError.message);
                  // Continue anyway - address might still be retrievable
                }
              }

              // Fetch address and balance in parallel for each service
              const [addr, bal] = await Promise.all([
                Promise.race([
                  service.getAddress(),
                  new Promise<string>((_, reject) =>
                    setTimeout(() => reject(new Error("Address timeout")), service.symbol === "XMR" ? 15000 : 10000)
                  ),
                ]).catch(() => service.getAddress().catch(() => "Address Error")),
                Promise.race([
                  service.getBalance(),
                  new Promise<string>((_, reject) =>
                    setTimeout(() => reject(new Error("Balance timeout")), 10000)
                  ),
                ]).catch(() => service.getBalance().catch(() => "Error")),
              ]);

              newAddresses[service.symbol] = addr || "Address Error";
              newBalances[service.symbol] = bal || "Error";

              // Cache balance if valid
              if (activeWallet && bal && bal !== "Error" && bal !== "N/A") {
                BalanceCacheService.setCachedBalance(activeWallet.id, service.symbol, bal);
              }

              // Report connection status
              if (isAddressUsable(addr) && bal !== "Error") {
                ConnectionStatusService.setChainStatus(service.symbol, 'connected', 'Connected');
              } else if (bal === "Error") {
                ConnectionStatusService.setChainStatus(service.symbol, 'error', 'Connection failed');
              } else {
                ConnectionStatusService.setChainStatus(service.symbol, 'connected', 'Address loaded');
              }

              // Remove from loading set when address is valid
              if (isMounted && isAddressUsable(addr)) {
                setLoadingAssets(prev => {
                  const next = new Set(prev);
                  next.delete(service.symbol);
                  return next;
                });
              }
            } catch (e: any) {
              console.error(`Failed to load ${service.symbol}:`, e);
              
              // Report error status
              ConnectionStatusService.setChainStatus(service.symbol, 'error', e.message || 'Connection failed');
              
              // Graceful fallback for Monero
              if (service.symbol === "XMR") {
                newBalances[service.symbol] = "0.0";
                try {
                  const fallbackAddr = await service.getAddress();
                  newAddresses[service.symbol] = isAddressUsable(fallbackAddr) ? fallbackAddr : "Address Error";
                  if (isAddressUsable(fallbackAddr)) {
                    ConnectionStatusService.setChainStatus(service.symbol, 'connected', 'Address loaded');
                  }
                } catch {
                  newAddresses[service.symbol] = "Address Error";
                }
              } else {
                newBalances[service.symbol] = "Error";
                newAddresses[service.symbol] = "Address Error";
              }

              // Remove from loading set on error
              if (isMounted) {
                setLoadingAssets(prev => {
                  const next = new Set(prev);
                  next.delete(service.symbol);
                  return next;
                });
              }
            }
          })
        );

        // Race between loading and timeout (reduced since we optimized initialization)
        try {
          await Promise.race([
            loadPromise,
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Load timeout")), 60000)
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
        
        // Calculate total balance with new balances
        calculateTotalBalance(newBalances);

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
            // Always set balance, even if it's "0.00"
            const balanceStr = token.balance || "0.00";
            newBalances[token.symbol] = balanceStr;
            newAddresses[token.symbol] = hyperEVMAddress; // All tokens use same address
            // Cache token balance (cache even zero balances)
            if (activeWallet) {
              BalanceCacheService.setCachedBalance(activeWallet.id, token.symbol, balanceStr);
            }
            // Remove from loading set
            if (isMounted) {
              setLoadingAssets(prev => {
                const next = new Set(prev);
                next.delete(token.symbol);
                return next;
              });
            }
          });
          
          // Update balances state (merge to preserve any existing balances)
          setBalances(prev => {
            const merged = { ...prev, ...newBalances };
            // Calculate total balance with merged balances
            calculateTotalBalance(merged);
            return merged;
          });
          setAddresses(prev => ({ ...prev, ...newAddresses }));

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
            // Cache the balance
            if (activeWallet) {
              BalanceCacheService.setCachedBalance(activeWallet.id, "HYPE", "0.00");
            }
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
    let lastWalletId = WalletService.getActiveWallet()?.id || null;
    const interval = setInterval(() => {
      const currentActive = WalletService.getActiveWallet();
      if (currentActive?.id !== lastWalletId) {
        lastWalletId = currentActive?.id || null;
        loadData();
      }
    }, 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isPreviewMode]);

  // Calculate total balance when balances change (but not on initial mount if we already calculated)
  useEffect(() => {
    if (Object.keys(balances).length > 0 && totalBalance === null && !loadingBalance) {
      calculateTotalBalance(balances);
    }
  }, [balances, calculateTotalBalance, totalBalance, loadingBalance]);

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
            {loadingBalance && totalBalance === null ? (
              <div className="h-8 w-32 bg-[var(--bg-tertiary)] rounded animate-pulse"></div>
            ) : (
              <div>
                <div className="text-3xl font-bold tracking-tight">
                  $
                  {totalBalance !== null && totalBalance !== undefined
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
                          token => {
                            // Check both balances state and token.balance property to handle timing issues
                            const balanceFromState = balances[token.symbol];
                            const balanceFromToken = token.balance;
                            const balance = parseFloat(balanceFromState || balanceFromToken || "0");
                            return balance > 0;
                          }
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
                      <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {hyperEVMAssets.map((asset, i) => {
                          // Check both balances state and token.balance to handle timing issues
                          const token = hyperEVMTokens.find(t => t.symbol === asset.symbol);
                          const balanceFromState = balances[asset.symbol];
                          const balanceFromToken = token?.balance;
                          const balance = parseFloat(balanceFromState || balanceFromToken || "0");
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
                        onReceive={() => handleReceive(asset)}
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
              onReceive={() => handleReceive(asset)}
            />
          ))}
        </div>

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

            {/* Privacy Coins Grid */}
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                  onReceive={() => handleReceive(asset)}
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
        onGenerateNewAddress={
          !isPreviewMode && receiveModal.symbol
            ? () => generateNewAddress(receiveModal.symbol)
            : undefined
        }
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
