/**
 * Sanity checks for the ledger engine — the arithmetic every balance in the
 * app depends on. Run with: node scripts/verify-ledger-engine.mjs
 */
import assert from 'node:assert/strict';
import {
  computePartiesWithBalances,
  computeSummary,
  buildPartyStatement,
  filterTransactions,
  computeDashboardMetrics,
  resolvePeriod,
  financialYearRange,
  validateParty,
  validateTransaction,
  splitGst,
  round2
} from '../src/services/ledgerEngine.js';

let passed = 0;
const check = (name, fn) => {
  try {
    fn();
    passed += 1;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    console.error(`  FAIL  ${name}\n        ${err.message}`);
    process.exitCode = 1;
  }
};

const iso = (y, m, d) => new Date(y, m - 1, d, 12, 0, 0).toISOString();
const today = new Date();

const parties = [
  { id: 'p1', name: 'Ram Kumar', type: 'CUSTOMER', opening_balance: 0 },
  { id: 'p2', name: 'Shyam Traders', type: 'SUPPLIER', opening_balance: 0 },
  { id: 'p3', name: 'Gita Store', type: 'CUSTOMER', opening_balance: 500 },
  { id: 'p4', name: 'Archived Co', type: 'CUSTOMER', opening_balance: 900, is_deleted: true }
];

const txs = [
  // Ram: gave 1000 goods, got 400 back -> he owes 600
  { id: 't1', party_id: 'p1', type: 'GAVE', amount: 1000, category: 'Raw Supplies', date: iso(2026, 9, 1) },
  { id: 't2', party_id: 'p1', type: 'GOT', amount: 400, category: 'Invoice Payment', date: iso(2026, 9, 5) },
  // Shyam: we got 2000 of stock on credit -> we owe 2000
  { id: 't3', party_id: 'p2', type: 'GOT', amount: 2000, category: 'Raw Supplies', date: iso(2026, 9, 3) },
  // Gita: opening 500, gave 250 -> 750
  { id: 't4', party_id: 'p3', type: 'GAVE', amount: 250, category: 'Logistics & Fuel', date: iso(2026, 9, 7) },
  // Deleted entry must not count anywhere
  { id: 't5', party_id: 'p1', type: 'GAVE', amount: 9999, date: iso(2026, 9, 8), is_deleted: true },
  // Entry against an archived party must not inflate the workspace total
  { id: 't6', party_id: 'p4', type: 'GAVE', amount: 5000, date: iso(2026, 9, 9) }
];

console.log('\nBalances');
check('GAVE increases what a party owes you', () => {
  const [ram] = computePartiesWithBalances(parties, txs).filter((p) => p.id === 'p1');
  assert.equal(ram.current_balance, 600);
});

check('GOT makes the balance payable (negative)', () => {
  const [shyam] = computePartiesWithBalances(parties, txs).filter((p) => p.id === 'p2');
  assert.equal(shyam.current_balance, -2000);
});

check('opening balance is included', () => {
  const [gita] = computePartiesWithBalances(parties, txs).filter((p) => p.id === 'p3');
  assert.equal(gita.current_balance, 750);
});

check('soft-deleted entries are excluded', () => {
  const [ram] = computePartiesWithBalances(parties, txs).filter((p) => p.id === 'p1');
  assert.equal(ram.current_balance, 600, 'the 9999 deleted entry leaked into the balance');
});

check('archived parties are dropped from the list', () => {
  const ids = computePartiesWithBalances(parties, txs).map((p) => p.id);
  assert.deepEqual(ids, ['p1', 'p2', 'p3']);
});

check('recomputing is idempotent', () => {
  const once = computePartiesWithBalances(parties, txs);
  const twice = computePartiesWithBalances(once, txs);
  assert.deepEqual(
    once.map((p) => p.current_balance),
    twice.map((p) => p.current_balance)
  );
});

console.log('\nSummary');
check('receivables and payables net per party, not per entry', () => {
  const s = computeSummary(parties, txs);
  assert.equal(s.totalYouWillGet, 1350); // 600 Ram + 750 Gita
  assert.equal(s.totalYouWillGive, 2000); // Shyam
  assert.equal(s.netBalance, -650);
});

check('entries belonging to archived parties are not counted', () => {
  const s = computeSummary(parties, txs);
  assert.equal(s.totalTransactions, 4, 'archived-party or deleted entries were counted');
  assert.equal(s.totalParties, 3);
});

check('summary equals the sum of the visible party rows', () => {
  const rows = computePartiesWithBalances(parties, txs);
  const s = computeSummary(parties, txs);
  const net = round2(rows.reduce((a, p) => a + p.current_balance, 0));
  assert.equal(net, s.netBalance);
});

console.log('\nStatement');
check('running balance ends on the current balance', () => {
  const ram = computePartiesWithBalances(parties, txs).find((p) => p.id === 'p1');
  const rows = buildPartyStatement(ram, txs);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].runningBalance, 1000);
  assert.equal(rows[1].runningBalance, 600);
  assert.equal(rows.at(-1).runningBalance, ram.current_balance);
});

