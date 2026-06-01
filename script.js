/* ═══════════════════════════════════════════════════
   LAXMI GENERAL STORE — FMCG CATALOGUE
   script.js  |  Vanilla JS, no frameworks
   ─────────────────────────────────────────────────
   DATA SOURCE: Google Sheets (4 tabs, all published as CSV)

   Tab 1 — products  (gid=0)
     Columns: Category | Brand | Product Name | Image URL
   Tab 2 — Categories  (gid=1832191700)
     Columns: Categories name | Image urls
   Tab 3 — Brands  (gid=1562580758)
     Columns: Brands name | Image urls
   Tab 4 — Laxmi logo  (gid=520282379)
     Columns: Company logo | <filename>

   GitHub image folders:
     products   → images/
     categories → images/
     brands     → images/
     logo       → images/

   To change any tab GID, update the SHEET_* constants below.
═══════════════════════════════════════════════════ */

'use strict';

/* ══════════════════════════════════════════════════
   CATEGORY META  (descriptions + fallback emoji)
   Images come from the Categories sheet.
══════════════════════════════════════════════════ */
const CATEGORY_META = {
  'Biscuits':              { emoji: '🍪', desc: 'Premium biscuits and cookies from the most trusted brands in India — perfect for tea time and snacking.' },
  'Snacks & Namkeen':      { emoji: '🥨', desc: 'Crispy chips, namkeen, and savoury snacks from your favourite brands — ideal for every occasion.' },
  'Cold Drinks':           { emoji: '🥤', desc: 'Refreshing carbonated beverages and cold drinks to quench your thirst all day long.' },
  'Mineral Water':         { emoji: '💧', desc: 'Pure, safe and refreshing packaged mineral water from top trusted brands.' },
  'Juices & Fruit Drinks': { emoji: '🧃', desc: 'Fresh fruit juices and flavourful fruit drinks packed with taste and nutrition.' },
  'Chocolates':            { emoji: '🍫', desc: 'Indulgent chocolates, chocolate bars and premium confectionery for every sweet craving.' },
  'Toffee & Candy':        { emoji: '🍬', desc: 'Delightful toffees, candies and mouth fresheners loved by kids and adults alike.' },
  'Personal Care':         { emoji: '🧴', desc: 'Daily personal care essentials including soaps, shampoos, toothpaste and skincare products.' },
  'Grocery':               { emoji: '🛒', desc: 'Essential grocery staples — atta, oil, salt, spices, and everyday kitchen necessities.' }
};

/* ══════════════════════════════════════════════════
   GOOGLE SHEETS — single source of truth
══════════════════════════════════════════════════ */
const SHEET_ID = '1BQnoM09TdvJ3kYqBwtbTLzO6xiRsKqupVHpc-_luyt0';

const SHEET_URLS = {
  products:   sheetUrl(0),
  categories: sheetUrl('1832191700'),
  brands:     sheetUrl('1562580758'),
  logo:       sheetUrl('520282379'),
};

function sheetUrl(gid) {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;
}

/* ══════════════════════════════════════════════════
   GITHUB IMAGE PATHS
══════════════════════════════════════════════════ */
const GITHUB_RAW = 'https://raw.githubusercontent.com/laxmigeneralstore/Laxmi/main/';

const IMG_FOLDERS = {
  products:   'images/',
  categories: 'images/',
  brands:     'images/',
  logo:       'images/',
};

function resolveImg(raw, folder) {
  const s = (raw || '').trim();
  if (!s)                   return '';
  if (s.startsWith('http')) return s;
  return GITHUB_RAW + (IMG_FOLDERS[folder] || 'images/') + s;
}

const resolveProductImg  = raw => resolveImg(raw, 'products');
const resolveCategoryImg = raw => resolveImg(raw, 'categories');
const resolveBrandImg    = raw => resolveImg(raw, 'brands');
const resolveLogoImg     = raw => resolveImg(raw, 'logo');

/* ══════════════════════════════════════════════════
   APPLICATION STATE
══════════════════════════════════════════════════ */
let allProducts    = [];
let categoryImages = {};
let brandImages    = {};
let storeLogo      = '';
let currentView    = 'home';
let currentCategory = null;
let currentBrand    = null;
let currentProduct  = null;

/* ══════════════════════════════════════════════════
   DOM HELPER
══════════════════════════════════════════════════ */
const $ = id => document.getElementById(id);

const VIEWS = ['home', 'categories', 'category', 'brand', 'product'];

/* ══════════════════════════════════════════════════
   CSV PARSER
══════════════════════════════════════════════════ */
function parseCSV(text) {
  const rows = [];
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  function parseLine(line) {
    const fields = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') inQuotes = false;
        else cur += ch;
      } else {
        if (ch === '"') inQuotes = true;
        else if (ch === ',') { fields.push(cur); cur = ''; }
        else cur += ch;
      }
    }
    fields.push(cur);
    return fields;
  }

  for (const line of lines) {
    if (line.trim()) rows.push(parseLine(line));
  }
  return rows;
}

