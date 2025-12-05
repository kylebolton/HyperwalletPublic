import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { ThemeProvider, useTheme } from './ThemeContext';

// Test component that uses the theme
function TestComponent() {
  const { theme, toggleTheme, setTheme } = useTheme();
  return (
    <div>
      <div data-testid="theme">{theme}</div>
      <button onClick={toggleTheme}>Toggle</button>
      <button onClick={() => setTheme('dark')}>Set Dark</button>
      <button onClick={() => setTheme('light')}>Set Light</button>
    </div>
  );
}

describe('ThemeContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should provide theme context', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByTestId('theme')).toBeInTheDocument();
  });

  it('should default to light theme when no preference', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByTestId('theme')).toHaveTextContent('light');
  });

  it('should use saved theme from localStorage', () => {
    localStorage.setItem('theme', 'dark');

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
  });

  it('should toggle theme', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    const toggleButton = screen.getByText('Toggle');
    act(() => {
      fireEvent.click(toggleButton);
    });

    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
  });

  it('should set theme explicitly', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    const setDarkButton = screen.getByText('Set Dark');
    act(() => {
      fireEvent.click(setDarkButton);
    });

    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('should persist theme to localStorage', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    const setDarkButton = screen.getByText('Set Dark');
    act(() => {
      fireEvent.click(setDarkButton);
    });

    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('should apply theme to document', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    const setDarkButton = screen.getByText('Set Dark');
    act(() => {
      fireEvent.click(setDarkButton);
    });

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('should throw error when used outside provider', () => {
    // Suppress console.error for this test
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useTheme must be used within a ThemeProvider');

    consoleError.mockRestore();
  });
});

