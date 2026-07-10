// jsdom doesn't implement matchMedia; real browsers do. Reused production
// components (e.g. PulseMark) read it for prefers-reduced-motion, so stub it
// for the test env only. No effect on the running app.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList
}
