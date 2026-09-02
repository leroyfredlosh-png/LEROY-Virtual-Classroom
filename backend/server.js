const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT) || 4173;
const HOST = process.env.HOST || '0.0.0.0';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '';
const AUTH_SECRET = process.env.AUTH_SECRET || 'leroy-custom-secret-change-me';
const DEFAULT_ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
let iceServers = DEFAULT_ICE_SERVERS;
try { if (process.env.CALL_ICE_SERVERS) iceServers = JSON.parse(process.env.CALL_ICE_SERVERS); } catch { console.warn('CALL_ICE_SERVERS must be valid JSON; using the default STUN server.'); }
const FRONTEND_ROOT = path.resolve(__dirname, '..', 'frontend');
const BACKEND_ROOT = path.resolve(__dirname);
const calls = new Map();

const rooms = [
  {
    id: 'room-01',
    code: 'COSMOS-01',
    title: 'Exploring the cosmos',
    year: 'Year 8',
    subject: 'Astronomy Lab',
    description: 'A guided journey through our solar system. Students are currently discovering what makes a planet habitable.',
    status: 'live',
    studentsHere: 18,
    durationMinutes: 42,
    participation: 94,
  },
  {
    id: 'room-02',
    code: 'MARS-02',
    title: 'Mission: Mars',
    year: 'Year 7',
    subject: 'Space sciences',
    description: 'Design a rover mission and decide what it needs to survive on Mars.',
    status: 'scheduled',
    studentsHere: 0,
    durationMinutes: 0,
    participation: 0,
  },
];

const schedule = [
  { id: 'schedule-01', roomId: 'room-01', time: '10:00 AM', title: 'Exploring the cosmos', year: 'Year 8', subject: 'Astronomy Lab', status: 'live' },
  { id: 'schedule-02', roomId: 'room-02', time: '01:30 PM', title: 'Mission: Mars', year: 'Year 7', subject: 'Space sciences', status: 'scheduled' },
  { id: 'schedule-03', roomId: 'room-04', time: '03:45 PM', title: 'Open studio', year: 'Year 8', subject: 'Independent work', status: 'scheduled' },
];

const activity = [
  { id: 'activity-01', title: 'Solar system quiz', detail: 'Ready to share with Year 8', type: 'quiz' },
  { id: 'activity-02', title: 'Week 4 resources', detail: '12 items · Updated yesterday', type: 'resources' },
];

const internships = [
  { id: 'intern-01', studentName: 'Maya Johnson', email: 'maya.johnson@student.edu', phone: '+1 555 014 2201', placement: 'Bright Labs', supervisor: 'Nora Patel', startDate: '2024-10-07', status: 'needs-call', nextCall: 'Today', lastCall: '2024-10-17', notes: 'Enjoying the research team; needs support with public speaking.' },
  { id: 'intern-02', studentName: 'Daniel Okafor', email: 'daniel.okafor@student.edu', phone: '+1 555 014 2202', placement: 'GreenWorks Studio', supervisor: 'Luis Romero', startDate: '2024-10-14', status: 'scheduled', nextCall: 'Tomorrow', lastCall: '2024-10-21', notes: 'Working on a sustainability audit with the design team.' },
  { id: 'intern-03', studentName: 'Sofia Williams', email: 'sofia.williams@student.edu', phone: '+1 555 014 2203', placement: 'City Archive', supervisor: 'Helen Brooks', startDate: '2024-09-30', status: 'complete', nextCall: 'Nov 04', lastCall: '2024-10-24', notes: 'Settled in and building confidence with visitors.' },
];

const callers = [
  { id: 'caller-01', name: 'Leroy-Fred', email: 'leroyfredlosh@gmail.com', relationship: 'Self test', phone: '', roomId: 'room-01', createdAt: '2026-08-27' },
];

const users = [];

function getBearerToken(request) {
  const authHeader = request.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice('Bearer '.length).trim();
}

function requireAuth(request) {
  const token = getBearerToken(request);
  if (!token) return null;
  try {
    return jwt.verify(token, AUTH_SECRET);
  } catch {
    return null;
  }
}

