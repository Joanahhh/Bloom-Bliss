/* ==========================================================================
   Bloom & Bliss — Every Bloom Tells a Story
   Vanilla JavaScript storefront (FRONTEND DEMO).

   IMPORTANT: Accounts, passwords, orders and "payments" are simulated and
   stored in this browser's localStorage. A real shop needs a secure backend
   (authentication, hashed passwords, a database, a payment gateway, inventory
   sync) — never store real customer or card data like this.
   ========================================================================== */
'use strict';

(function () {

  /* ------------------------------------------------------------------------
     1. Helpers
     ------------------------------------------------------------------------ */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const f1 = (n) => +n.toFixed(1);

  const PESO = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 });
  const peso = (n) => PESO.format(Math.round(n));

  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem('bb_' + key); return v === null ? fallback : JSON.parse(v); }
      catch (e) { return fallback; }
    },
    set(key, value) { try { localStorage.setItem('bb_' + key, JSON.stringify(value)); } catch (e) { /* storage full or blocked */ } },
    clearAll() { try { Object.keys(localStorage).filter((k) => k.indexOf('bb_') === 0).forEach((k) => localStorage.removeItem(k)); } catch (e) { /* ignore */ } }
  };

  // Demo-only hash. NOT secure — a real site hashes passwords on the server (bcrypt/argon2).
  function hash(str) {
    let h = 5381; const t = 'bb|' + str;
    for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) >>> 0;
    return h.toString(16);
  }

  const dateStr = (offsetDays = 0) => {
    const d = new Date(); d.setDate(d.getDate() + offsetDays);
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  };
  const prettyDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
    return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  /* ------------------------------------------------------------------------
     2. Constants & sample data
     ------------------------------------------------------------------------ */
  const DELIVERY_FEE = 150;
  const FREE_SHIP_MIN = 3000;
  const STATUSES = ['Pending', 'Preparing', 'Out for Delivery', 'Delivered'];
  const TIME_SLOTS = ['9:00 AM – 12:00 NN', '12:00 NN – 3:00 PM', '3:00 PM – 6:00 PM', '6:00 PM – 8:00 PM'];

  const PAL = {
    red: ['#B3122E', '#D42A47', '#7E0C20'],
    pink: ['#F2A7B8', '#F8CAD5', '#D9778F'],
    blush: ['#F6D3D8', '#FBE8EB', '#E8A9B6'],
    burgundy: ['#70263D', '#8C3550', '#4A1728'],
    white: ['#FFFFFF', '#F4EEE7', '#D8CCBF'],
    yellow: ['#F4B400', '#FFD23F', '#C98A00'],
    lavender: ['#B9A3D6', '#D7C8EC', '#8F77B8'],
    peach: ['#F6B79C', '#FAD2BE', '#E58F6E']
  };
  const BG = {
    blush: ['#FFF8F8', '#F2D4D9'], ivory: ['#FFFFFF', '#F1E7DA'], sage: ['#F3F5EE', '#CBD5BE'],
    gold: ['#FFF9EE', '#EBD6B2'], maroon: ['#9A4560', '#4A1728']
  };
  const WRAP_COLOR = { kraft: '#D9BF9B', blush: '#F6E7E8', burgundy: '#70263D', ivory: '#F9F5EF', sage: '#A8B49A' };

  const CATEGORIES = [
    { id: 'roses', label: 'Roses', blurb: 'Timeless symbols of love', art: { kinds: ['rose'], pals: ['red'], n: 5, wrap: 'blush', ribbon: '#70263D', bg: 'blush' } },
    { id: 'tulips', label: 'Tulips', blurb: 'Fresh, soft & springtime', art: { kinds: ['tulip'], pals: ['pink'], n: 5, wrap: 'ivory', ribbon: '#A8B49A', bg: 'ivory' } },
    { id: 'sunflowers', label: 'Sunflowers', blurb: 'Sunshine in a bouquet', art: { kinds: ['sunflower'], pals: ['yellow'], n: 5, wrap: 'kraft', ribbon: '#70263D', bg: 'gold' } },
    { id: 'lilies', label: 'Lilies', blurb: 'Elegant, graceful & fragrant', art: { kinds: ['lily'], pals: ['white'], n: 5, wrap: 'sage', ribbon: '#F9F5EF', bg: 'sage' } },
    { id: 'mixed', label: 'Mixed Bouquets', blurb: 'A little of everything lovely', art: { kinds: ['rose', 'tulip', 'lily'], pals: ['pink', 'blush', 'white'], n: 7, wrap: 'blush', ribbon: '#70263D', bg: 'ivory', filler: true } },
    { id: 'premium', label: 'Premium Bouquets', blurb: 'Luxurious statement pieces', art: { kinds: ['rose', 'lily'], pals: ['burgundy', 'blush'], n: 7, wrap: 'burgundy', ribbon: '#D4B483', bg: 'maroon', filler: true } },
    { id: 'mini', label: 'Mini Bouquets', blurb: 'Small gifts, big smiles', art: { kinds: ['tulip', 'rose'], pals: ['peach', 'pink'], n: 3, wrap: 'kraft', ribbon: '#70263D', bg: 'blush' } },
    { id: 'gifts', label: 'Flower Gift Sets', blurb: 'Boxed blooms that last', art: { kinds: ['rose'], pals: ['pink', 'burgundy'], n: 5, wrap: 'ivory', ribbon: '#D4B483', bg: 'ivory', box: true } }
  ];

  const ADDON_CATS = [
    { id: 'addon-cards', label: 'Cards & Messages' },
    { id: 'addon-wrap', label: 'Wrapping & Ribbon' },
    { id: 'addon-gifts', label: 'Gifts & Extras' }
  ];
  const isAddon = (p) => !!p && String(p.category || '').indexOf('addon-') === 0;

  const OCCASIONS = [
    { id: 'birthday', label: 'Birthday', blurb: 'Make their day bloom', art: { kinds: ['tulip', 'rose'], pals: ['peach', 'pink'], n: 5, wrap: 'blush', ribbon: '#D4B483', bg: 'gold' } },
    { id: 'anniversary', label: 'Anniversary', blurb: 'Celebrate your love story', art: { kinds: ['rose'], pals: ['burgundy', 'red'], n: 7, wrap: 'burgundy', ribbon: '#D4B483', bg: 'maroon' } },
    { id: 'graduation', label: 'Graduation', blurb: 'Congrats, future leader', art: { kinds: ['sunflower', 'daisy'], pals: ['yellow', 'white'], n: 5, wrap: 'kraft', ribbon: '#70263D', bg: 'gold' } },
    { id: 'wedding', label: 'Wedding', blurb: 'For the happiest day', art: { kinds: ['rose', 'lily'], pals: ['white', 'blush'], n: 7, wrap: 'ivory', ribbon: '#A8B49A', bg: 'ivory', filler: true } },
    { id: 'valentines', label: "Valentine's Day", blurb: 'Say it with roses', art: { kinds: ['rose'], pals: ['red'], n: 7, wrap: 'blush', ribbon: '#70263D', bg: 'blush' } },
    { id: 'congratulations', label: 'Congratulations', blurb: 'Celebrate big wins', art: { kinds: ['tulip'], pals: ['pink', 'peach'], n: 5, wrap: 'sage', ribbon: '#D4B483', bg: 'sage' } },
    { id: 'sympathy', label: 'Sympathy', blurb: 'Gentle words in white', art: { kinds: ['lily'], pals: ['white'], n: 5, wrap: 'ivory', ribbon: '#A8B49A', bg: 'sage' } },
    { id: 'just-because', label: 'Just Because', blurb: 'No reason needed', art: { kinds: ['tulip', 'daisy', 'rose'], pals: ['lavender', 'white', 'pink'], n: 5, wrap: 'kraft', ribbon: '#70263D', bg: 'blush', filler: true } }
  ];

  /* ------------------------------------------------------------------------
     3. State (persisted in localStorage)
     ------------------------------------------------------------------------ */
  const state = {
    products: [],
    customProducts: store.get('products', null) !== null, // true once an admin edit or an order has changed the catalog
    cart: store.get('cart', []),
    wish: store.get('wish', []),
    users: store.get('users', null),
    session: store.get('session', null),
    orders: store.get('orders', []),
    messages: store.get('messages', []),
    promo: store.get('promo', null)
  };
  if (!state.users) {
    state.users = [{ name: 'Shop Admin', email: 'admin@bloombliss.demo', pass: hash('Admin@123'), role: 'admin' }];
    store.set('users', state.users);
  }

  /* The product catalog is written in index.html (#shopGrid > .product-card, data-* attributes).
     On a fresh load we read it from there; after admin edits / orders the saved copy in localStorage wins. */
  function readProductsFromDOM() {
    return $$('#shopGrid > .product-card, #addonGrid > .product-card').map((el) => {
      const d = el.dataset; const text = (sel) => ($(sel, el) ? $(sel, el).textContent.trim() : '');
      let art = {}; try { art = JSON.parse(d.art || '{}'); } catch (e) { /* ignore bad art */ }
      const img = $('.media-btn img', el);
      return {
        id: d.id, name: text('h3'), category: d.category, price: +d.price, stock: +d.stock,
        rating: +d.rating, reviews: +d.reviews, best: d.best === 'true', message: d.message === 'true',
        occasions: (d.occasions || '').split(',').filter(Boolean), desc: text('.desc'), art,
        image: img ? (img.getAttribute('src') || '').trim() : ''
      };
    });
  }
  const domProducts = readProductsFromDOM();
  state.products = state.customProducts ? store.get('products', []) : domProducts;
  // The image written in index.html always wins, even after orders/admin edits were saved in localStorage.
  state.products.forEach((p) => { const d = domProducts.find((x) => x.id === p.id); if (d && d.image) p.image = d.image; if (d && isAddon(d)) p.message = d.message; });
  // Add-ons written in index.html that are missing from an older saved catalog are added automatically.
  domProducts.forEach((d) => { if (isAddon(d) && !state.products.some((p) => p.id === d.id)) state.products.push(d); });

  const save = (...keys) => keys.forEach((k) => { if (k === 'products') state.customProducts = true; store.set(k, state[k]); });
  const getProduct = (id) => state.products.find((p) => p.id === id);
  const currentUser = () => state.users.find((u) => u.email === state.session) || null;
  const isAdmin = () => { const u = currentUser(); return !!u && u.role === 'admin'; };
  const catLabel = (id) => (CATEGORIES.concat(ADDON_CATS).find((c) => c.id === id) || { label: id }).label;
  const occLabel = (id) => (OCCASIONS.find((o) => o.id === id) || { label: id }).label;

  /* ------------------------------------------------------------------------
     4. SVG bouquet artwork (no external images required)
     ------------------------------------------------------------------------ */
  let uid = 0;
  const POS = [[200, 150, 56], [132, 185, 48], [268, 185, 48], [168, 98, 40], [234, 98, 40], [96, 238, 36], [304, 238, 36]];
  const FILLERS = [[86, 176, 13], [314, 176, 13], [148, 62, 12], [252, 62, 12], [200, 52, 11]];

  function drawFlower(kind, x, y, r, pal) {
    const c = pal;
    if (kind === 'sunflower') {
      let s = '';
      for (let i = 0; i < 16; i++) {
        s += `<ellipse cx="${x}" cy="${f1(y - r * .72)}" rx="${f1(r * .16)}" ry="${f1(r * .36)}" fill="${i % 2 ? PAL.yellow[0] : PAL.yellow[1]}" transform="rotate(${i * 22.5} ${x} ${y})" stroke="${PAL.yellow[2]}" stroke-opacity=".35" stroke-width="1"/>`;
      }
      s += `<circle cx="${x}" cy="${y}" r="${f1(r * .42)}" fill="#5A3A22"/><circle cx="${x}" cy="${y}" r="${f1(r * .3)}" fill="#3F2616"/>`;
      for (let i = 0; i < 7; i++) { const a = i * 51.4 * Math.PI / 180; s += `<circle cx="${f1(x + Math.cos(a) * r * .17)}" cy="${f1(y + Math.sin(a) * r * .17)}" r="${f1(r * .03)}" fill="#8A5A34"/>`; }
      return s;
    }
    if (kind === 'tulip') {
      return `<path d="M${f1(x - r * .75)} ${f1(y - r * .5)} Q${f1(x - r * .8)} ${f1(y + r * .9)} ${x} ${f1(y + r * .95)} Q${f1(x + r * .8)} ${f1(y + r * .9)} ${f1(x + r * .75)} ${f1(y - r * .5)} L${f1(x + r * .4)} ${f1(y - r * .95)} L${x} ${f1(y - r * .45)} L${f1(x - r * .4)} ${f1(y - r * .95)} Z" fill="${c[0]}" stroke="${c[2]}" stroke-opacity=".4" stroke-width="1.5"/>` +
        `<path d="M${x} ${f1(y - r * .55)} Q${f1(x - r * .45)} ${f1(y + r * .4)} ${x} ${f1(y + r * .95)} Q${f1(x + r * .45)} ${f1(y + r * .4)} ${x} ${f1(y - r * .55)}Z" fill="${c[1]}" opacity=".92"/>`;
    }
    if (kind === 'lily') {
      let s = '';
      for (let i = 0; i < 6; i++) {
        s += `<path d="M${x} ${y} Q${f1(x + r * .34)} ${f1(y - r * .5)} ${x} ${f1(y - r)} Q${f1(x - r * .34)} ${f1(y - r * .5)} ${x} ${y}Z" fill="${c[0]}" stroke="${c[2]}" stroke-opacity=".55" stroke-width="1.4" transform="rotate(${i * 60} ${x} ${y})"/>` +
          `<path d="M${x} ${f1(y - r * .12)} L${x} ${f1(y - r * .7)}" stroke="${c[2]}" stroke-opacity=".5" stroke-width="1.2" transform="rotate(${i * 60} ${x} ${y})"/>`;
      }
      for (let i = 0; i < 5; i++) { const a = (i * 72 - 90) * Math.PI / 180; s += `<line x1="${x}" y1="${y}" x2="${f1(x + Math.cos(a) * r * .42)}" y2="${f1(y + Math.sin(a) * r * .42)}" stroke="#A8B49A" stroke-width="2"/><circle cx="${f1(x + Math.cos(a) * r * .42)}" cy="${f1(y + Math.sin(a) * r * .42)}" r="${f1(r * .07)}" fill="#D4B483"/>`; }
      return s;
    }
    if (kind === 'daisy') {
      let s = '';
      for (let i = 0; i < 9; i++) s += `<ellipse cx="${x}" cy="${f1(y - r * .55)}" rx="${f1(r * .2)}" ry="${f1(r * .42)}" fill="#fff" stroke="#E5DCD2" stroke-width="1" transform="rotate(${i * 40} ${x} ${y})"/>`;
      return s + `<circle cx="${x}" cy="${y}" r="${f1(r * .26)}" fill="#D4B483"/>`;
    }
    // rose (default)
    let s = '';
    for (let i = 0; i < 6; i++) {
      const a = i * 60 * Math.PI / 180;
      s += `<circle cx="${f1(x + Math.cos(a) * r * .52)}" cy="${f1(y + Math.sin(a) * r * .52)}" r="${f1(r * .5)}" fill="${c[0]}" stroke="${c[2]}" stroke-opacity=".35" stroke-width="1.2"/>`;
    }
    s += `<circle cx="${x}" cy="${y}" r="${f1(r * .56)}" fill="${c[1]}" stroke="${c[2]}" stroke-opacity=".35" stroke-width="1.2"/>`;
    s += `<circle cx="${x}" cy="${y}" r="${f1(r * .34)}" fill="${c[0]}" stroke="${c[2]}" stroke-opacity=".4" stroke-width="1.2"/>`;
    s += `<path d="M${f1(x - r * .22)} ${y} a${f1(r * .22)} ${f1(r * .22)} 0 1 1 ${f1(r * .4)} ${f1(r * .16)}" fill="none" stroke="${c[2]}" stroke-width="2" stroke-linecap="round" opacity=".7"/>`;
    return s;
  }

  function bouquetSVG(a, label) {
    a = a || {};
    const id = 'bg' + (++uid);
    const bg = BG[a.bg] || BG.blush;
    const n = Math.max(1, Math.min(7, a.n || 5));
    const kinds = a.kinds && a.kinds.length ? a.kinds : ['rose'];
    const pals = a.pals && a.pals.length ? a.pals : ['pink'];
    const wrap = WRAP_COLOR[a.wrap] || a.wrap || WRAP_COLOR.blush;
    const ribbon = a.ribbon || '#70263D';
    const light = a.bg === 'maroon';

    let s = `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(label || 'Bouquet illustration')}">` +
      `<defs><radialGradient id="${id}" cx="50%" cy="38%" r="78%"><stop offset="0" stop-color="${bg[0]}"/><stop offset="1" stop-color="${bg[1]}"/></radialGradient></defs>` +
      `<rect width="400" height="400" fill="url(#${id})"/>` +
      `<circle cx="70" cy="70" r="46" fill="#fff" opacity="${light ? .07 : .35}"/><circle cx="340" cy="330" r="64" fill="#fff" opacity="${light ? .06 : .28}"/><circle cx="352" cy="64" r="22" fill="${PAL.blush[0]}" opacity=".35"/>`;

    const pick = (i) => {
      const kind = kinds[i % kinds.length];
      let pal = PAL[pals[i % pals.length]] || PAL.pink;
      if (kind === 'sunflower') pal = PAL.yellow;
      if (kind === 'daisy') pal = PAL.white;
      return { kind, pal };
    };

    if (a.box) {
      const spots = [[128, 236, 42], [200, 214, 48], [272, 236, 42], [164, 244, 34], [236, 244, 34]];
      s += `<ellipse cx="200" cy="362" rx="130" ry="14" fill="#000" opacity=".12"/>`;
      s += `<rect x="78" y="258" width="244" height="96" rx="10" fill="${wrap}" stroke="rgba(53,37,43,.2)"/>`;
      for (let i = spots.length - 1; i >= 0; i--) { const p = pick(i); s += drawFlower(p.kind, spots[i][0], spots[i][1], spots[i][2], p.pal); }
      s += `<rect x="70" y="262" width="260" height="38" rx="9" fill="${wrap}" stroke="rgba(53,37,43,.22)"/><rect x="70" y="262" width="260" height="10" rx="5" fill="#fff" opacity=".35"/>`;
      s += `<rect x="78" y="300" width="244" height="54" fill="${wrap}" stroke="rgba(53,37,43,.2)"/><rect x="190" y="262" width="20" height="92" fill="${ribbon}"/>`;
      s += `<path d="M200 286 C168 256 160 306 200 286 C240 256 232 306 200 286Z" fill="${ribbon}" stroke="rgba(0,0,0,.15)"/><circle cx="200" cy="286" r="6" fill="${ribbon}" stroke="rgba(0,0,0,.2)"/>`;
      return s + '</svg>';
    }

    const spots = POS.slice(0, n).map((p) => p.slice());
    const scale = n <= 3 ? 1.15 : 1;
    if (n <= 3) { spots[1][1] -= 10; spots[2][1] -= 10; }
    const stemCol = '#7D8F6C';
    spots.forEach((p) => { s += `<path d="M${p[0]} ${p[1]} Q${f1((p[0] + 200) / 2)} ${p[1] + 90} 200 335" stroke="${stemCol}" stroke-width="5" fill="none" stroke-linecap="round"/>`; });
    s += `<ellipse cx="108" cy="212" rx="36" ry="12" fill="#8FA07E" transform="rotate(-32 108 212)"/><ellipse cx="292" cy="212" rx="36" ry="12" fill="#8FA07E" transform="rotate(32 292 212)"/>` +
      `<ellipse cx="150" cy="138" rx="30" ry="10" fill="#9DAE8C" transform="rotate(-55 150 138)"/><ellipse cx="250" cy="138" rx="30" ry="10" fill="#9DAE8C" transform="rotate(55 250 138)"/>`;
    s += `<path d="M104 236 L296 236 L224 394 L176 394 Z" fill="${wrap}" stroke="rgba(53,37,43,.2)" stroke-width="1.5"/>`;
    if (a.filler) FILLERS.forEach((p) => { s += drawFlower('daisy', p[0], p[1], p[2], PAL.white); });
    for (let i = spots.length - 1; i >= 0; i--) {
      const p = pick(i); const r = spots[i][2] * scale * (p.kind === 'sunflower' ? 1.05 : 1);
      s += drawFlower(p.kind, spots[i][0], spots[i][1], f1(r), p.pal);
    }
    s += `<path d="M116 266 L200 248 L284 266 L224 394 L176 394 Z" fill="${wrap}" stroke="rgba(53,37,43,.22)" stroke-width="1.5"/>` +
      `<path d="M200 248 L200 394 M158 330 L200 262 M242 330 L200 262" stroke="rgba(53,37,43,.14)" stroke-width="1.4" fill="none"/>` +
      `<path d="M116 266 L200 248 L200 300 Z" fill="#fff" opacity=".25"/>`;
    s += `<path d="M150 300 Q200 318 250 300" stroke="${ribbon}" stroke-width="9" fill="none" stroke-linecap="round"/>` +
      `<path d="M200 304 C162 274 150 336 200 304 C250 274 238 336 200 304Z" fill="${ribbon}" stroke="rgba(0,0,0,.18)"/>` +
      `<path d="M200 308 L182 352 M200 308 L218 352" stroke="${ribbon}" stroke-width="6" stroke-linecap="round"/><circle cx="200" cy="304" r="7" fill="${ribbon}" stroke="rgba(0,0,0,.25)"/>`;
    return s + '</svg>';
  }

  /* Product pictures: use the image path/URL written in index.html (or typed in the admin form).
     If there is no image, or it fails to load, the built-in SVG illustration is shown instead. */
  function itemImage(item) {
    const live = item && item.pid ? getProduct(item.pid) : null;
    return ((live && live.image) || (item && item.image) || '').trim();
  }
  function prodMedia(item, label) {
    const src = itemImage(item);
    if (!src && item && item.art && item.art.emoji) return `<span class="addon-emoji" aria-hidden="true">${esc(item.art.emoji)}</span>`;
    if (!src && item && item.emoji) return `<span class="addon-emoji" aria-hidden="true">${item.emoji}</span>`;
    if (!src) return bouquetSVG(item && item.art, label);
    return `<img class="prod-img" ${item && item.emoji ? `data-emoji="${esc(item.emoji)}" ` : ''}src="${esc(src)}" alt="${esc(label || '')}" loading="lazy" data-art="${esc(JSON.stringify((item && item.art) || {}))}">`;
  }
  function swapToIllustration(img) {
    if (!img || img.dataset.fallback) return;
    img.dataset.fallback = '1';
    if (img.dataset.emoji) { const t = document.createElement('span'); t.className = 'addon-emoji'; t.textContent = img.dataset.emoji; img.replaceWith(t); return; }
    let art = {};
    try { art = JSON.parse(img.dataset.art || (img.closest('[data-art]') ? img.closest('[data-art]').dataset.art : '{}') || '{}'); } catch (e) { /* ignore */ }
    const holder = document.createElement('span');
    holder.style.display = 'contents';
    holder.innerHTML = art && art.emoji ? `<span class="addon-emoji" aria-hidden="true">${esc(art.emoji)}</span>` : bouquetSVG(art, img.alt);
    img.replaceWith(holder);
  }
  function checkImages(root) {
    $$('img.prod-img', root || document).forEach((img) => {
      const src = (img.getAttribute('src') || '').trim();
      if (!src || (img.complete && img.naturalWidth === 0)) swapToIllustration(img);
    });
  }
  // 'error' does not bubble, so listen in the capture phase.
  document.addEventListener('error', (e) => { if (e.target && e.target.tagName === 'IMG' && e.target.classList.contains('prod-img')) swapToIllustration(e.target); }, true);

  const ICON_HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21z"/></svg>';

  /* ------------------------------------------------------------------------
     5. UI utilities: toast, modal, validation, reveal
     ------------------------------------------------------------------------ */
  function toast(msg, type) {
    const wrap = $('#toasts'); if (!wrap) return;
    const t = document.createElement('div');
    t.className = 'toast' + (type === 'error' ? ' error' : '');
    t.textContent = msg;
    wrap.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, 3200);
    while (wrap.children.length > 4) wrap.firstChild.remove();
  }

  let lastFocus = null;
  let modalResolve = null;
  function openModal(html, cls) {
    const m = $('#modal');
    lastFocus = document.activeElement;
    m.innerHTML = '<div class="modal-backdrop" data-action="close-modal"></div>' +
      `<div class="modal-card ${cls || ''}" role="dialog" aria-modal="true" tabindex="-1"><button class="modal-close" data-action="close-modal" aria-label="Close dialog">×</button>${html}</div>`;
    m.hidden = false;
    document.body.classList.add('no-scroll');
    const card = $('.modal-card', m); if (card) card.focus();
  }
  function closeModal() {
    const m = $('#modal'); if (!m || m.hidden) return;
    m.hidden = true; m.innerHTML = '';
    document.body.classList.remove('no-scroll');
    if (modalResolve) { const r = modalResolve; modalResolve = null; r(false); }
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) { /* ignore */ } }
  }
  function confirmBox(title, message, okLabel) {
    return new Promise((resolve) => {
      openModal(`<h2>${esc(title)}</h2><p>${esc(message)}</p><div class="modal-actions"><button class="btn btn-ghost btn-sm" data-action="close-modal">Cancel</button><button class="btn btn-danger btn-sm" data-action="confirm-ok">${esc(okLabel || 'Confirm')}</button></div>`, 'small');
      modalResolve = resolve;
    });
  }

  /** Validates a form using a rules map { fieldName: (value, allData) => errorMessage|'' } */
  function validate(form, rules) {
    const data = {}; new FormData(form).forEach((v, k) => { data[k] = v; });
    let ok = true; let first = null;
    Object.keys(rules).forEach((name) => {
      const msg = rules[name](String(data[name] == null ? '' : data[name]).trim(), data) || '';
      const err = form.querySelector(`[data-error-for="${name}"]`);
      if (err) err.textContent = msg;
      let el = form.elements[name];
      if (typeof RadioNodeList !== 'undefined' && el instanceof RadioNodeList) el = el[0];
      if (el && el.setAttribute) el.setAttribute('aria-invalid', msg ? 'true' : 'false');
      if (msg) { ok = false; if (!first) first = el; }
    });
    if (first && first.focus) first.focus();
    if (!ok) return null;
    Object.keys(data).forEach((k) => { if (typeof data[k] === 'string') data[k] = data[k].trim(); });
    return data;
  }
  document.addEventListener('input', (e) => {
    const t = e.target; if (!t || !t.name || !t.form) return;
    const err = t.form.querySelector(`[data-error-for="${t.name}"]`);
    if (err && err.textContent) { err.textContent = ''; t.removeAttribute('aria-invalid'); }
  });
  document.addEventListener('change', (e) => {
    const t = e.target; if (!t || !t.name || !t.form) return;
    const err = t.form.querySelector(`[data-error-for="${t.name}"]`);
    if (err && err.textContent) { err.textContent = ''; t.removeAttribute('aria-invalid'); }
  });

  let io = null;
  function observeReveals() {
    const els = $$('.reveal:not(.in)');
    if (!('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('in')); return; }
    if (!io) io = new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { threshold: .08, rootMargin: '0px 0px -30px 0px' });
    els.forEach((el) => io.observe(el));
  }

  /* ------------------------------------------------------------------------
     6. Product card + shared render helpers
     ------------------------------------------------------------------------ */
  const stars = (r) => `<span class="stars" style="--r:${f1(r / 5 * 100)}%" role="img" aria-label="Rated ${r} out of 5">★★★★★</span>`;

  function productCard(p) {
    const out = p.stock <= 0; const low = !out && p.stock <= 5;
    const wished = state.wish.includes(p.id);
    const tag = out ? '<span class="tag out">Sold out</span>' : p.best ? '<span class="tag">Bestseller</span>' : low ? '<span class="tag">Low stock</span>' : '';
    return `<article class="card product-card reveal" data-id="${esc(p.id)}" data-category="${esc(p.category)}" data-price="${p.price}" data-stock="${p.stock}" data-rating="${p.rating}" data-reviews="${p.reviews}" data-best="${!!p.best}" ${p.message ? 'data-message="true" ' : ''}data-occasions="${esc((p.occasions || []).join(','))}" data-art="${esc(JSON.stringify(p.art))}">
      <div class="card-media">
        <button class="wish-btn ${wished ? 'active' : ''}" data-action="wish" data-id="${esc(p.id)}" aria-pressed="${wished}" aria-label="${wished ? 'Remove from' : 'Add to'} wishlist: ${esc(p.name)}">${ICON_HEART}</button>
        ${tag}
        <button class="media-btn" data-action="quick" data-id="${esc(p.id)}" aria-label="Quick view: ${esc(p.name)}">${prodMedia(p, p.name)}</button>
      </div>
      <div class="card-body">
        <p class="eyebrow">${esc(catLabel(p.category))}</p>
        <h3>${esc(p.name)}</h3>
        <p class="desc">${esc(p.desc)}</p>
        ${p.message ? `<label class="sr-only" for="msg-${esc(p.id)}">Your message for ${esc(p.name)}</label><textarea id="msg-${esc(p.id)}" class="addon-msg" maxlength="300" placeholder="Write your own message for the card (optional)"></textarea>` : ''}
        ${p.reviews ? `<div class="rating">${stars(p.rating)} <span>${p.rating.toFixed(1)} (${p.reviews})</span></div>` : ''}
        <div class="card-foot">
          <span class="price">${peso(p.price)}</span>
          <button class="btn btn-primary btn-sm" data-action="add" data-id="${esc(p.id)}" ${out ? 'disabled' : ''}>${out ? 'Sold out' : 'Add to Cart'}</button>
        </div>
        <p class="stock ${out ? 'none' : low ? 'low' : ''}">${out ? 'Currently unavailable' : low ? 'Only ' + p.stock + ' left' : 'In stock · ' + p.stock + ' available'}</p>
      </div>
    </article>`;
  }

  function tile(href, label, blurb, art) {
    return `<a class="card tile reveal" href="${href}"><div class="card-media">${bouquetSVG(art, label)}</div><div class="card-body"><h3>${esc(label)}</h3><p>${esc(blurb)}</p></div></a>`;
  }

  /* ------------------------------------------------------------------------
     7. Cart logic
     ------------------------------------------------------------------------ */
  function syncCart() {
    let changed = false;
    state.cart = state.cart.filter((line) => {
      if (!line.pid) return true;
      const p = getProduct(line.pid);
      if (!p || p.stock <= 0) { changed = true; return false; }
      if (line.price !== p.price || line.name !== p.name) { line.price = p.price; line.name = p.name; changed = true; }
      if (line.qty > p.stock) { line.qty = p.stock; changed = true; }
      return true;
    });
    if (changed) save('cart');
  }

  function totals() {
    const subtotal = state.cart.reduce((s, i) => s + i.price * i.qty, 0);
    const count = state.cart.reduce((s, i) => s + i.qty, 0);
    let discount = 0; let freeShip = false;
    if (state.promo === 'BLOOM10') discount = Math.round(subtotal * 0.1);
    if (state.promo === 'FREESHIP') freeShip = true;
    const after = subtotal - discount;
    const delivery = (!state.cart.length || freeShip || after >= FREE_SHIP_MIN) ? 0 : DELIVERY_FEE;
    return { subtotal, discount, delivery, total: after + delivery, count };
  }

  function addToCart(pid, trigger) {
    const p = getProduct(pid);
    if (!p || p.stock <= 0) { toast('Sorry, this item is sold out.', 'error'); return; }
    // Items with a message box (greeting cards): the customer's own letter travels with the cart line.
    const scope = trigger && trigger.closest ? trigger.closest('.product-card, .quick') : null;
    const box = p.message && scope ? scope.querySelector('.addon-msg') : null;
    const message = box ? box.value.trim() : '';
    const inCart = state.cart.filter((i) => i.pid === pid).reduce((n, i) => n + i.qty, 0);
    if (inCart >= p.stock) { toast('Only ' + p.stock + ' available for ' + p.name + '.', 'error'); return; }
    const line = state.cart.find((i) => i.pid === pid && (i.message || '') === message);
    if (line) {
      line.qty++;
    } else {
      state.cart.push({ key: 'k' + Date.now() + Math.random().toString(36).slice(2, 6), pid, name: p.name, price: p.price, qty: 1, art: p.art, image: p.image || '', note: catLabel(p.category), message });
    }
    save('cart'); updateBadges(); toast(p.name + ' added to cart');
    if (box) box.value = '';
    if (currentPage === 'cart') renderCart();
  }
  function changeQty(key, delta) {
    const line = state.cart.find((i) => i.key === key); if (!line) return;
    const next = line.qty + delta;
    if (next <= 0) { removeLine(key); return; }
    if (line.pid) { const p = getProduct(line.pid); if (p && next > p.stock) { toast('Only ' + p.stock + ' available.', 'error'); return; } }
    if (next > 20) { toast('Maximum 20 per item.', 'error'); return; }
    line.qty = next; save('cart'); updateBadges(); renderCart();
  }
  function removeLine(key) {
    const line = state.cart.find((i) => i.key === key);
    state.cart = state.cart.filter((i) => i.key !== key);
    save('cart'); updateBadges(); renderCart();
    if (line) toast(line.name + ' removed from cart');
  }

  function toggleWish(pid) {
    const i = state.wish.indexOf(pid);
    if (i >= 0) { state.wish.splice(i, 1); toast('Removed from wishlist'); } else { state.wish.push(pid); toast('Saved to wishlist ♡'); }
    save('wish'); updateBadges();
    $$(`.wish-btn[data-id="${pid}"]`).forEach((b) => { const on = state.wish.includes(pid); b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); });
    if (currentPage === 'wishlist') renderWishlist();
  }

  function syncWishButtons() {
    $$('.wish-btn[data-id]').forEach((b) => {
      const on = state.wish.includes(b.dataset.id);
      b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on));
      const name = (getProduct(b.dataset.id) || {}).name || '';
      b.setAttribute('aria-label', (on ? 'Remove from' : 'Add to') + ' wishlist: ' + name);
    });
  }

  let lastCounts = { cart: -1, wish: -1 };
  function updateBadges() {
    const t = totals();
    [['cart', t.count, '#cartCount'], ['wish', state.wish.length, '#wishCount']].forEach(([k, n, sel]) => {
      const el = $(sel); if (!el) return;
      el.textContent = n; el.dataset.count = n;
      if (lastCounts[k] !== -1 && lastCounts[k] !== n) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
      lastCounts[k] = n;
    });
  }

  /* ------------------------------------------------------------------------
     8. Router
     ------------------------------------------------------------------------ */
  const PAGES = ['home', 'shop', 'categories', 'occasions', 'addons', 'cart', 'login', 'checkout', 'confirmation', 'wishlist', 'orders', 'about', 'contact', 'admin'];
  const NAV_MAP = { home: 'home', shop: 'shop', categories: 'categories', occasions: 'occasions', addons: 'addons', about: 'about', contact: 'contact' };
  let currentPage = 'home';
  let params = new URLSearchParams();

  function parseHash() {
    const h = location.hash.replace(/^#\/?/, '');
    const idx = h.indexOf('?');
    const path = idx >= 0 ? h.slice(0, idx) : h;
    return { page: PAGES.includes(path) ? path : 'home', params: new URLSearchParams(idx >= 0 ? h.slice(idx + 1) : '') };
  }
  function go(page, query) {
    const q = query ? '?' + new URLSearchParams(query).toString() : '';
    const target = '#/' + page + q;
    if (location.hash === target) route(); else location.hash = target;
  }

  function route() {
    const parsed = parseHash();
    let page = parsed.page; params = parsed.params;

    // Guards
    if (page === 'checkout' || page === 'orders' || page === 'confirmation') {
      if (!currentUser()) { go('login', { next: page === 'confirmation' ? 'orders' : page, notice: page === 'checkout' ? 'checkout' : 'orders' }); return; }
    }
    if (page === 'admin' && !isAdmin()) {
      if (!currentUser()) { go('login', { next: 'admin', notice: 'admin' }); } else { toast('Admin access only.', 'error'); go('home'); }
      return;
    }

    currentPage = page;
    $$('.page').forEach((p) => p.classList.remove('active'));
    const el = $('#page-' + page); el.classList.add('active');
    document.title = (el.dataset.title || 'Bloom & Bliss') + ' — Bloom & Bliss';
    $$('.nav a').forEach((a) => a.classList.toggle('active', NAV_MAP[page] === a.dataset.nav));
    closeMenus();

    syncCart();
    switch (page) {
      case 'home': renderHome(); break;
      case 'shop': applyShopParams(); renderShop(); break;
      case 'categories': renderCategories(); break;
      case 'occasions': renderOccasions(); break;
      case 'addons': renderAddons(); break;
      case 'cart': renderCart(); break;
      case 'login': prepareLogin(); break;
      case 'checkout': renderCheckout(); break;
      case 'confirmation': renderConfirmation(); break;
      case 'wishlist': renderWishlist(); break;
      case 'orders': renderOrders(); break;
      case 'admin': renderAdmin(); break;
      default: break;
    }
    renderAuthArea(); updateBadges(); syncWishButtons();
    window.scrollTo({ top: 0, behavior: 'auto' });
    observeReveals();
  }

  /* ------------------------------------------------------------------------
     9. Page renderers
     ------------------------------------------------------------------------ */
  
function renderHome() {
    // Hero image and featured collection cards are written in index.html.
    checkCardImages();


    const best = state.products.filter((p) => p.best && !isAddon(p)).slice(0, 4);
    $('#bestsellerGrid').innerHTML = best.map(productCard).join('');
}


  /* ---- Shop ---- */
  const shopFilters = { q: '', cat: 'all', occ: 'all', sort: 'featured' };
  let shopReady = false;
  function initShopControls() {
    if (shopReady) return; shopReady = true;
    $('#occasionFilter').innerHTML = '<option value="all">All occasions</option>' + OCCASIONS.map((o) => `<option value="${o.id}">${esc(o.label)}</option>`).join('');
    $('#searchInput').addEventListener('input', (e) => { shopFilters.q = e.target.value; renderShop(); });
    $('#occasionFilter').addEventListener('change', (e) => { shopFilters.occ = e.target.value; renderShop(); });
    $('#sortSelect').addEventListener('change', (e) => { shopFilters.sort = e.target.value; renderShop(); });
  }
  function applyShopParams() {
    initShopControls();
    if (params.has('cat') || params.has('occ') || params.has('q')) {
      shopFilters.cat = CATEGORIES.some((c) => c.id === params.get('cat')) ? params.get('cat') : 'all';
      shopFilters.occ = OCCASIONS.some((o) => o.id === params.get('occ')) ? params.get('occ') : 'all';
      shopFilters.q = params.get('q') || '';
      shopFilters.sort = 'featured';
    }
    $('#searchInput').value = shopFilters.q;
    $('#occasionFilter').value = shopFilters.occ;
    $('#sortSelect').value = shopFilters.sort;
  }
  function renderShop() {
    initShopControls();
    $('#catChips').innerHTML = [{ id: 'all', label: 'All' }].concat(CATEGORIES).map((c) =>
      `<button type="button" class="chip-btn ${shopFilters.cat === c.id ? 'active' : ''}" data-action="filter-cat" data-cat="${c.id}" aria-pressed="${shopFilters.cat === c.id}">${esc(c.label)}</button>`).join('');
    const q = shopFilters.q.trim().toLowerCase();
    let list = state.products.filter((p) => !isAddon(p) &&
      (!q || p.name.toLowerCase().includes(q)) &&
      (shopFilters.cat === 'all' || p.category === shopFilters.cat) &&
      (shopFilters.occ === 'all' || (p.occasions || []).includes(shopFilters.occ)));
    const sorters = {
      'price-asc': (a, b) => a.price - b.price, 'price-desc': (a, b) => b.price - a.price,
      rating: (a, b) => b.rating - a.rating || b.reviews - a.reviews, name: (a, b) => a.name.localeCompare(b.name)
    };
    if (sorters[shopFilters.sort]) list = list.slice().sort(sorters[shopFilters.sort]);
    $('#resultCount').textContent = list.length + (list.length === 1 ? ' bouquet' : ' bouquets') + ' found';
    const grid = $('#shopGrid');
    if (state.customProducts) {
      grid.innerHTML = list.map(productCard).join('');
    } else {
      // Cards already exist in index.html: just show/hide and re-order them.
      const shown = new Set(list.map((p) => p.id));
      $$('.product-card', grid).forEach((card) => { card.hidden = !shown.has(card.dataset.id); });
      list.forEach((p) => { const card = $(`.product-card[data-id="${p.id}"]`, grid); if (card) grid.appendChild(card); });
    }
    $('#shopEmpty').hidden = list.length > 0;
    observeReveals();
  }

  /* Categories & Occasions: the cards (with their pictures) are written in index.html.
     We keep them as-is and only wire up the buttons. If a picture file is missing,
     a drawn bouquet illustration is shown instead. */
  const OCC_ALIAS = { romance: 'valentines', 'thank-you': 'congratulations', 'get-well': 'just-because' };
  const CAT_ALIAS = { 'gift-sets': 'gifts' };
  const CARD_ART = {
    roses: 'roses', tulips: 'tulips', sunflowers: 'sunflowers', lilies: 'lilies', mixed: 'mixed', premium: 'premium', mini: 'mini', 'gift-sets': 'gifts',
    birthday: 'birthday', anniversary: 'anniversary', romance: 'valentines', graduation: 'graduation', wedding: 'wedding',
    'thank-you': 'congratulations', 'get-well': 'just-because', sympathy: 'sympathy'
  };
  function cardFallback(img) {
    if (!img || img.dataset.fallback) return;
    img.dataset.fallback = '1';
    const card = img.closest('.category-card, .occasion-card');
    const btn = card && card.querySelector('button[data-category], button[data-occasion]');
    const key = btn ? (btn.dataset.category || btn.dataset.occasion) : '';
    const src = CATEGORIES.concat(OCCASIONS).find((x) => x.id === CARD_ART[key]);
    const holder = document.createElement('div');
    holder.className = 'img-fallback';
    holder.innerHTML = bouquetSVG(src ? src.art : null, img.alt);
    img.replaceWith(holder);
  }
  document.addEventListener('error', (e) => {
    const t = e.target;
    if (t && t.tagName === 'IMG' && t.closest && t.closest('.category-card, .occasion-card')) cardFallback(t);
  }, true);
  function checkCardImages() {
    $$('.category-card img, .occasion-card img').forEach((img) => { if (img.complete && img.naturalWidth === 0) cardFallback(img); });
  }
  function renderCategories() { checkCardImages(); }
  function renderOccasions() { checkCardImages(); }

  /* ---- Add-ons: same engine as the shop (cards are written in index.html) ---- */
  const addonFilters = { q: '', cat: 'all', sort: 'featured' };
  let addonReady = false;
  function initAddonControls() {
    if (addonReady) return; addonReady = true;
    $('#addonSearch').addEventListener('input', (e) => { addonFilters.q = e.target.value; renderAddons(); });
    $('#addonSort').addEventListener('change', (e) => { addonFilters.sort = e.target.value; renderAddons(); });
  }
  function renderAddons() {
    initAddonControls();
    $('#addonSearch').value = addonFilters.q;
    $('#addonSort').value = addonFilters.sort;
    $('#addonChips').innerHTML = [{ id: 'all', label: 'All' }].concat(ADDON_CATS).map((c) =>
      `<button type="button" class="chip-btn ${addonFilters.cat === c.id ? 'active' : ''}" data-action="filter-addon-cat" data-cat="${c.id}" aria-pressed="${addonFilters.cat === c.id}">${esc(c.label)}</button>`).join('');
    const q = addonFilters.q.trim().toLowerCase();
    let list = state.products.filter((p) => isAddon(p) && (!q || p.name.toLowerCase().includes(q)) && (addonFilters.cat === 'all' || p.category === addonFilters.cat));
    const sorters = { 'price-asc': (a, b) => a.price - b.price, 'price-desc': (a, b) => b.price - a.price, name: (a, b) => a.name.localeCompare(b.name) };
    if (sorters[addonFilters.sort]) list = list.slice().sort(sorters[addonFilters.sort]);
    $('#addonCount').textContent = list.length + (list.length === 1 ? ' add-on' : ' add-ons') + ' found';
    const grid = $('#addonGrid');
    if (state.customProducts) {
      grid.innerHTML = list.map(productCard).join('');
    } else {
      const shown = new Set(list.map((p) => p.id));
      $$('.product-card', grid).forEach((card) => { card.hidden = !shown.has(card.dataset.id); });
      list.forEach((p) => { const card = $(`.product-card[data-id="${p.id}"]`, grid); if (card) grid.appendChild(card); });
    }
    $('#addonEmpty').hidden = list.length > 0;
    checkImages(grid);
    observeReveals();
  }

  /* ---- Cart page ---- */
  function summaryHTML(t, withPromo) {
    const away = FREE_SHIP_MIN - (t.subtotal - t.discount);
    return `<h2>Order Summary</h2>
      <div class="sum-row"><span>Subtotal</span><span>${peso(t.subtotal)}</span></div>
      ${t.discount ? `<div class="sum-row discount"><span>Discount (${esc(state.promo)})</span><span>−${peso(t.discount)}</span></div>` : ''}
      <div class="sum-row"><span>Delivery fee</span><span>${t.delivery ? peso(t.delivery) : 'Free'}</span></div>
      ${withPromo && t.delivery && away > 0 ? `<p class="free-ship">Add ${peso(away)} more for free delivery 🚚</p>` : ''}
      <div class="sum-row total"><span>Total</span><span>${peso(t.total)}</span></div>`;
  }
  function renderCart() {
    const root = $('#cartRoot'); if (!root) return;
    if (!state.cart.length) {
      root.innerHTML = `<div class="empty"><h3>Your cart is empty</h3><p class="muted">Find a bouquet that tells your story.</p><a class="btn btn-primary" href="#/shop">Shop Flowers</a> <a class="btn btn-ghost" href="#/addons">Browse Add-ons</a></div>`;
      return;
    }
    const t = totals();
    const items = state.cart.map((i) => `<article class="cart-item">
        <div class="cart-thumb">${prodMedia(i, i.name)}</div>
        <div class="cart-info"><h3>${esc(i.name)}</h3><p>${esc(i.note || '')}</p>${i.message ? `<p class="msg">“${esc(i.message)}”</p>` : ''}
          <div class="qty" role="group" aria-label="Quantity for ${esc(i.name)}"><button type="button" data-action="qty-dec" data-key="${i.key}" aria-label="Decrease quantity">−</button><output aria-live="polite">${i.qty}</output><button type="button" data-action="qty-inc" data-key="${i.key}" aria-label="Increase quantity">+</button></div>
        </div>
        <div class="cart-price"><strong>${peso(i.price * i.qty)}</strong><small>${peso(i.price)} each</small><button type="button" class="link-btn" data-action="remove" data-key="${i.key}">Remove</button></div>
      </article>`).join('');
    root.innerHTML = `<div class="cart-layout"><div>${items}<a class="link-btn" href="#/shop">← Continue shopping</a></div>
      <aside class="summary">${summaryHTML(t, true)}
        <form class="promo-form" id="promoForm" novalidate><label class="sr-only" for="promoInput">Promo code</label><input type="text" id="promoInput" name="code" placeholder="Promo code" autocomplete="off"><button class="btn btn-ghost btn-sm" type="submit">Apply</button></form>
        <p class="error" id="promoError" role="alert"></p>
        ${state.promo ? `<p class="free-ship">Code <strong>${esc(state.promo)}</strong> applied · <button class="link-btn" type="button" data-action="remove-promo">Remove</button></p>` : '<p class="free-ship">Try BLOOM10 or FREESHIP.</p>'}
        <a class="btn btn-primary btn-block" href="#/checkout">Proceed to Checkout</a>
      </aside></div>`;
  }
  function applyPromo(code) {
    const c = (code || '').trim().toUpperCase();
    const err = $('#promoError');
    if (!c) { err.textContent = 'Enter a promo code.'; return; }
    if (c !== 'BLOOM10' && c !== 'FREESHIP') { err.textContent = 'That code isn’t valid. Try BLOOM10 or FREESHIP.'; return; }
    state.promo = c; save('promo'); toast('Promo code ' + c + ' applied!'); renderCart();
  }

  /* ---- Auth ---- */
  function renderAuthArea() {
    const u = currentUser(); const box = $('#authArea'); if (!box) return;
    if (!u) {
      box.innerHTML = `<a class="icon-btn" href="#/login" aria-label="Login or sign up"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/></svg></a>`;
      return;
    }
    box.innerHTML = `<div class="user-menu"><button class="icon-btn user-btn" data-action="toggle-user" aria-haspopup="true" aria-expanded="false" aria-label="Account menu for ${esc(u.name)}">${esc(u.name.charAt(0).toUpperCase())}</button>
      <div class="dropdown" id="userDropdown" hidden><p>Signed in as<br><strong>${esc(u.name)}</strong></p>
        <a href="#/orders">My Orders</a><a href="#/wishlist">Wishlist</a>${u.role === 'admin' ? '<a href="#/admin">Admin Dashboard</a>' : ''}
        <button type="button" data-action="logout">Logout</button></div></div>`;
  }
  function setAuthTab(tab) {
    const reg = tab === 'register';
    $('#loginForm').hidden = reg; $('#registerForm').hidden = !reg;
    $('#tabLogin').classList.toggle('active', !reg); $('#tabRegister').classList.toggle('active', reg);
    $('#tabLogin').setAttribute('aria-selected', String(!reg)); $('#tabRegister').setAttribute('aria-selected', String(reg));
  }
  function prepareLogin() {
    setAuthTab(params.get('tab') === 'register' ? 'register' : 'login');
    const notice = $('#authNotice'); const n = params.get('notice');
    const msgs = { checkout: 'Please log in or sign up to complete your order. Your cart is saved.', orders: 'Please log in to view your orders.', admin: 'Please log in with an administrator account.' };
    notice.hidden = !msgs[n]; notice.textContent = msgs[n] || '';
    if (currentUser()) { go(params.get('next') || 'home'); }
  }
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  function afterAuth() { const next = params.get('next'); go(PAGES.includes(next) ? next : 'home'); }

  function handleLogin(form) {
    const data = validate(form, {
      email: (v) => !v ? 'Please enter your email.' : !EMAIL_RE.test(v) ? 'Enter a valid email address.' : '',
      password: (v) => !v ? 'Please enter your password.' : ''
    });
    const alert = $('#loginAlert'); alert.hidden = true;
    if (!data) return;
    const u = state.users.find((x) => x.email === data.email.toLowerCase());
    if (!u || u.pass !== hash(data.password)) { alert.hidden = false; alert.textContent = 'Incorrect email or password. Please try again.'; return; }
    state.session = u.email; save('session'); form.reset();
    toast('Welcome back, ' + u.name.split(' ')[0] + '!'); renderAuthArea(); afterAuth();
  }
  function handleRegister(form) {
    const data = validate(form, {
      name: (v) => v.length < 2 ? 'Please enter your full name.' : '',
      email: (v) => !v ? 'Please enter your email.' : !EMAIL_RE.test(v) ? 'Enter a valid email address.' : state.users.some((u) => u.email === v.toLowerCase()) ? 'An account with this email already exists.' : '',
      password: (v) => v.length < 8 ? 'Password must be at least 8 characters.' : !/[A-Za-z]/.test(v) || !/\d/.test(v) ? 'Include both letters and numbers.' : '',
      confirm: (v, d) => v !== d.password ? 'Passwords do not match.' : ''
    });
    if (!data) return;
    const u = { name: data.name, email: data.email.toLowerCase(), pass: hash(data.password), role: 'customer' };
    state.users.push(u); state.session = u.email; save('users', 'session'); form.reset();
    toast('Account created. Welcome to Bloom & Bliss, ' + u.name.split(' ')[0] + '!'); renderAuthArea(); afterAuth();
  }
  function logout() {
    state.session = null; save('session'); renderAuthArea(); toast('You have been logged out.');
    if (['checkout', 'orders', 'admin', 'confirmation'].includes(currentPage)) go('home'); else route();
  }

  /* ---- Checkout ---- */
  function renderCheckout() {
    const root = $('#checkoutRoot');
    if (!state.cart.length) { root.innerHTML = `<div class="empty"><h3>Your cart is empty</h3><p class="muted">Add a bouquet before checking out.</p><a class="btn btn-primary" href="#/shop">Shop Flowers</a></div>`; return; }
    const u = currentUser(); const t = totals();
    root.innerHTML = `<div class="cart-layout">
      <form class="form-card" id="checkoutForm" novalidate>
        <h2>Recipient &amp; Delivery</h2>
        <div class="form-row">
          <div class="field"><label for="rName">Recipient name</label><input type="text" id="rName" name="rname" autocomplete="name" placeholder="Who is receiving the flowers?"><span class="error" data-error-for="rname" role="alert"></span></div>
          <div class="field"><label for="rPhone">Recipient mobile number</label><input type="tel" id="rPhone" name="rphone" autocomplete="tel" placeholder="09XX XXX XXXX"><span class="error" data-error-for="rphone" role="alert"></span></div>
        </div>
        <div class="field"><label for="rAddress">Delivery address</label><textarea id="rAddress" name="raddress" style="min-height:84px" placeholder="House/Unit no., street, barangay"></textarea><span class="error" data-error-for="raddress" role="alert"></span></div>
        <div class="form-row">
          <div class="field"><label for="rCity">City / Municipality</label><input type="text" id="rCity" name="rcity" autocomplete="address-level2"><span class="error" data-error-for="rcity" role="alert"></span></div>
          <div class="field"><label for="rZip">Postal code (optional)</label><input type="text" id="rZip" name="rzip" inputmode="numeric" maxlength="4"><span class="error" data-error-for="rzip" role="alert"></span></div>
        </div>
        <div class="form-row">
          <div class="field"><label for="dDate">Delivery date</label><input type="date" id="dDate" name="ddate" min="${dateStr(1)}" max="${dateStr(90)}"><span class="error" data-error-for="ddate" role="alert"></span></div>
          <div class="field"><label for="dTime">Delivery time</label><select id="dTime" name="dtime"><option value="">Select a time slot…</option>${TIME_SLOTS.map((s) => `<option>${s}</option>`).join('')}</select><span class="error" data-error-for="dtime" role="alert"></span></div>
        </div>
        <div class="field"><label for="dNote">Note for the rider / florist (optional)</label><textarea id="dNote" name="dnote" style="min-height:70px" maxlength="200"></textarea></div>

        <h2 style="margin-top:1.5rem">Payment Method</h2>
        <fieldset><legend class="sr-only">Payment method</legend>
          <div class="pay-methods">
            <label class="opt"><input type="radio" name="payment" value="cod"><span>Cash on Delivery<small>Pay when it arrives</small></span></label>
            <label class="opt"><input type="radio" name="payment" value="gcash"><span>GCash<small>E-wallet (demo)</small></span></label>
            <label class="opt"><input type="radio" name="payment" value="card"><span>Credit / Debit Card<small>Visa, Mastercard (demo)</small></span></label>
            <label class="opt"><input type="radio" name="payment" value="bank"><span>Bank Transfer<small>Upload proof later (demo)</small></span></label>
          </div>
          <span class="error" data-error-for="payment" role="alert"></span>
        </fieldset>
        <div class="pay-detail" id="payDetail" hidden></div>
        <div class="form-alert info" style="margin-top:1rem">Demo only: no real payment is processed and no card data is stored.</div>
        <button type="submit" class="btn btn-primary btn-block" style="margin-top:.6rem">Place Order · ${peso(t.total)}</button>
      </form>
      <aside class="summary"><h2>Your Order</h2>
        ${state.cart.map((i) => `<div class="mini-item"><span>${i.qty} × ${esc(i.name)}${i.message ? `<br><small class="muted">Card message: “${esc(i.message)}”</small>` : ''}</span><span>${peso(i.price * i.qty)}</span></div>`).join('')}
        <div style="margin-top:.8rem">${summaryHTML(t, false).replace('<h2>Order Summary</h2>', '')}</div>
        <p class="muted" style="font-size:.8rem;margin:.8rem 0 0">Ordering as <strong>${esc(u.name)}</strong> (${esc(u.email)})</p>
        <a class="link-btn" href="#/cart">← Edit cart</a>
      </aside></div>`;
    const nm = $('#rName'); if (nm && !nm.value) nm.value = u.name;
  }
  function showPayDetail(method) {
    const box = $('#payDetail'); if (!box) return;
    if (!method) { box.hidden = true; return; }
    const html = {
      cod: '<p style="margin:0">Please prepare the exact amount for the rider. Our team may call to confirm your order.</p>',
      gcash: '<p style="margin:0">After placing your order, send payment to <strong>GCash 0900 000 0000</strong> (Bloom &amp; Bliss) and use your order number as the reference. <em>(Demo number)</em></p>',
      bank: '<p style="margin:0">Transfer to <strong>Bloom &amp; Bliss · Demo Bank · 0000-0000-00</strong> and send proof of payment through our Contact page. <em>(Demo details)</em></p>',
      card: `<div class="form-row"><div class="field"><label for="cardNumber">Card number</label><input type="text" id="cardNumber" name="cardnumber" inputmode="numeric" autocomplete="off" placeholder="1234 5678 9012 3456" maxlength="23"><span class="error" data-error-for="cardnumber" role="alert"></span></div>
        <div class="field"><label for="cardName">Name on card</label><input type="text" id="cardName" name="cardname" autocomplete="off"><span class="error" data-error-for="cardname" role="alert"></span></div></div>
        <div class="form-row"><div class="field"><label for="cardExp">Expiry (MM/YY)</label><input type="text" id="cardExp" name="cardexp" placeholder="MM/YY" maxlength="5" autocomplete="off"><span class="error" data-error-for="cardexp" role="alert"></span></div>
        <div class="field"><label for="cardCvc">CVC</label><input type="text" id="cardCvc" name="cardcvc" inputmode="numeric" maxlength="4" autocomplete="off"><span class="error" data-error-for="cardcvc" role="alert"></span></div></div>
        <p class="muted" style="font-size:.78rem;margin:0">For this demo, enter any test numbers. Nothing is sent or saved.</p>`
    }[method];
    box.innerHTML = html; box.hidden = false;
  }
  function handleCheckout(form) {
    const method = ($('input[name="payment"]:checked', form) || {}).value;
    const rules = {
      rname: (v) => v.length < 2 ? 'Please enter the recipient’s name.' : '',
      rphone: (v) => { const p = v.replace(/[\s-]/g, ''); return !p ? 'Please enter a mobile number.' : !/^(\+63|0)9\d{9}$/.test(p) ? 'Use a valid PH mobile number (e.g. 0917 123 4567).' : ''; },
      raddress: (v) => v.length < 10 ? 'Please enter a complete delivery address (at least 10 characters).' : '',
      rcity: (v) => v.length < 2 ? 'Please enter the city or municipality.' : '',
      rzip: (v) => v && !/^\d{4}$/.test(v) ? 'Postal code should be 4 digits.' : '',
      ddate: (v) => !v ? 'Please choose a delivery date.' : v < dateStr(1) ? 'Delivery must be scheduled from tomorrow onward.' : v > dateStr(90) ? 'Please choose a date within the next 90 days.' : '',
      dtime: (v) => !v ? 'Please select a delivery time slot.' : '',
      payment: () => !method ? 'Please select a payment method.' : ''
    };
    if (method === 'card') {
      rules.cardnumber = (v) => /^\d{13,19}$/.test(v.replace(/\s/g, '')) ? '' : 'Enter a valid card number (13–19 digits).';
      rules.cardname = (v) => v.length < 2 ? 'Enter the name on the card.' : '';
      rules.cardexp = (v) => {
        const m = /^(\d{2})\/(\d{2})$/.exec(v); if (!m) return 'Use the format MM/YY.';
        const mm = +m[1]; const yy = 2000 + +m[2]; if (mm < 1 || mm > 12) return 'Month must be 01–12.';
        const now = new Date(); return (yy < now.getFullYear() || (yy === now.getFullYear() && mm < now.getMonth() + 1)) ? 'This card has expired.' : '';
      };
      rules.cardcvc = (v) => /^\d{3,4}$/.test(v) ? '' : 'CVC must be 3 or 4 digits.';
    }
    const data = validate(form, rules);
    if (!data) { toast('Please fix the highlighted fields.', 'error'); return; }

    syncCart();
    if (!state.cart.length) { toast('Your cart is empty.', 'error'); go('cart'); return; }
    for (const line of state.cart) {
      if (line.pid) { const p = getProduct(line.pid); if (!p || p.stock < line.qty) { toast('Stock changed for ' + line.name + '. Please review your cart.', 'error'); go('cart'); return; } }
    }
    const t = totals(); const u = currentUser();
    const order = {
      id: 'BB-' + dateStr(0).replace(/-/g, '').slice(2) + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(),
      user: u.email, customer: u.name, createdAt: new Date().toISOString(), status: 'Pending',
      items: clone(state.cart),
      recipient: { name: data.rname, phone: data.rphone, address: data.raddress, city: data.rcity, zip: data.rzip || '' },
      delivery: { date: data.ddate, time: data.dtime, note: data.dnote || '' },
      payment: { cod: 'Cash on Delivery', gcash: 'GCash', card: 'Credit / Debit Card', bank: 'Bank Transfer' }[method],
      promo: state.promo, totals: { subtotal: t.subtotal, discount: t.discount, delivery: t.delivery, total: t.total }
    };
    state.cart.forEach((line) => { if (line.pid) { const p = getProduct(line.pid); if (p) p.stock = Math.max(0, p.stock - line.qty); } });
    state.orders.push(order); state.cart = []; state.promo = null;
    save('orders', 'products', 'cart', 'promo'); updateBadges();
    toast('Order placed! Thank you 🌸'); go('confirmation', { id: order.id });
  }
  function renderConfirmation() {
    const root = $('#confirmRoot'); const u = currentUser();
    const o = state.orders.find((x) => x.id === params.get('id') && (x.user === u.email || u.role === 'admin'));
    if (!o) { root.innerHTML = `<div class="confirm-box"><h2>Order not found</h2><a class="btn btn-primary" href="#/orders">View my orders</a></div>`; return; }
    root.innerHTML = `<div class="confirm-box"><div class="check-ring" aria-hidden="true">✓</div>
      <p class="eyebrow">Order confirmed</p><h1 style="font-size:2.2rem">Thank you, ${esc(o.customer.split(' ')[0])}!</h1>
      <p class="muted">Your order <strong>${esc(o.id)}</strong> has been placed and is now <strong>${esc(o.status)}</strong>.</p>
      <div class="order-meta" style="text-align:left"><div><b>Deliver to</b>${esc(o.recipient.name)}<br>${esc(o.recipient.address)}, ${esc(o.recipient.city)}</div>
        <div><b>Delivery</b>${prettyDate(o.delivery.date)}<br>${esc(o.delivery.time)}</div>
        <div><b>Payment</b>${esc(o.payment)}<br><strong>${peso(o.totals.total)}</strong></div></div>
      <p style="margin-top:1.5rem"><a class="btn btn-primary" href="#/orders">Track My Order</a> <a class="btn btn-ghost" href="#/shop">Keep Shopping</a></p></div>`;
  }

  /* ---- Wishlist ---- */
  function renderWishlist() {
    const list = state.wish.map(getProduct).filter(Boolean);
    $('#wishGrid').innerHTML = list.map(productCard).join('');
    $('#wishEmpty').hidden = list.length > 0;
    observeReveals();
  }

  /* ---- Orders ---- */
  const statusClass = (s) => s.toLowerCase().replace(/\s+/g, '-');
  function progressHTML(status) {
    const idx = STATUSES.indexOf(status);
    return `<div class="progress" aria-label="Order progress: ${esc(status)}">${STATUSES.map((s, i) => `<div class="${i <= idx ? 'done' : ''}">${s}</div>`).join('')}</div>`;
  }
  function orderCard(o) {
    return `<article class="order-card"><div class="order-head"><div><h3>Order ${esc(o.id)}</h3><span class="muted" style="font-size:.82rem">Placed ${prettyDate(o.createdAt)}</span></div>
      <span class="status ${statusClass(o.status)}">${esc(o.status)}</span></div>
      ${progressHTML(o.status)}
      <div class="order-items">${o.items.map((i) => `<div style="display:flex;gap:.6rem;align-items:center"><div class="thumb">${prodMedia(i, i.name)}</div><div style="font-size:.84rem"><strong>${esc(i.name)}</strong><br><span class="muted">Qty ${i.qty} · ${peso(i.price * i.qty)}</span>${i.message ? `<br><span class="muted"><em>Card message: “${esc(i.message)}”</em></span>` : ''}</div></div>`).join('')}</div>
      <div class="order-meta"><div><b>Delivery</b>${prettyDate(o.delivery.date)} · ${esc(o.delivery.time)}</div><div><b>Recipient</b>${esc(o.recipient.name)}<br>${esc(o.recipient.city)}</div><div><b>Payment</b>${esc(o.payment)}</div><div><b>Total</b><strong style="font-size:1.1rem;color:var(--burgundy)">${peso(o.totals.total)}</strong></div></div></article>`;
  }
  function renderOrders() {
    const u = currentUser(); const root = $('#ordersRoot');
    const mine = state.orders.filter((o) => o.user === u.email).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    root.innerHTML = mine.length ? mine.map(orderCard).join('') : `<div class="empty"><h3>No orders yet</h3><p class="muted">When you place an order, it will appear here.</p><a class="btn btn-primary" href="#/shop">Start shopping</a></div>`;
  }

  /* ---- Admin ---- */
  let adminTab = 'products';
  const ART_PRESETS = {
    'red-roses': { kinds: ['rose'], pals: ['red'], n: 7, wrap: 'blush', ribbon: '#70263D', bg: 'blush' },
    'burgundy-roses': { kinds: ['rose'], pals: ['burgundy'], n: 7, wrap: 'burgundy', ribbon: '#D4B483', bg: 'maroon' },
    'pink-tulips': { kinds: ['tulip'], pals: ['pink'], n: 7, wrap: 'ivory', ribbon: '#A8B49A', bg: 'ivory' },
    'white-lilies': { kinds: ['lily'], pals: ['white'], n: 5, wrap: 'sage', ribbon: '#F9F5EF', bg: 'sage' },
    'sunflowers': { kinds: ['sunflower'], pals: ['yellow'], n: 5, wrap: 'kraft', ribbon: '#70263D', bg: 'gold' },
    'mixed-pastel': { kinds: ['rose', 'tulip', 'daisy'], pals: ['blush', 'pink', 'white'], n: 7, wrap: 'blush', ribbon: '#70263D', bg: 'ivory', filler: true },
    'mini': { kinds: ['tulip', 'rose'], pals: ['peach', 'pink'], n: 3, wrap: 'kraft', ribbon: '#70263D', bg: 'blush' },
    'gift-box': { kinds: ['rose'], pals: ['pink', 'burgundy'], n: 5, wrap: 'ivory', ribbon: '#D4B483', bg: 'ivory', box: true }
  };
  const PRESET_LABELS = { 'red-roses': 'Red roses', 'burgundy-roses': 'Burgundy roses', 'pink-tulips': 'Pink tulips', 'white-lilies': 'White lilies', 'sunflowers': 'Sunflowers', 'mixed-pastel': 'Mixed pastel', 'mini': 'Mini bunch', 'gift-box': 'Gift box' };

  function renderAdmin() {
    const root = $('#adminRoot'); if (!root) return;
    const revenue = state.orders.filter((o) => o.status !== 'Cancelled').reduce((s, o) => s + o.totals.total, 0);
    const lowCount = state.products.filter((p) => p.stock <= 5).length;
    const pending = state.orders.filter((o) => o.status === 'Pending').length;
    let body = '';
    if (adminTab === 'products') {
      body = `<div class="admin-bar"><h2 style="margin:0">Products (${state.products.length})</h2><button class="btn btn-primary btn-sm" data-action="admin-add">+ Add Product</button></div>
        <div class="table-wrap"><table><thead><tr><th>ID</th><th>Product</th><th>Category</th><th>Price (₱)</th><th>Stock</th><th>Actions</th></tr></thead><tbody>
        ${state.products.map((p) => `<tr><td>${esc(p.id)}</td><td><strong>${esc(p.name)}</strong></td><td>${esc(catLabel(p.category))}</td>
          <td><input type="number" min="1" step="1" value="${p.price}" data-admin-field="price" data-id="${esc(p.id)}" aria-label="Price for ${esc(p.name)}"></td>
          <td><input type="number" min="0" step="1" value="${p.stock}" data-admin-field="stock" data-id="${esc(p.id)}" aria-label="Stock for ${esc(p.name)}"></td>
          <td><div class="row-actions"><button class="btn btn-ghost btn-sm" data-action="admin-edit" data-id="${esc(p.id)}">Edit</button><button class="btn btn-danger btn-sm" data-action="admin-delete" data-id="${esc(p.id)}">Delete</button></div></td></tr>`).join('')}
        </tbody></table></div>`;
    } else if (adminTab === 'orders') {
      const orders = state.orders.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      body = `<div class="admin-bar"><h2 style="margin:0">Orders (${orders.length})</h2></div>` + (orders.length ? `<div class="table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Placed</th><th>Delivery</th><th>Total</th><th>Status</th><th></th></tr></thead><tbody>
        ${orders.map((o) => `<tr><td><strong>${esc(o.id)}</strong></td><td>${esc(o.customer)}<br><small class="muted">${esc(o.user)}</small></td><td>${prettyDate(o.createdAt)}</td><td>${prettyDate(o.delivery.date)}<br><small class="muted">${esc(o.delivery.time)}</small></td><td>${peso(o.totals.total)}</td>
          <td><select data-admin-status="${esc(o.id)}" aria-label="Status for order ${esc(o.id)}">${STATUSES.map((s) => `<option ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}</select></td>
          <td><button class="btn btn-ghost btn-sm" data-action="admin-order" data-id="${esc(o.id)}">Details</button></td></tr>`).join('')}
        </tbody></table></div>` : '<div class="empty"><h3>No orders yet</h3><p class="muted">Orders placed by customers will appear here.</p></div>');
    } else {
      const msgs = state.messages.slice().reverse();
      body = `<div class="admin-bar"><h2 style="margin:0">Customer Messages (${msgs.length})</h2></div>` + (msgs.length ? msgs.map((m) => `<div class="msg-card"><h4>${esc(m.subject)}</h4><small>${esc(m.name)} · ${esc(m.email)} · ${prettyDate(m.at)}</small><p style="margin:.5rem 0 0">${esc(m.message)}</p></div>`).join('') : '<div class="empty"><h3>No messages</h3></div>');
    }
    root.innerHTML = `<div class="stat-grid"><div class="stat"><b>${state.products.length}</b><span>Products</span></div><div class="stat"><b>${lowCount}</b><span>Low / out of stock</span></div><div class="stat"><b>${state.orders.length}</b><span>Orders (${pending} pending)</span></div><div class="stat"><b>${peso(revenue)}</b><span>Total sales</span></div></div>
      <div class="tabs" style="max-width:480px" role="tablist">${['products', 'orders', 'messages'].map((t) => `<button type="button" role="tab" class="${adminTab === t ? 'active' : ''}" aria-selected="${adminTab === t}" data-action="admin-tab" data-tab="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div>
      ${body}
      <p style="margin-top:2rem"><button class="link-btn" data-action="reset-demo">Reset all demo data</button></p>`;
  }
  function productFormModal(p) {
    const isNew = !p;
    p = p || { name: '', category: 'mixed', price: '', stock: '', desc: '', occasions: ['just-because'], preset: 'mixed-pastel' };
    openModal(`<h2>${isNew ? 'Add Product' : 'Edit Product'}</h2>
      <form id="productForm" novalidate><input type="hidden" name="id" value="${esc(p.id || '')}">
        <div class="field"><label for="pfName">Product name</label><input type="text" id="pfName" name="name" value="${esc(p.name)}"><span class="error" data-error-for="name" role="alert"></span></div>
        <div class="form-row">
          <div class="field"><label for="pfCat">Category</label><select id="pfCat" name="category">${CATEGORIES.concat(ADDON_CATS).map((c) => `<option value="${c.id}" ${c.id === p.category ? 'selected' : ''}>${esc(c.label)}</option>`).join('')}</select></div>
          <div class="field"><label for="pfArt">Illustration style</label><select id="pfArt" name="preset">${isNew ? '' : '<option value="">Keep current</option>'}${Object.keys(ART_PRESETS).map((k) => `<option value="${k}" ${isNew && k === 'mixed-pastel' ? 'selected' : ''}>${PRESET_LABELS[k]}</option>`).join('')}</select></div>
        </div>
        <div class="form-row">
          <div class="field"><label for="pfPrice">Price (₱)</label><input type="number" id="pfPrice" name="price" min="1" step="1" value="${esc(p.price)}"><span class="error" data-error-for="price" role="alert"></span></div>
          <div class="field"><label for="pfStock">Stock</label><input type="number" id="pfStock" name="stock" min="0" step="1" value="${esc(p.stock)}"><span class="error" data-error-for="stock" role="alert"></span></div>
        </div>
        <div class="field"><label for="pfImage">Image (folder path or web address)</label><input type="text" id="pfImage" name="image" value="${esc(p.image || '')}" placeholder="images/my-bouquet.jpg  or  https://…"><span class="hint">Leave empty to use the illustration. Products written in index.html use the image set there.</span></div>
        <div class="field"><label for="pfDesc">Description</label><textarea id="pfDesc" name="desc">${esc(p.desc)}</textarea><span class="error" data-error-for="desc" role="alert"></span></div>
        <fieldset><legend class="label" style="font-size:.85rem;font-weight:600;color:var(--maroon)">Occasions</legend><div class="opts" style="grid-template-columns:repeat(auto-fill,minmax(130px,1fr))">${OCCASIONS.map((o) => `<label class="opt"><input type="checkbox" name="occasions" value="${o.id}" ${(p.occasions || []).includes(o.id) ? 'checked' : ''}><span>${esc(o.label)}</span></label>`).join('')}</div></fieldset>
        <label style="display:flex;gap:.5rem;align-items:center;font-size:.9rem"><input type="checkbox" name="best" ${p.best ? 'checked' : ''}> Mark as bestseller</label>
        <div class="modal-actions"><button type="button" class="btn btn-ghost btn-sm" data-action="close-modal">Cancel</button><button type="submit" class="btn btn-primary btn-sm">${isNew ? 'Add Product' : 'Save Changes'}</button></div>
      </form>`, 'medium');
  }
  function handleProductForm(form) {
    const data = validate(form, {
      name: (v) => v.length < 3 ? 'Name must be at least 3 characters.' : '',
      price: (v) => !(+v > 0) ? 'Enter a price greater than 0.' : '',
      stock: (v) => v === '' || !(Number.isInteger(+v) && +v >= 0) ? 'Enter a whole number (0 or more).' : '',
      desc: (v) => v.length < 10 ? 'Description must be at least 10 characters.' : ''
    });
    if (!data) return;
    const occasions = $$('input[name="occasions"]:checked', form).map((el) => el.value);
    const best = !!$('input[name="best"]', form).checked;
    if (data.id) {
      const p = getProduct(data.id); if (!p) return;
      Object.assign(p, { name: data.name, category: data.category, price: Math.round(+data.price), stock: +data.stock, desc: data.desc, occasions, best, image: data.image || '' });
      if (data.preset) p.art = clone(ART_PRESETS[data.preset]);
      toast('Product updated');
    } else {
      const nums = state.products.map((p) => parseInt(String(p.id).replace(/\D/g, ''), 10) || 0);
      const id = 'BB-' + String(Math.max(0, ...nums) + 1).padStart(3, '0');
      state.products.push({ id, name: data.name, category: data.category, price: Math.round(+data.price), stock: +data.stock, rating: 4.5, reviews: 0, best, occasions, desc: data.desc, image: data.image || '', art: clone(ART_PRESETS[data.preset] || ART_PRESETS['mixed-pastel']) });
      toast('Product added');
    }
    save('products'); closeModal(); renderAdmin();
  }
  function orderDetailModal(o) {
    openModal(`<h2>Order ${esc(o.id)}</h2>
      <p><span class="status ${statusClass(o.status)}">${esc(o.status)}</span></p>
      ${o.items.map((i) => `<div class="mini-item"><span>${i.qty} × ${esc(i.name)}${i.message ? `<br><small class="muted">Message: “${esc(i.message)}”</small>` : ''}${i.note ? `<br><small class="muted">${esc(i.note)}</small>` : ''}</span><span>${peso(i.price * i.qty)}</span></div>`).join('')}
      <div class="sum-row"><span>Subtotal</span><span>${peso(o.totals.subtotal)}</span></div>
      ${o.totals.discount ? `<div class="sum-row discount"><span>Discount${o.promo ? ' (' + esc(o.promo) + ')' : ''}</span><span>−${peso(o.totals.discount)}</span></div>` : ''}
      <div class="sum-row"><span>Delivery</span><span>${o.totals.delivery ? peso(o.totals.delivery) : 'Free'}</span></div>
      <div class="sum-row total"><span>Total</span><span>${peso(o.totals.total)}</span></div>
      <div class="order-meta"><div><b>Customer</b>${esc(o.customer)}<br>${esc(o.user)}</div><div><b>Recipient</b>${esc(o.recipient.name)}<br>${esc(o.recipient.phone)}</div>
        <div><b>Address</b>${esc(o.recipient.address)}, ${esc(o.recipient.city)} ${esc(o.recipient.zip)}</div><div><b>Delivery</b>${prettyDate(o.delivery.date)} · ${esc(o.delivery.time)}${o.delivery.note ? '<br><em>' + esc(o.delivery.note) + '</em>' : ''}</div><div><b>Payment</b>${esc(o.payment)}</div></div>`, 'medium');
  }

  /* ---- Contact ---- */
  function handleContact(form) {
    const data = validate(form, {
      name: (v) => v.length < 2 ? 'Please enter your name.' : '',
      email: (v) => !v ? 'Please enter your email.' : !EMAIL_RE.test(v) ? 'Enter a valid email address.' : '',
      subject: (v) => !v ? 'Please choose a topic.' : '',
      message: (v) => v.length < 10 ? 'Please write at least 10 characters.' : ''
    });
    if (!data) return;
    state.messages.push({ name: data.name, email: data.email, subject: data.subject, message: data.message, at: new Date().toISOString() });
    save('messages'); form.reset(); $('#contactSuccess').hidden = false; toast('Message sent. Thank you!');
  }

  /* ---- Quick view ---- */
  function quickView(pid) {
    const p = getProduct(pid); if (!p) return;
    const out = p.stock <= 0; const wished = state.wish.includes(p.id);
    openModal(`<div class="quick"><div class="art">${prodMedia(p, p.name)}</div><div>
      <p class="eyebrow">${esc(catLabel(p.category))}</p><h2>${esc(p.name)}</h2>
      ${p.reviews ? `<div class="rating">${stars(p.rating)} <span>${p.rating.toFixed(1)} (${p.reviews} reviews)</span></div>` : ''}
      <p style="margin-top:.8rem">${esc(p.desc)}</p>
      ${(p.occasions || []).length ? `<p class="muted" style="font-size:.85rem">Great for: ${p.occasions.map((o) => esc(occLabel(o))).join(', ')}</p>` : ''}
      ${p.message ? `<label class="sr-only" for="qv-msg">Your message for the card</label><textarea id="qv-msg" class="addon-msg" maxlength="300" placeholder="Write your own message for the card (optional)"></textarea>` : ''}
      <p class="price" style="font-size:1.8rem">${peso(p.price)}</p>
      <p class="stock ${out ? 'none' : p.stock <= 5 ? 'low' : ''}">${out ? 'Currently unavailable' : p.stock <= 5 ? 'Only ' + p.stock + ' left' : 'In stock'}</p>
      <div class="row-actions"><button class="btn btn-primary" data-action="add" data-id="${esc(p.id)}" ${out ? 'disabled' : ''}>${out ? 'Sold out' : 'Add to Cart'}</button>
      <button class="btn btn-ghost" data-action="wish" data-id="${esc(p.id)}" aria-pressed="${wished}">${wished ? '♥ In wishlist' : '♡ Add to wishlist'}</button></div></div></div>`);
  }

  /* ------------------------------------------------------------------------
     10. Menus + events
     ------------------------------------------------------------------------ */
  function copyPromoCodeFallback(code) {
    const field = document.createElement('textarea');
    field.value = code;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    try {
      if (document.execCommand('copy')) toast('Promo code copied: ' + code);
      else toast('Could not copy the promo code. Please copy ' + code + ' manually.', 'error');
    } catch (error) {
      toast('Could not copy the promo code. Please copy ' + code + ' manually.', 'error');
    } finally {
      field.remove();
    }
  }

  function copyPromoCode() {
    const code = 'BLOOM10';
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(code)
        .then(() => toast('Promo code copied: ' + code))
        .catch(() => copyPromoCodeFallback(code));
      return;
    }
    copyPromoCodeFallback(code);
  }

  function closeMenus() {
    const nav = $('#nav'); const btn = $('#menuBtn');
    if (nav) nav.classList.remove('open'); if (btn) btn.setAttribute('aria-expanded', 'false');
    const dd = $('#userDropdown'); if (dd) dd.hidden = true;
    const ub = $('.user-btn'); if (ub) ub.setAttribute('aria-expanded', 'false');
  }

  document.addEventListener('click', (e) => {
    const inUser = e.target.closest('.user-menu');
    if (!inUser) { const dd = $('#userDropdown'); if (dd && !dd.hidden) closeMenus(); }
    const link = e.target.closest('a[href^="#/"]');
    if (link && inUser) closeMenus();

    const catBtn = e.target.closest('button[data-category]');
    if (catBtn) { const c = catBtn.dataset.category; go('shop', { cat: CAT_ALIAS[c] || c }); return; }
    const occBtn = e.target.closest('button[data-occasion]');
    if (occBtn) { const o = occBtn.dataset.occasion; go('shop', { occ: OCC_ALIAS[o] || o }); return; }

    const el = e.target.closest('[data-action]'); if (!el) return;
    const act = el.dataset.action; const id = el.dataset.id; const key = el.dataset.key;
    switch (act) {
      case 'copy-promo': copyPromoCode(); break;
      case 'dismiss-promo': {
        $('#topPromo').hidden = true;
        $('.brand').focus();
        break;
      }
      case 'add': addToCart(id, el); break;
      case 'filter-addon-cat': addonFilters.cat = el.dataset.cat; renderAddons(); break;
      case 'reset-addons': addonFilters.q = ''; addonFilters.cat = 'all'; addonFilters.sort = 'featured'; renderAddons(); break;
      case 'wish': toggleWish(id); if (!$('#modal').hidden && $('.quick')) quickView(id); break;
      case 'quick': quickView(id); break;
      case 'qty-inc': changeQty(key, 1); break;
      case 'qty-dec': changeQty(key, -1); break;
      case 'remove': removeLine(key); break;
      case 'remove-promo': state.promo = null; save('promo'); renderCart(); toast('Promo code removed'); break;
      case 'filter-cat': shopFilters.cat = el.dataset.cat; renderShop(); break;
      case 'reset-filters': shopFilters.q = ''; shopFilters.cat = 'all'; shopFilters.occ = 'all'; shopFilters.sort = 'featured'; applyShopParams(); renderShop(); break;
      case 'close-modal': closeModal(); break;
      case 'confirm-ok': { const r = modalResolve; modalResolve = null; closeModal(); if (r) r(true); break; }
      case 'toggle-user': { const dd = $('#userDropdown'); const open = dd.hidden; dd.hidden = !open; el.setAttribute('aria-expanded', String(open)); break; }
      case 'logout': closeMenus(); logout(); break;
      case 'auth-tab': setAuthTab(el.dataset.tab); break;
      case 'admin-tab': adminTab = el.dataset.tab; renderAdmin(); break;
      case 'admin-add': productFormModal(null); break;
      case 'admin-edit': productFormModal(getProduct(id)); break;
      case 'admin-delete': {
        const p = getProduct(id); if (!p) break;
        confirmBox('Delete product?', '“' + p.name + '” will be permanently removed from the shop.', 'Delete').then((ok) => {
          if (!ok) return;
          state.products = state.products.filter((x) => x.id !== id); state.wish = state.wish.filter((x) => x !== id);
          save('products', 'wish'); syncCart(); updateBadges(); renderAdmin(); toast('Product deleted');
        });
        break;
      }
      case 'admin-order': { const o = state.orders.find((x) => x.id === id); if (o) orderDetailModal(o); break; }
      case 'reset-demo':
        confirmBox('Reset demo data?', 'This clears all products, accounts, carts, wishlists and orders in this browser and restores the sample shop.', 'Reset').then((ok) => {
          if (!ok) return; store.clearAll(); location.hash = '#/home'; location.reload();
        });
        break;
      default: break;
    }
  });

  document.addEventListener('submit', (e) => {
    const f = e.target; e.preventDefault();
    switch (f.getAttribute('id')) {
      case 'loginForm': handleLogin(f); break;
      case 'registerForm': handleRegister(f); break;
      case 'checkoutForm': handleCheckout(f); break;
      case 'contactForm': handleContact(f); break;
      case 'productForm': handleProductForm(f); break;
      case 'promoForm': applyPromo(new FormData(f).get('code')); break;
      default: break;
    }
  });

  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.name === 'payment' && t.closest('#checkoutForm')) showPayDetail(t.value);
    if (t.dataset && t.dataset.adminField) {
      const p = getProduct(t.dataset.id); const field = t.dataset.adminField; const v = Number(t.value);
      if (!p) return;
      const valid = field === 'price' ? v > 0 : Number.isInteger(v) && v >= 0;
      if (!valid) { t.value = p[field]; toast(field === 'price' ? 'Price must be greater than 0.' : 'Stock must be a whole number, 0 or more.', 'error'); return; }
      p[field] = Math.round(v); save('products'); syncCart(); updateBadges(); toast((field === 'price' ? 'Price' : 'Stock') + ' updated for ' + p.name);
    }
    if (t.dataset && t.dataset.adminStatus) {
      const o = state.orders.find((x) => x.id === t.dataset.adminStatus);
      if (o) { o.status = t.value; save('orders'); toast('Order ' + o.id + ' → ' + o.status); renderAdmin(); }
    }
  });

  // Format card inputs while typing
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.name === 'cardnumber') { const d = t.value.replace(/\D/g, '').slice(0, 19); t.value = d.replace(/(.{4})/g, '$1 ').trim(); }
    if (t.name === 'cardexp') { let d = t.value.replace(/\D/g, '').slice(0, 4); if (d.length > 2) d = d.slice(0, 2) + '/' + d.slice(2); t.value = d; }
    if (t.name === 'cardcvc') t.value = t.value.replace(/\D/g, '').slice(0, 4);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { if (!$('#modal').hidden) closeModal(); closeMenus(); }
    if (e.key === 'Tab' && !$('#modal').hidden) { // keep focus inside dialog
      const f = $$('button, a[href], input, select, textarea', $('.modal-card')).filter((x) => !x.disabled && x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0]; const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  $('#menuBtn').addEventListener('click', () => {
    const nav = $('#nav'); const open = !nav.classList.contains('open');
    nav.classList.toggle('open', open); $('#menuBtn').setAttribute('aria-expanded', String(open));
  });
  window.addEventListener('hashchange', route);

  /* ------------------------------------------------------------------------
     11. Decorative extras + init
     ------------------------------------------------------------------------ */
  function initPetals() {
    const box = $('#petals'); if (!box || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const petals = [];
    for (let i = 0; i < 42; i++) {
      const p = document.createElement('span'); p.className = 'petal';
      const size = 10 + Math.random() * 12;
      p.style.cssText = `left:${Math.random() * 100}%;width:${size}px;height:${size * 1.25}px;opacity:${.45 + Math.random() * .4}`;
      box.appendChild(p);
      petals.push({ element: p, pace: .75 + Math.random() * .5, offset: Math.random() });
    }

    function updatePetalFall() {
      const pageHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
      const baseDuration = Math.max(14, pageHeight / Math.max(window.innerHeight, 1) * 12);
      box.style.setProperty('--petal-page-height', pageHeight + 'px');
      petals.forEach(({ element, pace, offset }) => {
        const duration = baseDuration * pace;
        element.style.setProperty('--petal-fall-distance', pageHeight + 'px');
        element.style.animationDuration = duration + 's';
        element.style.animationDelay = -(duration * offset) + 's';
      });
    }

    updatePetalFall();
    window.addEventListener('resize', updatePetalFall);
    if ('ResizeObserver' in window) new ResizeObserver(updatePetalFall).observe(document.body);
  }
  function hideLoader() { const l = $('#loader'); if (l) { l.classList.add('done'); setTimeout(() => l.remove(), 800); } }

  function init() {
    $('#year').textContent = new Date().getFullYear();
    initPetals();
    checkImages();
    syncCart();
    if (!location.hash) location.hash = '#/home'; else route();
    if (!location.hash || location.hash === '#/home') route();
    
    window.addEventListener('load', () => setTimeout(hideLoader, 5000));
    setTimeout(hideLoader, 5000);
    if (document.readyState === 'complete') setTimeout(hideLoader, 5000);
  }
  init();

})();



