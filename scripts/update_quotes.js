const fs = require('fs');
const path = require('path');

// 1. Tickers for current EOD prices (model portfolios & seed funds)
const PRICE_SYMBOLS = [
  'SPY', 'IVV',  'QQQ', 
   'VWO', 'BND', 'BNDX',
  'VNQ', 'SCHD', 'IWM', 'GLD',
  'HYG', 'DBC', 'PSP', 'PAVE', 'RING', 'ESGU', 'IYH', 'XLE'
];

// 2. Country proxies for multi-decade nominal return series
const COUNTRY_PROXIES = {
  'USA': '^GSPC',
  'GBR': '^FTSE',
  'DEU': '^GDAXI',
  'FRA': '^FCHI',
  'ESP': '^IBEX',
  'ITA': 'FTSEMIB.MI',
  'NLD': '^AEX',
  'SWE': '^OMX',
  'CHE': '^SSMI',
  'CAN': '^GSPTSE',
  'AUS': '^AXJO',
  'JPN': '^N225',
  'HKG': '^HSI',
  'IND': '^BSESN',
  'SGP': '^STI'
};

// 3. Historical records for the 11 Asset Classes
const DEFAULT_ASSET_PERFORMANCE = {
  'AAXJ':    { last12m: 34.0, bestYear: 58.0,   worstYear: -33.0 },
  'DBC':     { last12m: 33.0, bestYear: 42.0,   worstYear: -35.0 },
  'ACWX':    { last12m: 25.0, bestYear: 31.0,   worstYear: -40.0 },
  'VT':      { last12m: 25.0, bestYear: 31.0,   worstYear: -40.0 }, 
  'VEA':     { last12m: 21.0, bestYear: 35.0,   worstYear: -43.0 },
  'GLD':     { last12m: 20.0, bestYear: 61.0,   worstYear: -29.0 },
  'VWO':     { last12m: 19.0, bestYear: 65.0,   worstYear: -55.0 },
  'VNQ':     { last12m: 16.0, bestYear: 32.0,   worstYear: -25.0 },
  'BIL':     { last12m: 5.0,  bestYear: 5.2,    worstYear: 0.0 },
  'TIP':     { last12m: -2.0, bestYear: 9.0,    worstYear: -17.0 },
  'BND':     { last12m: -3.0, bestYear: 7.0,    worstYear: -14.0 },
  'BNDX':    { last12m: -3.0, bestYear: 7.0,    worstYear: -14.0 },
  'GBTC':    { last12m: -44.0, bestYear: 1237.0, worstYear: -74.0 },
  'BTC-USD': { last12m: -44.0, bestYear: 1237.0, worstYear: -74.0 }
};

