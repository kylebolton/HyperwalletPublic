import { useState, useEffect } from "react";
import { SwapService, type SwapQuote } from "../services/swap";
import {
  ZCashShieldService,
  type ShieldSwapQuote,
} from "../services/zcash-shield";
import { ChainManager, SupportedChain } from "../services/chains/manager";
import { WalletService } from "../services/wallet";
import { motion } from "framer-motion";
import { ArrowRightLeft, Shield, Wallet } from "lucide-react";

export default function Swap() {
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

  // Check if ZCash is involved (for Shield Swap branding)
  const isZCashSwap =
    from.toUpperCase() === "ZEC" || to.toUpperCase() === "ZEC";
  const isShieldSwap =
    isZCashSwap && (from.toUpperCase() === "ZEC" || to.toUpperCase() === "ZEC");

  const handleGetQuote = async () => {
    if (!amount) return;
    setLoading(true);

    // Handle shield swap for ZCash
    if (
      isShieldSwap &&
      (from.toUpperCase() === "ZEC" || to.toUpperCase() === "ZEC")
    ) {
      try {
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
      } catch (e: any) {
        console.error("Shield swap quote failed:", e);
        setSwapStatus(`Shield swap error: ${e.message}`);
      }
    } else {
      // Regular swap
      const q = await SwapService.getQuote(from, to, amount);
      setQuote(q);
      setShieldQuote(null);
    }

    setLoading(false);
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

        const manager = new ChainManager(
          privKey || undefined,
          !!privKey,
          mnemonic || undefined
        );

        const service = manager.getService(chainKey);
        const address = await service.getAddress();
        setWalletAddress(address);
      } catch (e: any) {
        console.error("Failed to fetch wallet address:", e);
        setWalletAddress(null);
      } finally {
        setLoadingWalletAddress(false);
      }
    };

    if (!useCustomDestination) {
      fetchWalletAddress();
    }
  }, [to, useCustomDestination]);

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

        const manager = new ChainManager(
          privKey || undefined,
          !!privKey,
          mnemonic || undefined
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
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
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
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] p-8 rounded-3xl shadow-sm transition-colors"
      >
        <div className="space-y-8">
          <div className="space-y-2">
            <label className="text-sm font-bold text-[var(--text-secondary)]">
              FROM
            </label>
            <div className="flex gap-4">
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="flex-1 text-3xl font-bold outline-none placeholder-[var(--text-tertiary)] text-[var(--text-primary)] bg-transparent transition-colors"
                placeholder="0.00"
              />
              <select
                value={from}
                onChange={e => {
                  setFrom(e.target.value);
                  setQuote(null);
                }}
                className="bg-[var(--bg-tertiary)] rounded-xl px-4 font-bold text-[var(--text-primary)] border border-[var(--border-primary)] transition-colors"
              >
                {currencies.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-center">
            <div className="bg-[var(--bg-tertiary)] p-3 rounded-full hover:bg-[var(--hover-bg)] cursor-pointer transition-colors">
              <ArrowRightLeft
                size={20}
                className="text-[var(--text-secondary)]"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-[var(--text-secondary)]">
              TO (ESTIMATED)
            </label>
            <div className="flex gap-4">
              <div className="flex-1 text-3xl font-bold text-[var(--text-primary)]">
                {quote ? quote.amountOut : "0.00"}
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
                }}
                className="bg-[var(--bg-tertiary)] rounded-xl px-4 font-bold text-[var(--text-primary)] border border-[var(--border-primary)] transition-colors"
              >
                {currencies.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
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
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                    useCustomDestination
                      ? "bg-[var(--text-primary)] text-[var(--bg-primary)]"
                      : "bg-[var(--bg-secondary)] text-[var(--text-primary)]"
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
                  {loadingWalletAddress ? (
                    <div className="text-sm text-[var(--text-secondary)] font-mono">
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
                        ? "border-red-300 focus:ring-2 focus:ring-red-200"
                        : "border-[var(--border-primary)] focus:ring-2 focus:ring-hyper-green"
                    }`}
                  />
                  {addressError && (
                    <p className="text-xs text-red-500 font-medium">
                      {addressError}
                    </p>
                  )}
                  {!addressError && destinationAddress && (
                    <p className="text-xs text-green-600 dark:text-green-400 font-medium transition-colors">
                      ✓ Valid {to} address
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {quote && (
            <div className="p-6 bg-[var(--bg-tertiary)] rounded-2xl text-sm space-y-3 text-[var(--text-primary)] border border-[var(--border-primary)] transition-colors">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border-primary)]">
                <span className="text-[var(--text-secondary)] font-medium">
                  Exchange Rate
                </span>
                <span className="font-bold text-lg">
                  1 {from} ≈ {parseFloat(quote.rate).toFixed(6)} {to}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-secondary)] font-medium">
                  Swap Provider
                </span>
                <div
                  className={`px-3 py-1 rounded-lg font-bold text-xs flex items-center gap-2 ${
                    quote.provider === "hyperswap"
                      ? "bg-hyper-green text-black"
                      : "bg-blue-500 text-white"
                  }`}
                >
                  {quote.provider === "hyperswap" ? (
                    <>
                      <Shield size={14} />
                      HyperEVM
                    </>
                  ) : (
                    "SwapZone"
                  )}
                </div>
              </div>
              {quote.provider === "hyperswap" && quote.builderFee && (
                <div className="flex justify-between items-center">
                  <span className="text-[var(--text-secondary)] font-medium">
                    Builder Fee (1%)
                  </span>
                  <span className="font-bold">
                    {quote.builderFee} {to}
                  </span>
                </div>
              )}
              {quote.provider === "swapzone" && quote.fee && (
                <div className="flex justify-between items-center">
                  <span className="text-[var(--text-secondary)] font-medium">
                    Platform Fee (1%)
                  </span>
                  <span className="font-bold">{quote.fee}</span>
                </div>
              )}
              <div className="pt-3 border-t border-[var(--border-primary)]">
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  {quote.provider === "hyperswap"
                    ? "Builder fee is deducted from your swap output. Swaps are executed directly on HyperEVM."
                    : "Platform fee is deducted from your swap output. Swaps are processed via SwapZone."}
                </p>
              </div>
            </div>
          )}

          <div className="pt-4 space-y-3">
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
              className="w-full py-5 bg-hyper-green text-black rounded-2xl font-bold text-xl hover:bg-hyper-dark transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
            >
              {loading
                ? "Processing..."
                : quote || shieldQuote
                ? "Confirm Swap"
                : "Get Quote"}
            </button>
            {!quote && !isZCashSwap && (
              <p className="text-xs text-center text-[var(--text-secondary)]">
                {isHyperEVMSwap
                  ? "HyperEVM swaps use HyperSwap for direct on-chain execution"
                  : "Swaps are processed via SwapZone for the best rates"}
              </p>
            )}
            {isZCashSwap && !quote && !shieldQuote && (
              <div className="space-y-3">
                <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-xl border border-blue-200 dark:border-blue-800 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-bold text-blue-900 dark:text-blue-400">
                      Shield Swap Mode
                    </span>
                    <Shield
                      size={18}
                      className="text-blue-600 dark:text-blue-400"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShieldMode("transparent")}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold transition-colors ${
                        shieldMode === "transparent"
                          ? "bg-blue-600 text-white"
                          : "bg-[var(--bg-primary)] text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
                      }`}
                    >
                      T → Z (Shield)
                    </button>
                    <button
                      onClick={() => setShieldMode("shielded")}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold transition-colors ${
                        shieldMode === "shielded"
                          ? "bg-blue-600 text-white"
                          : "bg-[var(--bg-primary)] text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
                      }`}
                    >
                      Z → T (Unshield)
                    </button>
                  </div>
                  <p className="text-xs text-blue-700 dark:text-blue-400 mt-2">
                    {shieldMode === "transparent"
                      ? "Convert transparent (t-address) to shielded (z-address) for privacy"
                      : "Convert shielded (z-address) to transparent (t-address)"}
                  </p>
                </div>
                <p className="text-xs text-center text-[var(--text-secondary)]">
                  Shield Swap enables private ZCash transactions between
                  transparent and shielded addresses
                </p>
              </div>
            )}
            {shieldQuote && (
              <div className="p-6 bg-blue-50 dark:bg-blue-950 rounded-2xl text-sm space-y-3 text-[var(--text-primary)] border border-blue-200 dark:border-blue-800 transition-colors">
                <div className="flex items-center justify-between pb-3 border-b border-blue-300 dark:border-blue-700">
                  <span className="text-blue-900 dark:text-blue-400 font-medium">
                    Shield Swap
                  </span>
                  <div className="px-3 py-1 bg-blue-600 text-white rounded-lg font-bold text-xs flex items-center gap-2">
                    <Shield size={14} />
                    {shieldQuote.fromType === "transparent" ? "T → Z" : "Z → T"}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-blue-800 dark:text-blue-400 font-medium">
                    Amount
                  </span>
                  <span className="font-bold">{shieldQuote.amount} ZEC</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-blue-800 dark:text-blue-400 font-medium">
                    Shield Fee
                  </span>
                  <span className="font-bold">{shieldQuote.fee} ZEC</span>
                </div>
                <div className="pt-3 border-t border-blue-300 dark:border-blue-700">
                  <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
                    Shield swap fee (0.1%) enables private transaction
                    conversion. Your funds will be{" "}
                    {shieldQuote.toType === "shielded"
                      ? "shielded"
                      : "unshielded"}
                    .
                  </p>
                </div>
              </div>
            )}
          </div>

          {swapStatus && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-4 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400 rounded-xl text-center font-medium transition-colors"
            >
              {swapStatus}
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
