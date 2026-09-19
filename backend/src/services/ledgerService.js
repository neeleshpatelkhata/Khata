const { v4: uuidv4 } = require('uuid');
const { run, get, all } = require('../database/db');

/**
 * SIGN CONVENTION — must stay identical to src/services/ledgerEngine.js.
 *
 *   GAVE ("You Gave")  -> the party owes you more -> balance += amount
 *   GOT  ("You Got")   -> the party owes you less -> balance -= amount
 *
 *   balance > 0 => receivable ("You will get")
 *   balance < 0 => payable    ("You will give")
 */
const round2 = (n) => Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100;

function normalizeType(type) {
  const t = String(type || '').toUpperCase();
  return t === 'GOT' || t === 'CREDIT' ? 'GOT' : 'GAVE';
}

function signedDelta(type, amount) {
  const amt = Math.max(0, Number(amount) || 0);
  return normalizeType(type) === 'GAVE' ? amt : -amt;
}

/**
 * Recompute a party's balance from its opening balance plus every live entry.
 * Deriving beats incrementing: a failed request or a concurrent edit can no
 * longer leave a stored running total out of step with the transaction list.
 */
async function recalcPartyBalance(workspaceId, partyId) {
  const party = await get('SELECT opening_balance FROM parties WHERE id = ? AND workspace_id = ?', [
    partyId,
    workspaceId
  ]);
  if (!party) return 0;

  const rows = await all(
    'SELECT type, amount FROM transactions WHERE party_id = ? AND workspace_id = ? AND COALESCE(is_deleted, 0) = 0',
    [partyId, workspaceId]
  );

  const balance = round2(
    rows.reduce((acc, r) => acc + signedDelta(r.type, r.amount), Number(party.opening_balance) || 0)
  );

  await run(
    'UPDATE parties SET current_balance = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [balance, partyId]
  );

  return balance;
}

// Verify workspace ownership
async function verifyWorkspaceAccess(workspaceId, userId) {
  const ws = await get('SELECT * FROM workspaces WHERE id = ? AND user_id = ?', [workspaceId, userId]);
  if (!ws) {
    const err = new Error('Workspace not found or unauthorized access.');
    err.statusCode = 404;
    err.code = 'WORKSPACE_NOT_FOUND';
    err.isOperational = true;
    throw err;
  }
  return ws;
}

// Workspaces
async function getUserWorkspaces(userId) {
  return await all('SELECT * FROM workspaces WHERE user_id = ? ORDER BY created_at DESC', [userId]);
}

async function createWorkspace(userId, name, currency = 'INR') {
  const id = uuidv4();
  await run('INSERT INTO workspaces (id, user_id, name, currency) VALUES (?, ?, ?, ?)', [id, userId, name, currency]);
  return await get('SELECT * FROM workspaces WHERE id = ?', [id]);
}

// Parties (Customers / Suppliers)
async function getParties(workspaceId, { type, search, page = 1, limit = 50, includeArchived = false }) {
  let sql = 'SELECT * FROM parties WHERE workspace_id = ?';
  const params = [workspaceId];

  if (!includeArchived) {
    sql += ' AND COALESCE(is_deleted, 0) = 0';
  }

  if (type) {
    sql += ' AND type = ?';
    params.push(type);
  }

  if (search) {
    sql += ' AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term, term);
  }

  sql += ' ORDER BY updated_at DESC';

  const offset = (page - 1) * limit;
  const paginatedSql = `${sql} LIMIT ? OFFSET ?`;
  const rows = await all(paginatedSql, [...params, limit, offset]);
  
  const countRow = await get(`SELECT COUNT(*) as total FROM (${sql})`, params);

  return {
    parties: rows,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: countRow ? countRow.total : rows.length,
      totalPages: countRow ? Math.ceil(countRow.total / limit) : 1
    }
  };
}

async function getPartyById(workspaceId, partyId) {
  const party = await get('SELECT * FROM parties WHERE id = ? AND workspace_id = ?', [partyId, workspaceId]);
  if (!party) {
    const err = new Error('Party record not found.');
    err.statusCode = 404;
    err.code = 'PARTY_NOT_FOUND';
    err.isOperational = true;
    throw err;
  }
  return party;
}