/* ========================================
   BLOOM & BLISS — CURSOR PETAL TRAIL
======================================== */

(() => {
  const trail = document.getElementById("petal-trail");

  if (!trail) return;

  // Disable on touch/coarse pointers and reduced motion.
  const finePointer = window.matchMedia(
    "(hover: hover) and (pointer: fine)"
  );

  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  );

  const MAX_PETALS = 18;
  const SPAWN_DISTANCE = 14;
  const PETAL_COLORS = [
    "#e9a8b5",
    "#f3c5cd",
    "#fff0f2",
    "#d9a0ad",
    "#f5d7dc"
  ];

  let lastX = 0;
  let lastY = 0;
  let hasMoved = false;
  let active = 0;

  function isEnabled() {
    return finePointer.matches && !reducedMotion.matches;
  }

  function clearTrail() {
    trail.replaceChildren();
    active = 0;
    hasMoved = false;
  }

  function createPetal(x, y) {
    if (!isEnabled() || active >= MAX_PETALS) return;

    const petal = document.createElement("span");
    const size = 7 + Math.random() * 7;
    const duration = 650 + Math.random() * 450;
    const driftX = (Math.random() - 0.5) * 65;
    const driftY = -15 - Math.random() * 40;
    const startAngle = Math.random() * 180;
    const endAngle = startAngle +
      (Math.random() > 0.5 ? 180 : -180);

    petal.className = "cursor-petal";

    petal.style.left = `${x}px`;
    petal.style.top = `${y}px`;
    petal.style.setProperty("--petal-size", `${size}px`);
    petal.style.setProperty("--petal-duration", `${duration}ms`);
    petal.style.setProperty("--drift-x", `${driftX}px`);
    petal.style.setProperty("--drift-y", `${driftY}px`);
    petal.style.setProperty("--start-angle", `${startAngle}deg`);
    petal.style.setProperty("--end-angle", `${endAngle}deg`);
    petal.style.setProperty(
      "--petal-color",
      PETAL_COLORS[
        Math.floor(Math.random() * PETAL_COLORS.length)
      ]
    );

    trail.appendChild(petal);
    active++;

    petal.addEventListener("animationend", () => {
      petal.remove();
      active = Math.max(0, active - 1);
    }, { once: true });
  }

  function handleMouseMove(event) {
    if (!isEnabled()) return;

    const x = event.clientX;
    const y = event.clientY;

    if (!hasMoved) {
      lastX = x;
      lastY = y;
      hasMoved = true;
      createPetal(x, y);
      return;
    }

    const distance = Math.hypot(x - lastX, y - lastY);

    if (distance < SPAWN_DISTANCE) return;

    lastX = x;
    lastY = y;
    createPetal(x, y);
  }

  // Listen only when the effect is enabled.
  function updateListeners() {
    clearTrail();

    if (isEnabled()) {
      window.addEventListener("pointermove", handleMouseMove, {
        passive: true
      });
    } else {
      window.removeEventListener("pointermove", handleMouseMove);
    }
  }

  finePointer.addEventListener("change", updateListeners);
  reducedMotion.addEventListener("change", updateListeners);

  updateListeners();
})();
