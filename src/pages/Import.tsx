import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { WalletService } from "../services/wallet";
import { motion } from "framer-motion";
import { Key, FileText, CheckCircle } from "lucide-react";
import clsx from "clsx";

export default function Import() {
  const navigate = useNavigate();
  const [importType, setImportType] = useState<"phrase" | "privateKey">(
    "phrase"
  );
  const [importInput, setImportInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleImport = async () => {
    setError(null);
    setSuccess(false);
    const cleanInput = importInput.trim();

    if (!cleanInput) {
      setError("Please enter a recovery phrase or private key");
      return;
    }

    const isValid = await WalletService.importWallet(
      cleanInput,
      importType === "privateKey"
    );

    if (isValid) {
      setSuccess(true);
      setTimeout(() => {
        navigate("/");
        window.location.reload(); // Reload to refresh wallet state
      }, 1500);
    } else {
      setError(
        importType === "phrase"
          ? "Invalid mnemonic phrase. Please check your spelling and try again."
          : "Invalid private key. Please check the format (hex, with or without 0x prefix)."
      );
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tighter mb-2">
          Import Wallet
        </h1>
        <p className="text-[var(--text-secondary)]">
          Import an existing wallet using a recovery phrase or private key
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl"
      >
        <div className="bg-[var(--bg-secondary)] p-8 rounded-3xl border border-[var(--border-primary)] space-y-6 transition-colors">
          <div className="flex p-1 bg-[var(--bg-tertiary)] rounded-xl">
            <button
              onClick={() => {
                setImportType("phrase");
                setError(null);
                setImportInput("");
                setSuccess(false);
              }}
              className={clsx(
                "flex-1 py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all",
                importType === "phrase"
                  ? "bg-[var(--bg-primary)] text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              )}
            >
              <FileText size={18} /> Recovery Phrase
            </button>
            <button
              onClick={() => {
                setImportType("privateKey");
                setError(null);
                setImportInput("");
                setSuccess(false);
              }}
              className={clsx(
                "flex-1 py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all",
                importType === "privateKey"
                  ? "bg-[var(--bg-primary)] text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              )}
            >
              <Key size={18} /> Private Key (EVM)
            </button>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-[var(--text-secondary)]">
              {importType === "phrase"
                ? "Recovery Phrase (12 or 24 words)"
                : "Private Key (Hex format)"}
            </label>
            <textarea
              value={importInput}
              onChange={e => setImportInput(e.target.value)}
              className="w-full p-4 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-2xl h-40 font-mono text-sm outline-none focus:ring-2 focus:ring-hyper-green transition-all resize-none border border-[var(--border-primary)]"
              placeholder={
                importType === "phrase"
                  ? "Enter your 12 or 24 word recovery phrase..."
                  : "Enter your EVM private key (0x... or hex format)..."
              }
              disabled={success}
            />
            {importType === "phrase" && (
              <p className="text-xs text-[var(--text-secondary)]">
                Enter your recovery phrase words separated by spaces. This will
                replace your current wallet.
              </p>
            )}
            {importType === "privateKey" && (
              <p className="text-xs text-[var(--text-secondary)]">
                Enter your EVM-compatible private key. Note: Private keys only
                work with EVM chains (ETH, HYPE). BTC, SOL, and XMR require a
                recovery phrase.
              </p>
            )}
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-red-50 dark:bg-red-950 text-red-500 dark:text-red-400 rounded-xl text-sm font-bold transition-colors"
            >
              {error}
            </motion.div>
          )}

          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors"
            >
              <CheckCircle size={20} />
              Wallet imported successfully! Redirecting...
            </motion.div>
          )}

          <button
            onClick={handleImport}
            disabled={!importInput || success}
            className={clsx(
              "w-full py-4 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-2xl font-bold text-lg transition-all",
              success
                ? "opacity-50 cursor-not-allowed"
                : "hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {success ? "Imported!" : "Import Wallet"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
