'use strict';

const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
const CATALOG_FILE = path.join(DATA_DIR, 'catalog.json');
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(ROOT, 'uploads'));
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const SESSION_SECRET = process.env.SESSION_SECRET || '';

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(CATALOG_FILE)) fs.writeFileSync(CATALOG_FILE, '[]\n');

if (ADMIN_PASSWORD.length < 10 || ADMIN_PASSWORD === 'CAMBIA_ESTA_CONTRASENA' || SESSION_SECRET.length < 32 || SESSION_SECRET.includes('pon_aqui')) {
  console.warn('\n[BLACKS] Configura ADMIN_PASSWORD (mínimo 10 caracteres) y SESSION_SECRET (mínimo 32) en .env antes de usar el panel de administrador.\n');
}

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
      upgradeInsecureRequests: []
    }
  }
}));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '20kb' }));

app.use(session({
  name: 'blacks.sid',
  secret: SESSION_SECRET || crypto.randomBytes(48).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 8
  }
}));

function sameOrigin(req, res, next) {
  const origin = req.get('origin');
  if (origin) {
    try {
      const parsed = new URL(origin);
      if (parsed.host !== req.get('host')) return res.status(403).json({ error: 'Solicitud no permitida.' });
    } catch (_) {
      return res.status(403).json({ error: 'Origen no válido.' });
    }
  }
  next();
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin === true) return next();
  return res.status(401).json({ error: 'Inicia sesión como administrador.' });
}

function readCatalog() {
  try {
    const data = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('No se pudo leer el catálogo:', err);
    return [];
  }
}

function writeCatalog(items) {
  const temp = `${CATALOG_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(items, null, 2));
  fs.renameSync(temp, CATALOG_FILE);
}

const allowedMime = new Set(['image/jpeg', 'image/png', 'image/webp']);
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!allowedMime.has(file.mimetype)) return cb(new Error('Solo se aceptan imágenes JPG, PNG o WEBP.'));
    cb(null, true);
  }
});

app.get('/api/catalog', (_req, res) => {
  const items = readCatalog().map(({ id, title, description, price, category, filename, createdAt }) => ({
    id, title, description, price, category,
    image: `/uploads/${encodeURIComponent(filename)}`,
    createdAt
  }));
  res.json(items);
});

app.get('/api/admin/session', (req, res) => {
  res.json({ authenticated: Boolean(req.session && req.session.isAdmin) });
});

app.post('/api/admin/login', sameOrigin, (req, res) => {
  if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 10 || ADMIN_PASSWORD === 'CAMBIA_ESTA_CONTRASENA' || SESSION_SECRET.length < 32 || SESSION_SECRET.includes('pon_aqui')) {
    return res.status(503).json({ error: 'El administrador debe configurar ADMIN_PASSWORD en el archivo .env.' });
  }
  const supplied = String(req.body.password || '');
  const a = Buffer.from(supplied);
  const b = Buffer.from(ADMIN_PASSWORD);
  const valid = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!valid) return res.status(401).json({ error: 'Contraseña incorrecta.' });
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'No se pudo iniciar sesión.' });
    req.session.isAdmin = true;
    res.json({ ok: true });
  });
});

app.post('/api/admin/logout', sameOrigin, requireAdmin, (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.post('/api/admin/catalog', sameOrigin, requireAdmin, (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE' ? 'La imagen supera el límite de 10 MB.' : err.message;
      return res.status(400).json({ error: message || 'No se pudo subir la imagen.' });
    }
    if (!req.file) return res.status(400).json({ error: 'Selecciona una imagen.' });
    const title = String(req.body.title || '').trim().slice(0, 80);
    const description = String(req.body.description || '').trim().slice(0, 220);
    const price = String(req.body.price || '').trim().slice(0, 30);
    const category = String(req.body.category || 'Personalizados').trim().slice(0, 40);
    if (!title) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: 'Escribe el nombre del diseño.' });
    }
    const item = {
      id: crypto.randomUUID(), title, description, price, category,
      filename: req.file.filename,
      createdAt: new Date().toISOString()
    };
    const items = readCatalog();
    items.unshift(item);
    writeCatalog(items);
    res.status(201).json({ ok: true, item: { ...item, image: `/uploads/${encodeURIComponent(item.filename)}` } });
  });
});

app.delete('/api/admin/catalog/:id', sameOrigin, requireAdmin, (req, res) => {
  const items = readCatalog();
  const found = items.find(item => item.id === req.params.id);
  if (!found) return res.status(404).json({ error: 'No se encontró ese diseño.' });
  writeCatalog(items.filter(item => item.id !== req.params.id));
  const safeName = path.basename(found.filename || '');
  if (safeName) fs.unlink(path.join(UPLOAD_DIR, safeName), () => {});
  res.json({ ok: true });
});

app.use('/uploads', express.static(UPLOAD_DIR, {
  fallthrough: false,
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=86400');
  }
}));
app.use(express.static(PUBLIC_DIR));
app.get('*', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

app.use((err, _req, res, _next) => {
  console.error(err);
  if (res.headersSent) return;
  res.status(500).json({ error: 'Ocurrió un error en el servidor.' });
});

app.listen(PORT, () => {
  console.log(`BLACKS está disponible en http://localhost:${PORT}`);
});