async function fetchCSV(url) {
  try {
    const res = await fetch(`${url}&cachebust=${Date.now()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (err) {
    console.warn('[LGS] fetchCSV failed:', url, err.message);
    return null;
  }
}

function colIndex(headers, ...candidates) {
  for (const c of candidates) {
    const i = headers.indexOf(c.toLowerCase());
    if (i !== -1) return i;
  }
  return -1;
}

/* ══════════════════════════════════════════════════
   LOAD: TAB 1 — products
══════════════════════════════════════════════════ */
async function loadProducts() {
  const csv = await fetchCSV(SHEET_URLS.products);
  if (!csv) { allProducts = []; return; }

  const rows = parseCSV(csv);
  if (rows.length < 2) { allProducts = []; return; }

  const headers = rows[0].map(h => h.trim().toLowerCase());
  const iCat   = colIndex(headers, 'category');
  const iBrand = colIndex(headers, 'brand');
  const iName  = colIndex(headers, 'product name');
  const iImg   = colIndex(headers, 'image url', 'image');

  if ([iCat, iBrand, iName].some(i => i === -1)) {
    console.error('[LGS] products sheet: missing required columns. Found:', headers);
    allProducts = []; return;
  }

  allProducts = rows.slice(1)
    .map(row => ({
      category: (row[iCat]   || '').trim(),
      brand:    (row[iBrand] || '').trim(),
      name:     (row[iName]  || '').trim(),
      image:    resolveProductImg(iImg !== -1 ? (row[iImg] || '') : '')
    }))
    .filter(p => p.category && p.brand && p.name);

  console.log(`[LGS] products: ${allProducts.length} rows loaded`);
}

/* ══════════════════════════════════════════════════
   LOAD: TAB 2 — Categories
══════════════════════════════════════════════════ */
async function loadCategoryImages() {
  const csv = await fetchCSV(SHEET_URLS.categories);
  if (!csv) return;

  const rows = parseCSV(csv);
  if (rows.length < 2) return;

  const headers = rows[0].map(h => h.trim().toLowerCase());
  const iName = colIndex(headers, 'categories name', 'category name', 'categories', 'category');
  const iImg  = colIndex(headers, 'image urls', 'image url', 'image');

  if (iName === -1) { console.warn('[LGS] categories sheet: name column not found'); return; }

  categoryImages = {};
  rows.slice(1).forEach(row => {
    const name = (row[iName] || '').trim();
    const img  = iImg !== -1 ? (row[iImg] || '').trim() : '';
    if (name) categoryImages[name] = resolveCategoryImg(img);
  });

  console.log(`[LGS] category images: ${Object.keys(categoryImages).length} entries`);
}

/* ══════════════════════════════════════════════════
   LOAD: TAB 3 — Brands
══════════════════════════════════════════════════ */
async function loadBrandImages() {
  const csv = await fetchCSV(SHEET_URLS.brands);
  if (!csv) return;

  const rows = parseCSV(csv);
  if (rows.length < 2) return;

  const headers = rows[0].map(h => h.trim().toLowerCase());
  const iName = colIndex(headers, 'brands name', 'brand name', 'brands', 'brand');
  const iImg  = colIndex(headers, 'image urls', 'image url', 'image');

  if (iName === -1) { console.warn('[LGS] brands sheet: name column not found'); return; }

  brandImages = {};
  rows.slice(1).forEach(row => {
    const name = (row[iName] || '').trim();
    const img  = iImg !== -1 ? (row[iImg] || '').trim() : '';
    if (name) brandImages[name] = resolveBrandImg(img);
  });

  console.log(`[LGS] brand images: ${Object.keys(brandImages).length} entries`);
}

/* ══════════════════════════════════════════════════
   LOAD: TAB 4 — Laxmi logo
══════════════════════════════════════════════════ */
async function loadStoreLogo() {
  const csv = await fetchCSV(SHEET_URLS.logo);
  if (!csv) return;

  const rows = parseCSV(csv);
  const dataRow = rows.length > 1 ? rows[1] : (rows.length === 1 ? rows[0] : null);
  if (!dataRow) return;

  const raw = (dataRow[1] || dataRow[0] || '').trim();
  storeLogo = resolveLogoImg(raw);
  console.log(`[LGS] store logo: ${storeLogo || '(not set)'}`);
}

/* ══════════════════════════════════════════════════
   LOAD ALL — fetch all 4 tabs in parallel
══════════════════════════════════════════════════ */
async function loadAllData() {
  showLoadingState();
  try {
    await Promise.all([
      loadProducts(),
      loadCategoryImages(),
      loadBrandImages(),
      loadStoreLogo(),
    ]);
    if (!allProducts.length) throw new Error('No products loaded. Check Tab 1 (products) in the sheet.');
    hideLoadingState();
  } catch (err) {
    console.error('[LGS] Data load error:', err);
    hideLoadingState();
    showLoadError(err.message);
  }
}

function showLoadingState() {
  const el = $('loading-overlay');
  if (el) el.style.display = 'flex';
}
function hideLoadingState() {
  const el = $('loading-overlay');
  if (el) el.style.display = 'none';
}
function showLoadError(msg) {
  const el = $('loading-overlay');
  if (!el) return;
  el.innerHTML = `
    <div style="text-align:center;padding:32px;max-width:480px">
      <div style="font-size:2.5rem;margin-bottom:12px">⚠️</div>
      <div style="font-family:'Syne',sans-serif;font-size:1.1rem;font-weight:700;color:#f0f0f5;margin-bottom:8px">
        Could not load product data
      </div>
      <div style="font-size:0.85rem;color:#a0a0b0;line-height:1.6;margin-bottom:20px">${esc(msg)}</div>
      <div style="font-size:0.8rem;color:#666680">
        Make sure all 4 sheet tabs are published:<br>
        File → Share → Publish to web → CSV
      </div>
      <button onclick="location.reload()"
        style="margin-top:20px;padding:10px 24px;border-radius:100px;background:linear-gradient(135deg,#f5a623,#e85d04);color:#fff;font-weight:600;border:none;cursor:pointer;font-size:0.9rem">
        Retry
      </button>
    </div>`;
  el.style.display = 'flex';
}

/* ══════════════════════════════════════════════════
   DATA HELPERS
══════════════════════════════════════════════════ */
const unique         = arr => [...new Set(arr)];
const getCategories  = ()  => unique(allProducts.map(p => p.category));
const getTotalBrands = ()  => unique(allProducts.map(p => p.brand)).length;

const getBrandsForCategory = cat =>
  unique(allProducts.filter(p => p.category === cat).map(p => p.brand));

const getProductsByCategoryAndBrand = (cat, brand) =>
  allProducts.filter(p => p.category === cat && p.brand === brand);

const countProducts   = (cat, brand) => getProductsByCategoryAndBrand(cat, brand).length;
const countByCategory = cat => allProducts.filter(p => p.category === cat).length;

/* ══════════════════════════════════════════════════
   VIEW ROUTER
══════════════════════════════════════════════════ */
function showView(name) {
  VIEWS.forEach(v => {
    const el = $(`view-${v}`);
    if (el) el.classList.remove('active');
  });
  const target = $(`view-${name}`);
  if (target) {
    target.classList.add('active');
    currentView = name;
    syncNavHighlight(name);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function syncNavHighlight(name) {
  const catViews = ['categories', 'category', 'brand', 'product'];
  document.querySelectorAll('.nav-link, .mob-link').forEach(a => {
    const v = a.dataset.view;
    const isHome = v === 'home' && name === 'home';
    const isCat  = v === 'categories' && catViews.includes(name);
    a.classList.toggle('active', isHome || isCat);
  });
}

/* ══════════════════════════════════════════════════
   NAVIGATION OPENERS
══════════════════════════════════════════════════ */

/* ── OPEN CATEGORY ─────────────────────────────── */
/* Fallback called when the category banner image fails to load */
function _catBannerError(fallbackEmoji) {
  const bannerEl   = $('cat-banner');
  const emojiEl    = $('cat-hero-emoji');
  const viewHeroEl = $('view-hero-cat');
  if (bannerEl)   { bannerEl.style.display = 'none'; bannerEl.innerHTML = ''; }
  if (emojiEl)    { emojiEl.textContent = fallbackEmoji; emojiEl.style.display = ''; }
  if (viewHeroEl) viewHeroEl.classList.remove('view-hero--has-banner');
}

function openCategoryWithoutPush(cat) {
  currentCategory = cat;
  currentBrand    = null;
  currentProduct  = null;

  const meta   = CATEGORY_META[cat] || { emoji: '📦', desc: `Browse all products in ${cat}.` };
  /* Single source of truth: same categoryImages map used by renderCategoriesGrid */
  const imgUrl = categoryImages[cat] || '';

  $('cat-breadcrumb').textContent = cat;
  $('cat-hero-title').textContent = cat;
  $('cat-hero-desc').textContent  = meta.desc;
  $('cat-brand-search').value = '';

  const bannerEl   = $('cat-banner');
  const emojiEl    = $('cat-hero-emoji');
  const viewHeroEl = $('view-hero-cat');

  if (imgUrl) {
    /* Build image via DOM — avoids any inline-attr quoting issues */
    const img = document.createElement('img');
    img.alt   = cat;
    img.addEventListener('error', () => _catBannerError(meta.emoji));
    img.src   = imgUrl;  /* set src after listener so error fires correctly */

    if (bannerEl) {
      bannerEl.innerHTML = '';
      bannerEl.appendChild(img);
      bannerEl.style.display = '';
    }
    if (emojiEl)    { emojiEl.textContent = ''; emojiEl.style.display = 'none'; }
    if (viewHeroEl) viewHeroEl.classList.add('view-hero--has-banner');
  } else {
    /* No image available — show emoji fallback only */
    if (bannerEl)   { bannerEl.innerHTML = ''; bannerEl.style.display = 'none'; }
    if (emojiEl)    { emojiEl.textContent = meta.emoji; emojiEl.style.display = ''; }
    if (viewHeroEl) viewHeroEl.classList.remove('view-hero--has-banner');
  }

  renderBrandsGrid('cat-brands-grid', cat, '');
  showView('category');
}
function openCategory(cat) {
  history.pushState({ view: 'category', cat }, '', `#category/${encodeURIComponent(cat)}`);
  openCategoryWithoutPush(cat);
}

/* ── OPEN BRAND ────────────────────────────────── */
function openBrandWithoutPush(cat, brand) {
  currentCategory = cat;
  currentBrand    = brand;
  currentProduct  = null;

  $('brand-cat-bc').textContent     = cat;
  $('brand-breadcrumb').textContent = brand;
  $('brand-back-label').textContent = cat;
  $('brand-hero-title').textContent = brand;
  const cnt = countProducts(cat, brand);
  $('brand-hero-cat-label').textContent = `${cat} · ${cnt} product${cnt !== 1 ? 's' : ''}`;
  $('brand-products-heading').textContent = `${brand} Products in ${cat}`;
  $('brand-prod-search').value = '';

  /* Brand hero logo */
  const heroEl = $('brand-hero-initial');
  if (heroEl) {
    const imgUrl = brandImages[brand] || '';
    if (imgUrl) {
      heroEl.innerHTML = `<img src="${esc(imgUrl)}" alt="${esc(brand)}"
        style="width:100%;height:100%;object-fit:contain;border-radius:inherit"
        onerror="this.parentElement.textContent='${esc(brand.charAt(0).toUpperCase())}'">`;
    } else {
      heroEl.textContent = brand.charAt(0).toUpperCase();
    }
  }

  renderProductsGrid('brand-products-grid', cat, brand, '');
  showView('brand');
}
function openBrand(cat, brand) {
  history.pushState({ view: 'brand', cat, brand }, '', `#brand/${encodeURIComponent(cat)}/${encodeURIComponent(brand)}`);
  openBrandWithoutPush(cat, brand);
}

/* ── OPEN PRODUCT ──────────────────────────────── */
function openProductWithoutPush(productObj) {
  /* Guard: ensure category/brand state is consistent */
  if (productObj.category) currentCategory = productObj.category;
  if (productObj.brand)    currentBrand    = productObj.brand;
  currentProduct = productObj;

  $('prod-cat-bc').textContent     = productObj.category;
  $('prod-brand-bc').textContent   = productObj.brand;
  $('prod-breadcrumb').textContent = productObj.name;
  $('prod-back-label').textContent = productObj.brand;

  renderProductDetail(productObj);
  showView('product');
}
function openProduct(productObj) {
  history.pushState(
    { view: 'product', product: productObj },
    '',
    `#product/${encodeURIComponent(productObj.name)}`
  );
  openProductWithoutPush(productObj);
}

/* ══════════════════════════════════════════════════
   RENDER: CATEGORY GRID
══════════════════════════════════════════════════ */
function renderCategoriesGrid(containerId) {
  const el = $(containerId);
  if (!el) return;
  const cats = getCategories();

  if (!cats.length) {
    el.innerHTML = `<div class="empty-state">
      <div class="es-icon">📦</div>
      <div class="es-title">No categories available</div>
      <div class="es-sub">Data is still loading or the sheet is empty.</div>
    </div>`;
    return;
  }

  el.innerHTML = cats.map(cat => {
    const meta   = CATEGORY_META[cat] || { emoji: '📦' };
    const brands = getBrandsForCategory(cat).length;
    const prods  = countByCategory(cat);
    const imgUrl = categoryImages[cat] || '';

    const imgHtml = imgUrl
      ? `<div class="cat-img-wrap">
           <img src="${esc(imgUrl)}" alt="${esc(cat)}" loading="lazy"
                onerror="this.parentElement.outerHTML='<div class=\\'cat-emoji\\'>${meta.emoji}</div>'">
         </div>`
      : `<div class="cat-emoji">${meta.emoji}</div>`;

    return `
      <div class="category-card" data-cat="${esc(cat)}">
        ${imgHtml}
        <div class="cat-name">${esc(cat)}</div>
        <div class="cat-count">${brands} brand${brands !== 1 ? 's' : ''} · ${prods} product${prods !== 1 ? 's' : ''}</div>
        <div class="cat-arrow">→</div>
      </div>`;
  }).join('');

  el.querySelectorAll('.category-card').forEach(card => {
    card.addEventListener('click', () => openCategory(card.dataset.cat));
  });
}

/* ══════════════════════════════════════════════════
   RENDER: BRANDS GRID
══════════════════════════════════════════════════ */
function renderBrandsGrid(containerId, cat, query) {
  const el = $(containerId);
  if (!el) return;

  let brands = getBrandsForCategory(cat);
  if (query) {
    const q = query.toLowerCase();
    brands = brands.filter(b => b.toLowerCase().includes(q));
  }

  if (!brands.length) {
    el.innerHTML = `<div class="empty-state">
      <div class="es-icon">🔍</div>
      <div class="es-title">No brands found</div>
      <div class="es-sub">Try a different search term</div>
    </div>`;
    return;
  }

  el.innerHTML = brands.map(brand => {
    const count  = countProducts(cat, brand);
    const imgUrl = brandImages[brand] || '';

    const logoHtml = imgUrl
      ? `<div class="brand-logo-wrap">
           <img src="${esc(imgUrl)}" alt="${esc(brand)}" loading="lazy"
                onerror="this.parentElement.outerHTML='<div class=\\'brand-logo-init\\'>${esc(brand.charAt(0).toUpperCase())}</div>'">
         </div>`
      : `<div class="brand-logo-init">${esc(brand.charAt(0).toUpperCase())}</div>`;

    return `
      <div class="brand-card" data-cat="${esc(cat)}" data-brand="${esc(brand)}">
        ${logoHtml}
        <div class="brand-card-name">${esc(brand)}</div>
        <div class="brand-card-count">${count} product${count !== 1 ? 's' : ''}</div>
      </div>`;
  }).join('');

  el.querySelectorAll('.brand-card').forEach(card => {
    card.addEventListener('click', () => openBrand(card.dataset.cat, card.dataset.brand));
  });
}

/* ══════════════════════════════════════════════════
   RENDER: PRODUCTS GRID
══════════════════════════════════════════════════ */
function renderProductsGrid(containerId, cat, brand, query) {
  const el = $(containerId);
  if (!el) return;

  let products = getProductsByCategoryAndBrand(cat, brand);

  if (query) {
    const q = query.toLowerCase();
    products = products.filter(p => p.name.toLowerCase().includes(q));
  }

  if (!products.length) {
    el.innerHTML = `<div class="empty-state">
      <div class="es-icon">📭</div>
      <div class="es-title">No products found</div>
      <div class="es-sub">Try a different search term</div>
    </div>`;
    return;
  }

  const catEmoji = c => (CATEGORY_META[c] || {}).emoji || '📦';

  el.innerHTML = products.map(p => {
    const thumb = p.image
      ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy"
            onerror="this.parentElement.innerHTML='<div class=\\'pc-img-placeholder\\'>${catEmoji(p.category)}</div>'">`
      : `<div class="pc-img-placeholder">${catEmoji(p.category)}</div>`;
    return `
      <div class="product-card"
           data-cat="${esc(p.category)}"
           data-brand="${esc(p.brand)}"
           data-name="${esc(p.name)}"
           data-image="${esc(p.image)}">
        <div class="pc-img-wrap">${thumb}</div>
        <div class="pc-body">
          <div class="pc-brand">${esc(p.brand)}</div>
          <div class="pc-name">${esc(p.name)}</div>
          <div class="pc-cat">${esc(p.category)}</div>
        </div>
      </div>`;
  }).join('');

  el.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', () => openProduct({
      category: card.dataset.cat,
      brand:    card.dataset.brand,
      name:     card.dataset.name,
      image:    card.dataset.image
    }));
  });
}

/* ══════════════════════════════════════════════════
   RENDER: PRODUCT DETAIL
══════════════════════════════════════════════════ */
function renderProductDetail(p) {
  const el = $('product-detail-card');
  if (!el) return;

  const emoji = (CATEGORY_META[p.category] || {}).emoji || '📦';
  const thumb = p.image
    ? `<img src="${esc(p.image)}" alt="${esc(p.name)}"
          onerror="this.parentElement.innerHTML='<div class=\\'pd-img-placeholder\\'>${emoji}</div>'">`
    : `<div class="pd-img-placeholder">${emoji}</div>`;

  const waMsg = encodeURIComponent(
    `Hello Laxmi General Store, I would like to enquire about ${p.name} (${p.brand} – ${p.category}).`
  );

  el.innerHTML = `
    <div class="product-detail">
      <div class="pd-img-wrap">${thumb}</div>
      <div class="pd-info">
        <div class="pd-tags">
          <span class="pd-tag pd-tag-cat">${esc(p.category)}</span>
          <span class="pd-tag pd-tag-brand">${esc(p.brand)}</span>
        </div>
        <h1 class="pd-name">${esc(p.name)}</h1>
        <div class="pd-meta">
          <div class="pd-meta-row">
            <span class="pd-meta-label">Brand</span>
            <span class="pd-meta-val">${esc(p.brand)}</span>
          </div>
          <div class="pd-meta-row">
            <span class="pd-meta-label">Category</span>
            <span class="pd-meta-val">${esc(p.category)}</span>
          </div>
        </div>
        <div class="pd-note">
          <strong>Note:</strong> Available in multiple pack sizes and variants.
          Contact us for bulk orders and wholesale pricing.
        </div>
        <a class="pd-enquire"
           href="https://wa.me/918894472371?text=${waMsg}"
           target="_blank" rel="noopener noreferrer">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          Enquire on WhatsApp
        </a>
      </div>
    </div>`;
}

/* ══════════════════════════════════════════════════
   SEARCH — category-aware results
══════════════════════════════════════════════════ */
function runGlobalSearch(q) {
  if (!q.trim()) return { categories: [], brands: [], products: [] };
  const ql = q.toLowerCase();

  const categories = getCategories().filter(c => c.toLowerCase().includes(ql));

  const brandMap = {};
  allProducts.forEach(p => {
    if (p.brand.toLowerCase().includes(ql) && !brandMap[p.brand]) {
      brandMap[p.brand] = p.category;
    }
  });
  const brands = Object.entries(brandMap).map(([brand, cat]) => ({ brand, cat }));

  const seen = new Set();
  const products = allProducts.filter(p => {
    const key = `${p.category}||${p.brand}||${p.name}`;
    if (p.name.toLowerCase().includes(ql) && !seen.has(key)) {
      seen.add(key); return true;
    }
    return false;
  });

  return {
    categories: categories.slice(0, 3),
    brands:     brands.slice(0, 4),
    products:   products.slice(0, 6)
  };
}

function renderSearchResults(grouped) {
  const el = $('search-results');
  if (!el) return;
  const { categories, brands, products } = grouped;

  if (!categories.length && !brands.length && !products.length) {
    el.innerHTML = '<div class="search-empty">No results found.</div>';
    return;
  }

  let html = '';

  if (categories.length) {
    html += '<div class="search-group-label">Categories</div>';
    html += categories.map(cat => {
      const meta = CATEGORY_META[cat] || { emoji: '📦' };
      return `<div class="search-result-item" role="option" tabindex="0" data-action="open-cat" data-cat="${esc(cat)}">
        <div class="sri-img">${meta.emoji}</div>
        <div class="sri-info">
          <div class="sri-name">${esc(cat)}</div>
          <div class="sri-meta">${getBrandsForCategory(cat).length} brands · ${countByCategory(cat)} products</div>
        </div>
        <span class="sri-type type-category">Category</span>
      </div>`;
    }).join('');
  }

  if (brands.length) {
    html += '<div class="search-group-label">Brands</div>';
    html += brands.map(({ brand, cat }) => `
      <div class="search-result-item" role="option" tabindex="0" data-action="open-brand" data-cat="${esc(cat)}" data-brand="${esc(brand)}">
        <div class="sri-img" style="font-family:'Syne',sans-serif;font-weight:800;font-size:1rem;background:linear-gradient(135deg,#f5a623,#e85d04);color:#fff">
          ${esc(brand.charAt(0).toUpperCase())}
        </div>
        <div class="sri-info">
          <div class="sri-name">${esc(brand)}</div>
          <div class="sri-meta">${esc(cat)} · ${countProducts(cat, brand)} products</div>
        </div>
        <span class="sri-type type-brand">Brand</span>
      </div>`).join('');
  }

  if (products.length) {
    html += '<div class="search-group-label">Products</div>';
    html += products.map(p => {
      const emoji = (CATEGORY_META[p.category] || {}).emoji || '📦';
      const imgSrc = esc(p.image || '');
      const thumb = p.image
        ? `<img src="${imgSrc}" alt="" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.textContent='${emoji}'">`
        : emoji;
      return `<div class="search-result-item" role="option" tabindex="0"
          data-action="open-product"
          data-cat="${esc(p.category)}"
          data-brand="${esc(p.brand)}"
          data-name="${esc(p.name)}"
          data-image="${imgSrc}">
        <div class="sri-img">${thumb}</div>
        <div class="sri-info">
          <div class="sri-name">${esc(p.name)}</div>
          <div class="sri-meta">${esc(p.brand)} · ${esc(p.category)}</div>
        </div>
        <span class="sri-type type-product">Product</span>
      </div>`;
    }).join('');
  }

  el.innerHTML = html;

  /* Bind click + keyboard actions on search results */
  el.querySelectorAll('.search-result-item').forEach(item => {
    const activate = () => {
      const action = item.dataset.action;
      if (action === 'open-cat')     openCategory(item.dataset.cat);
      if (action === 'open-brand')   openBrand(item.dataset.cat, item.dataset.brand);
      if (action === 'open-product') openProduct({
        category: item.dataset.cat,
        brand:    item.dataset.brand,
        name:     item.dataset.name,
        image:    item.dataset.image
      });
      closeSearchBar();
    };
    item.addEventListener('click', activate);
    item.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); } });
  });
}

