// ============================================
// THEEB MIND — Live Market Prices (free APIs)
// ============================================
// Sources (no API keys required):
//   • Binance public REST — BTC, ETH spot + PAXG (tokenized gold ≈ spot gold)
//   • CoinGecko free API — automatic fallback for the same three symbols
//   • Frankfurter (ECB reference rates) — EUR/USD
// Hardened for live demos:
//   • 60s in-memory cache + single-flight (no request stampede at TTL expiry)
//   • stale-while-error: last good data is served during transient outages
// ============================================

export interface LiveTick {
  symbol: string;                                  // BTC · ETH · GOLD · EURUSD
  labelAr: string;                                 // Arabic display label
  price: number;
  changePct: number | null;                        // 24h % change (null = source has none)
  direction: 'bullish' | 'bearish' | 'neutral';
  source: 'Binance' | 'ECB' | 'CoinGecko';
  updatedAt: string;                               // ISO timestamp
}

const TTL_MS = 60_000;
let cache: { data: LiveTick[]; fetchedAt: number } | null = null;
let inFlight: Promise<LiveTick[]> | null = null;

// ── Fetchers ─────────────────────────────────

interface CryptoQuote {
  price: number;
  changePct: number;
  source: 'Binance' | 'CoinGecko';
}

async function fetchBinance24h(symbol: string): Promise<{ price: number; changePct: number }> {
  const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`, {
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`Binance ${symbol} HTTP ${res.status}`);
  const j = (await res.json()) as { lastPrice: string; priceChangePercent: string };
  const price = parseFloat(j.lastPrice);
  const changePct = parseFloat(j.priceChangePercent);
  if (!Number.isFinite(price)) throw new Error(`Binance ${symbol}: bad price`);
  return { price, changePct: Number.isFinite(changePct) ? changePct : 0 };
}

/** One CoinGecko call covers all three crypto/gold symbols (fallback path) */
async function fetchCoinGecko(): Promise<Partial<Record<'BTC' | 'ETH' | 'GOLD', CryptoQuote>>> {
  const url =
    'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,pax-gold&vs_currencies=usd&include_24hr_change=true';
  const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
  const j = (await res.json()) as Record<string, { usd?: number; usd_24h_change?: number }>;
  const pick = (id: string): CryptoQuote | undefined => {
    const e = j[id];
    if (!e?.usd || !Number.isFinite(e.usd)) return undefined;
    const ch = e.usd_24h_change;
    return { price: e.usd, changePct: typeof ch === 'number' && Number.isFinite(ch) ? ch : 0, source: 'CoinGecko' };
  };
  return { BTC: pick('bitcoin'), ETH: pick('ethereum'), GOLD: pick('pax-gold') };
}

async function fetchEurUsd(): Promise<number> {
  const res = await fetch('https://api.frankfurter.app/latest?from=EUR&to=USD', {
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`Frankfurter HTTP ${res.status}`);
  const j = (await res.json()) as { rates?: { USD?: number } };
  const rate = j.rates?.USD;
  if (!rate || !Number.isFinite(rate)) throw new Error('Frankfurter: bad rate');
  return rate;
}

// ── Helpers ──────────────────────────────────

function toDirection(changePct: number | null): LiveTick['direction'] {
  if (changePct === null) return 'neutral';
  if (changePct > 0.15) return 'bullish';
  if (changePct < -0.15) return 'bearish';
  return 'neutral';
}

const CRYPTO_META: Array<{ symbol: 'BTC' | 'ETH' | 'GOLD'; binance: string; labelAr: string }> = [
  { symbol: 'BTC', binance: 'BTCUSDT', labelAr: 'بيتكوين' },
  { symbol: 'ETH', binance: 'ETHUSDT', labelAr: 'إيثيريوم' },
  { symbol: 'GOLD', binance: 'PAXGUSDT', labelAr: 'الذهب (أونصة)' },
];

// ── Core fetch (all sources, with fallback) ──

async function fetchAll(): Promise<LiveTick[]> {
  const now = new Date().toISOString();

  const [binanceResults, eurusdResult] = await Promise.all([
    Promise.allSettled(CRYPTO_META.map(m => fetchBinance24h(m.binance))),
    fetchEurUsd().then(
      value => ({ ok: true as const, value }),
      error => ({ ok: false as const, error }),
    ),
  ]);

  const quotes = new Map<string, CryptoQuote>();
  binanceResults.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      quotes.set(CRYPTO_META[i].symbol, { ...r.value, source: 'Binance' });
    }
  });

  // Fallback: whichever crypto symbols Binance missed, try CoinGecko once
  if (quotes.size < CRYPTO_META.length) {
    try {
      const cg = await fetchCoinGecko();
      for (const m of CRYPTO_META) {
        const q = cg[m.symbol];
        if (!quotes.has(m.symbol) && q) quotes.set(m.symbol, q);
      }
    } catch (err) {
      console.error('[market] CoinGecko fallback failed:', err);
    }
  }

  const ticks: LiveTick[] = [];
  for (const m of CRYPTO_META) {
    const q = quotes.get(m.symbol);
    if (q) {
      ticks.push({
        symbol: m.symbol,
        labelAr: m.labelAr,
        price: q.price,
        changePct: q.changePct,
        direction: toDirection(q.changePct),
        source: q.source,
        updatedAt: now,
      });
    }
  }
  if (eurusdResult.ok) {
    ticks.push({
      symbol: 'EURUSD',
      labelAr: 'يورو / دولار',
      price: eurusdResult.value,
      changePct: null,
      direction: 'neutral',
      source: 'ECB',
      updatedAt: now,
    });
  }

  if (ticks.length === 0) {
    throw new Error('All live sources failed (Binance, CoinGecko, ECB)');
  }
  return ticks;
}

// ── Public API ───────────────────────────────

/**
 * Latest live prices from free public sources.
 * Single-flight + 60s cache; serves last good data on transient failure.
 * Throws only when every source fails AND no previous data exists.
 */
export async function getLiveMarket(): Promise<LiveTick[]> {
  if (cache && Date.now() - cache.fetchedAt < TTL_MS) return cache.data;
  if (inFlight) return inFlight;

  inFlight = fetchAll()
    .then(ticks => {
      cache = { data: ticks, fetchedAt: Date.now() };
      return ticks;
    })
    .catch(err => {
      if (cache) {
        console.error('[market] live fetch failed — serving stale cache:', err);
        return cache.data;
      }
      throw err;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}
