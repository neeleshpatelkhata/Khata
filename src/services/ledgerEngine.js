/**
 * Ledger Engine — the single source of truth for all Khata balance arithmetic.
 *
 * SIGN CONVENTION (owner's point of view, applied identically on client and server):
 *
 *   GAVE  ("You Gave" / udhaar diya / goods supplied)  -> party owes you MORE  -> balance += amount
 *   GOT   ("You Got"  / payment received)              -> party owes you LESS  -> balance -= amount
 *
 *   opening_balance follows the same rule: positive means the party already owed you
 *   when the ledger was opened.
 *
 *   party balance > 0  =>  RECEIVABLE ("You will get")
 *   party balance < 0  =>  PAYABLE    ("You will give")
 *
 * DEBIT is accepted as a synonym of GAVE and CREDIT as a synonym of GOT so that
 * older records and imported data keep working.
 */

export const TX_TYPES = { GAVE: 'GAVE', GOT: 'GOT' };

/** Money is stored in rupees as a float; round on every aggregation to kill FP drift. */
export function round2(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

/** Coerce anything user/API supplied into a safe non-negative amount. */
export function safeAmount(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0) return 0;
  return round2(v);
}

/** Normalise a transaction type to 'GAVE' | 'GOT'. Unknown types default to GAVE. */
export function normalizeType(type) {
  const t = String(type || '').toUpperCase();
  if (t === 'GOT' || t === 'CREDIT' || t === 'IN' || t === 'RECEIVED') return TX_TYPES.GOT;
  return TX_TYPES.GAVE;
}

/** Signed effect of a single transaction on its party's balance. */
export function signedDelta(tx) {
  const amt = safeAmount(tx?.amount);
  return normalizeType(tx?.type) === TX_TYPES.GAVE ? amt : -amt;
}

export const isActive = (row) => !!row && !row.is_deleted;

/** Date parsing that never returns an Invalid Date. */
export function txDate(tx) {
  const raw = tx?.date || tx?.created_at;
  const d = raw ? new Date(raw) : new Date(0);
  return Number.isNaN(d.getTime()) ? new Date(0) : d;
}

// ---------------------------------------------------------------------------
// Balances
// ---------------------------------------------------------------------------

/**
 * Attach a freshly computed `current_balance` to every non-deleted party.
 * Balances are always derived from opening_balance + transactions, never from a
 * stored running total, so the numbers cannot drift out of sync with the entries.
 */
export function computePartiesWithBalances(partiesList = [], txList = []) {
  const activeParties = partiesList.filter(isActive);

  const deltaByParty = new Map();
  for (const tx of txList) {
    if (!isActive(tx) || !tx.party_id) continue;
    const key = String(tx.party_id);
    deltaByParty.set(key, (deltaByParty.get(key) || 0) + signedDelta(tx));
  }

  return activeParties.map((p) => {
    const opening = round2(p.opening_balance || 0);
    const delta = deltaByParty.get(String(p.id)) || 0;
    return { ...p, opening_balance: opening, current_balance: round2(opening + delta) };
  });
}

/**
 * Workspace roll-up. Receivables and payables are netted per party first — a
 * party you owe must not inflate "You will get".
 *
 * Transactions whose party no longer exists (deleted party) are ignored so the
 * dashboard total always equals the sum of the visible party rows.
 */
export function computeSummary(partiesList = [], txList = [], currency = 'INR') {
  const withBalances = computePartiesWithBalances(partiesList, txList);
  const livePartyIds = new Set(withBalances.map((p) => String(p.id)));

  let totalYouWillGet = 0;
  let totalYouWillGive = 0;

  for (const p of withBalances) {
    if (p.current_balance > 0) totalYouWillGet += p.current_balance;
    else if (p.current_balance < 0) totalYouWillGive += Math.abs(p.current_balance);
  }

  const countedTxs = txList.filter((t) => isActive(t) && livePartyIds.has(String(t.party_id)));

  totalYouWillGet = round2(totalYouWillGet);
  totalYouWillGive = round2(totalYouWillGive);

  return {
    totalYouWillGet,
    totalYouWillGive,
    netBalance: round2(totalYouWillGet - totalYouWillGive),
    totalParties: withBalances.length,
    totalTransactions: countedTxs.length,
    currency
  };
}

/**
 * Chronological statement for one party with a running balance after each entry.
 * Ties on the same timestamp are broken by insertion order so the running
 * balance is stable across reloads.
 */
export function buildPartyStatement(party, txList = []) {
  if (!party) return [];
  const rows = txList
    .filter((t) => isActive(t) && String(t.party_id) === String(party.id))
    .map((t, i) => ({ tx: t, i }))
    .sort((a, b) => txDate(a.tx) - txDate(b.tx) || a.i - b.i);

  let running = round2(party.opening_balance || 0);
  return rows.map(({ tx }) => {
    running = round2(running + signedDelta(tx));
    return { ...tx, runningBalance: running };
  });
}

