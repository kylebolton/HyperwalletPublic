import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Repeat,
  Settings,
  ShieldCheck,
  History,
  BarChart2,
  Download,
  Wallet as WalletIcon,
  ChevronDown,
  Plus,
  Loader2,
} from "lucide-react";
import { motion } from "framer-motion";
import clsx from "clsx";
import { WalletService } from "../services/wallet";
import { ChainManager } from "../services/chains/manager";
import { NetworkService } from "../services/networks";
import type { Wallet } from "../services/storage";

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [activeWallet, setActiveWallet] = useState<Wallet | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(true);

  const navItems = [
    { icon: LayoutDashboard, label: "Portfolio", path: "/" },
    { icon: BarChart2, label: "Analytics", path: "/analytics" },
    { icon: History, label: "History", path: "/history" },
    { icon: Repeat, label: "Swap", path: "/swap" },
    { icon: Download, label: "Import", path: "/import" },
    { icon: Settings, label: "Settings", path: "/settings" },
  ];

  useEffect(() => {
    const loadWallets = () => {
      const allWallets = WalletService.getAllWallets();
      const active = WalletService.getActiveWallet();
      setWallets(allWallets);
      setActiveWallet(active);
    };

    loadWallets();

    // Refresh wallets when storage changes (wallet switch, create, etc.)
    const interval = setInterval(loadWallets, 1000);
    return () => clearInterval(interval);
  }, []);

  // Check and initialize wallet sync status
  useEffect(() => {
    let isMounted = true;
    let syncTimeout: NodeJS.Timeout;

    const checkWalletSync = async () => {
      try {
        const active = WalletService.getActiveWallet();
        
        if (!active) {
          if (isMounted) setIsSyncing(false);
          return;
        }

        const mnemonic = active.mnemonic;
        const privKey = active.privateKey;

        if (!mnemonic && !privKey) {
          if (isMounted) setIsSyncing(false);
          return;
        }

        // Set syncing to true while we check
        if (isMounted) setIsSyncing(true);

        // Get enabled network configs
        const enabledNetworks = NetworkService.getEnabledNetworks();

        // Create manager with both secrets if available
        const manager = new ChainManager(
          privKey || undefined,
          !!privKey,
          mnemonic || undefined,
          enabledNetworks
        );
        const services = manager.getAllServices();

        // Initialize services that need it
        const initPromises = services.map(async service => {
          try {
            if ('init' in service && typeof service.init === 'function') {
              await service.init();
            }
            // Try to get address to verify it's working
            await service.getAddress();
            return true;
          } catch (e) {
            console.warn(`${service.symbol}: Initialization/sync check failed:`, e);
            return false;
          }
        });

        // Wait for all initializations with timeout
        await Promise.race([
          Promise.all(initPromises),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Sync timeout")), 15000)
          ),
        ]);

        // All wallets synced
        if (isMounted) setIsSyncing(false);
      } catch (e) {
        console.warn("Wallet sync check failed:", e);
        // On error, still mark as synced after a delay (to show we tried)
        syncTimeout = setTimeout(() => {
          if (isMounted) setIsSyncing(false);
        }, 2000);
      }
    };

    checkWalletSync();

    // Re-check periodically
    const syncInterval = setInterval(checkWalletSync, 5000);

    return () => {
      isMounted = false;
      clearInterval(syncInterval);
      if (syncTimeout) clearTimeout(syncTimeout);
    };
  }, [activeWallet?.id]);

  const handleSwitchWallet = (walletId: string) => {
    WalletService.switchWallet(walletId);
    setActiveWallet(WalletService.getActiveWallet());
    setIsDropdownOpen(false);
    // Refresh the page to reload data with new wallet
    window.location.reload();
  };

  const handleCreateWallet = () => {
    navigate("/setup");
    setIsDropdownOpen(false);
  };

  return (
    <div className="flex h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans selection:bg-hyper-green selection:text-black transition-colors">
      <motion.div
        initial={{ x: -50, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="w-64 border-r border-[var(--border-primary)] p-6 flex flex-col justify-between shrink-0 transition-colors"
      >
        <div className="pt-8 pl-2">
          <div className="text-3xl font-black mb-2 tracking-tighter flex items-center gap-2">
            <div className="w-3 h-3 bg-hyper-green rounded-full"></div>
            HYPER<span className="text-[var(--text-tertiary)]">.</span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mb-6">
            Made by Liquyn Labs
          </p>

          {/* Wallet Switcher */}
          <div className="relative mb-6">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-full flex items-center justify-between p-3 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-primary)] hover:bg-[var(--hover-bg)] transition-colors group"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <WalletIcon
                  size={18}
                  className="text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] shrink-0 transition-colors"
                />
                <span className="font-bold text-sm truncate">
                  {activeWallet?.name || "No Wallet"}
                </span>
              </div>
              <ChevronDown
                size={16}
                className={clsx(
                  "text-[var(--text-secondary)] transition-transform shrink-0",
                  isDropdownOpen && "rotate-180"
                )}
              />
            </button>

            {isDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute top-full left-0 right-0 mt-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl shadow-lg z-50 max-h-64 overflow-y-auto transition-colors"
              >
                <div className="p-2">
                  {wallets.map(wallet => (
                    <button
                      key={wallet.id}
                      onClick={() => handleSwitchWallet(wallet.id)}
                      className={clsx(
                        "w-full text-left p-3 rounded-lg transition-colors flex items-center justify-between",
                        activeWallet?.id === wallet.id
                          ? "bg-[var(--text-primary)] text-[var(--bg-primary)]"
                          : "hover:bg-[var(--hover-bg)] text-[var(--text-primary)]"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm truncate">
                          {wallet.name}
                        </div>
                        <div className="text-xs opacity-70 truncate">
                          {new Date(wallet.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      {activeWallet?.id === wallet.id && (
                        <div className="w-2 h-2 bg-hyper-green rounded-full shrink-0 ml-2"></div>
                      )}
                    </button>
                  ))}
                  <button
                    onClick={handleCreateWallet}
                    className="w-full text-left p-3 rounded-lg hover:bg-[var(--hover-bg)] transition-colors flex items-center gap-3 text-[var(--text-secondary)] hover:text-[var(--text-primary)] mt-1"
                  >
                    <Plus size={16} />
                    <span className="font-bold text-sm">Create New Wallet</span>
                  </button>
                </div>
              </motion.div>
            )}
          </div>

          <nav className="space-y-4">
            {navItems.map(item => (
              <Link key={item.path} to={item.path}>
                <div
                  className={clsx(
                    "flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 group",
                    location.pathname === item.path
                      ? "bg-[var(--text-primary)] text-[var(--bg-primary)] scale-105"
                      : "text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]"
                  )}
                >
                  <item.icon
                    size={22}
                    className={clsx(
                      "transition-colors",
                      location.pathname === item.path
                        ? "text-hyper-green"
                        : "group-hover:text-[var(--text-primary)]"
                    )}
                  />
                  <span className="font-bold tracking-tight">{item.label}</span>
                </div>
              </Link>
            ))}
          </nav>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-primary)] transition-colors">
          <div className="flex items-center gap-3 mb-2">
            {isSyncing ? (
              <>
                <Loader2 size={16} className="text-yellow-500 animate-spin" />
                <span className="text-xs font-bold text-yellow-500">
                  STATUS: CONNECTING
                </span>
              </>
            ) : (
              <>
                <ShieldCheck size={16} className="text-green-500" />
                <span className="text-xs font-bold text-[var(--text-secondary)]">
                  STATUS: SECURE
                </span>
              </>
            )}
          </div>
          <div className="w-full bg-[var(--bg-tertiary)] h-1.5 rounded-full overflow-hidden">
            {isSyncing ? (
              <div className="bg-yellow-500 h-full w-full animate-pulse"></div>
            ) : (
              <div className="bg-green-500 h-full w-full animate-pulse"></div>
            )}
          </div>
        </div>
      </motion.div>

      <div className="flex-1 overflow-auto bg-[var(--bg-primary)] p-10 relative transition-colors">
        {/* Click outside to close dropdown */}
        {isDropdownOpen && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsDropdownOpen(false)}
          />
        )}
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="h-full"
        >
          <Outlet />
        </motion.div>
      </div>
    </div>
  );
}
