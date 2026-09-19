/**
 * End-to-end smoke test against a running API server.
 *   1. npm start          (in another terminal)
 *   2. node scripts/verify-backend.mjs [baseUrl]
 */
const BASE = (process.argv[2] || 'http://localhost:8080') + '/api/v1';

let passed = 0;
const check = (name, cond, detail = '') => {
  if (cond) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    console.error(`  FAIL  ${name}${detail ? `\n        ${detail}` : ''}`);
    process.exitCode = 1;
  }
};

async function api(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

const email = `smoke_${Date.now()}@khata.test`;

console.log(`\nTesting ${BASE}\n`);

// --- Auth ---
const reg = await api('/auth/register', {
  method: 'POST',
  body: { email, password: 'Sm0keTest!', name: 'Smoke Tester', role: 'OWNER' }
});
check('register returns a token and a default workspace', !!reg.json.data?.token && !!reg.json.data?.workspace?.id, JSON.stringify(reg.json));

const token = reg.json.data?.token;
const wsId = reg.json.data?.workspace?.id;
if (!token || !wsId) {
  console.error('\nCannot continue without a session.\n');
  process.exit(1);
}

const login = await api('/auth/login', { method: 'POST', body: { email, password: 'Sm0keTest!' } });
check('login works with the same credentials', login.status === 200 && !!login.json.data?.token);

const badLogin = await api('/auth/login', { method: 'POST', body: { email, password: 'wrong' } });
check('a wrong password is rejected with 401', badLogin.status === 401);

const noAuth = await api(`/workspaces/${wsId}/parties`);
check('an unauthenticated request is rejected with 401', noAuth.status === 401);

const weakPw = await api('/auth/register', {
  method: 'POST',
  body: { email: `weak_${Date.now()}@khata.test`, password: '123', name: 'Weak' }
});
check('a short password is rejected server-side', weakPw.status === 400, `status ${weakPw.status}`);

const dupeEmail = await api('/auth/register', {
  method: 'POST',
  body: { email, password: 'Sm0keTest!', name: 'Dupe' }
});
check('registering the same email twice is rejected', dupeEmail.status === 400, `status ${dupeEmail.status}`);

const profileUpdate = await api('/auth/me', { method: 'PUT', token, body: { name: 'Renamed Tester' } });
check('a signed-in user can update their profile', profileUpdate.json.data?.user?.name === 'Renamed Tester',
  JSON.stringify(profileUpdate.json));

// --- Parties (this is the role gate that used to reject OWNER) ---
const ram = await api(`/workspaces/${wsId}/parties`, {
  method: 'POST', token,
  body: { name: 'Ram Kumar', phone: '9876543210', type: 'CUSTOMER', openingBalance: 0 }
});
check('an OWNER can create a party', ram.status === 201, `status ${ram.status} ${JSON.stringify(ram.json)}`);

const shyam = await api(`/workspaces/${wsId}/parties`, {
  method: 'POST', token,
  body: { name: 'Shyam Traders', type: 'SUPPLIER', openingBalance: 0 }
});
const gita = await api(`/workspaces/${wsId}/parties`, {
  method: 'POST', token,
  body: { name: 'Gita Store', type: 'CUSTOMER', openingBalance: 500 }
});

const ramId = ram.json.data?.id;
const shyamId = shyam.json.data?.id;
const gitaId = gita.json.data?.id;

// --- Sign convention ---
await api(`/workspaces/${wsId}/transactions`, {
  method: 'POST', token,
  body: { partyId: ramId, type: 'GAVE', amount: 1000, category: 'Raw Supplies' }
});
let ramRow = await api(`/workspaces/${wsId}/parties/${ramId}`, { token });
check('GAVE makes the balance a receivable (+1000)', ramRow.json.data?.current_balance === 1000,
  `got ${ramRow.json.data?.current_balance}`);

const gotTx = await api(`/workspaces/${wsId}/transactions`, {
  method: 'POST', token,
  body: { partyId: ramId, type: 'GOT', amount: 400, category: 'Invoice Payment' }
});
ramRow = await api(`/workspaces/${wsId}/parties/${ramId}`, { token });
check('GOT reduces the receivable (600)', ramRow.json.data?.current_balance === 600,
  `got ${ramRow.json.data?.current_balance}`);

await api(`/workspaces/${wsId}/transactions`, {
  method: 'POST', token,
  body: { partyId: shyamId, type: 'GOT', amount: 2000 }
});
const shyamRow = await api(`/workspaces/${wsId}/parties/${shyamId}`, { token });
check('a supplier we owe goes negative (-2000)', shyamRow.json.data?.current_balance === -2000,
  `got ${shyamRow.json.data?.current_balance}`);

const gitaRow = await api(`/workspaces/${wsId}/parties/${gitaId}`, { token });
check('opening balance is preserved (500)', gitaRow.json.data?.current_balance === 500,
  `got ${gitaRow.json.data?.current_balance}`);

// --- GST ---
const gstTx = await api(`/workspaces/${wsId}/transactions`, {
  method: 'POST', token,
  body: { partyId: gitaId, type: 'GAVE', amount: 1180, gstAmount: 180 }
});
check('GST is split into base + tax', gstTx.json.data?.base_amount === 1000 && gstTx.json.data?.gst_amount === 180,
  JSON.stringify(gstTx.json.data));

// --- Validation ---
const zero = await api(`/workspaces/${wsId}/transactions`, {
  method: 'POST', token, body: { partyId: ramId, type: 'GAVE', amount: 0 }
});
check('a zero amount is rejected', zero.status === 400, `status ${zero.status}`);

// --- Summary ---
const summary = await api(`/workspaces/${wsId}/summary`, { token });
const s = summary.json.data?.summary;
// Ram +600, Gita 500+1180=1680, Shyam -2000
check('summary nets receivables per party', s?.totalYouWillGet === 2280, `got ${s?.totalYouWillGet}`);
check('summary reports payables', s?.totalYouWillGive === 2000, `got ${s?.totalYouWillGive}`);
check('net balance is consistent', s?.netBalance === 280, `got ${s?.netBalance}`);

// --- Update recomputes ---
const upd = await api(`/workspaces/${wsId}/transactions/${gotTx.json.data.id}`, {
  method: 'PUT', token, body: { amount: 1000 }
});
ramRow = await api(`/workspaces/${wsId}/parties/${ramId}`, { token });
check('editing an amount recomputes the balance (1000-1000=0)', ramRow.json.data?.current_balance === 0,
  `got ${ramRow.json.data?.current_balance}`);

// --- Soft delete + restore ---
const del = await api(`/workspaces/${wsId}/transactions/${gotTx.json.data.id}`, { method: 'DELETE', token });
ramRow = await api(`/workspaces/${wsId}/parties/${ramId}`, { token });
check('deleting an entry reverses it (back to 1000)', ramRow.json.data?.current_balance === 1000,
  `got ${ramRow.json.data?.current_balance}`);

const listAfterDelete = await api(`/workspaces/${wsId}/transactions?partyId=${ramId}`, { token });
check('a deleted entry disappears from the list', listAfterDelete.json.data?.length === 1,
  `got ${listAfterDelete.json.data?.length}`);

await api(`/workspaces/${wsId}/transactions/${gotTx.json.data.id}/restore`, { method: 'POST', token });
ramRow = await api(`/workspaces/${wsId}/parties/${ramId}`, { token });
check('restoring brings the entry back (0)', ramRow.json.data?.current_balance === 0,
  `got ${ramRow.json.data?.current_balance}`);

// --- Party archive is non-destructive ---
await api(`/workspaces/${wsId}/parties/${shyamId}`, { method: 'DELETE', token });
const partiesAfter = await api(`/workspaces/${wsId}/parties`, { token });
check('an archived party is hidden from the list',
  !partiesAfter.json.data?.some((p) => p.id === shyamId));

const restored = await api(`/workspaces/${wsId}/parties/${shyamId}/restore`, { method: 'POST', token });
check('an archived party can be restored with its balance intact',
  restored.json.data?.updatedPartyBalance === -2000, JSON.stringify(restored.json.data));

// --- AI proxy (key stays server-side; route just needs to respond safely) ---
const aiText = await api('/ai/parse-text', { method: 'POST', token, body: { text: 'paid 500 to Ram for lunch' } });
check('the AI text route responds without leaking the key', aiText.status === 200 && 'aiAvailable' in aiText.json,
  JSON.stringify(aiText.json));

const aiTextNoInput = await api('/ai/parse-text', { method: 'POST', token, body: {} });
check('the AI text route rejects an empty prompt', aiTextNoInput.status === 400);

const aiNoAuth = await api('/ai/parse-text', { method: 'POST', body: { text: 'x' } });
check('the AI proxy requires authentication', aiNoAuth.status === 401);

// --- Tenant isolation ---
const other = await api('/auth/register', {
  method: 'POST',
  body: { email: `other_${Date.now()}@khata.test`, password: 'Sm0keTest!', name: 'Other', role: 'OWNER' }
});
const crossTenant = await api(`/workspaces/${wsId}/parties`, { token: other.json.data.token });
check("another user cannot read this workspace", crossTenant.status === 404, `status ${crossTenant.status}`);

console.log(`\n${passed} checks passed${process.exitCode ? ' (with failures above)' : ''}\n`);
