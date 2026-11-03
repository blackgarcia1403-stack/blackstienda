'use strict';

const WHATSAPP_NUMBER = '527751074289';
const colorMap = {
  negra: { start: '#080808', mid: '#343434', end: '#080808', label: 'Negra' },
  blanca: { start: '#bdbdbb', mid: '#f4f3ef', end: '#c9c8c3', label: 'Blanca' },
  gris: { start: '#46484d', mid: '#96999e', end: '#55575c', label: 'Gris' },
  roja: { start: '#5c0710', mid: '#c62535', end: '#680913', label: 'Roja' },
  azul: { start: '#092747', mid: '#28629a', end: '#0a2d50', label: 'Azul' }
};

let currentDesignUrl = '';
let currentDesignName = '';
let currentDesignFile = null;
let shirtColor = 'negra';
let placement = 'Frente';
let catalogItems = [];
let currentFilter = 'Todos';
let toastTimer;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}

function setShirtColor(key) {
  shirtColor = key;
  const colors = colorMap[key] || colorMap.negra;
  $('#fabricStart').setAttribute('stop-color', colors.start);
  $('#fabricMid').setAttribute('stop-color', colors.mid);
  $('#fabricEnd').setAttribute('stop-color', colors.end);
  $$('.color-choice').forEach(button => button.classList.toggle('active', button.dataset.color === key));
}

function setPlacement(value) {
  placement = value;
  $$('.placement').forEach(button => button.classList.toggle('active', button.dataset.placement === value));
  const overlay = $('#designOverlay');
  overlay.classList.toggle('back-print', value === 'Espalda');
  $('#previewPlaceholder').style.top = value === 'Espalda' ? '38%' : '40%';
}

function setDesign(src, name, file = null) {
  if (currentDesignUrl.startsWith('blob:')) URL.revokeObjectURL(currentDesignUrl);
  currentDesignUrl = src;
  currentDesignName = name || 'Diseño personalizado';
  currentDesignFile = file;
  const overlay = $('#designOverlay');
  overlay.src = src;
  overlay.hidden = false;
  $('#previewPlaceholder').hidden = true;
  $('#downloadMockup').disabled = false;
  $('#dropzone').classList.add('has-file');
  $('#dropzone strong').textContent = currentDesignName.length > 24 ? `${currentDesignName.slice(0, 21)}…` : currentDesignName;
}

function clearDesign() {
  if (currentDesignUrl.startsWith('blob:')) URL.revokeObjectURL(currentDesignUrl);
  currentDesignUrl = '';
  currentDesignName = '';
  currentDesignFile = null;
  $('#designOverlay').hidden = true;
  $('#designOverlay').removeAttribute('src');
  $('#previewPlaceholder').hidden = false;
  $('#downloadMockup').disabled = true;
  $('#designUpload').value = '';
  $('#dropzone').classList.remove('has-file');
  $('#dropzone strong').textContent = 'ARRASTRA TU IMAGEN AQUÍ';
}

function acceptDesignFile(file) {
  if (!file) return;
  const allowed = ['image/png', 'image/jpeg', 'image/webp'];
  if (!allowed.includes(file.type)) {
    showToast('Selecciona una imagen JPG, PNG o WEBP.');
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    showToast('La imagen supera el límite de 10 MB.');
    return;
  }
  const url = URL.createObjectURL(file);
  setDesign(url, file.name, file);
  showToast('¡Diseño cargado! Ajusta tu playera y revisa la vista previa.');
}

