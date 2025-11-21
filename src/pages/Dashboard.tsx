import { useEffect, useState } from "react";
import { ChainManager, SupportedChain } from "../services/chains/manager";
import { StorageService } from "../services/storage";
import { WalletService } from "../services/wallet";
import { TokenService, type TokenInfo } from "../services/tokens";
import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownLeft } from "lucide-react";
import ReceiveModal from "../components/ReceiveModal";
import SendModal from "../components/SendModal";
import AssetLogo from "../components/AssetLogo";

interface Asset {
  symbol: string;
  name: string;
  color: string;
  chainKey: SupportedChain;
}

export default function Dashboard() {
  const [balances, setBalances] = useState<Record<string, string>>({});
  const [addresses, setAddresses] = useState<Record<string, string>>({});
  const [hyperEVMTokens, setHyperEVMTokens] = useState<TokenInfo[]>([]);
  const [loading, setLoading] = useState(true);

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
    const load = async () => {
      const activeWallet = WalletService.getActiveWallet();

      if (!activeWallet) {
        setLoading(false);
        return;
      }

      // Use active wallet's mnemonic and private key
      const mnemonic = activeWallet.mnemonic;
      const privKey = activeWallet.privateKey;

      // Support all-in-one wallet: use private key for EVM, mnemonic for non-EVM
      // Need at least one of them
      if (!mnemonic && !privKey) {
        setLoading(false);
        return;
      }

      // Create manager with both secrets if available
      const manager = new ChainManager(
        privKey || undefined, // EVM secret (prefer private key)
        !!privKey, // Is private key
        mnemonic || undefined // Non-EVM secret (mnemonic)
      );
      const services = manager.getAllServices();

      const newBalances: Record<string, string> = {};
      const newAddresses: Record<string, string> = {};

      await Promise.all(
        services.map(async service => {
          try {
            // Fetch address first - this will validate the address
            const addr = await service.getAddress();
            console.log(
              `Successfully loaded address for ${service.symbol}:`,
              addr
            );
            newAddresses[service.symbol] = addr;

            const bal = await service.getBalance();
            newBalances[service.symbol] = bal;
          } catch (e: any) {
            console.error(`Failed to load ${service.symbol}:`, e);
            console.error(`Error details:`, e.message, e.stack);
            // Gracefully handle errors - show error state (same for all chains)
            newBalances[service.symbol] = "Error";
            if (!newAddresses[service.symbol])
              newAddresses[service.symbol] = "Address Error";
          }
        })
      );

      setBalances(newBalances);
      setAddresses(newAddresses);

      // Load HyperEVM tokens separately
      try {
        const hyperEVMService = manager.getService(SupportedChain.HYPEREVM);
        const hyperEVMAddress = await hyperEVMService.getAddress();
        const tokens = await TokenService.getHyperEVMTokens(hyperEVMAddress);
        setHyperEVMTokens(tokens);

        // Update balances for HyperEVM tokens
        tokens.forEach(token => {
          newBalances[token.symbol] = token.balance;
          newAddresses[token.symbol] = hyperEVMAddress; // All tokens use same address
        });
        setBalances(newBalances);
        setAddresses(newAddresses);
      } catch (e) {
        console.error("Failed to load HyperEVM tokens:", e);
      }

      setLoading(false);
    };

    load();

    // Refresh when active wallet changes (polling approach)
    const interval = setInterval(() => {
      const currentActive = WalletService.getActiveWallet();
      if (currentActive?.id !== WalletService.getActiveWallet()?.id) {
        load();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Build assets list - include all HyperEVM tokens instead of just HYPE
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

  // Add HyperEVM tokens as separate assets
  const hyperEVMAssets: Asset[] = hyperEVMTokens.map(token => ({
    symbol: token.symbol,
    name: token.name || token.symbol,
    color: "#00FF9D",
    chainKey: SupportedChain.HYPEREVM,
  }));

  // If no HyperEVM tokens detected yet, add HYPE as placeholder
  if (hyperEVMAssets.length === 0 && !loading) {
    hyperEVMAssets.push({
      symbol: "HYPE",
      name: "HyperEVM",
      color: "#00FF9D",
      chainKey: SupportedChain.HYPEREVM,
    });
  }

  const assets = [...hyperEVMAssets, ...baseAssets];

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
      </div>

      <div className="flex flex-col gap-4">
        {assets.map((asset, i) => (
          <motion.div
            key={asset.symbol}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-center justify-between p-4 rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] transition-all duration-200 group hover:border-[var(--border-secondary)]"
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
                {loading ? (
                  <div className="h-8 w-24 bg-[var(--bg-tertiary)] rounded animate-pulse mx-auto"></div>
                ) : (
                  balances[asset.symbol] || "0.00"
                )}
              </div>
            </div>

            <div className="text-right min-w-[100px] flex-shrink-0">
              <div className="text-xs text-[var(--text-secondary)]">
                ≈ $0.00 USD
              </div>
            </div>

            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0">
              <button
                onClick={() =>
                  setSendModal({
                    isOpen: true,
                    symbol: asset.symbol,
                    chainKey: asset.chainKey,
                  })
                }
                disabled={
                  balances[asset.symbol] === "Error" ||
                  parseFloat(balances[asset.symbol] || "0") === 0
                }
                className="p-3 bg-[var(--bg-tertiary)] rounded-xl hover:bg-[var(--text-primary)] hover:text-[var(--bg-primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Send"
              >
                <ArrowUpRight size={20} />
              </button>
              <button
                onClick={async () => {
                  // Use cached address if available
                  let address = addresses[asset.symbol];

                  // If no cached address, fetch it on-demand
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

                      const manager = new ChainManager(
                        privKey || undefined,
                        !!privKey,
                        mnemonic || undefined
                      );

                      const service = manager.getService(asset.chainKey);
                      address = await service.getAddress();

                      // Update cached address
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
                disabled={balances[asset.symbol] === "N/A"}
                className="p-3 bg-[var(--bg-tertiary)] rounded-xl hover:bg-[var(--text-primary)] hover:text-[var(--bg-primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Receive"
              >
                <ArrowDownLeft size={20} />
              </button>
            </div>
          </motion.div>
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
