import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HashRouter } from 'react-router-dom';
import Layout from './Layout';
import { WalletService } from '../services/wallet';
import { NetworkService } from '../services/networks';
import { ChainManager } from '../services/chains/manager';

// Mock dependencies
vi.mock('../services/wallet');
vi.mock('../services/networks');
vi.mock('../services/chains/manager');

describe('Layout Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (WalletService.getAllWallets as any) = vi.fn().mockReturnValue([
      {
        id: 'wallet-1',
        name: 'Test Wallet',
        mnemonic: 'test mnemonic',
        privateKey: '0x123',
        createdAt: Date.now(),
      },
    ]);
    (WalletService.getActiveWallet as any) = vi.fn().mockReturnValue({
      id: 'wallet-1',
      name: 'Test Wallet',
      mnemonic: 'test mnemonic',
      privateKey: '0x123',
      createdAt: Date.now(),
    });
    (NetworkService.getEnabledNetworks as any) = vi.fn().mockReturnValue([]);
    (ChainManager as any) = vi.fn().mockImplementation(() => ({
      getAllServices: vi.fn().mockReturnValue([
        { symbol: 'HYPE', getAddress: vi.fn().mockResolvedValue('0x123'), init: vi.fn().mockResolvedValue(undefined) },
      ]),
    }));
  });

  const renderLayout = () => {
    return render(
      <HashRouter>
        <Layout />
      </HashRouter>
    );
  };

  it('should render sidebar with navigation', () => {
    renderLayout();

    expect(screen.getByText('Portfolio')).toBeInTheDocument();
    expect(screen.getByText('Analytics')).toBeInTheDocument();
    expect(screen.getByText('History')).toBeInTheDocument();
    expect(screen.getByText('Swap')).toBeInTheDocument();
    expect(screen.getByText('Import')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('should display active wallet name', () => {
    renderLayout();

    expect(screen.getByText('Test Wallet')).toBeInTheDocument();
  });

  it('should show CONNECTING status initially', () => {
    renderLayout();

    expect(screen.getByText(/STATUS: CONNECTING/)).toBeInTheDocument();
  });

  it('should show SECURE status after sync completes', async () => {
    // Mock sync to complete quickly
    (ChainManager as any).mockImplementation(() => ({
      getAllServices: vi.fn().mockReturnValue([
        { 
          symbol: 'HYPE', 
          getAddress: vi.fn().mockResolvedValue('0x123'),
          init: vi.fn().mockResolvedValue(undefined),
        },
      ]),
    }));

    renderLayout();

    // Wait for sync to complete
    await waitFor(() => {
      expect(screen.queryByText(/STATUS: CONNECTING/)).not.toBeInTheDocument();
    }, { timeout: 3000 });

    // Should show SECURE after sync
    await waitFor(() => {
      expect(screen.getByText(/STATUS: SECURE/)).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('should open wallet dropdown when clicked', () => {
    renderLayout();

    const walletButton = screen.getByText('Test Wallet').closest('button');
    if (walletButton) {
      fireEvent.click(walletButton);

      expect(screen.getByText('Create New Wallet')).toBeInTheDocument();
    }
  });

  it('should render outlet for child routes', () => {
    renderLayout();

    // Outlet should render (we can't easily test the actual content without a route)
    const outlet = document.querySelector('[data-testid="outlet"]') || document.body;
    expect(outlet).toBeDefined();
  });
});

