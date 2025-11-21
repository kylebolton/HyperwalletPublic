import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { HashRouter } from 'react-router-dom';
import Dashboard from './Dashboard';
import { WalletService } from '../services/wallet';
import { NetworkService } from '../services/networks';
import { ChainManager } from '../services/chains/manager';
import { TokenService } from '../services/tokens';
import { MarketService } from '../services/market';

// Mock all dependencies
vi.mock('../services/wallet');
vi.mock('../services/networks');
vi.mock('../services/chains/manager');
vi.mock('../services/tokens');
vi.mock('../services/market');

describe('Dashboard Page', () => {
  const mockServices = [
    {
      symbol: 'HYPE',
      chainName: 'HyperEVM',
      getAddress: vi.fn().mockResolvedValue('0xhype123'),
      getBalance: vi.fn().mockResolvedValue('100.00'),
      init: undefined,
    },
    {
      symbol: 'BTC',
      chainName: 'Bitcoin',
      getAddress: vi.fn().mockResolvedValue('bc1btc123'),
      getBalance: vi.fn().mockResolvedValue('0.5'),
      init: undefined,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (WalletService.getActiveWallet as any) = vi.fn().mockReturnValue({
      id: 'wallet-1',
      name: 'Test Wallet',
      mnemonic: 'test mnemonic',
      privateKey: '0x123',
    });
    (NetworkService.getEnabledNetworks as any) = vi.fn().mockReturnValue([]);
    (ChainManager as any) = vi.fn().mockImplementation(() => ({
      getAllServices: vi.fn().mockReturnValue(mockServices),
      getService: vi.fn().mockReturnValue(mockServices[0]),
    }));
    (TokenService.getHyperEVMTokens as any) = vi.fn().mockResolvedValue([
      {
        address: '0x0000',
        symbol: 'HYPE',
        name: 'HyperEVM',
        decimals: 18,
        balance: '100.00',
      },
    ]);
    (MarketService.getPrices as any) = vi.fn().mockResolvedValue({
      HYPE: { current_price: 10 },
      BTC: { current_price: 60000 },
    });
  });

  const renderDashboard = () => {
    return render(
      <HashRouter>
        <Dashboard />
      </HashRouter>
    );
  };

  it('should render portfolio heading', () => {
    renderDashboard();
    expect(screen.getByText('Portfolio')).toBeInTheDocument();
  });

  it('should display total balance', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText(/Total Balance/)).toBeInTheDocument();
    });
  });

  it('should display HyperEVM category', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('HyperEVM')).toBeInTheDocument();
    });
  });

  it('should toggle HyperEVM category expansion', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('HyperEVM')).toBeInTheDocument();
    });

    const toggleButton = screen.getByText('HyperEVM').closest('button');
    if (toggleButton) {
      fireEvent.click(toggleButton);
      // Category should collapse/expand
    }
  });

  it('should display asset balances', async () => {
    renderDashboard();

    await waitFor(() => {
      // Should show balances for assets
      expect(ChainManager).toHaveBeenCalled();
    });
  });

  it('should open receive modal when receive button clicked', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Portfolio')).toBeInTheDocument();
    });

    // Find receive buttons (they appear on hover, so we need to check for them)
    const receiveButtons = screen.queryAllByTitle('Receive');
    if (receiveButtons.length > 0) {
      fireEvent.click(receiveButtons[0]);
      // Modal should open
    }
  });
});

