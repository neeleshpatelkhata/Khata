import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { Building2, Lock, Mail, User, ArrowRight } from 'lucide-react';

export default function AuthScreen() {
  const { login, register, isLoading, error } = useAuthStore();
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('ACCOUNTANT');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isRegisterMode) {
      await register(name, email, password, role);
    } else {
      await login(email, password);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at 50% 30%, rgba(99, 102, 241, 0.15), var(--bg-canvas) 70%)',
      padding: '1rem 0.75rem'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '420px',
        padding: '1.75rem 1.25rem',
        borderRadius: '24px',
        boxSizing: 'border-box',
        overflow: 'hidden'
      }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #6366F1, #2563EB)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 0.75rem auto',
            boxShadow: '0 0 25px rgba(99, 102, 241, 0.5)'
          }}>
            <Building2 size={28} color="#FFF" />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800', letterSpacing: '-0.02em', marginBottom: '0.25rem', color: 'var(--text-main)' }}>
            KHATA<span style={{ color: 'var(--color-purple)' }}>.PRO</span>
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem' }}>
            {isRegisterMode ? 'Create your ledger workspace' : 'Sign in to access your ledger'}
          </p>
        </div>

        {error && (
          <div className="glass-card" style={{ padding: '0.75rem 0.85rem', marginBottom: '1.25rem', borderColor: 'var(--color-rose)', background: 'rgba(244, 63, 94, 0.1)', color: 'var(--color-rose)', fontSize: '0.825rem', borderRadius: '12px', wordBreak: 'break-word' }}>
            {error}
          </div>
        )}

        {/* Email & Password Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.05rem' }}>
          {isRegisterMode && (
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Full Name *</label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                <input
                  type="text"
                  required
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-field"
                  style={{ paddingLeft: '2.5rem', minHeight: '48px', borderRadius: '12px' }}
                />
              </div>
            </div>
          )}

          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Email Address *</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
              <input
                type="email"
                required
                placeholder="accountant@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                style={{ paddingLeft: '2.5rem', minHeight: '48px', borderRadius: '12px' }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Password *</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
              <input
                type="password"
                required
                minLength={isRegisterMode ? 6 : undefined}
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                style={{ paddingLeft: '2.5rem', minHeight: '48px', borderRadius: '12px' }}
              />
            </div>
            {isRegisterMode && (
              <p style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '0.3rem' }}>At least 6 characters.</p>
            )}
          </div>

          {isRegisterMode && (
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Assign System Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value)} className="input-field" style={{ minHeight: '48px', borderRadius: '12px' }}>
                <option value="ADMIN">Administrator (Full Access & Telemetry)</option>
                <option value="ACCOUNTANT">Accountant (Ledger & Entries)</option>
                <option value="VIEWER">Auditor (Read Only)</option>
              </select>
            </div>
          )}

          <button type="submit" disabled={isLoading} className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem', minHeight: '48px', borderRadius: '12px', fontSize: '0.95rem' }}>
            {isLoading ? 'Please wait...' : isRegisterMode ? 'Create Account & Workspace' : 'Sign In'} <ArrowRight size={16} />
          </button>
        </form>

        {/* Toggle Register / Login */}
        <div style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {isRegisterMode ? 'Already have an account?' : "Don't have a workspace yet?"}{' '}
          <button
            type="button"
            onClick={() => setIsRegisterMode(!isRegisterMode)}
            style={{ background: 'transparent', border: 'none', color: 'var(--color-purple)', fontWeight: '700', cursor: 'pointer' }}
          >
            {isRegisterMode ? 'Sign In' : 'Register Now'}
          </button>
        </div>

      </div>
    </div>
  );
}
