import '@testing-library/jest-dom/vitest';

// jsdom does not implement matchMedia — React 19 components may call it
// during mount. We provide a minimal polyfill so the panel can render.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}