async function createParty(workspaceId, { name, phone, email, type = 'CUSTOMER', address, openingBalance = 0 }) {
  const id = uuidv4();
  const currentBalance = Number(openingBalance);

  await run(
    `INSERT INTO parties (id, workspace_id, name, phone, email, type, address, opening_balance, current_balance) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, workspaceId, name, phone || null, email || null, type, address || null, openingBalance, currentBalance]
  );

  return await get('SELECT * FROM parties WHERE id = ?', [id]);
}

async function updateParty(workspaceId, partyId, updates) {
  const party = await getPartyById(workspaceId, partyId);
  const name = updates.name !== undefined ? updates.name : party.name;
  const phone = updates.phone !== undefined ? updates.phone : party.phone;
  const email = updates.email !== undefined ? updates.email : party.email;
  const address = updates.address !== undefined ? updates.address : party.address;
  const type = updates.type !== undefined ? updates.type : party.type;

  const openingRaw = updates.openingBalance !== undefined ? updates.openingBalance : updates.opening_balance;
  const openingBalance = openingRaw !== undefined ? round2(openingRaw) : Number(party.opening_balance) || 0;

  await run(
    `UPDATE parties
       SET name = ?, phone = ?, email = ?, address = ?, type = ?, opening_balance = ?,
           version = version + 1, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [name, phone, email, address, type, openingBalance, partyId]
  );

  // Editing the opening balance shifts the whole ledger for that party.
  await recalcPartyBalance(workspaceId, partyId);

  return await getPartyById(workspaceId, partyId);
}

/**
 * Archive a party and its entries. Soft delete keeps the payment history
 * recoverable — a mis-tap must not wipe out a customer's ledger.
 */
async function deleteParty(workspaceId, partyId) {
  await getPartyById(workspaceId, partyId);
  await run(
    'UPDATE transactions SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE party_id = ? AND workspace_id = ?',
    [partyId, workspaceId]
  );
  await run(
    'UPDATE parties SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP, current_balance = 0, version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND workspace_id = ?',
    [partyId, workspaceId]
  );
  return { success: true, archivedPartyId: partyId };
}

async function restoreParty(workspaceId, partyId) {
  await run(
    'UPDATE parties SET is_deleted = 0, deleted_at = NULL, version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND workspace_id = ?',
    [partyId, workspaceId]
  );
  await run(
    'UPDATE transactions SET is_deleted = 0, deleted_at = NULL WHERE party_id = ? AND workspace_id = ?',
    [partyId, workspaceId]
  );
  const balance = await recalcPartyBalance(workspaceId, partyId);
  return { success: true, restoredPartyId: partyId, updatedPartyBalance: balance };
}

