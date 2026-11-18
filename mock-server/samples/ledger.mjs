/**
 * Business checking statements for the sample archive. The rows come from a fixed list and a
 * seeded generator, so each build makes the same statements, and each month opens with the
 * balance the month before closed with.
 */
import { BANK, STUDIO } from './people.mjs';

const MONTHS = ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
const NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** Deposits from clients, by month: [day, payer, amount]. */
const DEPOSITS = {
  '2026-06': [[12, 'Tidewater Yoga', 1240]],
  '2026-07': [[28, 'Larkspur Coffee Co.', 2250]],
  '2026-08': [[11, 'Orchard Street Books', 2850]],
  '2026-09': [[24, 'Tidewater Yoga', 1115]],
  '2026-10': [
    [9, 'Larkspur Coffee Co.', 3600],
    [27, 'Orchard Street Books', 3150],
  ],
};

const CARD = [
  'Mill Street Print Shop',
  'Paper & Ink Supply',
  'Brightline Electronics',
  'Fontstand Online',
  'Postal Center',
  'Harbor Cafe (client meeting)',
  'Stock Photo Library',
];

function seeded(seed) {
  let value = seed;
  return () => {
    value = (value * 1103515245 + 12345) % 2147483648;
    return value / 2147483648;
  };
}

function lastDay(month) {
  const [year, m] = month.split('-').map(Number);
  return new Date(Date.UTC(year, m, 0)).getUTCDate();
}

function rowsOf(month) {
  const random = seeded(Number(month.replace('-', '')));
  const rows = (DEPOSITS[month] ?? []).map(([day, payer, amount]) => [
    day,
    `Deposit — ${payer}`,
    amount,
  ]);
  rows.push([1, 'The Loft Coworking — membership', -185]);
  rows.push([2, 'Inkwell Cloud Tools — monthly storage', -9.99]);
  rows.push([15, `Transfer to owner — ${STUDIO.name.split(' ')[0]} draw`, -1500]);
  rows.push([16, 'Pinecrest Auto Insurance — business use rider', -18]);
  for (let i = 0; i < 4; i += 1) {
    const day = 3 + Math.floor(random() * (lastDay(month) - 4));
    const shop = CARD[Math.floor(random() * CARD.length)];
    rows.push([day, `Card purchase — ${shop}`, -Math.round(8 + random() * 90) - 0.45]);
  }
  return rows.sort((a, b) => a[0] - b[0]);
}

function build() {
  const out = new Map();
  let balance = 6420.18;
  for (const month of MONTHS) {
    const [year, m] = month.split('-').map(Number);
    const rows = rowsOf(month).map(([day, text, amount]) => {
      balance = Math.round((balance + amount) * 100) / 100;
      return [
        `${String(m).padStart(2, '0')}/${String(day).padStart(2, '0')}`,
        text,
        amount,
        balance,
      ];
    });
    const opening = Math.round((balance - rows.reduce((sum, r) => sum + r[2], 0)) * 100) / 100;
    out.set(month, {
      bank: BANK,
      holder: STUDIO,
      account: 'Business checking ••••2093',
      label: `${NAMES[m - 1]} ${year}`,
      closed: `${month}-${String(lastDay(month)).padStart(2, '0')}`,
      opening,
      closing: balance,
      rows,
    });
  }
  return out;
}

const STATEMENTS = build();

export function statement(month) {
  return STATEMENTS.get(month);
}
