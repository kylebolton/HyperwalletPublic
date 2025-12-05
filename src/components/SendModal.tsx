import { useState, useEffect } from "react";
import Modal from "./Modal";
import { Send, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { SupportedChain } from "../services/chains/manager";
import { createChainManagerFromActiveWallet } from "../services/chains/factory";

interface SendModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  chainKey: string; // key of SupportedChain
}

export default function SendModal({
  isOpen,
  onClose,
  symbol,
  chainKey,
}: SendModalProps) {
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [isValidatingAddress, setIsValidatingAddress] = useState(false);
  const [balance, setBalance] = useState<string | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);

  const handleSend = async () => {
    if (!to || !amount) return;
    
    if (addressError) {
      setError("Please enter a valid address");
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    if (balance && balance !== "Error" && balance !== "N/A") {
      const balanceNum = parseFloat(balance);
      if (!isNaN(balanceNum) && amountNum > balanceNum) {
        setError(`Insufficient balance. Available: ${balance} ${symbol}`);
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const manager = createChainManagerFromActiveWallet();
      const service = manager.getService(chainKey as SupportedChain);

      const hash = await service.sendTransaction(to.trim(), amount);
      setTxHash(hash);
      setLoading(false);
    } catch (e: any) {
      const errorMsg = e.message || "Transaction failed";
      setError(errorMsg);
      setLoading(false);
    }
  };

  // Load balance when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const loadBalance = async () => {
      setLoadingBalance(true);
      try {
        const manager = createChainManagerFromActiveWallet();
        const service = manager.getService(chainKey as SupportedChain);
        const bal = await service.getBalance();
        setBalance(bal);
      } catch (e) {
        console.error("Failed to load balance:", e);
        setBalance(null);
      } finally {
        setLoadingBalance(false);
      }
    };

    loadBalance();
  }, [isOpen, chainKey]);

  // Validate address when it changes
  useEffect(() => {
    if (!to || !isOpen) {
      setAddressError(null);
      setIsValidatingAddress(false);
      return;
    }

    const validateAddress = async () => {
      setIsValidatingAddress(true);
      setAddressError(null);

      try {
        const manager = createChainManagerFromActiveWallet();
        const service = manager.getService(chainKey as SupportedChain);
        const isValid = service.validateAddress(to.trim());

        if (isValid) {
          setAddressError(null);
        } else {
          setAddressError(`Invalid ${symbol} address format`);
        }
      } catch (e: any) {
        setAddressError(`Validation error: ${e.message || "Unknown error"}`);
      } finally {
        setIsValidatingAddress(false);
      }
    };

    const timeoutId = setTimeout(validateAddress, 500);
    return () => clearTimeout(timeoutId);
  }, [to, chainKey, symbol, isOpen]);

  const handleMaxAmount = () => {
    if (balance && balance !== "Error" && balance !== "N/A") {
      const balanceNum = parseFloat(balance);
      if (!isNaN(balanceNum) && balanceNum > 0) {
        // Leave a small amount for fees (0.001 or 1% whichever is smaller)
        const feeReserve = Math.min(balanceNum * 0.01, 0.001);
        const maxAmount = Math.max(0, balanceNum - feeReserve);
        setAmount(maxAmount.toFixed(8).replace(/\.?0+$/, ""));
      }
    }
  };

  const reset = () => {
    setTo("");
    setAmount("");
    setTxHash(null);
    setError(null);
    setAddressError(null);
    setBalance(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={reset} title={`Send ${symbol}`}>
      <div className="space-y-6 pb-2">
        {txHash ? (
          <div className="text-center space-y-4 py-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-600">
              <Send size={32} />
            </div>
            <h3 className="text-xl font-bold text-green-600">
              Sent Successfully!
            </h3>
            <p className="text-xs text-[var(--text-secondary)] break-all">{txHash}</p>
            <button
              onClick={reset}
              className="w-full py-3 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-xl font-bold transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            {balance !== null && (
              <div className="p-3 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-primary)] transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-[var(--text-secondary)]">Available Balance</span>
                  <span className="text-sm font-bold text-[var(--text-primary)]">
                    {loadingBalance ? (
                      <Loader2 size={14} className="animate-spin inline" />
                    ) : balance === "Error" || balance === "N/A" ? (
                      "N/A"
                    ) : (
                      `${balance} ${symbol}`
                    )}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-[var(--text-secondary)]">
                  Recipient Address
                </label>
                <div className="relative">
                <input
                  type="text"
                  value={to}
                    onChange={e => {
                      setTo(e.target.value);
                      setError(null);
                    }}
                    className={`w-full p-4 bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-xl font-mono text-sm outline-none focus:ring-2 transition-all border ${
                      addressError
                        ? "border-red-500 focus:ring-red-500/20"
                        : to && !addressError && !isValidatingAddress
                        ? "border-green-500 focus:ring-green-500/20"
                        : "border-[var(--border-primary)] focus:ring-hyper-green"
                    }`}
                  placeholder={`Enter ${symbol} address`}
                />
                  {to && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {isValidatingAddress ? (
                        <Loader2 size={16} className="text-[var(--text-secondary)] animate-spin" />
                      ) : addressError ? (
                        <XCircle size={16} className="text-red-500" />
                      ) : !addressError ? (
                        <CheckCircle size={16} className="text-green-500" />
                      ) : null}
                    </div>
                  )}
                </div>
                {addressError && (
                  <p className="text-xs text-red-500 font-medium flex items-center gap-1">
                    <XCircle size={12} />
                    {addressError}
                  </p>
                )}
                {!addressError && to && !isValidatingAddress && (
                  <p className="text-xs text-green-500 dark:text-green-400 font-medium flex items-center gap-1">
                    <CheckCircle size={12} />
                    Valid {symbol} address
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-[var(--text-secondary)]">
                  Amount
                </label>
                  {balance && balance !== "Error" && balance !== "N/A" && (
                    <button
                      onClick={handleMaxAmount}
                      className="text-xs font-bold text-hyper-green hover:text-hyper-dark transition-colors"
                    >
                      Max
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={e => {
                      const value = e.target.value;
                      if (value === "" || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0)) {
                        setAmount(value);
                        setError(null);
                      }
                    }}
                    min="0"
                    step="any"
                    className="w-full p-4 bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-xl text-lg font-bold outline-none focus:ring-2 focus:ring-hyper-green transition-all border border-[var(--border-primary)]"
                    placeholder="0.00"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-[var(--text-secondary)]">
                    {symbol}
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-950 text-red-500 dark:text-red-400 rounded-lg text-sm text-center transition-colors">
                {error}
              </div>
            )}

            <button
              onClick={handleSend}
              disabled={loading || !to || !amount || !!addressError || isValidatingAddress}
              className="w-full py-4 bg-hyper-green text-black rounded-xl font-bold text-lg hover:bg-hyper-dark transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  Send <Send size={18} />
                </>
              )}
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}
