import React from 'react';
import { useAuthStore } from '../store/authStore';
import { useLedgerStore } from '../store/ledgerStore';
import { usePreferencesStore } from '../store/preferencesStore';
import {
  Users,
  UploadCloud,
  Mic,
  ChevronRight,
  ArrowDownLeft,
  ArrowUpRight,
  Undo2,
  PieChart
} from 'lucide-react';

export default function ExecutiveDashboard({ onOpenSmartEntry, onNavigateTab }) {
  const { user } = useAuthStore();
  const {
    transactions,
    recentlyDeletedTransaction,
    undoDeleteTransaction,
    getDashboardMetrics,
    dateFilterCombo,
    setDateFilterCombo
  } = useLedgerStore();
  const { lang, setLang, t } = usePreferencesStore();

  const metrics = getDashboardMetrics();
  const { currentWorkspace } = useAuthStore();

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(val || 0);
  };

  const getAmountInteger = (val) => {
    const formatted = formatCurrency(val);
    return formatted.split('.')[0];
  };

  const getAmountDecimal = (val) => {
    const formatted = formatCurrency(val);
    const parts = formatted.split('.');
    return parts[1] ? `.${parts[1]}` : '.00';
  };

  // Cash-flow totals for the selected date range: GOT (IN) is money received,
  // GAVE (OUT) is money paid out. `summary` (party debt balances) is a
  // different, all-time metric used on the Parties pages and must not be
  // mixed in here — that mismatch was the source of the inverted numbers.
  const netPosition = metrics.netPosition || 0;
  const isNetGet = netPosition > 0;
  const isNetGive = netPosition < 0;

  return (
    <div style={{ padding: '1.1rem 1rem 2rem 1rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* 3-Second Reversible Undo Delete Toast Bar (Directive 1.3) */}
      {recentlyDeletedTransaction && (
        <div style={{
          position: 'fixed',
          bottom: '100px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 2000,
          background: 'linear-gradient(135deg, #1E1B4B, #312E81)',
          border: '1.5px solid var(--color-purple)',
          color: '#FFF',
          padding: '0.85rem 1.4rem',
          borderRadius: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
          width: 'calc(100% - 2rem)',
          maxWidth: '460px'
        }}>
          <div style={{ flex: 1, fontSize: '0.85rem', fontWeight: '600' }}>
            Transaction of ₹{recentlyDeletedTransaction.amount} deleted.
          </div>
          <button
            onClick={() => undoDeleteTransaction(currentWorkspace?.id || 'ws_default')}
            style={{
              background: 'var(--color-purple)',
              border: 'none',
              color: '#FFF',
              padding: '0.45rem 0.9rem',
              borderRadius: '10px',
              fontWeight: '800',
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <Undo2 size={16} /> UNDO
          </button>
        </div>
      )}

      {/* Language Pill & Auto-Backup Status Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {[
            { code: 'EN', label: '🇬🇧 English' },
            { code: 'HI', label: '🇮🇳 हिंदी' }
          ].map(item => (
            <button
              key={item.code}
              onClick={() => setLang(item.code)}
              className={lang === item.code ? 'btn-primary' : 'btn-secondary'}
              style={{
                borderRadius: '12px',
                padding: '0.35rem 0.85rem',
                fontSize: '0.825rem',
                minHeight: '36px',
                flexShrink: 0
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          fontSize: '0.75rem',
          padding: '0.35rem 0.75rem',
          borderRadius: '12px',
          background: 'rgba(16, 185, 129, 0.12)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          color: 'var(--color-emerald)',
          fontWeight: '700'
        }}>
          <UploadCloud size={14} /> Auto-Sync Vault Active
        </div>
      </div>

      {/* Welcome User Card */}
      <div 
        onClick={() => onNavigateTab('profile')}
        style={{
          background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.6), rgba(15, 23, 42, 0.8))',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          borderRadius: '20px',
          padding: '1.1rem 1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer'
        }}
      >
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Enterprise Workspace
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '800', margin: '0.2rem 0 0 0', color: 'var(--text-main)' }}>
            {user?.name || 'Lead Accountant'}
          </h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-purple-40)', fontSize: '0.85rem', fontWeight: '700' }}>
          Role: {user?.role || 'OWNER'} <ChevronRight size={18} />
        </div>
      </div>

      {/* Date Range Combo Selector Bar (Directive 1.1) */}
      <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.2rem' }}>
        {['Daily', 'Weekly', 'Monthly', 'Yearly'].map(combo => (
          <button
            key={combo}
            onClick={() => setDateFilterCombo(combo)}
            style={{
              padding: '0.45rem 0.85rem',
              borderRadius: '12px',
              background: dateFilterCombo === combo ? 'var(--color-purple)' : 'var(--bg-canvas)',
              border: dateFilterCombo === combo ? 'none' : '1px solid var(--border-color)',
              color: dateFilterCombo === combo ? '#FFF' : 'var(--text-muted)',
              fontSize: '0.775rem',
              fontWeight: '700',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {combo} Range
          </button>
        ))}
      </div>

      {/* Hero Financial Net Balance Card */}
      <div className="glass-panel" style={{
        padding: '1.5rem',
        borderRadius: '24px',
        background: isNetGet
          ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(9, 13, 22, 0.95) 100%)'
          : isNetGive
            ? 'linear-gradient(135deg, rgba(244, 63, 94, 0.15) 0%, rgba(9, 13, 22, 0.95) 100%)'
            : 'linear-gradient(135deg, rgba(148, 163, 184, 0.12) 0%, rgba(9, 13, 22, 0.95) 100%)',
        border: isNetGet
          ? '1px solid rgba(16, 185, 129, 0.3)'
          : isNetGive
            ? '1px solid rgba(244, 63, 94, 0.3)'
            : '1px solid rgba(148, 163, 184, 0.3)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '0.825rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)' }}>
            Net Ledger Position
          </span>
          <span style={{
            fontSize: '0.75rem',
            fontWeight: '800',
            padding: '0.25rem 0.65rem',
            borderRadius: '20px',
            background: isNetGet ? 'rgba(16, 185, 129, 0.2)' : isNetGive ? 'rgba(244, 63, 94, 0.2)' : 'rgba(148, 163, 184, 0.2)',
            color: isNetGet ? 'var(--color-emerald)' : isNetGive ? 'var(--color-rose)' : 'var(--text-muted)'
          }}>
            {isNetGet ? 'NET RECEIVABLE (YOU GET)' : isNetGive ? 'NET PAYABLE (YOU GIVE)' : 'SETTLED'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.2rem', marginBottom: '1.25rem' }}>
          <span style={{ fontSize: '2.5rem', fontWeight: '900', color: isNetGet ? 'var(--color-emerald)' : isNetGive ? 'var(--color-rose)' : 'var(--text-muted)' }}>
            {getAmountInteger(Math.abs(netPosition))}
          </span>
          <span style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-muted)' }}>
            {getAmountDecimal(Math.abs(netPosition))}
          </span>
        </div>

        {/* You Will Get / You Will Give Split Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>

          {/* You Will Get */}
          <div style={{
            background: 'var(--bg-canvas)',
            padding: '1rem',
            borderRadius: '16px',
            border: '1px solid rgba(16, 185, 129, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-emerald)', fontSize: '0.775rem', fontWeight: '700', marginBottom: '0.35rem' }}>
              <ArrowDownLeft size={16} /> YOU WILL GET
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-main)' }}>
              {formatCurrency(metrics.totalIn)}
            </div>
          </div>

          {/* You Will Give */}
          <div style={{
            background: 'var(--bg-canvas)',
            padding: '1rem',
            borderRadius: '16px',
            border: '1px solid rgba(244, 63, 94, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-rose)', fontSize: '0.775rem', fontWeight: '700', marginBottom: '0.35rem' }}>
              <ArrowUpRight size={16} /> YOU WILL GIVE
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-main)' }}>
              {formatCurrency(metrics.totalOut)}
            </div>
          </div>

        </div>
      </div>

      {/* Action Shortcut Buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.65rem' }}>

        <div
          onClick={onOpenSmartEntry}
          className="glass-card"
          data-testid="tool_smartentry"
          style={{ padding: '1rem', textAlign: 'center', cursor: 'pointer' }}
        >
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: 'rgba(99, 102, 241, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 0.5rem auto'
          }}>
            <Mic size={20} color="var(--color-purple-40)" />
          </div>
          <div style={{ fontSize: '0.775rem', fontWeight: '700', color: 'var(--text-main)' }}>Smart Voice</div>
        </div>

        <div
          onClick={() => onNavigateTab('parties')}
          className="glass-card"
          data-testid="tool_parties"
          style={{ padding: '1rem', textAlign: 'center', cursor: 'pointer' }}
        >
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: 'rgba(79, 70, 229, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 0.5rem auto'
          }}>
            <Users size={20} color="var(--color-purple-40)" />
          </div>
          <div style={{ fontSize: '0.775rem', fontWeight: '700', color: 'var(--text-main)' }}>{t('contacts')}</div>
        </div>

        <div
          onClick={() => onNavigateTab('telemetry')}
          className="glass-card"
          data-testid="tool_backup_settings"
          style={{ padding: '1rem', textAlign: 'center', cursor: 'pointer' }}
        >
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: 'rgba(16, 185, 129, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 0.5rem auto'
          }}>
            <UploadCloud size={20} color="var(--color-emerald)" />
          </div>
          <div style={{ fontSize: '0.775rem', fontWeight: '700', color: 'var(--text-main)' }}>{t('cloudBackup')}</div>
        </div>
      </div>

      {/* Top 3 Categories Computation Card (Directive 1.2) */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.65rem', fontWeight: '800', letterSpacing: '1.5px', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
          <PieChart size={14} color="var(--color-purple)" /> TOP 3 EXPENSE CATEGORIES (THIS MONTH)
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
          {metrics.top3Categories.length > 0 ? (
            metrics.top3Categories.map((item, idx) => (
              <div key={idx} className="glass-card" style={{ padding: '0.85rem', flex: 1, minWidth: '120px', borderRadius: '20px' }}>
                <div style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>🏷️</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>{item.category}</div>
                <div style={{ fontSize: '0.95rem', fontWeight: '800', marginTop: '0.2rem', color: 'var(--color-rose)' }}>
                  {formatCurrency(item.amount)}
                </div>
              </div>
            ))
          ) : (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '0.5rem' }}>
              No debit entries recorded for the current month yet.
            </div>
          )}
        </div>
      </div>

      {/* Recent Transactions Feed */}
      <div className="glass-panel" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)' }}>{t('recentLedgerEntries')}</h3>
          <button onClick={() => onNavigateTab('transactions')} style={{ background: 'transparent', border: 'none', color: 'var(--color-purple-40)', fontSize: '0.75rem', fontWeight: '800', cursor: 'pointer' }}>
            {t('seeAll')}
          </button>
        </div>

        {transactions.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {transactions.slice(0, 5).map(tx => (
              <div key={tx.id} className="glass-card" style={{
                padding: '0.9rem 1.1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    background: tx.type === 'GOT' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(248, 113, 113, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '800',
                    color: tx.type === 'GOT' ? 'var(--color-emerald)' : 'var(--color-rose)'
                  }}>
                    {tx.type === 'GOT' ? 'IN' : 'OUT'}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-main)' }}>
                      {tx.category || 'General'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(tx.date || tx.created_at).toLocaleDateString()} • {tx.payment_mode || 'CASH'}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: '1rem', fontWeight: '800', color: tx.type === 'GOT' ? 'var(--color-emerald)' : 'var(--color-rose)' }}>
                  {tx.type === 'GOT' ? '+' : '-'}{formatCurrency(tx.amount)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No transactions recorded yet. Tap + to create your first entry.
          </div>
        )}
      </div>

    </div>
  );
}
