import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard,
  Repeat,
  Settings,
  ShieldCheck,
  History,
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
import { enableConsoleLogs, suppressConsoleLogs } from "../utils/consoleSuppress";
import { ConnectionStatusService, type AggregateStatus } from "../services/connectionStatus";

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [activeWallet, setActiveWallet] = useState<Wallet | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<AggregateStatus>({
    overall: 'connecting',
    chains: [],
    message: 'Initializing...',
  });
  const [isSwitchingWallet, setIsSwitchingWallet] = useState(false);

  // Subscribe to connection status changes
  useEffect(() => {
    const unsubscribe = ConnectionStatusService.subscribe((status) => {
      setConnectionStatus(status);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Console log suppression - enable/disable based on connection status
  useEffect(() => {
    if (connectionStatus.overall === 'connecting') {
      suppressConsoleLogs();
    } else {
      enableConsoleLogs();
    }
  }, [connectionStatus.overall]);

  const navItems = [
    { icon: LayoutDashboard, label: "Portfolio", path: "/" },
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

  // Clear connection status when switching wallets
  useEffect(() => {
    ConnectionStatusService.clearAll();
  }, [activeWallet?.id]);

  const handleSwitchWallet = async (walletId: string) => {
    setIsSwitchingWallet(true);
    setIsDropdownOpen(false);
    try {
      WalletService.switchWallet(walletId);
      setActiveWallet(WalletService.getActiveWallet());
      // Small delay for better UX
      await new Promise(resolve => setTimeout(resolve, 300));
      // Refresh the page to reload data with new wallet
      window.location.reload();
    } catch (e) {
      console.error("Failed to switch wallet:", e);
      setIsSwitchingWallet(false);
    }
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
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="absolute top-full left-0 right-0 mt-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl shadow-lg z-50 max-h-64 overflow-y-auto transition-colors"
              >
                <div className="p-2">
                  {wallets.map(wallet => (
                    <button
                      key={wallet.id}
                      onClick={() => handleSwitchWallet(wallet.id)}
                      disabled={isSwitchingWallet || activeWallet?.id === wallet.id}
                      className={clsx(
                        "w-full text-left p-3 rounded-lg transition-colors flex items-center justify-between",
                        activeWallet?.id === wallet.id
                          ? "bg-[var(--text-primary)] text-[var(--bg-primary)]"
                          : "hover:bg-[var(--hover-bg)] text-[var(--text-primary)]",
                        isSwitchingWallet && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm truncate flex items-center gap-2">
                          {isSwitchingWallet && activeWallet?.id === wallet.id ? (
                            <>
                              <Loader2 size={14} className="animate-spin" />
                              Switching...
                            </>
                          ) : (
                            wallet.name
                          )}
                        </div>
                        <div className="text-xs opacity-70 truncate">
                          {new Date(wallet.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      {activeWallet?.id === wallet.id && !isSwitchingWallet && (
                        <div className="w-2 h-2 bg-hyper-green rounded-full shrink-0 ml-2 animate-pulse"></div>
                      )}
                    </button>
                  ))}
                  <button
                    onClick={handleCreateWallet}
                    disabled={isSwitchingWallet}
                    className="w-full text-left p-3 rounded-lg hover:bg-[var(--hover-bg)] transition-colors flex items-center gap-3 text-[var(--text-secondary)] hover:text-[var(--text-primary)] mt-1 disabled:opacity-50 disabled:cursor-not-allowed"
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
            {connectionStatus.overall === 'connecting' ? (
              <>
                <Loader2 size={16} className="text-yellow-500 animate-spin" />
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-xs font-bold text-yellow-500">
                    STATUS: CONNECTING
                  </span>
                  {connectionStatus.message && (
                    <span className="text-xs text-yellow-400 mt-0.5 truncate" title={connectionStatus.message}>
                      {connectionStatus.message}
                    </span>
                  )}
                </div>
              </>
            ) : connectionStatus.overall === 'error' ? (
              <>
                <ShieldCheck size={16} className="text-red-500" />
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-xs font-bold text-red-500">
                    STATUS: ERROR
                  </span>
                  {connectionStatus.message && (
                    <span className="text-xs text-red-400 mt-0.5 truncate" title={connectionStatus.message}>
                      {connectionStatus.message}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <>
                <ShieldCheck size={16} className="text-green-500" />
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-xs font-bold text-green-500">
                    STATUS: SECURE
                  </span>
                  {connectionStatus.message && connectionStatus.message !== `Connected to ${connectionStatus.chains.length} chain(s)` && (
                    <span className="text-xs text-green-400 mt-0.5 truncate" title={connectionStatus.message}>
                      {connectionStatus.message}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
          <div className="w-full bg-[var(--bg-tertiary)] h-1.5 rounded-full overflow-hidden">
            {connectionStatus.overall === 'connecting' ? (
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ duration: 0.3 }}
                className="bg-yellow-500 h-full"
              />
            ) : connectionStatus.overall === 'error' ? (
              <div className="bg-red-500 h-full w-full" />
            ) : (
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ duration: 0.3 }}
                className="bg-green-500 h-full"
              />
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
