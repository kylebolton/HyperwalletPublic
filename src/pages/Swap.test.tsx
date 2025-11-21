import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HashRouter } from 'react-router-dom';
import Swap from './Swap';
import { SwapService } from '../services/swap';
import { ZCashShieldService } from '../services/zcash-shield';
import { WalletService } from '../services/wallet';
import { NetworkService } from '../services/networks';
import { ChainManager } from '../services/chains/manager';

// Mock dependencies
vi.mock('../services/swap');
vi.mock('../services/zcash-shield');
vi.mock('../services/wallet');
vi.mock('../services/networks');
vi.mock('../services/chains/manager');

describe('Swap Page', () => {
  const mockService = {
    getAddress: vi.fn().mockResolvedValue('0xswap123'),
    init: vi.fn().mockResolvedValue(undefined),
    validateAddress: vi.fn().mockReturnValue(true),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (WalletService.getActiveWallet as any) = vi.fn().mockReturnValue({
      id: 'wallet-1',
      mnemonic: 'test mnemonic',
      privateKey: '0x123',
    });
    (NetworkService.getEnabledNetworks as any) = vi.fn().mockReturnValue([]);
    (ChainManager as any) = vi.fn().mockImplementation(() => ({
      getService: vi.fn().mockReturnValue(mockService),
    }));
    (SwapService.getQuote as any) = vi.fn().mockResolvedValue({
      amountOut: '50.0',
      rate: '0.5',
      provider: 'hyperswap',
    });
  });

  const renderSwap = () => {
    return render(
      <HashRouter>
        <Swap />
      </HashRouter>
    );
  };

  it('should render swap form', () => {
    renderSwap();

    expect(screen.getByText('Swap')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('0.00')).toBeInTheDocument();
  });

  it('should allow currency selection', () => {
    renderSwap();

    const currencySelects = screen.getAllByRole('combobox');
    expect(currencySelects.length).toBeGreaterThan(0);
  });

  it('should get quote when amount is entered and button clicked', async () => {
    renderSwap();

    const amountInput = screen.getByPlaceholderText('0.00');
    fireEvent.change(amountInput, { target: { value: '10' } });

    const getQuoteButton = screen.getByText('Get Quote');
    fireEvent.click(getQuoteButton);

    await waitFor(() => {
      expect(SwapService.getQuote).toHaveBeenCalled();
    });
  });

  it('should display quote after getting it', async () => {
    renderSwap();

    const amountInput = screen.getByPlaceholderText('0.00');
    fireEvent.change(amountInput, { target: { value: '10' } });

    const getQuoteButton = screen.getByText('Get Quote');
    fireEvent.click(getQuoteButton);

    await waitFor(() => {
      expect(screen.getByText('50.0')).toBeInTheDocument();
    });
  });

  it('should fetch wallet address for destination', async () => {
    renderSwap();

    await waitFor(() => {
      expect(ChainManager).toHaveBeenCalled();
    });
  });

  it('should validate custom destination address', async () => {
    renderSwap();

    // Get quote first
    const amountInput = screen.getByPlaceholderText('0.00');
    fireEvent.change(amountInput, { target: { value: '10' } });
    const getQuoteButton = screen.getByText('Get Quote');
    fireEvent.click(getQuoteButton);

    await waitFor(() => {
      expect(screen.getByText(/Custom/)).toBeInTheDocument();
    });

    // Toggle to custom destination
    const customButton = screen.getByText('Custom');
    fireEvent.click(customButton);

    // Should show address input
    await waitFor(() => {
      const addressInput = screen.getByPlaceholderText(/Enter.*address/);
      expect(addressInput).toBeInTheDocument();
    });
  });
});


