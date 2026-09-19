const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { run, get, all } = require('../database/db');
const { JWT_SECRET } = require('../middleware/auth');

async function registerUser({ email, password, name, role = 'ACCOUNTANT' }) {
  // The web/mobile client also checks this, but that check is bypassable by
  // anyone calling the API directly, so it has to be enforced here too.
  if (!password || password.length < 6) {
    const err = new Error('Password must be at least 6 characters.');
    err.statusCode = 400;
    err.code = 'WEAK_PASSWORD';
    err.isOperational = true;
    throw err;
  }

  const existing = await get('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
  if (existing) {
    const err = new Error('An account with this email address already exists.');
    err.statusCode = 400;
    err.code = 'EMAIL_EXISTS';
    err.isOperational = true;
    throw err;
  }

  const userId = uuidv4();
  const passwordHash = await bcrypt.hash(password, 10);

  await run(
    'INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)',
    [userId, email.toLowerCase().trim(), passwordHash, name, role]
  );

  // Create default workspace for user
  const workspaceId = uuidv4();
  await run(
    'INSERT INTO workspaces (id, user_id, name, currency) VALUES (?, ?, ?, ?)',
    [workspaceId, userId, `${name}'s Primary Ledger`, 'INR']
  );

  const token = generateToken({ id: userId, email, name, role });

  return {
    user: { id: userId, email, name, role },
    workspace: { id: workspaceId, name: `${name}'s Primary Ledger`, currency: 'INR' },
    token
  };
}

async function loginUser({ email, password }) {
  const user = await get('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()]);
  if (!user) {
    const err = new Error('Invalid email or password credentials.');
    err.statusCode = 401;
    err.code = 'INVALID_CREDENTIALS';
    err.isOperational = true;
    throw err;
  }

  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    const err = new Error('Invalid email or password credentials.');
    err.statusCode = 401;
    err.code = 'INVALID_CREDENTIALS';
    err.isOperational = true;
    throw err;
  }

  // Get user workspaces
  let workspaces = await all('SELECT * FROM workspaces WHERE user_id = ?', [user.id]);
  if (workspaces.length === 0) {
    const wsId = uuidv4();
    await run('INSERT INTO workspaces (id, user_id, name, currency) VALUES (?, ?, ?, ?)', [wsId, user.id, 'Main Ledger', 'INR']);
    workspaces = [{ id: wsId, user_id: user.id, name: 'Main Ledger', currency: 'INR' }];
  }

  const token = generateToken({ id: user.id, email: user.email, name: user.name, role: user.role });

  return {
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    workspaces,
    token
  };
}

async function handleOAuthLogin({ provider, providerId, email, name }) {
  let user = await get('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()]);
  if (!user) {
    const userId = uuidv4();
    const mockHash = await bcrypt.hash(uuidv4(), 10);
    await run('INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)', [
      userId, email.toLowerCase().trim(), mockHash, name, 'ACCOUNTANT'
    ]);
    const wsId = uuidv4();
    await run('INSERT INTO workspaces (id, user_id, name, currency) VALUES (?, ?, ?, ?)', [
      wsId, userId, `${name}'s Ledger`, 'INR'
    ]);
    user = { id: userId, email: email.toLowerCase().trim(), name, role: 'ACCOUNTANT' };
  }

  const workspaces = await all('SELECT * FROM workspaces WHERE user_id = ?', [user.id]);
  const token = generateToken({ id: user.id, email: user.email, name: user.name, role: user.role });

  return {
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    workspaces,
    token
  };
}

/**
 * Update the editable fields of a profile. Role and password are deliberately
 * not settable here — a user must not be able to promote themselves by POSTing
 * a role field.
 */
async function updateProfile(userId, updates = {}) {
  const user = await get('SELECT * FROM users WHERE id = ?', [userId]);
  if (!user) {
    const err = new Error('User account not found.');
    err.statusCode = 404;
    err.code = 'USER_NOT_FOUND';
    err.isOperational = true;
    throw err;
  }

  const name = updates.name !== undefined ? String(updates.name).trim() : user.name;
  if (!name) {
    const err = new Error('Name cannot be empty.');
    err.statusCode = 400;
    err.code = 'INVALID_INPUT';
    err.isOperational = true;
    throw err;
  }

  await run('UPDATE users SET name = ? WHERE id = ?', [name, userId]);

  return { id: user.id, email: user.email, name, role: user.role };
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

module.exports = {
  registerUser,
  loginUser,
  handleOAuthLogin,
  updateProfile
};
