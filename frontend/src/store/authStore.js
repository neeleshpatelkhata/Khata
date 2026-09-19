import { useState, useEffect } from 'react';
import { apiClient } from '../services/apiClient';
import { isValidEmail } from '../services/ledgerEngine';

const SESSION_KEY = 'khata_session'; // { user, workspaces, currentWorkspace }

// Custom reactive hook store for Auth & Workspace.
let listeners = [];
let state = {
  user: null,
  workspaces: [],
  currentWorkspace: null,
  isAuthenticated: false,
  // True only while initAuth() is resolving the stored session on launch, so
  // the app can show a blank frame instead of flashing the login screen for
  // an already-signed-in user.
  isInitializing: true,
  isLoading: false,
  error: null
};

function setState(newState) {
  state = { ...state, ...newState };
  listeners.forEach((l) => l(state));
}

function persistSession(session) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch (e) {
    console.error('Failed to persist session:', e);
  }
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem('khata_user_profile');
  localStorage.removeItem('khata_active_ws');
}

function withCurrency(ws) {
  return ws ? { ...ws, currency: ws.currency || 'INR' } : ws;
}

export function useAuthStore() {
  const [store, setStore] = useState(state);

  useEffect(() => {
    listeners.push(setStore);
    return () => {
      listeners = listeners.filter((l) => l !== setStore);
    };
  }, []);

  const setRole = (newRole) => {
    if (!state.user) return;
    const validRole = newRole === 'STAFF' ? 'STAFF' : 'OWNER';
    const updatedUser = { ...state.user, role: validRole };
    persistSession({ user: updatedUser, workspaces: state.workspaces, currentWorkspace: state.currentWorkspace });
    setState({ user: updatedUser });
  };

  /**
   * Save editable profile fields. `id` and `role` are deliberately not taken
   * from the form — role changes go through setRole so the permission checks
   * stay in one place.
   */
  const updateProfile = (updates = {}) => {
    if (!state.user) return null;
    const { id, role, ...safeUpdates } = updates;
    const updatedUser = { ...state.user, ...safeUpdates };

    if (updatedUser.name) updatedUser.name = String(updatedUser.name).trim();
    if (updatedUser.email) updatedUser.email = String(updatedUser.email).trim();

    persistSession({ user: updatedUser, workspaces: state.workspaces, currentWorkspace: state.currentWorkspace });
    setState({ user: updatedUser, error: null });

    // Best-effort push; the profile is a local-first record.
    apiClient.request('/auth/me', { method: 'PUT', body: JSON.stringify(safeUpdates) }).catch(() => {});

    return updatedUser;
  };

  const login = async (email, password) => {
    const trimmedEmail = String(email || '').trim();
    if (!isValidEmail(trimmedEmail)) {
      setState({ error: 'Please enter a valid email address.' });
      return false;
    }
    if (!password) {
      setState({ error: 'Please enter your password.' });
      return false;
    }

    setState({ isLoading: true, error: null });
    try {
      let user, workspaces;
      try {
        const res = await apiClient.login({ email: trimmedEmail, password });
        apiClient.setToken(res.data.token);
        user = res.data.user;
        workspaces = res.data.workspaces;
      } catch (apiErr) {
        if (apiErr.code === 'INVALID_CREDENTIALS') {
          setState({ isLoading: false, error: 'Incorrect email or password.' });
          return false;
        }
        if (!apiErr.isOffline) {
          setState({ isLoading: false, error: apiErr.message || 'Sign in failed.' });
          return false;
        }

        // Backend unreachable: fall back to a device-local session keyed by
        // this email, so the same person reopens the same ledger next time
        // instead of a fresh one, even without connectivity.
        console.warn('Backend unreachable, using local standalone login mode:', apiErr.message);
        const localToken = `local_jwt_${Date.now()}`;
        apiClient.setToken(localToken);
        const localId = `user_local_${trimmedEmail.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`;
        user = {
          id: localId,
          email: trimmedEmail,
          name: trimmedEmail.split('@')[0],
          role: 'OWNER'
        };
        workspaces = [
          {
            id: `ws_${localId}`,
            name: `${user.name}'s Ledger`,
            currency: 'INR'
          }
        ];
      }

      const primaryWs = withCurrency(workspaces[0]);
      persistSession({ user, workspaces, currentWorkspace: primaryWs });
      setState({
        user,
        workspaces,
        currentWorkspace: primaryWs,
        isAuthenticated: true,
        isLoading: false,
        error: null
      });
      return true;
    } catch (err) {
      setState({ isLoading: false, error: err.message });
      return false;
    }
  };

  const register = async (name, email, password, role = 'OWNER') => {
    const trimmedName = String(name || '').trim();
    const trimmedEmail = String(email || '').trim();

    if (!trimmedName) {
      setState({ error: 'Please enter your name.' });
      return false;
    }
    if (!isValidEmail(trimmedEmail)) {
      setState({ error: 'Please enter a valid email address.' });
      return false;
    }
    if (!password || password.length < 6) {
      setState({ error: 'Password must be at least 6 characters.' });
      return false;
    }

    setState({ isLoading: true, error: null });
    try {
      let user, workspace;
      try {
        const res = await apiClient.register({ name: trimmedName, email: trimmedEmail, password, role });
        apiClient.setToken(res.data.token);
        user = res.data.user;
        workspace = res.data.workspace;
      } catch (apiErr) {
        if (apiErr.code === 'EMAIL_EXISTS') {
          setState({ isLoading: false, error: 'An account with this email already exists. Try signing in instead.' });
          return false;
        }
        if (!apiErr.isOffline) {
          setState({ isLoading: false, error: apiErr.message || 'Registration failed.' });
          return false;
        }

        console.warn('Backend unreachable, using local standalone register mode:', apiErr.message);
        const localToken = `local_jwt_${Date.now()}`;
        apiClient.setToken(localToken);
        const localId = `user_local_${trimmedEmail.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`;
        user = { id: localId, name: trimmedName, email: trimmedEmail, role: role || 'OWNER' };
        workspace = { id: `ws_${localId}`, name: `${trimmedName}'s Ledger`, currency: 'INR' };
      }

      const lockedWs = withCurrency(workspace);
      persistSession({ user, workspaces: [lockedWs], currentWorkspace: lockedWs });
      setState({
        user,
        workspaces: [lockedWs],
        currentWorkspace: lockedWs,
        isAuthenticated: true,
        isLoading: false,
        error: null
      });
      return true;
    } catch (err) {
      setState({ isLoading: false, error: err.message });
      return false;
    }
  };

  /**
   * Ends the session. This intentionally does NOT touch the per-workspace
   * ledger data cached under khata_local_ledger_data_<wsId> — signing back
   * into the same account must find its books exactly as they were left.
   */
  const logout = () => {
    apiClient.setToken(null);
    clearSession();
    setState({
      user: null,
      workspaces: [],
      currentWorkspace: null,
      isAuthenticated: false,
      isLoading: false,
      error: null
    });
  };

  const switchWorkspace = (workspaceId) => {
    const found = state.workspaces.find((w) => String(w.id) === String(workspaceId));
    if (!found) return;
    const nextWs = withCurrency(found);
    persistSession({ user: state.user, workspaces: state.workspaces, currentWorkspace: nextWs });
    setState({ currentWorkspace: nextWs });
  };

  /** Restore a previously signed-in session on app launch. No session = show the login screen. */
  const initAuth = async () => {
    const savedToken = localStorage.getItem('khata_token');
    const savedSessionRaw = localStorage.getItem(SESSION_KEY);

    if (!savedToken || !savedSessionRaw) {
      clearSession();
      setState({ isAuthenticated: false, isInitializing: false });
      return;
    }

    try {
      const session = JSON.parse(savedSessionRaw);
      if (!session?.user?.id || !session?.currentWorkspace?.id) {
        throw new Error('Corrupt session');
      }

      apiClient.setToken(savedToken);
      setState({
        user: session.user,
        workspaces: session.workspaces || [session.currentWorkspace],
        currentWorkspace: withCurrency(session.currentWorkspace),
        isAuthenticated: true,
        isInitializing: false
      });

      // Refresh the profile from the server in the background. A stale local
      // token (server restarted with a new JWT secret, account deleted, etc.)
      // must not silently keep the app open on invalid credentials.
      apiClient
        .getMe()
        .catch((err) => {
          if (!err.isOffline) {
            console.warn('Session no longer valid on server, signing out:', err.message);
            logout();
          }
        });
    } catch (e) {
      console.error('Failed to restore session, signing out:', e);
      clearSession();
      apiClient.setToken(null);
      setState({ isAuthenticated: false, isInitializing: false, user: null, currentWorkspace: null, workspaces: [] });
    }
  };

  return {
    ...store,
    setRole,
    updateProfile,
    login,
    register,
    logout,
    switchWorkspace,
    initAuth
  };
}