// Transactions
async function addTransaction(workspaceId, userId, { partyId, type, amount, baseAmount, gstAmount, paymentMode = 'CASH', category = 'GENERAL', notes, date }) {
  await getPartyById(workspaceId, partyId);

  const txAmount = round2(amount);
  if (!(txAmount > 0)) {
    const err = new Error('Transaction amount must be greater than 0.');
    err.statusCode = 400;
    err.code = 'INVALID_AMOUNT';
    err.isOperational = true;
    throw err;
  }

  const gst = Math.min(Math.max(0, round2(gstAmount || 0)), txAmount);
  const base = baseAmount !== undefined ? round2(baseAmount) : round2(txAmount - gst);

  const txId = uuidv4();
  const txDate = date || new Date().toISOString();

  await run(
    `INSERT INTO transactions (id, workspace_id, party_id, type, amount, base_amount, gst_amount, payment_mode, category, notes, date, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [txId, workspaceId, partyId, normalizeType(type), txAmount, base, gst, paymentMode, category, notes || null, txDate, userId]
  );

  const updatedPartyBalance = await recalcPartyBalance(workspaceId, partyId);
  const createdTx = await get('SELECT * FROM transactions WHERE id = ?', [txId]);

  return { transaction: createdTx, updatedPartyBalance };
}

async function updateTransaction(workspaceId, txId, updates) {
  const existingTx = await get('SELECT * FROM transactions WHERE id = ? AND workspace_id = ?', [txId, workspaceId]);
  if (!existingTx) {
    const err = new Error('Transaction record not found.');
    err.statusCode = 404;
    err.code = 'TRANSACTION_NOT_FOUND';
    err.isOperational = true;
    throw err;
  }

  const newPartyId = updates.partyId || existingTx.party_id;
  if (newPartyId !== existingTx.party_id) {
    await getPartyById(workspaceId, newPartyId);
  }

  const newType = normalizeType(updates.type || existingTx.type);
  const newAmount = updates.amount !== undefined ? round2(updates.amount) : round2(existingTx.amount);
  if (!(newAmount > 0)) {
    const err = new Error('Transaction amount must be greater than 0.');
    err.statusCode = 400;
    err.code = 'INVALID_AMOUNT';
    err.isOperational = true;
    throw err;
  }

  const newGst = Math.min(
    Math.max(0, round2(updates.gstAmount !== undefined ? updates.gstAmount : existingTx.gst_amount || 0)),
    newAmount
  );
  const newBase = round2(newAmount - newGst);
  const newPaymentMode = updates.paymentMode || existingTx.payment_mode;
  const newCategory = updates.category || existingTx.category;
  const newNotes = updates.notes !== undefined ? updates.notes : existingTx.notes;
  const newDate = updates.date || existingTx.date;

  await run(
    `UPDATE transactions
       SET party_id = ?, type = ?, amount = ?, base_amount = ?, gst_amount = ?,
           payment_mode = ?, category = ?, notes = ?, date = ?,
           version = version + 1, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [newPartyId, newType, newAmount, newBase, newGst, newPaymentMode, newCategory, newNotes, newDate, txId]
  );

  // Reassigning an entry changes two ledgers, so refresh both.
  const updatedPartyBalance = await recalcPartyBalance(workspaceId, newPartyId);
  if (newPartyId !== existingTx.party_id) {
    await recalcPartyBalance(workspaceId, existingTx.party_id);
  }

  const updatedTx = await get('SELECT * FROM transactions WHERE id = ?', [txId]);
  return { transaction: updatedTx, updatedPartyBalance };
}

/**
 * Soft delete. Financial history is never hard-deleted: the row is flagged so
 * it can be restored and still shows up in an audit, and every balance query
 * filters on is_deleted.
 */
async function deleteTransaction(workspaceId, txId) {
  const existingTx = await get('SELECT * FROM transactions WHERE id = ? AND workspace_id = ?', [txId, workspaceId]);
  if (!existingTx) {
    const err = new Error('Transaction record not found.');
    err.statusCode = 404;
    err.code = 'TRANSACTION_NOT_FOUND';
    err.isOperational = true;
    throw err;
  }

  await run(
    `UPDATE transactions SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP, version = version + 1 WHERE id = ? AND workspace_id = ?`,
    [txId, workspaceId]
  );

  const updatedPartyBalance = await recalcPartyBalance(workspaceId, existingTx.party_id);
  return { success: true, deletedTxId: txId, updatedPartyBalance };
}

async function restoreTransaction(workspaceId, txId) {
  const existingTx = await get('SELECT * FROM transactions WHERE id = ? AND workspace_id = ?', [txId, workspaceId]);
  if (!existingTx) {
    const err = new Error('Transaction record not found.');
    err.statusCode = 404;
    err.code = 'TRANSACTION_NOT_FOUND';
    err.isOperational = true;
    throw err;
  }

  await run(
    `UPDATE transactions SET is_deleted = 0, deleted_at = NULL, version = version + 1 WHERE id = ? AND workspace_id = ?`,
    [txId, workspaceId]
  );

  const updatedPartyBalance = await recalcPartyBalance(workspaceId, existingTx.party_id);
  return { success: true, restoredTxId: txId, updatedPartyBalance };
}

