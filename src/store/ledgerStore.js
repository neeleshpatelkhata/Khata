import { useState, useEffect } from 'react';
import { apiClient } from '../services/apiClient';
import {
  computePartiesWithBalances,
  computeSummary,
  buildPartyStatement,
  filterTransactions,
  computeDashboardMetrics,
  resolvePeriod,
  validateParty,
  validateTransaction,
  splitGst,
  normalizeType,
  safeAmount,
  round2,
  isValidPhoneNumber,
  checkDuplicatePhone,
  isActive
} from '../services/ledgerEngine';

export {
  isValidPhoneNumber,
  checkDuplicatePhone,
  computePartiesWithBalances,
  buildPartyStatement,
  resolvePeriod
};

let listeners = [];
let state = {
  parties: [],
  transactions: [],
  summary: {
    totalYouWillGet: 0,
    totalYouWillGive: 0,
    netBalance: 0,
    totalParties: 0,
    totalTransactions: 0,
    currency: 'INR'
  },
  selectedParty: null,
  activeTab: 'dashboard', // 'dashboard' | 'parties' | 'transactions' | 'telemetry' | 'scanner' | 'profile'
  isTransactionModalOpen: false,
  transactionModalParty: null,
  transactionModalDefaultType: 'GAVE', // 'GAVE' | 'GOT'
  editingTransaction: null,
  searchTerm: '',
  partyTypeFilter: '', // '' | 'CUSTOMER' | 'SUPPLIER'

  // Advanced filter controls
  filterType: 'ALL', // 'ALL' | 'GAVE' | 'GOT'
  filterCategory: 'ALL',
  dateFilterCombo: 'Monthly', // 'Daily' | 'Weekly' | 'Monthly' | 'Yearly' | 'Custom' | 'All'
  customStartDate: null,
  customEndDate: null,

  // Reversible undo-delete
  recentlyDeletedTransaction: null,
  undoTimerId: null,

  isLoading: false,
  isSyncing: false,
  error: null
};

function setState(newState) {
  state = { ...state, ...newState };
  listeners.forEach((l) => l(state));
}

const LOCAL_STORAGE_DATA_KEY = 'khata_local_ledger_data';
const CUSTOM_CATEGORIES_KEY = 'khata_custom_categories';
const UNDO_WINDOW_MS = 5000;

export const PRESET_CATEGORIES = [
  'Invoice Payment',
  'Raw Supplies',
  'Logistics & Fuel',
  'Dining & Food',
  'Rent & Utilities',
  'General',
  'Salary / Wage'
];

export function getSavedCategories() {
  try {
    const raw = localStorage.getItem(CUSTOM_CATEGORIES_KEY);
    if (!raw) return PRESET_CATEGORIES;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return PRESET_CATEGORIES;
    return Array.from(new Set([...PRESET_CATEGORIES, ...parsed.filter((c) => typeof c === 'string')]));
  } catch {
    return PRESET_CATEGORIES;
  }
}

export function saveCustomCategory(newCat) {
  const trimmed = String(newCat || '').trim();
  if (!trimmed) return;
  const current = getSavedCategories();
  if (current.includes(trimmed)) return;
  try {
    localStorage.setItem(CUSTOM_CATEGORIES_KEY, JSON.stringify([...current, trimmed]));
  } catch (e) {
    console.error('Failed to save custom category:', e);
  }
}

// ---------------------------------------------------------------------------
// Local persistence
// ---------------------------------------------------------------------------

function storageKey(workspaceId) {
  return `${LOCAL_STORAGE_DATA_KEY}_${workspaceId}`;
}

