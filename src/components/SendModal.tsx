import { useState } from "react";
import Modal from "./Modal";
import { Send } from "lucide-react";
import { ChainManager } from "../services/chains/manager";
import { NetworkService } from "../services/networks";
import { StorageService } from "../services/storage";
import { WalletService } from "../services/wallet";
import { SupportedChain } from "../services/chains/manager";

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

  const handleSend = async () => {
    if (!to || !amount) return;
    setLoading(true);
    setError(null);

    try {
      const mnemonic = StorageService.getMnemonic();
      const privKey = WalletService.getStoredPrivateKey();

      if (!mnemonic && !privKey) throw new Error("No wallet found");

      const enabledNetworks = NetworkService.getEnabledNetworks();
      const manager = new ChainManager(
        privKey || undefined, // EVM secret (prefer private key)
        !!privKey, // Is private key
        mnemonic || undefined, // Non-EVM secret (mnemonic)
        enabledNetworks // Network configurations
      );
      const service = manager.getService(chainKey as SupportedChain);

      const hash = await service.sendTransaction(to, amount);
      setTxHash(hash);
      setLoading(false);
    } catch (e: any) {
      setError(e.message || "Transaction failed");
      setLoading(false);
    }
  };

  const reset = () => {
    setTo("");
    setAmount("");
    setTxHash(null);
    setError(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={reset} title={`Send ${symbol}`}>
      <div className="space-y-6">
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
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-[var(--text-secondary)]">
                  Recipient Address
                </label>
                <input
                  type="text"
                  value={to}
                  onChange={e => setTo(e.target.value)}
                  className="w-full p-4 bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-xl font-mono text-sm outline-none focus:ring-2 focus:ring-hyper-green transition-all border border-[var(--border-primary)]"
                  placeholder={`Enter ${symbol} address`}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-[var(--text-secondary)]">
                  Amount
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
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
              disabled={loading || !to || !amount}
              className="w-full py-4 bg-hyper-green text-black rounded-xl font-bold text-lg hover:bg-hyper-dark transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                "Sending..."
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