console.log('\nPeriods');
check('Monthly is the calendar month, not a rolling 30 days', () => {
  const p = resolvePeriod('Monthly', null, null, new Date(2026, 8, 14));
  assert.equal(p.from.getDate(), 1);
  assert.equal(p.from.getMonth(), 8);
});

check('Weekly starts on Monday', () => {
  // 2026-09-14 is a Monday.
  const p = resolvePeriod('Weekly', null, null, new Date(2026, 8, 16));
  assert.equal(p.from.getDay(), 1);
  assert.equal(p.from.getDate(), 14);
});

check('Yearly follows the Indian financial year', () => {
  assert.equal(financialYearRange(new Date(2026, 8, 14)).from.getFullYear(), 2026);
  assert.equal(financialYearRange(new Date(2026, 1, 14)).from.getFullYear(), 2025);
});

console.log('\nFiltering & metrics');
const nowTxs = [
  { id: 'n1', party_id: 'p1', type: 'GAVE', amount: 300, category: 'Rent & Utilities', date: today.toISOString() },
  { id: 'n2', party_id: 'p1', type: 'GOT', amount: 120, category: 'Invoice Payment', date: today.toISOString() },
  { id: 'n3', party_id: 'p2', type: 'GAVE', amount: 80, category: 'Rent & Utilities', date: iso(2020, 1, 1) }
];

check('period filter excludes out-of-range entries', () => {
  const rows = filterTransactions(nowTxs, parties, { dateFilterCombo: 'Daily' });
  assert.deepEqual(rows.map((t) => t.id).sort(), ['n1', 'n2']);
});

check('search matches party name, category and notes', () => {
  const rows = filterTransactions(nowTxs, parties, { dateFilterCombo: 'All', searchTerm: 'shyam' });
  assert.deepEqual(rows.map((t) => t.id), ['n3']);
});

check('type filter accepts legacy DEBIT/CREDIT synonyms', () => {
  const legacy = [{ id: 'l1', party_id: 'p1', type: 'DEBIT', amount: 50, date: today.toISOString() }];
  const rows = filterTransactions(legacy, parties, { dateFilterCombo: 'All', filterType: 'GAVE' });
  assert.equal(rows.length, 1);
});

check('dashboard metrics honour the selected period', () => {
  const daily = computeDashboardMetrics(nowTxs, parties, { dateFilterCombo: 'Daily' });
  assert.equal(daily.totalOut, 300);
  assert.equal(daily.totalIn, 120);
  assert.equal(daily.netPosition, -180);

  const all = computeDashboardMetrics(nowTxs, parties, { dateFilterCombo: 'All' });
  assert.equal(all.totalOut, 380, 'the All-time total should include the 2020 entry');
});

check('top debtors and creditors are ranked by live balance', () => {
  const m = computeDashboardMetrics(txs, parties, { dateFilterCombo: 'All' });
  assert.equal(m.topDebtors[0].id, 'p3'); // 750
  assert.equal(m.topCreditors[0].id, 'p2'); // -2000
});

console.log('\nDashboard totals (You Will Get / You Will Give regression)');

// Reproduces the reported bug exactly: a ₹100 IN (GOT) entry and a ₹5,000
// OUT (GAVE) entry on the same day must show Get=100 / Give=5000 / Net=-4900
// — not the inverted numbers the dashboard used to show.
check('mixed IN/OUT: get is the GOT total, give is the GAVE total, net is get-minus-give', () => {
  const mixed = [
    { id: 'm1', party_id: 'p1', type: 'GOT', amount: 100, category: 'General', date: today.toISOString() },
    { id: 'm2', party_id: 'p1', type: 'OUT', amount: 5000, category: 'Petrol', date: today.toISOString() }
  ];
  const m = computeDashboardMetrics(mixed, parties, { dateFilterCombo: 'Daily' });
  assert.equal(m.totalIn, 100, 'YOU WILL GET must equal the GOT/IN total');
  assert.equal(m.totalOut, 5000, 'YOU WILL GIVE must equal the GAVE/OUT total');
  assert.equal(m.netPosition, -4900, 'net must be totalIn - totalOut');
});

check('only IN entries: give is zero, net is positive', () => {
  const onlyIn = [{ id: 'i1', party_id: 'p1', type: 'GOT', amount: 250, date: today.toISOString() }];
  const m = computeDashboardMetrics(onlyIn, parties, { dateFilterCombo: 'Daily' });
  assert.equal(m.totalIn, 250);
  assert.equal(m.totalOut, 0);
  assert.equal(m.netPosition, 250);
});

check('only OUT entries: get is zero, net is negative', () => {
  const onlyOut = [{ id: 'o1', party_id: 'p1', type: 'GAVE', amount: 250, date: today.toISOString() }];
  const m = computeDashboardMetrics(onlyOut, parties, { dateFilterCombo: 'Daily' });
  assert.equal(m.totalIn, 0);
  assert.equal(m.totalOut, 250);
  assert.equal(m.netPosition, -250);
});

