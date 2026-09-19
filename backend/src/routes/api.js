const express = require('express');
const router = express.Router();
const path = require('path');
const { authenticateToken, requireRole } = require('../middleware/auth');
const authService = require('../services/authService');
const ledgerService = require('../services/ledgerService');
const syncEngine = require('../services/syncEngine');
const storageService = require('../services/storageService');
const backupService = require('../services/backupService');
const aiService = require('../services/aiService');

// Roles allowed to write ledger data. OWNER is the role the mobile app issues,
// so leaving it out of this list locked every app user out of their own books.
const WRITE_ROLES = ['OWNER', 'ADMIN', 'ACCOUNTANT'];
const ADMIN_ROLES = ['OWNER', 'ADMIN'];

// --- Auth Routes ---
router.post('/auth/register', async (req, res, next) => {
  try {
    const { email, password, name, role } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Email, password, and name are required.' }
      });
    }
    const result = await authService.registerUser({ email, password, name, role });
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.post('/auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Email and password are required.' }
      });
    }
    const result = await authService.loginUser({ email, password });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.post('/auth/oauth', async (req, res, next) => {
  try {
    const { provider, providerId, email, name } = req.body;
    const result = await authService.handleOAuthLogin({ provider, providerId, email, name });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.get('/auth/me', authenticateToken, async (req, res) => {
  res.json({ success: true, data: { user: req.user } });
});

router.put('/auth/me', authenticateToken, async (req, res, next) => {
  try {
    const updated = await authService.updateProfile(req.user.id, req.body);
    res.json({ success: true, data: { user: updated } });
  } catch (err) {
    next(err);
  }
});

// --- Workspaces ---
router.get('/workspaces', authenticateToken, async (req, res, next) => {
  try {
    const list = await ledgerService.getUserWorkspaces(req.user.id);
    res.json({ success: true, data: list });
  } catch (err) {
    next(err);
  }
});

router.post('/workspaces', authenticateToken, async (req, res, next) => {
  try {
    const { name, currency } = req.body;
    if (!name) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Workspace name is required.' }
      });
    }
    const ws = await ledgerService.createWorkspace(req.user.id, name, currency);
    res.status(201).json({ success: true, data: ws });
  } catch (err) {
    next(err);
  }
});

// --- Parties ---
router.get('/workspaces/:wsId/parties', authenticateToken, async (req, res, next) => {
  try {
    await ledgerService.verifyWorkspaceAccess(req.params.wsId, req.user.id);
    const { type, search, page, limit } = req.query;
    const result = await ledgerService.getParties(req.params.wsId, { type, search, page, limit });
    res.json({ success: true, data: result.parties, meta: result.pagination });
  } catch (err) {
    next(err);
  }
});

router.post('/workspaces/:wsId/parties', authenticateToken, requireRole(WRITE_ROLES), async (req, res, next) => {
  try {
    await ledgerService.verifyWorkspaceAccess(req.params.wsId, req.user.id);
    const { name, phone, email, type, address, openingBalance } = req.body;
    if (!name) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Party name is required.' }
      });
    }
    const party = await ledgerService.createParty(req.params.wsId, { name, phone, email, type, address, openingBalance });
    res.status(201).json({ success: true, data: party });
  } catch (err) {
    next(err);
  }
});

router.get('/workspaces/:wsId/parties/:id', authenticateToken, async (req, res, next) => {
  try {
    await ledgerService.verifyWorkspaceAccess(req.params.wsId, req.user.id);
    const party = await ledgerService.getPartyById(req.params.wsId, req.params.id);
    res.json({ success: true, data: party });
  } catch (err) {
    next(err);
  }
});

