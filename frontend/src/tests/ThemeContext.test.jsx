import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, act, cleanup } from '@testing-library/react';
import { ThemeProvider, useTheme } from '../context/ThemeContext.jsx';

// Simple Test Component to consume Context
const TestComponent = () => {
  const { theme, toggleTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme-value">{theme}</span>
      <button data-testid="toggle-btn" onClick={toggleTheme}>Toggle</button>
    </div>
  );
};

describe('Frontend ThemeContext Tests', () => {
  beforeEach(() => {
    // Mock window.matchMedia for jsdom compatibility
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query) => ({
        matches: query.includes('dark'),
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });

    // Clear classList of documentElement
    document.documentElement.className = '';
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  test('should default to dark theme and set class on documentElement', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByTestId('theme-value').textContent).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  test('should toggle theme value and documentElement classes', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    const toggleBtn = screen.getByTestId('toggle-btn');
    
    // Toggle once: Dark -> Light
    act(() => {
      toggleBtn.click();
    });

    expect(screen.getByTestId('theme-value').textContent).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('theme')).toBe('light');

    // Toggle twice: Light -> Dark
    act(() => {
      toggleBtn.click();
    });

    expect(screen.getByTestId('theme-value').textContent).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('theme')).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
  });
});
