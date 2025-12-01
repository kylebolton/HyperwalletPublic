import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownLeft, RefreshCw, Filter, ArrowUpDown, History as HistoryIcon, ChevronDown } from "lucide-react";
import { ChainManager, SupportedChain } from "../services/chains/manager";
import { NetworkService } from "../services/networks";
import { WalletService } from "../services/wallet";
import { HistoryService, type Transaction } from "../services/history";
import { usePreviewMode } from "../contexts/PreviewModeContext";
import { PreviewDataService } from "../services/previewData";

export default function History() {
  const { isPreviewMode } = usePreviewMode();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<"all" | "send" | "receive" | "swap">("all");
  const [sortBy, setSortBy] = useState<"date" | "amount">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const fetchHistory = async () => {
      // If preview mode is enabled, use mock data
      if (isPreviewMode) {
        const mockTransactions = PreviewDataService.getMockTransactions();
        setTransactions(mockTransactions);
        setLoading(false);
        return;
      }

      const activeWallet = WalletService.getActiveWallet();

      if (!activeWallet) {
        setLoading(false);
        return;
      }

      // Use active wallet's mnemonic and private key
      const mnemonic = activeWallet.mnemonic;
      const privKey = activeWallet.privateKey;

      // Support all-in-one wallet: use private key for EVM, mnemonic for non-EVM
      if (!mnemonic && !privKey) {
        setLoading(false);
        return;
      }

      const enabledNetworks = NetworkService.getEnabledNetworks();
      const manager = new ChainManager(
        privKey || undefined, // EVM secret (prefer private key)
        !!privKey, // Is private key
        mnemonic || undefined, // Non-EVM secret (mnemonic)
        enabledNetworks // Network configurations
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
  }, [isPreviewMode]);

  // Filter and sort transactions
  const filteredAndSortedTransactions = transactions
    .filter(tx => filterType === "all" || tx.type === filterType)
    .sort((a, b) => {
      if (sortBy === "date") {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
      } else {
        const amountA = parseFloat(a.amount);
        const amountB = parseFloat(b.amount);
        return sortOrder === "desc" ? amountB - amountA : amountA - amountB;
      }
    });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
      <h1 className="text-4xl font-bold tracking-tighter">History</h1>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-secondary)] hover:bg-[var(--hover-bg)] border border-[var(--border-primary)] rounded-xl font-bold text-sm transition-colors"
        >
          <Filter size={18} />
          Filters
          <ChevronDown size={16} className={showFilters ? "rotate-180 transition-transform" : "transition-transform"} />
        </button>
      </div>

      {showFilters && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="p-4 bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-primary)] transition-colors"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-bold text-[var(--text-secondary)] mb-2 block">Filter by Type</label>
              <div className="flex gap-2 flex-wrap">
                {(["all", "send", "receive", "swap"] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                      filterType === type
                        ? "bg-hyper-green text-black"
                        : "bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--hover-bg)]"
                    }`}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-bold text-[var(--text-secondary)] mb-2 block">Sort by</label>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (sortBy === "date") {
                      setSortOrder(sortOrder === "desc" ? "asc" : "desc");
                    } else {
                      setSortBy("date");
                      setSortOrder("desc");
                    }
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 ${
                    sortBy === "date"
                      ? "bg-hyper-green text-black"
                      : "bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--hover-bg)]"
                  }`}
                >
                  Date
                  {sortBy === "date" && (
                    <ArrowUpDown size={14} className={sortOrder === "desc" ? "rotate-180" : ""} />
                  )}
                </button>
                <button
                  onClick={() => {
                    if (sortBy === "amount") {
                      setSortOrder(sortOrder === "desc" ? "asc" : "desc");
                    } else {
                      setSortBy("amount");
                      setSortOrder("desc");
                    }
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 ${
                    sortBy === "amount"
                      ? "bg-hyper-green text-black"
                      : "bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--hover-bg)]"
                  }`}
                >
                  Amount
                  {sortBy === "amount" && (
                    <ArrowUpDown size={14} className={sortOrder === "desc" ? "rotate-180" : ""} />
                  )}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="h-20 bg-[var(--bg-secondary)] rounded-2xl animate-pulse transition-colors"
            ></div>
          ))}
        </div>
      ) : filteredAndSortedTransactions.length > 0 ? (
        <div className="space-y-4">
          {filteredAndSortedTransactions.map(tx => (
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
                <div
                  className={`text-xs font-bold px-2 py-1 rounded-full inline-block mt-1 transition-colors ${
                    tx.status === "confirmed" || tx.status === "success"
                      ? "text-green-500 dark:text-green-400 bg-green-50 dark:bg-green-950"
                      : tx.status === "pending"
                      ? "text-yellow-500 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950"
                      : "text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950"
                  }`}
                >
                  {tx.status}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-20 bg-[var(--bg-secondary)] rounded-3xl border border-[var(--border-primary)] transition-colors"
        >
          <HistoryIcon size={64} className="mx-auto mb-6 text-[var(--text-tertiary)]" />
          <h2 className="text-2xl font-bold mb-2">
            {filterType !== "all" ? `No ${filterType} transactions found` : "No transaction history found"}
          </h2>
          <p className="text-[var(--text-secondary)] mb-6 max-w-md mx-auto">
            {filterType !== "all"
              ? `Try changing the filter to see other transaction types.`
              : "Your transaction history will appear here once you start sending, receiving, or swapping assets."}
          </p>
          {filterType !== "all" && (
            <button
              onClick={() => setFilterType("all")}
              className="px-6 py-3 bg-hyper-green text-black rounded-xl font-bold hover:bg-hyper-dark transition-colors"
            >
              Show All Transactions
            </button>
          )}
        </motion.div>
      )}
    </div>
  );
}