router.put('/workspaces/:wsId/parties/:id', authenticateToken, requireRole(WRITE_ROLES), async (req, res, next) => {
  try {
    await ledgerService.verifyWorkspaceAccess(req.params.wsId, req.user.id);
    const updated = await ledgerService.updateParty(req.params.wsId, req.params.id, req.body);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

router.delete('/workspaces/:wsId/parties/:id', authenticateToken, requireRole(WRITE_ROLES), async (req, res, next) => {
  try {
    await ledgerService.verifyWorkspaceAccess(req.params.wsId, req.user.id);
    const resData = await ledgerService.deleteParty(req.params.wsId, req.params.id);
    res.json({ success: true, data: resData });
  } catch (err) {
    next(err);
  }
});

// --- Transactions ---
router.get('/workspaces/:wsId/transactions', authenticateToken, async (req, res, next) => {
  try {
    await ledgerService.verifyWorkspaceAccess(req.params.wsId, req.user.id);
    const { partyId, type, category, startDate, endDate, page, limit } = req.query;
    const result = await ledgerService.getTransactions(req.params.wsId, { partyId, type, category, startDate, endDate, page, limit });
    res.json({ success: true, data: result.transactions, meta: result.pagination });
  } catch (err) {
    next(err);
  }
});

router.post('/workspaces/:wsId/transactions', authenticateToken, requireRole(WRITE_ROLES), async (req, res, next) => {
  try {
    await ledgerService.verifyWorkspaceAccess(req.params.wsId, req.user.id);
    const { partyId, type, amount, baseAmount, gstAmount, paymentMode, category, notes, date } = req.body;
    if (!partyId || !type || !amount) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'partyId, type (GAVE/GOT), and amount are required.' }
      });
    }
    const result = await ledgerService.addTransaction(req.params.wsId, req.user.id, {
      partyId, type, amount, baseAmount, gstAmount, paymentMode, category, notes, date
    });
    res.status(201).json({ success: true, data: result.transaction, updatedPartyBalance: result.updatedPartyBalance });
  } catch (err) {
    next(err);
  }
});