function sendJson(response, status, payload) {
  const corsOrigin = ALLOWED_ORIGIN;
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...(corsOrigin ? { 'Access-Control-Allow-Origin': corsOrigin, 'Vary': 'Origin' } : {}) });
  response.end(JSON.stringify(payload));
}

function sendError(response, status, message) {
  sendJson(response, status, { error: message });
}

function callSignals(roomId) {
  if (!calls.has(roomId)) calls.set(roomId, []);
  return calls.get(roomId);
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) reject(new Error('Request body is too large'));
    });
    request.on('end', () => {
      if (!body) return resolve({});
      try { resolve(JSON.parse(body)); } catch { reject(new Error('Request body must be valid JSON')); }
    });
    request.on('error', reject);
  });
}

function sanitizeUser(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email.toLowerCase(),
    role: user.role || 'teacher',
  };
}

function createToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role || 'teacher',
    },
    AUTH_SECRET,
    { expiresIn: '12h' }
  );
}

function getUserByEmail(email) {
  return users.find((user) => user.email.toLowerCase() === String(email).trim().toLowerCase());
}

function dashboardPayload() {
  return {
    teacher: { id: 'teacher-01', name: 'Leroy-Fred', email: 'leroyfredlosh@gmail.com', role: 'Science teacher', school: 'Riverside Middle' },
    rooms,
    liveRoom: rooms.find((room) => room.status === 'live') || null,
    schedule,
    activity,
  };
}

function safeFrontendPath(urlPath) {
  const requested = urlPath === '/' ? 'login.html' : urlPath.replace(/^\/+/, '');
  const filePath = path.resolve(FRONTEND_ROOT, requested);
  return filePath.startsWith(FRONTEND_ROOT) ? filePath : null;
}

function serveFrontend(request, response, urlPath) {
  const filePath = safeFrontendPath(urlPath);
  if (!filePath) return sendError(response, 403, 'Forbidden');
  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) return sendError(response, 404, 'Page not found');
    const contentTypes = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
    response.writeHead(200, { 'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(response);
  });
}

function serveBackendConsole(response, urlPath) {
  const requested = urlPath === '/backend' || urlPath === '/backend/' ? 'backend.html' : urlPath.replace(/^\/backend\/+/, '');
  const filePath = path.resolve(BACKEND_ROOT, requested);
  if (!filePath.startsWith(BACKEND_ROOT)) return sendError(response, 403, 'Forbidden');
  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) return sendError(response, 404, 'Page not found');
    const contentTypes = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
    response.writeHead(200, { 'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(response);
  });
}