// ---------------------------------------------------------------------------
// Date periods
// ---------------------------------------------------------------------------

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
const endOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

/** Indian financial year containing `now`: 1 April -> 31 March. */
export function financialYearRange(now = new Date()) {
  const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return {
    from: new Date(y, 3, 1, 0, 0, 0, 0),
    to: new Date(y + 1, 2, 31, 23, 59, 59, 999),
    label: `FY ${y}-${String((y + 1) % 100).padStart(2, '0')}`
  };
}

/**
 * Resolve a period selector into concrete calendar boundaries.
 *
 * These are real calendar periods, not rolling windows: "Monthly" means the
 * current month (so it resets on the 1st), which is what a shopkeeper closing
 * their books expects — a rolling 30-day window silently drops entries.
 */
export function resolvePeriod(combo, customStart = null, customEnd = null, now = new Date()) {
  switch (combo) {
    case 'Daily':
      return { from: startOfDay(now), to: endOfDay(now), label: 'Today' };

    case 'Weekly': {
      // Week starts Monday.
      const dow = (now.getDay() + 6) % 7;
      const monday = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow));
      return { from: monday, to: endOfDay(now), label: 'This Week' };
    }

    case 'Monthly':
      return {
        from: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0),
        to: endOfDay(now),
        label: 'This Month'
      };

    case 'Yearly': {
      const fy = financialYearRange(now);
      return { from: fy.from, to: endOfDay(now), label: fy.label };
    }

    case 'Custom':
      return {
        from: customStart ? startOfDay(new Date(customStart)) : null,
        to: customEnd ? endOfDay(new Date(customEnd)) : null,
        label: 'Custom Range'
      };

    case 'All':
    default:
      return { from: null, to: null, label: 'All Time' };
  }
}