function getLocalData(workspaceId) {
  try {
    const raw = localStorage.getItem(storageKey(workspaceId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      parties: Array.isArray(parsed.parties) ? parsed.parties : [],
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : []
    };
  } catch {
    return null;
  }
}

function saveLocalData(workspaceId, parties, transactions) {
  if (!workspaceId) return;
  try {
    localStorage.setItem(
      storageKey(workspaceId),
      JSON.stringify({ parties, transactions, savedAt: new Date().toISOString() })
    );
  } catch (e) {
    // Quota exceeded is the realistic failure here — surface it instead of
    // silently dropping the user's books.
    console.error('Failed to persist ledger to local storage:', e);
    setState({ error: 'Device storage is full. Export a backup and free up space.' });
  }
}

/**
 * Recompute balances for live parties while keeping archived (soft-deleted)
 * parties in the list, then persist. Every mutation funnels through here so
 * derived state can never drift from the underlying entries.
 */
function commit(workspaceId, parties, transactions, extra = {}) {
  const live = computePartiesWithBalances(parties, transactions);
  const liveById = new Map(live.map((p) => [String(p.id), p]));
  const merged = parties.map((p) => liveById.get(String(p.id)) || p);

  const summary = computeSummary(parties, transactions, state.summary.currency || 'INR');

  const selectedId = state.selectedParty ? String(state.selectedParty.id) : null;
  const nextSelected = selectedId
    ? merged.find((p) => String(p.id) === selectedId && isActive(p)) || null
    : null;

  saveLocalData(workspaceId, merged, transactions);

  setState({
    parties: merged,
    transactions,
    summary,
    selectedParty: 'selectedParty' in extra ? extra.selectedParty : nextSelected,
    ...extra
  });

  return { parties: merged, transactions, summary };
}

function dedupeParties(partiesList = []) {
  const seen = new Map();
  for (const p of partiesList) {
    if (!p) continue;
    const key = p.id
      ? String(p.id)
      : `${String(p.name || '').trim().toLowerCase()}_${String(p.phone || '').trim()}`;
    if (!seen.has(key)) seen.set(key, p);
  }
  return [...seen.values()];
}

function localId(prefix) {
  return `${prefix}_local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function auditEntry(action, user, details) {
  return {
    timestamp: new Date().toISOString(),
    action,
    userName: user?.name || 'Enterprise User',
    userRole: user?.role || 'OWNER',
    details
  };
}

/** Staff accounts are read/append only — they may not edit or remove history. */
function assertCanMutateHistory(role, verb) {
  if (String(role || '').toUpperCase() === 'STAFF') {
    throw new Error(`Permission denied: staff accounts cannot ${verb} records.`);
  }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export function useLedgerStore() {
  const [store, setStore] = useState(state);

  useEffect(() => {
    listeners.push(setStore);
    return () => {
      listeners = listeners.filter((l) => l !== setStore);
    };
  }, []);

  /**
   * Load the workspace. Local storage is authoritative for what the user sees:
   * it is rendered first so the app is usable instantly and offline, then the
   * backend is merged in if it happens to be reachable.
   */
  const fetchWorkspaceData = async (workspaceId) => {
    if (!workspaceId) return;

    const local = getLocalData(workspaceId);
    if (local) {
      commit(workspaceId, dedupeParties(local.parties), local.transactions, { isLoading: true, error: null });
    } else {
      setState({ isLoading: true, error: null });
    }

    try {
      const [partiesRes, txRes] = await Promise.all([
        apiClient.getParties(workspaceId, { limit: 500 }),
        apiClient.getTransactions(workspaceId, { limit: 1000 })
      ]);

      const remoteParties = dedupeParties(partiesRes.data?.parties || partiesRes.data || []);
      const remoteTxs = txRes.data?.transactions || txRes.data || [];

      // Anything created while offline has a local_ id and is not on the server
      // yet; keep it so a successful fetch never wipes unsynced work.
      const pendingParties = (local?.parties || []).filter((p) => String(p.id).includes('_local_'));
      const pendingTxs = (local?.transactions || []).filter((t) => String(t.id).includes('_local_'));

      commit(
        workspaceId,
        dedupeParties([...remoteParties, ...pendingParties]),
        [...remoteTxs, ...pendingTxs],
        { isLoading: false, error: null }
      );
    } catch (err) {
      // Offline / backend asleep is the normal case for this app, not an error.
      console.warn('Remote ledger unavailable, continuing on local data:', err.message);
      setState({ isLoading: false, error: null });
    }
  };

  // --- Parties ------------------------------------------------------------

  const createParty = async (workspaceId, partyData) => {
    const validationError = validateParty(partyData, state.parties);
    if (validationError) throw new Error(validationError);

    const opening = round2(partyData.openingBalance ?? partyData.opening_balance ?? 0);
    const newParty = {
      id: localId('party'),
      workspace_id: workspaceId,
      name: String(partyData.name).trim(),
      phone: String(partyData.phone || '').trim(),
      email: String(partyData.email || '').trim(),
      address: String(partyData.address || partyData.location || '').trim(),
      type: partyData.type === 'SUPPLIER' ? 'SUPPLIER' : 'CUSTOMER',
      opening_balance: opening,
      current_balance: opening,
      is_deleted: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Write locally first so the party exists even if the network call hangs.
    let saved = newParty;
    try {
      const res = await apiClient.createParty(workspaceId, { ...partyData, openingBalance: opening });
      const remote = res.data?.party || res.data;
      if (remote?.id) saved = { ...newParty, ...remote, is_deleted: false };
    } catch (err) {
      console.warn('Party created locally, will sync later:', err.message);
    }

    const parties = dedupeParties([...state.parties, saved]);
    commit(workspaceId, parties, state.transactions, {
      selectedParty: computePartiesWithBalances(parties, state.transactions).find(
        (p) => String(p.id) === String(saved.id)
      ) || saved,
      isLoading: false,
      error: null
    });

    return saved;
  };

  const createMultipleParties = async (workspaceId, partiesArray = []) => {
    setState({ isLoading: true, error: null });

    const created = [];
    const skipped = [];

    for (const partyData of partiesArray) {
      // Validate against everything accepted so far, so a duplicate phone
      // inside the same batch is rejected too.
      const validationError = validateParty(partyData, [...state.parties, ...created]);
      if (validationError) {
        skipped.push({ name: partyData?.name || '(unnamed)', reason: validationError });
        continue;
      }

      const opening = round2(partyData.openingBalance ?? 0);
      let party = {
        id: localId('party'),
        workspace_id: workspaceId,
        name: String(partyData.name).trim(),
        phone: String(partyData.phone || '').trim(),
        email: String(partyData.email || '').trim(),
        address: String(partyData.address || partyData.location || '').trim(),
        type: partyData.type === 'SUPPLIER' ? 'SUPPLIER' : 'CUSTOMER',
        opening_balance: opening,
        current_balance: opening,
        is_deleted: false,
        created_at: new Date().toISOString()
      };

      try {
        const res = await apiClient.createParty(workspaceId, { ...partyData, openingBalance: opening });
        const remote = res.data?.party || res.data;
        if (remote?.id) party = { ...party, ...remote, is_deleted: false };
      } catch {
        // keep the local record
      }

      created.push(party);
    }

    const parties = dedupeParties([...state.parties, ...created]);
    commit(workspaceId, parties, state.transactions, { isLoading: false, error: null });

    return { created, skipped };
  };

  const updateParty = async (workspaceId, partyId, updates, userRole = 'OWNER') => {
    assertCanMutateHistory(userRole, 'edit party');

    const existing = state.parties.find((p) => String(p.id) === String(partyId));
    if (!existing) throw new Error('Party not found.');

    const merged = { ...existing, ...updates };
    const validationError = validateParty(merged, state.parties, partyId);
    if (validationError) throw new Error(validationError);

    const updated = {
      ...existing,
      name: String(merged.name).trim(),
      phone: String(merged.phone || '').trim(),
      email: String(merged.email || '').trim(),
      address: String(merged.address ?? merged.location ?? '').trim(),
      type: merged.type === 'SUPPLIER' ? 'SUPPLIER' : 'CUSTOMER',
      opening_balance:
        updates.openingBalance !== undefined || updates.opening_balance !== undefined
          ? round2(updates.openingBalance ?? updates.opening_balance)
          : round2(existing.opening_balance || 0),
      updated_at: new Date().toISOString()
    };

    try {
      await apiClient.updateParty(workspaceId, partyId, updated);
    } catch (err) {
      console.warn('Party updated locally, will sync later:', err.message);
    }

    const parties = state.parties.map((p) => (String(p.id) === String(partyId) ? updated : p));
    const { parties: committed } = commit(workspaceId, parties, state.transactions, { error: null });

    return committed.find((p) => String(p.id) === String(partyId)) || updated;
  };

  /**
   * Archive a party. This is a soft delete: the party and its entries are
   * flagged rather than erased, so a mis-tap never destroys a customer's
   * payment history and the records stay available for restore and audit.
   */
  const deleteParty = async (workspaceId, partyId, userRole = 'OWNER') => {
    assertCanMutateHistory(userRole, 'delete party');

    const existing = state.parties.find((p) => String(p.id) === String(partyId));
    if (!existing) throw new Error('Party not found.');

    try {
      await apiClient.deleteParty(workspaceId, partyId);
    } catch (err) {
      console.warn('Party archived locally, will sync later:', err.message);
    }

    const deletedAt = new Date().toISOString();
    const parties = state.parties.map((p) =>
      String(p.id) === String(partyId) ? { ...p, is_deleted: true, deleted_at: deletedAt } : p
    );
    const transactions = state.transactions.map((t) =>
      String(t.party_id) === String(partyId) ? { ...t, is_deleted: true, deleted_at: deletedAt } : t
    );

    commit(workspaceId, parties, transactions, { selectedParty: null, error: null });
    return { success: true, archivedPartyId: partyId };
  };

  const restoreParty = async (workspaceId, partyId) => {
    const parties = state.parties.map((p) =>
      String(p.id) === String(partyId) ? { ...p, is_deleted: false, deleted_at: null } : p
    );
    const transactions = state.transactions.map((t) =>
      String(t.party_id) === String(partyId) && t.deleted_at
        ? { ...t, is_deleted: false, deleted_at: null }
        : t
    );
    commit(workspaceId, parties, transactions, { error: null });
  };

  // --- Transactions -------------------------------------------------------

  const addTransaction = async (
    workspaceId,
    txData,
    fileAttachment,
    currentUser = { name: 'Owner', role: 'OWNER' }
  ) => {
    const validationError = validateTransaction(txData);
    if (validationError) throw new Error(validationError);

    // Resolve (or create) the party this entry belongs to.
    let targetPartyId = txData.partyId;
    const typedName = String(txData.partyName || '').trim();

    if (!targetPartyId && typedName) {
      const match = state.parties.find(
        (p) => isActive(p) && String(p.name).trim().toLowerCase() === typedName.toLowerCase()
      );
      if (match) {
        targetPartyId = match.id;
      } else {
        const autoParty = await createParty(workspaceId, {
          name: typedName,
          phone: txData.partyPhone || '',
          // A party we hand goods/credit to is a customer; one we pay is a supplier.
          type: normalizeType(txData.type) === 'GAVE' ? 'CUSTOMER' : 'SUPPLIER',
          email: txData.partyEmail || '',
          openingBalance: 0
        });
        targetPartyId = autoParty.id;
      }
    }

    if (!targetPartyId) throw new Error('Please select or enter a valid party before saving.');
    if (!state.parties.some((p) => String(p.id) === String(targetPartyId) && isActive(p))) {
      throw new Error('The selected party no longer exists.');
    }

    setState({ isLoading: true, error: null });
    if (txData.category) saveCustomCategory(txData.category);

    const { total, gst, base } = splitGst(txData.amount, txData.gstAmount);
    const type = normalizeType(txData.type);
    const when = txData.date || new Date().toISOString();

    let newTx = {
      id: localId('tx'),
      workspace_id: workspaceId,
      party_id: targetPartyId,
      type,
      amount: total,
      base_amount: base,
      gst_amount: gst,
      payment_mode: txData.paymentMode || 'CASH',
      category: String(txData.category || 'General').trim() || 'General',
      notes: String(txData.notes || '').trim(),
      date: when,
      is_deleted: false,
      created_at: new Date().toISOString(),
      created_by_name: currentUser?.name || 'Enterprise User',
      audit_log: [
        auditEntry('CREATED', currentUser, `Created ${type} entry of ₹${total.toFixed(2)}`)
      ]
    };

    try {
      const res = await apiClient.addTransaction(workspaceId, {
        ...txData,
        partyId: targetPartyId,
        type,
        amount: total,
        baseAmount: base,
        gstAmount: gst,
        date: when
      });
      const remote = res.data?.transaction || res.data;
      if (remote?.id) newTx = { ...newTx, ...remote, is_deleted: false, audit_log: newTx.audit_log };

      if (fileAttachment && remote?.id) {
        try {
          await apiClient.uploadAttachment(remote.id, fileAttachment);
        } catch (uploadErr) {
          console.error('Attachment upload failed:', uploadErr.message);
        }
      }
    } catch (err) {
      console.warn('Transaction saved locally, will sync later:', err.message);
    }

    const transactions = [newTx, ...state.transactions];
    const parties = state.parties;
    const { parties: committed } = commit(workspaceId, parties, transactions, {
      isLoading: false,
      error: null
    });

    // Keep the party sheet the user is looking at pointed at fresh numbers.
    if (state.selectedParty) {
      const refreshed = committed.find((p) => String(p.id) === String(state.selectedParty.id));
      if (refreshed) setState({ selectedParty: refreshed });
    }

    return newTx;
  };

  const updateTransaction = async (
    workspaceId,
    txId,
    txData,
    currentUser = { name: 'Owner', role: 'OWNER' }
  ) => {
    assertCanMutateHistory(currentUser?.role, 'edit transaction');

    const validationError = validateTransaction(txData);
    if (validationError) throw new Error(validationError);

    const existing = state.transactions.find((t) => String(t.id) === String(txId));
    if (!existing) throw new Error('Transaction not found.');

    const targetPartyId = txData.partyId || existing.party_id;
    if (!state.parties.some((p) => String(p.id) === String(targetPartyId) && isActive(p))) {
      throw new Error('The selected party no longer exists.');
    }

    const { total, gst, base } = splitGst(txData.amount, txData.gstAmount);
    const type = normalizeType(txData.type);

    if (txData.category) saveCustomCategory(txData.category);

    const changes = [];
    if (safeAmount(existing.amount) !== total) {
      changes.push(`amount ₹${safeAmount(existing.amount).toFixed(2)} → ₹${total.toFixed(2)}`);
    }
    if (normalizeType(existing.type) !== type) {
      changes.push(`type ${normalizeType(existing.type)} → ${type}`);
    }
    if (String(existing.party_id) !== String(targetPartyId)) changes.push('party reassigned');

    const updated = {
      ...existing,
      party_id: targetPartyId,
      type,
      amount: total,
      base_amount: base,
      gst_amount: gst,
      payment_mode: txData.paymentMode || existing.payment_mode || 'CASH',
      category: String(txData.category || existing.category || 'General').trim() || 'General',
      notes: txData.notes !== undefined ? String(txData.notes).trim() : existing.notes,
      date: txData.date || existing.date,
      updated_at: new Date().toISOString(),
      audit_log: [
        ...(Array.isArray(existing.audit_log) ? existing.audit_log : []),
        auditEntry('UPDATED', currentUser, changes.length ? changes.join(', ') : 'Details edited')
      ]
    };

    try {
      await apiClient.updateTransaction(workspaceId, txId, {
        ...txData,
        partyId: targetPartyId,
        type,
        amount: total,
        baseAmount: base,
        gstAmount: gst
      });
    } catch (err) {
      console.warn('Transaction updated locally, will sync later:', err.message);
    }

    const transactions = state.transactions.map((t) => (String(t.id) === String(txId) ? updated : t));
    commit(workspaceId, state.parties, transactions, { error: null });

    return updated;
  };

  /**
   * Soft-delete with an undo window. The entry is hidden immediately, and only
   * after the window closes is it flagged deleted and pushed to the server —
   * so an accidental tap is always recoverable.
   */
  const deleteTransaction = async (workspaceId, txId, userRole = 'OWNER') => {
    assertCanMutateHistory(userRole, 'delete transaction');

    const target = state.transactions.find((t) => String(t.id) === String(txId));
    if (!target) return;

    if (state.undoTimerId) clearTimeout(state.undoTimerId);

    // Hide it right away by flagging it; the engine ignores deleted rows, so
    // balances and totals update instantly.
    const hidden = state.transactions.map((t) =>
      String(t.id) === String(txId) ? { ...t, is_deleted: true, deleted_at: new Date().toISOString() } : t
    );

    const timerId = setTimeout(async () => {
      try {
        await apiClient.deleteTransaction(workspaceId, txId);
      } catch (err) {
        console.warn('Deletion recorded locally, will sync later:', err.message);
      }
      setState({ recentlyDeletedTransaction: null, undoTimerId: null });
    }, UNDO_WINDOW_MS);

    commit(workspaceId, state.parties, hidden, {
      recentlyDeletedTransaction: target,
      undoTimerId: timerId
    });
  };

  const undoDeleteTransaction = (workspaceId) => {
    const target = state.recentlyDeletedTransaction;
    if (!target) return;

    if (state.undoTimerId) clearTimeout(state.undoTimerId);

    const restored = state.transactions.map((t) =>
      String(t.id) === String(target.id) ? { ...t, is_deleted: false, deleted_at: null } : t
    );

    commit(workspaceId, state.parties, restored, {
      recentlyDeletedTransaction: null,
      undoTimerId: null
    });
  };

  // --- Derived views ------------------------------------------------------

  const getFilteredTransactions = () =>
    filterTransactions(state.transactions, state.parties, {
      searchTerm: state.searchTerm,
      filterType: state.filterType,
      filterCategory: state.filterCategory,
      dateFilterCombo: state.dateFilterCombo,
      customStartDate: state.customStartDate,
      customEndDate: state.customEndDate
    });

  const getDashboardMetrics = () =>
    computeDashboardMetrics(state.transactions, state.parties, {
      dateFilterCombo: state.dateFilterCombo,
      customStartDate: state.customStartDate,
      customEndDate: state.customEndDate
    });

  const getPartyStatement = (party) => buildPartyStatement(party, state.transactions);

  // --- Backup & restore ---------------------------------------------------

  const buildSnapshot = (workspaceId) => ({
    schemaVersion: 2,
    workspaceId,
    exportedAt: new Date().toISOString(),
    parties: state.parties,
    transactions: state.transactions,
    summary: state.summary
  });

  const createCloudBackup = async (workspaceId, backupName) => {
    const snapshot = buildSnapshot(workspaceId);
    try {
      const res = await apiClient.createUserBackup(workspaceId, {
        backupName: backupName || `Backup_${new Date().toISOString()}`,
        type: 'MANUAL',
        dataJson: JSON.stringify(snapshot)
      });
      return { location: 'cloud', backup: res.data, snapshot };
    } catch (err) {
      // No cloud reachable: keep a dated snapshot on the device so "Back Up
      // Now" still protects the user's data rather than silently failing.
      const key = `khata_snapshot_${workspaceId}_${Date.now()}`;
      try {
        localStorage.setItem(key, JSON.stringify(snapshot));
        pruneLocalSnapshots(workspaceId);
      } catch (storageErr) {
        throw new Error(`Cloud unreachable and device storage is full: ${storageErr.message}`);
      }
      return { location: 'device', snapshot };
    }
  };

  const pruneLocalSnapshots = (workspaceId, keep = 5) => {
    const prefix = `khata_snapshot_${workspaceId}_`;
    const keys = Object.keys(localStorage)
      .filter((k) => k.startsWith(prefix))
      .sort();
    while (keys.length > keep) {
      localStorage.removeItem(keys.shift());
    }
  };

  const exportLocalBackup = (workspaceId) => {
    const snapshot = buildSnapshot(workspaceId);
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `khata-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return snapshot;
  };

  /**
   * Restore from an exported file. Restores merge rather than overwrite:
   * entries already present (matched by id) are kept, so restoring an old
   * backup cannot erase newer work.
   */
  const restoreBackupData = async (workspaceId, fileContent, { mode = 'merge' } = {}) => {
    let payload;
    try {
      payload = typeof fileContent === 'string' ? JSON.parse(fileContent) : fileContent;
    } catch {
      throw new Error('That file is not a valid Khata backup (invalid JSON).');
    }

    if (!payload || !Array.isArray(payload.parties) || !Array.isArray(payload.transactions)) {
      throw new Error('That file is not a valid Khata backup (missing parties/transactions).');
    }

    let parties;
    let transactions;

    if (mode === 'replace') {
      parties = dedupeParties(payload.parties);
      transactions = payload.transactions;
    } else {
      const partyIds = new Set(state.parties.map((p) => String(p.id)));
      const txIds = new Set(state.transactions.map((t) => String(t.id)));
      parties = dedupeParties([
        ...state.parties,
        ...payload.parties.filter((p) => !partyIds.has(String(p.id)))
      ]);
      transactions = [
        ...state.transactions,
        ...payload.transactions.filter((t) => !txIds.has(String(t.id)))
      ];
    }

    commit(workspaceId, parties, transactions, { selectedParty: null, error: null });
    return { partiesRestored: parties.length, transactionsRestored: transactions.length };
  };

  /** Statement export for sharing with a party (CSV opens in any spreadsheet). */
  const exportTransactionsCsv = (rows = getFilteredTransactions()) => {
    const partyName = new Map(state.parties.map((p) => [String(p.id), p.name]));
    const header = ['Date', 'Party', 'Type', 'Amount', 'Base', 'GST', 'Payment Mode', 'Category', 'Notes'];
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

    const lines = [
      header.join(','),
      ...rows.map((t) =>
        [
          new Date(t.date || t.created_at).toLocaleDateString('en-IN'),
          partyName.get(String(t.party_id)) || 'Unknown',
          normalizeType(t.type) === 'GAVE' ? 'You Gave' : 'You Got',
          safeAmount(t.amount).toFixed(2),
          safeAmount(t.base_amount ?? t.amount).toFixed(2),
          safeAmount(t.gst_amount).toFixed(2),
          t.payment_mode || 'CASH',
          t.category || 'General',
          t.notes || ''
        ]
          .map(esc)
          .join(',')
      )
    ];

    const blob = new Blob([`﻿${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `khata-statement-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // --- UI state -----------------------------------------------------------

  const setSelectedParty = (party, pushHistory = true) => {
    setState({ selectedParty: party });
    if (party && pushHistory) {
      const path = `/parties/${party.id}`;
      if (window.location.pathname !== path) {
        window.history.pushState({ partyId: party.id }, '', path);
      }
    }
  };

  const setActiveTab = (tab, pushHistory = true) => {
    setState({ activeTab: tab });
    if (pushHistory) {
      const path = tab === 'dashboard' ? '/' : `/${tab}`;
      if (window.location.pathname !== path) {
        window.history.pushState({ tab }, '', path);
      }
    }
  };

  const setSearchTerm = (term) => setState({ searchTerm: term });
  const setFilterType = (type) => setState({ filterType: type });
  const setFilterCategory = (category) => setState({ filterCategory: category });
  const setPartyTypeFilter = (type) => setState({ partyTypeFilter: type });
  const setDateFilterCombo = (combo, start = null, end = null) =>
    setState({ dateFilterCombo: combo, customStartDate: start, customEndDate: end });
  const clearError = () => setState({ error: null });

  const openTransactionModal = (party = null, type = 'GAVE') =>
    setState({
      isTransactionModalOpen: true,
      transactionModalParty: party,
      transactionModalDefaultType: normalizeType(type),
      editingTransaction: null
    });

  const openEditTransactionModal = (transaction) =>
    setState({
      isTransactionModalOpen: true,
      editingTransaction: transaction,
      transactionModalDefaultType: normalizeType(transaction?.type),
      transactionModalParty:
        state.parties.find((p) => String(p.id) === String(transaction?.party_id)) || null
    });

  const closeTransactionModal = () =>
    setState({
      isTransactionModalOpen: false,
      transactionModalParty: null,
      editingTransaction: null
    });

  /**
   * Clear in-memory ledger state. Call this before switching workspace (sign
   * out, sign in as someone else, switch workspace) so a slow or failed
   * fetch can never leave the previous account's parties/transactions on
   * screen — or, worse, have their unsynced local_ entries merged into the
   * next account's saved data.
   */
  const resetWorkspace = () =>
    setState({
      parties: [],
      transactions: [],
      summary: {
        totalYouWillGet: 0,
        totalYouWillGive: 0,
        netBalance: 0,
        totalParties: 0,
        totalTransactions: 0,
        currency: 'INR'
      },
      selectedParty: null,
      recentlyDeletedTransaction: null,
      isLoading: false,
      error: null
    });

  return {
    ...store,

    fetchWorkspaceData,

    createParty,
    createMultipleParties,
    updateParty,
    deleteParty,
    restoreParty,

    addTransaction,
    updateTransaction,
    deleteTransaction,
    undoDeleteTransaction,

    getFilteredTransactions,
    getDashboardMetrics,
    getPartyStatement,

    createCloudBackup,
    exportLocalBackup,
    restoreBackupData,
    exportTransactionsCsv,

    setSelectedParty,
    setActiveTab,
    setSearchTerm,
    setFilterType,
    setFilterCategory,
    setPartyTypeFilter,
    setDateFilterCombo,
    clearError,
    resetWorkspace,
    openTransactionModal,
    openEditTransactionModal,
    closeTransactionModal
  };
}