async function handleRequest(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  const { pathname } = requestUrl;

  if (request.method === 'OPTIONS' && pathname.startsWith('/api/')) {
    response.writeHead(204, { ...(ALLOWED_ORIGIN ? { 'Access-Control-Allow-Origin': ALLOWED_ORIGIN } : {}), 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
    return response.end();
  }

  if (pathname === '/api/health' && request.method === 'GET') return sendJson(response, 200, { status: 'ok', service: 'leroy-classroom-api' });
  if (pathname === '/api/auth/me' && request.method === 'GET') {
    const decoded = requireAuth(request);
    if (!decoded) return sendError(response, 401, 'Unauthorized');
    const user = users.find((entry) => entry.id === decoded.sub);
    if (!user) return sendError(response, 404, 'User not found');
    return sendJson(response, 200, { user: sanitizeUser(user) });
  }
  if (pathname === '/api/dashboard' && request.method === 'GET') {
    const decoded = requireAuth(request);
    if (!decoded) return sendError(response, 401, 'Unauthorized');
    const user = users.find((entry) => entry.id === decoded.sub);
    if (!user) return sendError(response, 401, 'Unauthorized');
    return sendJson(response, 200, { ...dashboardPayload(), user: sanitizeUser(user) });
  }
  if (pathname === '/api/rooms' && request.method === 'GET') return sendJson(response, 200, { rooms });
  if (pathname === '/api/schedule' && request.method === 'GET') return sendJson(response, 200, { schedule });
  if (pathname === '/api/activity' && request.method === 'GET') return sendJson(response, 200, { activity });
  if (pathname === '/api/internships' && request.method === 'GET') return sendJson(response, 200, { internships });
  if (pathname === '/api/callers' && request.method === 'GET') return sendJson(response, 200, { callers });
  if (pathname === '/api/calls/config' && request.method === 'GET') return sendJson(response, 200, { iceServers });
  const signalMatch = pathname.match(/^\/api\/calls\/([^/]+)\/signals$/);
  if (signalMatch && request.method === 'GET') {
    const since = Number(requestUrl.searchParams.get('since')) || 0;
    return sendJson(response, 200, { signals: callSignals(signalMatch[1]).filter((signal) => signal.createdAt > since) });
  }
  if (signalMatch && request.method === 'POST') {
    try {
      const body = await readJson(request);
      if (!body.type || !body.payload) return sendError(response, 400, 'type and payload are required');
      const signal = { id: randomUUID(), type: body.type, payload: body.payload, createdAt: Date.now() };
      callSignals(signalMatch[1]).push(signal);
      if (callSignals(signalMatch[1]).length > 500) callSignals(signalMatch[1]).splice(0, 100);
      return sendJson(response, 201, signal);
    } catch (error) { return sendError(response, 400, error.message); }
  }

  if (pathname === '/api/rooms' && request.method === 'POST') {
    try {
      const body = await readJson(request);
      if (!body.title || !body.year || !body.subject) return sendError(response, 400, 'title, year, and subject are required');
      const room = { id: randomUUID(), code: `ROOM-${String(rooms.length + 1).padStart(2, '0')}`, title: body.title, year: body.year, subject: body.subject, description: body.description || '', status: 'scheduled', studentsHere: 0, durationMinutes: 0, participation: 0 };
      rooms.push(room);
      return sendJson(response, 201, room);
    } catch (error) { return sendError(response, 400, error.message); }
  }

  if (pathname === '/api/callers' && request.method === 'POST') {
    try {
      const body = await readJson(request);
      if (!body.name || !body.email || !body.relationship) return sendError(response, 400, 'name, email, and relationship are required');
      if (!/^\S+@\S+\.\S+$/.test(body.email)) return sendError(response, 400, 'Please provide a valid email address');
      if (callers.some((caller) => caller.email.toLowerCase() === body.email.toLowerCase())) return sendError(response, 409, 'A caller with this email already exists');
      const caller = { id: randomUUID(), name: body.name.trim(), email: body.email.trim().toLowerCase(), relationship: body.relationship.trim(), phone: body.phone?.trim() || '', roomId: body.roomId || 'room-01', createdAt: new Date().toISOString().slice(0, 10) };
      callers.push(caller);
      return sendJson(response, 201, { caller, inviteUrl: `/call.html?room=${caller.roomId}` });
    } catch (error) { return sendError(response, 400, error.message); }
  }

  if (pathname === '/api/internships/check-ins' && request.method === 'POST') {
    try {
      const body = await readJson(request);
      const student = internships.find((internship) => internship.id === body.studentId);
      if (!student) return sendError(response, 404, 'Student internship record not found');
      if (!body.status || !body.notes || !body.nextCall) return sendError(response, 400, 'status, notes, and nextCall are required');
      student.status = body.status;
      student.notes = body.notes;
      student.nextCall = body.nextCall;
      student.lastCall = new Date().toISOString().slice(0, 10);
      return sendJson(response, 201, { message: `Check-in saved for ${student.studentName}`, internship: student });
    } catch (error) { return sendError(response, 400, error.message); }
  }

  if (pathname === '/api/auth/register' && request.method === 'POST') {
    try {
      const body = await readJson(request);
      if (!body.fullName || !body.email || !body.password) return sendError(response, 400, 'fullName, email, and password are required');
      if (body.password.length < 6) return sendError(response, 400, 'Password must be at least 6 characters');
      const email = String(body.email).trim().toLowerCase();
      if (getUserByEmail(email)) return sendError(response, 409, 'This email is already registered');
      const passwordHash = await bcrypt.hash(body.password, 12);
      const newUser = { id: randomUUID(), fullName: String(body.fullName).trim(), email, passwordHash, role: body.role || 'teacher', resetToken: null, resetTokenExpiry: null };
      users.push(newUser);
      return sendJson(response, 201, { message: 'Account created successfully', user: sanitizeUser(newUser), token: createToken(newUser) });
    } catch (error) { return sendError(response, 400, error.message); }
  }

  if (pathname === '/api/auth/login' && request.method === 'POST') {
    try {
      const body = await readJson(request);
      if (!body.email || !body.password) return sendError(response, 400, 'email and password are required');
      const user = getUserByEmail(body.email);
      if (!user) return sendError(response, 401, 'Invalid email or password');
      const validPassword = await bcrypt.compare(body.password, user.passwordHash);
      if (!validPassword) return sendError(response, 401, 'Invalid email or password');
      return sendJson(response, 200, { message: 'Login successful', user: sanitizeUser(user), token: createToken(user) });
    } catch (error) { return sendError(response, 400, error.message); }
  }

  if (pathname === '/api/auth/request-reset' && request.method === 'POST') {
    try {
      const body = await readJson(request);
      if (!body.email) return sendError(response, 400, 'email is required');
      const user = getUserByEmail(body.email);
      if (!user) return sendJson(response, 200, { message: 'If an account exists for this email, a reset token has been prepared.' });
      const resetToken = crypto.randomBytes(24).toString('hex');
      const resetTokenExpiry = Date.now() + 15 * 60 * 1000;
      user.resetToken = resetToken;
      user.resetTokenExpiry = resetTokenExpiry;
      return sendJson(response, 200, { message: 'Reset instructions have been prepared.', resetToken, expiresInMinutes: 15 });
    } catch (error) { return sendError(response, 400, error.message); }
  }

  if (pathname === '/api/auth/reset-password' && request.method === 'POST') {
    try {
      const body = await readJson(request);
      if (!body.token || !body.newPassword) return sendError(response, 400, 'token and newPassword are required');
      const user = users.find((entry) => entry.resetToken === body.token);
      if (!user) return sendError(response, 400, 'Invalid reset token');
      if (!user.resetTokenExpiry || Date.now() > user.resetTokenExpiry) return sendError(response, 400, 'Reset token has expired');
      if (body.newPassword.length < 6) return sendError(response, 400, 'Password must be at least 6 characters');
      user.passwordHash = await bcrypt.hash(body.newPassword, 12);
      user.resetToken = null;
      user.resetTokenExpiry = null;
      return sendJson(response, 200, { message: 'Password reset successful', user: sanitizeUser(user), token: createToken(user) });
    } catch (error) { return sendError(response, 400, error.message); }
  }

  if (pathname.startsWith('/api/')) return sendError(response, 404, 'API route not found');
  if (pathname === '/backend' || pathname === '/backend/' || pathname.startsWith('/backend/')) return serveBackendConsole(response, pathname);
  return serveFrontend(request, response, pathname);
}

function createAppServer(options = {}) {
  const port = options.port ?? (Number(process.env.PORT) || PORT);
  const host = options.host ?? (process.env.HOST || HOST);
  const server = http.createServer((request, response) => {
    handleRequest(request, response).catch((error) => sendError(response, 500, error.message));
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      const baseUrl = `http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${port}`;
      resolve({ server, baseUrl });
    });
  });
}

if (require.main === module) {
  createAppServer().then(({ server, baseUrl }) => {
    console.log(`Leroy classroom server listening on ${baseUrl}`);
    server.on('close', () => console.log('Leroy classroom server stopped.'));
  }).catch((error) => {
    console.error('Failed to start Leroy classroom server:', error);
    process.exit(1);
  });
}

module.exports = { createAppServer };