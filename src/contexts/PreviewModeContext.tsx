import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { WalletService } from '../services/wallet';
import { StorageService } from '../services/storage';

interface PreviewModeContextType {
  isPreviewMode: boolean;
  activatePreviewMode: () => void;
  deactivatePreviewMode: () => void;
  togglePreviewMode: () => void;
}

const PreviewModeContext = createContext<PreviewModeContextType | undefined>(undefined);

export function PreviewModeProvider({ children }: { children: ReactNode }) {
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const navigate = useNavigate();
  const isPreviewModeRef = useRef(isPreviewMode);
  
  // Keep ref in sync with state
  useEffect(() => {
    isPreviewModeRef.current = isPreviewMode;
  }, [isPreviewMode]);

  const activatePreviewMode = () => {
    // Create a demo wallet if none exists
    const existingWallets = WalletService.getAllWallets();
    if (existingWallets.length === 0) {
      // Create a demo wallet with a known mnemonic for consistency
      const demoMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      const demoPrivateKey = '0x0000000000000000000000000000000000000000000000000000000000000001';
      
      try {
        WalletService.importNewWallet('Demo Wallet', demoMnemonic, false);
        // Also set a private key for EVM chains
        const demoWallet = WalletService.getActiveWallet();
        if (demoWallet) {
          demoWallet.privateKey = demoPrivateKey;
          StorageService.saveWallet(demoWallet);
        }
      } catch (e) {
        console.error('Failed to create demo wallet:', e);
      }
    }

    setIsPreviewMode(true);
    // Navigate to dashboard to show the preview data
    navigate('/');
  };

  const deactivatePreviewMode = () => {
    setIsPreviewMode(false);
  };

  const togglePreviewMode = () => {
    if (isPreviewModeRef.current) {
      deactivatePreviewMode();
    } else {
      activatePreviewMode();
    }
  };

  // Global keyboard shortcut: Cmd/Ctrl + Shift + P
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;
      
      if (modifier && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        togglePreviewMode();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePreviewMode]);

  return (
    <PreviewModeContext.Provider
      value={{
        isPreviewMode,
        activatePreviewMode,
        deactivatePreviewMode,
        togglePreviewMode,
      }}
    >
      {children}
    </PreviewModeContext.Provider>
  );
}

export function usePreviewMode() {
  const context = useContext(PreviewModeContext);
  if (context === undefined) {
    throw new Error('usePreviewMode must be used within a PreviewModeProvider');
  }
  return context;
}

