import React, { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useLedgerStore } from '../store/ledgerStore';
import { useSyncStore } from '../store/syncStore';
import {
  Search,
  Wifi,
  WifiOff,
  RefreshCw,
  Settings,
  LogOut
} from 'lucide-react';

export default function Navbar({ onOpenSearch, onOpenProfile }) {
  const { user, currentWorkspace, workspaces, switchWorkspace, logout } = useAuthStore();
  const { fetchWorkspaceData } = useLedgerStore();
  const { isOnline, pendingOutboxCount, isSyncing, triggerManualSync } = useSyncStore();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="glass-panel" style={{
      margin: '1rem',
      padding: '0.75rem 1.25rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '1rem',
      position: 'relative'
    }}>
      
      {/* Brand & Workspace Switcher */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'var(--color-purple-40)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            fontWeight: '800',
            fontSize: '1.2rem',
            letterSpacing: '-0.5px'
          }}>
            K
          </div>
          <div>
            <div style={{ fontSize: '1rem', fontWeight: '800', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              KHATA<span style={{ color: 'var(--color-purple-40)' }}>.PRO</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Enterprise Financial Ledger</div>
          </div>
        </div>

        {/* Workspace Switcher Dropdown */}
        {workspaces.length > 0 && (
          <div style={{ position: 'relative' }}>
            <select
              value={currentWorkspace?.id || ''}
              onChange={(e) => {
                const ws = workspaces.find(w => w.id === e.target.value);
                if (ws) {
                  switchWorkspace(ws.id);
                  fetchWorkspaceData(ws.id);
                }
              }}
              className="input-field"
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.8rem',
                fontWeight: '700',
                background: 'rgba(255, 255, 255, 0.05)',
                minHeight: '36px'
              }}
            >
              {workspaces.map(w => (
                <option key={w.id} value={w.id}>
                  🏢 {w.name} ({w.currency})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right Telemetry, Search, and Downward Profile Dropdown */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', position: 'relative' }} ref={dropdownRef}>
        
        {/* Sync Telemetry Badge */}
        <div
          onClick={triggerManualSync}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.35rem 0.65rem',
            borderRadius: '10px',
            background: isOnline ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
            border: `1px solid ${isOnline ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)'}`,
            cursor: 'pointer'
          }}
        >
          {isOnline ? <Wifi size={14} color="var(--color-emerald)" /> : <WifiOff size={14} color="var(--color-rose)" />}
          <div style={{ fontSize: '0.725rem', fontWeight: '700', color: isOnline ? 'var(--color-emerald)' : 'var(--color-rose)' }}>
            {isSyncing ? 'Syncing...' : isOnline ? 'LIVE ONLINE' : `OFFLINE (${pendingOutboxCount})`}
          </div>
          <RefreshCw size={12} style={{ animation: isSyncing ? 'spin 1s linear infinite' : 'none' }} />
        </div>

        {/* Global Search Icon Button 🔍 */}
        <button
          onClick={onOpenSearch}
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          title="Global Quick Search"
        >
          <Search size={18} color="#F8FAFC" />
        </button>

        {/* Profile Avatar Button Trigger */}
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: user?.avatarUrl ? 'transparent' : 'linear-gradient(135deg, #FF6B6B, #EE5253)',
            border: '2px solid rgba(255, 107, 107, 0.5)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontWeight: '800',
            fontSize: '1rem',
            overflow: 'hidden',
            boxShadow: '0 4px 14px rgba(238, 82, 83, 0.45)',
            transition: 'transform 0.2s ease'
          }}
          title="Click to open Profile options"
        >
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            user?.name ? user.name.charAt(0).toUpperCase() : 'A'
          )}
        </button>

        {/* Downward Profile Dropdown Menu */}
        {isDropdownOpen && (
          <div className="glass-panel" style={{
            position: 'absolute',
            top: 'calc(100% + 12px)',
            right: 0,
            width: '280px',
            padding: '1rem',
            zIndex: 1500,
            boxShadow: '0 16px 36px rgba(0, 0, 0, 0.8), 0 0 24px rgba(99, 102, 241, 0.3)',
            borderRadius: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem'
          }}>
            {/* User Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #FF6B6B, #EE5253)',
                color: '#FFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '800',
                fontSize: '1.1rem'
              }}>
                {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
              </div>
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--text-main)' }}>
                  {user?.name || 'Devansh Accountant'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {user?.email || 'demo@khata.pro'}
                </div>
              </div>
            </div>

            {/* Dropdown Menu Actions */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.65rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <button
                onClick={() => {
                  setIsDropdownOpen(false);
                  onOpenProfile();
                }}
                className="btn-secondary"
                style={{
                  width: '100%',
                  justifyContent: 'flex-start',
                  fontSize: '0.8rem',
                  padding: '0.45rem 0.75rem',
                  minHeight: '36px',
                  borderRadius: '10px'
                }}
              >
                <Settings size={15} /> Edit Full Profile & Details
              </button>

              <button
                onClick={() => {
                  setIsDropdownOpen(false);
                  logout();
                }}
                className="btn-secondary"
                style={{
                  width: '100%',
                  justifyContent: 'flex-start',
                  fontSize: '0.8rem',
                  padding: '0.45rem 0.75rem',
                  minHeight: '36px',
                  borderRadius: '10px',
                  color: 'var(--color-rose)',
                  borderColor: 'rgba(244, 63, 94, 0.2)'
                }}
              >
                <LogOut size={15} /> Sign Out
              </button>
            </div>
          </div>
        )}
      </div>

    </header>
  );
}
