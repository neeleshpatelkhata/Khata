import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useLedgerStore } from '../store/ledgerStore';
import { usePreferencesStore } from '../store/preferencesStore';
import { 
  Users, 
  Search, 
  Plus, 
  Phone, 
  Mail, 
  MapPin,
  ArrowLeft, 
  MoreVertical, 
  ArrowDownLeft, 
  ArrowUpRight, 
  PlusCircle, 
  MinusCircle, 
  Share2, 
  ChevronRight, 
  X,
  Edit3,
  Trash2,
  UserPlus,
  Zap,
  CheckCircle2,
  ShieldCheck,
  History,
  Lock
} from 'lucide-react';

export default function PartyLedgerView() {
  const { currentWorkspace, user } = useAuthStore();
  const { 
    parties, 
    transactions, 
    selectedParty, 
    setSelectedParty, 
    searchTerm, 
    setSearchTerm, 
    partyTypeFilter, 
    setPartyTypeFilter, 
    openTransactionModal,
    openEditTransactionModal,
    deleteTransaction,
    deleteParty,
    updateParty,
    createParty,
    createMultipleParties,
    getPartyStatement
  } = useLedgerStore();
  const { t } = usePreferencesStore();

  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [isAddPartyModalOpen, setIsAddPartyModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [showAuditTrail, setShowAuditTrail] = useState(false);
  const [editingPartyId, setEditingPartyId] = useState(null);
  const [currencySymbol] = useState('₹');

  // Single Party Form state
  const [newPartyName, setNewPartyName] = useState('');
  const [newPartyPhone, setNewPartyPhone] = useState('');
  const [newPartyEmail, setNewPartyEmail] = useState('');
  const [newPartyType, setNewPartyType] = useState('CUSTOMER');
  const [newPartyAddress, setNewPartyAddress] = useState('');
  const [newPartyOpeningBal, setNewPartyOpeningBal] = useState('0');
  const [isSubmittingParty, setIsSubmittingParty] = useState(false);

  // Bulk Multiple Parties Form state
  const [bulkRows, setBulkRows] = useState([
    { name: '', phone: '', email: '', location: '', type: 'CUSTOMER', openingBalance: '0' },
    { name: '', phone: '', email: '', location: '', type: 'SUPPLIER', openingBalance: '0' }
  ]);
  const [isSubmittingBulk, setIsSubmittingBulk] = useState(false);

  const isStaff = user?.role === 'STAFF';

  const formatCurrency = (val) => {
    return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(val || 0)}`;
  };

  const handleSelectParty = (party) => {
    setSelectedParty(party);
  };

  const handleBackToList = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      setSelectedParty(null);
    }
  };

  const handleOpenEditParty = (party) => {
    setEditingPartyId(party.id);
    setNewPartyName(party.name || '');
    setNewPartyPhone(party.phone || '');
    setNewPartyEmail(party.email || '');
    setNewPartyType(party.type || 'CUSTOMER');
    setNewPartyAddress(party.address || '');
    setNewPartyOpeningBal(String(party.opening_balance || 0));
    setIsAddPartyModalOpen(true);
  };

  const handleDeleteCurrentParty = async (partyId, partyName) => {
    if (isStaff) {
      alert('Permission Denied: Staff accounts cannot delete party records.');
      return;
    }
    if (!window.confirm(`Are you sure you want to archive ${partyName} and soft-delete associated transactions?`)) return;
    try {
      await deleteParty(currentWorkspace?.id || 'ws_local_default', partyId, user?.role);
      setSelectedParty(null);
      setIsOptionsOpen(false);
    } catch (err) {
      alert(err.message || 'Delete party failed.');
    }
  };

  const handleDeleteTx = async (e, tx) => {
    e.stopPropagation();
    if (isStaff) {
      alert('Permission Denied: Staff accounts cannot delete transaction entries.');
      return;
    }
    if (!window.confirm(`Are you sure you want to archive transaction of ₹${tx.amount}?`)) return;
    try {
      await deleteTransaction(currentWorkspace?.id || 'ws_local_default', tx.id, user?.role);
    } catch (err) {
      alert(err.message || 'Delete transaction failed.');
    }
  };

  const handleCreateOrUpdatePartySubmit = async (e) => {
    e.preventDefault();
    if (!newPartyName.trim() || isSubmittingParty) return;
    setIsSubmittingParty(true);
    const wsId = currentWorkspace?.id || 'ws_local_default';
    try {
      if (editingPartyId) {
        const updated = await updateParty(wsId, editingPartyId, {
          name: newPartyName.trim(),
          phone: newPartyPhone,
          email: newPartyEmail,
          type: newPartyType,
          address: newPartyAddress
        });
        setSelectedParty(updated);
      } else {
        const created = await createParty(wsId, {
          name: newPartyName.trim(),
          phone: newPartyPhone,
          email: newPartyEmail,
          type: newPartyType,
          address: newPartyAddress,
          openingBalance: Number(newPartyOpeningBal)
        });
        setSelectedParty(created);
      }
      setIsAddPartyModalOpen(false);
      setEditingPartyId(null);
      setNewPartyName('');
      setNewPartyPhone('');
      setNewPartyEmail('');
      setNewPartyAddress('');
      setNewPartyOpeningBal('0');
    } catch (err) {
      alert(err.message || 'Operation failed.');
    } finally {
      setIsSubmittingParty(false);
    }
  };

  const handleAddBulkRow = () => {
    setBulkRows(prev => [
      ...prev,
      { name: '', phone: '', email: '', location: '', type: 'CUSTOMER', openingBalance: '0' }
    ]);
  };

  const handleRemoveBulkRow = (index) => {
    setBulkRows(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateBulkRow = (index, field, val) => {
    setBulkRows(prev => prev.map((row, i) => i === index ? { ...row, [field]: val } : row));
  };

  const handleLoadSampleBatch = () => {
    setBulkRows([
      { name: 'Ram Kumar', phone: '+91 9876543210', email: 'ram@example.com', location: 'Delhi Market', type: 'CUSTOMER', openingBalance: '0' },
      { name: 'Shyam Traders', phone: '+91 9812345678', email: 'shyam@traders.com', location: 'Mumbai Yard', type: 'SUPPLIER', openingBalance: '0' },
      { name: 'Gita Store', phone: '+91 9988776655', email: 'gita@store.in', location: 'Ahmedabad', type: 'CUSTOMER', openingBalance: '0' }
    ]);
  };

  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    const validRows = bulkRows.filter(r => r.name && r.name.trim().length > 0);
    if (validRows.length === 0) {
      alert('Please enter at least one valid party name.');
      return;
    }

    setIsSubmittingBulk(true);
    const wsId = currentWorkspace?.id || 'ws_local_default';
    try {
      const { created, skipped } = await createMultipleParties(wsId, validRows);
      if (skipped.length > 0) {
        alert(
          `Added ${created.length} ${created.length === 1 ? 'party' : 'parties'}.\n\n` +
          `Skipped ${skipped.length}:\n` +
          skipped.map(s => `• ${s.name}: ${s.reason}`).join('\n')
        );
      }
      setIsBulkModalOpen(false);
      setBulkRows([
        { name: '', phone: '', email: '', location: '', type: 'CUSTOMER', openingBalance: '0' },
        { name: '', phone: '', email: '', location: '', type: 'SUPPLIER', openingBalance: '0' }
      ]);
    } catch (err) {
      alert(`Bulk creation error: ${err.message}`);
    } finally {
      setIsSubmittingBulk(false);
    }
  };

  const handleQuickCreateParty = async (name, type) => {
    const wsId = currentWorkspace?.id || 'ws_local_default';
    try {
      const created = await createParty(wsId, { name, type });
      setSelectedParty(created);
    } catch (err) {
      alert(err.message || 'Quick add party failed.');
    }
  };

  // Active Non-deleted Parties Filter
  const activeParties = parties.filter(p => !p.is_deleted);

  // Filter parties by search term and partyTypeFilter
  const filteredParties = activeParties.filter(p => {
    const s = searchTerm.trim().toLowerCase();
    const matchesSearch = !s || (p.name || '').toLowerCase().includes(s) || (p.phone || '').includes(s);
    const matchesType = !partyTypeFilter || p.type === partyTypeFilter;
    return matchesSearch && matchesType;
  });

  const activeSelectedParty = selectedParty && !selectedParty.is_deleted ? selectedParty : null;

  // Filter transactions for the selected party (ignoring soft-deleted entries)
  const partyTransactions = activeSelectedParty 
    ? transactions.filter(t => !t.is_deleted && String(t.party_id) === String(activeSelectedParty.id)) 
    : [];

  // Running balance comes from the shared ledger engine so the statement can
  // never disagree with the balance shown on the party card.
  const partyTimelineWithBalances = getPartyStatement(activeSelectedParty);

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '1rem', paddingBottom: '90px' }}>
      
      {/* SCREEN 1: PARTIES LIST VIEW (Single Column Mobile Flow) */}
      {!activeSelectedParty && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* Header Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: '900', letterSpacing: '-0.5px', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)', margin: 0 }}>
                <Users size={22} color="var(--color-cyan)" /> {t('partiesLedger')}
              </h2>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                {activeParties.length} Active Parties • User Access: <strong>{isStaff ? '👤 Staff' : '👑 Owner'}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button
                onClick={() => setIsBulkModalOpen(true)}
                className="btn-secondary"
                style={{
                  padding: '0.5rem 0.65rem',
                  fontSize: '0.775rem',
                  borderRadius: '12px',
                  fontWeight: '800',
                  color: 'var(--color-cyan)'
                }}
              >
                <Zap size={14} /> Bulk Add
              </button>

              <button
                onClick={() => { setEditingPartyId(null); setNewPartyName(''); setIsAddPartyModalOpen(true); }}
                className="btn-primary"
                style={{
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.775rem',
                  borderRadius: '12px',
                  fontWeight: '800',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                <UserPlus size={14} /> + Party
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
            <input
              type="text"
              placeholder="Search by party name or phone number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field"
              style={{ paddingLeft: '2.75rem', fontSize: '0.9rem', borderRadius: '16px' }}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--text-muted)' }}
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Filter Chips */}
          <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.2rem' }}>
            {[
              { id: '', label: `${t('allParties')} (${activeParties.length})` },
              { id: 'CUSTOMER', label: t('customersOnly') },
              { id: 'SUPPLIER', label: t('suppliersOnly') }
            ].map(chip => (
              <button
                key={chip.id}
                onClick={() => setPartyTypeFilter(chip.id)}
                className={partyTypeFilter === chip.id ? 'btn-primary' : 'btn-secondary'}
                style={{
                  padding: '0.45rem 0.85rem',
                  fontSize: '0.775rem',
                  borderRadius: '12px',
                  whiteSpace: 'nowrap',
                  fontWeight: '800'
                }}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Parties List Grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {filteredParties.length > 0 ? (
              filteredParties.map(p => {
                const isReceivable = p.current_balance > 0;
                const isPayable = p.current_balance < 0;

                return (
                  <div
                    key={p.id}
                    className="glass-card"
                    style={{
                      padding: '1rem 1.1rem',
                      borderRadius: '20px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                      cursor: 'pointer'
                    }}
                    onClick={() => handleSelectParty(p)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                        <div style={{
                          width: '46px',
                          height: '46px',
                          borderRadius: '50%',
                          background: p.type === 'CUSTOMER' ? 'linear-gradient(135deg, #4F46E5, #818CF8)' : 'linear-gradient(135deg, #F59E0B, #FBBF24)',
                          color: '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: '900',
                          fontSize: '1.2rem',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                        }}>
                          {p.name.charAt(0).toUpperCase()}
                        </div>

                        <div>
                          <div style={{ fontSize: '1rem', fontWeight: '900', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            {p.name}
                            <span className={`badge ${p.type === 'CUSTOMER' ? 'badge-cyan' : 'badge-amber'}`} style={{ fontSize: '0.65rem' }}>
                              {p.type}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'flex', gap: '0.5rem', marginTop: '2px' }}>
                            {p.phone && <span><Phone size={11} style={{ display: 'inline', marginRight: '2px' }} />{p.phone}</span>}
                            {p.address && <span><MapPin size={11} style={{ display: 'inline', marginRight: '2px' }} />{p.address}</span>}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ textAlign: 'right' }}>
                          <div className="font-mono" style={{
                            fontWeight: '900',
                            fontSize: '1rem',
                            color: isReceivable ? 'var(--color-emerald)' : isPayable ? 'var(--color-rose)' : 'var(--text-muted)'
                          }}>
                            {isReceivable ? `+${formatCurrency(p.current_balance)}` : isPayable ? `-${formatCurrency(Math.abs(p.current_balance))}` : '0.00'}
                          </div>
                          <div style={{ fontSize: '0.675rem', color: 'var(--text-muted)', fontWeight: '700' }}>
                            {isReceivable ? t('youGet') : isPayable ? t('youGive') : t('settled')}
                          </div>
                        </div>
                        <ChevronRight size={18} color="var(--text-muted)" />
                      </div>
                    </div>

                    {/* Quick Entry Action Buttons */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openTransactionModal(p, 'GAVE');
                        }}
                        className="btn-secondary"
                        style={{
                          justifyContent: 'center',
                          padding: '0.4rem',
                          fontSize: '0.775rem',
                          fontWeight: '800',
                          color: 'var(--color-rose)',
                          borderColor: 'rgba(244, 63, 94, 0.3)'
                        }}
                      >
                        <MinusCircle size={14} /> - Gave (Debit ₹)
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openTransactionModal(p, 'GOT');
                        }}
                        className="btn-secondary"
                        style={{
                          justifyContent: 'center',
                          padding: '0.4rem',
                          fontSize: '0.775rem',
                          fontWeight: '800',
                          color: 'var(--color-emerald)',
                          borderColor: 'rgba(16, 185, 129, 0.3)'
                        }}
                      >
                        <PlusCircle size={14} /> + Got (Credit ₹)
                      </button>
                    </div>

                  </div>
                );
              })
            ) : (
              <div className="glass-card" style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '2.5rem 1rem', borderRadius: '20px' }}>
                <Users size={44} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
                <div style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '0.35rem' }}>No Matching Parties</div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                  Add multiple separate parties like <strong>Ram</strong>, <strong>Shyam</strong>, or suppliers to maintain individual credit/debit records.
                </p>

                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => handleQuickCreateParty('Ram Kumar', 'CUSTOMER')}
                    className="btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem' }}
                  >
                    + Add "Ram Kumar"
                  </button>
                  <button
                    onClick={() => handleQuickCreateParty('Shyam Traders', 'SUPPLIER')}
                    className="btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem' }}
                  >
                    + Add "Shyam Traders"
                  </button>
                  <button
                    onClick={() => setIsBulkModalOpen(true)}
                    className="btn-primary"
                    style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem' }}
                  >
                    <Zap size={14} /> Bulk Add Multiple
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {/* SCREEN 2: INDIVIDUAL PARTY STATEMENT & LEDGER TIMELINE */}
      {activeSelectedParty && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* Header Navigation */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button
              onClick={handleBackToList}
              className="btn-secondary"
              style={{ padding: '0.45rem 0.85rem', fontSize: '0.85rem', fontWeight: '800', borderRadius: '12px' }}
            >
              <ArrowLeft size={18} /> {t('backToParties')}
            </button>

            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setIsOptionsOpen(!isOptionsOpen)}
                className="btn-secondary"
                style={{ padding: '0.45rem 0.65rem', borderRadius: '12px' }}
              >
                <MoreVertical size={18} />
              </button>

              {isOptionsOpen && (
                <div className="glass-panel" style={{
                  position: 'absolute',
                  right: 0,
                  top: '110%',
                  width: '200px',
                  padding: '0.5rem',
                  borderRadius: '14px',
                  zIndex: 100,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
                }}>
                  <button 
                    onClick={() => { setIsOptionsOpen(false); handleOpenEditParty(activeSelectedParty); }}
                    className="btn-secondary" 
                    style={{ justifyContent: 'flex-start', padding: '0.6rem 0.85rem', border: 'none', borderRadius: '10px', fontSize: '0.825rem' }}
                  >
                    <Edit3 size={16} /> Edit Party Info
                  </button>

                  <button 
                    onClick={() => { setIsOptionsOpen(false); setShowAuditTrail(!showAuditTrail); }}
                    className="btn-secondary" 
                    style={{ justifyContent: 'flex-start', padding: '0.6rem 0.85rem', border: 'none', borderRadius: '10px', fontSize: '0.825rem', color: 'var(--color-cyan)' }}
                  >
                    <History size={16} /> {showAuditTrail ? 'Hide Activity Log' : 'View Activity Log'}
                  </button>

                  {!isStaff ? (
                    <button 
                      onClick={() => handleDeleteCurrentParty(activeSelectedParty.id, activeSelectedParty.name)}
                      className="btn-secondary" 
                      style={{ justifyContent: 'flex-start', padding: '0.6rem 0.85rem', border: 'none', borderRadius: '10px', fontSize: '0.825rem', color: 'var(--color-rose)' }}
                    >
                      <Trash2 size={16} /> Archive / Delete Party
                    </button>
                  ) : (
                    <div style={{ padding: '0.5rem 0.85rem', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Lock size={12} /> Staff Cannot Delete
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Party Details Card */}
          <div className="glass-card" style={{ padding: '1.25rem', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: activeSelectedParty.type === 'CUSTOMER' ? 'linear-gradient(135deg, #4F46E5, #818CF8)' : 'linear-gradient(135deg, #F59E0B, #FBBF24)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '900',
                fontSize: '1.5rem'
              }}>
                {activeSelectedParty.name.charAt(0).toUpperCase()}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: '900', color: 'var(--text-main)', margin: 0 }}>{activeSelectedParty.name}</h2>
                  <span className={`badge ${activeSelectedParty.type === 'CUSTOMER' ? 'badge-cyan' : 'badge-amber'}`} style={{ fontSize: '0.7rem' }}>
                    {activeSelectedParty.type}
                  </span>
                </div>

                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
                  {activeSelectedParty.phone && <span><Phone size={12} style={{ display: 'inline', marginRight: '3px' }} />{activeSelectedParty.phone}</span>}
                  {activeSelectedParty.email && <span><Mail size={12} style={{ display: 'inline', marginRight: '3px' }} />{activeSelectedParty.email}</span>}
                  {activeSelectedParty.address && <span><MapPin size={12} style={{ display: 'inline', marginRight: '3px' }} />{activeSelectedParty.address}</span>}
                </div>
              </div>
            </div>

            {/* Net Balance Status */}
            <div style={{ padding: '0.85rem 1rem', background: 'var(--bg-canvas)', borderRadius: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.825rem', color: 'var(--text-muted)', fontWeight: '700' }}>Running Net Balance</span>
              <span className="font-mono" style={{ fontSize: '1.2rem', fontWeight: '900', color: activeSelectedParty.current_balance > 0 ? 'var(--color-emerald)' : activeSelectedParty.current_balance < 0 ? 'var(--color-rose)' : 'var(--text-muted)' }}>
                {activeSelectedParty.current_balance > 0 ? `+${formatCurrency(activeSelectedParty.current_balance)} (You Get)` : activeSelectedParty.current_balance < 0 ? `-${formatCurrency(Math.abs(activeSelectedParty.current_balance))} (You Give)` : 'Settled ₹0.00'}
              </span>
            </div>

            {/* Action Buttons: You Gave / You Got */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <button
                onClick={() => openTransactionModal(activeSelectedParty, 'GAVE')}
                className="btn-rose"
                style={{ padding: '0.85rem 0.5rem', justifyContent: 'center', fontSize: '0.875rem', fontWeight: '900', borderRadius: '14px' }}
              >
                <MinusCircle size={18} /> {t('youGaveDebit')}
              </button>
              <button
                onClick={() => openTransactionModal(activeSelectedParty, 'GOT')}
                className="btn-emerald"
                style={{ padding: '0.85rem 0.5rem', justifyContent: 'center', fontSize: '0.875rem', fontWeight: '900', borderRadius: '14px' }}
              >
                <PlusCircle size={18} /> {t('youGotCredit')}
              </button>
            </div>
          </div>

          {/* AUDIT TRAIL / ACTIVITY LOG PANEL */}
          {showAuditTrail && (
            <div className="glass-card" style={{ padding: '1.25rem', borderRadius: '20px' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: '900', color: 'var(--color-cyan)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <History size={16} /> Activity Log & Audit Trail ({partyTimelineWithBalances.length} Entries)
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', maxHeight: '250px', overflowY: 'auto' }}>
                {partyTimelineWithBalances.map(tx => (
                  <div key={tx.id} style={{ fontSize: '0.75rem', padding: '0.6rem 0.85rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', marginBottom: '2px' }}>
                      <span>{tx.created_by_name || 'System User'} • {tx.type} ₹{tx.amount}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{new Date(tx.date).toLocaleDateString('en-IN')}</span>
                    </div>
                    {tx.gst_amount > 0 && (
                      <div style={{ color: 'var(--color-amber)' }}>GST Tax Included: ₹{tx.gst_amount}</div>
                    )}
                    {Array.isArray(tx.audit_log) && tx.audit_log.map((log, idx) => (
                      <div key={idx} style={{ color: 'var(--text-dim)', fontSize: '0.7rem', marginTop: '2px' }}>
                        • {log.action}: {log.details} by {log.userName} ({log.userRole})
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Statement Timeline List with Running Balances */}
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.65rem' }}>
              {t('statementTimeline')} ({partyTimelineWithBalances.length})
            </div>

            {partyTimelineWithBalances.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {partyTimelineWithBalances.slice().reverse().map(tx => (
                  <div 
                    key={tx.id} 
                    className="glass-card" 
                    style={{ 
                      padding: '0.95rem 1.1rem', 
                      borderRadius: '16px', 
                      display: 'flex', 
                      alignItems: 'center',
                      justifyContent: 'space-between', 
                      cursor: 'pointer' 
                    }}
                    onClick={() => openEditTransactionModal(tx)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '12px',
                        background: tx.type === 'GOT' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {tx.type === 'GOT' ? <ArrowDownLeft size={20} color="var(--color-emerald)" /> : <ArrowUpRight size={20} color="var(--color-rose)" />}
                      </div>

                      <div>
                        <div style={{ fontSize: '0.9rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-main)' }}>
                          {tx.notes || (tx.type === 'GOT' ? 'Payment Received' : 'Credit Extended')}
                          <span className="badge badge-purple" style={{ fontSize: '0.65rem' }}>{tx.category || 'General'}</span>
                          {tx.gst_amount > 0 && <span className="badge badge-amber" style={{ fontSize: '0.65rem' }}>GST ₹{tx.gst_amount}</span>}
                        </div>
                        <div style={{ fontSize: '0.725rem', color: 'var(--text-dim)' }}>
                          {new Date(tx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} • {tx.payment_mode || 'CASH'}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px', fontWeight: '600' }}>
                          Bal after tx: <span className="font-mono" style={{ color: tx.runningBalance >= 0 ? 'var(--color-emerald)' : 'var(--color-rose)' }}>{formatCurrency(tx.runningBalance)}</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div className="font-mono" style={{
                          fontSize: '1.05rem',
                          fontWeight: '900',
                          color: tx.type === 'GOT' ? 'var(--color-emerald)' : 'var(--color-rose)'
                        }}>
                          {tx.type === 'GOT' ? `+${formatCurrency(tx.amount)}` : `-${formatCurrency(tx.amount)}`}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditTransactionModal(tx);
                          }}
                          className="btn-secondary"
                          style={{ padding: '0.35rem', borderRadius: '8px' }}
                        >
                          <Edit3 size={14} />
                        </button>
                        {!isStaff && (
                          <button
                            onClick={(e) => handleDeleteTx(e, tx)}
                            className="btn-secondary"
                            style={{ padding: '0.35rem', borderRadius: '8px', color: 'var(--color-rose)' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', borderRadius: '18px' }}>
                No transaction entries found for {activeSelectedParty.name}.
              </div>
            )}
          </div>

        </div>
      )}

      {/* SINGLE PARTY CREATE/EDIT MODAL */}
      {isAddPartyModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', padding: '1.5rem', borderRadius: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: '900', margin: 0, color: 'var(--text-main)' }}>
                {editingPartyId ? 'Edit Party Details' : 'Add New Party / Account'}
              </h3>
              <button onClick={() => setIsAddPartyModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleCreateOrUpdatePartySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Party Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ram Kumar or Shyam Traders"
                  value={newPartyName}
                  onChange={(e) => setNewPartyName(e.target.value)}
                  className="input-field"
                  style={{ minHeight: '48px', borderRadius: '12px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Phone Number</label>
                  <input
                    type="text"
                    placeholder="+91 9876543210"
                    value={newPartyPhone}
                    onChange={(e) => setNewPartyPhone(e.target.value)}
                    className="input-field"
                    style={{ minHeight: '48px', borderRadius: '12px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Party Type</label>
                  <select
                    value={newPartyType}
                    onChange={(e) => setNewPartyType(e.target.value)}
                    className="input-field"
                    style={{ minHeight: '48px', borderRadius: '12px' }}
                  >
                    <option value="CUSTOMER">Customer</option>
                    <option value="SUPPLIER">Supplier</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Email Address</label>
                <input
                  type="email"
                  placeholder="party@example.com"
                  value={newPartyEmail}
                  onChange={(e) => setNewPartyEmail(e.target.value)}
                  className="input-field"
                  style={{ minHeight: '48px', borderRadius: '12px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Location / Address</label>
                <input
                  type="text"
                  placeholder="e.g. Shop #12, Market Yard"
                  value={newPartyAddress}
                  onChange={(e) => setNewPartyAddress(e.target.value)}
                  className="input-field"
                  style={{ minHeight: '48px', borderRadius: '12px' }}
                />
              </div>

              {!editingPartyId && (
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Opening Balance (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={newPartyOpeningBal}
                    onChange={(e) => setNewPartyOpeningBal(e.target.value)}
                    className="input-field font-mono"
                    style={{ minHeight: '48px', borderRadius: '12px' }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setIsAddPartyModalOpen(false)} className="btn-secondary" style={{ flex: 1, minHeight: '48px', borderRadius: '14px' }}>Cancel</button>
                <button type="submit" disabled={isSubmittingParty} className="btn-primary" style={{ flex: 1, minHeight: '48px', borderRadius: '14px', fontWeight: '800', justifyContent: 'center' }}>
                  {isSubmittingParty ? 'Saving...' : editingPartyId ? 'Update Party' : 'Save Party'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BULK MULTI-PARTY MODAL */}
      {isBulkModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem', borderRadius: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '900', margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Zap size={20} color="var(--color-cyan)" /> Bulk Multi-Party Onboarding
                </h3>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Quickly create Ram, Shyam, and multiple suppliers in one batch</div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={handleLoadSampleBatch} className="btn-secondary" style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}>
                  Load Sample Batch
                </button>
                <button onClick={() => setIsBulkModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)' }}>
                  <X size={20} />
                </button>
              </div>
            </div>

            <form onSubmit={handleBulkSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {bulkRows.map((row, idx) => (
                <div key={idx} style={{ padding: '0.85rem', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--color-cyan)' }}>Party #{idx + 1}</span>
                    {bulkRows.length > 1 && (
                      <button type="button" onClick={() => handleRemoveBulkRow(idx)} style={{ background: 'transparent', border: 'none', color: 'var(--color-rose)', cursor: 'pointer' }}>
                        <X size={16} />
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 0.8fr', gap: '0.5rem' }}>
                    <input
                      type="text"
                      placeholder="Name (e.g. Ram Kumar) *"
                      value={row.name}
                      onChange={e => handleUpdateBulkRow(idx, 'name', e.target.value)}
                      className="input-field"
                      style={{ fontSize: '0.85rem' }}
                    />
                    <input
                      type="text"
                      placeholder="Phone (+91...)"
                      value={row.phone}
                      onChange={e => handleUpdateBulkRow(idx, 'phone', e.target.value)}
                      className="input-field"
                      style={{ fontSize: '0.85rem' }}
                    />
                    <input
                      type="text"
                      placeholder="Location / Address"
                      value={row.location}
                      onChange={e => handleUpdateBulkRow(idx, 'location', e.target.value)}
                      className="input-field"
                      style={{ fontSize: '0.85rem' }}
                    />
                    <select
                      value={row.type}
                      onChange={e => handleUpdateBulkRow(idx, 'type', e.target.value)}
                      className="input-field"
                      style={{ fontSize: '0.85rem' }}
                    >
                      <option value="CUSTOMER">Customer</option>
                      <option value="SUPPLIER">Supplier</option>
                    </select>
                  </div>
                </div>
              ))}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                <button type="button" onClick={handleAddBulkRow} className="btn-secondary" style={{ fontSize: '0.8rem', padding: '0.5rem 0.85rem' }}>
                  + Add Another Row
                </button>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" onClick={() => setIsBulkModalOpen(false)} className="btn-secondary" style={{ fontSize: '0.85rem' }}>Cancel</button>
                  <button type="submit" disabled={isSubmittingBulk} className="btn-primary" style={{ fontSize: '0.85rem', padding: '0.5rem 1.25rem', fontWeight: '800' }}>
                    {isSubmittingBulk ? 'Creating Batch...' : 'Save All Parties'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