function openSearchBar() {
  const bar = $('global-search-bar');
  if (!bar) return;
  bar.classList.add('open');
  setTimeout(() => { const inp = $('global-search-input'); if (inp) inp.focus(); }, 80);
}
function closeSearchBar() {
  const bar = $('global-search-bar');
  if (!bar) return;
  bar.classList.remove('open');
  const inp = $('global-search-input');
  if (inp) inp.value = '';
  const res = $('search-results');
  if (res) res.innerHTML = '';
}

/* ══════════════════════════════════════════════════
   STATS COUNTER
══════════════════════════════════════════════════ */
function animateCount(el, target, duration = 900) {
  if (!el || target === 0) { if (el) el.textContent = target; return; }
  let val = 0;
  const step = target / (duration / 16);
  const tick = () => {
    val = Math.min(val + step, target);
    el.textContent = Math.floor(val);
    if (val < target) requestAnimationFrame(tick);
    else el.textContent = target;
  };
  requestAnimationFrame(tick);
}

function renderHomeStats() {
  animateCount($('stat-products'), allProducts.length);
  animateCount($('stat-brands'), getTotalBrands());
  animateCount($('stat-cats'), getCategories().length);
}

/* ══════════════════════════════════════════════════
   ESCAPE HTML HELPER
══════════════════════════════════════════════════ */
function esc(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(String(str || '')));
  return d.innerHTML;
}

