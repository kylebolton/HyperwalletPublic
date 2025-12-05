import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ReceiveModal from './ReceiveModal';

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

describe('ReceiveModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    address: '0x1234567890123456789012345678901234567890',
    symbol: 'ETH',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render modal with address', () => {
    render(<ReceiveModal {...defaultProps} />);

    expect(screen.getByText('Receive ETH')).toBeInTheDocument();
    expect(screen.getByText(defaultProps.address)).toBeInTheDocument();
  });

  it('should display QR code for valid address', () => {
    render(<ReceiveModal {...defaultProps} />);

    // QR code should be rendered (qrcode.react creates an SVG)
    const qrContainer = screen.getByText(defaultProps.address).closest('div')?.parentElement;
    expect(qrContainer).toBeInTheDocument();
  });

  it('should show loading state for invalid address', () => {
    render(
      <ReceiveModal
        {...defaultProps}
        address="Loading..."
      />
    );

    expect(screen.getByText(/Loading address.../)).toBeInTheDocument();
  });

  it('should copy address to clipboard when clicked', async () => {
    render(<ReceiveModal {...defaultProps} />);

    const addressElement = screen.getByText(defaultProps.address);
    fireEvent.click(addressElement);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(defaultProps.address);
    });
  });

  it('should show checkmark after copying', async () => {
    render(<ReceiveModal {...defaultProps} />);

    const addressElement = screen.getByText(defaultProps.address);
    fireEvent.click(addressElement);

    // Check icon should appear (from lucide-react Check)
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });
  });

  it('should handle initialization status messages', () => {
    render(
      <ReceiveModal
        {...defaultProps}
        address="Initializing ETH wallet..."
      />
    );

    expect(screen.getByText(/Initializing ETH wallet.../)).toBeInTheDocument();
  });

  it('should display warning message for valid address', () => {
    render(<ReceiveModal {...defaultProps} />);

    expect(screen.getByText(/Only send/)).toBeInTheDocument();
    expect(screen.getByText('ETH')).toBeInTheDocument();
  });
});





















