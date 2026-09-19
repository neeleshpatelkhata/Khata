import React, { useState } from 'react';
import { useLedgerStore } from '../store/ledgerStore';
import { Search, X, Users, Receipt, ArrowRight, CornerDownLeft } from 'lucide-react';

export default function GlobalSearchModal({ isOpen, onClose }) {
  const { parties, transactions, setSelectedParty, setActiveTab } = useLedgerStore();
  const [query, setQuery] = useState('');

  if (!isOpen) return null;

  const filteredParties = query.trim() ? parties.filter(p => 
    p.name.toLowerCase().includes(query.toLowerCase()) ||
    (p.phone && p.phone.includes(query)) ||
    (p.email && p.email.toLowerCase().includes(query.toLowerCase()))
  ) : [];

  const filteredTransactions = query.trim() ? transactions.filter(t =>
    (t.notes && t.notes.toLowerCase().includes(query.toLowerCase())) ||
    (t.category && t.category.toLowerCase().includes(query.toLowerCase())) ||
    t.amount.toString().includes(query)
  ) : [];

  const handleSelectParty = (party) => {
    setSelectedParty(party);
    setActiveTab('parties');
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(9, 13, 22, 0.85)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      zIndex: 2000,
      padding: '4rem 1rem 1rem 1rem'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '560px',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 40px rgba(0,0,0,0.8), 0 0 30px rgba(99, 102, 241, 0.25)',
        borderRadius: '24px',
        overflow: 'hidden'
      }}>
        {/* Search Header */}
        <div style={{
          padding: '1.25rem',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <Search size={20} color="var(--color-purple)" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search parties, phone numbers, transactions, or amounts..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: 'var(--text-main)',
              fontSize: '1rem',
              outline: 'none',
              fontWeight: '600'
            }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <X size={16} />
            </button>
          )}
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}>
            Esc
          </button>
        </div>

        {/* Results */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {!query.trim() ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
              Type a party name, phone number, category, or amount to search...
            </div>
          ) : (
            <>
              {/* Parties Results */}
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Users size={14} /> Parties ({filteredParties.length})
                </div>

                {filteredParties.length === 0 ? (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontStyle: 'italic', padding: '0.5rem 0' }}>No matching parties found</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {filteredParties.map(p => (
                      <div
                        key={p.id}
                        onClick={() => handleSelectParty(p)}
                        style={{
                          padding: '0.75rem 1rem',
                          borderRadius: '12px',
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>{p.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.phone || p.email || p.type}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span className="font-mono" style={{ fontWeight: '700', fontSize: '0.85rem', color: p.current_balance > 0 ? 'var(--color-emerald)' : 'var(--color-rose)' }}>
                            ₹{Math.abs(p.current_balance || 0).toLocaleString()}
                          </span>
                          <ArrowRight size={14} color="var(--color-purple)" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Transactions Results */}
              <div style={{ marginTop: '0.5rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Receipt size={14} /> Transactions ({filteredTransactions.length})
                </div>

                {filteredTransactions.length === 0 ? (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontStyle: 'italic', padding: '0.5rem 0' }}>No matching transactions found</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {filteredTransactions.map(t => (
                      <div
                        key={t.id}
                        onClick={() => {
                          setActiveTab('transactions');
                          onClose();
                        }}
                        style={{
                          padding: '0.75rem 1rem',
                          borderRadius: '12px',
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: '700', fontSize: '0.85rem' }}>{t.notes || t.category}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.payment_mode} • {new Date(t.date).toLocaleDateString()}</div>
                        </div>
                        <div className="font-mono" style={{
                          fontWeight: '800',
                          fontSize: '0.9rem',
                          color: t.type === 'GOT' ? 'var(--color-emerald)' : 'var(--color-rose)'
                        }}>
                          {t.type === 'GOT' ? '+' : '-'}₹{t.amount.toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
