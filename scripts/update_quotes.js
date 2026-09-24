const fs = require('fs');
const path = require('path');

// 1. Tickers for current EOD prices (model portfolios & seed funds)
const PRICE_SYMBOLS = [
  'SPY', 'VOO', 'IVV', 'VTI', 'QQQ', 'DIA',
  'VEA', 'VWO', 'VT', 'BND', 'AGG', 'BNDX',
  'VNQ', 'SCHD', 'VUG', 'VTV', 'IWM', 'GLD',
  'HYG', 'DBC', 'PSP', 'PAVE', 'RING', 'ESGU', 'IYH', 'XLE'
];

// 2. Definitive historical records for the 11 Asset Classes (1980 - present)
// Both ticker variants (e.g., GBTC & BTC-USD) are included for complete matching
const DEFAULT_ASSET_PERFORMANCE = {
  'AAXJ':    { last12m: 34.0, bestYear: 58.0,   worstYear: -33.0 }, // Asia Pacific
  'DBC':     { last12m: 33.0, bestYear: 42.0,   worstYear: -35.0 }, // Commodities
  'ACWX':    { last12m: 25.0, bestYear: 31.0,   worstYear: -40.0 }, // Global equities
  'VT':      { last12m: 25.0, bestYear: 31.0,   worstYear: -40.0 }, 
  'VEA':     { last12m: 21.0, bestYear: 35.0,   worstYear: -43.0 }, // Developed equities
  'GLD':     { last12m: 20.0, bestYear: 61.0,   worstYear: -29.0 }, // Gold
  'VWO':     { last12m: 19.0, bestYear: 65.0,   worstYear: -55.0 }, // Emerging markets
  'VNQ':     { last12m: 16.0, bestYear: 32.0,   worstYear: -25.0 }, // Real estate
  'BIL':     { last12m: 5.0,  bestYear: 5.2,    worstYear: 0.0 },   // Cash
  'TIP':     { last12m: -2.0, bestYear: 9.0,    worstYear: -17.0 }, // Inflation-linked
  'BND':     { last12m: -3.0, bestYear: 7.0,    worstYear: -14.0 }, // Global bonds
  'BNDX':    { last12m: -3.0, bestYear: 7.0,    worstYear: -14.0 },
  'GBTC':    { last12m: -44.0, bestYear: 1237.0, worstYear: -74.0 }, // Bitcoin
  'BTC-USD': { last12m: -44.0, bestYear: 1237.0, worstYear: -74.0 }
};

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

async function fetchTrailing12MReturn(symbol) {
  // Pull 1-year history (accepted without authentication)
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1mo&range=1y`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const quotes = json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
  const valid = quotes.filter(c => typeof c === 'number' && c > 0);
  if (valid.length < 2) throw new Error('Insufficient points');
  
  const first = valid[0];
  const last = valid[valid.length - 1];
  const pct = ((last / first) - 1.0) * 100.0;
  return Math.round(pct * 10) / 10;
}

async function run() {
  let existingQuotes = {};
  let existingPerf = {};

  if (fs.existsSync(outputPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
      if (parsed.quotes && typeof parsed.quotes === 'object') {
        existingQuotes = parsed.quotes;
      }
      if (parsed.assetPerformance && Object.keys(parsed.assetPerformance).length > 0) {
        existingPerf = parsed.assetPerformance;
      }
    } catch (_) {}
  }

  // Ensure assetPerformance always starts with the complete baseline table
  const assetPerf = Object.keys(existingPerf).length > 0 
    ? existingPerf 
    : JSON.parse(JSON.stringify(DEFAULT_ASSET_PERFORMANCE));

  const output = {
    updatedAt: new Date().toISOString(),
    quotes: existingQuotes,
    assetPerformance: assetPerf
  };

  // 1. Fetch EOD Prices
  console.log('--- Updating Ticker Prices ---');
  for (const sym of PRICE_SYMBOLS) {
    try {
      const price = await fetchQuote(sym);
      output.quotes[sym] = Math.round(price * 100) / 100;
      console.log(`✓ ${sym}: $${output.quotes[sym]}`);
    } catch (e) {
      console.warn(`✗ ${sym} quote skipped: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 200));
  }

  // 2. Refresh Trailing 12-Month Returns for Asset Classes
  console.log('\n--- Refreshing Asset Class 12M Trailing Returns ---');
  for (const sym of Object.keys(output.assetPerformance)) {
    try {
      const t12m = await fetchTrailing12MReturn(sym);
      output.assetPerformance[sym].last12m = t12m;
      console.log(`✓ ${sym}: 12M return updated to ${t12m}%`);
    } catch (e) {
      console.log(`- ${sym}: using baseline 12M (${output.assetPerformance[sym].last12m}%)`);
    }
    await new Promise(r => setTimeout(r, 250));
  }

  // 3. Write final combined JSON
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
  console.log('\nSuccessfully written to data/eod_quotes.json');
}

run();
