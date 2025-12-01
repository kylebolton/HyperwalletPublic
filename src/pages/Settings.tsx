import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  BookUser,
  Wallet,
  Plus,
  Trash2,
  Key,
  CheckCircle2,
  Copy,
  Edit2,
  RefreshCw,
  Moon,
  Sun,
} from "lucide-react";
import { StorageService } from "../services/storage";
import { WalletService } from "../services/wallet";
import { NetworkService, type NetworkConfig } from "../services/networks";
import { SupportedChain } from "../services/chains/manager";
import { useTheme } from "../contexts/ThemeContext";
import type { Wallet as WalletType } from "../services/storage";
import Modal from "../components/Modal";

interface Contact {
  id: number;
  name: string;
  address: string;
}

interface WatchWallet {
  id: number;
  name: string;
  address: string;
  chain: string;
}

export default function Settings() {
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<
    "addressBook" | "wallets" | "myWallets" | "platformConfig"
  >("addressBook");

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [watchWallets, setWatchWallets] = useState<WatchWallet[]>([]);
  const [myWallets, setMyWallets] = useState<WalletType[]>([]);
  const [activeWallet, setActiveWallet] = useState<WalletType | null>(null);
  const [editingWalletId, setEditingWalletId] = useState<string | null>(null);
  const [editName, setEditName] = useState<string>("");
  const [networkConfigs, setNetworkConfigs] = useState<NetworkConfig[]>([]);
  const [editingNetwork, setEditingNetwork] = useState<NetworkConfig | null>(null);
  const [editNetworkName, setEditNetworkName] = useState<string>("");
  const [editNetworkRpcUrl, setEditNetworkRpcUrl] = useState<string>("");
  const [editNetworkChainId, setEditNetworkChainId] = useState<number>(1);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [showAddWalletModal, setShowAddWalletModal] = useState(false);
  const [newContactName, setNewContactName] = useState("");
  const [newContactAddress, setNewContactAddress] = useState("");
  const [newWalletName, setNewWalletName] = useState("");
  const [newWalletAddress, setNewWalletAddress] = useState("");
  const [newWalletChain, setNewWalletChain] = useState("");
  const [contactNameError, setContactNameError] = useState<string | null>(null);
  const [contactAddressError, setContactAddressError] = useState<string | null>(null);
  const [walletNameError, setWalletNameError] = useState<string | null>(null);
  const [walletAddressError, setWalletAddressError] = useState<string | null>(null);
  const [walletChainError, setWalletChainError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    const loadedContacts = StorageService.get("contacts") || [];
    const loadedWallets = StorageService.get("watchWallets") || [];
    setContacts(loadedContacts);
    setWatchWallets(loadedWallets);

    // Load my wallets
    const wallets = WalletService.getAllWallets();
    const active = WalletService.getActiveWallet();
    setMyWallets(wallets);
    setActiveWallet(active);

    // Load network configs
    const configs = NetworkService.getNetworkConfigs();
    setNetworkConfigs(configs);
  }, []);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const addContact = () => {
    setNewContactName("");
    setNewContactAddress("");
    setContactNameError(null);
    setContactAddressError(null);
    setShowAddContactModal(true);
  };

  const handleSaveContact = () => {
    setContactNameError(null);
    setContactAddressError(null);

    if (!newContactName.trim()) {
      setContactNameError("Name is required");
      return;
    }

    if (!newContactAddress.trim()) {
      setContactAddressError("Address is required");
      return;
    }

    const newContacts = [...contacts, { id: Date.now(), name: newContactName.trim(), address: newContactAddress.trim() }];
    setContacts(newContacts);
    StorageService.save("contacts", newContacts);
    setShowAddContactModal(false);
    showToast("Contact added successfully");
  };

  const removeContact = (id: number) => {
    const contact = contacts.find(c => c.id === id);
    if (contact && confirm(`Are you sure you want to remove "${contact.name}"?`)) {
      const newContacts = contacts.filter(c => c.id !== id);
      setContacts(newContacts);
      StorageService.save("contacts", newContacts);
      showToast("Contact removed successfully");
    }
  };

  const addWallet = () => {
    setNewWalletName("");
    setNewWalletAddress("");
    setNewWalletChain("");
    setWalletNameError(null);
    setWalletAddressError(null);
    setWalletChainError(null);
    setShowAddWalletModal(true);
  };

  const handleSaveWallet = () => {
    setWalletNameError(null);
    setWalletAddressError(null);
    setWalletChainError(null);

    if (!newWalletName.trim()) {
      setWalletNameError("Wallet name is required");
      return;
    }

    if (!newWalletAddress.trim()) {
      setWalletAddressError("Wallet address is required");
      return;
    }

    if (!newWalletChain.trim()) {
      setWalletChainError("Chain is required");
      return;
    }

    const newWallets = [
      ...watchWallets,
      { id: Date.now(), name: newWalletName.trim(), address: newWalletAddress.trim(), chain: newWalletChain.trim().toUpperCase() },
    ];
    setWatchWallets(newWallets);
    StorageService.save("watchWallets", newWallets);
    setShowAddWalletModal(false);
    showToast("Watch wallet added successfully");
  };

  const removeWallet = (id: number) => {
    const wallet = watchWallets.find(w => w.id === id);
    if (wallet && confirm(`Are you sure you want to remove "${wallet.name}"?`)) {
      const newWallets = watchWallets.filter(w => w.id !== id);
      setWatchWallets(newWallets);
      StorageService.save("watchWallets", newWallets);
      showToast("Watch wallet removed successfully");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        showToast("Address copied to clipboard!");
      })
      .catch(err => {
        console.error("Failed to copy:", err);
        showToast("Failed to copy address", "error");
      });
  };

  const handleToggleNetwork = (chain: SupportedChain, enabled: boolean) => {
    const updated = networkConfigs.map(config =>
      config.chain === chain ? { ...config, enabled } : config
    );
    setNetworkConfigs(updated);
  };

  const handleEditNetwork = (config: NetworkConfig) => {
    setEditingNetwork(config);
    setEditNetworkName(config.name);
    setEditNetworkRpcUrl(config.rpcUrl || "");
    setEditNetworkChainId(config.chainId || 1);
  };

  const handleSaveNetworkEdit = () => {
    if (!editingNetwork) return;

    const updated = networkConfigs.map(config =>
      config.chain === editingNetwork.chain
        ? {
            ...config,
            name: editNetworkName,
            rpcUrl: editNetworkRpcUrl || undefined,
            chainId: editNetworkChainId,
            custom: true,
          }
        : config
    );
    setNetworkConfigs(updated);
    setEditingNetwork(null);
  };

  const handleSaveNetworks = () => {
    NetworkService.saveNetworkConfigs(networkConfigs);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      window.location.reload(); // Reload to apply changes
    }, 1500);
  };

  const isEVMChain = (chain: SupportedChain): boolean => {
    return chain === SupportedChain.HYPEREVM || chain === SupportedChain.ETH;
  };

  return (
    <div className="space-y-8">
      {/* Toast Notification */}
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-xl font-bold text-sm shadow-lg ${
            toast.type === "success"
              ? "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800"
              : "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800"
          } transition-colors`}
        >
          {toast.message}
        </motion.div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold tracking-tighter">Settings</h1>
        <button
          onClick={toggleTheme}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-secondary)] hover:bg-[var(--hover-bg)] border border-[var(--border-primary)] rounded-xl font-bold text-sm transition-colors"
          title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
        >
          {theme === "light" ? (
            <>
              <Moon size={18} />
              <span>Dark Mode</span>
            </>
          ) : (
            <>
              <Sun size={18} />
              <span>Light Mode</span>
            </>
          )}
        </button>
      </div>

      <div className="flex gap-4 border-b border-[var(--border-primary)] pb-4">
        <button
          onClick={() => setActiveTab("addressBook")}
          className={`pb-2 font-bold transition-colors ${
            activeTab === "addressBook"
              ? "text-[var(--text-primary)] border-b-2 border-hyper-green"
              : "text-[var(--text-secondary)]"
          }`}
        >
          Address Book
        </button>
        <button
          onClick={() => setActiveTab("wallets")}
          className={`pb-2 font-bold transition-colors ${
            activeTab === "wallets"
              ? "text-[var(--text-primary)] border-b-2 border-hyper-green"
              : "text-[var(--text-secondary)]"
          }`}
        >
          Watch Wallets
        </button>
        <button
          onClick={() => setActiveTab("myWallets")}
          className={`pb-2 font-bold transition-colors ${
            activeTab === "myWallets"
              ? "text-[var(--text-primary)] border-b-2 border-hyper-green"
              : "text-[var(--text-secondary)]"
          }`}
        >
          My Wallets
        </button>
        <button
          onClick={() => setActiveTab("platformConfig")}
          className={`pb-2 font-bold transition-colors ${
            activeTab === "platformConfig"
              ? "text-[var(--text-primary)] border-b-2 border-hyper-green"
              : "text-[var(--text-secondary)]"
          }`}
        >
          Platform Configuration
        </button>
      </div>

      {activeTab === "addressBook" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-6"
        >
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <BookUser size={20} /> Contacts
            </h2>
            <button
              onClick={addContact}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-xl font-bold text-sm hover:scale-105 transition-transform"
            >
              <Plus size={16} /> Add Contact
            </button>
          </div>

          <div className="space-y-3">
            {contacts.length === 0 && (
              <div className="text-center py-12 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-primary)] transition-colors">
                <BookUser size={48} className="mx-auto mb-4 text-[var(--text-tertiary)]" />
                <p className="text-[var(--text-secondary)] font-bold mb-2">No contacts saved</p>
                <p className="text-[var(--text-secondary)] text-sm">
                  Add contacts to quickly access frequently used addresses
                </p>
              </div>
            )}
            {contacts.map(contact => (
              <div
                key={contact.id}
                className="flex items-center justify-between p-4 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-primary)] transition-colors"
              >
                <div>
                  <div className="font-bold">{contact.name}</div>
                  <div className="text-xs text-[var(--text-secondary)] font-mono">
                    {contact.address}
                  </div>
                </div>
                <button
                  onClick={() => removeContact(contact.id)}
                  className="p-2 text-[var(--text-secondary)] hover:text-red-500 transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {activeTab === "wallets" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-6"
        >
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Wallet size={20} /> Watch Wallets
            </h2>
            <button
              onClick={addWallet}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-xl font-bold text-sm hover:scale-105 transition-transform"
            >
              <Plus size={16} /> Import Address
            </button>
          </div>
          <p className="text-sm text-[var(--text-secondary)] bg-blue-50 dark:bg-blue-950 p-4 rounded-xl text-blue-600 dark:text-blue-400 transition-colors">
            Add any EVM address here to track its balance and history in your
            portfolio.
          </p>

          <div className="space-y-3">
            {watchWallets.length === 0 && (
              <div className="text-center py-12 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-primary)] transition-colors">
                <Wallet size={48} className="mx-auto mb-4 text-[var(--text-tertiary)]" />
                <p className="text-[var(--text-secondary)] font-bold mb-2">No watch wallets saved</p>
                <p className="text-[var(--text-secondary)] text-sm">
                  Add watch wallets to track balances and history of any EVM address
                </p>
              </div>
            )}
            {watchWallets.map(wallet => (
              <div
                key={wallet.id}
                className="flex items-center justify-between p-4 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-primary)] transition-colors"
              >
                <div>
                  <div className="font-bold">{wallet.name}</div>
                  <div className="text-xs text-[var(--text-secondary)] font-mono">
                    {wallet.address}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs font-bold bg-[var(--bg-tertiary)] px-2 py-1 rounded-md">
                    {wallet.chain}
                  </span>
                  <button
                    onClick={() => removeWallet(wallet.id)}
                    className="p-2 text-[var(--text-secondary)] hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {activeTab === "myWallets" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-6"
        >
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Wallet size={20} /> My Wallets
            </h2>
            <button
              onClick={() => (window.location.href = "/setup")}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-xl font-bold text-sm hover:scale-105 transition-transform"
            >
              <Plus size={16} /> Create New Wallet
            </button>
          </div>

          <div className="space-y-3">
            {myWallets.length === 0 && (
              <p className="text-[var(--text-secondary)] text-sm">
                No wallets created yet.
              </p>
            )}
            {myWallets.map(wallet => (
              <div
                key={wallet.id}
                className={`p-4 rounded-xl border transition-colors ${
                  activeWallet?.id === wallet.id
                    ? "bg-[var(--text-primary)] text-[var(--bg-primary)] border-hyper-green"
                    : "bg-[var(--bg-secondary)] border-[var(--border-primary)]"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    {editingWalletId === wallet.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="text"
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          className="flex-1 p-2 bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-primary)] rounded-lg text-sm font-bold transition-colors"
                          maxLength={50}
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === "Enter") {
                              if (
                                editName.trim() &&
                                WalletService.renameWallet(
                                  wallet.id,
                                  editName.trim()
                                )
                              ) {
                                setMyWallets(WalletService.getAllWallets());
                                setEditingWalletId(null);
                                setEditName("");
                              }
                            } else if (e.key === "Escape") {
                              setEditingWalletId(null);
                              setEditName("");
                            }
                          }}
                        />
                        <button
                          onClick={() => {
                            if (
                              editName.trim() &&
                              WalletService.renameWallet(
                                wallet.id,
                                editName.trim()
                              )
                            ) {
                              setMyWallets(WalletService.getAllWallets());
                              setEditingWalletId(null);
                              setEditName("");
                            }
                          }}
                          className="p-2 bg-hyper-green text-black rounded-lg hover:bg-hyper-dark transition-colors"
                        >
                          <CheckCircle2 size={16} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="font-bold">{wallet.name}</div>
                        {activeWallet?.id === wallet.id && (
                          <span className="text-xs bg-hyper-green text-black px-2 py-1 rounded-md font-bold">
                            Active
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  {editingWalletId !== wallet.id && (
                    <div className="flex items-center gap-2">
                      {activeWallet?.id !== wallet.id && (
                        <button
                          onClick={() => {
                            WalletService.switchWallet(wallet.id);
                            setActiveWallet(WalletService.getActiveWallet());
                            window.location.reload();
                          }}
                          className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                          title="Switch to this wallet"
                        >
                          <RefreshCw size={18} />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setEditingWalletId(wallet.id);
                          setEditName(wallet.name);
                        }}
                        className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                        title="Rename wallet"
                      >
                        <Edit2 size={18} />
                      </button>
                      {myWallets.length > 1 && (
                        <button
                          onClick={() => {
                            if (
                              confirm(
                                `Are you sure you want to delete "${wallet.name}"? This action cannot be undone.`
                              )
                            ) {
                              if (WalletService.deleteWallet(wallet.id)) {
                                setMyWallets(WalletService.getAllWallets());
                                setActiveWallet(
                                  WalletService.getActiveWallet()
                                );
                                if (myWallets.length === 1) {
                                  window.location.href = "/setup";
                                } else {
                                  window.location.reload();
                                }
                              } else {
                                alert("Cannot delete the last wallet.");
                              }
                            }
                          }}
                          className="p-2 text-[var(--text-secondary)] hover:text-red-500 transition-colors"
                          title="Delete wallet"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="text-xs opacity-70 mt-2">
                  Created: {new Date(wallet.createdAt).toLocaleString()}
                </div>
                {wallet.mnemonic && (
                  <div className="text-xs opacity-70 mt-1">
                    Has mnemonic phrase
                  </div>
                )}
                {wallet.privateKey && (
                  <div className="text-xs opacity-70 mt-1">Has private key</div>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {activeTab === "platformConfig" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-6"
        >
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Key size={20} /> Platform Configuration
            </h2>
          </div>

          <div className="space-y-4">
            <div className="p-6 bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-primary)] transition-colors">
              <h3 className="font-bold text-lg mb-2">
                Platform Revenue Address
              </h3>
              <div className="flex items-center gap-2 p-3 bg-[var(--bg-tertiary)] rounded-xl border border-[var(--border-primary)] transition-colors">
                <span className="flex-1 font-mono text-sm text-[var(--text-primary)] break-all">
                  0x0e7FCDC85f296004Bc235cc86cfA69da2c39324a
                </span>
                <button
                  onClick={() =>
                    copyToClipboard(
                      "0x0e7FCDC85f296004Bc235cc86cfA69da2c39324a"
                    )
                  }
                  className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  title="Copy address"
                >
                  <Copy size={18} />
                </button>
              </div>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                All platform fees and revenue share from swaps are sent to this
                address.
              </p>
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-xl border border-blue-100 dark:border-blue-900 transition-colors">
              <p className="text-sm text-blue-700 dark:text-blue-400">
                <strong>Fee Structure:</strong> We charge a 1% platform fee on
                all swaps.
              </p>
            </div>

            <div className="p-6 bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-primary)] transition-colors">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-lg mb-1">Network Settings</h3>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Enable or disable networks and configure their settings
                  </p>
                </div>
                <button
                  onClick={handleSaveNetworks}
                  className="px-4 py-2 bg-hyper-green text-black rounded-xl font-bold text-sm hover:bg-hyper-dark transition-colors"
                >
                  Save Changes
                </button>
              </div>

              {saveSuccess && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 p-3 bg-green-50 dark:bg-green-950 rounded-xl border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-sm font-bold transition-colors"
                >
                  <CheckCircle2 size={16} className="inline mr-2" />
                  Network settings saved! Reloading...
                </motion.div>
              )}

              <div className="space-y-3">
                {networkConfigs.map(config => (
                  <div
                    key={config.chain}
                    className="p-4 bg-[var(--bg-tertiary)] rounded-xl border border-[var(--border-primary)] transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div className="font-bold text-lg">{config.name}</div>
                          <span className="text-xs font-bold bg-[var(--bg-secondary)] px-2 py-1 rounded-md">
                            {config.symbol}
                          </span>
                          {config.custom && (
                            <span className="text-xs font-bold text-hyper-green">
                              Custom
                            </span>
                          )}
                        </div>
                        {isEVMChain(config.chain) && (
                          <div className="mt-2 text-xs text-[var(--text-secondary)] space-y-1">
                            <div>RPC: {config.rpcUrl || "Not set"}</div>
                            <div>Chain ID: {config.chainId || "Not set"}</div>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {isEVMChain(config.chain) && (
                          <button
                            onClick={() => handleEditNetwork(config)}
                            className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                            title="Edit network"
                          >
                            <Edit2 size={18} />
                          </button>
                        )}
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={config.enabled}
                            onChange={e =>
                              handleToggleNetwork(config.chain, e.target.checked)
                            }
                          />
                          <div className="w-14 h-7 bg-[var(--bg-secondary)] peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-hyper-green/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-[var(--bg-primary)] after:border-[var(--border-primary)] after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-hyper-green peer-checked:border-2 peer-checked:border-[var(--text-primary)] transition-colors"></div>
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </motion.div>
      )}

      {/* Add Contact Modal */}
      <Modal
        isOpen={showAddContactModal}
        onClose={() => {
          setShowAddContactModal(false);
          setNewContactName("");
          setNewContactAddress("");
          setContactNameError(null);
          setContactAddressError(null);
        }}
        title="Add Contact"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-[var(--text-secondary)] mb-2">
              Name
            </label>
            <input
              type="text"
              value={newContactName}
              onChange={e => {
                setNewContactName(e.target.value);
                setContactNameError(null);
              }}
              className={`w-full p-3 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-xl border outline-none focus:ring-2 focus:ring-hyper-green transition-all ${
                contactNameError ? "border-red-500" : "border-[var(--border-primary)]"
              }`}
              placeholder="Enter contact name"
              maxLength={50}
              autoFocus
            />
            {contactNameError && (
              <p className="text-xs text-red-500 mt-1">{contactNameError}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-bold text-[var(--text-secondary)] mb-2">
              Address
            </label>
            <input
              type="text"
              value={newContactAddress}
              onChange={e => {
                setNewContactAddress(e.target.value);
                setContactAddressError(null);
              }}
              className={`w-full p-3 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-xl border font-mono text-sm outline-none focus:ring-2 focus:ring-hyper-green transition-all ${
                contactAddressError ? "border-red-500" : "border-[var(--border-primary)]"
              }`}
              placeholder="Enter address"
            />
            {contactAddressError && (
              <p className="text-xs text-red-500 mt-1">{contactAddressError}</p>
            )}
          </div>
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSaveContact}
              className="flex-1 py-3 bg-hyper-green text-black rounded-xl font-bold hover:bg-hyper-dark transition-colors"
            >
              Save
            </button>
            <button
              onClick={() => {
                setShowAddContactModal(false);
                setNewContactName("");
                setNewContactAddress("");
                setContactNameError(null);
                setContactAddressError(null);
              }}
              className="flex-1 py-3 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-xl font-bold hover:bg-[var(--hover-bg)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* Add Watch Wallet Modal */}
      <Modal
        isOpen={showAddWalletModal}
        onClose={() => {
          setShowAddWalletModal(false);
          setNewWalletName("");
          setNewWalletAddress("");
          setNewWalletChain("");
          setWalletNameError(null);
          setWalletAddressError(null);
          setWalletChainError(null);
        }}
        title="Add Watch Wallet"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-[var(--text-secondary)] mb-2">
              Wallet Name
            </label>
            <input
              type="text"
              value={newWalletName}
              onChange={e => {
                setNewWalletName(e.target.value);
                setWalletNameError(null);
              }}
              className={`w-full p-3 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-xl border outline-none focus:ring-2 focus:ring-hyper-green transition-all ${
                walletNameError ? "border-red-500" : "border-[var(--border-primary)]"
              }`}
              placeholder="Enter wallet name"
              maxLength={50}
              autoFocus
            />
            {walletNameError && (
              <p className="text-xs text-red-500 mt-1">{walletNameError}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-bold text-[var(--text-secondary)] mb-2">
              Wallet Address
            </label>
            <input
              type="text"
              value={newWalletAddress}
              onChange={e => {
                setNewWalletAddress(e.target.value);
                setWalletAddressError(null);
              }}
              className={`w-full p-3 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-xl border font-mono text-sm outline-none focus:ring-2 focus:ring-hyper-green transition-all ${
                walletAddressError ? "border-red-500" : "border-[var(--border-primary)]"
              }`}
              placeholder="Enter wallet address"
            />
            {walletAddressError && (
              <p className="text-xs text-red-500 mt-1">{walletAddressError}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-bold text-[var(--text-secondary)] mb-2">
              Chain
            </label>
            <input
              type="text"
              value={newWalletChain}
              onChange={e => {
                setNewWalletChain(e.target.value);
                setWalletChainError(null);
              }}
              className={`w-full p-3 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-xl border outline-none focus:ring-2 focus:ring-hyper-green transition-all ${
                walletChainError ? "border-red-500" : "border-[var(--border-primary)]"
              }`}
              placeholder="ETH, BTC, SOL, etc."
            />
            {walletChainError && (
              <p className="text-xs text-red-500 mt-1">{walletChainError}</p>
            )}
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Enter the chain symbol (e.g., ETH, BTC, SOL)
            </p>
          </div>
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSaveWallet}
              className="flex-1 py-3 bg-hyper-green text-black rounded-xl font-bold hover:bg-hyper-dark transition-colors"
            >
              Save
            </button>
            <button
              onClick={() => {
                setShowAddWalletModal(false);
                setNewWalletName("");
                setNewWalletAddress("");
                setNewWalletChain("");
                setWalletNameError(null);
                setWalletAddressError(null);
                setWalletChainError(null);
              }}
              className="flex-1 py-3 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-xl font-bold hover:bg-[var(--hover-bg)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* Network Edit Modal */}
      <Modal
        isOpen={editingNetwork !== null}
        onClose={() => setEditingNetwork(null)}
        title={`Edit ${editingNetwork?.name} Network`}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-[var(--text-secondary)] mb-2">
              Network Name
            </label>
            <input
              type="text"
              value={editNetworkName}
              onChange={e => setEditNetworkName(e.target.value)}
              className="w-full p-3 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-xl border border-[var(--border-primary)] outline-none focus:ring-2 focus:ring-hyper-green transition-all"
              placeholder="Network name"
            />
          </div>

          {editingNetwork && isEVMChain(editingNetwork.chain) && (
            <>
              <div>
                <label className="block text-sm font-bold text-[var(--text-secondary)] mb-2">
                  RPC URL
                </label>
                <input
                  type="text"
                  value={editNetworkRpcUrl}
                  onChange={e => setEditNetworkRpcUrl(e.target.value)}
                  className="w-full p-3 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-xl border border-[var(--border-primary)] outline-none focus:ring-2 focus:ring-hyper-green transition-all font-mono text-sm"
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-[var(--text-secondary)] mb-2">
                  Chain ID
                </label>
                <input
                  type="number"
                  value={editNetworkChainId}
                  onChange={e =>
                    setEditNetworkChainId(parseInt(e.target.value) || 1)
                  }
                  className="w-full p-3 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-xl border border-[var(--border-primary)] outline-none focus:ring-2 focus:ring-hyper-green transition-all"
                  placeholder="1"
                />
              </div>
            </>
          )}

          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSaveNetworkEdit}
              className="flex-1 py-3 bg-hyper-green text-black rounded-xl font-bold hover:bg-hyper-dark transition-colors"
            >
              Save
            </button>
            <button
              onClick={() => setEditingNetwork(null)}
              className="flex-1 py-3 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-xl font-bold hover:bg-[var(--hover-bg)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
