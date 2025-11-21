import React, { useEffect, useState, useCallback } from "react";
import { ChainManager, SupportedChain } from "../services/chains/manager";
import { StorageService } from "../services/storage";
import { WalletService } from "../services/wallet";
import { NetworkService } from "../services/networks";
import { TokenService, type TokenInfo } from "../services/tokens";
import { MarketService, type MarketData } from "../services/market";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpRight, ArrowDownLeft, ChevronDown, ChevronUp } from "lucide-react";
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
  index: number;
  marketData?: Record<string, MarketData>;
}

function AssetCard({
  asset,
  balance,
  address,
  isLoading,
  onSend,
  onReceive,
  index,
  marketData,
}: AssetCardProps) {
  // Calculate USD value
  const usdValue = React.useMemo(() => {
    if (isLoading || !marketData) return null;
    if (!balance || balance === "Error" || balance === "N/A") return 0;
    
    const balanceNum = parseFloat(balance);
    if (isNaN(balanceNum) || balanceNum === 0) return 0;
    
    // Try asset.symbol first, then fallback to common aliases
    const price = marketData[asset.symbol]?.current_price || 
                  marketData[asset.symbol === "HYPEREVM" ? "HYPE" : asset.symbol]?.current_price || 
                  0;
    
    if (!price || price === 0) return null;
    
    return balanceNum * price;
  }, [balance, marketData, asset.symbol, isLoading]);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-center justify-between p-4 transition-all duration-200 group hover:bg-[var(--hover-bg)]"
    >
      <div className="flex items-center gap-4 min-w-[200px] flex-shrink-0">
        <AssetLogo symbol={asset.symbol} size={48} />
        <div>
          <div className="font-bold text-lg">{asset.name}</div>
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
            `≈ $${usdValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`
          ) : (
            "≈ $0.00 USD"
          )}
        </div>
      </div>

      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0">
        <button
          onClick={onSend}
          disabled={
            balance === "Error" ||
            parseFloat(balance || "0") === 0
          }
          className="p-3 bg-[var(--bg-tertiary)] rounded-xl hover:bg-[var(--text-primary)] hover:text-[var(--bg-primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Send"
        >
          <ArrowUpRight size={20} />
        </button>
        <button
          onClick={onReceive}
          disabled={balance === "N/A"}
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

  // Calculate total balance in USD
  const calculateTotalBalance = useCallback(async (balanceData: Record<string, string>) => {
    try {
      setLoadingBalance(true);
      
      // Get all unique symbols from balances
      const symbols = Object.keys(balanceData).filter(
        symbol => balanceData[symbol] && balanceData[symbol] !== "Error" && balanceData[symbol] !== "N/A"
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
  }, []);

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

    const load = async () => {
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
              if ('init' in service && typeof service.init === 'function') {
                try {
                  await service.init();
                  console.log(`${service.symbol}: Wallet initialized successfully`);
                } catch (initError: any) {
                  console.warn(`${service.symbol}: Wallet initialization failed:`, initError);
                  // Continue anyway - some services can still work without init
                }
              }

              // Fetch address first - this will validate the address
              const addr = await service.getAddress();
              console.log(
                `Successfully loaded address for ${service.symbol}:`,
                addr
              );
              newAddresses[service.symbol] = addr;

              const bal = await service.getBalance();
              newBalances[service.symbol] = bal;
              
              // Remove from loading set when done
              if (isMounted) {
                setLoadingAssets(prev => {
                  const next = new Set(prev);
                  next.delete(service.symbol);
                  return next;
                });
              }
            } catch (e: any) {
              console.error(`Failed to load ${service.symbol}:`, e);
              // Gracefully handle errors - show error state (same for all chains)
              newBalances[service.symbol] = "Error";
              if (!newAddresses[service.symbol])
                newAddresses[service.symbol] = "Address Error";
              
              // Remove from loading set even on error
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

        // Race between loading and timeout
        try {
          await Promise.race([
            loadPromise,
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Load timeout")), 10000)
            ),
          ]);
        } catch (e) {
          console.warn("Load operation timed out or failed:", e);
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
            symbol => newBalances[symbol] && newBalances[symbol] !== "Error" && newBalances[symbol] !== "N/A"
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
          
          // Add timeout for token loading
          const tokenLoadPromise = TokenService.getHyperEVMTokens(hyperEVMAddress, true);
          const tokens = await Promise.race([
            tokenLoadPromise,
            new Promise<TokenInfo[]>((_, reject) =>
              setTimeout(() => reject(new Error("Token load timeout")), 8000)
            ),
          ]).catch(() => {
            // Return at least HYPE token on timeout
            return [{
              address: "0x0000000000000000000000000000000000000000",
              symbol: "HYPE",
              name: "HyperEVM",
              decimals: 18,
              balance: "0.00",
            }];
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
                symbol => newBalances[symbol] && newBalances[symbol] !== "Error" && newBalances[symbol] !== "N/A"
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
            if ('init' in hyperEVMService && typeof hyperEVMService.init === 'function') {
              try {
                await hyperEVMService.init();
              } catch (initError) {
                console.warn("HyperEVM initialization failed:", initError);
                // Continue anyway
              }
            }
            const hyperEVMAddress = await hyperEVMService.getAddress();
            setHyperEVMTokens([{
              address: "0x0000000000000000000000000000000000000000",
              symbol: "HYPE",
              name: "HyperEVM",
              decimals: 18,
              balance: "0.00",
            }]);
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
        if (isMounted) setLoadingAssets(new Set());
      }
    };

    load();

    // Refresh when active wallet changes (polling approach)
    const interval = setInterval(() => {
      const currentActive = WalletService.getActiveWallet();
      if (currentActive?.id !== WalletService.getActiveWallet()?.id) {
        load();
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

  // Build base assets (non-HyperEVM chains)
  const baseAssets: Asset[] = [
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

  // Convert HyperEVM tokens to assets
  const hyperEVMAssets: Asset[] = hyperEVMTokens.map(token => ({
    symbol: token.symbol,
    name: token.name || token.symbol,
    color: "#00FF9D",
    chainKey: SupportedChain.HYPEREVM,
  }));

  // Ensure HYPE is always present
  const hasHYPE = hyperEVMAssets.some(asset => asset.symbol === "HYPE");
  if (!hasHYPE && !loadingAssets.has("HYPE")) {
    hyperEVMAssets.unshift({
      symbol: "HYPE",
      name: "HyperEVM",
      color: "#00FF9D",
      chainKey: SupportedChain.HYPEREVM,
    });
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
        <div className="text-right">
          {loadingBalance ? (
            <div className="h-8 w-32 bg-[var(--bg-tertiary)] rounded animate-pulse"></div>
          ) : (
            <div>
              <div className="text-3xl font-bold tracking-tight">
                ${totalBalance !== null ? totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
              </div>
              <div className="text-xs text-[var(--text-secondary)] mt-1">
                Total Balance
              </div>
            </div>
          )}
        </div>
      </div>

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
                    {hyperEVMAssets.length} token{hyperEVMAssets.length !== 1 ? "s" : ""}
                  </div>
                </div>
              </div>
              {isHyperEVMExpanded ? (
                <ChevronUp size={20} className="text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors" />
              ) : (
                <ChevronDown size={20} className="text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors" />
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
                  <div className="border-t border-[var(--border-primary)] divide-y divide-[var(--border-primary)]">
                    {hyperEVMAssets.map((asset, i) => (
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
                              if ('init' in service && typeof service.init === 'function') {
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
                                    address: `Initialization failed: ${initError.message || 'Unknown error'}`,
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
                              console.error(
                                `Failed to get ${asset.symbol} address:`,
                                e
                              );
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
                        index={i}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Base Assets */}
        {baseAssets.map((asset, i) => (
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
                  if ('init' in service && typeof service.init === 'function') {
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
                        address: `Initialization failed: ${initError.message || 'Unknown error'}`,
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
                  console.error(
                    `Failed to get ${asset.symbol} address:`,
                    e
                  );
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
            index={i}
          />
        ))}
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
