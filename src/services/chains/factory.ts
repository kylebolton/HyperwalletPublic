import { ChainManager } from "./manager";
import { NetworkService } from "../networks";
import { WalletService } from "../wallet";

/**
 * Build a ChainManager instance using the currently active wallet and enabled networks.
 * Throws with a clear message if no wallet or credentials are available.
 */
export function createChainManagerFromActiveWallet(derivationIndex: number = 0): ChainManager {
  const activeWallet = WalletService.getActiveWallet();

  if (!activeWallet) {
    throw new Error("No active wallet found. Create or import a wallet first.");
  }

  if (!activeWallet.mnemonic && !activeWallet.privateKey) {
    throw new Error("Active wallet is missing credentials.");
  }

  const enabledNetworks = NetworkService.getEnabledNetworks();

  return new ChainManager(
    activeWallet.privateKey || undefined,
    !!activeWallet.privateKey,
    activeWallet.mnemonic || undefined,
    enabledNetworks,
    activeWallet.id,
    derivationIndex
  );
}

