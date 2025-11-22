import { useState, useEffect } from "react";
import { SwapService, type SwapQuote } from "../services/swap";
import {
  ZCashShieldService,
  type ShieldSwapQuote,
} from "../services/zcash-shield";
import { ChainManager, SupportedChain } from "../services/chains/manager";
import { NetworkService } from "../services/networks";
import { WalletService } from "../services/wallet";
import { usePreviewMode } from "../contexts/PreviewModeContext";
import { PreviewDataService } from "../services/previewData";
import { motion } from "framer-motion";
import { ArrowRightLeft, Shield, Wallet } from "lucide-react";

export default function Swap() {
  const { isPreviewMode } = usePreviewMode();
  const [from, setFrom] = useState("HYPEREVM");
  const [to, setTo] = useState("XMR");
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [shieldQuote, setShieldQuote] = useState<ShieldSwapQuote | null>(null);
  const [shieldMode, setShieldMode] = useState<"transparent" | "shielded">(
    "transparent"
  );
  const [loading, setLoading] = useState(false);
  const [swapStatus, setSwapStatus] = useState<string | null>(null);
  const [useCustomDestination, setUseCustomDestination] = useState(false);
  const [destinationAddress, setDestinationAddress] = useState("");
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [loadingWalletAddress, setLoadingWalletAddress] = useState(false);
  const [walletInitStatus, setWalletInitStatus] = useState<string | null>(null);
  const [shieldProofEnabled, setShieldProofEnabled] = useState(false);

  // Check if ZCash is involved (for Shield Swap branding)
  const isZCashSwap =
    from.toUpperCase() === "ZEC" || to.toUpperCase() === "ZEC";
  const isShieldSwap =
    isZCashSwap && (from.toUpperCase() === "ZEC" || to.toUpperCase() === "ZEC");

  const handleGetQuote = async () => {
    if (!amount) return;
    setLoading(true);
    setSwapStatus(null);

    try {
      // Handle shield swap for ZCash
      if (
        isShieldSwap &&
        (from.toUpperCase() === "ZEC" || to.toUpperCase() === "ZEC")
      ) {
        if (isPreviewMode) {
          // Mock shield swap quote for preview mode
          const fee = (parseFloat(amount) * 0.001).toFixed(8);
          const mockQuote: ShieldSwapQuote = {
            fromAddress: "t1MockAddress123456789",
            toAddress: "t1MockAddress123456789",
            fromType: shieldMode === "transparent" ? "transparent" : "shielded",
            toType: shieldMode === "transparent" ? "shielded" : "transparent",
            amount: (parseFloat(amount) - parseFloat(fee)).toFixed(8),
            fee: fee,
          };
          setShieldQuote(mockQuote);
          setQuote(null);
        } else {
          const fromType =
            shieldMode === "transparent" ? "transparent" : "shielded";
          const toType =
            shieldMode === "transparent" ? "shielded" : "transparent";
          const sq = await ZCashShieldService.getShieldSwapQuote(
            fromType,
            toType,
            amount
          );
          setShieldQuote(sq);
          setQuote(null);
        }
      } else {
        // Regular swap
        if (isPreviewMode) {
          // Use preview market data for calculations
          const mockMarketData = PreviewDataService.getMockMarketData();
          const fromSymbol = from.toUpperCase() === "HYPEREVM" ? "HYPE" : from;
          const toSymbol = to.toUpperCase() === "HYPEREVM" ? "HYPE" : to;
          const fromPrice = mockMarketData[from]?.current_price || mockMarketData[fromSymbol]?.current_price || 0;
          const toPrice = mockMarketData[to]?.current_price || mockMarketData[toSymbol]?.current_price || 1;

          if (!fromPrice) {
            throw new Error(`Price for ${from} not found`);
          }

          const isHyperEVMSwap = from.toUpperCase() === "HYPEREVM" || to.toUpperCase() === "HYPEREVM";
          const rate = fromPrice / toPrice;
          const amountNum = parseFloat(amount);
          
          let amountOut: number;
          let builderFee: string | undefined;
          
          if (isHyperEVMSwap) {
            // HyperSwap: builder fee is 1% of output, deducted from output
            const amountOutBeforeFee = amountNum * rate;
            builderFee = (amountOutBeforeFee * 0.01).toFixed(6);
            amountOut = amountOutBeforeFee * 0.99; // Deduct 1% builder fee
          } else {
            // SwapZone: platform fee is 1% of input, deducted from output
            const platformFee = amountNum * 0.01;
            const amountAfterFee = amountNum - platformFee;
            amountOut = amountAfterFee * rate;
          }

          const mockQuote: SwapQuote = {
            fromCurrency: from,
            toCurrency: to,
            amountIn: amount,
            amountOut: amountOut.toFixed(6),
            rate: rate.toFixed(6),
            fee: isHyperEVMSwap ? "0" : (amountNum * 0.01).toFixed(6) + " " + from,
            provider: isHyperEVMSwap ? "hyperswap" : "swapzone",
            builderFee: builderFee,
          };
          setQuote(mockQuote);
          setShieldQuote(null);
        } else {
          const q = await SwapService.getQuote(from, to, amount);
          setQuote(q);
          setShieldQuote(null);
        }
      }
    } catch (e: any) {
      console.error("Quote failed:", e);
      setSwapStatus(`Error: ${e.message || "Failed to get quote"}`);
      setQuote(null);
      setShieldQuote(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSwap = async () => {
    // Determine destination address
    let destAddress: string;
    if (useCustomDestination) {
      if (!destinationAddress || addressError) {
        setSwapStatus("Please enter a valid destination address");
        return;
      }
      destAddress = destinationAddress.trim();
    } else {
      if (!walletAddress) {
        setSwapStatus("Failed to get wallet address. Please try again.");
        return;
      }
      destAddress = walletAddress;
    }

    if (isPreviewMode) {
      // Mock swap execution for preview mode
      setLoading(true);
      setTimeout(() => {
        if (shieldQuote) {
          setSwapStatus(`Preview: Shield swap would execute! Amount: ${shieldQuote.amount} ${to}, Fee: ${shieldQuote.fee} ZEC`);
        } else if (quote) {
          setSwapStatus(`Preview: Swap would execute! You would receive ${quote.amountOut} ${to} for ${quote.amountIn} ${from}`);
        }
        setLoading(false);
      }, 1000);
      return;
    }

    if (shieldQuote) {
      // Handle shield swap
      setLoading(true);
      try {
        const res = await ZCashShieldService.executeShieldSwap(
          shieldQuote,
          destAddress
        );
        setSwapStatus(`Shield swap initiated! Transaction: ${res.txHash}`);
      } catch (e: any) {
        setSwapStatus(`Shield swap error: ${e.message}`);
      }
      setLoading(false);
      return;
    }

    if (!quote) return;
    setLoading(true);
    try {
      const res = await SwapService.createSwap(quote, destAddress);
      setSwapStatus(`Swap initiated! Deposit to: ${res.depositAddress}`);
    } catch (e: any) {
      setSwapStatus(`Swap error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const currencies = ["HYPEREVM", "BTC", "ETH", "SOL", "XMR", "ZEC"];

  // Map currency symbol to chain key
  const getChainKey = (currency: string): SupportedChain | null => {
    const upper = currency.toUpperCase();
    if (upper === "HYPEREVM" || upper === "HYPE")
      return SupportedChain.HYPEREVM;
    if (upper === "BTC") return SupportedChain.BTC;
    if (upper === "ETH") return SupportedChain.ETH;
    if (upper === "SOL") return SupportedChain.SOL;
    if (upper === "XMR") return SupportedChain.XMR;
    if (upper === "ZEC") return SupportedChain.ZEC;
    return null;
  };

  // Fetch wallet address for target currency
  useEffect(() => {
    const fetchWalletAddress = async () => {
      const chainKey = getChainKey(to);
      if (!chainKey) {
        setWalletAddress(null);
        return;
      }

      // In preview mode, use mock addresses
      if (isPreviewMode) {
        const mockAddresses = PreviewDataService.getMockAddresses();
        const symbol = to.toUpperCase() === "HYPEREVM" ? "HYPE" : to;
        setWalletAddress(mockAddresses[symbol] || mockAddresses[to] || "0x0000000000000000000000000000000000000000");
        setLoadingWalletAddress(false);
        return;
      }

      setLoadingWalletAddress(true);
      try {
        const activeWallet = WalletService.getActiveWallet();
        if (!activeWallet) {
          setWalletAddress(null);
          setLoadingWalletAddress(false);
          return;
        }

        const mnemonic = activeWallet.mnemonic;
        const privKey = activeWallet.privateKey;

        if (!mnemonic && !privKey) {
          setWalletAddress(null);
          setLoadingWalletAddress(false);
          return;
        }

        const enabledNetworks = NetworkService.getEnabledNetworks();
        const manager = new ChainManager(
          privKey || undefined,
          !!privKey,
          mnemonic || undefined,
          enabledNetworks
        );

        const service = manager.getService(chainKey);
        
        // Check if service has init method and initialize if needed
        if ('init' in service && typeof service.init === 'function') {
          setWalletInitStatus(`Initializing ${to} wallet...`);
          try {
            await service.init();
            setWalletInitStatus(`${to} wallet initialized successfully!`);
            // Small delay to show success message
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (initError: any) {
            console.error("Failed to initialize wallet:", initError);
            setWalletInitStatus(`Initialization failed: ${initError.message || 'Unknown error'}`);
            setWalletAddress(null);
            setLoadingWalletAddress(false);
            return;
          }
        }
        
        setWalletInitStatus("Getting address...");
        const address = await service.getAddress();
        setWalletAddress(address);
        setWalletInitStatus(null); // Clear status once address is loaded
      } catch (e: any) {
        console.error("Failed to fetch wallet address:", e);
        setWalletAddress(null);
        setWalletInitStatus(null);
      } finally {
        setLoadingWalletAddress(false);
      }
    };

    if (!useCustomDestination) {
      fetchWalletAddress();
    }
  }, [to, useCustomDestination, isPreviewMode]);

  // Validate destination address when custom destination is used
  useEffect(() => {
    if (!useCustomDestination || !destinationAddress) {
      setAddressError(null);
      return;
    }

    const validateAddress = async () => {
      const chainKey = getChainKey(to);
      if (!chainKey) {
        setAddressError("Invalid currency");
        return;
      }

      try {
        const activeWallet = WalletService.getActiveWallet();
        if (!activeWallet) {
          setAddressError("No wallet found");
          return;
        }

        const mnemonic = activeWallet.mnemonic;
        const privKey = activeWallet.privateKey;

        if (!mnemonic && !privKey) {
          setAddressError("No wallet credentials");
          return;
        }

        const enabledNetworks = NetworkService.getEnabledNetworks();
        const manager = new ChainManager(
          privKey || undefined,
          !!privKey,
          mnemonic || undefined,
          enabledNetworks
        );

        const service = manager.getService(chainKey);
        const isValid = service.validateAddress(destinationAddress);

        if (isValid) {
          setAddressError(null);
        } else {
          setAddressError(`Invalid ${to} address format`);
        }
      } catch (e: any) {
        setAddressError(`Validation error: ${e.message}`);
      }
    };

    const timeoutId = setTimeout(validateAddress, 500);
    return () => clearTimeout(timeoutId);
  }, [destinationAddress, to, useCustomDestination]);

  // Determine swap provider
  const swapProvider = quote?.provider || null;
  const isHyperEVMSwap =
    from.toUpperCase() === "HYPEREVM" ||
    from.toUpperCase() === "HYPE" ||
    to.toUpperCase() === "HYPEREVM" ||
    to.toUpperCase() === "HYPE";

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tighter flex items-center gap-3">
            {isZCashSwap ? (
              <>
                <Shield className="text-hyper-green" size={32} />
                Shield Swap
              </>
            ) : (
              <>
                <ArrowRightLeft className="text-hyper-green" size={32} />
                Swap
              </>
            )}
          </h1>
        </div>
        {swapProvider && (
          <div
            className={`px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 ${
              swapProvider === "hyperswap"
                ? "bg-hyper-green text-black"
                : "bg-blue-500 text-white"
            }`}
          >
            {swapProvider === "hyperswap" ? (
              <>
                <Shield size={16} />
                HyperEVM
              </>
            ) : (
              <>SwapZone</>
            )}
          </div>
        )}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] p-8 rounded-3xl transition-colors"
      >
        <div className="space-y-6">
          {/* From Section */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wide">
              From
            </label>
            <div className="flex gap-3 items-center">
              <div className="flex-1">
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="w-full text-4xl font-bold outline-none placeholder-[var(--text-tertiary)] text-[var(--text-primary)] bg-transparent transition-colors"
                  placeholder="0.00"
                />
              </div>
              <select
                value={from}
                onChange={e => {
                  setFrom(e.target.value);
                  setQuote(null);
                }}
                className="bg-[var(--bg-tertiary)] rounded-2xl px-6 py-4 font-bold text-[var(--text-primary)] border border-[var(--border-primary)] transition-colors cursor-pointer hover:bg-[var(--hover-bg)] min-w-[140px]"
              >
                {currencies.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Swap Arrow */}
          <div className="flex justify-center -my-2">
            <button
              onClick={() => {
                const temp = from;
                setFrom(to);
                setTo(temp);
                setQuote(null);
                setShieldQuote(null);
              }}
              className="bg-[var(--bg-tertiary)] p-4 rounded-full hover:bg-[var(--hover-bg)] transition-colors border border-[var(--border-primary)] hover:border-hyper-green group"
            >
              <ArrowRightLeft
                size={24}
                className="text-[var(--text-secondary)] group-hover:text-hyper-green transition-colors"
              />
            </button>
          </div>

          {/* To Section */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wide">
              To {quote && "(Estimated)"}
            </label>
            <div className="flex gap-3 items-center">
              <div className="flex-1">
                <div className="text-4xl font-bold text-[var(--text-primary)] min-h-[3rem] flex items-center">
                  {loading ? (
                    <div className="h-12 w-32 bg-[var(--bg-tertiary)] rounded animate-pulse"></div>
                  ) : quote ? (
                    quote.amountOut
                  ) : shieldQuote ? (
                    shieldQuote.amount
                  ) : (
                    "0.00"
                  )}
                </div>
              </div>
              <select
                value={to}
                onChange={e => {
                  setTo(e.target.value);
                  setQuote(null);
                  setShieldQuote(null);
                  setUseCustomDestination(false);
                  setDestinationAddress("");
                  setAddressError(null);
                  setWalletInitStatus(null);
                }}
                className="bg-[var(--bg-tertiary)] rounded-2xl px-6 py-4 font-bold text-[var(--text-primary)] border border-[var(--border-primary)] transition-colors cursor-pointer hover:bg-[var(--hover-bg)] min-w-[140px]"
              >
                {currencies.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Shield Proof Toggle */}
          <div className="p-6 bg-[var(--bg-tertiary)] rounded-2xl border border-[var(--border-primary)] transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield 
                  size={20} 
                  className={`transition-colors ${
                    shieldProofEnabled 
                      ? "text-hyper-green" 
                      : "text-[var(--text-secondary)]"
                  }`}
                />
                <div>
                  <label className="text-sm font-bold text-[var(--text-primary)] block">
                    Shield Proof
                  </label>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    Enable zero-knowledge privacy protection for this swap
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShieldProofEnabled(!shieldProofEnabled)}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-hyper-green focus:ring-offset-2 ${
                  shieldProofEnabled
                    ? "bg-hyper-green"
                    : "bg-[var(--bg-secondary)] border border-[var(--border-primary)]"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                    shieldProofEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            {shieldProofEnabled && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 pt-4 border-t border-[var(--border-primary)]"
              >
                <div className="flex items-start gap-2">
                  <Shield size={16} className="text-hyper-green mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    <p className="font-medium text-[var(--text-primary)] mb-1">
                      Privacy Protection Active
                    </p>
                    <p>
                      Your swap transaction will be protected with zero-knowledge proofs, 
                      ensuring your transaction amounts and addresses remain private.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Destination Address Section */}
          {(quote || shieldQuote) && (
            <div className="p-6 bg-[var(--bg-tertiary)] rounded-2xl space-y-4 border border-[var(--border-primary)] transition-colors">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-[var(--text-primary)]">
                  Destination Address
                </label>
                <button
                  onClick={() => {
                    setUseCustomDestination(!useCustomDestination);
                    setDestinationAddress("");
                    setAddressError(null);
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                    useCustomDestination
                      ? "bg-[var(--text-primary)] text-[var(--bg-primary)]"
                      : "bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-primary)]"
                  }`}
                >
                  {useCustomDestination ? "Custom" : "My Wallet"}
                </button>
              </div>

              {!useCustomDestination ? (
                <div className="p-4 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-primary)] transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <Wallet
                      size={16}
                      className="text-[var(--text-secondary)]"
                    />
                    <span className="text-xs font-medium text-[var(--text-secondary)]">
                      Your {to} Wallet Address
                    </span>
                  </div>
                  {walletInitStatus ? (
                    <div className="space-y-2">
                      {walletInitStatus.includes("Initializing") || walletInitStatus.includes("Getting address") ? (
                        <div className="text-sm text-[var(--text-primary)] font-medium flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-hyper-green border-t-transparent rounded-full animate-spin"></div>
                          {walletInitStatus}
                        </div>
                      ) : walletInitStatus.includes("initialized successfully") ? (
                        <div className="text-sm text-green-600 dark:text-green-400 font-medium flex items-center gap-2">
                          <span>✓</span>
                          {walletInitStatus}
                        </div>
                      ) : walletInitStatus.includes("Initialization failed") ? (
                        <div className="text-sm text-red-600 dark:text-red-400 font-medium">
                          {walletInitStatus}
                        </div>
                      ) : (
                        <div className="text-sm text-[var(--text-secondary)] font-mono flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-[var(--text-secondary)] border-t-transparent rounded-full animate-spin"></div>
                          {walletInitStatus}
                        </div>
                      )}
                    </div>
                  ) : loadingWalletAddress ? (
                    <div className="text-sm text-[var(--text-secondary)] font-mono flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-[var(--text-secondary)] border-t-transparent rounded-full animate-spin"></div>
                      Loading address...
                    </div>
                  ) : walletAddress ? (
                    <div className="text-sm font-mono text-[var(--text-primary)] break-all">
                      {walletAddress}
                    </div>
                  ) : (
                    <div className="text-sm text-[var(--text-secondary)]">
                      Unable to load wallet address
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={destinationAddress}
                    onChange={e => {
                      setDestinationAddress(e.target.value);
                      setAddressError(null);
                    }}
                    placeholder={`Enter ${to} address`}
                    className={`w-full p-4 bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-xl border font-mono text-sm outline-none transition-all ${
                      addressError
                        ? "border-red-500 focus:ring-2 focus:ring-red-500/20"
                        : "border-[var(--border-primary)] focus:ring-2 focus:ring-hyper-green/20 focus:border-hyper-green"
                    }`}
                  />
                  {addressError && (
                    <p className="text-xs text-red-500 font-medium flex items-center gap-1">
                      <span>⚠</span> {addressError}
                    </p>
                  )}
                  {!addressError && destinationAddress && (
                    <p className="text-xs text-green-500 dark:text-green-400 font-medium transition-colors flex items-center gap-1">
                      <span>✓</span> Valid {to} address
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {quote && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 bg-[var(--bg-tertiary)] rounded-2xl space-y-4 text-[var(--text-primary)] border border-[var(--border-primary)] transition-colors"
            >
              <div className="flex items-center justify-between pb-4 border-b border-[var(--border-primary)]">
                <span className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wide">
                  Exchange Rate
                </span>
                <span className="font-bold text-xl">
                  1 {from} ≈ {parseFloat(quote.rate).toFixed(6)} {to}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wide">
                  Swap Provider
                </span>
                <div
                  className={`px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 ${
                    quote.provider === "hyperswap"
                      ? "bg-hyper-green text-black"
                      : "bg-blue-500 text-white"
                  }`}
                >
                  {quote.provider === "hyperswap" ? (
                    <>
                      <Shield size={16} />
                      HyperEVM
                    </>
                  ) : (
                    "SwapZone"
                  )}
                </div>
              </div>
              {quote.provider === "hyperswap" && quote.builderFee && (
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm font-bold text-[var(--text-secondary)]">
                    Builder Fee (1%)
                  </span>
                  <span className="font-bold text-lg">
                    {quote.builderFee} {to}
                  </span>
                </div>
              )}
              {quote.provider === "swapzone" && quote.fee && (
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm font-bold text-[var(--text-secondary)]">
                    Platform Fee (1%)
                  </span>
                  <span className="font-bold text-lg">{quote.fee}</span>
                </div>
              )}
              <div className="pt-4 border-t border-[var(--border-primary)]">
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  {quote.provider === "hyperswap"
                    ? "Builder fee is deducted from your swap output. Swaps are executed directly on HyperEVM."
                    : "Platform fee is deducted from your swap output. Swaps are processed via SwapZone."}
                </p>
              </div>
            </motion.div>
          )}

          <div className="pt-4 space-y-4">
            <button
              onClick={quote || shieldQuote ? handleSwap : handleGetQuote}
              disabled={
                loading ||
                !amount ||
                (quote || shieldQuote
                  ? useCustomDestination
                    ? !destinationAddress || !!addressError
                    : !walletAddress
                  : false)
              }
              className="w-full py-5 bg-hyper-green text-black rounded-2xl font-bold text-lg hover:bg-hyper-dark transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                  Processing...
                </>
              ) : quote || shieldQuote ? (
                <>
                  Confirm Swap
                  <ArrowRightLeft size={20} className="group-hover:translate-x-1 transition-transform" />
                </>
              ) : (
                <>
                  Get Quote
                  <ArrowRightLeft size={20} />
                </>
              )}
            </button>
            {!quote && !isZCashSwap && !loading && (
              <p className="text-xs text-center text-[var(--text-secondary)]">
                {isHyperEVMSwap
                  ? "HyperEVM swaps use HyperSwap for direct on-chain execution"
                  : "Swaps are processed via SwapZone for the best rates"}
              </p>
            )}
            {isZCashSwap && !quote && !shieldQuote && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                <div className="p-6 bg-blue-50 dark:bg-blue-950 rounded-2xl border border-blue-200 dark:border-blue-800 transition-colors">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-bold text-blue-900 dark:text-blue-400 uppercase tracking-wide">
                      Shield Swap Mode
                    </span>
                    <Shield
                      size={20}
                      className="text-blue-600 dark:text-blue-400"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShieldMode("transparent")}
                      className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-colors ${
                        shieldMode === "transparent"
                          ? "bg-blue-600 text-white shadow-lg"
                          : "bg-[var(--bg-primary)] text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900"
                      }`}
                    >
                      T → Z (Shield)
                    </button>
                    <button
                      onClick={() => setShieldMode("shielded")}
                      className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-colors ${
                        shieldMode === "shielded"
                          ? "bg-blue-600 text-white shadow-lg"
                          : "bg-[var(--bg-primary)] text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900"
                      }`}
                    >
                      Z → T (Unshield)
                    </button>
                  </div>
                  <p className="text-xs text-blue-700 dark:text-blue-400 mt-3 leading-relaxed">
                    {shieldMode === "transparent"
                      ? "Convert transparent (t-address) to shielded (z-address) for privacy"
                      : "Convert shielded (z-address) to transparent (t-address)"}
                  </p>
                </div>
                <p className="text-xs text-center text-[var(--text-secondary)]">
                  Shield Swap enables private ZCash transactions between
                  transparent and shielded addresses
                </p>
              </motion.div>
            )}
            {shieldQuote && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 bg-blue-50 dark:bg-blue-950 rounded-2xl space-y-4 text-[var(--text-primary)] border border-blue-200 dark:border-blue-800 transition-colors"
              >
                <div className="flex items-center justify-between pb-4 border-b border-blue-300 dark:border-blue-700">
                  <span className="text-sm font-bold text-blue-900 dark:text-blue-400 uppercase tracking-wide">Shield Swap</span>
                  <div className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm flex items-center gap-2">
                    <Shield size={16} />
                    {shieldQuote.fromType === "transparent" ? "T → Z" : "Z → T"}
                  </div>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm font-bold text-blue-800 dark:text-blue-400">Amount</span>
                  <span className="font-bold text-lg">{shieldQuote.amount} ZEC</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm font-bold text-blue-800 dark:text-blue-400">Shield Fee</span>
                  <span className="font-bold text-lg">{shieldQuote.fee} ZEC</span>
                </div>
                <div className="pt-4 border-t border-blue-300 dark:border-blue-700">
                  <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
                    Shield swap fee (0.1%) enables private transaction
                    conversion. Your funds will be{" "}
                    {shieldQuote.toType === "shielded"
                      ? "shielded"
                      : "unshielded"}
                    .
                  </p>
                </div>
              </motion.div>
            )}
          </div>

          {swapStatus && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-4 rounded-xl text-center font-medium transition-colors ${
                swapStatus.includes("error") || swapStatus.includes("Error")
                  ? "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400"
                  : "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400"
              }`}
            >
              {swapStatus}
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