router.put('/workspaces/:wsId/transactions/:id', authenticateToken, requireRole(WRITE_ROLES), async (req, res, next) => {
  try {
    await ledgerService.verifyWorkspaceAccess(req.params.wsId, req.user.id);
    const result = await ledgerService.updateTransaction(req.params.wsId, req.params.id, req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.delete('/workspaces/:wsId/transactions/:id', authenticateToken, requireRole(WRITE_ROLES), async (req, res, next) => {
  try {
    await ledgerService.verifyWorkspaceAccess(req.params.wsId, req.user.id);
    const result = await ledgerService.deleteTransaction(req.params.wsId, req.params.id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.post('/workspaces/:wsId/transactions/:id/restore', authenticateToken, requireRole(WRITE_ROLES), async (req, res, next) => {
  try {
    await ledgerService.verifyWorkspaceAccess(req.params.wsId, req.user.id);
    const result = await ledgerService.restoreTransaction(req.params.wsId, req.params.id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.post('/workspaces/:wsId/parties/:id/restore', authenticateToken, requireRole(WRITE_ROLES), async (req, res, next) => {
  try {
    await ledgerService.verifyWorkspaceAccess(req.params.wsId, req.user.id);
    const result = await ledgerService.restoreParty(req.params.wsId, req.params.id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// --- AI Assist (Gemini) ---
// The API key lives only in this process's environment — never sent to the
// client — so requests to Gemini are proxied through here.
router.post('/ai/parse-invoice', authenticateToken, async (req, res, next) => {
  try {
    const { imageBase64, mimeType } = req.body;
    if (!imageBase64) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'imageBase64 is required.' }
      });
    }
    const parsed = await aiService.parseInvoiceImage(imageBase64, mimeType || 'image/jpeg');
    res.json({ success: true, data: parsed, aiAvailable: aiService.isConfigured() });
  } catch (err) {
    next(err);
  }
});

router.post('/ai/parse-text', authenticateToken, async (req, res, next) => {
  try {
    const { text, partyNames } = req.body;
    if (!text || !String(text).trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'text is required.' }
      });
    }
    const parsed = await aiService.parseNaturalLanguagePrompt(text, Array.isArray(partyNames) ? partyNames : []);
    res.json({ success: true, data: parsed, aiAvailable: aiService.isConfigured() });
  } catch (err) {
    next(err);
  }
});

// Voice-note transcription — the fallback path for platforms (the Android
// WebView this app ships in) where the Web Speech API is unavailable.
router.post('/ai/transcribe-audio', authenticateToken, async (req, res, next) => {
  try {
    const { audioBase64, mimeType, languageCode } = req.body;
    if (!audioBase64) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'audioBase64 is required.' }
      });
    }
    const transcript = await aiService.transcribeAudio(audioBase64, mimeType || 'audio/webm', languageCode || 'en-IN');
    res.json({ success: true, data: { transcript }, aiAvailable: aiService.isConfigured() });
  } catch (err) {
    next(err);
  }
});

// --- Executive Summary ---
router.get('/workspaces/:wsId/summary', authenticateToken, async (req, res, next) => {
  try {
    await ledgerService.verifyWorkspaceAccess(req.params.wsId, req.user.id);
    const summaryData = await ledgerService.getExecutiveSummary(req.params.wsId);
    res.json({ success: true, data: summaryData });
  } catch (err) {
    next(err);
  }
});

// --- Sync Engine ---
router.post('/workspaces/:wsId/sync/push', authenticateToken, async (req, res, next) => {
  try {
    await ledgerService.verifyWorkspaceAccess(req.params.wsId, req.user.id);
    const { deviceId, outboxItems } = req.body;
    const result = await syncEngine.pushOutboxBatch(req.params.wsId, req.user.id, deviceId, outboxItems || []);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.get('/workspaces/:wsId/sync/pull', authenticateToken, async (req, res, next) => {
  try {
    await ledgerService.verifyWorkspaceAccess(req.params.wsId, req.user.id);
    const { lastSyncedAt } = req.query;
    const result = await syncEngine.pullChanges(req.params.wsId, lastSyncedAt);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// --- File Attachments ---
router.post('/transactions/:txId/attachments', authenticateToken, storageService.upload.single('attachment'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_FILE', message: 'Attachment file is missing in multipart upload.' }
      });
    }
    const attachment = await storageService.attachFileToTransaction(req.params.txId, req.file);
    res.status(201).json({ success: true, data: attachment });
  } catch (err) {
    next(err);
  }
});

router.get('/attachments/:id/download', authenticateToken, async (req, res, next) => {
  try {
    const attachment = await storageService.getAttachmentById(req.params.id);
    res.download(attachment.storage_path, attachment.original_name);
  } catch (err) {
    next(err);
  }
});

// --- Backup & Recovery Telemetry ---
router.get('/backups/telemetry', authenticateToken, requireRole(WRITE_ROLES), async (req, res, next) => {
  try {
    const telemetry = await backupService.getBackupTelemetry();
    res.json({ success: true, data: telemetry });
  } catch (err) {
    next(err);
  }
});

router.post('/backups/create', authenticateToken, requireRole(ADMIN_ROLES), async (req, res, next) => {
  try {
    const backup = await backupService.createBackup('MANUAL');
    res.status(201).json({ success: true, data: backup });
  } catch (err) {
    next(err);
  }
});

router.post('/backups/:id/restore', authenticateToken, requireRole(ADMIN_ROLES), async (req, res, next) => {
  try {
    const result = await backupService.restoreFromBackup(req.params.id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// --- User Snapshot Cloud & Local Backups ---
router.post('/workspaces/:wsId/user-backups', authenticateToken, async (req, res, next) => {
  try {
    await ledgerService.verifyWorkspaceAccess(req.params.wsId, req.user.id);
    const { backupName, type, dataJson } = req.body;
    const backupRecord = await backupService.createUserSnapshotBackup(req.params.wsId, req.user.id, { backupName, type, dataJson });
    res.status(201).json({ success: true, data: backupRecord });
  } catch (err) {
    next(err);
  }
});

router.get('/workspaces/:wsId/user-backups', authenticateToken, async (req, res, next) => {
  try {
    await ledgerService.verifyWorkspaceAccess(req.params.wsId, req.user.id);
    const list = await backupService.getUserSnapshotBackups(req.params.wsId, req.user.id);
    res.json({ success: true, data: list });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
