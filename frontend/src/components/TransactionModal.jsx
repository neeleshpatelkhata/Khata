import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useLedgerStore, getSavedCategories, saveCustomCategory } from '../store/ledgerStore';
import { useSyncStore } from '../store/syncStore';
import { 
  X, 
  PlusCircle, 
  MinusCircle, 
  Paperclip,
  Trash2,
  UserPlus
} from 'lucide-react';

export default function TransactionModal() {
  const { currentWorkspace, user } = useAuthStore();
  const { 
    isTransactionModalOpen, 
    transactionModalParty, 
    transactionModalDefaultType, 
    editingTransaction,
    closeTransactionModal,
    parties,
    createParty,
    addTransaction,
    updateTransaction
  } = useLedgerStore();

  const { isOnline, queueOutboxItem } = useSyncStore();

  const [txType, setTxType] = useState('GAVE');
  const [selectedPartyId, setSelectedPartyId] = useState('');
  const [newPartyName, setNewPartyName] = useState('');
  const [amount, setAmount] = useState('');
  const [gstAmount, setGstAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [category, setCategory] = useState('General');
  const [notes, setNotes] = useState('');
  const [fileAttachment, setFileAttachment] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const savedCategoryOptions = getSavedCategories();

  useEffect(() => {
    setFormError('');
    if (editingTransaction) {
      setTxType(editingTransaction.type || 'GAVE');
      setSelectedPartyId(editingTransaction.party_id || '');
      setAmount(editingTransaction.amount ? String(editingTransaction.amount) : '');
      setGstAmount(editingTransaction.gst_amount ? String(editingTransaction.gst_amount) : '');
      setPaymentMode(editingTransaction.payment_mode || 'CASH');
      setCategory(editingTransaction.category || 'General');
      setNotes(editingTransaction.notes || '');
      setNewPartyName('');
    } else {
      setTxType(transactionModalDefaultType || 'GAVE');
      if (transactionModalParty) {
        setSelectedPartyId(transactionModalParty.id);
        setNewPartyName('');
      } else if (parties.length > 0) {
        setSelectedPartyId(parties[0].id);
        setNewPartyName('');
      } else {
        setSelectedPartyId('new');
      }
      setAmount('');
      setGstAmount('');
      setPaymentMode('CASH');
      setCategory('General');
      setNotes('');
    }
  }, [editingTransaction, transactionModalParty, transactionModalDefaultType, isTransactionModalOpen, parties]);

  if (!isTransactionModalOpen) return null;

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFileAttachment(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    // Validation 1: Anti-double submit guard
    if (isSubmitting) return;

    // Validation 2: Amount must be positive
    const numAmount = Number(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      setFormError('Transaction Amount must be a valid positive number greater than 0.');
      return;
    }

    // Validation 3: Party selection required
    let targetPartyId = selectedPartyId;
    if (targetPartyId === 'new' || (!targetPartyId && newPartyName.trim())) {
      if (!newPartyName.trim()) {
        setFormError('Please enter a valid Party Name.');
        return;
      }
    } else if (!targetPartyId) {
      setFormError('Please select a Party before saving.');
      return;
    }

    setIsSubmitting(true);
    const wsId = currentWorkspace?.id || 'ws_local_default';

    try {
      if (targetPartyId === 'new' || (!targetPartyId && newPartyName.trim())) {
        const createdParty = await createParty(wsId, {
          name: newPartyName.trim(),
          type: txType === 'GAVE' ? 'CUSTOMER' : 'SUPPLIER'
        });
        targetPartyId = createdParty ? createdParty.id : `party_local_${Date.now()}`;
      }

      const finalCat = category.trim() || 'General';
      saveCustomCategory(finalCat);

      const currentUserPayload = {
        name: user?.name || 'Enterprise User',
        role: user?.role || 'OWNER'
      };

      const txData = {
        partyId: targetPartyId,
        type: txType,
        amount: numAmount,
        gstAmount: Number(gstAmount || 0),
        paymentMode,
        category: finalCat,
        notes,
        date: editingTransaction ? editingTransaction.date : new Date().toISOString()
      };

      if (editingTransaction) {
        await updateTransaction(wsId, editingTransaction.id, txData, currentUserPayload);
      } else {
        // The entry always lands in the local ledger first, online or not.
        // Offline it is additionally queued so the server catches up later.
        await addTransaction(wsId, txData, fileAttachment, currentUserPayload);
        if (!isOnline) {
          const targetParty = parties.find(p => String(p.id) === String(targetPartyId));
          queueOutboxItem('TRANSACTION', {
            ...txData,
            partyName: targetParty ? targetParty.name : (newPartyName || 'Party')
          });
        }
      }

      closeTransactionModal();
      setAmount('');
      setGstAmount('');
      setNotes('');
      setNewPartyName('');
      setFileAttachment(null);
    } catch (err) {
      setFormError(err.message || 'Failed to save transaction.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1100,
      padding: '1rem'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '520px',
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '1.5rem',
        borderRadius: '24px'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: txType === 'GOT' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {txType === 'GOT' ? <PlusCircle size={20} color="var(--color-emerald)" /> : <MinusCircle size={20} color="var(--color-rose)" />}
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
              {editingTransaction ? 'Edit Ledger Entry' : `Record ${txType === 'GOT' ? 'Cash Received (Credit ₹)' : 'Cash Given (Debit ₹)'}`}
            </h3>
          </div>

          <button onClick={closeTransactionModal} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Form Error Banner */}
        {formError && (
          <div style={{
            background: 'rgba(244, 63, 94, 0.15)',
            border: '1px solid var(--color-rose)',
            color: 'var(--color-rose)',
            padding: '0.75rem 1rem',
            borderRadius: '12px',
            fontSize: '0.85rem',
            fontWeight: '700',
            marginBottom: '1rem'
          }}>
            ⚠️ {formError}
          </div>
        )}

        {/* Toggle Type buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
          <button
            type="button"
            onClick={() => setTxType('GAVE')}
            className={txType === 'GAVE' ? 'btn-rose' : 'btn-secondary'}
            style={{ flex: 1, justifyContent: 'center' }}
          >
            <MinusCircle size={16} /> You Gave (Debit ₹)
          </button>
          <button
            type="button"
            onClick={() => setTxType('GOT')}
            className={txType === 'GOT' ? 'btn-emerald' : 'btn-secondary'}
            style={{ flex: 1, justifyContent: 'center' }}
          >
            <PlusCircle size={16} /> You Got (Credit ₹)
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* Select Party */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Select Party *</label>
              <button
                type="button"
                onClick={() => setSelectedPartyId('new')}
                style={{ background: 'transparent', border: 'none', color: 'var(--color-cyan)', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
              >
                <UserPlus size={12} /> + Enter New Name
              </button>
            </div>

            <select
              value={selectedPartyId}
              onChange={(e) => setSelectedPartyId(e.target.value)}
              className="input-field"
              style={{ minHeight: '48px', borderRadius: '12px' }}
            >
              {parties.filter(p => !p.is_deleted).map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.type}) — Bal: ₹{p.current_balance || 0}
                </option>
              ))}
              <option value="new">+ Add New Party / Enter Name...</option>
            </select>

            {(selectedPartyId === 'new' || parties.length === 0) && (
              <div style={{ marginTop: '0.65rem' }}>
                <label style={{ fontSize: '0.775rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                  Party / Customer Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ram Kumar or Shyam Traders"
                  value={newPartyName}
                  onChange={(e) => setNewPartyName(e.target.value)}
                  className="input-field"
                  style={{ minHeight: '46px', borderRadius: '12px' }}
                />
              </div>
            )}
          </div>

          {/* Total Amount & Itemized GST Input */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Total Amount (₹) *</label>
              <input
                type="number"
                required
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="input-field font-mono"
                style={{ fontSize: '1.25rem', fontWeight: '700', minHeight: '48px', borderRadius: '12px', color: txType === 'GOT' ? 'var(--color-emerald)' : 'var(--color-rose)' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>GST / Tax (₹) (Optional)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={gstAmount}
                onChange={(e) => setGstAmount(e.target.value)}
                className="input-field font-mono"
                style={{ fontSize: '1.1rem', fontWeight: '600', minHeight: '48px', borderRadius: '12px' }}
              />
            </div>
          </div>

          {/* Base Amount Preview */}
          {Number(gstAmount) > 0 && Number(amount) > 0 && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)', padding: '0.5rem 0.75rem', borderRadius: '8px' }}>
              Base Amount: <strong>₹{(Number(amount) - Number(gstAmount)).toFixed(2)}</strong> + GST Tax: <strong>₹{Number(gstAmount).toFixed(2)}</strong> = Total <strong>₹{Number(amount).toFixed(2)}</strong>
            </div>
          )}

          {/* Payment Mode & Editable Category Combobox */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Payment Mode</label>
              <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} className="input-field" style={{ minHeight: '48px', borderRadius: '12px' }}>
                <option value="CASH">Cash</option>
                <option value="UPI">UPI / GPay / PhonePe</option>
                <option value="BANK_TRANSFER">Bank Transfer (NEFT/IMPS)</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Category (Editable)</label>
              <input
                type="text"
                list="tx-modal-category-suggestions"
                placeholder="e.g. Salary, Rent, Petrol..."
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="input-field"
                style={{ minHeight: '48px', borderRadius: '12px' }}
              />
              <datalist id="tx-modal-category-suggestions">
                {savedCategoryOptions.map(cat => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Quick Category Chips */}
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {savedCategoryOptions.slice(0, 6).map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className="btn-secondary"
                style={{
                  padding: '0.2rem 0.55rem',
                  fontSize: '0.7rem',
                  borderRadius: '8px',
                  background: category === cat ? 'rgba(79, 70, 229, 0.25)' : undefined,
                  borderColor: category === cat ? 'var(--color-purple)' : undefined
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Notes */}
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Notes / Description</label>
            <input
              type="text"
              placeholder="e.g. Bill #4092 payment"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input-field"
              style={{ minHeight: '48px', borderRadius: '12px' }}
            />
          </div>

          {/* Attachment */}
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Attach Bill / Receipt Photo</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <label className="btn-secondary" style={{ flex: 1, cursor: 'pointer', justifyContent: 'center', minHeight: '44px', borderRadius: '12px' }}>
                <Paperclip size={16} /> {fileAttachment ? fileAttachment.name : 'Choose File'}
                <input type="file" accept="image/*,application/pdf" onChange={handleFileChange} style={{ display: 'none' }} />
              </label>
              {fileAttachment && (
                <button
                  type="button"
                  onClick={() => setFileAttachment(null)}
                  className="btn-secondary"
                  style={{ color: 'var(--color-rose)', padding: '0.65rem' }}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button type="button" onClick={closeTransactionModal} className="btn-secondary" style={{ flex: 1, minHeight: '48px', borderRadius: '14px' }}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={txType === 'GOT' ? 'btn-emerald' : 'btn-rose'}
              style={{ flex: 1, justifyContent: 'center', minHeight: '48px', borderRadius: '14px', fontWeight: '800' }}
            >
              {isSubmitting ? 'Saving...' : editingTransaction ? 'Update Entry' : 'Save Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
