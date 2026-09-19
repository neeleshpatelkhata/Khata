import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { 
  X, 
  User, 
  Phone, 
  Mail, 
  Building2, 
  MapPin, 
  ShieldCheck, 
  Camera, 
  CheckCircle2, 
  LogOut,
  Briefcase,
  FileText
} from 'lucide-react';

export default function UserProfileModal({ isOpen, onClose }) {
  const { user, updateProfile, logout } = useAuthStore();
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    avatarUrl: '',
    role: 'ACCOUNTANT',
    businessName: '',
    address: '',
    gstin: '',
    currency: 'INR'
  });

  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        phone: user.phone || '+91 9876543210',
        email: user.email || '',
        avatarUrl: user.avatarUrl || '',
        role: user.role || 'Enterprise Lead Accountant',
        businessName: user.businessName || 'Khata Financial Enterprise',
        address: user.address || '7th Floor, Cyber Towers, Tech City',
        gstin: user.gstin || '07AAAAA0000A1Z5',
        currency: user.currency || 'INR'
      });
    }
  }, [user, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    updateProfile(formData);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, avatarUrl: reader.result }));
      };
      reader.readAsDataURL(file);
    }
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
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      padding: '1rem'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '520px',
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '1.75rem',
        boxShadow: '0 20px 40px rgba(0,0,0,0.8), 0 0 30px rgba(99, 102, 241, 0.25)',
        position: 'relative',
        borderRadius: '24px'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#F87171'
            }}>
              <User size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: '800' }}>User Profile & Work Settings</h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Manage account details, business profile, and avatar</p>
            </div>
          </div>

          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem' }}>
            <X size={20} />
          </button>
        </div>

        {savedSuccess && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid var(--color-emerald)',
            color: 'var(--color-emerald)',
            padding: '0.75rem 1rem',
            borderRadius: '12px',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.85rem',
            fontWeight: '700'
          }}>
            <CheckCircle2 size={18} /> Profile details saved successfully!
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Avatar Section */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ position: 'relative' }}>
              {formData.avatarUrl ? (
                <img 
                  src={formData.avatarUrl} 
                  alt="Profile Avatar" 
                  style={{ width: '68px', height: '68px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--color-purple)' }}
                />
              ) : (
                <div style={{
                  width: '68px',
                  height: '68px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #F87171, #EF4444)',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.75rem',
                  fontWeight: '800',
                  boxShadow: '0 4px 16px rgba(239, 68, 68, 0.4)'
                }}>
                  {formData.name ? formData.name.charAt(0).toUpperCase() : 'A'}
                </div>
              )}

              <label htmlFor="avatar-upload" style={{
                position: 'absolute',
                bottom: '-4px',
                right: '-4px',
                background: 'var(--color-purple-40)',
                color: '#FFF',
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                border: '2px solid var(--bg-surface)'
              }}>
                <Camera size={14} />
              </label>
              <input id="avatar-upload" type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} />
            </div>

            <div>
              <div style={{ fontSize: '1rem', fontWeight: '800' }}>{formData.name || 'Account User'}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formData.role}</div>
              <span className="badge badge-emerald" style={{ marginTop: '0.35rem', fontSize: '0.65rem' }}>
                <ShieldCheck size={12} /> Verified Account
              </span>
            </div>
          </div>

          {/* Personal Information */}
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--color-deep-purple)', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>
              Personal Details
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Full Name</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="input-field"
                    placeholder="Enter your name"
                    style={{ paddingLeft: '2.4rem' }}
                  />
                  <User size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Phone Number</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                      className="input-field"
                      placeholder="+91 9876543210"
                      style={{ paddingLeft: '2.4rem' }}
                    />
                    <Phone size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Email Address</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      className="input-field"
                      placeholder="user@khata.pro"
                      style={{ paddingLeft: '2.4rem' }}
                    />
                    <Mail size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Business & Work Profile */}
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--color-deep-purple)', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>
              Work & Business Profile
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Business / Firm Name</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={formData.businessName}
                    onChange={e => setFormData({ ...formData, businessName: e.target.value })}
                    className="input-field"
                    placeholder="Khata Enterprise Ltd"
                    style={{ paddingLeft: '2.4rem' }}
                  />
                  <Building2 size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>GSTIN / Tax ID</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      value={formData.gstin}
                      onChange={e => setFormData({ ...formData, gstin: e.target.value })}
                      className="input-field"
                      placeholder="07AAAAA0000A1Z5"
                      style={{ paddingLeft: '2.4rem' }}
                    />
                    <FileText size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Role</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      value={formData.role}
                      onChange={e => setFormData({ ...formData, role: e.target.value })}
                      className="input-field"
                      placeholder="Lead Accountant"
                      style={{ paddingLeft: '2.4rem' }}
                    />
                    <Briefcase size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                  </div>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Business Address</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                    className="input-field"
                    placeholder="Corporate office address"
                    style={{ paddingLeft: '2.4rem' }}
                  />
                  <MapPin size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              type="submit"
              className="btn-primary"
              style={{ flex: 1, justifyContent: 'center', background: 'linear-gradient(135deg, #4F46E5, #818CF8)' }}
            >
              Save Profile Changes
            </button>

            <button
              type="button"
              onClick={() => {
                logout();
                onClose();
              }}
              className="btn-secondary"
              style={{ color: 'var(--color-rose)', borderColor: 'rgba(244,63,94,0.3)' }}
              title="Sign Out"
            >
              <LogOut size={16} /> Logout
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