function fitImage(ctx, image, x, y, maxW, maxH) {
  const scale = Math.min(maxW / image.width, maxH / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  ctx.drawImage(image, x + (maxW - width) / 2, y + (maxH - height) / 2, width, height);
}

async function downloadMockup() {
  if (!currentDesignUrl) return;
  const svg = $('#shirtSvg').cloneNode(true);
  const colors = colorMap[shirtColor];
  svg.querySelector('#fabricStart').setAttribute('stop-color', colors.start);
  svg.querySelector('#fabricMid').setAttribute('stop-color', colors.mid);
  svg.querySelector('#fabricEnd').setAttribute('stop-color', colors.end);
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('width', '900');
  svg.setAttribute('height', '1050');
  const svgText = new XMLSerializer().serializeToString(svg);
  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
  const shirtImage = new Image();
  shirtImage.src = svgUrl;
  try {
    await shirtImage.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 1050;
    const ctx = canvas.getContext('2d');
    const bg = ctx.createRadialGradient(450, 500, 80, 450, 500, 650);
    bg.addColorStop(0, '#424242');
    bg.addColorStop(1, '#111111');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(shirtImage, 0, 0, canvas.width, canvas.height);
    const designImage = new Image();
    designImage.src = currentDesignUrl;
    await designImage.decode();
    if (placement === 'Espalda') fitImage(ctx, designImage, 300, 345, 300, 315);
    else fitImage(ctx, designImage, 325, 365, 250, 265);
    ctx.fillStyle = 'rgba(255,255,255,.45)';
    ctx.font = 'bold 29px Arial';
    ctx.textAlign = 'right';
    ctx.fillText('BLACKS®', 850, 1000);
    const a = document.createElement('a');
    a.download = 'BLACKS-vista-previa.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
  } catch (err) {
    console.error(err);
    showToast('No se pudo crear la vista previa descargable.');
  }
}

function createProductCard(item) {
  const article = document.createElement('article');
  article.className = 'product-card';
  const imageWrap = document.createElement('div');
  imageWrap.className = 'product-image';
  const image = document.createElement('img');
  image.src = item.image;
  image.alt = item.title;
  image.loading = 'lazy';
  imageWrap.appendChild(image);
  const info = document.createElement('div');
  info.className = 'product-info';
  const cat = document.createElement('span');
  cat.className = 'product-category';
  cat.textContent = item.category || 'Diseño BLACKS';
  const title = document.createElement('h3');
  title.textContent = item.title;
  const desc = document.createElement('p');
  desc.className = 'product-desc';
  desc.textContent = item.description || 'Diseño disponible para personalizar en playera Eurocotton.';
  const foot = document.createElement('div');
  foot.className = 'product-foot';
  const price = document.createElement('span');
  price.className = 'product-price';
  price.textContent = item.price ? item.price : 'Cotiza por WhatsApp';
  const button = document.createElement('button');
  button.className = 'product-try';
  button.type = 'button';
  button.textContent = 'PROBAR DISEÑO ↗';
  button.addEventListener('click', () => {
    setDesign(item.image, item.title, null);
    $('#personaliza').scrollIntoView({ behavior: 'smooth' });
    showToast(`Diseño “${item.title}” listo para la vista previa.`);
  });
  foot.append(price, button);
  info.append(cat, title, desc, foot);
  article.append(imageWrap, info);
  return article;
}

function renderCatalog() {
  const grid = $('#catalogGrid');
  grid.replaceChildren();
  const visibleItems = currentFilter === 'Todos' ? catalogItems : catalogItems.filter(item => (item.category || '').toLowerCase() === currentFilter.toLowerCase());
  if (!visibleItems.length) {
    const empty = document.createElement('div');
    empty.className = 'catalog-empty';
    const mark = document.createElement('span'); mark.className = 'empty-mark'; mark.textContent = 'B.';
    const title = document.createElement('h3'); title.textContent = currentFilter === 'Todos' ? 'ESTAMOS PREPARANDO EL CATÁLOGO' : 'PRÓXIMAMENTE';
    const desc = document.createElement('p'); desc.textContent = currentFilter === 'Todos' ? 'Muy pronto encontrarás aquí los diseños disponibles. Mientras tanto, crea el tuyo en el personalizador.' : 'Aún no hay diseños publicados en esta categoría. Explora las demás opciones o crea el tuyo.';
    const link = document.createElement('a'); link.className = 'text-link'; link.href = '#personaliza'; link.textContent = 'PERSONALIZAR AHORA ↗';
    empty.append(mark, title, desc, link); grid.appendChild(empty); return;
  }
  visibleItems.forEach(item => grid.appendChild(createProductCard(item)));
}

async function loadCatalog() {
  try {
    const response = await fetch('/api/catalog');
    if (!response.ok) throw new Error('No se pudo cargar el catálogo');
    catalogItems = await response.json();
    renderCatalog();
  } catch (err) {
    console.error(err);
    renderCatalog();
  }
}

function showAdminView(authenticated) {
  $('#adminLoginView').hidden = authenticated;
  $('#adminPanelView').hidden = !authenticated;
  if (authenticated) loadAdminCatalog();
}

async function loadAdminCatalog() {
  const list = $('#adminCatalogList');
  list.replaceChildren();
  try {
    const response = await fetch('/api/catalog');
    const items = await response.json();
    if (!items.length) {
      const p = document.createElement('p'); p.className = 'admin-help'; p.textContent = 'Todavía no has publicado diseños.'; list.appendChild(p); return;
    }
    items.forEach(item => {
      const row = document.createElement('div'); row.className = 'admin-item';
      const img = document.createElement('img'); img.src = item.image; img.alt = '';
      const span = document.createElement('span'); span.textContent = item.title;
      const meta = document.createElement('small'); meta.textContent = `${item.category || 'Sin categoría'}${item.price ? ` · ${item.price}` : ''}`; span.appendChild(meta);
      const del = document.createElement('button'); del.type = 'button'; del.textContent = 'Eliminar';
      del.addEventListener('click', async () => {
        if (!window.confirm(`¿Eliminar “${item.title}” del catálogo?`)) return;
        const result = await fetch(`/api/admin/catalog/${encodeURIComponent(item.id)}`, { method: 'DELETE' });
        const data = await result.json().catch(() => ({}));
        if (!result.ok) { showToast(data.error || 'No se pudo eliminar.'); return; }
        showToast('Diseño eliminado del catálogo.');
        await loadCatalog();
        await loadAdminCatalog();
      });
      row.append(img, span, del); list.appendChild(row);
    });
  } catch (err) {
    console.error(err); list.textContent = 'No fue posible consultar el catálogo.';
  }
}

async function openAdmin() {
  $('#adminModal').hidden = false;
  document.body.style.overflow = 'hidden';
  $('#loginMessage').textContent = '';
  $('#catalogMessage').textContent = '';
  try {
    const response = await fetch('/api/admin/session');
    const data = await response.json();
    showAdminView(Boolean(data.authenticated));
  } catch (_) { showAdminView(false); }
}

function closeAdmin() {
  $('#adminModal').hidden = true;
  document.body.style.overflow = '';
}

function whatsappOrder() {
  const size = $('#shirtSize').value;
  if (!currentDesignUrl) {
    showToast('Primero sube una imagen o elige un diseño del catálogo.');
    return;
  }
  if (!size) {
    showToast('Selecciona la talla de tu playera.');
    $('#shirtSize').focus();
    return;
  }
  const quantity = Math.max(1, Math.min(30, Number($('#quantity').value) || 1));
  const color = colorMap[shirtColor].label;
  const message = [
    'Hola BLACKS, quiero cotizar este pedido:',
    `• Diseño: ${currentDesignName}`,
    `• Playera calidad Eurocotton`,
    `• Color: ${color}`,
    `• Talla: ${size}`,
    `• Ubicación: ${placement}`,
    `• Cantidad: ${quantity}`,
    '',
    'Te comparto la imagen del diseño por este chat. ¿Me ayudas con el precio y tiempo de entrega?'
  ].join('\n');
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
}

function init() {
  $('#year').textContent = new Date().getFullYear();
  loadCatalog();
  setShirtColor('negra');
  setPlacement('Frente');

  $('#menuToggle').addEventListener('click', () => {
    const open = $('#mainNav').classList.toggle('open');
    $('#menuToggle').setAttribute('aria-expanded', String(open));
  });
  $$('#mainNav a').forEach(link => link.addEventListener('click', () => {
    $('#mainNav').classList.remove('open');
    $('#menuToggle').setAttribute('aria-expanded', 'false');
  }));

  $$('.color-choice').forEach(button => button.addEventListener('click', () => setShirtColor(button.dataset.color)));
  $$('.placement').forEach(button => button.addEventListener('click', () => setPlacement(button.dataset.placement)));
  $('#designUpload').addEventListener('change', event => acceptDesignFile(event.target.files[0]));
  const dz = $('#dropzone');
  ['dragenter', 'dragover'].forEach(name => dz.addEventListener(name, event => { event.preventDefault(); dz.classList.add('dragover'); }));
  ['dragleave', 'drop'].forEach(name => dz.addEventListener(name, event => { event.preventDefault(); dz.classList.remove('dragover'); }));
  dz.addEventListener('drop', event => acceptDesignFile(event.dataTransfer.files[0]));
  $('#resetDesign').addEventListener('click', () => { clearDesign(); setShirtColor('negra'); setPlacement('Frente'); $('#shirtSize').value = ''; $('#quantity').value = '1'; });
  $('#downloadMockup').addEventListener('click', downloadMockup);
  $('#orderDesign').addEventListener('click', whatsappOrder);
  $('#qtyMinus').addEventListener('click', () => $('#quantity').value = String(Math.max(1, (Number($('#quantity').value) || 1) - 1)));
  $('#qtyPlus').addEventListener('click', () => $('#quantity').value = String(Math.min(30, (Number($('#quantity').value) || 1) + 1)));
  $('#quantity').addEventListener('change', () => $('#quantity').value = String(Math.max(1, Math.min(30, Number($('#quantity').value) || 1))));

  $$('#categoryFilters button').forEach(button => button.addEventListener('click', () => {
    currentFilter = button.dataset.category;
    $$('#categoryFilters button').forEach(item => item.classList.toggle('selected', item === button));
    renderCatalog();
  }));

  $('#openAdmin').addEventListener('click', openAdmin);
  $('#closeAdmin').addEventListener('click', closeAdmin);
  $('#adminModal').addEventListener('click', event => { if (event.target === $('#adminModal')) closeAdmin(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !$('#adminModal').hidden) closeAdmin(); });

  $('#loginForm').addEventListener('submit', async event => {
    event.preventDefault();
    const message = $('#loginMessage'); message.textContent = 'Verificando…'; message.classList.remove('success');
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: $('#adminPassword').value })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo iniciar sesión.');
      $('#adminPassword').value = '';
      message.textContent = '';
      showAdminView(true);
    } catch (err) { message.textContent = err.message; }
  });

  $('#logoutAdmin').addEventListener('click', async () => {
    try { await fetch('/api/admin/logout', { method: 'POST' }); } catch (_) {}
    showAdminView(false);
    showToast('Sesión cerrada.');
  });

  $('#catalogForm').addEventListener('submit', async event => {
    event.preventDefault();
    const message = $('#catalogMessage'); message.textContent = 'Publicando diseño…'; message.classList.remove('success');
    const formData = new FormData();
    formData.append('title', $('#catalogTitle').value);
    formData.append('description', $('#catalogDescription').value);
    formData.append('price', $('#catalogPrice').value);
    formData.append('category', $('#catalogCategory').value);
    formData.append('image', $('#catalogImage').files[0]);
    try {
      const response = await fetch('/api/admin/catalog', { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo publicar el diseño.');
      $('#catalogForm').reset();
      message.textContent = '¡Diseño publicado! Ya aparece en el catálogo público.';
      message.classList.add('success');
      await loadCatalog();
      await loadAdminCatalog();
      showToast('Diseño publicado en BLACKS.');
    } catch (err) { message.textContent = err.message; }
  });
}

document.addEventListener('DOMContentLoaded', init);
