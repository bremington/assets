const fs = require('fs');
const path = require('path');

const SYMBOLS = [
  'SPY', 'VOO', 'IVV', 'VTI', 'QQQ', 'DIA',
  'VEA', 'VWO', 'VT', 'BND', 'AGG', 'BNDX',
  'VNQ', 'SCHD', 'VUG', 'VTV', 'IWM', 'GLD',
  'HYG', 'DBC', 'PSP', 'PAVE', 'RING', 'ESGU', 'IYH', 'XLE'
];

const outputPath = path.join(__dirname, '../data/eod_quotes.json');

async function fetchQuote(symbol) {
  // Use Yahoo v8 chart API with an explicit desktop browser User-Agent
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      'Accept': 'application/json'
    }
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const json = await res.json();
  const meta = json?.chart?.result?.[0]?.meta;
  const price = meta?.regularMarketPrice || meta?.chartPreviousClose;

  if (typeof price === 'number' && price > 0) {
    return price;
  }
  throw new Error('Invalid price payload');
}

async function run() {
  // 1. Read existing quotes so we never wipe good data on network errors
  let quotes = {};
  if (fs.existsSync(outputPath)) {
    try {
      const existing = fs.readFileSync(outputPath, 'utf-8');
      quotes = JSON.parse(existing);
    } catch (_) {
      quotes = {};
    }
  }

  // 2. Default fallback baseline if file was completely wiped
  const defaults = {
    SPY: 570.25, VOO: 525.10, IVV: 572.00, VTI: 280.40, QQQ: 485.60,
    DIA: 420.00, VEA: 51.50, VWO: 43.80, VT: 115.80, BND: 73.15,
    AGG: 98.20, BNDX: 50.10, VNQ: 90.00, SCHD: 28.50, VUG: 375.00,
    VTV: 165.00, IWM: 220.00, GLD: 245.00, HYG: 79.50, DBC: 22.00,
    PSP: 45.00, PAVE: 41.00, RING: 32.00, ESGU: 118.00, IYH: 310.00, XLE: 90.00
  };

  for (const [sym, val] of Object.entries(defaults)) {
    if (!quotes[sym]) quotes[sym] = val;
  }

  let updatedCount = 0;

  // 3. Fetch each symbol with rate pacing
  for (const symbol of SYMBOLS) {
    try {
      const price = await fetchQuote(symbol);
      quotes[symbol] = Math.round(price * 100) / 100;
      updatedCount++;
      console.log(`✓ ${symbol}: $${quotes[symbol]}`);
    } catch (err) {
      console.warn(`✗ ${symbol} fetch failed (${err.message}). Retaining cached price: $${quotes[symbol]}`);
    }
    // Small delay to be polite
    await new Promise(r => setTimeout(r, 400));
  }

  // 4. Save merged result
  fs.writeFileSync(outputPath, JSON.stringify(quotes, null, 2), 'utf-8');
  console.log(`Finished: ${updatedCount} live prices updated, total symbols preserved: ${Object.keys(quotes).length}`);
}

run();
