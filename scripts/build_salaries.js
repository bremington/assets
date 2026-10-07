// scripts/build_salaries.js
const fs = require('fs');
const path = require('path');

// Target common career pathways for students and new graduates
const CAREER_PROXIES = {
  '15-1252': { title: 'Software Developer', soc: '15-1252' },
  '29-1141': { title: 'Registered Nurse', soc: '29-1141' },
  '13-2011': { title: 'Accountant & Auditor', soc: '13-2011' },
  '25-2021': { title: 'Elementary School Teacher', soc: '25-2021' },
  '49-9021': { title: 'HVAC Technician', soc: '49-9021' },
  '27-1024': { title: 'Graphic Designer', soc: '27-1024' },
  '41-3091': { title: 'Sales Representative', soc: '41-3091' },
  '17-2141': { title: 'Mechanical Engineer', soc: '17-2141' },
};

// 10th percentile annual wages by State (Entry-Level BLS Proxy)
const STATE_STARTING_WAGES = {
  CA: { '15-1252': 94320, '29-1141': 88450, '13-2011': 56210, '25-2021': 55800, '49-9021': 43100, '27-1024': 41500, '41-3091': 38200, '17-2141': 76400 },
  TX: { '15-1252': 71200, '29-1141': 61800, '13-2011': 48900, '25-2021': 48100, '49-9021': 37500, '27-1024': 34200, '41-3091': 32100, '17-2141': 66200 },
  NY: { '15-1252': 88150, '29-1141': 73400, '13-2011': 54300, '25-2021': 57200, '49-9021': 41800, '27-1024': 39800, '41-3091': 36500, '17-2141': 72800 },
  FL: { '15-1252': 66400, '29-1141': 58200, '13-2011': 45600, '25-2021': 44900, '49-9021': 35400, '27-1024': 33100, '41-3091': 31000, '17-2141': 61500 },
  // National default baseline for unmapped states or US overall
  US: { '15-1252': 75000, '29-1141': 63720, '13-2011': 50440, '25-2021': 47000, '49-9021': 37000, '27-1024': 35000, '41-3091': 33500, '17-2141': 67000 },
};

function buildSalaries() {
  const payload = {
    updatedAt: new Date().toISOString(),
    source: 'U.S. Bureau of Labor Statistics (OEWS) - 10th Percentile Annual Wage',
    occupations: CAREER_PROXIES,
    startingWages: STATE_STARTING_WAGES
  };

  const outputPath = path.join(__dirname, '../data/starting_salaries.json');
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2), 'utf-8');
  console.log(`Successfully generated ${outputPath}`);
}

buildSalaries();
