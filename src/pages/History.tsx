import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownLeft, RefreshCw } from "lucide-react";
import { ChainManager, SupportedChain } from "../services/chains/manager";
import { StorageService } from "../services/storage";
import { WalletService } from "../services/wallet";
import { HistoryService, type Transaction } from "../services/history";

export default function History() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      const mnemonic = StorageService.getMnemonic();
      const privKey = WalletService.getStoredPrivateKey();

      // Support all-in-one wallet: use private key for EVM, mnemonic for non-EVM
      if (!mnemonic && !privKey) {
        setLoading(false);
        return;
      }

      const manager = new ChainManager(
        privKey || undefined, // EVM secret (prefer private key)
        !!privKey, // Is private key
        mnemonic || undefined // Non-EVM secret (mnemonic)
      );
      const services = manager.getAllServices();

      let allTxs: Transaction[] = [];

      // Fetch real history for all supported chains
      for (const service of services) {
        try {
          const addr = await service.getAddress();

          // Map service symbol to SupportedChain enum
          let chain: SupportedChain | null = null;
          if (service.symbol === "BTC") chain = SupportedChain.BTC;
          else if (service.symbol === "ETH") chain = SupportedChain.ETH;
          else if (service.symbol === "SOL") chain = SupportedChain.SOL;
          else if (service.symbol === "HYPE") chain = SupportedChain.HYPEREVM;
          else if (service.symbol === "XMR") chain = SupportedChain.XMR;

          if (chain) {
            const txs = await HistoryService.getHistory(chain, addr);
            allTxs = [...allTxs, ...txs];
          }
        } catch (e) {
          console.error(`Failed to fetch history for ${service.symbol}:`, e);
        }
      }

      // Sort by date desc
      allTxs.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      setTransactions(allTxs);
      setLoading(false);
    };

    fetchHistory();
  }, []);

  return (
    <div className="space-y-8">
      <h1 className="text-4xl font-bold tracking-tighter">History</h1>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="h-20 bg-[var(--bg-secondary)] rounded-2xl animate-pulse transition-colors"
            ></div>
          ))}
        </div>
      ) : transactions.length > 0 ? (
        <div className="space-y-4">
          {transactions.map(tx => (
            <motion.div
              key={tx.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center justify-between p-4 rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] hover:bg-[var(--hover-bg)] transition-colors"
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    tx.type === "receive"
                      ? "bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400"
                      : tx.type === "send"
                      ? "bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400"
                      : "bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400"
                  }`}
                >
                  {tx.type === "receive" && <ArrowDownLeft size={20} />}
                  {tx.type === "send" && <ArrowUpRight size={20} />}
                  {tx.type === "swap" && <RefreshCw size={20} />}
                </div>
                <div>
                  <div className="font-bold text-lg capitalize">{tx.type}</div>
                  <div className="text-[var(--text-secondary)] text-sm">
                    {tx.date}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-lg font-bold">
                  {tx.type === "send" ? "-" : "+"}
                  {tx.amount}{" "}
                  <span className="text-sm text-[var(--text-secondary)]">
                    {tx.asset}
                  </span>
                </div>
                <div className="text-xs font-bold text-green-500 dark:text-green-400 bg-green-50 dark:bg-green-950 px-2 py-1 rounded-full inline-block mt-1 transition-colors">
                  {tx.status}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-[var(--text-secondary)]">
          No transaction history found.
        </div>
      )}
    </div>
  );
}
