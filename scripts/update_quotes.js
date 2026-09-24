const fs = require('fs');
const path = require('path');

// Core symbols powering your seed list and model portfolios
const SYMBOLS = [
  'SPY', 'VOO', 'IVV', 'VTI', 'QQQ', 'DIA',
  'VEA', 'VWO', 'VT', 'BND', 'AGG', 'BNDX',
  'VNQ', 'SCHD', 'VUG', 'VTV', 'IWM', 'GLD',
  'HYG', 'DBC', 'PSP', 'PAVE', 'RING', 'ESGU', 'IYH', 'XLE'
];

async function fetchEODQuotes() {
  const quotes = {};

  for (const symbol of SYMBOLS) {
    try {
      // Free, unauthenticated daily EOD feed from Stooq
      const res = await fetch(`https://stooq.com/q/l/?s=${symbol.toLowerCase()}.us&f=sd2t2ohlcv&h&e=csv`);
      const csv = await res.text();
      const lines = csv.trim().split('\n');
      if (lines.length > 1) {
        const parts = lines[1].split(',');
        const closePrice = parseFloat(parts[parts.length - 3]);
        if (!isNaN(closePrice) && closePrice > 0) {
          quotes[symbol] = closePrice;
        }
      }
    } catch (err) {
      console.warn(`Failed to fetch ${symbol}:`, err.message);
    }
  }

  const outputPath = path.join(__dirname, '../data/eod_quotes.json');
  fs.writeFileSync(outputPath, JSON.stringify(quotes, null, 2), 'utf-8');
  console.log(`Updated ${Object.keys(quotes).length} quotes successfully.`);
}

fetchEODQuotes();
