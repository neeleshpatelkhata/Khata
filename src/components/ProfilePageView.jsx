import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useLedgerStore } from '../store/ledgerStore';
import { usePreferencesStore } from '../store/preferencesStore';
import { 
  ArrowLeft, 
  User, 
  Mail, 
  Phone, 
  Briefcase, 
  Camera, 
  ShieldCheck, 
  CheckCircle2, 
  LogOut, 
  Save, 
  Building2, 
  Calendar, 
  Clock,
  Moon,
  Sun,
  Globe,
  Sliders,
  ShieldAlert,
  Lock
} from 'lucide-react';

export default function ProfilePageView({ onBack }) {
  const { user, currentWorkspace, updateProfile, setRole, logout } = useAuthStore();
  const { setActiveTab } = useLedgerStore();
  const { theme, lang, setTheme, setLang, t } = usePreferencesStore();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'OWNER',
    avatarUrl: ''
  });

  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || 'Apex Lead Accountant',
        email: user.email || 'owner@khata.pro',
        phone: user.phone || '+91 9876543210',
        role: user.role || 'OWNER',
        avatarUrl: user.avatarUrl || ''
      });
    }
  }, [user]);

  const handleAvatarUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, avatarUrl: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRoleToggle = (selectedRole) => {
    setFormData(prev => ({ ...prev, role: selectedRole }));
    setRole(selectedRole);
  };

  const handleSave = (e) => {
    e.preventDefault();
    updateProfile(formData);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
    }, 2500);
  };

  return (
    <div style={{
      padding: '1rem',
      maxWidth: '640px',
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '1.25rem',
      paddingBottom: '100px'
    }}>
      
      {/* Top Header Navigation Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
        <button
          onClick={() => {
            if (window.history.length > 1) {
              window.history.back();
            } else if (onBack) {
              onBack();
            } else {
              setActiveTab('dashboard');
            }
          }}
          className="btn-secondary"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.45rem 0.9rem',
            fontSize: '0.85rem',
            fontWeight: '700',
            borderRadius: '12px'
          }}
        >
          <ArrowLeft size={18} /> {t('backToDashboard')}
        </button>

        <span className="badge badge-purple" style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}>
          <ShieldCheck size={14} /> {t('profileSettings')}
        </span>
      </div>

      {/* Hero Avatar & Title Section */}
      <div className="glass-card" style={{
        padding: '1.75rem 1.5rem',
        borderRadius: '24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        position: 'relative',
        background: 'linear-gradient(180deg, rgba(79, 70, 229, 0.12) 0%, rgba(15, 23, 42, 0.6) 100%)',
        borderColor: 'rgba(99, 102, 241, 0.25)',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.3)'
      }}>
        {/* Profile Picture Container */}
        <div style={{ position: 'relative', marginBottom: '1rem' }}>
          {formData.avatarUrl ? (
            <img 
              src={formData.avatarUrl} 
              alt="User Avatar" 
              style={{
                width: '96px',
                height: '96px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '3px solid var(--color-purple-40)',
                boxShadow: '0 8px 24px rgba(79, 70, 229, 0.4)'
              }}
            />
          ) : (
            <div style={{
              width: '96px',
              height: '96px',
              borderRadius: '50%',
              background: formData.role === 'OWNER' ? 'linear-gradient(135deg, #4F46E5, #7C3AED)' : 'linear-gradient(135deg, #F59E0B, #FBBF24)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2.5rem',
              fontWeight: '900',
              boxShadow: '0 8px 24px rgba(79, 70, 229, 0.45)',
              border: '3px solid rgba(255, 255, 255, 0.2)'
            }}>
              {formData.name ? formData.name.charAt(0).toUpperCase() : 'A'}
            </div>
          )}

          <label 
            htmlFor="profile-pic-input"
            style={{
              position: 'absolute',
              bottom: '0',
              right: '0',
              background: 'var(--color-purple-40)',
              color: '#FFFFFF',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              border: '2px solid var(--bg-canvas)',
              boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
              transition: 'transform 0.15s ease'
            }}
            title="Change / Upload Profile Picture"
          >
            <Camera size={16} />
          </label>
          <input 
            id="profile-pic-input" 
            type="file" 
            accept="image/*" 
            onChange={handleAvatarUpload} 
            style={{ display: 'none' }} 
          />
        </div>

        <h2 style={{ fontSize: '1.4rem', fontWeight: '900', letterSpacing: '-0.5px', marginBottom: '0.25rem', color: 'var(--text-main)' }}>
          {formData.name || 'Apex Lead Accountant'}
        </h2>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
          <span className={`badge ${formData.role === 'OWNER' ? 'badge-purple' : 'badge-amber'}`} style={{ fontSize: '0.8rem', padding: '0.3rem 0.85rem' }}>
            {formData.role === 'OWNER' ? '👑 Workspace Owner (Full Access)' : '👤 Staff Accountant (Restricted Writes)'}
          </span>
        </div>

        <span className="badge badge-emerald" style={{ fontSize: '0.7rem' }}>
          <CheckCircle2 size={12} /> Active Workspace Locked to INR (₹)
        </span>
      </div>

      {savedSuccess && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid var(--color-emerald)',
          color: 'var(--color-emerald)',
          padding: '0.85rem 1.1rem',
          borderRadius: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          fontSize: '0.9rem',
          fontWeight: '700',
          boxShadow: '0 4px 14px rgba(16, 185, 129, 0.2)'
        }}>
          <CheckCircle2 size={20} /> Profile details saved successfully!
        </div>
      )}

      {/* ROLE SWITCHER SECTION */}
      <div className="glass-card" style={{ padding: '1.5rem', borderRadius: '20px' }}>
        <div style={{
          fontSize: '0.8rem',
          fontWeight: '800',
          textTransform: 'uppercase',
          color: 'var(--color-cyan)',
          marginBottom: '0.75rem',
          letterSpacing: '0.05em',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem'
        }}>
          <ShieldAlert size={16} /> User Role & Permissions (RBAC)
        </div>

        <p style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Select user access tier. <strong>Owner</strong> has full edit/delete privileges. <strong>Staff</strong> can add transactions & scan bills, but cannot delete records or edit entries older than 24 hours.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={() => handleRoleToggle('OWNER')}
            className={formData.role === 'OWNER' ? 'btn-primary' : 'btn-secondary'}
            style={{
              flexDirection: 'column',
              padding: '1rem',
              borderRadius: '16px',
              alignItems: 'flex-start',
              gap: '0.35rem'
            }}
          >
            <div style={{ fontWeight: '900', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              👑 Owner
            </div>
            <div style={{ fontSize: '0.7rem', opacity: 0.8, textAlign: 'left' }}>
              Full Control • Edit & Delete Any Record
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleRoleToggle('STAFF')}
            className={formData.role === 'STAFF' ? 'btn-primary' : 'btn-secondary'}
            style={{
              flexDirection: 'column',
              padding: '1rem',
              borderRadius: '16px',
              alignItems: 'flex-start',
              gap: '0.35rem',
              background: formData.role === 'STAFF' ? 'linear-gradient(135deg, #F59E0B, #D97706)' : undefined
            }}
          >
            <div style={{ fontWeight: '900', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              👤 Staff
            </div>
            <div style={{ fontSize: '0.7rem', opacity: 0.8, textAlign: 'left' }}>
              Restricted • No Delete • 24h Edit Limit
            </div>
          </button>
        </div>
      </div>

      {/* PREFERENCES & SETTINGS SECTION */}
      <div className="glass-card" style={{ padding: '1.5rem', borderRadius: '20px' }}>
        <div style={{
          fontSize: '0.8rem',
          fontWeight: '800',
          textTransform: 'uppercase',
          color: 'var(--color-purple)',
          marginBottom: '1.1rem',
          letterSpacing: '0.05em',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem'
        }}>
          <Sliders size={16} /> {t('preferences')}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Theme Row */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.85rem 1rem',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: '16px',
            border: '1px solid var(--border-subtle)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              {theme === 'dark' ? <Moon size={20} color="var(--color-purple-40)" /> : <Sun size={20} color="var(--color-amber)" />}
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: '800' }}>{t('themeSetting')}</div>
                <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                  {theme === 'dark' ? t('darkMode') : t('lightMode')}
                </div>
              </div>
            </div>

            <div style={{
              display: 'flex',
              background: 'var(--bg-canvas)',
              padding: '3px',
              borderRadius: '12px',
              border: '1px solid var(--border-subtle)'
            }}>
              <button
                onClick={() => setTheme('dark')}
                style={{
                  border: 'none',
                  background: theme === 'dark' ? 'var(--color-purple-40)' : 'transparent',
                  color: theme === 'dark' ? '#FFF' : 'var(--text-muted)',
                  padding: '0.4rem 0.75rem',
                  borderRadius: '9px',
                  fontSize: '0.775rem',
                  fontWeight: '800',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                <Moon size={13} /> {t('darkMode')}
              </button>
              <button
                onClick={() => setTheme('light')}
                style={{
                  border: 'none',
                  background: theme === 'light' ? 'var(--color-purple-40)' : 'transparent',
                  color: theme === 'light' ? '#FFF' : 'var(--text-muted)',
                  padding: '0.4rem 0.75rem',
                  borderRadius: '9px',
                  fontSize: '0.775rem',
                  fontWeight: '800',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                <Sun size={13} /> {t('lightMode')}
              </button>
            </div>
          </div>

          {/* Language Row */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.85rem 1rem',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: '16px',
            border: '1px solid var(--border-subtle)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <Globe size={20} color="var(--color-cyan)" />
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: '800' }}>{t('languageSetting')}</div>
                <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                  {lang === 'EN' ? 'English' : 'हिंदी (Hindi)'}
                </div>
              </div>
            </div>

            <div style={{
              display: 'flex',
              background: 'var(--bg-canvas)',
              padding: '3px',
              borderRadius: '12px',
              border: '1px solid var(--border-subtle)'
            }}>
              <button
                onClick={() => setLang('EN')}
                style={{
                  border: 'none',
                  background: lang === 'EN' ? 'var(--color-purple-40)' : 'transparent',
                  color: lang === 'EN' ? '#FFF' : 'var(--text-muted)',
                  padding: '0.4rem 0.75rem',
                  borderRadius: '9px',
                  fontSize: '0.775rem',
                  fontWeight: '800',
                  cursor: 'pointer'
                }}
              >
                🇬🇧 English
              </button>
              <button
                onClick={() => setLang('HI')}
                style={{
                  border: 'none',
                  background: lang === 'HI' ? 'var(--color-purple-40)' : 'transparent',
                  color: lang === 'HI' ? '#FFF' : 'var(--text-muted)',
                  padding: '0.4rem 0.75rem',
                  borderRadius: '9px',
                  fontSize: '0.775rem',
                  fontWeight: '800',
                  cursor: 'pointer'
                }}
              >
                🇮🇳 हिंदी
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Editable Fields Form */}
      <div className="glass-card" style={{ padding: '1.5rem', borderRadius: '20px' }}>
        <div style={{
          fontSize: '0.8rem',
          fontWeight: '800',
          textTransform: 'uppercase',
          color: 'var(--color-purple)',
          marginBottom: '1.1rem',
          letterSpacing: '0.05em'
        }}>
          Profile Information
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          <div>
            <label style={{ fontSize: '0.775rem', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>
              Full Name
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                required
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="input-field"
                placeholder="Enter your full name"
                style={{ paddingLeft: '2.5rem' }}
              />
              <User size={18} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.775rem', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>
              Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="email"
                required
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="input-field"
                placeholder="user@khata.pro"
                style={{ paddingLeft: '2.5rem' }}
              />
              <Mail size={18} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.775rem', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>
              Phone Number
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className="input-field"
                placeholder="+91 9876543210"
                style={{ paddingLeft: '2.5rem' }}
              />
              <Phone size={18} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary"
            style={{
              marginTop: '0.5rem',
              justifyContent: 'center',
              padding: '0.85rem',
              fontSize: '0.95rem',
              fontWeight: '800',
              borderRadius: '14px'
            }}
          >
            <Save size={18} /> Save Profile Changes
          </button>
        </form>
      </div>

      {/* Logout Action Button */}
      <button
        onClick={() => logout()}
        className="btn-secondary"
        style={{
          padding: '0.85rem',
          justifyContent: 'center',
          fontSize: '0.95rem',
          fontWeight: '800',
          borderRadius: '14px',
          color: 'var(--color-rose)',
          borderColor: 'rgba(244, 63, 94, 0.3)',
          background: 'rgba(244, 63, 94, 0.05)'
        }}
      >
        <LogOut size={18} /> Sign Out of Account
      </button>

    </div>
  );
}