// 4. Multi-decade benchmark return history baseline (1980 - present)
// Exact 1:1 match for all 15 countries in COUNTRY_PROXIES
const DEFAULT_COUNTRY_INDICES = {
  'USA': [
    { year: 1980, nominalPct: 32.5 }, { year: 1985, nominalPct: 31.7 },
    { year: 1990, nominalPct: -3.1 }, { year: 1995, nominalPct: 37.6 },
    { year: 2000, nominalPct: -9.1 }, { year: 2005, nominalPct: 4.9 },
    { year: 2008, nominalPct: -37.0 }, { year: 2010, nominalPct: 15.1 },
    { year: 2015, nominalPct: 1.4 }, { year: 2020, nominalPct: 18.4 },
    { year: 2021, nominalPct: 28.7 }, { year: 2022, nominalPct: -18.1 },
    { year: 2023, nominalPct: 26.3 }, { year: 2024, nominalPct: 25.0 },
    { year: 2025, nominalPct: 12.8 }
  ],
  'GBR': [
    { year: 1985, nominalPct: 15.2 }, { year: 1990, nominalPct: -11.5 },
    { year: 2000, nominalPct: -10.2 }, { year: 2008, nominalPct: -31.3 },
    { year: 2020, nominalPct: -14.3 }, { year: 2022, nominalPct: 0.9 },
    { year: 2023, nominalPct: 3.8 }, { year: 2024, nominalPct: 7.5 },
    { year: 2025, nominalPct: 6.2 }
  ],
  'DEU': [
    { year: 1990, nominalPct: -21.9 }, { year: 2000, nominalPct: -7.5 },
    { year: 2008, nominalPct: -40.4 }, { year: 2020, nominalPct: 3.5 },
    { year: 2022, nominalPct: -12.3 }, { year: 2023, nominalPct: 20.3 },
    { year: 2024, nominalPct: 18.9 }, { year: 2025, nominalPct: 14.1 }
  ],
  'FRA': [
    { year: 1990, nominalPct: -24.1 }, { year: 2000, nominalPct: -0.5 },
    { year: 2008, nominalPct: -42.7 }, { year: 2020, nominalPct: -7.1 },
    { year: 2022, nominalPct: -9.5 }, { year: 2023, nominalPct: 16.5 },
    { year: 2024, nominalPct: 2.2 }, { year: 2025, nominalPct: 8.5 }
  ],
  'ESP': [
    { year: 1995, nominalPct: 12.4 }, { year: 2000, nominalPct: -21.7 },
    { year: 2008, nominalPct: -39.4 }, { year: 2012, nominalPct: -4.7 },
    { year: 2020, nominalPct: -15.5 }, { year: 2022, nominalPct: -5.6 },
    { year: 2023, nominalPct: 22.8 }, { year: 2024, nominalPct: 12.7 },
    { year: 2025, nominalPct: 9.4 }
  ],
  'ITA': [
    { year: 1998, nominalPct: 41.2 }, { year: 2000, nominalPct: -2.6 },
    { year: 2008, nominalPct: -49.5 }, { year: 2011, nominalPct: -25.2 },
    { year: 2020, nominalPct: -5.4 }, { year: 2022, nominalPct: -12.0 },
    { year: 2023, nominalPct: 28.0 }, { year: 2024, nominalPct: 14.2 },
    { year: 2025, nominalPct: 11.0 }
  ],
  'NLD': [
    { year: 1990, nominalPct: -13.8 }, { year: 2000, nominalPct: -5.3 },
    { year: 2008, nominalPct: -52.3 }, { year: 2020, nominalPct: 3.3 },
    { year: 2022, nominalPct: -13.7 }, { year: 2023, nominalPct: 14.2 },
    { year: 2024, nominalPct: 15.1 }, { year: 2025, nominalPct: 10.3 }
  ],
  'SWE': [
    { year: 1991, nominalPct: 11.2 }, { year: 2000, nominalPct: -11.9 },
    { year: 2008, nominalPct: -38.8 }, { year: 2020, nominalPct: 5.8 },
    { year: 2022, nominalPct: -15.6 }, { year: 2023, nominalPct: 17.3 },
    { year: 2024, nominalPct: 10.9 }, { year: 2025, nominalPct: 8.7 }
  ],
  'CHE': [
    { year: 1990, nominalPct: -20.8 }, { year: 2000, nominalPct: -7.5 },
    { year: 2008, nominalPct: -34.8 }, { year: 2020, nominalPct: 0.8 },
    { year: 2022, nominalPct: -16.7 }, { year: 2023, nominalPct: 3.8 },
    { year: 2024, nominalPct: 7.9 }, { year: 2025, nominalPct: 6.5 }
  ],
  'CAN': [
    { year: 1990, nominalPct: -18.0 }, { year: 2000, nominalPct: 7.4 },
    { year: 2008, nominalPct: -35.0 }, { year: 2020, nominalPct: 2.2 },
    { year: 2022, nominalPct: -8.7 }, { year: 2023, nominalPct: 8.1 },
    { year: 2024, nominalPct: 17.5 }, { year: 2025, nominalPct: 10.2 }
  ],
  'AUS': [
    { year: 1990, nominalPct: -22.5 }, { year: 2000, nominalPct: 4.8 },
    { year: 2008, nominalPct: -41.3 }, { year: 2020, nominalPct: -1.5 },
    { year: 2022, nominalPct: -5.5 }, { year: 2023, nominalPct: 7.8 },
    { year: 2024, nominalPct: 8.3 }, { year: 2025, nominalPct: 7.9 }
  ],
  'JPN': [
    { year: 1989, nominalPct: 29.0 }, { year: 1990, nominalPct: -38.7 },
    { year: 2000, nominalPct: -27.2 }, { year: 2008, nominalPct: -42.1 },
    { year: 2020, nominalPct: 16.0 }, { year: 2022, nominalPct: -9.4 },
    { year: 2023, nominalPct: 28.2 }, { year: 2024, nominalPct: 19.3 },
    { year: 2025, nominalPct: 16.4 }
  ],
  'HKG': [
    { year: 1993, nominalPct: 115.7 }, { year: 2000, nominalPct: -11.0 },
    { year: 2008, nominalPct: -48.3 }, { year: 2020, nominalPct: -3.4 },
    { year: 2022, nominalPct: -15.5 }, { year: 2023, nominalPct: -13.8 },
    { year: 2024, nominalPct: 17.8 }, { year: 2025, nominalPct: 8.0 }
  ],
  'IND': [
    { year: 1995, nominalPct: -20.8 }, { year: 2000, nominalPct: -20.6 },
    { year: 2008, nominalPct: -52.4 }, { year: 2020, nominalPct: 15.8 },
    { year: 2022, nominalPct: 4.4 }, { year: 2023, nominalPct: 18.7 },
    { year: 2024, nominalPct: 18.2 }, { year: 2025, nominalPct: 12.5 }
  ],
  'SGP': [
    { year: 1997, nominalPct: -31.0 }, { year: 2000, nominalPct: -22.3 },
    { year: 2008, nominalPct: -49.2 }, { year: 2020, nominalPct: -11.8 },
    { year: 2022, nominalPct: 4.1 }, { year: 2023, nominalPct: -0.3 },
    { year: 2024, nominalPct: 17.1 }, { year: 2025, nominalPct: 7.2 }
  ]
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

async function fetchYTDReturn(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1mo&range=ytd`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const quotes = json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
  const valid = quotes.filter(c => typeof c === 'number' && c > 0);
  if (valid.length < 2) throw new Error('Insufficient YTD points');

  const first = valid[0];
  const last = valid[valid.length - 1];
  const pct = ((last / first) - 1.0) * 100.0;
  return Math.round(pct * 10) / 10;
}

async function run() {
  let existingQuotes = {};
  let existingPerf = {};
  let existingCountries = {};

  if (fs.existsSync(outputPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
      if (parsed.quotes && typeof parsed.quotes === 'object') existingQuotes = parsed.quotes;
      if (parsed.assetPerformance && Object.keys(parsed.assetPerformance).length > 0) existingPerf = parsed.assetPerformance;
      if (parsed.countryIndices && Object.keys(parsed.countryIndices).length > 0) existingCountries = parsed.countryIndices;
    } catch (_) {}
  }

  const assetPerf = Object.keys(existingPerf).length > 0 
    ? existingPerf 
    : JSON.parse(JSON.stringify(DEFAULT_ASSET_PERFORMANCE));

  const countryIndices = Object.keys(existingCountries).length > 0
    ? existingCountries
    : JSON.parse(JSON.stringify(DEFAULT_COUNTRY_INDICES));

// ⭐️ 1. Start with an empty quotes map so removed tickers are dropped
  const freshQuotes = {};

  // ⭐️ 2. Fetch EOD Prices strictly for the tickers defined in PRICE_SYMBOLS
  console.log('--- Updating Ticker Prices ---');
  for (const sym of PRICE_SYMBOLS) {
    try {
      const price = await fetchQuote(sym);
      freshQuotes[sym] = Math.round(price * 100) / 100;
      console.log(`✓ ${sym}: $${freshQuotes[sym]}`);
    } catch (e) {
      // If network fails for a ticker, keep its previous price if available
      if (existingQuotes[sym]) {
        freshQuotes[sym] = existingQuotes[sym];
        console.warn(`! ${sym} fetch failed: using cached price ($${existingQuotes[sym]})`);
      } else {
        console.warn(`✗ ${sym} quote skipped: ${e.message}`);
      }
    }
    await new Promise(r => setTimeout(r, 200));
  }

  const output = {
    updatedAt: new Date().toISOString(),
    quotes: freshQuotes, // 👈 Only contains tickers currently in PRICE_SYMBOLS
    assetPerformance: assetPerf,
    countryIndices: countryIndices
  };

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

  // 3. Update Current Year Returns for Country Indices
  console.log('\n--- Refreshing Country Index Returns ---');
  const currentYear = new Date().getFullYear();
  for (const [iso3, proxySymbol] of Object.entries(COUNTRY_PROXIES)) {
    try {
      const ytd = await fetchYTDReturn(proxySymbol);
      if (!output.countryIndices[iso3]) {
        output.countryIndices[iso3] = [];
      }
      
      const series = output.countryIndices[iso3];
      const existingYearIdx = series.findIndex(pt => pt.year === currentYear);

      if (existingYearIdx >= 0) {
        series[existingYearIdx].nominalPct = ytd;
      } else {
        series.push({ year: currentYear, nominalPct: ytd });
      }
      console.log(`✓ ${iso3} (${proxySymbol}): ${currentYear} return updated to ${ytd}%`);
    } catch (e) {
      console.log(`- ${iso3} (${proxySymbol}): using stored baseline`);
    }
    await new Promise(r => setTimeout(r, 250));
  }

  // 4. Write final combined JSON
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
  console.log('\nSuccessfully written to data/eod_quotes.json');
}

run();