async function getTransactions(workspaceId, { partyId, type, category, startDate, endDate, page = 1, limit = 50, includeArchived = false }) {
  let sql = `
    SELECT t.*, p.name as party_name, p.type as party_type
    FROM transactions t
    JOIN parties p ON t.party_id = p.id
    WHERE t.workspace_id = ?
  `;
  const params = [workspaceId];

  if (!includeArchived) {
    sql += ' AND COALESCE(t.is_deleted, 0) = 0';
  }

  if (partyId) {
    sql += ' AND t.party_id = ?';
    params.push(partyId);
  }

  if (type) {
    sql += ' AND t.type = ?';
    params.push(type);
  }

  if (category) {
    sql += ' AND t.category = ?';
    params.push(category);
  }

  if (startDate) {
    sql += ' AND t.date >= ?';
    params.push(startDate);
  }

  if (endDate) {
    sql += ' AND t.date <= ?';
    params.push(endDate);
  }

  sql += ' ORDER BY t.date DESC';

  const offset = (page - 1) * limit;
  const rows = await all(`${sql} LIMIT ? OFFSET ?`, [...params, limit, offset]);

  for (let r of rows) {
    r.attachments = await all('SELECT id, filename, original_name, mime_type, size_bytes, sha256 FROM attachments WHERE transaction_id = ?', [r.id]);
  }

  const countRow = await get(`SELECT COUNT(*) as total FROM (${sql})`, params);

  return {
    transactions: rows,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: countRow ? countRow.total : rows.length,
      totalPages: countRow ? Math.ceil(countRow.total / limit) : 1
    }
  };
}

// Executive Dashboard Summary & Telemetry
async function getExecutiveSummary(workspaceId) {
  const parties = await all(
    'SELECT * FROM parties WHERE workspace_id = ? AND COALESCE(is_deleted, 0) = 0',
    [workspaceId]
  );
  const liveTx = await all(
    'SELECT party_id, type, amount FROM transactions WHERE workspace_id = ? AND COALESCE(is_deleted, 0) = 0',
    [workspaceId]
  );

  // Derive every balance here rather than trusting the stored column, so the
  // dashboard always agrees with the underlying entries.
  const deltaByParty = new Map();
  for (const tx of liveTx) {
    const key = String(tx.party_id);
    deltaByParty.set(key, (deltaByParty.get(key) || 0) + signedDelta(tx.type, tx.amount));
  }

  let totalYouWillGet = 0;
  let totalYouWillGive = 0;

  for (const p of parties) {
    const balance = round2((Number(p.opening_balance) || 0) + (deltaByParty.get(String(p.id)) || 0));
    if (balance > 0) totalYouWillGet += balance;
    else if (balance < 0) totalYouWillGive += Math.abs(balance);
  }

  totalYouWillGet = round2(totalYouWillGet);
  totalYouWillGive = round2(totalYouWillGive);

  const recentTransactions = await all(`
    SELECT t.*, p.name as party_name
    FROM transactions t
    JOIN parties p ON t.party_id = p.id
    WHERE t.workspace_id = ? AND COALESCE(t.is_deleted, 0) = 0
    ORDER BY t.date DESC
    LIMIT 10
  `, [workspaceId]);

  const workspace = await get('SELECT currency FROM workspaces WHERE id = ?', [workspaceId]);

  return {
    summary: {
      totalYouWillGet,
      totalYouWillGive,
      netBalance: round2(totalYouWillGet - totalYouWillGive),
      totalParties: parties.length,
      totalTransactions: liveTx.length,
      currency: (workspace && workspace.currency) || 'INR'
    },
    recentTransactions
  };
}

module.exports = {
  verifyWorkspaceAccess,
  getUserWorkspaces,
  createWorkspace,
  getParties,
  getPartyById,
  createParty,
  updateParty,
  deleteParty,
  restoreParty,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  restoreTransaction,
  getTransactions,
  getExecutiveSummary,
  recalcPartyBalance,
  normalizeType,
  signedDelta,
  round2
};
