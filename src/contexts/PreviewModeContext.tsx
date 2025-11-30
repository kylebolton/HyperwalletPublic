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
  // Preview mode disabled for production - always false
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const navigate = useNavigate();
  const isPreviewModeRef = useRef(isPreviewMode);
  
  // Keep ref in sync with state
  useEffect(() => {
    isPreviewModeRef.current = isPreviewMode;
  }, [isPreviewMode]);

  const activatePreviewMode = () => {
    // Preview mode disabled for production
    return;
  };

  const deactivatePreviewMode = () => {
    setIsPreviewMode(false);
  };

  const togglePreviewMode = () => {
    // Preview mode disabled for production - no-op
    return;
  };

  // Keyboard shortcut removed for production

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

