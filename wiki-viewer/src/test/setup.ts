import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock SpeechSynthesisUtterance for jsdom
global.SpeechSynthesisUtterance = vi.fn().mockImplementation((text: string) => ({
  text,
  rate: 1,
  voice: null,
  onend: null,
  onerror: null,
})) as unknown as typeof SpeechSynthesisUtterance;

// Mock window.matchMedia for tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });
