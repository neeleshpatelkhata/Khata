import React, { useState, useEffect, Component } from 'react';
import { useAuthStore } from './store/authStore.js';
import { useLedgerStore } from './store/ledgerStore.js';
import AuthScreen from './components/AuthScreen.jsx';
import Navbar from './components/Navbar.jsx';
import ExecutiveDashboard from './components/ExecutiveDashboard.jsx';
import PartyLedgerView from './components/PartyLedgerView.jsx';
import AllTransactionsView from './components/AllTransactionsView.jsx';
import PhotoScannerView from './components/PhotoScannerView.jsx';
import BackupTelemetryCenter from './components/BackupTelemetryCenter.jsx';
import TransactionModal from './components/TransactionModal.jsx';
import SmartEntryModal from './components/SmartEntryModal.jsx';
import UserProfileModal from './components/UserProfileModal.jsx';
import GlobalSearchModal from './components/GlobalSearchModal.jsx';
import ProfilePageView from './components/ProfilePageView.jsx';
import BottomMobileNav from './components/BottomMobileNav.jsx';
import './styles/theme.css';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Khata App ErrorBoundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-canvas)',
          color: 'var(--text-main)',
          padding: '2rem',
          textAlign: 'center'
        }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '1rem', color: 'var(--color-rose)' }}>
            Something went wrong
          </h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', maxWidth: '400px', fontSize: '0.9rem' }}>
            {this.state.error?.message || 'An unexpected application error occurred.'}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="btn-primary"
          >
            Reload Khata Ledger
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

import { App as CapApp } from '@capacitor/app';

export default function App() {
  const { currentWorkspace, isAuthenticated, isInitializing, initAuth } = useAuthStore();
  const store = useLedgerStore();
  const { activeTab, setActiveTab, fetchWorkspaceData, resetWorkspace } = store;

  const [isSmartEntryOpen, setIsSmartEntryOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    initAuth();
  }, []);

  // Load the signed-in workspace's ledger. The state is cleared first so a
  // slow or failed fetch can never leave a previous account's data on
  // screen, or bleed unsynced local entries into the next account's cache —
  // see resetWorkspace() for why this matters on a shared device.
  useEffect(() => {
    resetWorkspace();
    if (currentWorkspace?.id) {
      localStorage.setItem('khata_active_ws', JSON.stringify(currentWorkspace));
      fetchWorkspaceData(currentWorkspace.id);
    }
  }, [currentWorkspace?.id]);

  // Sync browser URL path with App State on popstate (browser back / forward buttons)
  useEffect(() => {
    if (!isAuthenticated) return;

    const handlePopState = () => {
      const path = window.location.pathname;
      if (path.startsWith('/parties/')) {
        const partyId = path.replace('/parties/', '');
        setActiveTab('parties', false);
        const party = store.parties.find(p => String(p.id) === String(partyId));
        if (party) store.setSelectedParty(party, false);
      } else if (path === '/parties') {
        setActiveTab('parties', false);
      } else if (path === '/transactions') {
        setActiveTab('transactions', false);
      } else if (path === '/scanner') {
        setActiveTab('scanner', false);
      } else if (path === '/telemetry') {
        setActiveTab('telemetry', false);
      } else if (path === '/profile') {
        setActiveTab('profile', false);
      } else {
        setActiveTab('dashboard', false);
      }
    };

    window.addEventListener('popstate', handlePopState);
    handlePopState(); // initial sync

    return () => window.removeEventListener('popstate', handlePopState);
  }, [isAuthenticated, store.parties]);

  // Handle Hardware Back Button for Android App (1 step back navigation)
  useEffect(() => {
    let backListener = null;

    const setupBackButton = async () => {
      try {
        backListener = await CapApp.addListener('backButton', () => {
          // 1. Close open modals if present
          if (isSmartEntryOpen) {
            setIsSmartEntryOpen(false);
            return;
          }
          if (isProfileOpen) {
            setIsProfileOpen(false);
            return;
          }
          if (isSearchOpen) {
            setIsSearchOpen(false);
            return;
          }
          if (store.isTransactionModalOpen) {
            store.closeTransactionModal();
            return;
          }

          // 2. Navigate back using browser history if not on home dashboard
          if (window.location.pathname !== '/' && window.location.pathname !== '/dashboard') {
            window.history.back();
            return;
          }

          // 3. Only exit/minimize app when on Home Dashboard with no open modals
          CapApp.minimizeApp();
        });
      } catch (err) {
        console.warn('Native back button listener active in Capacitor env:', err);
      }
    };

    setupBackButton();

    return () => {
      if (backListener && typeof backListener.remove === 'function') {
        backListener.remove();
      }
    };
  }, [isSmartEntryOpen, isProfileOpen, isSearchOpen, store.isTransactionModalOpen]);

  // Resolving the stored session — render nothing rather than flashing the
  // login screen for someone who is already signed in.
  if (isInitializing) {
    return <div style={{ minHeight: '100vh', background: 'var(--bg-canvas)' }} />;
  }

  if (!isAuthenticated) {
    return (
      <ErrorBoundary>
        <AuthScreen />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', paddingBottom: '90px' }}>
        {/*
          The brand/workspace-switcher/search/profile header is intentionally
          hidden on the Dashboard tab (see ExecutiveDashboard) — it stays
          exactly as-is on every other tab, so switching workspace, search
          and sign-out remain one tap away (Parties/Transactions/Backup/
          Profile) rather than being removed from the app.
        */}
        {activeTab !== 'dashboard' && (
          <Navbar
            onOpenSearch={() => setIsSearchOpen(true)}
            onOpenProfile={() => setIsProfileOpen(true)}
          />
        )}

        <main style={{ flex: 1 }}>
          {activeTab === 'dashboard' && (
            <ExecutiveDashboard
              onOpenSmartEntry={() => setIsSmartEntryOpen(true)}
              onNavigateTab={(tab) => setActiveTab(tab)}
              onOpenSearch={() => setIsSearchOpen(true)}
              onOpenProfile={() => setIsProfileOpen(true)}
            />
          )}
          {activeTab === 'parties' && <PartyLedgerView />}
          {activeTab === 'transactions' && <AllTransactionsView />}
          {activeTab === 'scanner' && <PhotoScannerView key={Date.now()} />}
          {activeTab === 'telemetry' && <BackupTelemetryCenter />}
          {activeTab === 'profile' && <ProfilePageView onBack={() => setActiveTab('dashboard')} />}
        </main>

        {/* Floating Bottom Mobile Circular Dock */}
        <BottomMobileNav onOpenSmartEntry={() => setIsSmartEntryOpen(true)} />

        <TransactionModal />

        <SmartEntryModal
          isOpen={isSmartEntryOpen}
          onClose={() => setIsSmartEntryOpen(false)}
        />

        <UserProfileModal
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
        />

        <GlobalSearchModal
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
        />
      </div>
    </ErrorBoundary>
  );
}
