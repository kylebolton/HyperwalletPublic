import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Swap from './pages/Swap';
import Setup from './pages/Setup';
import History from './pages/History';
import Settings from './pages/Settings';
import Analytics from './pages/Analytics';
import Import from './pages/Import';
import { WalletService } from './services/wallet';
import { ThemeProvider } from './contexts/ThemeContext';
import { PreviewModeProvider } from './contexts/PreviewModeContext';

function App() {
  const [hasWallet, setHasWallet] = useState<boolean | null>(null);

  useEffect(() => {
    // Check for active wallet instead of just mnemonic
    const activeWallet = WalletService.getActiveWallet();
    setHasWallet(!!activeWallet);
    
    // Refresh wallet status periodically
    const interval = setInterval(() => {
      const currentActive = WalletService.getActiveWallet();
      setHasWallet(!!currentActive);
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);

  if (hasWallet === null) return <div className="flex h-screen items-center justify-center bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors">Loading...</div>;

  return (
    <ThemeProvider>
      <HashRouter>
        <PreviewModeProvider>
          <Routes>
            {/* Allow access to setup page even if wallets exist (for creating new ones) */}
            <Route 
              path="/setup" 
              element={
                <Setup 
                  onComplete={() => {
                    const activeWallet = WalletService.getActiveWallet();
                    setHasWallet(!!activeWallet);
                  }} 
                />
              } 
            />
            <Route element={hasWallet ? <Layout /> : <Navigate to="/setup" />}>
                 <Route path="/" element={<Dashboard />} />
                 <Route path="/analytics" element={<Analytics />} />
                 <Route path="/history" element={<History />} />
                 <Route path="/swap" element={<Swap />} />
                 <Route path="/import" element={<Import />} />
                 <Route path="/settings" element={<Settings />} />
            </Route>
          </Routes>
        </PreviewModeProvider>
      </HashRouter>
    </ThemeProvider>
  );
}

export default App;
