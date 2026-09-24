const fs = require('fs');
const path = require('path');

// 1. Tickers for current EOD prices
const PRICE_SYMBOLS = [
  'SPY', 'VOO', 'IVV', 'VTI', 'QQQ', 'DIA',
  'VEA', 'VWO', 'VT', 'BND', 'AGG', 'BNDX',
  'VNQ', 'SCHD', 'VUG', 'VTV', 'IWM', 'GLD',
  'HYG', 'DBC', 'PSP', 'PAVE', 'RING', 'ESGU', 'IYH', 'XLE'
];

// 2. Asset Class proxies used for the Historical Asset Table
const ASSET_CLASS_SYMBOLS = [
  'DBC',      // Commodities
  'GLD',      // Gold
  'ACWX',     // Global Equities
  'VEA',      // Developed Equities
  'VWO',      // Emerging Markets
  'AAXJ',     // Asia Pacific
  'VNQ',      // Global Real Estate
  'BND',      // Global Bonds
  'TIP',      // Inflation-linked
  'BIL',      // Cash
  'BTC-USD'   // Bitcoin
];

const outputPath = path.join(__dirname, '../data/eod_quotes.json');

const headers = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Accept': 'application/json'
};

async function fetchQuote(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const meta = json?.chart?.result?.[0]?.meta;
  const price = meta?.regularMarketPrice || meta?.chartPreviousClose;
  if (typeof price === 'number' && price > 0) return price;
  throw new Error('Invalid price');
}

async function fetchAssetPerformance(symbol) {
  // Pull max history at 1-month intervals for calendar year returns and last 12M
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1mo&range=max`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  const timestamps = result?.timestamp || [];
  const closes = result?.indicators?.quote?.[0]?.close || [];

  const bars = [];
  for (let i = 0; i < timestamps.length; i++) {
    const c = closes[i];
    if (typeof c === 'number' && c > 0) {
      bars.push({ date: new Date(timestamps[i] * 1000), close: c });
    }
  }

  if (bars.length < 2) throw new Error('Insufficient history');

  // Group by year to compute annual returns
  const byYear = {};
  for (const b of bars) {
    const y = b.date.getFullYear();
    if (!byYear[y]) {
      byYear[y] = { first: b.close, last: b.close };
    } else {
      byYear[y].last = b.close;
    }
  }

  const currentYear = new Date().getFullYear();
  const yearReturns = [];
  for (const [yearStr, vals] of Object.entries(byYear)) {
    const y = parseInt(yearStr, 10);
    // Only include completed calendar years prior to current year
    if (y < currentYear && vals.first > 0) {
      const pct = ((vals.last / vals.first) - 1.0) * 100.0;
      yearReturns.push(pct);
    }
  }

  const bestYear = yearReturns.length ? Math.max(...yearReturns) : 0;
  const worstYear = yearReturns.length ? Math.min(...yearReturns) : 0;

  // Trailing 12 months return
  const lastBar = bars[bars.length - 1];
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  
  // Find closest bar ~12 months ago
  let closestBar = bars[0];
  let minDiff = Infinity;
  for (const b of bars) {
    const diff = Math.abs(b.date - oneYearAgo);
    if (diff < minDiff) {
      minDiff = diff;
      closestBar = b;
    }
  }
  const last12m = ((lastBar.close / closestBar.close) - 1.0) * 100.0;

  return {
    last12m: Math.round(last12m * 10) / 10,
    bestYear: Math.round(bestYear * 10) / 10,
    worstYear: Math.round(worstYear * 10) / 10
  };
}

async function run() {
  let existingData = { quotes: {}, assetPerformance: {} };
  if (fs.existsSync(outputPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
      // Backwards compatibility if old structure was just flat quotes
      if (parsed.quotes) existingData = parsed;
      else existingData.quotes = parsed;
    } catch (_) {}
  }

  // Fallback defaults for assetPerformance if fetch fails
  const defaultPerformance = {
    'DBC': { last12m: 34.0, bestYear: 42.0, worstYear: -35.0 },
    'GLD': { last12m: 22.0, bestYear: 61.0, worstYear: -29.0 },
    'ACWX': { last12m: 21.0, bestYear: 37.0, worstYear: -45.0 },
    'VEA': { last12m: 15.0, bestYear: 35.0, worstYear: -41.0 },
    'VWO': { last12m: 12.0, bestYear: 65.0, worstYear: -53.0 },
    'AAXJ': { last12m: 29.0, bestYear: 58.0, worstYear: -33.0 },
    'VNQ': { last12m: 17.0, bestYear: 32.0, worstYear: -38.0 },
    'BND': { last12m: 5.2, bestYear: 18.0, worstYear: -14.0 },
    'TIP': { last12m: 4.8, bestYear: 13.0, worstYear: -17.0 },
    'BIL': { last12m: 5.1, bestYear: 5.2, worstYear: 0.0 },
    'BTC-USD': { last12m: 120.0, bestYear: 1237.0, worstYear: -74.0 }
  };

  const output = {
    updatedAt: new Date().toISOString(),
    quotes: existingData.quotes || {},
    assetPerformance: existingData.assetPerformance || defaultPerformance
  };

  // 1. Fetch Latest EOD Prices
  console.log('--- Fetching EOD Prices ---');
  for (const sym of PRICE_SYMBOLS) {
    try {
      const price = await fetchQuote(sym);
      output.quotes[sym] = Math.round(price * 100) / 100;
      console.log(`✓ ${sym}: $${output.quotes[sym]}`);
    } catch (e) {
      console.warn(`✗ ${sym} quote failed: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 250));
  }

  // 2. Fetch Asset Class History
  console.log('\n--- Fetching Asset Class Metrics ---');
  for (const sym of ASSET_CLASS_SYMBOLS) {
    try {
      const perf = await fetchAssetPerformance(sym);
      output.assetPerformance[sym] = perf;
      console.log(`✓ ${sym}: 12M: ${perf.last12m}%, Best: ${perf.bestYear}%, Worst: ${perf.worstYear}%`);
    } catch (e) {
      console.warn(`✗ ${sym} performance failed (${e.message}). Keeping existing baseline.`);
    }
    await new Promise(r => setTimeout(r, 300));
  }

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
  console.log('\nFinished updating eod_quotes.json');
}

run();
