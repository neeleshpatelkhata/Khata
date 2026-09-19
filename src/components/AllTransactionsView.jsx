import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useLedgerStore } from '../store/ledgerStore';
import { 
  Receipt, 
  Search, 
  Filter, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Paperclip, 
  Download, 
  PlusCircle, 
  MinusCircle,
  Edit3,
  Trash2,
  Lock
} from 'lucide-react';

export default function AllTransactionsView() {
  const { currentWorkspace, user } = useAuthStore();
  const { transactions, parties, openTransactionModal, openEditTransactionModal, deleteTransaction } = useLedgerStore();

  const [searchFilter, setSearchFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const isStaff = user?.role === 'STAFF';

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(val || 0);
  };

  const handleDelete = async (e, tx) => {
    e.stopPropagation();
    if (isStaff) {
      alert('Permission Denied: Staff accounts cannot delete transaction entries.');
      return;
    }
    if (!window.confirm(`Are you sure you want to archive transaction of ₹${tx.amount}?`)) return;
    try {
      await deleteTransaction(currentWorkspace?.id || 'ws_local_default', tx.id, user?.role);
    } catch (err) {
      alert(err.message || 'Delete failed.');
    }
  };

  const partyNameMap = new Map();
  parties.forEach(p => partyNameMap.set(String(p.id), p.name));

  const activeTransactions = transactions.filter(t => !t.is_deleted);

  const filteredTransactions = activeTransactions.filter(t => {
    if (typeFilter && t.type !== typeFilter) return false;
    if (categoryFilter && t.category !== categoryFilter) return false;
    if (searchFilter) {
      const term = searchFilter.toLowerCase();
      const pName = t.party_name || partyNameMap.get(String(t.party_id)) || '';
      const matchParty = pName.toLowerCase().includes(term);
      const matchNotes = t.notes ? t.notes.toLowerCase().includes(term) : false;
      return matchParty || matchNotes;
    }
    return true;
  });

  return (
    <div style={{ padding: '0 1rem 7rem 1rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* Header & Controls */}
      <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)', margin: 0 }}>
            <Receipt size={22} color="var(--color-cyan)" /> Transaction Ledger & Receipts
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Audit trail of all credit and debit entries across workspace parties. User Tier: <strong>{isStaff ? '👤 Staff (Restricted Writes)' : '👑 Owner (Full Rights)'}</strong>
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.65rem' }}>
          <button onClick={() => openTransactionModal(null, 'GAVE')} className="btn-rose" style={{ fontSize: '0.825rem' }}>
            <MinusCircle size={15} /> You Gave (Debit ₹)
          </button>
          <button onClick={() => openTransactionModal(null, 'GOT')} className="btn-emerald" style={{ fontSize: '0.825rem' }}>
            <PlusCircle size={15} /> You Got (Credit ₹)
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="glass-panel" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
          <input
            type="text"
            placeholder="Filter transactions by party name, notes..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="input-field"
            style={{ paddingLeft: '2.35rem', fontSize: '0.85rem' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="input-field" style={{ padding: '0.45rem 0.75rem', fontSize: '0.825rem' }}>
            <option value="">All Types (Credit & Debit)</option>
            <option value="GAVE">Debit (You Gave)</option>
            <option value="GOT">Credit (You Got)</option>
          </select>

          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="input-field" style={{ padding: '0.45rem 0.75rem', fontSize: '0.825rem' }}>
            <option value="">All Categories</option>
            <option value="General">General</option>
            <option value="Invoice Payment">Invoice Payment</option>
            <option value="Raw Supplies">Raw Supplies</option>
            <option value="Logistics & Fuel">Logistics & Fuel</option>
            <option value="Rent & Utilities">Rent & Utilities</option>
          </select>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="glass-panel" style={{ padding: '1.25rem' }}>
        {filteredTransactions.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {filteredTransactions.map((tx) => {
              const displayName = tx.party_name || partyNameMap.get(String(tx.party_id)) || 'Party Account';
              return (
                <div
                  key={tx.id}
                  className="glass-card"
                  style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', cursor: 'pointer' }}
                  onClick={() => openEditTransactionModal(tx)}
                >
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '12px',
                      background: tx.type === 'GOT' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {tx.type === 'GOT' ? <ArrowDownLeft size={22} color="var(--color-emerald)" /> : <ArrowUpRight size={22} color="var(--color-rose)" />}
                    </div>

                    <div>
                      <div style={{ fontSize: '0.95rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.65rem', color: 'var(--text-main)' }}>
                        {displayName}
                        <span className="badge badge-cyan" style={{ fontSize: '0.65rem' }}>{tx.category || 'General'}</span>
                        <span className="badge badge-purple" style={{ fontSize: '0.65rem' }}>{tx.payment_mode || 'CASH'}</span>
                        {tx.gst_amount > 0 && <span className="badge badge-amber" style={{ fontSize: '0.65rem' }}>GST ₹{tx.gst_amount}</span>}
                      </div>

                      <div style={{ fontSize: '0.775rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
                        {tx.notes || 'No description notes'} • {new Date(tx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} • Recorded by {tx.created_by_name || 'System User'}
                      </div>

                      {tx.attachments && tx.attachments.length > 0 && (
                        <div style={{ marginTop: '0.35rem' }}>
                          {tx.attachments.map(att => (
                            <a
                              key={att.id}
                              href={`/api/v1/attachments/${att.id}/download`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                fontSize: '0.75rem',
                                color: 'var(--color-cyan)',
                                textDecoration: 'none',
                                background: 'rgba(6, 182, 212, 0.1)',
                                padding: '0.2rem 0.5rem',
                                borderRadius: '4px',
                                border: '1px solid rgba(6, 182, 212, 0.2)'
                              }}
                            >
                              <Paperclip size={12} /> {att.original_name} <Download size={10} />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div className="font-mono" style={{
                        fontSize: '1.25rem',
                        fontWeight: '800',
                        color: tx.type === 'GOT' ? 'var(--color-emerald)' : 'var(--color-rose)'
                      }}>
                        {tx.type === 'GOT' ? `+${formatCurrency(tx.amount)}` : `-${formatCurrency(tx.amount)}`}
                      </div>
                      <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                        {tx.type === 'GOT' ? 'CREDIT RECEIVED' : 'DEBIT EXTENDED'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditTransactionModal(tx);
                        }}
                        className="btn-secondary"
                        style={{ padding: '0.5rem', borderRadius: '10px', minHeight: '44px', minWidth: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Edit Entry"
                      >
                        <Edit3 size={16} color="var(--color-purple)" />
                      </button>
                      {!isStaff ? (
                        <button
                          onClick={(e) => handleDelete(e, tx)}
                          className="btn-secondary"
                          style={{ padding: '0.5rem', borderRadius: '10px', minHeight: '44px', minWidth: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-rose)' }}
                          title="Delete Entry"
                        >
                          <Trash2 size={16} />
                        </button>
                      ) : (
                        <div title="Staff cannot delete transactions" style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', color: 'var(--text-dim)' }}>
                          <Lock size={16} />
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '4rem 0' }}>
            No active transactions match the selected search & filter options.
          </div>
        )}
      </div>

    </div>
  );
}
