'use strict';

const express = require('express');
const serverless = require('serverless-http');
const helmet = require('helmet');
const multer = require('multer');
const crypto = require('crypto');
const { getStore } = require('@netlify/blobs');

const app = express();
const api = express.Router();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const SESSION_SECRET = process.env.SESSION_SECRET || '';
const COOKIE_NAME = 'blacks.admin';
const SESSION_SECONDS = 8 * 60 * 60;
const MAX_CATALOG_IMAGE_BYTES = 4 * 1024 * 1024;

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: []
    }
  }
}));
app.use('/api', api);

const catalogStore = getStore('blacks-catalog');
const imageStore = getStore('blacks-images');

function parseCookies(header) {
  const out = Object.create(null);
  for (const part of String(header || '').split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) out[key] = value;
  }
  return out;
}

function createSessionToken() {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS })).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function validSession(req) {
  if (SESSION_SECRET.length < 32) return false;
  const token = parseCookies(req.get('cookie'))[COOKIE_NAME];
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, suppliedSignature] = parts;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest();
  let actual;
  try { actual = Buffer.from(suppliedSignature, 'base64url'); } catch (_) { return false; }
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return Number.isFinite(data.exp) && data.exp > Math.floor(Date.now() / 1000);
  } catch (_) {
    return false;
  }
}

function setSessionCookie(res, token) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_SECONDS}`);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}

function sameOrigin(req, res, next) {
  const origin = req.get('origin');
  if (!origin) return next();
  try {
    const parsed = new URL(origin);
    const requestHost = req.get('x-forwarded-host') || req.get('host');
    if (parsed.host !== requestHost) return res.status(403).json({ error: 'Solicitud no permitida.' });
  } catch (_) {
    return res.status(403).json({ error: 'Origen no válido.' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (validSession(req)) return next();
  return res.status(401).json({ error: 'Inicia sesión como administrador.' });
}

async function readCatalog() {
  try {
    const data = await catalogStore.get('catalog.json', { type: 'json', consistency: 'strong' });
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('No se pudo leer el catálogo:', err);
    return [];
  }
}

async function writeCatalog(items) {
  await catalogStore.setJSON('catalog.json', items);
}

const allowedMime = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp']
]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_CATALOG_IMAGE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!allowedMime.has(file.mimetype)) return cb(new Error('Solo se aceptan imágenes JPG, PNG o WEBP.'));
    cb(null, true);
  }
});

api.use(express.json({ limit: '100kb' }));
api.use(express.urlencoded({ extended: false, limit: '20kb' }));

api.get('/catalog', async (_req, res) => {
  const items = await readCatalog();
  res.json(items.map(({ id, title, description, price, category, filename, createdAt }) => ({
    id, title, description, price, category,
    image: `/api/uploads/${encodeURIComponent(filename)}`,
    createdAt
  })));
});

api.get('/uploads/:filename', async (req, res) => {
  const filename = String(req.params.filename || '');
  if (!/^\d+-[a-f0-9]{16}\.(jpg|png|webp)$/i.test(filename)) {
    return res.status(404).json({ error: 'Imagen no encontrada.' });
  }
  try {
    const bytes = await imageStore.get(filename, { type: 'arrayBuffer', consistency: 'strong' });
    if (!bytes) return res.status(404).json({ error: 'Imagen no encontrada.' });
    const ext = filename.split('.').pop().toLowerCase();
    const contentType = ext === 'jpg' ? 'image/jpeg' : ext === 'png' ? 'image/png' : 'image/webp';
    res.setHeader('Content-Type', contentType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.status(200).send(Buffer.from(bytes));
  } catch (err) {
    console.error('No se pudo leer la imagen:', err);
    return res.status(500).json({ error: 'No se pudo cargar la imagen.' });
  }
});

api.get('/admin/session', (req, res) => {
  res.json({ authenticated: validSession(req) });
});

api.post('/admin/login', sameOrigin, (req, res) => {
  if (ADMIN_PASSWORD.length < 10 || SESSION_SECRET.length < 32) {
    return res.status(503).json({ error: 'El administrador debe configurar ADMIN_PASSWORD y SESSION_SECRET en Netlify.' });
  }
  const supplied = String(req.body.password || '');
  const a = Buffer.from(supplied);
  const b = Buffer.from(ADMIN_PASSWORD);
  const valid = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!valid) return res.status(401).json({ error: 'Contraseña incorrecta.' });
  setSessionCookie(res, createSessionToken());
  return res.json({ ok: true });
});

api.post('/admin/logout', sameOrigin, requireAdmin, (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

api.post('/admin/catalog', sameOrigin, requireAdmin, (req, res) => {
  upload.single('image')(req, res, async (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'La imagen supera el límite de 4 MB.'
        : err.message;
      return res.status(400).json({ error: message || 'No se pudo subir la imagen.' });
    }
    if (!req.file) return res.status(400).json({ error: 'Selecciona una imagen.' });

    const title = String(req.body.title || '').trim().slice(0, 80);
    const description = String(req.body.description || '').trim().slice(0, 220);
    const price = String(req.body.price || '').trim().slice(0, 30);
    const category = String(req.body.category || 'Personalizados').trim().slice(0, 40);
    if (!title) return res.status(400).json({ error: 'Escribe el nombre del diseño.' });

    const ext = allowedMime.get(req.file.mimetype);
    const filename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ext}`;
    const item = {
      id: crypto.randomUUID(), title, description, price, category,
      filename,
      createdAt: new Date().toISOString()
    };

    try {
      await imageStore.set(filename, new Uint8Array(req.file.buffer));
      const items = await readCatalog();
      items.unshift(item);
      await writeCatalog(items);
      return res.status(201).json({ ok: true, item: { ...item, image: `/api/uploads/${encodeURIComponent(filename)}` } });
    } catch (uploadError) {
      console.error('No se pudo guardar el diseño:', uploadError);
      try { await imageStore.delete(filename); } catch (_) {}
      return res.status(500).json({ error: 'No se pudo guardar el diseño. Intenta de nuevo.' });
    }
  });
});

api.delete('/admin/catalog/:id', sameOrigin, requireAdmin, async (req, res) => {
  try {
    const items = await readCatalog();
    const found = items.find(item => item.id === req.params.id);
    if (!found) return res.status(404).json({ error: 'No se encontró ese diseño.' });
    await writeCatalog(items.filter(item => item.id !== req.params.id));
    if (/^\d+-[a-f0-9]{16}\.(jpg|png|webp)$/i.test(String(found.filename || ''))) {
      await imageStore.delete(found.filename);
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error('No se pudo eliminar el diseño:', err);
    return res.status(500).json({ error: 'No se pudo eliminar el diseño.' });
  }
});

api.use((err, _req, res, _next) => {
  console.error(err);
  if (res.headersSent) return;
  res.status(500).json({ error: 'Ocurrió un error en el servidor.' });
});

exports.handler = serverless(app);