/* ══════════════════════════════════════════════════
   EVENT BINDING
══════════════════════════════════════════════════ */
function bindEvents() {

  /* ── Nav logo → home ────────────────────────── */
  $('nav-brand-btn')?.addEventListener('click', () => goHome());
  $('nav-brand-btn')?.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goHome(); } });

  /* ── Nav links (Home + Categories) ─────────── */
  document.querySelectorAll('.nav-link[data-view], .mob-link[data-view]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      const v = a.dataset.view;
      if (v === 'home') goHome();
      else if (v === 'categories') goCategories();
      closeMobileNav();
    });
  });

  /* ── Breadcrumb links with data-view ─────────── */
  document.addEventListener('click', e => {
    const bcLink = e.target.closest('.bc-link[data-view]');
    if (bcLink) {
      e.preventDefault();
      const v = bcLink.dataset.view;
      if (v === 'home') goHome();
      if (v === 'categories') goCategories();
    }
  });

  /* ── Breadcrumb: back-to-cat from brand view ── */
  $('brand-cat-bc')?.addEventListener('click', () => {
    if (currentCategory) openCategory(currentCategory);
    else goCategories();
  });

  /* ── Breadcrumb: back-to-cat from product view  */
  $('prod-cat-bc')?.addEventListener('click', () => {
    if (currentCategory) openCategory(currentCategory);
    else goCategories();
  });

  /* ── Breadcrumb: back-to-brand from product view */
  $('prod-brand-bc')?.addEventListener('click', () => {
    if (currentCategory && currentBrand) openBrand(currentCategory, currentBrand);
    else if (currentCategory) openCategory(currentCategory);
    else goCategories();
  });

  /* ── Back buttons ───────────────────────────── */
  $('cat-back-btn')?.addEventListener('click', () => goCategories());

  $('brand-back-btn')?.addEventListener('click', () => {
    if (currentCategory) openCategory(currentCategory);
    else goCategories();
  });

  $('prod-back-btn')?.addEventListener('click', () => {
    if (currentCategory && currentBrand) openBrand(currentCategory, currentBrand);
    else if (currentCategory) openCategory(currentCategory);
    else goCategories();
  });

  /* ── Hamburger ──────────────────────────────── */
  const ham     = $('hamburger');
  const mobNav  = $('mobile-nav');
  const overlay = $('mobile-overlay');

  function closeMobileNav() {
    ham?.classList.remove('open');
    mobNav?.classList.remove('open');
    overlay?.classList.remove('open');
    ham?.setAttribute('aria-expanded', 'false');
    if (mobNav) mobNav.setAttribute('aria-hidden', 'true');
  }

  ham?.addEventListener('click', () => {
    const isOpen = ham.classList.toggle('open');
    mobNav?.classList.toggle('open', isOpen);
    overlay?.classList.toggle('open', isOpen);
    ham.setAttribute('aria-expanded', String(isOpen));
    if (mobNav) mobNav.setAttribute('aria-hidden', String(!isOpen));
  });
  overlay?.addEventListener('click', closeMobileNav);

  /* Close mobile nav when a link is tapped */
  mobNav?.querySelectorAll('.mob-link').forEach(link => {
    link.addEventListener('click', closeMobileNav);
  });

  window.closeMobileNav = closeMobileNav;

  /* ── Global search ──────────────────────────── */
  $('nav-search-btn')?.addEventListener('click', openSearchBar);
  $('gsc-close')?.addEventListener('click', closeSearchBar);

  $('global-search-input')?.addEventListener('input', e => {
    const q = e.target.value.trim();
    if (!q) { const res = $('search-results'); if (res) res.innerHTML = ''; return; }
    renderSearchResults(runGlobalSearch(q));
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeSearchBar();
  });

  /* ── Hero search ────────────────────────────── */
  function triggerHeroSearch() {
    const heroInput = $('hero-search');
    const q = heroInput?.value.trim();
    if (!q) return;
    openSearchBar();
    const gsi = $('global-search-input');
    if (gsi) { gsi.value = q; renderSearchResults(runGlobalSearch(q)); }
  }
  $('hero-search-btn')?.addEventListener('click', triggerHeroSearch);
  $('hero-search')?.addEventListener('keydown', e => { if (e.key === 'Enter') triggerHeroSearch(); });

  /* ── Category page: brand search ─────────────── */
  $('cat-brand-search')?.addEventListener('input', e => {
    if (currentCategory) renderBrandsGrid('cat-brands-grid', currentCategory, e.target.value);
  });

  /* ── Brand page: product search ──────────────── */
  $('brand-prod-search')?.addEventListener('input', e => {
    if (currentCategory && currentBrand) {
      renderProductsGrid('brand-products-grid', currentCategory, currentBrand, e.target.value);
    }
  });

  /* ── Footer links ───────────────────────────── */
  document.querySelectorAll('.footer-links a[data-view]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      const v = a.dataset.view;
      if (v === 'home') goHome();
      if (v === 'categories') goCategories();
    });
  });

  /* ── Navbar scroll effect ───────────────────── */
  window.addEventListener('scroll', () => {
    $('navbar')?.classList.toggle('scrolled', window.scrollY > 20);
  }, { passive: true });
}