export function isWithinPeriod(tx, period) {
  if (!period) return true;
  const d = txDate(tx);
  if (period.from && d < period.from) return false;
  if (period.to && d > period.to) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Filtering & metrics
// ---------------------------------------------------------------------------

/**
 * Apply the search box, type chip, category chip and period selector.
 * Newest entries first, with insertion order as a stable tie-breaker.
 */
export function filterTransactions(txList = [], partiesList = [], filters = {}) {
  const {
    searchTerm = '',
    filterType = 'ALL',
    filterCategory = 'ALL',
    dateFilterCombo = 'Monthly',
    customStartDate = null,
    customEndDate = null,
    partyId = null
  } = filters;

  const period = resolvePeriod(dateFilterCombo, customStartDate, customEndDate);
  const query = searchTerm.trim().toLowerCase();
  const wantedType = filterType && filterType !== 'ALL' ? normalizeType(filterType) : null;

  const partyNameById = new Map(partiesList.map((p) => [String(p.id), (p.name || '').toLowerCase()]));

  return txList
    .filter((t) => isActive(t))
    .filter((t) => {
      if (partyId && String(t.party_id) !== String(partyId)) return false;
      if (wantedType && normalizeType(t.type) !== wantedType) return false;

      if (filterCategory && filterCategory !== 'ALL') {
        if ((t.category || 'General').toLowerCase() !== filterCategory.toLowerCase()) return false;
      }

      if (!isWithinPeriod(t, period)) return false;

      if (query) {
        const haystack = [
          partyNameById.get(String(t.party_id)) || '',
          (t.category || '').toLowerCase(),
          (t.notes || '').toLowerCase(),
          (t.payment_mode || '').toLowerCase(),
          String(t.amount ?? '')
        ];
        if (!haystack.some((h) => h.includes(query))) return false;
      }

      return true;
    })
    .map((t, i) => ({ t, i }))
    .sort((a, b) => txDate(b.t) - txDate(a.t) || a.i - b.i)
    .map(({ t }) => t);
}

/**
 * Dashboard KPIs for the selected period.
 *
 * `totalIn`  — cash received in the period (GOT)
 * `totalOut` — credit extended / cash paid out in the period (GAVE)
 * `top3Categories` — biggest GAVE categories in the period
 * `topDebtors` / `topCreditors` — who to chase and who to pay, by live balance
 */
export function computeDashboardMetrics(txList = [], partiesList = [], filters = {}) {
  const { dateFilterCombo = 'Monthly', customStartDate = null, customEndDate = null } = filters;
  const period = resolvePeriod(dateFilterCombo, customStartDate, customEndDate);

  let totalIn = 0;
  let totalOut = 0;
  let gstCollected = 0;
  const categoryTotals = new Map();

  for (const t of txList) {
    if (!isActive(t) || !isWithinPeriod(t, period)) continue;
    const amt = safeAmount(t.amount);
    gstCollected += safeAmount(t.gst_amount);

    if (normalizeType(t.type) === TX_TYPES.GOT) {
      totalIn += amt;
    } else {
      totalOut += amt;
      const cat = t.category || 'General';
      categoryTotals.set(cat, (categoryTotals.get(cat) || 0) + amt);
    }
  }

  const top3Categories = [...categoryTotals.entries()]
    .map(([category, amount]) => ({ category, amount: round2(amount) }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);

  const withBalances = computePartiesWithBalances(partiesList, txList);
  const topDebtors = withBalances
    .filter((p) => p.current_balance > 0)
    .sort((a, b) => b.current_balance - a.current_balance)
    .slice(0, 5);
  const topCreditors = withBalances
    .filter((p) => p.current_balance < 0)
    .sort((a, b) => a.current_balance - b.current_balance)
    .slice(0, 5);

  return {
    period,
    totalIn: round2(totalIn),
    totalOut: round2(totalOut),
    netPosition: round2(totalIn - totalOut),
    gstCollected: round2(gstCollected),
    top3Categories,
    topDebtors,
    topCreditors
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function isValidPhoneNumber(phone) {
  if (!phone || !String(phone).trim()) return false;
  const digits = String(phone).replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

export function isValidEmail(email) {
  if (!email || !String(email).trim()) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email).trim());
}

/**
 * Canonical key for comparing phone numbers.
 *
 * Indian users write the same number as "9876543210", "+91 98765 43210" and
 * "091-9876543210". Comparing raw digits treats those as three different
 * people, so the last 10 digits — the national subscriber number — are used as
 * the identity instead.
 */
export function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}

/** True when another live party already uses this phone number. */
export function checkDuplicatePhone(partiesList = [], phone = '', excludePartyId = null) {
  const target = normalizePhone(phone);
  if (!target) return false;
  return partiesList.some((p) => {
    if (!isActive(p)) return false;
    if (excludePartyId && String(p.id) === String(excludePartyId)) return false;
    return normalizePhone(p.phone) === target;
  });
}

/**
 * Validate a party payload. Returns an error message, or null when valid.
 * Used for both create and update so the rules cannot diverge.
 */
export function validateParty(partyData = {}, existingParties = [], excludePartyId = null) {
  if (!partyData.name || !String(partyData.name).trim()) {
    return 'Party name is required.';
  }
  if (String(partyData.name).trim().length > 100) {
    return 'Party name must be 100 characters or fewer.';
  }

  // Contact details are optional: recording "Ram from the market" owes you
  // ₹500 must not be blocked on knowing his phone number. They are validated
  // only when supplied.
  const hasPhone = !!String(partyData.phone || '').trim();
  const hasEmail = !!String(partyData.email || '').trim();
  if (hasPhone && !isValidPhoneNumber(partyData.phone)) {
    return 'Invalid phone number. It must contain 10 to 15 digits.';
  }
  if (hasEmail && !isValidEmail(partyData.email)) {
    return 'Invalid email address format.';
  }
  if (hasPhone && checkDuplicatePhone(existingParties, partyData.phone, excludePartyId)) {
    return `A party with phone number "${partyData.phone}" already exists in this workspace.`;
  }
  return null;
}

/** Validate a transaction payload. Returns an error message, or null when valid. */
export function validateTransaction(txData = {}) {
  const amount = Number(txData.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return 'Transaction amount must be a positive number greater than 0.';
  }
  if (amount > 1_000_000_000) {
    return 'Transaction amount exceeds the maximum supported value.';
  }

  const gst = Number(txData.gstAmount ?? txData.gst_amount ?? 0);
  if (!Number.isFinite(gst) || gst < 0) {
    return 'GST/Tax amount cannot be negative.';
  }
  if (gst > amount) {
    return 'GST/Tax amount cannot be greater than the total amount.';
  }

  if (txData.date) {
    const d = new Date(txData.date);
    if (Number.isNaN(d.getTime())) return 'Transaction date is invalid.';
    // One day of slack absorbs device clock skew and timezone edges.
    if (d.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
      return 'Transaction date cannot be in the future.';
    }
  }

  return null;
}

/** Split a gross amount into base + tax. */
export function splitGst(totalAmount, gstAmount) {
  const total = safeAmount(totalAmount);
  const gst = Math.min(safeAmount(gstAmount), total);
  return { total, gst, base: round2(total - gst) };
}

/** Indian-format currency string, e.g. ₹1,23,456.50 */
export function formatCurrency(value, currency = 'INR') {
  const n = Number(value) || 0;
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
      minimumFractionDigits: 0
    }).format(n);
  } catch {
    return `₹${n.toFixed(2)}`;
  }
}
