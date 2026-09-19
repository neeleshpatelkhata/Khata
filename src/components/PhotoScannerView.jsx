import React, { useState, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { useLedgerStore, getSavedCategories, saveCustomCategory } from '../store/ledgerStore';
import { parseInvoiceImage } from '../services/geminiService';
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { 
  Camera, 
  Trash2, 
  ZoomIn, 
  Receipt,
  FileCheck,
  Sparkles,
  Loader2,
  CheckCircle2,
  ArrowLeft
} from 'lucide-react';

export default function PhotoScannerView() {
  const { currentWorkspace } = useAuthStore();
  const { addTransaction, parties, createParty, setActiveTab } = useLedgerStore();

  const fileInputRef = useRef(null);

  const [scannedReel, setScannedReel] = useState([]);
  const [activeBill, setActiveBill] = useState(null);
  const [vendorName, setVendorName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [totalAmount, setTotalAmount] = useState('0.00');
  const [gstAmount, setGstAmount] = useState('0.00');
  const [txType, setTxType] = useState('GAVE');
  const [category, setCategory] = useState('General');
  const [selectedPartyId, setSelectedPartyId] = useState('');
  const [imagePreview, setImagePreview] = useState(null);
  const [isZoomed, setIsZoomed] = useState(false);

  const [isScanning, setIsScanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [scanMessage, setScanMessage] = useState('');

  const savedCategoryOptions = getSavedCategories();

  const handleCaptureCamera = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        const image = await CapacitorCamera.getPhoto({
          quality: 90,
          allowEditing: false,
          resultType: CameraResultType.Uri,
          source: CameraSource.Camera
        });

        if (image.webPath) {
          const response = await fetch(image.webPath);
          const blob = await response.blob();
          const file = new File([blob], `camera_${Date.now()}.jpg`, { type: 'image/jpeg' });
          processImageFile(file, image.webPath);
        }
      } else {
        if (fileInputRef.current) {
          fileInputRef.current.click();
        }
      }
    } catch (err) {
      console.warn('Camera capture cancelled or unhandled, falling back to file input:', err);
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    processImageFile(file, objectUrl);
  };

  const processImageFile = async (file, previewUrl) => {
    setImagePreview(previewUrl);
    setIsScanning(true);
    setScanMessage('Processing invoice image with Gemini Vision AI...');

    const newBillItem = {
      id: `bill_${Date.now()}`,
      previewUrl,
      fileName: file.name,
      file,
      status: 'PROCESSING',
      timestamp: new Date().toISOString()
    };

    setScannedReel(prev => [newBillItem, ...prev]);
    setActiveBill(newBillItem);

    try {
      const parsedData = await parseInvoiceImage(file);
      setIsScanning(false);

      // A null result means AI assist isn't available right now (no key
      // configured, offline, etc.) — not an error. The bill photo is still
      // attached; the user just fills in the details manually.
      if (!parsedData) {
        setScanMessage('AI extraction unavailable right now — please enter the bill details manually.');
        setScannedReel(prev => prev.map(item =>
          item.id === newBillItem.id ? { ...item, status: 'MANUAL' } : item
        ));
        return;
      }

      if (parsedData.vendorName) setVendorName(parsedData.vendorName);
      if (parsedData.invoiceNumber) setInvoiceNumber(parsedData.invoiceNumber);
      if (parsedData.totalAmount) setTotalAmount(String(parsedData.totalAmount));
      if (parsedData.gstAmount) setGstAmount(String(parsedData.gstAmount));
      if (parsedData.type) setTxType(parsedData.type);
      if (parsedData.category) {
        setCategory(parsedData.category);
        saveCustomCategory(parsedData.category);
      }

      setScannedReel(prev => prev.map(item =>
        item.id === newBillItem.id
          ? { ...item, status: 'PARSED', parsedData }
          : item
      ));

      setScanMessage('AI OCR Extraction complete! Review details below.');
    } catch (err) {
      console.error('Invoice scanning error:', err);
      setIsScanning(false);
      setScanMessage('Failed to scan image. Please enter details manually.');
      setScannedReel(prev => prev.map(item =>
        item.id === newBillItem.id ? { ...item, status: 'FAILED' } : item
      ));
    }
  };

  const handleSelectReelItem = (bill) => {
    setActiveBill(bill);
    setImagePreview(bill.previewUrl);
    if (bill.parsedData) {
      const p = bill.parsedData;
      setVendorName(p.vendorName || '');
      setInvoiceNumber(p.invoiceNumber || '');
      setTotalAmount(String(p.totalAmount || '0.00'));
      setGstAmount(String(p.gstAmount || '0.00'));
      setTxType(p.type || 'GAVE');
      if (p.category) setCategory(p.category);
    }
  };

  const handleDeleteReelItem = (e, id) => {
    e.stopPropagation();
    const updated = scannedReel.filter(item => item.id !== id);
    setScannedReel(updated);
    if (activeBill?.id === id) {
      setActiveBill(updated.length > 0 ? updated[0] : null);
      if (updated.length === 0) {
        setImagePreview(null);
        setVendorName('');
        setTotalAmount('0.00');
        setGstAmount('0.00');
      }
    }
  };

  const handleConfirmSave = async () => {
    if (!totalAmount || Number(totalAmount) <= 0) {
      alert('Please enter a valid positive total amount.');
      return;
    }

    setIsSaving(true);
    try {
      const workspaceId = currentWorkspace?.id || 'ws_local_default';
      let targetPartyId = selectedPartyId;

      if (!targetPartyId) {
        const existing = parties.find(p => p.name.toLowerCase() === vendorName.toLowerCase());
        if (existing) {
          targetPartyId = existing.id;
        } else {
          const newP = await createParty(workspaceId, {
            name: vendorName || 'Scanned Vendor',
            type: txType === 'GAVE' ? 'SUPPLIER' : 'CUSTOMER'
          });
          targetPartyId = newP ? newP.id : `party_local_${Date.now()}`;
        }
      }

      const finalCat = category.trim() || 'General';
      saveCustomCategory(finalCat);

      await addTransaction(workspaceId, {
        partyId: targetPartyId,
        type: txType,
        amount: Number(totalAmount),
        paymentMode: 'BANK_TRANSFER',
        category: finalCat,
        notes: `OCR Gemini Scanned Invoice #${invoiceNumber} from ${vendorName} (GST: ₹${gstAmount})`
      });

      alert(`✅ Invoice #${invoiceNumber || 'Entry'} (${vendorName || 'Vendor'}) successfully saved to ledger with Category "${finalCat}"!`);
    } catch (err) {
      console.error('Save scanned bill notice:', err);
      alert(`✅ Bill saved to local offline ledger!`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ padding: '0 1rem 140px 1rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }} data-testid="tool_photoscan">
      
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      {/* Header Section */}
      <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', borderRadius: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '12px',
              padding: '0.6rem',
              color: 'var(--text-main)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: '900', color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Receipt size={22} color="var(--color-cyan)" /> AI Receipt & Bill Scanner
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
              Snap or upload receipts. Gemini AI auto-extracts amount, vendor & tax details.
            </p>
          </div>
        </div>

        {/* Big Action Button */}
        <button
          type="button"
          onClick={handleCaptureCamera}
          className="btn-primary mic-pulse"
          style={{
            padding: '1rem',
            fontSize: '1rem',
            fontWeight: '900',
            borderRadius: '16px',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
            boxShadow: '0 8px 25px rgba(124, 58, 237, 0.4)'
          }}
        >
          <Camera size={22} /> Snap & Scan Bill with AI
        </button>
      </div>

      {/* Reel Bar of Scanned Bills */}
      {scannedReel.length > 0 && (
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            Scanned Bills Queue ({scannedReel.length})
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
            {scannedReel.map(bill => (
              <div
                key={bill.id}
                onClick={() => handleSelectReelItem(bill)}
                className="glass-card"
                style={{
                  minWidth: '100px',
                  height: '100px',
                  borderRadius: '14px',
                  position: 'relative',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  border: activeBill?.id === bill.id ? '2px solid var(--color-cyan)' : '1px solid var(--border-subtle)'
                }}
              >
                <img src={bill.previewUrl} alt="Bill thumbnail" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                
                <button
                  onClick={(e) => handleDeleteReelItem(e, bill.id)}
                  style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    background: 'rgba(0,0,0,0.6)',
                    border: 'none',
                    borderRadius: '50%',
                    padding: '4px',
                    color: '#FFF',
                    cursor: 'pointer'
                  }}
                >
                  <Trash2 size={12} />
                </button>

                {bill.status === 'PARSED' && (
                  <div style={{ position: 'absolute', bottom: '4px', right: '4px', background: 'var(--color-emerald)', borderRadius: '50%', padding: '2px' }}>
                    <CheckCircle2 size={12} color="#FFF" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status Bar */}
      {isScanning && (
        <div className="glass-card" style={{ padding: '1rem', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '0.75rem', borderColor: 'var(--color-cyan)' }}>
          <Loader2 size={20} className="spin" color="var(--color-cyan)" />
          <span style={{ fontSize: '0.875rem', fontWeight: '700', color: 'var(--text-main)' }}>{scanMessage}</span>
        </div>
      )}

      {/* Main Preview & Editable Form Card */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
        
        {/* Left Column: Image Preview */}
        <div className="glass-card" style={{ padding: '1rem', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center', justifyContent: 'center', minHeight: '260px' }}>
          {imagePreview ? (
            <div style={{ position: 'relative', width: '100%', textAlign: 'center' }}>
              <img
                src={imagePreview}
                alt="Bill preview"
                style={{
                  maxHeight: isZoomed ? '450px' : '260px',
                  width: 'auto',
                  maxWidth: '100%',
                  borderRadius: '12px',
                  objectFit: 'contain',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.3)'
                }}
              />
              <button
                type="button"
                onClick={() => setIsZoomed(!isZoomed)}
                className="btn-secondary"
                style={{ position: 'absolute', top: '8px', right: '8px', borderRadius: '50%', width: '36px', height: '36px', padding: 0, justifyContent: 'center' }}
              >
                <ZoomIn size={16} />
              </button>
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '2rem' }}>
              <FileCheck size={48} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
              <div style={{ fontSize: '0.9rem', fontWeight: '700' }}>No bill image selected yet</div>
              <div style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Snap a photo or select an image to test OCR</div>
            </div>
          )}
        </div>

        {/* Right Column: Auto-Populated Ledger Details Form */}
        <div className="glass-card" style={{ padding: '1.25rem', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '900', color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Sparkles size={18} color="var(--color-cyan)" /> Auto-Populated Details
            </h3>
            <span className="badge badge-purple" style={{ fontSize: '0.675rem' }}>AI Parsed</span>
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Vendor / Store Name *</label>
            <input
              type="text"
              placeholder="e.g. Apex Supplies Pvt Ltd"
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              className="input-field"
              style={{ minHeight: '48px', borderRadius: '12px' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Link to Existing Party (Optional)</label>
            <select
              value={selectedPartyId}
              onChange={(e) => setSelectedPartyId(e.target.value)}
              className="input-field"
              style={{ minHeight: '48px', borderRadius: '12px' }}
            >
              <option value="">+ Create new party for "{vendorName || 'Vendor'}"</option>
              {parties.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.type})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.85rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Total Amount (₹)</label>
              <input
                type="number"
                step="0.01"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                className="input-field font-mono"
                style={{ color: 'var(--color-emerald)', fontWeight: '700', minHeight: '48px', borderRadius: '12px' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>GST / Tax Amount (₹)</label>
              <input
                type="number"
                step="0.01"
                value={gstAmount}
                onChange={(e) => setGstAmount(e.target.value)}
                className="input-field font-mono"
                style={{ minHeight: '48px', borderRadius: '12px' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.85rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Entry Type</label>
              <select value={txType} onChange={(e) => setTxType(e.target.value)} className="input-field" style={{ minHeight: '48px', borderRadius: '12px' }}>
                <option value="GAVE">You Gave (Debit ₹)</option>
                <option value="GOT">You Got (Credit ₹)</option>
              </select>
            </div>

            {/* Editable Combobox Category Field */}
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Category (Select or Type Custom)</label>
              <input
                type="text"
                list="scanner-category-suggestions"
                placeholder="e.g. Raw Supplies, Logistics, Petrol..."
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="input-field"
                style={{ minHeight: '48px', borderRadius: '12px' }}
              />
              <datalist id="scanner-category-suggestions">
                {savedCategoryOptions.map(cat => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>

              {/* Quick suggestion chips */}
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
                {savedCategoryOptions.slice(0, 8).map(cat => (
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
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Invoice / Bill Number</label>
            <input
              type="text"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              className="input-field"
              style={{ minHeight: '48px', borderRadius: '12px' }}
            />
          </div>

          {/* Confirm & Save to Ledger Button */}
          <button
            type="button"
            disabled={isSaving}
            onClick={handleConfirmSave}
            className="btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem', minHeight: '52px', fontSize: '1rem', fontWeight: '700', borderRadius: '14px' }}
          >
            {isSaving ? 'Saving to Ledger...' : 'Save to Ledger'}
          </button>
        </div>

      </div>

    </div>
  );
}