/* ══════════════════════════════════════════════════
   STORE LOGO — inject into navbar + hero
══════════════════════════════════════════════════ */
function applyStoreLogo() {
  if (!storeLogo) return;

  const navIcon = $('nav-logo-img');
  if (navIcon) {
    navIcon.src = storeLogo;
    navIcon.style.display = 'block';
  }

  const heroImg = $('hero-logo-img');
  if (heroImg) {
    heroImg.src = storeLogo;
    heroImg.style.display = 'block';
  }
}

/* ══════════════════════════════════════════════════
   SHORTHAND NAVIGATORS
══════════════════════════════════════════════════ */
function goHome() {
  history.pushState({ view: 'home' }, '', '#');
  showView('home');
}
function goCategories() {
  history.pushState({ view: 'categories' }, '', '#categories');
  renderCategoriesGrid('all-categories-grid');
  showView('categories');
}

/* ══════════════════════════════════════════════════
   POPSTATE — browser back / forward
══════════════════════════════════════════════════ */
window.addEventListener('popstate', function (e) {
  const state = e.state;
  if (!state) { showView('home'); return; }
  switch (state.view) {
    case 'category':
      if (state.cat) openCategoryWithoutPush(state.cat);
      else showView('home');
      break;
    case 'brand':
      if (state.cat && state.brand) openBrandWithoutPush(state.cat, state.brand);
      else if (state.cat) openCategoryWithoutPush(state.cat);
      else showView('home');
      break;
    case 'product':
      if (state.product && state.product.name) openProductWithoutPush(state.product);
      else if (currentCategory && currentBrand) openBrandWithoutPush(currentCategory, currentBrand);
      else showView('home');
      break;
    case 'categories':
      renderCategoriesGrid('all-categories-grid');
      showView('categories');
      break;
    default:
      showView('home');
  }
});

/* ══════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════ */
async function init() {
  await loadAllData();
  applyStoreLogo();
  renderHomeStats();
  renderCategoriesGrid('home-categories-grid');
  bindEvents();
  history.replaceState({ view: 'home' }, '', window.location.href);
  showView('home');
}

document.addEventListener('DOMContentLoaded', init);
