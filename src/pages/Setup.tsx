import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { WalletService } from "../services/wallet";
import { motion } from "framer-motion";
import { ArrowLeft, Key, FileText, Wallet as WalletIcon } from "lucide-react";
import type { Wallet } from "../services/storage";

export default function Setup({ onComplete }: { onComplete: () => void }) {
  const navigate = useNavigate();
  const [step, setStep] = useState<"welcome" | "create" | "import">("welcome");
  const [importType, setImportType] = useState<"phrase" | "privateKey">(
    "phrase"
  );
  const [walletName, setWalletName] = useState<string>("");
  const [mnemonic, setMnemonic] = useState<string>("");
  const [importInput, setImportInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [existingWallets, setExistingWallets] = useState<Wallet[]>([]);

  useEffect(() => {
    const wallets = WalletService.getAllWallets();
    setExistingWallets(wallets);
  }, []);

  const handleCreate = async () => {
    if (!walletName.trim()) {
      setError("Please enter a wallet name");
      return;
    }

    try {
      const newWallet = await WalletService.createNewWallet(walletName.trim());
      setMnemonic(newWallet.mnemonic || "");
      setStep("create");
      setError(null);
    } catch (e: any) {
      setError(e.message || "Failed to create wallet");
    }
  };

  const handleImport = async () => {
    setError(null);
    const cleanInput = importInput.trim();
    const cleanName = walletName.trim();

    if (!cleanName) {
      setError("Please enter a wallet name");
      return;
    }

    try {
      await WalletService.importNewWallet(
        cleanName,
        cleanInput,
        importType === "privateKey"
      );
      onComplete();
      navigate("/");
    } catch (e: any) {
      setError(
        e.message ||
          (importType === "phrase"
            ? "Invalid mnemonic phrase. Check your spelling."
            : "Invalid private key. Check format (hex).")
      );
    }
  };

  const handleSwitchWallet = (walletId: string) => {
    WalletService.switchWallet(walletId);
    onComplete();
    navigate("/");
  };

  const handleConfirm = () => {
    onComplete();
    // Navigate to dashboard after wallet creation is confirmed
    navigate("/");
  };

  return (
    <div className="flex h-screen items-center justify-center bg-[var(--bg-primary)] selection:bg-hyper-green selection:text-black transition-colors">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md p-8"
      >
        <div className="text-5xl font-black mb-4 text-center tracking-tighter flex justify-center items-center gap-2">
          HYPER<div className="w-3 h-3 bg-hyper-green rounded-full"></div>
        </div>
        <p className="text-xs text-[var(--text-secondary)] mb-12 text-center">
          Made by Liquyn Labs
        </p>

        {step === "welcome" && (
          <div className="space-y-4">
            {existingWallets.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-bold text-[var(--text-secondary)] mb-3">
                  Existing Wallets
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {existingWallets.map(wallet => (
                    <button
                      key={wallet.id}
                      onClick={() => handleSwitchWallet(wallet.id)}
                      className="w-full flex items-center justify-between p-3 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-primary)] hover:bg-[var(--hover-bg)] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <WalletIcon
                          size={16}
                          className="text-[var(--text-secondary)]"
                        />
                        <span className="font-bold text-sm">{wallet.name}</span>
                      </div>
                      <span className="text-xs text-[var(--text-secondary)]">
                        {new Date(wallet.createdAt).toLocaleDateString()}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-bold text-[var(--text-secondary)]">
                Wallet Name
              </label>
              <input
                type="text"
                value={walletName}
                onChange={e => {
                  setWalletName(e.target.value);
                  setError(null);
                }}
                placeholder="Enter wallet name..."
                className="w-full p-4 bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-2xl text-sm outline-none focus:ring-2 focus:ring-hyper-green transition-all border border-[var(--border-primary)]"
                maxLength={50}
              />
            </div>

            <button
              onClick={handleCreate}
              className="w-full py-5 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-2xl font-bold text-lg hover:scale-105 transition-transform"
            >
              Create New Wallet
            </button>
            <button
              className="w-full py-5 bg-[var(--bg-secondary)] text-[var(--text-secondary)] rounded-2xl font-bold text-lg hover:bg-[var(--hover-bg)] transition-colors border border-[var(--border-primary)]"
              onClick={() => setStep("import")}
            >
              Import Wallet
            </button>
          </div>
        )}

        {step === "import" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            <div className="flex items-center gap-4">
              <button
                onClick={() => setStep("welcome")}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <ArrowLeft size={20} />
              </button>
              <h2 className="text-2xl font-bold">Import Wallet</h2>
            </div>

            <div className="flex p-1 bg-[var(--bg-tertiary)] rounded-xl">
              <button
                onClick={() => {
                  setImportType("phrase");
                  setError(null);
                  setImportInput("");
                }}
                className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                  importType === "phrase"
                    ? "bg-[var(--bg-primary)] text-[var(--text-primary)]"
                    : "text-[var(--text-secondary)]"
                }`}
              >
                <FileText size={16} /> Phrase
              </button>
              <button
                onClick={() => {
                  setImportType("privateKey");
                  setError(null);
                  setImportInput("");
                }}
                className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                  importType === "privateKey"
                    ? "bg-[var(--bg-primary)] text-[var(--text-primary)]"
                    : "text-[var(--text-secondary)]"
                }`}
              >
                <Key size={16} /> Private Key
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-[var(--text-secondary)]">
                Wallet Name
              </label>
              <input
                type="text"
                value={walletName}
                onChange={e => {
                  setWalletName(e.target.value);
                  setError(null);
                }}
                placeholder="Enter wallet name..."
                className="w-full p-4 bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-2xl text-sm outline-none focus:ring-2 focus:ring-hyper-green transition-all border border-[var(--border-primary)]"
                maxLength={50}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-[var(--text-secondary)]">
                {importType === "phrase" ? "Recovery Phrase" : "Private Key"}
              </label>
              <textarea
                value={importInput}
                onChange={e => {
                  setImportInput(e.target.value);
                  setError(null);
                }}
                className="w-full p-4 bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-2xl h-32 font-mono text-sm outline-none focus:ring-2 focus:ring-hyper-green transition-all resize-none border border-[var(--border-primary)]"
                placeholder={
                  importType === "phrase"
                    ? "Enter your 12 or 24 word recovery phrase..."
                    : "Enter your private key (0x...)"
                }
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-950 text-red-500 dark:text-red-400 rounded-xl text-sm font-bold text-center transition-colors">
                {error}
              </div>
            )}

            <button
              onClick={handleImport}
              disabled={!importInput || !walletName.trim()}
              className="w-full py-5 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-2xl font-bold text-lg hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Import Wallet
            </button>
          </motion.div>
        )}

        {step === "create" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-8"
          >
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Backup Phrase</h2>
              <p className="text-[var(--text-secondary)]">
                Write these words down in order.
              </p>
            </div>

            <div className="p-8 bg-[var(--bg-secondary)] rounded-3xl grid grid-cols-3 gap-x-4 gap-y-6 font-mono text-sm border border-[var(--border-primary)] transition-colors">
              {mnemonic.split(" ").map((word, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-[var(--text-tertiary)] select-none w-4 text-right">
                    {i + 1}
                  </span>
                  <span className="font-bold text-[var(--text-primary)]">
                    {word}
                  </span>
                </div>
              ))}
            </div>
            <button
              onClick={handleConfirm}
              className="w-full py-5 bg-hyper-green text-black rounded-2xl font-bold text-lg hover:bg-hyper-dark transition-all hover:-translate-y-1"
            >
              I have saved it
            </button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
