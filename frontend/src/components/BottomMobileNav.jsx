import React from 'react';
import { useLedgerStore } from '../store/ledgerStore.js';
import { usePreferencesStore } from '../store/preferencesStore.js';
import { 
  LayoutDashboard, 
  Users, 
  Receipt, 
  HardDriveUpload, 
  Sparkles
} from 'lucide-react';

export default function BottomMobileNav({ onOpenSmartEntry }) {
  const { activeTab, setActiveTab } = useLedgerStore();
  const { t } = usePreferencesStore();

  const navItems = [
    { id: 'dashboard', label: t('dashboard'), icon: LayoutDashboard },
    { id: 'parties', label: t('parties'), icon: Users },
    { id: 'smart', label: t('smartEntry'), icon: Sparkles, isCenterFab: true },
    { id: 'transactions', label: t('transactions'), icon: Receipt },
    { id: 'telemetry', label: t('backup'), icon: HardDriveUpload }
  ];

  return (
    <div style={{
      position: 'fixed',
      bottom: '1rem',
      left: '50%',
      transform: 'translateX(-50%)',
      width: 'calc(100% - 2rem)',
      maxWidth: '540px',
      height: '68px',
      background: 'var(--bg-surface)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      border: '1px solid var(--border-subtle)',
      borderRadius: '35px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-around',
      padding: '0 0.75rem',
      zIndex: 1000,
      boxShadow: '0 12px 32px rgba(0, 0, 0, 0.4), 0 0 20px rgba(79, 70, 229, 0.2)'
    }}>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;

        if (item.isCenterFab) {
          return (
            <button
              key={item.id}
              onClick={onOpenSmartEntry}
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #4F46E5, #818CF8)',
                border: '3px solid var(--bg-surface)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                marginTop: '-28px',
                boxShadow: '0 8px 24px rgba(79, 70, 229, 0.6)',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
              title="Smart Natural Language Entry"
            >
              <Sparkles size={24} className="mic-pulse" />
            </button>
          );
        }

        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            style={{
              background: 'transparent',
              border: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              cursor: 'pointer',
              color: isActive ? 'var(--color-deep-purple)' : 'var(--text-dim)',
              transition: 'all 0.2s ease',
              padding: '0.35rem'
            }}
          >
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              background: isActive ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
              border: isActive ? '1px solid var(--color-purple)' : '1px solid transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease'
            }}>
              <Icon size={18} color={isActive ? 'var(--color-deep-purple)' : 'var(--text-dim)'} />
            </div>
            <span style={{
              fontSize: '0.675rem',
              fontWeight: isActive ? '800' : '600',
              letterSpacing: '-0.01em'
            }}>
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
