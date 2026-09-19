import { useState, useEffect } from 'react';
import { apiClient } from '../services/apiClient';

const OUTBOX_KEY = 'khata_outbox_queue';

function getStoredOutbox() {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function setStoredOutbox(items) {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(items));
  } catch (e) {
    console.error('Failed to save outbox to localStorage:', e);
  }
}

let listeners = [];
let state = {
  isOnline: navigator.onLine,
  isSyncing: false,
  outbox: getStoredOutbox(),
  lastSyncTime: localStorage.getItem('khata_last_sync') || null,
  conflictsResolvedTotal: Number(localStorage.getItem('khata_conflicts_count')) || 0,
  deviceDeviceId: localStorage.getItem('khata_device_id') || `device_${Math.random().toString(36).substring(2, 9)}`,
  syncStatusMessage: 'System Synchronized'
};

if (!localStorage.getItem('khata_device_id')) {
  localStorage.setItem('khata_device_id', state.deviceDeviceId);
}

function setState(newState) {
  state = { ...state, ...newState };
  if (newState.outbox !== undefined) {
    setStoredOutbox(state.outbox);
  }
  listeners.forEach(l => l(state));
}

export function useSyncStore() {
  const [store, setStore] = useState(state);

  useEffect(() => {
    listeners.push(setStore);

    const handleOnline = () => {
      setState({ isOnline: true, syncStatusMessage: 'Network Connection Restored. Auto-syncing...' });
      triggerSync();
    };

    const handleOffline = () => {
      setState({ isOnline: false, syncStatusMessage: 'Offline Mode Active. Queuing transactions in Outbox.' });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      listeners = listeners.filter(l => l !== setStore);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const queueOutboxItem = (entityType, payload) => {
    const newItem = {
      clientTempId: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      entityType, // 'TRANSACTION' | 'PARTY'
      payload,
      version: 1,
      timestamp: new Date().toISOString()
    };

    const updatedOutbox = [...state.outbox, newItem];
    setState({
      outbox: updatedOutbox,
      syncStatusMessage: `1 item queued in offline outbox (${updatedOutbox.length} total pending)`
    });

    if (state.isOnline) {
      triggerSync();
    }
    return newItem;
  };

  const triggerSync = async (workspaceId) => {
    if (state.isSyncing) return;
    if (state.outbox.length === 0) {
      setState({ syncStatusMessage: 'All outbox records synchronized.' });
      return;
    }

    setState({ isSyncing: true, syncStatusMessage: 'Synchronizing offline outbox with remote database...' });

    try {
      if (!workspaceId) {
        const activeWs = JSON.parse(localStorage.getItem('khata_active_ws') || '{}');
        workspaceId = activeWs.id;
      }

      if (!workspaceId) {
        setState({ isSyncing: false, syncStatusMessage: 'No active workspace selected for sync.' });
        return;
      }

      const res = await apiClient.pushSyncOutbox(workspaceId, state.deviceDeviceId, state.outbox);
      const result = res?.data || {};

      const resolvedCount = state.conflictsResolvedTotal + (result.conflictsResolved || 0);
      const now = new Date().toISOString();

      localStorage.setItem('khata_last_sync', now);
      localStorage.setItem('khata_conflicts_count', resolvedCount);

      setState({
        outbox: [],
        isSyncing: false,
        lastSyncTime: now,
        conflictsResolvedTotal: resolvedCount,
        syncStatusMessage: `Sync completed. ${result.processedCount ?? 0} items pushed, ${result.conflictsResolved ?? 0} conflicts resolved.`
      });
    } catch (err) {
      console.error('Sync execution failed:', err);
      setState({
        isSyncing: false,
        syncStatusMessage: `Sync retry deferred: ${err.message}`
      });
    }
  };

  const clearOutbox = () => {
    setState({ outbox: [], syncStatusMessage: 'Offline outbox cleared.' });
  };

  return {
    ...store,
    pendingOutboxCount: store.outbox.length,
    queueOutboxItem,
    triggerSync,
    // Navbar's manual "sync now" button.
    triggerManualSync: triggerSync,
    clearOutbox
  };
}
