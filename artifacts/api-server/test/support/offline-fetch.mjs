// Test preload: makes every outbound fetch() fail, so source-failure paths are deterministic.
globalThis.fetch = async (input) => {
  throw new Error('offline test environment: ' + String(input instanceof URL ? input.href : input).slice(0, 80));
};
