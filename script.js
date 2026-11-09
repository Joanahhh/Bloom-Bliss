/* ==========================================================================
   Bloom & Bliss — Every Bloom Tells a Story
   Vanilla JavaScript storefront backed by Supabase.

   Payments remain simulated; customer accounts and shared shop data use
   Supabase Auth and Postgres. Browser storage is only a local cache.
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
  const supabaseConfig = window.BLOOM_SUPABASE_CONFIG;
  const supabaseClient = window.supabase && supabaseConfig
    ? window.supabase.createClient(supabaseConfig.url, supabaseConfig.publishableKey)
    : null;
  let cloudReady = false;
  let cloudInitialization = null;
  let cloudInitializationError = null;

  const PESO = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 });
  const peso = (n) => PESO.format(Math.round(n));

  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem('bb_' + key); return v === null ? fallback : JSON.parse(v); }
      catch (e) { return fallback; }
    },
    set(key, value) {
      try {
        localStorage.setItem('bb_' + key, JSON.stringify(value));
        return true;
      } catch (error) {
        console.error('Could not save Bloom & Bliss browser data.', error);
        return false;
      }
    },
    clearAll() { try { Object.keys(localStorage).filter((k) => k.indexOf('bb_') === 0).forEach((k) => localStorage.removeItem(k)); } catch (e) { /* ignore */ } }
  };

  function applyTheme(theme) {
    const isDark = theme === 'dark';
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
    const themeColor = $('meta[name="theme-color"]');
    if (themeColor) themeColor.content = isDark ? '#171217' : '#70263D';
    const toggle = $('.theme-toggle');
    if (!toggle) return;
    toggle.setAttribute('aria-pressed', String(isDark));
    const label = isDark ? 'Switch to light mode' : 'Switch to night mode';
    toggle.setAttribute('aria-label', label);
    toggle.title = label;
    $('.theme-icon-moon', toggle).hidden = isDark;
    $('.theme-icon-sun', toggle).hidden = !isDark;
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
     3. State (cached locally and synchronized with Supabase)
     ------------------------------------------------------------------------ */
  const state = {
    products: [],
    customProducts: store.get('products', null) !== null,
    cart: store.get('cart', []),
    wish: store.get('wish', []),
    users: [],
    session: null,
    authUser: null,
    profile: null,
    orders: [],
    ownerOrderNotifications: [],
    messages: [],
    conversations: [],
    reviews: [],
    promo: store.get('promo', null)
  };

  /* The product catalog starts from index.html, then Supabase is authoritative. */
  function readProductsFromDOM() {
    return $$('#shopGrid > .product-card, #addonGrid > .product-card').map((el) => {
      const d = el.dataset; const text = (sel) => ($(sel, el) ? $(sel, el).textContent.trim() : '');
      let art = {}; try { art = JSON.parse(d.art || '{}'); } catch (e) { /* ignore bad art */ }
      const img = $('.media-btn img', el);
      return {
        id: d.id, name: text('h3'), category: d.category, price: +d.price, stock: +d.stock,
        rating: 0, reviews: 0, best: d.best === 'true', message: d.message === 'true',
        occasions: (d.occasions || '').split(',').filter(Boolean), desc: text('.desc'), art,
        image: img ? (img.getAttribute('src') || '').trim() : ''
      };
    });
  }
  const domProducts = readProductsFromDOM();
  state.products = state.customProducts ? store.get('products', []) : domProducts;
  // Use the packaged product image paths even if the cached catalog is older.
  state.products.forEach((p) => { const d = domProducts.find((x) => x.id === p.id); if (d && d.image) p.image = d.image; if (d && isAddon(d)) p.message = d.message; });
  // Add-ons written in index.html that are missing from an older saved catalog are added automatically.
  domProducts.forEach((d) => { if (isAddon(d) && !state.products.some((p) => p.id === d.id)) state.products.push(d); });

  const save = (...keys) => {
    keys.forEach((key) => {
      if (key === 'products') state.customProducts = true;
      store.set(key, state[key]);
    });
    return cloudReady
      ? Promise.all(keys.map((key) => persistCloudKey(key)))
      : Promise.resolve(keys.map(() => true));
  };
  const getProduct = (id) => state.products.find((p) => p.id === id);
  const currentUser = () => state.profile;
  const isAdmin = () => { const u = currentUser(); return !!u && u.role === 'admin'; };
  function reportCloudError(action, error) {
    console.error(`Supabase ${action} failed.`, error);
    if (error && (error.code === 'PGRST205' || error.code === '42P01')) {
      toast('The Supabase database schema is not installed. Apply supabase/schema.sql, then reload.', 'error');
    } else if (error && error.code === 'P0001' && typeof error.message === 'string') {
      const message = error.message === 'A product in your cart is no longer available.'
        ? 'A product in your cart is missing from the store catalog. Please ask the owner to sign in and sync the catalog, then try again.'
        : error.message;
      toast(message, 'error');
    } else {
      toast(`Could not ${action}. Please try again.`, 'error');
    }
  }
  async function persistCloudKey(key) {
    if (!supabaseClient) return false;
    if (!state.authUser) return ['cart', 'wish', 'promo'].includes(key);
    try {
      if (key === 'products' && isAdmin()) {
        if (state.products.length) {
          const { error } = await supabaseClient.from('products').upsert(
            state.products.map((product) => ({ id: product.id, data: product }))
          );
          if (error) throw error;
        }
      } else if (['cart', 'wish'].includes(key)) {
        const value = state[key];
        const { error } = await supabaseClient.from('user_preferences').upsert(
          { user_id: state.authUser.id, key, value },
          { onConflict: 'user_id,key' }
        );
        if (error) throw error;
      } else if (key === 'ownerOrderNotifications' && isAdmin() && !state.ownerOrderNotifications.length) {
        const { error } = await supabaseClient.from('owner_notifications')
          .update({ read_at: new Date().toISOString() }).is('read_at', null);
        if (error) throw error;
      }
      return true;
    } catch (error) {
      reportCloudError(`save ${key}`, error);
      return false;
    }
  }

  async function loadCloudState(authUser) {
    const previousAuthUserId = state.authUser && state.authUser.id;
    if (authUser && previousAuthUserId !== authUser.id) {
      state.cart = [];
      state.wish = [];
    }
    state.authUser = authUser || null;
    state.profile = null;
    state.session = null;
    state.users = [];
    state.ownerOrderNotifications = [];
    state.messages = [];
    state.conversations = [];

    if (authUser) {
      const { data: profile, error } = await supabaseClient.from('profiles')
        .select('id,email,name,avatar,role').eq('id', authUser.id).maybeSingle();
      if (error) throw error;
      if (!profile) throw new Error('Your account profile is not ready. Contact the store owner.');
      state.profile = profile;
      state.session = profile.email;
      const { data: profiles, error: profilesError } = await supabaseClient.from('profiles')
        .select('id,email,name,avatar,role');
      if (profilesError) throw profilesError;
      state.users = profiles || [];
    } else {
      state.cart = store.get('cart', []);
      state.wish = store.get('wish', []);
      state.promo = store.get('promo', null);
      state.orders = [];
      state.ownerOrderNotifications = [];
      state.conversations = [];
      state.messages = [];
    }

    const [productResult, reviewResult] = await Promise.all([
      supabaseClient.from('products').select('id,data'),
      supabaseClient.from('reviews').select('id,product_id,user_id,customer_name,rating,text,created_at')
    ]);
    if (productResult.error) throw productResult.error;
    if (reviewResult.error) throw reviewResult.error;
    const cloudProducts = (productResult.data || []).map((row) => row.data);
    state.customProducts = cloudProducts.length > 0;
    state.products = cloudProducts.length ? cloudProducts : domProducts;
    state.products.forEach((product) => {
      const original = domProducts.find((item) => item.id === product.id);
      if (original && original.image) product.image = original.image;
    });
    state.reviews = (reviewResult.data || []).map((review) => ({
      id: review.id, productId: review.product_id, userId: review.user_id,
      customer: review.customer_name, rating: review.rating, text: review.text,
      createdAt: review.created_at
    }));

    if (authUser) {
      const preferenceResult = await supabaseClient.from('user_preferences')
        .select('key,value').eq('user_id', authUser.id);
      if (preferenceResult.error) throw preferenceResult.error;
      const loadedPreferences = new Set();
      (preferenceResult.data || []).forEach((preference) => {
        state[preference.key] = preference.value;
        loadedPreferences.add(preference.key);
        store.set(preference.key, preference.value);
      });
      await Promise.all(['cart', 'wish']
        .filter((key) => !loadedPreferences.has(key))
        .map((key) => persistCloudKey(key)));

      const orderResult = await supabaseClient.from('orders').select('id,status,data').order('created_at', { ascending: false });
      if (orderResult.error) throw orderResult.error;
      state.orders = (orderResult.data || []).map((row) => Object.assign({}, row.data, { id: row.id, status: row.status }));

      const conversationResult = await supabaseClient.from('conversations')
        .select('id,customer_id,updated_at,conversation_messages(id,sender_id,text,created_at)')
        .order('updated_at', { ascending: false });
      if (conversationResult.error) throw conversationResult.error;
      const profilesById = new Map(state.users.map((profile) => [profile.id, profile]));
      state.conversations = (conversationResult.data || []).map((conversation) => {
        const customer = profilesById.get(conversation.customer_id) || state.profile;
        return {
          id: conversation.id, customerId: conversation.customer_id,
          email: customer.email, name: customer.name,
          messages: (conversation.conversation_messages || []).slice()
            .sort((a, b) => a.created_at.localeCompare(b.created_at))
            .map((message) => ({
              id: message.id,
              from: message.sender_id === conversation.customer_id ? 'customer' : 'owner',
              text: message.text, at: message.created_at
            }))
        };
      });

      if (isAdmin()) {
        const [messageResult, notificationResult] = await Promise.all([
          supabaseClient.from('contact_messages').select('id,name,email,subject,message,created_at').order('created_at', { ascending: false }),
          supabaseClient.from('owner_notifications')
            .select('id,order_id,notification_type').is('read_at', null)
        ]);
        if (messageResult.error) throw messageResult.error;
        if (notificationResult.error) throw notificationResult.error;
        state.messages = (messageResult.data || []).map((message) => ({
          id: message.id, name: message.name, email: message.email, subject: message.subject,
          message: message.message, at: message.created_at
        }));
        state.ownerOrderNotifications = notificationResult.data || [];
        if (!cloudProducts.length) {
          const { error } = await supabaseClient.from('products').upsert(
            domProducts.map((product) => ({ id: product.id, data: product }))
          );
          if (error) throw error;
          state.products = domProducts;
          state.customProducts = true;
        }
      }
    }
    cloudReady = true;
    renderAuthArea();
    updateBadges();
  }

  async function initializeSupabase() {
    if (!supabaseClient) {
      throw new Error('Supabase client library or public project configuration is unavailable.');
    }
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    await loadCloudState(data.session ? data.session.user : null);
    route();
    supabaseClient.auth.onAuthStateChange((event, session) => {
      setTimeout(async () => {
        try {
          await loadCloudState(session ? session.user : null);
          if (event !== 'INITIAL_SESSION') route();
        } catch (reason) {
          reportCloudError('load your account data', reason);
        }
      }, 0);
    });
    subscribeToCloudChanges();
  }

  async function requireCloudStore(action) {
    if (!cloudReady && cloudInitialization) await cloudInitialization;
    if (cloudReady) return true;
    if (cloudInitializationError) {
      toast(`Could not ${action} because the store database did not connect. Check your connection and Supabase setup, then reload.`, 'error');
    } else {
      toast(`The store database is still loading. Please try again in a moment.`, 'error');
    }
    return false;
  }

  function renderAfterCloudRefresh() {
    const scrollY = window.scrollY;
    route();
    window.scrollTo({ top: scrollY, behavior: 'auto' });
  }

  function subscribeToCloudChanges() {
    let refreshQueue = Promise.resolve();
    let refreshTimer = null;
    const tables = ['profiles', 'products', 'user_preferences', 'orders', 'reviews', 'conversations', 'conversation_messages', 'contact_messages', 'owner_notifications'];
    let channel = supabaseClient.channel('bloom-bliss-store-data');
    tables.forEach((table) => {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => {
        refreshQueue = refreshQueue.then(async () => {
          const previousNotifications = state.ownerOrderNotifications.slice();
          const previousOrderStatuses = new Map(state.orders.map((order) => [order.id, order.status]));
          const previousMessageIds = new Set(state.conversations.flatMap((conversation) =>
            conversation.messages.map((message) => message.id).filter(Boolean)
          ));
          const previousContactIds = new Set(state.messages.map((message) => message.id).filter(Boolean));
          await loadCloudState(state.authUser);
          const newNotifications = state.ownerOrderNotifications.filter((notification) =>
            !previousNotifications.some((previous) => previous.id === notification.id)
          );
          if (isAdmin() && newNotifications.length) {
            const notification = newNotifications[newNotifications.length - 1];
            const order = state.orders.find((item) => item.id === notification.order_id);
            if (notification.notification_type === 'order_received') {
              toast(order ? `${order.customer} confirmed order ${order.id} was received.` : 'A customer confirmed an order was received.');
            } else {
              toast(order ? `New order from ${order.customer}.` : 'New customer order received.');
            }
          }
          const changedOrder = state.orders.find((order) =>
            previousOrderStatuses.has(order.id) && previousOrderStatuses.get(order.id) !== order.status
          );
          if (!isAdmin() && changedOrder) toast(`Order ${changedOrder.id} is now ${changedOrder.status}.`);
          const incomingMessages = state.conversations.flatMap((conversation) =>
            conversation.messages
              .filter((message) => message.id && !previousMessageIds.has(message.id))
              .map((message) => ({ conversation, message }))
          );
          const incomingMessage = incomingMessages.find(({ message }) =>
            message.from === (isAdmin() ? 'customer' : 'owner')
          );
          if (incomingMessage) {
            const activeThread = currentPage === 'chat' || (currentPage === 'admin' && adminTab === 'messages');
            if (!activeThread) {
              toast(isAdmin()
                ? `New message from ${incomingMessage.conversation.name}.`
                : 'Bloom & Bliss sent you a chat message.');
            }
          }
          const newContactMessage = state.messages.find((message) => message.id && !previousContactIds.has(message.id));
          if (isAdmin() && newContactMessage) toast(`New contact message from ${newContactMessage.name}.`);
          renderAfterCloudRefresh();
        }).catch((error) => reportCloudError('refresh shared store data', error));
        }, 120);
      });
    });
    channel.subscribe((status, error) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error('Supabase live updates are unavailable.', error || status);
      }
    });
  }
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
  document.addEventListener('change', async (e) => {
    const t = e.target;
    if (t && t.id === 'profilePhotoInput') { handleProfilePhotoInput(t); return; }
    if (!t || !t.name || !t.form) return;
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
  function reviewsFor(pid) {
    return state.reviews.filter((review) => review.productId === pid)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }
  function productRating(p) {
    const written = reviewsFor(p.id);
    const total = written.reduce((sum, review) => sum + review.rating, 0);
    return { count: written.length, average: written.length ? total / written.length : 0 };
  }

  function productCard(p) {
    const out = p.stock <= 0; const low = !out && p.stock <= 5;
    const wished = state.wish.includes(p.id);
    const rating = productRating(p);
    const tag = out ? '<span class="tag out">Sold out</span>' : p.best ? '<span class="tag">Bestseller</span>' : low ? '<span class="tag">Low stock</span>' : '';
    return `<article class="card product-card reveal" data-id="${esc(p.id)}" data-category="${esc(p.category)}" data-price="${p.price}" data-stock="${p.stock}" data-rating="${rating.average}" data-reviews="${rating.count}" data-best="${!!p.best}" ${p.message ? 'data-message="true" ' : ''}data-occasions="${esc((p.occasions || []).join(','))}" data-art="${esc(JSON.stringify(p.art))}">
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
        <div class="product-rating-row">${rating.count ? `<div class="rating">${stars(rating.average)} <span>${rating.average.toFixed(1)} (${rating.count})</span></div>` : '<span class="muted" style="font-size:.8rem">No ratings yet</span>'}<button type="button" class="link-btn" data-action="quick" data-id="${esc(p.id)}">${reviewsFor(p.id).length ? `Read feedback (${reviewsFor(p.id).length})` : 'Write a review'}</button></div>
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
  function saveCartMessage(key, button) {
    const line = state.cart.find((i) => i.key === key);
    const input = button.closest('.cart-item').querySelector('.cart-message-input');
    if (!line || !input) return;
    line.message = input.value.trim();
    save('cart');
    renderCart();
    toast(line.message ? 'Card message saved.' : 'Card message removed.');
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
  const PAGES = ['home', 'shop', 'categories', 'occasions', 'addons', 'cart', 'login', 'checkout', 'confirmation', 'wishlist', 'orders', 'profile', 'chat', 'about', 'branches', 'contact', 'admin'];
  const NAV_MAP = { home: 'home', shop: 'shop', categories: 'categories', occasions: 'occasions', addons: 'addons', about: 'about', branches: 'branches', contact: 'contact' };
  let currentPage = 'home';
  let params = new URLSearchParams();
  let lastRouteKey = null;

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

  let loaderHideTimer = null;
  let initialLoaderTimer = null;
  let tabBloomCleanupTimer = null;
  function showLoader() {
    const loader = $('#loader');
    if (!loader) return;
    clearTimeout(initialLoaderTimer);
    initialLoaderTimer = null;
    clearTimeout(loaderHideTimer);
    loader.classList.remove('done');
  }
  function hideLoader(delay = 700) {
    const loader = $('#loader');
    if (!loader) return;
    clearTimeout(loaderHideTimer);
    loaderHideTimer = setTimeout(() => loader.classList.add('done'), delay);
  }
  function startTabTransition() {
    const loader = $('#loader');
    if (!loader) return;
    const flower = $('.loader-bloom .flower', loader);
    if (!flower) return;

    clearTimeout(tabBloomCleanupTimer);
    showLoader();
    loader.classList.add('tab-transition');
    flower.replaceWith(flower.cloneNode(true));
    hideLoader(750);
    tabBloomCleanupTimer = setTimeout(() => {
      loader.classList.remove('tab-transition');
    }, 1050);
  }
  function scheduleInitialLoaderHide() {
    clearTimeout(initialLoaderTimer);
    initialLoaderTimer = setTimeout(() => {
      initialLoaderTimer = null;
      hideLoader();
    }, 5000);
  }

  function route() {
    const parsed = parseHash();
    let page = parsed.page; params = parsed.params;
    const routeKey = location.hash;
    if (lastRouteKey !== null && routeKey !== lastRouteKey) startTabTransition();

    // Guards
    if (page === 'checkout' || page === 'orders' || page === 'confirmation' || page === 'profile' || page === 'chat') {
      if (!currentUser()) { go('login', { next: page === 'confirmation' ? 'orders' : page, notice: page === 'checkout' ? 'checkout' : page === 'profile' ? 'profile' : page === 'chat' ? 'chat' : 'orders' }); return; }
    }
    if (page === 'chat' && currentUser().role === 'admin') { go('admin'); return; }
    if (page === 'admin' && !isAdmin()) {
      if (!currentUser()) { go('login', { next: 'admin', notice: 'admin' }); } else { toast('Admin access only.', 'error'); go('home'); }
      return;
    }
    currentPage = page;
    lastRouteKey = routeKey;
    $$('.page').forEach((p) => p.classList.remove('active'));
    const el = $('#page-' + page); el.classList.add('active');
    const qrCard = $('.website-qr-card'); if (qrCard) qrCard.hidden = page !== 'home';
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
      case 'chat': renderCustomerChat(); break;
      case 'profile': renderProfile(); break;
      case 'branches': renderBranches(); break;
      case 'admin':
        if (['overview', 'products', 'orders', 'messages'].includes(params.get('tab'))) adminTab = params.get('tab');
        renderAdmin();
        break;
      default: break;
    }
    renderAuthArea(); updateBadges(); syncWishButtons();
    window.scrollTo({ top: 0, behavior: 'auto' });
    observeReveals();
  }

  /* ------------------------------------------------------------------------
     9. Page renderers
     ------------------------------------------------------------------------ */
  let visitorId = '';
  let liveVisitorChannel = null;
  let liveVisitorCount = null;
  const backgroundMusic = $('#backgroundMusic');
  let musicPlaying = false;
  let musicUnavailable = false;

  function updateMusicControl() {
    const button = $('#musicToggle');
    const label = $('#musicToggleLabel');
    if (!button || !label) return;
    button.setAttribute('aria-pressed', String(musicPlaying));
    button.setAttribute('aria-label', musicUnavailable ? 'Background music unavailable' : musicPlaying ? 'Pause background music' : 'Play background music');
    label.textContent = musicUnavailable ? 'Music unavailable' : musicPlaying ? 'Pause music' : 'Play music';
  }

  async function startBackgroundMusic() {
    if (!backgroundMusic) return false;
    try {
      await backgroundMusic.play();
      musicUnavailable = false;
      $('#musicToggle').removeAttribute('title');
      musicPlaying = true;
      updateMusicControl();
      return true;
    } catch (error) {
      musicPlaying = false;
      updateMusicControl();
      if (error.name === 'NotAllowedError') {
        $('#musicToggle').title = 'Autoplay was blocked. Click to start the music.';
        return false;
      }
      musicUnavailable = true;
      updateMusicControl();
      console.error('Could not play the background music file.', error);
      return false;
    }
  }

  async function stopBackgroundMusic() {
    if (backgroundMusic) backgroundMusic.pause();
    musicPlaying = false;
    updateMusicControl();
  }

  function renderHomeStats() {
    const visitorCount = $('#homeVisitorCount');
    const ratingValue = $('#homeStoreRating');
    const ratingCount = $('#homeRatingCount');
    if (!visitorCount || !ratingValue || !ratingCount) return;

    visitorCount.textContent = liveVisitorCount === null ? '—' : String(liveVisitorCount);

    const totals = state.products.reduce((result, product) => {
      const rating = productRating(product);
      result.count += rating.count;
      result.total += rating.average * rating.count;
      return result;
    }, { total: 0, count: 0 });
    const average = totals.count ? totals.total / totals.count : 0;
    ratingValue.textContent = totals.count ? average.toFixed(1) : '—';
    ratingCount.textContent = totals.count
      ? `From ${totals.count} customer ${totals.count === 1 ? 'review' : 'reviews'}`
      : 'No customer reviews yet';
    const ratingStars = $('#homeRatingStars');
    if (ratingStars) ratingStars.style.setProperty('--rating-fill', `${Math.max(0, Math.min(100, average / 5 * 100))}%`);
  }

  function startVisitorPresence() {
    const visitorCount = $('#homeVisitorCount');
    if (!supabaseClient) {
      if (visitorCount) visitorCount.textContent = '—';
      console.error('Live visitor count is unavailable because Supabase is not configured.');
      return;
    }

    visitorId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    try {
      liveVisitorChannel = supabaseClient.channel('store-live-visitors', {
        config: { presence: { key: visitorId } }
      });
      liveVisitorChannel.on('presence', { event: 'sync' }, () => {
        liveVisitorCount = Object.keys(liveVisitorChannel.presenceState()).length;
        if (currentPage === 'home') renderHomeStats();
      });
      liveVisitorChannel.subscribe(async (status, error) => {
        if (status === 'SUBSCRIBED') {
          try {
            const result = await liveVisitorChannel.track({ joined_at: new Date().toISOString() });
            if (result !== 'ok') throw new Error(`Realtime presence tracking returned ${result}.`);
          } catch (trackError) {
            liveVisitorCount = null;
            console.error('Could not join live visitor presence.', trackError);
            if (currentPage === 'home') renderHomeStats();
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          liveVisitorCount = null;
          console.error('Live visitor presence is unavailable.', error || status);
          if (currentPage === 'home') renderHomeStats();
        }
      });
    } catch (error) {
      liveVisitorCount = null;
      console.error('Could not start live visitor presence.', error);
      if (visitorCount) visitorCount.textContent = '—';
    }
  }

  function renderHome() {
    // Hero image and featured collection cards are written in index.html.
    checkCardImages();
    renderHomeStats();

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
    window.addEventListener('resize', positionCategoryIndicator);
  }
  function positionCategoryIndicator() {
    const chips = $('#catChips');
    const indicator = chips && $('.chip-indicator', chips);
    const activeChip = chips && $('.chip-btn.active', chips);
    if (!chips || !indicator || !activeChip) return;

    const containerRect = chips.getBoundingClientRect();
    const chipRect = activeChip.getBoundingClientRect();
    if (!chipRect.width || !chipRect.height) return;

    indicator.style.width = chipRect.width + 'px';
    indicator.style.height = chipRect.height + 'px';
    indicator.style.transform = `translate3d(${chipRect.left - containerRect.left}px, ${chipRect.top - containerRect.top}px, 0)`;
    indicator.classList.add('is-positioned');
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
  function renderShop(animateFilter = false) {
    initShopControls();
    const chips = $('#catChips');
    let indicator = $('.chip-indicator', chips);
    if (!indicator) {
      indicator = document.createElement('span');
      indicator.className = 'chip-indicator';
      indicator.setAttribute('aria-hidden', 'true');
      chips.appendChild(indicator);
    }
    chips.querySelectorAll('.chip-btn').forEach((button) => button.remove());
    chips.insertAdjacentHTML('beforeend', [{ id: 'all', label: 'All' }].concat(CATEGORIES).map((c) =>
      `<button type="button" class="chip-btn ${shopFilters.cat === c.id ? 'active' : ''}" data-action="filter-cat" data-cat="${c.id}" aria-pressed="${shopFilters.cat === c.id}">${esc(c.label)}</button>`).join(''));
    positionCategoryIndicator();
    const q = shopFilters.q.trim().toLowerCase();
    let list = state.products.filter((p) => !isAddon(p) &&
      (!q || p.name.toLowerCase().includes(q)) &&
      (shopFilters.cat === 'all' || p.category === shopFilters.cat) &&
      (shopFilters.occ === 'all' || (p.occasions || []).includes(shopFilters.occ)));
    const sorters = {
      'price-asc': (a, b) => a.price - b.price, 'price-desc': (a, b) => b.price - a.price,
      rating: (a, b) => productRating(b).average - productRating(a).average || productRating(b).count - productRating(a).count, name: (a, b) => a.name.localeCompare(b.name)
    };
    if (sorters[shopFilters.sort]) list = list.slice().sort(sorters[shopFilters.sort]);
    $('#resultCount').textContent = list.length + (list.length === 1 ? ' bouquet' : ' bouquets') + ' found';
    const grid = $('#shopGrid');
    grid.innerHTML = list.map(productCard).join('');
    grid.classList.toggle('filter-glide', animateFilter);
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
    grid.innerHTML = list.map(productCard).join('');
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
    const items = state.cart.map((i) => {
      const product = i.pid ? getProduct(i.pid) : null;
      const messageEditor = product && product.message ? `<div class="cart-message-editor">
          <label for="cart-message-${esc(i.key)}">Card message (optional)</label>
          <textarea id="cart-message-${esc(i.key)}" class="cart-message-input" maxlength="300" placeholder="Write a personal message for the card">${esc(i.message || '')}</textarea>
          <button type="button" class="link-btn" data-action="save-message" data-key="${esc(i.key)}">Save message</button>
        </div>` : '';
      return `<article class="cart-item">
        <div class="cart-thumb">${prodMedia(i, i.name)}</div>
        <div class="cart-info"><h3>${esc(i.name)}</h3><p>${esc(i.note || '')}</p>${i.message && !messageEditor ? `<p class="msg">“${esc(i.message)}”</p>` : ''}${messageEditor}
          <div class="qty" role="group" aria-label="Quantity for ${esc(i.name)}"><button type="button" data-action="qty-dec" data-key="${i.key}" aria-label="Decrease quantity">−</button><output aria-live="polite">${i.qty}</output><button type="button" data-action="qty-inc" data-key="${i.key}" aria-label="Increase quantity">+</button></div>
        </div>
        <div class="cart-price"><strong>${peso(i.price * i.qty)}</strong><small>${peso(i.price)} each</small><button type="button" class="link-btn" data-action="remove" data-key="${i.key}">Remove</button></div>
      </article>`;
    }).join('');
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
  function renderAuthArea(avatarOverride) {
    const u = currentUser(); const box = $('#authArea'); if (!box) return;
    const chatShortcut = $('#chatShortcut');
    if (chatShortcut) {
      chatShortcut.href = !u ? '#/login?next=chat&notice=chat' : u.role === 'admin' ? '#/admin?tab=messages' : '#/chat';
      chatShortcut.setAttribute('aria-label', u && u.role === 'admin' ? 'Open customer chats' : 'Chat with Bloom & Bliss');
    }
    if (!u) {
      box.innerHTML = `<a class="icon-btn" href="#/login" aria-label="Login or sign up"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/></svg></a>`;
      return;
    }
    const avatarSrc = avatarOverride === undefined ? u.avatar : avatarOverride;
    const avatar = avatarSrc ? `<img class="user-avatar-image" src="${esc(avatarSrc)}" alt="">` : esc(u.name.charAt(0).toUpperCase());
    const notifications = u.role === 'admin' ? state.ownerOrderNotifications.length : 0;
    const notificationLink = u.role === 'admin' ? `<a href="#/admin?tab=orders" class="icon-btn owner-order-notifications" aria-label="${notifications ? `${notifications} new customer ${notifications === 1 ? 'order' : 'orders'}` : 'Customer order notifications'}" title="${notifications ? `${notifications} new customer ${notifications === 1 ? 'order' : 'orders'}` : 'Customer order notifications'}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg><span class="badge owner-order-badge" data-count="${notifications}">${notifications || ''}</span></a>` : '';
    box.innerHTML = `${notificationLink}<div class="user-menu"><button class="icon-btn user-btn" data-action="toggle-user" aria-haspopup="true" aria-expanded="false" aria-label="Account menu for ${esc(u.name)}">${avatar}</button>
      <div class="dropdown" id="userDropdown" hidden><p>Signed in as<br><strong>${esc(u.name)}</strong></p>
        <a href="#/profile">${u.role === 'admin' ? 'Owner Profile' : 'My Profile'}</a>${u.role === 'admin' ? '<a href="#/admin">Admin Dashboard</a>' : '<a href="#/chat">Chat with shop</a><a href="#/orders">My Orders</a><a href="#/wishlist">Wishlist</a>'}
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
    const msgs = { checkout: 'Please log in or sign up to complete your order. Your cart is saved.', orders: 'Please log in to view your orders.', profile: 'Please log in to view your profile.', chat: 'Please log in to chat with the shop.', admin: 'Please log in with an administrator account.' };
    notice.hidden = !msgs[n]; notice.textContent = msgs[n] || '';
    if (currentUser()) { go(params.get('next') || 'home'); }
  }
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  function afterAuth() { const next = params.get('next'); go(PAGES.includes(next) ? next : 'home'); }

  async function handleLogin(form) {
    const data = validate(form, {
      email: (v) => !v ? 'Please enter your email.' : !EMAIL_RE.test(v) ? 'Enter a valid email address.' : '',
      password: (v) => !v ? 'Please enter your password.' : ''
    });
    const alert = $('#loginAlert'); alert.hidden = true;
    if (!data) return;
    if (!await requireCloudStore('sign in')) return;
    if (!supabaseClient) {
      alert.hidden = false;
      alert.textContent = 'Sign-in is unavailable because the Supabase client is not configured.';
      return;
    }
    const { data: result, error } = await supabaseClient.auth.signInWithPassword({
      email: data.email.toLowerCase(), password: data.password
    });
    if (error) {
      alert.hidden = false;
      alert.textContent = 'Incorrect email or password. Please try again.';
      return;
    }
    await loadCloudState(result.user);
    form.reset();
    toast('Welcome back, ' + currentUser().name.split(' ')[0] + '!');
    renderAuthArea();
    afterAuth();
  }
  async function handleRegister(form) {
    const data = validate(form, {
      name: (v) => v.length < 2 ? 'Please enter your full name.' : '',
      email: (v) => !v ? 'Please enter your email.' : !EMAIL_RE.test(v) ? 'Enter a valid email address.' : '',
      password: (v) => v.length < 8 ? 'Password must be at least 8 characters.' : !/[A-Za-z]/.test(v) || !/\d/.test(v) ? 'Include both letters and numbers.' : '',
      confirm: (v, d) => v !== d.password ? 'Passwords do not match.' : ''
    });
    if (!data) return;
    if (!await requireCloudStore('create an account')) return;
    if (!supabaseClient) {
      const notice = $('#authNotice');
      notice.hidden = false;
      notice.className = 'form-alert error';
      notice.textContent = 'Registration is unavailable because the Supabase client is not configured.';
      return;
    }
    const { data: result, error } = await supabaseClient.auth.signUp({
      email: data.email.toLowerCase(),
      password: data.password,
      options: { data: { name: data.name.trim() } }
    });
    if (error) {
      const notice = $('#authNotice');
      notice.hidden = false;
      notice.className = 'form-alert error';
      notice.textContent = error.message || 'Your account could not be created. Please try again.';
      return;
    }
    form.reset();
    if (!result.session) {
      const notice = $('#authNotice');
      notice.hidden = false;
      notice.className = 'form-alert info';
      notice.textContent = 'Account created. Check your email to confirm it, then sign in.';
      setAuthTab('login');
      $('#loginEmail').value = data.email.toLowerCase();
      return;
    }
    await loadCloudState(result.user);
    form.reset();
    toast('Account created. Welcome to Bloom & Bliss, ' + currentUser().name.split(' ')[0] + '!');
    renderAuthArea();
    afterAuth();
  }
  async function logout() {
    if (!supabaseClient) { reportCloudError('sign out', new Error('Supabase client is not configured.')); return; }
    state.cart = [];
    state.wish = [];
    state.promo = null;
    store.set('cart', state.cart);
    store.set('wish', state.wish);
    store.set('promo', state.promo);
    const { error } = await supabaseClient.auth.signOut();
    if (error) { reportCloudError('sign out', error); return; }
    await loadCloudState(null);
    renderAuthArea();
    toast('You have been logged out.');
    if (['checkout', 'orders', 'profile', 'chat', 'admin', 'confirmation'].includes(currentPage)) go('home'); else route();
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
  async function handleCheckout(form) {
    if (!await requireCloudStore('place an order')) return;
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
    if (!supabaseClient || !cloudReady || !state.authUser) {
      toast('The store database is not ready. Your order was not placed; please try again shortly.', 'error');
      return;
    }
    const order = {
      id: 'BB-' + dateStr(0).replace(/-/g, '').slice(2) + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(),
      user: u.email, customer: u.name, createdAt: new Date().toISOString(), status: 'Pending',
      items: clone(state.cart),
      recipient: { name: data.rname, phone: data.rphone, address: data.raddress, city: data.rcity, zip: data.rzip || '' },
      delivery: { date: data.ddate, time: data.dtime, note: data.dnote || '' },
      payment: { cod: 'Cash on Delivery', gcash: 'GCash', card: 'Credit / Debit Card', bank: 'Bank Transfer' }[method],
      promo: state.promo, totals: { subtotal: t.subtotal, discount: t.discount, delivery: t.delivery, total: t.total }
    };
    const { data: savedOrder, error } = await supabaseClient.rpc('create_order', { order_data: order });
    if (error) {
      reportCloudError('place the order', error);
      return;
    }
    state.orders.unshift(Object.assign({}, savedOrder.data, { id: savedOrder.id, status: savedOrder.status }));
    state.cart = [];
    state.promo = null;
    await Promise.all([persistCloudKey('cart'), persistCloudKey('promo')]);
    await loadCloudState(state.authUser);
    updateBadges();
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

  function showBranchMap(button) {
    const query = button.dataset.mapQuery;
    const encoded = encodeURIComponent(query);
    const map = $('#branchMap');
    const directions = $('#branchDirections');
    if (!map || !directions) return;
    map.src = `https://maps.google.com/maps?q=${encoded}&output=embed`;
    map.title = `Map of sample location near ${query}`;
    directions.href = `https://www.google.com/maps/search/?api=1&query=${encoded}`;
    $$('#branchList [data-action="show-branch-map"]').forEach((item) => {
      const selected = item === button;
      item.classList.toggle('active', selected);
      item.setAttribute('aria-pressed', String(selected));
    });
  }
  function renderBranches() {
    const first = $('#branchList [data-action="show-branch-map"]');
    if (first) showBranchMap(first);
  }

  /* ---- Orders ---- */
  const statusClass = (s) => s.toLowerCase().replace(/\s+/g, '-');
  function progressHTML(status) {
    if (status === 'Cancelled') return '<p class="order-cancelled-note">This order was cancelled.</p>';
    const idx = STATUSES.indexOf(status);
    return `<div class="progress" aria-label="Order progress: ${esc(status)}">${STATUSES.map((s, i) => `<div class="${i <= idx ? 'done' : ''}">${s}</div>`).join('')}</div>`;
  }
  function canCancelOrder(o) { return o.status === 'Pending'; }
  async function cancelOrder(id) {
    const u = currentUser();
    const o = state.orders.find((order) => order.id === id && u && order.user === u.email);
    if (!o || !canCancelOrder(o)) { toast('Only pending orders can be cancelled.', 'error'); return; }
    const { data: cancelledOrder, error } = await supabaseClient.rpc('cancel_order', { target_order_id: id });
    if (error) { reportCloudError('cancel the order', error); return; }
    Object.assign(o, cancelledOrder.data, { id: cancelledOrder.id, status: cancelledOrder.status });
    await loadCloudState(state.authUser);
    renderOrders();
    updateBadges();
    toast('Order ' + o.id + ' cancelled.');
  }
  async function confirmOrderReceived(id, button) {
    const user = currentUser();
    const order = state.orders.find((item) => item.id === id && user && item.user === user.email);
    if (!user || user.role === 'admin' || !order || order.status !== 'Delivered' || order.receivedAt) {
      toast('This order is not awaiting your receipt confirmation.', 'error');
      return;
    }

    button.disabled = true;
    try {
      const { data, error } = await supabaseClient.rpc('customer_confirm_order_received', {
        target_order_id: order.id
      });
      if (error) {
        reportCloudError('confirm order receipt', error);
        button.disabled = false;
        return;
      }
      const confirmedOrder = Array.isArray(data) ? data[0] : data;
      if (!confirmedOrder) {
        toast('The order could not be confirmed. Refresh your orders and try again.', 'error');
        button.disabled = false;
        return;
      }
      order.receivedAt = confirmedOrder.data && confirmedOrder.data.receivedAt
        ? confirmedOrder.data.receivedAt
        : new Date().toISOString();
      renderOrders();
      toast('Receipt confirmed. Thank you!');
    } catch (error) {
      reportCloudError('confirm order receipt', error);
      button.disabled = false;
    }
  }
  function orderCard(o) {
    const user = currentUser();
    const canConfirmReceipt = user && user.role !== 'admin' && o.status === 'Delivered' && !o.receivedAt;
    return `<article class="order-card"><div class="order-head"><div><h3>Order ${esc(o.id)}</h3><span class="muted" style="font-size:.82rem">Placed ${prettyDate(o.createdAt)}</span></div>
      <span class="status ${statusClass(o.status)}">${esc(o.status)}</span></div>
      ${progressHTML(o.status)}
      <div class="order-items">${o.items.map((i) => `<div style="display:flex;gap:.6rem;align-items:center"><div class="thumb">${prodMedia(i, i.name)}</div><div style="font-size:.84rem"><strong>${esc(i.name)}</strong><br><span class="muted">Qty ${i.qty} · ${peso(i.price * i.qty)}</span>${i.message ? `<br><span class="muted"><em>Card message: “${esc(i.message)}”</em></span>` : ''}</div></div>`).join('')}</div>
      <div class="order-meta"><div><b>Delivery</b>${prettyDate(o.delivery.date)} · ${esc(o.delivery.time)}</div><div><b>Recipient</b>${esc(o.recipient.name)}<br>${esc(o.recipient.city)}</div><div><b>Payment</b>${esc(o.payment)}</div><div><b>Total</b><strong style="font-size:1.1rem;color:var(--burgundy)">${peso(o.totals.total)}</strong></div></div>
      ${canCancelOrder(o) || canConfirmReceipt ? `<div class="order-actions">${canCancelOrder(o) ? `<button type="button" class="btn btn-danger btn-sm" data-action="cancel-order" data-id="${esc(o.id)}">Cancel Order</button>` : ''}${canConfirmReceipt ? `<button type="button" class="btn btn-primary btn-sm" data-action="confirm-order-received" data-id="${esc(o.id)}">Order received</button>` : ''}</div>` : o.receivedAt ? '<p class="muted">Receipt confirmed. Thank you!</p>' : ''}</article>`;
  }
  function renderOrders() {
    const u = currentUser(); const root = $('#ordersRoot');
    const mine = state.orders.filter((o) => o.user === u.email).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    root.innerHTML = mine.length ? mine.map(orderCard).join('') : `<div class="empty"><h3>No orders yet</h3><p class="muted">When you place an order, it will appear here.</p><a class="btn btn-primary" href="#/shop">Start shopping</a></div>`;
  }
  function chatMessagesMarkup(conversation, viewer) {
    if (!conversation || !conversation.messages.length) return '<div class="chat-empty">Start a conversation with the Bloom &amp; Bliss team.</div>';
    return conversation.messages.map((message) => {
      const mine = message.from === viewer;
      const sender = message.from === 'owner' ? 'Bloom & Bliss' : esc(conversation.name || 'Customer');
      return `<article class="chat-message ${mine ? 'is-mine' : ''}"><span class="chat-sender">${sender}</span><p>${esc(message.text)}</p><time datetime="${esc(message.at)}">${new Date(message.at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}</time></article>`;
    }).join('');
  }
  function renderCustomerChat() {
    const root = $('#chatRoot'); const user = currentUser();
    if (!root || !user) return;
    const conversation = state.conversations.find((thread) => thread.email === user.email);
    root.innerHTML = `<section class="chat-panel">
      <header class="chat-panel-head"><div><p class="eyebrow">Customer support</p><h2>Chat with Bloom &amp; Bliss</h2><p class="muted">Send a message to the shop owner and check back here for a reply.</p></div></header>
      <div class="chat-thread" id="customerChatThread" aria-live="polite">${chatMessagesMarkup(conversation, 'customer')}</div>
      <form class="chat-compose" id="customerChatForm" novalidate><label class="sr-only" for="customerChatMessage">Your message</label><textarea id="customerChatMessage" name="message" rows="3" maxlength="1000" placeholder="Type your message…" required></textarea><span class="error" data-error-for="message" role="alert"></span><button class="btn btn-primary" type="submit">Send message</button></form>
      <p class="chat-local-note">Messages are saved to your account and shared with the shop owner.</p>
    </section>`;
  }
  async function sendChatMessage(email, from, text) {
    if (!await requireCloudStore('send a message')) return false;
    let conversation = state.conversations.find((thread) => thread.email === email);
    if (from === 'customer') {
      if (!state.authUser || state.profile.role === 'admin') {
        toast('Could not verify your customer account.', 'error');
        return false;
      }
      if (!conversation) {
        const { data, error } = await supabaseClient.from('conversations')
          .insert({ customer_id: state.authUser.id }).select('id,customer_id').single();
        if (error) { reportCloudError('start a conversation', error); return false; }
        conversation = {
          id: data.id, customerId: data.customer_id, email, name: state.profile.name, messages: []
        };
        state.conversations.push(conversation);
      }
    } else if (!conversation || !conversation.id || !state.authUser || !isAdmin()) {
      toast('Could not verify this customer conversation.', 'error');
      return false;
    }
    const { error } = await supabaseClient.rpc('record_conversation_message', {
      target_conversation: conversation.id, message_text: text
    });
    if (error) { reportCloudError('send the message', error); return false; }
    await loadCloudState(state.authUser);
    return true;
  }
  async function handleCustomerChatForm(form) {
    const user = currentUser();
    if (!user || user.role === 'admin') { toast('Sign in with a customer account to send a message.', 'error'); return; }
    const input = form.elements.message;
    const error = form.querySelector('[data-error-for="message"]');
    const text = input.value.trim();
    error.textContent = text ? '' : 'Write a message before sending.';
    input.setAttribute('aria-invalid', String(!text));
    if (!text) { input.focus(); return; }
    if (!await sendChatMessage(user.email, 'customer', text)) return;
    renderCustomerChat();
    const thread = $('#customerChatThread');
    thread.scrollTop = thread.scrollHeight;
    $('#customerChatMessage').focus();
  }
  async function handleOwnerChatForm(form) {
    const user = currentUser();
    const email = form.dataset.email;
    const input = form.elements.message;
    const error = form.querySelector('[data-error-for="message"]');
    const text = input.value.trim();
    if (!user || user.role !== 'admin' || !state.conversations.some((thread) => thread.email === email)) { toast('Could not verify this customer conversation.', 'error'); return; }
    error.textContent = text ? '' : 'Write a reply before sending.';
    input.setAttribute('aria-invalid', String(!text));
    if (!text) { input.focus(); return; }
    if (!await sendChatMessage(email, 'owner', text)) return;
    renderAdmin();
    const thread = $('.admin-chat-conversation .chat-thread');
    thread.scrollTop = thread.scrollHeight;
  }
  function renderProfile() {
    const root = $('#profileRoot');
    const user = currentUser();
    if (!root || !user) return;
    const isOwner = user.role === 'admin';
    const orderCount = state.orders.filter((order) => order.user === user.email).length;
    root.innerHTML = `<div class="profile-layout">
      <aside class="profile-summary">
        <div class="profile-avatar-wrap">
          <div class="profile-avatar" aria-hidden="true">${user.avatar ? `<img src="${esc(user.avatar)}" alt="">` : esc(user.name.charAt(0).toUpperCase())}</div>
          <input id="profilePhotoInput" class="profile-photo-input" type="file" accept="image/png,image/jpeg,image/webp" aria-label="Add or change profile picture">
          <label class="profile-photo-add" for="profilePhotoInput" aria-hidden="true">+</label>
        </div>
        <button type="button" class="link-btn profile-photo-remove" data-action="remove-profile-photo" ${user.avatar ? '' : 'hidden'}>Remove profile picture</button>
        <p class="eyebrow">${isOwner ? 'Owner account' : 'Customer account'}</p>
        <h2>${esc(user.name)}</h2>
        <p class="muted">${esc(user.email)}</p>
        <span class="profile-role">${isOwner ? 'Shop Owner' : 'Customer'}</span>
        <p>${isOwner ? 'Manage your owner account and storefront.' : `You have ${orderCount} ${orderCount === 1 ? 'order' : 'orders'} linked to your account.`}</p>
        ${isOwner ? '<a class="btn btn-primary btn-sm" href="#/admin">Open Admin Dashboard</a>' : '<a class="btn btn-ghost btn-sm" href="#/orders">View My Orders</a>'}
      </aside>
      <form class="form-card profile-form" id="profileForm" novalidate>
        <h2>${isOwner ? 'Owner Profile' : 'My Profile'}</h2>
        <p class="muted">Update the account details used to sign in.</p>
        <div class="form-alert error" id="profileError" role="alert" hidden></div>
        <div class="field"><label for="profileName">Full name</label><input id="profileName" name="name" type="text" autocomplete="name" value="${esc(user.name)}"><span class="error" data-error-for="name" role="alert"></span></div>
        <div class="field"><label for="profileEmail">Email address</label><input id="profileEmail" name="email" type="email" autocomplete="email" value="${esc(user.email)}"><span class="error" data-error-for="email" role="alert"></span></div>
        <div class="profile-password-section"><h3>Change password <span class="muted">(optional)</span></h3>
          <div class="field"><label for="profileCurrentPassword">Current password</label><input id="profileCurrentPassword" name="currentPassword" type="password" autocomplete="current-password"><span class="error" data-error-for="currentPassword" role="alert"></span></div>
          <div class="form-row">
            <div class="field"><label for="profileNewPassword">New password</label><input id="profileNewPassword" name="newPassword" type="password" autocomplete="new-password"><span class="error" data-error-for="newPassword" role="alert"></span></div>
            <div class="field"><label for="profileConfirmPassword">Confirm new password</label><input id="profileConfirmPassword" name="confirmPassword" type="password" autocomplete="new-password"><span class="error" data-error-for="confirmPassword" role="alert"></span></div>
          </div>
        </div>
        <p class="profile-storage-note">Your profile is securely saved to your Bloom &amp; Bliss account.</p>
        <button class="btn btn-primary" type="submit">Save Profile</button>
      </form>
    </div>`;
    $('#profileForm').dataset.avatar = user.avatar || '';
  }
  function resizeProfilePhoto(file) {
    return new Promise((resolve, reject) => {
      if (!file || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
        reject(new Error('Choose a PNG, JPG, or WebP image.'));
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        reject(new Error('Profile pictures must be 5 MB or smaller.'));
        return;
      }
      const source = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(source);
        const scale = Math.min(1, 256 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext('2d');
        if (!context) { reject(new Error('Your browser could not process this image.')); return; }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        try {
          resolve(canvas.toDataURL('image/jpeg', .82));
        } catch (error) {
          reject(new Error('Your browser could not prepare this image.'));
        }
      };
      image.onerror = () => {
        URL.revokeObjectURL(source);
        reject(new Error('This image could not be opened. Try another picture.'));
      };
      image.src = source;
    });
  }
  async function handleProfilePhotoInput(input) {
    const form = $('#profileForm');
    const file = input.files && input.files[0];
    if (!form || !file) return;
    const error = $('#profileError');
    error.hidden = true;
    try {
      const avatar = await resizeProfilePhoto(file);
      form.dataset.avatar = avatar;
      const summary = $('.profile-avatar');
      if (summary) summary.innerHTML = `<img src="${esc(avatar)}" alt="">`;
      renderAuthArea(avatar);
      const remove = $('.profile-photo-remove');
      if (remove) remove.hidden = false;
    } catch (reason) {
      error.hidden = false;
      error.textContent = reason.message;
      input.value = '';
    }
  }
  function removeProfilePhoto(button) {
    const form = $('#profileForm');
    if (!form) return;
    form.dataset.avatar = '';
    const user = currentUser();
    const summary = $('.profile-avatar');
    if (summary && user) summary.textContent = user.name.charAt(0).toUpperCase();
    renderAuthArea('');
    button.hidden = true;
    const input = $('#profilePhotoInput');
    if (input) input.value = '';
  }
  async function handleProfileForm(form) {
    const user = currentUser();
    if (!user) { go('login', { next: 'profile', notice: 'profile' }); return; }
    const oldEmail = user.email;
    const data = validate(form, {
      name: (value) => value.length < 2 ? 'Please enter your name.' : '',
      email: (value) => !value ? 'Please enter your email.' : !EMAIL_RE.test(value) ? 'Enter a valid email address.' : '',
      currentPassword: (value, all) => (all.newPassword || all.email.toLowerCase() !== oldEmail.toLowerCase()) && !value ? 'Enter your current password to change your email or password.' : '',
      newPassword: (value) => value && (value.length < 8 || !/[A-Za-z]/.test(value) || !/\d/.test(value)) ? 'Use at least 8 characters with both letters and numbers.' : '',
      confirmPassword: (value, all) => all.newPassword && value !== all.newPassword ? 'Passwords do not match.' : all.newPassword && !value ? 'Please confirm your new password.' : ''
    });
    if (!data) return;

    const email = data.email.toLowerCase();
    const name = data.name.trim();
    const sensitiveChange = !!data.newPassword || email !== oldEmail.toLowerCase();
    const errorBox = $('#profileError');
    errorBox.hidden = true;
    if (sensitiveChange) {
      const { error: signInError } = await supabaseClient.auth.signInWithPassword({
        email: oldEmail, password: data.currentPassword
      });
      if (signInError) {
        errorBox.hidden = false;
        errorBox.textContent = 'Your current password is incorrect.';
        return;
      }
      const authUpdate = {};
      if (data.newPassword) authUpdate.password = data.newPassword;
      if (email !== oldEmail.toLowerCase()) authUpdate.email = email;
      const { error } = await supabaseClient.auth.updateUser(authUpdate);
      if (error) {
        errorBox.hidden = false;
        errorBox.textContent = error.message || 'Your sign-in details could not be updated.';
        return;
      }
    }

    const avatar = form.dataset.avatar || '';
    const { error } = await supabaseClient.from('profiles')
      .update({ name, avatar }).eq('id', user.id);
    if (error) {
      errorBox.hidden = false;
      errorBox.textContent = error.message || 'Your profile could not be saved.';
      return;
    }
    state.profile = Object.assign({}, user, { name, avatar });
    state.users = state.users.map((profile) => profile.id === user.id ? state.profile : profile);
    renderAuthArea();
    renderProfile();
    toast(email !== oldEmail.toLowerCase()
      ? 'Profile updated. Confirm the new email address from your inbox.'
      : 'Your profile was updated.');
  }

  /* ---- Admin ---- */
  let adminTab = 'overview';
  let activeCustomerChatEmail = '';
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

  async function setAdminOrderStatus(orderId, nextStatus, control) {
    const order = state.orders.find((item) => item.id === orderId);
    if (!isAdmin() || !order || !STATUSES.includes(nextStatus) || order.status === 'Cancelled') {
      toast('This order status cannot be changed.', 'error');
      return;
    }

    control.disabled = true;
    let data;
    let error;
    try {
      ({ data, error } = await supabaseClient.rpc('admin_update_order_status', {
        target_order_id: order.id,
        next_status: nextStatus
      }));
    } catch (reason) {
      console.error('Supabase update the order status failed.', reason);
      toast(reason instanceof Error ? reason.message : 'Could not reach the store database. Please try again.', 'error');
      control.disabled = false;
      return;
    }
    const savedOrder = Array.isArray(data) ? data[0] : data;
    if (error || !savedOrder) {
      if (error) console.error('Supabase update the order status failed.', error);
      toast(error ? error.message : 'The order status could not be updated. Refresh the dashboard and try again.', 'error');
      if (control.matches('select')) control.value = order.status;
      control.disabled = false;
      return;
    }

    order.status = savedOrder.status || nextStatus;
    if (savedOrder.data) Object.assign(order, savedOrder.data, { id: order.id, status: order.status });
    toast('Order ' + order.id + ' → ' + order.status);
    renderAdmin();
  }

  function renderAdmin() {
    const root = $('#adminRoot'); if (!root) return;
    if (adminTab === 'orders' && state.ownerOrderNotifications.length) {
      state.ownerOrderNotifications = [];
      save('ownerOrderNotifications');
      renderAuthArea();
    }
    const revenue = state.orders.filter((o) => o.status !== 'Cancelled').reduce((s, o) => s + o.totals.total, 0);
    const lowCount = state.products.filter((p) => p.stock <= 5).length;
    const pending = state.orders.filter((o) => o.status === 'Pending').length;
    const owner = currentUser();
    const recentOrders = state.orders.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
    const lowStock = state.products.filter((p) => p.stock <= 5).sort((a, b) => a.stock - b.stock).slice(0, 5);
    let body = '';
    if (adminTab === 'overview') {
      body = `<div class="admin-overview-heading"><div><p class="eyebrow">Store overview</p><h2>Welcome back, ${esc(owner.name.split(/\s+/)[0])}!</h2><p class="muted">Here’s what’s happening with your shop today.</p></div><button type="button" class="btn btn-primary btn-sm" data-action="admin-add">+ Add Product</button></div>
      <div class="admin-overview">
        <section class="admin-overview-panel">
          <div class="admin-bar"><div><h2 style="margin:0">Recent orders</h2><p class="muted" style="margin:.25rem 0 0">The latest customer activity in your shop.</p></div><button type="button" class="link-btn" data-action="admin-tab" data-tab="orders">View all orders →</button></div>
          ${recentOrders.length ? `<div class="table-wrap"><table class="admin-overview-table"><thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Total</th><th>Status</th><th></th></tr></thead><tbody>
            ${recentOrders.map((o) => `<tr><td><strong>${esc(o.id)}</strong></td><td>${esc(o.customer)}</td><td>${prettyDate(o.createdAt)}</td><td>${peso(o.totals.total)}</td><td><span class="status ${o.status.toLowerCase().replace(/\s+/g, '-')}">${esc(o.status)}</span></td><td><button type="button" class="btn btn-ghost btn-sm" data-action="admin-order" data-id="${esc(o.id)}">Details</button></td></tr>`).join('')}
          </tbody></table></div>` : '<div class="empty admin-overview-empty"><h3>No orders yet</h3><p class="muted">New customer orders will appear here.</p></div>'}
        </section>
        <section class="admin-overview-panel">
          <div class="admin-bar"><div><h2 style="margin:0">Inventory to watch</h2><p class="muted" style="margin:.25rem 0 0">Products with five or fewer items in stock.</p></div><button type="button" class="link-btn" data-action="admin-tab" data-tab="products">Manage products →</button></div>
          ${lowStock.length ? `<ul class="admin-stock-list">${lowStock.map((p) => `<li><span><strong>${esc(p.name)}</strong><small>${esc(catLabel(p.category))}</small></span><span class="admin-stock-count ${p.stock === 0 ? 'is-out' : ''}">${p.stock === 0 ? 'Out of stock' : `${p.stock} left`}</span></li>`).join('')}</ul>` : '<div class="empty admin-overview-empty"><h3>Stock looks good</h3><p class="muted">No products are at the low-stock threshold.</p></div>'}
          <div class="admin-quick-actions"><button type="button" class="btn btn-primary btn-sm" data-action="admin-add">+ Add Product</button><button type="button" class="btn btn-ghost btn-sm" data-action="admin-tab" data-tab="messages">Customer inbox (${state.conversations.length + state.messages.length})</button></div>
        </section>
      </div>`;
    } else if (adminTab === 'products') {
      body = `<div class="admin-bar"><h2 style="margin:0">Products (${state.products.length})</h2><button class="btn btn-primary btn-sm" data-action="admin-add">+ Add Product</button></div>
        <div class="table-wrap"><table><thead><tr><th>ID</th><th>Product</th><th>Category</th><th>Price (₱)</th><th>Stock</th><th>Actions</th></tr></thead><tbody>
        ${state.products.map((p) => `<tr><td>${esc(p.id)}</td><td><strong>${esc(p.name)}</strong></td><td>${esc(catLabel(p.category))}</td>
          <td><input type="number" min="1" step="1" value="${p.price}" data-admin-field="price" data-id="${esc(p.id)}" aria-label="Price for ${esc(p.name)}"></td>
          <td><input type="number" min="0" step="1" value="${p.stock}" data-admin-field="stock" data-id="${esc(p.id)}" aria-label="Stock for ${esc(p.name)}"></td>
          <td><div class="row-actions"><button class="btn btn-ghost btn-sm" data-action="admin-edit" data-id="${esc(p.id)}">Edit</button><button class="btn btn-danger btn-sm" data-action="admin-delete" data-id="${esc(p.id)}">Delete</button></div></td></tr>`).join('')}
        </tbody></table></div>`;
    } else if (adminTab === 'orders') {
      const orders = state.orders.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      body = `<div class="admin-bar"><div><h2 style="margin:0">Orders (${orders.length})</h2><p class="muted" style="margin:.25rem 0 0">Update an order to Delivered when it arrives; customer confirmation is not required.</p></div></div>` + (orders.length ? `<div class="table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Placed</th><th>Delivery</th><th>Total</th><th>Status</th><th></th></tr></thead><tbody>
        ${orders.map((o) => `<tr><td><strong>${esc(o.id)}</strong></td><td>${esc(o.customer)}<br><small class="muted">${esc(o.user)}</small></td><td>${prettyDate(o.createdAt)}</td><td>${prettyDate(o.delivery.date)}<br><small class="muted">${esc(o.delivery.time)}</small></td><td>${peso(o.totals.total)}</td>
          <td><select data-admin-status="${esc(o.id)}" aria-label="Status for order ${esc(o.id)}" ${o.status === 'Cancelled' ? 'disabled' : ''}>${STATUSES.map((s) => `<option ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}</select></td>
          <td><button class="btn btn-ghost btn-sm" data-action="admin-order" data-id="${esc(o.id)}">Details</button></td></tr>`).join('')}
        </tbody></table></div>` : '<div class="empty"><h3>No orders yet</h3><p class="muted">Orders placed by customers will appear here.</p></div>');
    } else {
      const msgs = state.messages.slice().reverse();
      const conversations = state.conversations.slice().sort((a, b) => {
        const aAt = a.messages.length ? a.messages[a.messages.length - 1].at : '';
        const bAt = b.messages.length ? b.messages[b.messages.length - 1].at : '';
        return bAt.localeCompare(aAt);
      });
      if (!conversations.some((thread) => thread.email === activeCustomerChatEmail)) activeCustomerChatEmail = conversations.length ? conversations[0].email : '';
      const activeConversation = conversations.find((thread) => thread.email === activeCustomerChatEmail);
      const chatInbox = `<section class="admin-chat-section"><div class="admin-bar"><div><h2 style="margin:0">Customer chats (${conversations.length})</h2><p class="muted" style="margin:.25rem 0 0">Reply to customers here. Replies appear in their account chat.</p></div></div>
        ${conversations.length ? `<div class="admin-chat-layout"><nav class="chat-inbox-list" aria-label="Customer conversations">${conversations.map((thread) => {
          const last = thread.messages[thread.messages.length - 1];
          return `<button type="button" class="chat-inbox-item ${thread.email === activeCustomerChatEmail ? 'active' : ''}" data-action="admin-chat-select" data-email="${esc(thread.email)}" aria-pressed="${thread.email === activeCustomerChatEmail}"><strong>${esc(thread.name || thread.email)}</strong><small>${esc(thread.email)}</small><span>${esc(last ? last.text : 'No messages yet')}</span></button>`;
        }).join('')}</nav>
          <div class="admin-chat-conversation"><div class="chat-thread" aria-live="polite">${chatMessagesMarkup(activeConversation, 'owner')}</div>
            <form class="chat-compose" id="ownerChatForm" data-email="${esc(activeConversation.email)}" novalidate><label class="sr-only" for="ownerChatMessage">Reply to ${esc(activeConversation.name || activeConversation.email)}</label><textarea id="ownerChatMessage" name="message" rows="3" maxlength="1000" placeholder="Write a reply…" required></textarea><span class="error" data-error-for="message" role="alert"></span><button class="btn btn-primary" type="submit">Send reply</button></form>
          </div></div>` : '<div class="empty"><h3>No customer chats yet</h3><p class="muted">Customer conversations started from their account will appear here.</p></div>'}
        <p class="chat-local-note">Customer chats are shared between the owner and each customer account.</p></section>`;
      body = chatInbox + `<section class="admin-contact-messages"><div class="admin-bar"><h2 style="margin:0">Contact form messages (${msgs.length})</h2><p class="muted" style="margin:0">For unsigned visitor inquiries, reply by email.</p></div>` + (msgs.length ? msgs.map((m) => {
        const replyHref = `mailto:${encodeURIComponent(m.email || '')}?subject=${encodeURIComponent('Re: ' + (m.subject || ''))}`;
        return `<div class="msg-card"><h4>${esc(m.subject)}</h4><small>${esc(m.name)} · ${esc(m.email)} · ${prettyDate(m.at)}</small><p style="margin:.5rem 0 0">${esc(m.message)}</p><p style="margin:.75rem 0 0"><a class="btn btn-ghost btn-sm" href="${esc(replyHref)}">Reply by email</a></p></div>`;
      }).join('') : '<div class="empty"><h3>No contact form messages</h3></div>') + '</section>';
    }
    root.innerHTML = `<div class="stat-grid"><div class="stat"><b>${state.products.length}</b><span>Products</span></div><div class="stat"><b>${lowCount}</b><span>Low / out of stock</span></div><div class="stat"><b>${state.orders.length}</b><span>Orders (${pending} pending)</span></div><div class="stat"><b>${peso(revenue)}</b><span>Total sales</span></div></div>
      <div class="tabs" style="max-width:560px" role="tablist" aria-label="Admin dashboard sections">${['overview', 'products', 'orders', 'messages'].map((t) => `<button type="button" role="tab" class="${adminTab === t ? 'active' : ''}" aria-selected="${adminTab === t}" data-action="admin-tab" data-tab="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div>
      ${body}
      <p style="margin-top:2rem"><button class="link-btn" data-action="clear-local-cache">Clear this device's cached preferences</button></p>`;
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
  async function handleProductForm(form) {
    const data = validate(form, {
      name: (v) => v.length < 3 ? 'Name must be at least 3 characters.' : '',
      price: (v) => !(+v > 0) ? 'Enter a price greater than 0.' : '',
      stock: (v) => v === '' || !(Number.isInteger(+v) && +v >= 0) ? 'Enter a whole number (0 or more).' : '',
      desc: (v) => v.length < 10 ? 'Description must be at least 10 characters.' : ''
    });
    if (!data) return;
    if (!await requireCloudStore('save products')) return;
    const occasions = $$('input[name="occasions"]:checked', form).map((el) => el.value);
    const best = !!$('input[name="best"]', form).checked;
    let previousProduct = null;
    let productId = data.id;
    if (data.id) {
      const p = getProduct(data.id); if (!p) return;
      previousProduct = clone(p);
      Object.assign(p, { name: data.name, category: data.category, price: Math.round(+data.price), stock: +data.stock, desc: data.desc, occasions, best, image: data.image || '' });
      if (data.preset) p.art = clone(ART_PRESETS[data.preset]);
    } else {
      const nums = state.products.map((p) => parseInt(String(p.id).replace(/\D/g, ''), 10) || 0);
      const id = 'BB-' + String(Math.max(0, ...nums) + 1).padStart(3, '0');
      productId = id;
      state.products.push({ id, name: data.name, category: data.category, price: Math.round(+data.price), stock: +data.stock, rating: 4.5, reviews: 0, best, occasions, desc: data.desc, image: data.image || '', art: clone(ART_PRESETS[data.preset] || ART_PRESETS['mixed-pastel']) });
    }
    const [saved] = await save('products');
    if (!saved) {
      if (previousProduct) Object.assign(getProduct(productId), previousProduct);
      else state.products = state.products.filter((product) => product.id !== productId);
      renderAdmin();
      return;
    }
    closeModal();
    renderAdmin();
    toast(data.id ? 'Product updated' : 'Product added');
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

  function reviewFormHTML(p, existing) {
    const user = currentUser();
    if (!user) return '<p class="muted">Please <a href="#/login" data-action="close-modal">sign in</a> to leave feedback.</p>';
    if (user.role === 'admin') return '<p class="muted">Sign in with a customer account to leave product feedback.</p>';
    return `<form id="reviewForm" data-product-id="${esc(p.id)}" novalidate>
      <h3>${existing ? 'Update your feedback' : 'Share your feedback'}</h3>
      <div class="field"><label for="reviewRating">Your rating</label><select id="reviewRating" name="rating"><option value="">Choose a rating…</option>${[5, 4, 3, 2, 1].map((rating) => `<option value="${rating}" ${existing && existing.rating === rating ? 'selected' : ''}>${rating} out of 5 stars</option>`).join('')}</select><span class="error" data-error-for="rating" role="alert"></span></div>
      <div class="field"><label for="reviewText">Your feedback</label><textarea id="reviewText" name="review" maxlength="500" placeholder="What did you think of this product?">${esc(existing ? existing.text : '')}</textarea><span class="error" data-error-for="review" role="alert"></span></div>
      <button class="btn btn-primary btn-sm" type="submit">${existing ? 'Update feedback' : 'Submit feedback'}</button>
    </form>`;
  }
  async function handleReviewForm(form) {
    const user = currentUser();
    if (!user || user.role === 'admin') { toast('Sign in with a customer account to leave feedback.', 'error'); return; }
    const p = getProduct(form.dataset.productId);
    if (!p) { toast('This product is no longer available.', 'error'); return; }
    const data = validate(form, {
      rating: (value) => !/^[1-5]$/.test(value) ? 'Choose a rating from 1 to 5 stars.' : '',
      review: (value) => value.length < 10 ? 'Please write at least 10 characters.' : ''
    });
    if (!data) return;
    if (!await requireCloudStore('save feedback')) return;
    const current = state.reviews.slice();
    const index = current.findIndex((review) => review.productId === p.id && review.userId === user.id);
    const review = {
      productId: p.id,
      userId: user.id,
      user: user.email,
      customer: user.name.trim().split(/\s+/)[0],
      rating: Number(data.rating),
      text: data.review,
      createdAt: new Date().toISOString()
    };
    const { data: savedReview, error } = await supabaseClient.from('reviews').upsert({
      product_id: p.id,
      user_id: user.id,
      customer_name: review.customer,
      rating: review.rating,
      text: review.text
    }, { onConflict: 'product_id,user_id' }).select('id,product_id,user_id,customer_name,rating,text,created_at').single();
    if (error) { reportCloudError('save your feedback', error); return; }
    const mappedReview = {
      id: savedReview.id, productId: savedReview.product_id, userId: savedReview.user_id,
      user: user.email, customer: savedReview.customer_name, rating: savedReview.rating,
      text: savedReview.text, createdAt: savedReview.created_at
    };
    if (index >= 0) current[index] = mappedReview;
    else current.push(mappedReview);
    state.reviews = current;
    toast(index >= 0 ? 'Your feedback was updated.' : 'Thank you for your feedback!');
    if (currentPage === 'home') renderHome();
    else if (currentPage === 'shop') renderShop();
    else if (currentPage === 'addons') renderAddons();
    quickView(p.id);
  }

  /* ---- Contact ---- */
  async function handleContact(form) {
    const data = validate(form, {
      name: (v) => v.length < 2 ? 'Please enter your name.' : '',
      email: (v) => !v ? 'Please enter your email.' : !EMAIL_RE.test(v) ? 'Enter a valid email address.' : '',
      subject: (v) => !v ? 'Please choose a topic.' : '',
      message: (v) => v.length < 10 ? 'Please write at least 10 characters.' : ''
    });
    if (!data) return;
    if (!await requireCloudStore('send your message')) return;
    const { error } = await supabaseClient.from('contact_messages').insert({
      name: data.name, email: data.email.toLowerCase(), subject: data.subject, message: data.message
    });
    if (error) { reportCloudError('send your message', error); return; }
    if (isAdmin()) {
      state.messages.unshift({ name: data.name, email: data.email, subject: data.subject, message: data.message, at: new Date().toISOString() });
    }
    form.reset(); $('#contactSuccess').hidden = false; toast('Message sent. Thank you!');
  }

  /* ---- Quick view ---- */
  function quickView(pid) {
    const p = getProduct(pid); if (!p) return;
    const out = p.stock <= 0; const wished = state.wish.includes(p.id);
    const rating = productRating(p);
    const reviews = reviewsFor(p.id);
    const user = currentUser();
    const existing = user && user.role !== 'admin' ? reviews.find((review) => review.userId === user.id) : null;
    openModal(`<div class="quick"><div class="art">${prodMedia(p, p.name)}</div><div>
      <p class="eyebrow">${esc(catLabel(p.category))}</p><h2>${esc(p.name)}</h2>
      ${rating.count ? `<div class="rating">${stars(rating.average)} <span>${rating.average.toFixed(1)} (${rating.count} ratings)</span></div>` : '<p class="muted">No ratings yet</p>'}
      <p style="margin-top:.8rem">${esc(p.desc)}</p>
      ${(p.occasions || []).length ? `<p class="muted" style="font-size:.85rem">Great for: ${p.occasions.map((o) => esc(occLabel(o))).join(', ')}</p>` : ''}
      ${p.message ? `<label class="sr-only" for="qv-msg">Your message for the card</label><textarea id="qv-msg" class="addon-msg" maxlength="300" placeholder="Write your own message for the card (optional)"></textarea>` : ''}
      <p class="price" style="font-size:1.8rem">${peso(p.price)}</p>
      <p class="stock ${out ? 'none' : p.stock <= 5 ? 'low' : ''}">${out ? 'Currently unavailable' : p.stock <= 5 ? 'Only ' + p.stock + ' left' : 'In stock'}</p>
      <div class="row-actions"><button class="btn btn-primary" data-action="add" data-id="${esc(p.id)}" ${out ? 'disabled' : ''}>${out ? 'Sold out' : 'Add to Cart'}</button>
      <button class="btn btn-ghost" data-action="wish" data-id="${esc(p.id)}" aria-pressed="${wished}">${wished ? '♥ In wishlist' : '♡ Add to wishlist'}</button></div></div></div>
      <section class="product-reviews" aria-labelledby="productReviewsTitle"><h3 id="productReviewsTitle">Customer feedback (${reviews.length})</h3>
        <p class="review-demo-note">Feedback is shared with the Bloom &amp; Bliss community.</p>
        ${reviews.length ? `<div class="review-list">${reviews.map((review) => `<article class="review-entry"><div class="review-entry-head"><strong>${esc(review.customer)}</strong><span class="muted">${prettyDate(review.createdAt)}</span></div><div class="rating">${stars(review.rating)} <span>${review.rating} out of 5</span></div><p>${esc(review.text)}</p></article>`).join('')}</div>` : '<p class="muted">No written feedback yet. Be the first to share your thoughts.</p>'}
        ${reviewFormHTML(p, existing)}
      </section>`);
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

  document.addEventListener('click', async (e) => {
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
      case 'toggle-theme': {
        const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        applyTheme(theme);
        if (!store.set('theme', theme)) toast('Theme changed for this visit, but could not be saved.', 'error');
        break;
      }
      case 'toggle-password': {
        const input = document.getElementById(el.dataset.target);
        if (!input || !['password', 'text'].includes(input.type)) break;
        const showPassword = input.type === 'password';
        input.type = showPassword ? 'text' : 'password';
        el.setAttribute('aria-pressed', String(showPassword));
        el.setAttribute('aria-label', showPassword ? 'Hide password' : 'Show password');
        break;
      }
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
      case 'save-message': saveCartMessage(key, el); break;
      case 'remove-promo': state.promo = null; save('promo'); renderCart(); toast('Promo code removed'); break;
      case 'show-branch-map': showBranchMap(el); break;
      case 'filter-cat': shopFilters.cat = el.dataset.cat; renderShop(true); break;
      case 'reset-filters': shopFilters.q = ''; shopFilters.cat = 'all'; shopFilters.occ = 'all'; shopFilters.sort = 'featured'; applyShopParams(); renderShop(); break;
      case 'close-modal': closeModal(); break;
      case 'confirm-ok': { const r = modalResolve; modalResolve = null; closeModal(); if (r) r(true); break; }
      case 'toggle-user': { const dd = $('#userDropdown'); const open = dd.hidden; dd.hidden = !open; el.setAttribute('aria-expanded', String(open)); break; }
      case 'logout': closeMenus(); logout(); break;
      case 'auth-tab':
        if (el.getAttribute('aria-selected') !== 'true') startTabTransition();
        setAuthTab(el.dataset.tab);
        break;
      case 'admin-tab':
        if (el.getAttribute('aria-selected') !== 'true') startTabTransition();
        adminTab = el.dataset.tab; renderAdmin();
        break;
      case 'admin-chat-select': activeCustomerChatEmail = el.dataset.email; renderAdmin(); break;
      case 'admin-add': productFormModal(null); break;
      case 'admin-edit': productFormModal(getProduct(id)); break;
      case 'admin-delete': {
        const p = getProduct(id); if (!p) break;
        confirmBox('Delete product?', '“' + p.name + '” will be permanently removed from the shop.', 'Delete').then(async (ok) => {
          if (!ok) return;
          try {
            const { error } = await supabaseClient.from('products').delete().eq('id', id);
            if (error) { reportCloudError('delete the product', error); return; }
            state.products = state.products.filter((product) => product.id !== id);
            state.wish = state.wish.filter((productId) => productId !== id);
            const [, preferenceSaved] = await save('products', 'wish');
            if (!preferenceSaved) return;
            syncCart(); updateBadges(); renderAdmin(); toast('Product deleted');
          } catch (error) {
            reportCloudError('delete the product', error);
          }
        });
        break;
      }
      case 'admin-order': { const o = state.orders.find((x) => x.id === id); if (o) orderDetailModal(o); break; }
      case 'confirm-order-received': await confirmOrderReceived(id, el); break;
      case 'cancel-order': {
        const u = currentUser();
        const o = state.orders.find((order) => order.id === id && u && order.user === u.email);
        if (!o || !canCancelOrder(o)) { toast('Only pending orders can be cancelled.', 'error'); break; }
        confirmBox('Cancel this order?', 'Your pending order will be cancelled and its reserved stock returned.', 'Cancel Order').then((ok) => {
          if (ok) cancelOrder(id);
        });
        break;
      }
      case 'remove-profile-photo': removeProfilePhoto(el); break;
      case 'clear-local-cache':
        confirmBox('Clear local cache?', 'This clears cached cart, wishlist, and visitor data on this device only. Supabase accounts, products, orders, and reviews are not deleted.', 'Clear Cache').then((ok) => {
          if (!ok) return; store.clearAll(); location.hash = '#/home'; location.reload();
        });
        break;
      default: break;
    }
  });

  document.addEventListener('submit', async (e) => {
    const f = e.target; e.preventDefault();
    const handlers = {
      loginForm: handleLogin, registerForm: handleRegister, checkoutForm: handleCheckout,
      contactForm: handleContact, productForm: handleProductForm, reviewForm: handleReviewForm,
      profileForm: handleProfileForm, customerChatForm: handleCustomerChatForm,
      ownerChatForm: handleOwnerChatForm
    };
    const handler = handlers[f.getAttribute('id')];
    if (handler) {
      try { await handler(f); }
      catch (error) { reportCloudError('complete this request', error); }
    } else if (f.getAttribute('id') === 'promoForm') {
      applyPromo(new FormData(f).get('code'));
    }
  });

  document.addEventListener('change', async (e) => {
    const t = e.target;
    if (t.name === 'payment' && t.closest('#checkoutForm')) showPayDetail(t.value);
    if (t.dataset && t.dataset.adminField) {
      const p = getProduct(t.dataset.id); const field = t.dataset.adminField; const v = Number(t.value);
      if (!p) return;
      const valid = field === 'price' ? v > 0 : Number.isInteger(v) && v >= 0;
      if (!valid) { t.value = p[field]; toast(field === 'price' ? 'Price must be greater than 0.' : 'Stock must be a whole number, 0 or more.', 'error'); return; }
      const previous = p[field];
      p[field] = Math.round(v);
      const [saved] = await save('products');
      if (!saved) {
        p[field] = previous;
        t.value = String(previous);
        return;
      }
      syncCart(); updateBadges();
      toast((field === 'price' ? 'Price' : 'Stock') + ' updated for ' + p.name);
    }
    if (t.dataset && t.dataset.adminStatus) {
      await setAdminOrderStatus(t.dataset.adminStatus, t.value, t);
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
  $('#musicToggle').addEventListener('click', () => {
    if (musicPlaying) stopBackgroundMusic();
    else startBackgroundMusic();
  });
  backgroundMusic.addEventListener('play', () => {
    musicUnavailable = false;
    musicPlaying = true;
    updateMusicControl();
  });
  backgroundMusic.addEventListener('pause', () => {
    musicPlaying = false;
    updateMusicControl();
  });
  backgroundMusic.addEventListener('error', () => {
    musicPlaying = false;
    musicUnavailable = true;
    updateMusicControl();
    console.error('The background music file could not be loaded.', backgroundMusic.error);
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
  function init() {
    applyTheme(store.get('theme', 'light'));
    $('#year').textContent = new Date().getFullYear();
    initPetals();
    checkImages();
    syncCart();
    startBackgroundMusic();
    startVisitorPresence();
    cloudInitialization = initializeSupabase().catch((error) => {
      cloudInitializationError = error;
      reportCloudError('connect to the store database', error);
    });
    if (!location.hash) location.hash = '#/home'; else route();
    if (!location.hash || location.hash === '#/home') route();
    
    window.addEventListener('load', scheduleInitialLoaderHide, { once: true });
    scheduleInitialLoaderHide();
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
