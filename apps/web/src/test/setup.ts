import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';

const createMemoryStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
};

if (typeof window !== 'undefined') {
  const maybeLocalStorage = window.localStorage as unknown;
  if (
    !maybeLocalStorage ||
    typeof maybeLocalStorage !== 'object' ||
    typeof (maybeLocalStorage as Storage).getItem !== 'function'
  ) {
    Object.defineProperty(window, 'localStorage', {
      value: createMemoryStorage(),
      writable: true,
      configurable: true,
    });
  }

  const maybeSessionStorage = window.sessionStorage as unknown;
  if (
    !maybeSessionStorage ||
    typeof maybeSessionStorage !== 'object' ||
    typeof (maybeSessionStorage as Storage).getItem !== 'function'
  ) {
    Object.defineProperty(window, 'sessionStorage', {
      value: createMemoryStorage(),
      writable: true,
      configurable: true,
    });
  }
}

afterEach(() => {
  cleanup();
});