check('zero entries: everything is zero, not NaN', () => {
  const m = computeDashboardMetrics([], parties, { dateFilterCombo: 'Daily' });
  assert.equal(m.totalIn, 0);
  assert.equal(m.totalOut, 0);
  assert.equal(m.netPosition, 0);
});

check('decimals sum without floating point drift (0.1 + 0.2 style)', () => {
  const decimals = [
    { id: 'd1', party_id: 'p1', type: 'GOT', amount: 0.1, date: today.toISOString() },
    { id: 'd2', party_id: 'p1', type: 'GOT', amount: 0.2, date: today.toISOString() }
  ];
  const m = computeDashboardMetrics(decimals, parties, { dateFilterCombo: 'Daily' });
  assert.equal(m.totalIn, 0.3);
});

check('negative or invalid amounts are ignored, not subtracted', () => {
  const bad = [
    { id: 'b1', party_id: 'p1', type: 'GOT', amount: -500, date: today.toISOString() },
    { id: 'b2', party_id: 'p1', type: 'GAVE', amount: 'not-a-number', date: today.toISOString() },
    { id: 'b3', party_id: 'p1', type: 'GAVE', amount: undefined, date: today.toISOString() },
    { id: 'b4', party_id: 'p1', type: 'GOT', amount: 100, date: today.toISOString() }
  ];
  const m = computeDashboardMetrics(bad, parties, { dateFilterCombo: 'Daily' });
  assert.equal(m.totalIn, 100, 'a negative/invalid amount must be treated as 0, never as a negative contribution');
  assert.equal(m.totalOut, 0);
});

check('date range boundary: an entry dated exactly at period start/end is included', () => {
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0);
  const boundary = [
    { id: 'bd1', party_id: 'p1', type: 'GOT', amount: 10, date: monthStart.toISOString() },
    { id: 'bd2', party_id: 'p1', type: 'GAVE', amount: 20, date: today.toISOString() }
  ];
  const m = computeDashboardMetrics(boundary, parties, { dateFilterCombo: 'Monthly' });
  assert.equal(m.totalIn, 10, 'the first instant of the month must be included, not excluded by an off-by-one');
  assert.equal(m.totalOut, 20);
});

check('date range boundary: an entry one day before the period start is excluded', () => {
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0);
  const justBefore = new Date(monthStart.getTime() - 1);
  const boundary = [{ id: 'bd3', party_id: 'p1', type: 'GOT', amount: 999, date: justBefore.toISOString() }];
  const m = computeDashboardMetrics(boundary, parties, { dateFilterCombo: 'Monthly' });
  assert.equal(m.totalIn, 0, 'the last instant of the previous month must not leak into this month');
});

check('top3Categories only ever counts OUT/GAVE entries', () => {
  const mixed = [
    { id: 'c1', party_id: 'p1', type: 'GOT', amount: 100, category: 'Salary / Wage', date: today.toISOString() },
    { id: 'c2', party_id: 'p1', type: 'GAVE', amount: 5000, category: 'Logistics & Fuel', date: today.toISOString() }
  ];
  const m = computeDashboardMetrics(mixed, parties, { dateFilterCombo: 'Daily' });
  const categories = m.top3Categories.map((c) => c.category);
  assert.ok(!categories.includes('Salary / Wage'), 'an IN/GOT entry must never show up as an expense category');
  assert.deepEqual(categories, ['Logistics & Fuel']);
});

console.log('\nValidation');
check('a positive amount is required', () => {
  assert.ok(validateTransaction({ amount: 0 }));
  assert.ok(validateTransaction({ amount: -5 }));
  assert.equal(validateTransaction({ amount: 100 }), null);
});

check('GST cannot exceed the total', () => {
  assert.ok(validateTransaction({ amount: 100, gstAmount: 150 }));
  assert.equal(validateTransaction({ amount: 100, gstAmount: 18 }), null);
});

check('future-dated entries are rejected', () => {
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString();
  assert.ok(validateTransaction({ amount: 10, date: nextWeek }));
});

check('a party needs a name but not a phone number', () => {
  assert.ok(validateParty({ name: '' }));
  assert.equal(validateParty({ name: 'Walk-in Customer' }), null);
});

check('duplicate phone numbers are caught across formats', () => {
  const list = [{ id: 'p1', name: 'Ram', phone: '+91 98765 43210' }];
  assert.ok(validateParty({ name: 'Ram Copy', phone: '9876543210' }, list));
  assert.equal(validateParty({ name: 'Ram', phone: '9876543210' }, list, 'p1'), null);
});

check('an invalid email is rejected', () => {
  assert.ok(validateParty({ name: 'X', email: 'not-an-email' }));
});

console.log('\nMoney');
check('GST splits without floating point drift', () => {
  assert.deepEqual(splitGst(1180, 180), { total: 1180, gst: 180, base: 1000 });
  assert.equal(splitGst(0.1 + 0.2, 0).total, 0.3);
});

check('GST is clamped to the total', () => {
  assert.equal(splitGst(100, 500).gst, 100);
  assert.equal(splitGst(100, -5).gst, 0);
});

console.log(`\n${passed} checks passed${process.exitCode ? ' (with failures above)' : ''}\n`);
