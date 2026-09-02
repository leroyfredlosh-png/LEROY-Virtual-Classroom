const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');

const { createAppServer } = require('./server.js');

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  return {
    status: response.status,
    ok: response.ok,
    body: text ? JSON.parse(text) : {},
  };
}

test('auth API rejects unauthenticated access to /api/auth/me', async () => {
  const { server, baseUrl } = await createAppServer({ port: 4311 });
  try {
    const result = await fetchJson(`${baseUrl}/api/auth/me`, { method: 'GET' });
    assert.equal(result.status, 401);
    assert.equal(result.body.error, 'Unauthorized');
  } finally {
    server.close();
  }
});

test('auth API accepts a valid token for /api/auth/me', async () => {
  const { server, baseUrl } = await createAppServer({ port: 4312 });
  try {
    const register = await fetchJson(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: 'Test User', email: 'test@example.com', password: 'secret123' }),
    });
    assert.equal(register.status, 201);

    const me = await fetchJson(`${baseUrl}/api/auth/me`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${register.body.token}` },
    });

    assert.equal(me.status, 200);
    assert.equal(me.body.user.email, 'test@example.com');
  } finally {
    server.close();
  }
});

test('dashboard requires a valid token', async () => {
  const { server, baseUrl } = await createAppServer({ port: 4313 });
  try {
    const openDashboard = await fetchJson(`${baseUrl}/api/dashboard`, { method: 'GET' });
    assert.equal(openDashboard.status, 401);
    assert.equal(openDashboard.body.error, 'Unauthorized');
  } finally {
    server.close();
  }
});
