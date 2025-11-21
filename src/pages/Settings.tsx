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
import { useTheme } from "../contexts/ThemeContext";
import type { Wallet as WalletType } from "../services/storage";

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
  }, []);

  const addContact = () => {
    const name = prompt("Enter Name");
    const address = prompt("Enter Address");
    if (name && address) {
      const newContacts = [...contacts, { id: Date.now(), name, address }];
      setContacts(newContacts);
      StorageService.save("contacts", newContacts);
    }
  };

  const removeContact = (id: number) => {
    const newContacts = contacts.filter(c => c.id !== id);
    setContacts(newContacts);
    StorageService.save("contacts", newContacts);
  };

  const addWallet = () => {
    const name = prompt("Enter Wallet Name");
    const address = prompt("Enter Wallet Address");
    const chain = prompt("Enter Chain (ETH, BTC, etc.)");
    if (name && address && chain) {
      const newWallets = [
        ...watchWallets,
        { id: Date.now(), name, address, chain },
      ];
      setWatchWallets(newWallets);
      StorageService.save("watchWallets", newWallets);
    }
  };

  const removeWallet = (id: number) => {
    const newWallets = watchWallets.filter(w => w.id !== id);
    setWatchWallets(newWallets);
    StorageService.save("watchWallets", newWallets);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        alert("Address copied to clipboard!");
      })
      .catch(err => {
        console.error("Failed to copy:", err);
      });
  };

  return (
    <div className="space-y-8">
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
              <p className="text-[var(--text-secondary)] text-sm">
                No contacts saved.
              </p>
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
              <p className="text-[var(--text-secondary)] text-sm">
                No watch wallets saved.
              </p>
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

            <div className="p-6 bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-primary)] transition-colors">
              <h3 className="font-bold text-lg mb-2">
                Swap Integration Status
              </h3>
              <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950 rounded-xl border border-green-100 dark:border-green-900 text-green-700 dark:text-green-400 transition-colors">
                <CheckCircle2 size={20} />
                <span className="font-bold text-sm">
                  Swapzone Integration Active
                </span>
              </div>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                The platform's API key is configured. All swaps will use this
                integration.
              </p>
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-xl border border-blue-100 dark:border-blue-900 transition-colors">
              <p className="text-sm text-blue-700 dark:text-blue-400">
                <strong>Fee Structure:</strong> We charge a 1% platform fee on
                all swaps. Additionally, the platform earns a revenue share from
                Swapzone (0.05%-0.25% per transaction) via the integrated API
                key.
              </p>
            </div>

            <div className="p-6 bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-primary)] transition-colors">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-lg mb-1">Testing Mode</h3>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Enable testing mode for development and contract testing
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    defaultChecked={false}
                  />
                  <div className="w-14 h-7 bg-[var(--bg-tertiary)] peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-hyper-green/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-[var(--bg-primary)] after:border-[var(--border-primary)] after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-hyper-green peer-checked:border-2 peer-checked:border-[var(--text-primary)] transition-colors"></div>
                </label>
              </div>
              <div className="p-3 bg-[var(--bg-tertiary)] rounded-xl border-2 border-[var(--border-secondary)] transition-colors">
                <p className="text-xs font-bold text-[var(--text-primary)]">
                  Testing Mode: <span className="text-red-600">DISABLED</span>
                </p>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  When enabled, you can configure test contract addresses for
                  development purposes
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
