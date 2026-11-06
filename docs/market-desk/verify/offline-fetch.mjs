globalThis.fetch = async (input) => { throw new Error('offline harness: ' + String(input).slice(0, 60)); };
