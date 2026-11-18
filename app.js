/**
 * ============================================================
 *  AgendaKu — app.js   (the app itself)
 *  Sections:
 *    1. Setup & helpers          5. Screens: connect + PIN
 *    2. Storage & state          6. Views: home, agenda, notes, insights
 *    3. Talking to Google Sheets 7. Sheets: forms, detail, settings
 *    4. Sync queue (works offline) 8. Actions & start-up
 * ============================================================
 */
(function () {
  'use strict';

  /* ============ 1. SETUP & HELPERS ============ */

  const VERSION = '1.3.0';
  const CREDIT = 'Created by CreanovativeCo';   // brand line shown on the start screens, Home and Settings
  const CATS = ['Work', 'Family', 'School', 'Personal', 'Other'];
  const STATUSES = ['Scheduled', 'Done', 'Postponed', 'Cancelled', 'Other'];
  const CAT_COLOR = { Work: '#4F5BF0', Family: '#E0762F', School: '#0F9D8D', Personal: '#B548C8', Other: '#7B869C' };
  const ST_COLOR = { Scheduled: '#4F5BF0', Done: '#2E9E63', Postponed: '#C98A1B', Cancelled: '#CF5F78', Other: '#8A90A6' };

  const $ = (sel, el) => (el || document).querySelector(sel);
  const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => (n < 10 ? '0' : '') + n;
  const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const todayStr = () => ymd(new Date());
  const toDate = (s) => { const p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); };
  const addDays = (s, n) => { const d = toDate(s); d.setDate(d.getDate() + n); return ymd(d); };
  const weekStart = (s) => { const d = toDate(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d); };
  const uid = (p) => p + Date.now().toString(36) + Math.floor(Math.random() * 1679616).toString(36);
  const nowStamp = () => { const d = new Date(); return ymd(d) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };

  function t(key, vars) {
    const dict = window.AK_TEXT[S.lang] || window.AK_TEXT.en;
    let s = dict[key] != null ? dict[key] : (window.AK_TEXT.en[key] != null ? window.AK_TEXT.en[key] : key);
    if (vars && vars.n !== undefined) vars.s = Number(vars.n) === 1 ? '' : 's';
    if (vars) Object.keys(vars).forEach((k) => { s = s.split('{' + k + '}').join(vars[k]); });
    return s;
  }
  const locale = () => (S.lang === 'id' ? 'id-ID' : 'en-GB');
  function fmtDate(s, opt) {
    if (!s) return '';
    try { return new Intl.DateTimeFormat(locale(), opt || { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(toDate(s)); }
    catch (e) { return s; }
  }
  function relDay(s) {
    const td = todayStr();
    if (s === td) return t('today');
    if (s === addDays(td, 1)) return t('tomorrow');
    if (s === addDays(td, -1)) return t('yesterday');
    return '';
  }
  const fmtTime = (it) => (it.start ? it.start + (it.end ? ' – ' + it.end : '') : t('allDay'));
  const byWhen = (a, b) => (a.date + (a.start || '00:00')).localeCompare(b.date + (b.start || '00:00'));
  const bringList = (it) => String(it.bring || '').split(/\s*;\s*/).filter(Boolean);

  function safeUrl(u) {
    u = String(u || '').trim();
    if (!u) return '';
    if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u;
    try { const x = new URL(u); return /^https?:$/.test(x.protocol) && x.hostname.indexOf('.') > 0 ? x.href : ''; }
    catch (e) { return ''; }
  }
  function linkify(text) {
    return esc(text).replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]])/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  }

  // Icons (simple line icons, 24x24)
  const ICON = {
    home: '<path d="M4 11l8-7 8 7"/><path d="M6 10v9h12v-9"/>',
    list: '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10h16"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    note: '<path d="M6 4h9l4 4v12H6z"/><path d="M14 4v5h5M9 13h6M9 16h4"/>',
    chart: '<path d="M5 20V10M12 20V4M19 20v-7"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
    search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
    link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
    bag: '<path d="M6 8h12l1 12H5z"/><path d="M9 8V6a3 3 0 016 0v2"/>',
    clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
    pin: '<path d="M12 21s6-5.6 6-10.5A6 6 0 006 10.5C6 15.4 12 21 12 21z"/><circle cx="12" cy="10.5" r="2"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    left: '<path d="M14.5 6l-6 6 6 6"/>',
    right: '<path d="M9.5 6l6 6-6 6"/>',
    edit: '<path d="M5 19h3.5L19 8.5 15.5 5 5 15.5z"/><path d="M13.5 7l3.5 3.5"/>',
    trash: '<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/>',
    cloud: '<path d="M7 18a4 4 0 01-.5-8 5.5 5.5 0 0110.7 1.2A3.5 3.5 0 0117 18z"/>',
    refresh: '<path d="M19 12a7 7 0 11-2.1-5"/><path d="M19 5v4h-4"/>',
    flag: '<path d="M6 21V4M6 5h11l-2 4 2 4H6"/>',
    paste: '<rect x="6" y="5" width="12" height="15" rx="2"/><path d="M9 5V4h6v1M9 11h6M9 14h4"/>',
    copy: '<rect x="9" y="9" width="10" height="11" rx="2"/><path d="M6 15V6a2 2 0 012-2h7"/>',
    lock: '<rect x="6" y="11" width="12" height="9" rx="2"/><path d="M9 11V8a3 3 0 016 0v3"/>',
    back: '<path d="M9 6H20v12H9l-5-6z"/><path d="M12 10l4 4M16 10l-4 4"/>',
    star: '<path d="M12 4l2.4 5 5.6.8-4 3.9.9 5.5L12 16.7 7.1 19.200l.9-5.5-4-3.9 5.600-.8z"/>',
    out: '<path d="M14 5h5v5M19 5l-8 8"/><path d="M18 14v5H5V6h5"/>',
    cal: '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10h16M9 15l2 2 4-4"/>',
    filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
    logout: '<path d="M10 5H6v14h4M14 8l4 4-4 4M18 12H10"/>',
    phone: '<rect x="7" y="3" width="10" height="18" rx="2.500"/><path d="M11 18h2"/>',
    sheet: '<rect x="5" y="4" width="14" height="16" rx="2"/><path d="M5 10h14M5 15h14M11 10v10"/>',
    spark: '<path d="M12 4v4M12 16v4M4 12h4M16 12h4"/>',
    user: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/>',
    up: '<path d="M12 16V5M7.5 9.5L12 5l4.5 4.5M5 19h14"/>',
    share: '<circle cx="17.5" cy="6" r="2.5"/><circle cx="6.5" cy="12" r="2.5"/><circle cx="17.5" cy="18" r="2.5"/><path d="M8.7 10.8l6.6-3.6M8.7 13.2l6.6 3.6"/>',
    wa: '<path d="M4.5 19.5l1.1-3.9A8 8 0 1112 20a8 8 0 01-3.9-1z"/><path d="M9.2 8.6c.2-.4.6-.4.8 0l.6 1.4c.1.3 0 .5-.2.7l-.4.4a5.5 5.5 0 002.7 2.700l.4-.4c.2-.2.4-.3.7-.2l1.400.6c.4.2.4.6 0 .8-.6.6-1.500.8-2.300.5a7.5 7.5 0 01-4-4c-.3-.8-.1-1.700.5-2.300z"/>'
  };
  const icon = (n, cls) => `<svg class="ic ${cls || ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n] || ''}</svg>`;

  // Profile picture: the chosen photo, or the initials on a soft colour
  const AV_COLORS = [['#DCE0FF', '#3F49D6'], ['#E1F4E8', '#23824F'], ['#FFEDE3', '#C9542B'], ['#EEEAFE', '#6A4FD8'], ['#E3F1FF', '#2B6FD6'], ['#FBE4EE', '#B8437A']];
  function initials() {
    const parts = (S.settings.name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '';
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }
  function avatar(size) {
    const p = S.profile || {};
    const box = `width:${size}px;height:${size}px;`;
    if (p.photo && /^data:image\//.test(p.photo)) return `<span class="av" style="${box}"><img src="${esc(p.photo)}" alt=""></span>`;
    const c = AV_COLORS[(Number(p.color) || 0) % AV_COLORS.length], ini = initials();
    return `<span class="av" style="${box}background:${c[0]};color:${c[1]};font-size:${Math.round(size * 0.38)}px">${ini ? esc(ini) : icon('user')}</span>`;
  }

  /* ============ 2. STORAGE & STATE ============ */

  const mem = {};
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? (k in mem ? mem[k] : d) : JSON.parse(v); } catch (e) { return k in mem ? mem[k] : d; } },
    set(k, v) { mem[k] = v; try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
    del(k) { delete mem[k]; try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };

  const S = {
    lang: store.get('ak_lang', (navigator.language || 'en').toLowerCase().indexOf('id') === 0 ? 'id' : 'en'),
    api: store.get('ak_api', ''),
    token: store.get('ak_token', ''),
    demo: store.get('ak_demo', false),
    pinHash: store.get('ak_pinhash', ''),
    lockOnOpen: store.get('ak_lock', true),
    local: store.get('ak_local', false),          // true = data stays on this phone, no Google Sheet
    recHash: store.get('ak_rechash', ''),
    lastBackup: store.get('ak_backup', 0),
    profile: store.get('ak_profile', { photo: '', bio: '', color: 0 }),   // stored on this phone only
    agenda: store.get('ak_agenda', []),
    notes: store.get('ak_notes', []),
    settings: store.get('ak_settings', { name: '', calendarSync: true, reminderMinutes: 30 }),
    sheetUrl: store.get('ak_sheet', ''),
    outbox: store.get('ak_outbox', []),
    packed: store.get('ak_packed', {}),
    loaded: store.get('ak_loaded', false),
    view: 'home',
    calMonth: todayStr().slice(0, 7),
    selDate: '',
    chartRange: 7,
    chartSel: -1,
    filter: { q: '', cat: 'all', status: 'all', scope: 'upcoming', from: '', to: '', open: false },
    noteFilter: { q: '', topic: 'all' },
    insPeriod: 'month',
    syncing: false,
    offline: false
  };

  function persist() {
    store.set('ak_agenda', S.agenda); store.set('ak_notes', S.notes); store.set('ak_settings', S.settings);
    store.set('ak_outbox', S.outbox); store.set('ak_sheet', S.sheetUrl); store.set('ak_loaded', S.loaded);
  }

  /* ============ 3. TALKING TO GOOGLE SHEETS ============ */

  function apiError(code, msg, data) { const e = new Error(msg || code); e.code = code; e.data = data || {}; return e; }

  async function api(action, data) {
    if (S.demo || S.local) return demoApi(action, data || {});
    let res;
    try {
      res = await fetch(S.api, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },   // keeps the request "simple" (no CORS preflight)
        body: JSON.stringify(Object.assign({ action: action, token: S.token }, data || {})),
        redirect: 'follow'
      });
    } catch (e) { throw apiError('NETWORK'); }
    let json;
    try { json = await res.json(); } catch (e) { throw apiError('BAD_RESPONSE', 'Unexpected answer from the Sheet.'); }
    if (!json.ok) throw apiError(json.error || 'SERVER', json.message, json);
    return json;
  }

  // ----- Demo mode and "this phone only" mode: same actions, but stored on this phone -----
  function demoSeed() {
    const d = (n) => addDays(todayStr(), n);
    const mk = (o) => Object.assign({ id: uid('A'), start: '', end: '', location: '', link: '', bring: '', status: 'Scheduled', notes: '', followUp: false, followNote: '', followDone: false, source: '', eventId: 'demo', created: nowStamp(), updated: nowStamp() }, o);
    return {
      settings: { name: '', calendarSync: true, reminderMinutes: 30 },
      agenda: [
        mk({ date: d(0), start: '09:00', end: '10:30', category: 'Work', title: 'Weekly coordination meeting', location: 'Meeting room, 4th floor', bring: 'Laptop; Budget report', followUp: true, followNote: 'Send the minutes to the team' }),
        mk({ date: d(0), start: '13:00', end: '14:00', category: 'Work', title: 'Webinar: Risk management update', location: 'Zoom', link: 'https://zoom.us/j/1234567890' }),
        mk({ date: d(0), category: 'School', title: 'Bring device for literacy club', location: 'Classroom 6A', bring: 'Laptop; Mouse; Charger' }),
        mk({ date: d(1), start: '15:00', end: '16:00', category: 'Work', title: 'Venue schedule discussion', location: 'Zoom Meeting', link: 'https://zoom.us/j/97497831599', notes: 'Meeting ID: 974 9783 1599' }),
        mk({ date: d(2), start: '19:00', category: 'Family', title: 'Family dinner', location: 'Home' }),
        mk({ date: d(3), start: '08:00', end: '09:00', category: 'School', title: 'Parent–teacher meeting', location: 'School hall', bring: 'Report card' }),
        mk({ date: d(5), start: '10:00', end: '12:00', category: 'Personal', title: 'Car service', location: 'Workshop' }),
        mk({ date: d(8), start: '09:00', end: '16:00', category: 'Work', title: 'Seminar: People analytics', location: 'Hotel ballroom', bring: 'ID card; Notebook' }),
        mk({ date: d(-1), start: '10:00', end: '11:00', category: 'Work', title: 'Budget review', status: 'Done', notes: 'Agreed to revise Q4 allocation. Draft due Friday.', followUp: true, followNote: 'Prepare the revised draft' }),
        mk({ date: d(-2), start: '14:00', end: '15:00', category: 'Work', title: 'Vendor presentation', status: 'Done' }),
        mk({ date: d(-3), start: '16:00', category: 'Family', title: 'Pick up from swimming class', status: 'Done' }),
        mk({ date: d(-4), start: '09:00', category: 'Work', title: 'Team briefing', status: 'Scheduled' }),
        mk({ date: d(-5), start: '13:00', category: 'Other', title: 'Community gathering', status: 'Cancelled' }),
        mk({ date: d(-6), start: '10:00', category: 'Personal', title: 'Renew documents', status: 'Postponed' }),
        mk({ date: d(-9), start: '09:00', category: 'School', title: 'School exhibition', status: 'Done', notes: 'Photos shared in the class group.' }),
        mk({ date: d(-12), start: '11:00', category: 'Work', title: 'Quarterly planning', status: 'Done', notes: 'Three priorities set.' })
      ],
      notes: [
        { id: uid('N'), date: d(-2), topic: 'Clothing size', title: 'School uniform', content: 'Shirt size M, trousers 28', pinned: true, created: nowStamp(), updated: nowStamp() },
        { id: uid('N'), date: d(-1), topic: 'Vitamins', title: 'Daily vitamins', content: 'Vitamin C after breakfast\nVitamin D on weekends', pinned: false, created: nowStamp(), updated: nowStamp() },
        { id: uid('N'), date: d(-6), topic: 'Shopping', title: 'Stationery list', content: 'A4 paper, markers, folders', pinned: false, created: nowStamp(), updated: nowStamp() }
      ]
    };
  }
  async function demoApi(action, data) {
    if (S.demo) await new Promise((r) => setTimeout(r, 350));
    const key = S.demo ? 'ak_demo_db' : 'ak_local_db';
    const db = store.get(key, null) || (S.demo ? demoSeed() : { settings: { name: '', calendarSync: false, reminderMinutes: 0 }, agenda: [], notes: [] });
    const put = () => store.set(key, db);
    const upsert = (arr, item) => { const i = arr.findIndex((x) => x.id === item.id); if (i >= 0) arr[i] = item; else arr.push(item); };
    if (action === 'sync') { put(); return { agenda: db.agenda, notes: db.notes, settings: db.settings, sheetUrl: '' }; }
    if (action === 'saveAgenda') { const it = Object.assign({}, data.item, { eventId: S.demo && data.item.status !== 'Cancelled' ? 'demo' : '' }); upsert(db.agenda, it); put(); return { item: it }; }
    if (action === 'deleteAgenda') { db.agenda = db.agenda.filter((x) => x.id !== data.id); put(); return {}; }
    if (action === 'saveNote') { upsert(db.notes, data.item); put(); return { item: data.item }; }
    if (action === 'deleteNote') { db.notes = db.notes.filter((x) => x.id !== data.id); put(); return {}; }
    if (action === 'saveSettings') { Object.assign(db.settings, data.settings); put(); return { settings: db.settings }; }
    return {};
  }

  /* ============ 4. SYNC QUEUE ============ */

  let flushing = false;
  function enqueue(action, payload, kind) {
    S.outbox.push({ action: action, payload: payload, kind: kind });
    persist();
    flush();
  }

  async function flush() {
    if (flushing) return;
    flushing = true; S.syncing = true; syncUI();
    let needPull = false;
    while (S.outbox.length) {
      const op = S.outbox[0];
      try {
        const r = await api(op.action, op.payload);
        S.outbox.shift(); S.offline = false;
        applyResult(op, r);
        persist();
      } catch (e) {
        if (e.code === 'NETWORK' || e.code === 'BAD_RESPONSE') {
          S.offline = true;
          if (!op.told) { op.told = true; persist(); toast(t('savedOffline'), 'info'); }
          break;
        }
        if (e.code === 'AUTH') { requireLogin(); break; }
        S.outbox.shift(); persist(); needPull = true;
        toast(e.code === 'NO_SETUP' ? t('noSetup') : t('saveFailed', { msg: e.message }), 'error');
      }
    }
    flushing = false; S.syncing = false; syncUI();
    if (bulkDone && !S.outbox.length) { toast(t('importedN', { n: bulkDone }), 'success'); bulkDone = 0; renderView(); }
    if (needPull) pull(true);
  }

  let bulkDone = 0;
  function applyResult(op, r) {
    if (op.action === 'saveAgenda' && r.item) {
      const i = S.agenda.findIndex((x) => x.id === r.item.id);
      if (i >= 0) S.agenda[i] = r.item;
      if (op.kind === 'bulk') { bulkDone++; return; }
      if (r.item.calendarError) toast(t('calFailed'), 'info');
      else toast(S.demo ? t('savedDemo') : S.local ? t('savedLocal') : (S.settings.calendarSync && r.item.eventId ? t('savedCal') : t('saved')), 'success');
    } else if (op.action === 'saveNote') {
      toast(S.demo ? t('savedDemo') : S.local ? t('savedLocal') : t('saved'), 'success');
    } else if (op.kind === 'delete') {
      toast(t('deleted'), 'success');
    } else if (op.action === 'saveSettings') {
      if (r.settings) S.settings = r.settings;
      toast(t('settingsSaved'), 'success');
    }
  }

  let pulling = false;
  async function pull(silent) {
    if (pulling || flushing || S.outbox.length) return;
    pulling = true; S.syncing = true; syncUI();
    try {
      const r = await api('sync');
      S.agenda = r.agenda || []; S.notes = r.notes || [];
      S.settings = r.settings || S.settings; S.sheetUrl = r.sheetUrl || S.sheetUrl;
      S.loaded = true; S.offline = false;
      persist(); renderView();
    } catch (e) {
      if (e.code === 'AUTH') requireLogin();
      else if (e.code === 'NETWORK' || e.code === 'BAD_RESPONSE') { S.offline = true; if (!silent) toast(t('syncFailed'), 'info'); }
      else toast(e.code === 'NO_SETUP' ? t('noSetup') : t('saveFailed', { msg: e.message }), 'error');
    }
    pulling = false; S.syncing = false; syncUI();
  }

  function syncUI() {
    const el = $('#sync');
    if (!el) return;
    let cls = 'ok', label = S.local ? t('localBadge') : t('synced');
    if (S.syncing) { cls = 'busy'; label = t('syncing'); }
    else if (S.outbox.length) { cls = 'wait'; label = t('pending', { n: S.outbox.length }); }
    else if (S.offline) { cls = 'wait'; label = t('offline'); }
    el.className = 'sync ' + cls;
    el.setAttribute('aria-label', label);
    el.title = label;
    el.innerHTML = (cls === 'busy' ? '<span class="spin"></span>' : icon(cls === 'ok' ? (S.local ? 'phone' : 'check') : 'cloud')) +
      (cls !== 'ok' ? `<span>${esc(label)}</span>` : '');
  }

  /* ============ 5. SCREENS: CONNECT + PIN ============ */

  const gate = $('#gate'), appEl = $('#app');
  let pin = { mode: '', step: '', buf: '', first: '', old: '', code: '', msg: '', busy: false, email: '' };

  const langToggle = () => `<div class="seg small" role="group" aria-label="Language">
      <button data-act="lang" data-lang="en" class="${S.lang === 'en' ? 'on' : ''}">EN</button>
      <button data-act="lang" data-lang="id" class="${S.lang === 'id' ? 'on' : ''}">ID</button></div>`;
  const logo = () => `<div class="logo"><span class="logo-mark">${icon('cal')}</span><span class="logo-word">Agenda<b>Ku</b></span></div>`;

  function showGate(html) {
    appEl.hidden = true; gate.hidden = false; $('#boot').hidden = true;
    gate.innerHTML = html + `<p class="credit">${CREDIT}</p>`;
  }

  function showWelcome() {
    pin = { mode: 'welcome', step: '' };
    const opt = (act, ic, title, sub) => `<button class="opt" data-act="${act}"><span class="opt-ic">${icon(ic)}</span><span><b>${title}</b><small>${sub}</small></span>${icon('right', 'chev')}</button>`;
    showGate(`<div class="gate-top">${logo()}${langToggle()}</div>
      <div class="gate-body">
        <div class="gate-art">${heroArt()}</div>
        <h1>${t('welcomeTitle')}</h1>
        <p class="muted">${t('welcomeSub')}</p>
        ${opt('chooseLocal', 'phone', t('optLocal'), t('optLocalSub'))}
        ${opt('chooseSheet', 'sheet', t('optSheet'), t('optSheetSub'))}
        <button class="btn link" data-act="demo">${t('tryDemo')}</button>
      </div>`);
  }

  // Invitation code: only people who were given a code can use the app (see config.js)
  const inviteList = () => ((window.AK_CONFIG && window.AK_CONFIG.inviteHashes) || []).filter(Boolean);
  const inviteNeeded = () => inviteList().length > 0 && inviteList().indexOf(store.get('ak_invite', '')) < 0;
  function showInvite(err) {
    pin = { mode: 'invite', step: '' };
    showGate(`<div class="gate-top">${logo()}${langToggle()}</div>
      <div class="gate-body">
        <div class="lock-badge">${icon('lock')}</div>
        <h1>${t('inviteTitle')}</h1>
        <p class="muted">${t('inviteSub')}</p>
        <form data-form="invite" novalidate>
          <div class="field ${err ? 'bad' : ''}"><input id="invite-code" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${t('invitePh')}">
            <p class="err">${err ? esc(err) : ''}</p></div>
          <button class="btn primary block big">${t('continue')}</button>
        </form>
      </div>`);
  }

  function showConnect(err) {
    pin = { mode: 'connect', step: '' };
    showGate(`<div class="gate-top"><button class="icon-btn" data-act="welcome" aria-label="${t('back')}">${icon('left')}</button>${langToggle()}</div>
      <div class="gate-body">
        <div class="lock-badge">${icon('sheet')}</div>
        <h1>${t('connectTitle')}</h1>
        <p class="muted">${t('connectHelp')}</p>
        <form data-form="connect" novalidate>
          <div class="field ${err ? 'bad' : ''}">
            <div class="with-btn"><input id="api-url" type="url" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false"
              placeholder="${t('connectPlaceholder')}" value="${esc(S.api)}">
              <button type="button" class="btn ghost" data-act="pasteUrl">${icon('paste')}${t('pasteLink')}</button></div>
            <p class="err" id="connect-err">${err ? esc(err) : ''}</p>
          </div>
          <button class="btn primary block big" id="connect-btn">${t('connectBtn')}</button>
        </form>
      </div>`);
  }

  async function doConnect(url) {
    url = String(url || '').trim();
    if (!/^https:\/\/script\.google(usercontent)?\.com\/.+\/exec(\?.*)?$/.test(url)) { showConnect(t('connectBadUrl')); return; }
    const btn = $('#connect-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spin"></span>' + t('connecting'); }
    S.api = url;
    try {
      const r = await api('status');
      store.set('ak_api', url);
      showPin(r.hasPin ? 'login' : 'create');
    } catch (e) { S.api = store.get('ak_api', ''); showConnect(t('connectFailed')); const i = $('#api-url'); if (i) i.value = url; }
  }

  function showPin(mode) {
    pin = { mode: mode, step: mode === 'create' ? 'new' : mode === 'change' ? 'old' : mode === 'reset' ? (S.local ? 'rcode' : 'ask') : 'enter',
      buf: '', first: '', old: '', code: '', msg: '', busy: false, email: '' };
    renderPin();
  }

  function renderPin() {
    const titles = { new: pin.mode === 'create' ? 'pinCreate' : 'pinNew', confirm: 'pinConfirm', enter: 'pinEnter', old: 'pinOld' };
    const subs = { new: pin.mode === 'create' ? 'pinCreateSub' : '', confirm: 'pinConfirmSub', enter: 'pinEnterSub', old: '' };
    const canBack = pin.mode === 'change' || pin.mode === 'reset' || (pin.mode === 'create' && S.local);
    const top = `<div class="gate-top">${canBack ? `<button class="icon-btn" data-act="pinBack" aria-label="${t('back')}">${icon('left')}</button>` : logo()}${langToggle()}</div>`;
    if (pin.step === 'recovery') {          // "this phone only": shown once after creating the PIN
      showGate(`<div class="gate-top">${logo()}${langToggle()}</div><div class="gate-body">
        <div class="lock-badge">${icon('lock')}</div>
        <h1>${t('recTitle')}</h1><p class="muted">${t('recSub')}</p>
        <div class="rec-code">${esc(pin.rcode)}</div>
        <button class="btn soft block" data-act="copyLink" data-v="${esc(pin.rcode)}">${icon('copy')}${t('copyCode')}</button>
        <button class="btn primary block big" data-act="recDone">${icon('check')}${t('recDone')}</button></div>`);
      return;
    }
    if (pin.step === 'rcode') {             // "this phone only": forgot PIN
      showGate(`${top}<div class="gate-body">
        <div class="lock-badge">${icon('lock')}</div>
        <h1>${t('recEnter')}</h1><p class="muted">${t('recEnterSub')}</p>
        <form data-form="rcode" novalidate>
          <div class="field"><input id="rec-code" class="code-input" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="9" placeholder="XXXX-XXXX">
          <p class="err" id="pin-msg">${esc(pin.msg)}</p></div>
          <button class="btn primary block big">${t('continue')}</button>
        </form>
        <button class="btn link danger" data-act="askErase">${t('recLost')}</button></div>`);
      return;
    }
    if (pin.step === 'ask' || pin.step === 'code') {
      showGate(`${top}<div class="gate-body">
        <div class="lock-badge">${icon('lock')}</div>
        <h1>${t('forgotTitle')}</h1>
        ${pin.step === 'ask' ? `<p class="muted">${t('forgotAsk')}</p>
          <p class="err" id="pin-msg">${esc(pin.msg)}</p>
          <button class="btn primary block big" data-act="sendCode" ${pin.busy ? 'disabled' : ''}>${pin.busy ? '<span class="spin"></span>' + t('forgotSending') : t('forgotSend')}</button>
          <p class="muted small">${t('forgotAlt')}</p>`
        : `<p class="muted">${t('forgotSent', { email: esc(pin.email) })}</p>
          <form data-form="code" novalidate>
            <div class="field"><input id="reset-code" class="code-input" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="${t('forgotCode')}" value="${esc(pin.code)}">
            <p class="err" id="pin-msg">${esc(pin.msg)}</p></div>
            <button class="btn primary block big">${t('continue')}</button>
          </form>`}
      </div>`);
      if (pin.step === 'code') { const i = $('#reset-code'); if (i) i.focus(); }
      return;
    }
    const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button class="key" data-act="digit" data-d="${n}">${n}</button>`).join('');
    showGate(`${top}<div class="gate-body pin">
      <div class="lock-badge">${icon('lock')}</div>
      <h1>${t(titles[pin.step])}</h1>
      <p class="muted">${subs[pin.step] ? t(subs[pin.step]) : '&nbsp;'}</p>
      <div class="pin-dots" id="pin-dots" aria-label="PIN"></div>
      <p class="err center" id="pin-msg" aria-live="polite">${esc(pin.msg)}</p>
      <div class="keypad">${keys}
        ${(pin.mode === 'login' || pin.mode === 'unlock') ? `<button class="key text" data-act="forgot">${t('pinForgot')}</button>` : '<span></span>'}
        <button class="key" data-act="digit" data-d="0">0</button>
        <button class="key" data-act="pinDel" aria-label="${t('delete')}">${icon('back')}</button>
      </div></div>`);
    pinDots();
  }
  function pinDots() {
    const el = $('#pin-dots'); if (!el) return;
    el.innerHTML = [0, 1, 2, 3].map((i) => `<span class="${i < pin.buf.length ? 'on' : ''}"></span>`).join('');
    el.classList.toggle('busy', pin.busy);
  }
  function pinFail(msg) {
    pin.buf = ''; pin.busy = false; pin.msg = msg;
    const m = $('#pin-msg'); if (m) m.textContent = msg;
    const d = $('#pin-dots'); if (d) { d.classList.remove('shake'); void d.offsetWidth; d.classList.add('shake'); }
    pinDots();
  }

  async function hashPin(p) { return window.AKHash.sha256('agendaku:' + S.api + ':' + p); }
  const recHashOf = (c) => window.AKHash.sha256('agendaku-rec:' + String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, ''));
  function newRecoveryCode() {
    const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    const r = new Uint32Array(8);
    try { crypto.getRandomValues(r); } catch (e) { for (let i = 0; i < 8; i++) r[i] = Math.floor(Math.random() * 4294967296); }
    let c = '';
    for (let i = 0; i < 8; i++) c += abc[r[i] % abc.length];
    return c.slice(0, 4) + '-' + c.slice(4);
  }
  function lockText(minutes) {
    minutes = Number(minutes) || 15;
    return minutes < 60 ? t('tMin', { n: minutes }) : t('tHour', { n: Math.ceil(minutes / 60) });
  }

  async function signedIn(token, p) {
    S.token = token; store.set('ak_token', token);
    S.pinHash = await hashPin(p); store.set('ak_pinhash', S.pinHash);
    enterApp();
  }

  function pinError(e) {
    if (e.code === 'PIN_WRONG') return t('pinWrong', { left: e.data.left });
    if (e.code === 'LOCKED') return t('pinLocked', { time: lockText(e.data.minutes) });
    if (e.code === 'PIN_LOCAL') return t('pinWrongLocal');
    if (e.code === 'NETWORK' || e.code === 'BAD_RESPONSE') return t('connectFailed');
    if (e.code === 'CODE_WRONG') return t('forgotCodeBad');
    if (e.code === 'CODE_EXPIRED') return t('forgotExpired');
    if (e.code === 'RESET_LIMIT') return t('forgotLimit');
    return e.message;
  }

  async function submitPin() {
    const p = pin.buf;
    if (pin.step === 'old') { pin.old = p; pin.step = 'new'; pin.buf = ''; pin.msg = ''; renderPin(); return; }
    if (pin.step === 'new') { pin.first = p; pin.step = 'confirm'; pin.buf = ''; pin.msg = ''; renderPin(); return; }
    pin.busy = true; pinDots();
    try {
      if (pin.step === 'confirm') {
        if (p !== pin.first) { pin.step = 'new'; pin.first = ''; pin.buf = ''; pin.busy = false; pin.msg = t('pinMismatch'); renderPin(); return; }
        if (pin.mode === 'create' && S.local) {
          S.pinHash = await hashPin(p); store.set('ak_pinhash', S.pinHash);
          const code = newRecoveryCode();
          S.recHash = recHashOf(code); store.set('ak_rechash', S.recHash);
          pin = { mode: 'create', step: 'recovery', rcode: code, buf: '', msg: '', busy: false };
          renderPin(); return;
        } else if (pin.mode === 'create') {
          let r;
          try { r = await api('createPin', { pin: p }); }
          catch (e) { if (e.code === 'PIN_EXISTS') { showPin('login'); return; } throw e; }
          await signedIn(r.token, p);
        } else if (pin.mode === 'reset') {
          if (S.local) { S.pinHash = await hashPin(p); store.set('ak_pinhash', S.pinHash); store.del('ak_lockuntil'); enterApp(); }
          else { const r = await api('resetPin', { code: pin.code, pin: p }); await signedIn(r.token, p); }
          toast(t('pinChanged'), 'success');
        } else if (pin.mode === 'change') {
          if (S.local) { if ((await hashPin(pin.old)) !== S.pinHash) throw apiError('PIN_LOCAL'); }
          else await api('changePin', { oldPin: pin.old, pin: p });
          S.pinHash = await hashPin(p); store.set('ak_pinhash', S.pinHash);
          enterApp(); toast(t('pinChanged'), 'success');
        }
      } else if (pin.mode === 'unlock') {
        if ((await hashPin(p)) === S.pinHash) { enterApp(); }
        else { pin.fails = (pin.fails || 0) + 1; if (pin.fails >= 5) {
            if (S.local) { store.set('ak_lockuntil', Date.now() + 60000); pin.fails = 0; pinFail(t('pinLockedLocal')); return; }
            showPin('login'); return;
          } pinFail(t('pinWrongLocal')); }
      } else {
        const r = await api('login', { pin: p });
        await signedIn(r.token, p);
      }
    } catch (e) {
      if (pin.mode === 'reset' && (e.code === 'CODE_WRONG' || e.code === 'CODE_EXPIRED')) {
        pin.step = e.code === 'CODE_WRONG' ? 'code' : 'ask'; pin.busy = false; pin.buf = ''; pin.msg = pinError(e); renderPin(); return;
      }
      if (pin.mode === 'change') { pin.step = 'old'; pin.old = ''; pin.first = ''; pin.buf = ''; pin.busy = false; pin.msg = pinError(e); renderPin(); return; }
      if (e.code === 'NO_PIN') { showPin('create'); return; }
      pinFail(pinError(e));
    }
  }

  function requireLogin() {
    S.token = ''; store.del('ak_token');
    closeSheet(true);
    showPin('login');
    pin.msg = t('sessionExpired'); const m = $('#pin-msg'); if (m) m.textContent = pin.msg;
  }

  function enterApp() {
    gate.hidden = true; $('#boot').hidden = true; appEl.hidden = false;
    render();
    if (S.outbox.length) flush(); else pull(true);
  }

  /* ============ 6. VIEWS ============ */

  function render() {
    $('#top').innerHTML = `${logo()}
      <div class="top-right">${S.demo ? `<span class="badge demo">${t('demoBadge')}</span>` : ''}
        <button id="sync" class="sync ok" data-act="syncNow"></button>
        <button class="av-btn" data-act="settings" aria-label="${t('settingsTitle')}">${avatar(44)}</button></div>`;
    const item = (v, ic, label) => `<button class="nav-item ${S.view === v ? 'on' : ''}" data-act="go" data-view="${v}" ${S.view === v ? 'aria-current="page"' : ''}>${icon(ic)}<span>${label}</span></button>`;
    $('#nav').innerHTML = item('home', 'home', t('navHome')) + item('agenda', 'list', t('navAgenda')) +
      `<button class="fab" data-act="add" aria-label="${t('addAgenda')}">${icon('plus')}</button>` +
      item('notes', 'note', t('navNotes')) + item('insights', 'chart', t('navInsights'));
    syncUI();
    renderView(true);
  }

  function renderView(animate) {
    const v = $('#view');
    const html = { home: viewHome, agenda: viewAgenda, notes: viewNotes, insights: viewInsights }[S.view]();
    const active = document.activeElement;
    if (!animate && active && active.dataset && active.dataset.in && v.contains(active)) {
      if (S.view === 'agenda') $('#agenda-list').innerHTML = agendaListHtml();
      if (S.view === 'notes') $('#notes-list').innerHTML = notesListHtml();
      return;
    }
    const y = v.scrollTop;
    v.innerHTML = html;
    if (animate) { v.scrollTop = 0; v.classList.remove('fade'); void v.offsetWidth; v.classList.add('fade'); } else v.scrollTop = y;
  }

  const active = (it) => it.status !== 'Cancelled';
  function stats() {
    const td = todayStr(), ws = weekStart(td), we = addDays(ws, 6), mo = td.slice(0, 7);
    const week = S.agenda.filter((x) => x.date >= ws && x.date <= we && active(x));
    const done = week.filter((x) => x.status === 'Done').length;
    return {
      today: S.agenda.filter((x) => x.date === td && active(x)).length,
      week: week.length, weekDone: done,
      weekLeft: week.filter((x) => x.status === 'Scheduled').length,
      pct: week.length ? Math.round((done / week.length) * 100) : 0,
      doneMonth: S.agenda.filter((x) => x.date.slice(0, 7) === mo && x.status === 'Done').length,
      follow: S.agenda.filter((x) => x.followUp && !x.followDone).length
    };
  }

  function heroArt() {
    return `<svg viewBox="0 0 150 120" class="art" aria-hidden="true">
      <rect x="18" y="26" width="92" height="78" rx="14" fill="#fff" stroke="#DCE0FF" stroke-width="2"/>
      <rect x="18" y="26" width="92" height="24" rx="12" fill="#4F5BF0"/><rect x="18" y="40" width="92" height="10" fill="#4F5BF0"/>
      <rect x="38" y="18" width="7" height="18" rx="3.500" fill="#2B3050"/><rect x="83" y="18" width="7" height="18" rx="3.500" fill="#2B3050"/>
      <rect x="30" y="60" width="16" height="12" rx="4" fill="#E3F1FF"/><rect x="56" y="60" width="16" height="12" rx="4" fill="#EEEAFE"/><rect x="82" y="60" width="16" height="12" rx="4" fill="#E1F4E8"/>
      <rect x="30" y="80" width="16" height="12" rx="4" fill="#FFEDE3"/><rect x="56" y="80" width="16" height="12" rx="4" fill="#E3F1FF"/>
      <circle cx="108" cy="88" r="22" fill="#2E9E63"/><path d="M98 88l7 7 13-14" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M128 30v12M122 36h12M10 70v8M6 74h8" stroke="#F0A679" stroke-width="3" stroke-linecap="round"/>
      <circle cx="134" cy="60" r="4" fill="#D9C8FA"/><circle cx="8" cy="40" r="3" fill="#BFE6D0"/></svg>`;
  }

  function ring(pct, size) {
    const r = 15.5, c = 2 * Math.PI * r;
    return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 40 40" role="img" aria-label="${pct}%">
      <circle cx="20" cy="20" r="${r}" fill="none" stroke="#E4F2EA" stroke-width="4"/>
      <circle cx="20" cy="20" r="${r}" fill="none" stroke="#2E9E63" stroke-width="4" stroke-linecap="round"
        stroke-dasharray="${(c * pct / 100).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 20 20)"/>
      <text x="20" y="24.200" text-anchor="middle" class="ring-t">${pct}</text></svg>`;
  }

  function skeleton() {
    return `<div class="skel-wrap" aria-busy="true">${[0, 1, 2].map(() => '<div class="skel"></div>').join('')}</div>`;
  }

  function viewHome() {
    if (!S.loaded && !S.agenda.length) return `<div class="skel hero-skel"></div><div class="tiles">${[0, 1, 2, 3].map(() => '<div class="skel tile-skel"></div>').join('')}</div>${skeleton()}`;
    const st = stats(), td = todayStr();
    const name = (S.settings.name || '').trim();
    const mood = st.week === 0 ? 'prog0' : st.pct >= 80 ? 'prog3' : st.pct >= 50 ? 'prog2' : st.pct > 0 ? 'prog1' : 'prog0';
    const line = st.week === 0 ? t('weekEmpty') : st.weekLeft === 0 ? t('weekClear') : t('weekLeft', { n: st.weekLeft });
    const todays = S.agenda.filter((x) => x.date === td).sort(byWhen);
    const tile = (cls, ic, n, label, act, extra) => `<button class="tile ${cls}" data-act="${act}" ${extra || ''}>
        <span class="tile-ic">${icon(ic)}</span><span><b>${n}</b><small>${label}</small></span></button>`;
    return `
      ${S.demo ? `<p class="demo-note">${t('demoNote')}</p>` : ''}
      ${S.local && S.agenda.length >= 5 && Date.now() - S.lastBackup > 30 * 86400000 ? `<div class="demo-note warn"><span>${t('backupNudge')}</span><button class="btn soft sm" data-act="exportBackup">${t('backupNow')}</button></div>` : ''}
      <section class="card hero">
        <div class="hero-row"><div>
          <h1>${name ? t('hi', { name: esc(name) }) : t('hiNoName')}</h1>
          <p>${line}</p></div>${heroArt()}</div>
        <div class="prog">${ring(st.pct, 54)}<div><small>${t('progress')} · ${st.weekDone}/${st.week}</small><strong>${t(mood)}</strong></div></div>
        <button class="btn primary block" data-act="go" data-view="agenda">${t('viewSchedule')}</button>
      </section>
      <section class="tiles">
        ${tile('blue', 'clock', st.today, t('tileToday'), 'tileToday')}
        ${tile('lilac', 'list', st.week, t('tileWeek'), 'tileWeek')}
        ${tile('green', 'check', st.doneMonth, t('tileDone'), 'tileDone')}
        ${tile('peach', 'flag', st.follow, t('tileFollow'), 'go', 'data-view="insights"')}
      </section>
      <section>
        <div class="sec-head"><div><h2>${t('todayAgenda')}</h2><span class="muted">${fmtDate(td, { weekday: 'long', day: 'numeric', month: 'long' })}</span></div>
          ${todays.length ? `<button class="btn soft sm" data-act="shareDay" data-date="${td}">${icon('share')}${t('share')}</button>` : ''}</div>
        ${todays.length ? `<div class="ag-list">${todays.map(agCard).join('')}</div>` : emptyBox('cal', t('emptyDay'), '', `<button class="btn soft" data-act="add">${icon('plus')}${t('emptyDayCta')}</button>`)}
      </section>
      <section class="card" id="cal-card">${calendarHtml()}</section>
      <section class="card" id="chart-card">${homeChartHtml()}</section>
      <p class="credit">${CREDIT}</p>`;
  }

  function emptyBox(ic, title, sub, cta) {
    return `<div class="empty"><span class="empty-ic">${icon(ic)}</span><strong>${title}</strong>${sub ? `<p>${sub}</p>` : ''}${cta || ''}</div>`;
  }

  function agCard(it) {
    const c = CAT_COLOR[it.category] || CAT_COLOR.Other;
    const url = safeUrl(it.link);
    const nb = bringList(it).length;
    return `<div class="ag st-${it.status}" role="button" tabindex="0" data-act="openAgenda" data-id="${esc(it.id)}" style="--c:${c}">
      <div class="ag-time">${it.start ? `<b>${it.start}</b>${it.end ? `<small>${it.end}</small>` : ''}` : `<small class="allday">${t('allDay')}</small>`}</div>
      <div class="ag-body">
        <strong>${esc(it.title)}</strong>
        <small>${esc(t('cat_' + it.category))}${it.location ? ' · ' + esc(it.location) : ''}</small>
        <div class="ag-meta">
          ${it.status !== 'Scheduled' ? `<span class="pill" style="--p:${ST_COLOR[it.status]}">${t('st_' + it.status)}</span>` : ''}
          ${nb ? `<span class="meta">${icon('bag')}${nb}</span>` : ''}
          ${it.followUp && !it.followDone ? `<span class="meta warn">${icon('flag')}${t('tileFollow')}</span>` : ''}
          ${it.notes ? `<span class="meta">${icon('note')}</span>` : ''}
        </div>
      </div>
      ${url ? `<a class="ag-link" href="${esc(url)}" target="_blank" rel="noopener" data-stop aria-label="${t('openLink')}">${icon('link')}</a>` : ''}
    </div>`;
  }

  function calendarHtml() {
    const [y, m] = S.calMonth.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const startPad = (first.getDay() + 6) % 7;
    const days = new Date(y, m, 0).getDate();
    const td = todayStr();
    const byDay = {};
    S.agenda.forEach((x) => { if (active(x) && x.date.slice(0, 7) === S.calMonth) (byDay[x.date] = byDay[x.date] || []).push(x); });
    let cells = '';
    for (let i = 0; i < startPad; i++) cells += '<span></span>';
    for (let d = 1; d <= days; d++) {
      const ds = S.calMonth + '-' + pad(d);
      const cats = [];
      (byDay[ds] || []).forEach((x) => { if (cats.indexOf(x.category) < 0) cats.push(x.category); });
      cells += `<button class="day ${ds === td ? 'today' : ''} ${ds === S.selDate ? 'sel' : ''}" data-act="pickDay" data-date="${ds}"
        aria-label="${fmtDate(ds, { day: 'numeric', month: 'long' })}${byDay[ds] ? ', ' + t('agendasCount', { n: byDay[ds].length }) : ''}">
        <b>${d}</b><i>${cats.slice(0, 3).map((c) => `<u style="background:${CAT_COLOR[c]}"></u>`).join('')}</i></button>`;
    }
    const title = new Intl.DateTimeFormat(locale(), { month: 'long', year: 'numeric' }).format(first);
    let below = '';
    if (S.selDate) {
      const list = S.agenda.filter((x) => x.date === S.selDate).sort(byWhen);
      below = `<div class="sec-head sub"><h3>${t('agendaOn', { date: fmtDate(S.selDate, { weekday: 'short', day: 'numeric', month: 'short' }) })}</h3>
        <div class="row" style="gap:2px">${list.length ? `<button class="btn link" data-act="shareDay" data-date="${S.selDate}" aria-label="${t('share')}">${icon('share')}</button>` : ''}
        <button class="btn link" data-act="addOn" data-date="${S.selDate}">${icon('plus')}${t('addAgenda')}</button></div></div>
        ${list.length ? `<div class="ag-list">${list.map(agCard).join('')}</div>` : `<p class="muted pad">${t('emptyDay')}</p>`}`;
    }
    return `<div class="cal-head"><h2>${esc(title)}</h2><div>
        <button class="icon-btn" data-act="calNav" data-n="-1" aria-label="Previous month">${icon('left')}</button>
        <button class="icon-btn" data-act="calNav" data-n="1" aria-label="Next month">${icon('right')}</button></div></div>
      <div class="cal-grid dow">${t('dow').split(',').map((d) => `<span>${d}</span>`).join('')}</div>
      <div class="cal-grid">${cells}</div>
      <div class="legend">${CATS.map((c) => `<span><u style="background:${CAT_COLOR[c]}"></u>${t('cat_' + c)}</span>`).join('')}</div>
      ${below}`;
  }

  function chartSeries() {
    const td = todayStr();
    const start = S.chartRange === 7 ? weekStart(td) : addDays(td, -14);
    const n = S.chartRange === 7 ? 7 : 30;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const ds = addDays(start, i);
      pts.push({ date: ds, value: S.agenda.filter((x) => x.date === ds && active(x)).length, today: ds === td });
    }
    return pts;
  }

  function homeChartHtml() {
    const pts = chartSeries();
    const total = pts.reduce((a, p) => a + p.value, 0);
    let sel = S.chartSel;
    if (sel < 0 || sel >= pts.length) sel = Math.max(0, pts.findIndex((p) => p.today));
    const W = 320, H = 150, L = 12, R = 12, T = 30, B = 24;
    const max = Math.max(2, Math.max.apply(null, pts.map((p) => p.value)));
    const x = (i) => L + (i * (W - L - R)) / (pts.length - 1);
    const y = (v) => T + (1 - v / max) * (H - T - B);
    let d = `M${x(0).toFixed(1)},${y(pts[0].value).toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      const mx = ((x(i - 1) + x(i)) / 2).toFixed(1);
      d += ` C${mx},${y(pts[i - 1].value).toFixed(1)} ${mx},${y(pts[i].value).toFixed(1)} ${x(i).toFixed(1)},${y(pts[i].value).toFixed(1)}`;
    }
    const area = d + ` L${x(pts.length - 1).toFixed(1)},${H - B} L${x(0).toFixed(1)},${H - B} Z`;
    const step = pts.length > 7 ? 5 : 1;
    const labels = pts.map((p, i) => {
      if (i % step !== 0 && i !== sel) return '';
      if (pts.length > 7 && i !== sel && Math.abs(i - sel) < 3) return '';
      const text = pts.length > 7 ? fmtDate(p.date, { day: 'numeric', month: 'short' }) : fmtDate(p.date, { weekday: 'short' });
      return `<text x="${x(i).toFixed(1)}" y="${H - 6}" text-anchor="middle" class="ax ${i === sel ? 'on' : ''}">${esc(text)}</text>`;
    }).join('');
    const sx = x(sel), sy = y(pts[sel].value);
    const bw = 30, bx = Math.min(W - R - bw, Math.max(L, sx - bw / 2));
    const hit = pts.map((p, i) => `<rect x="${(x(i) - (W - L - R) / (pts.length - 1) / 2).toFixed(1)}" y="0" width="${((W - L - R) / (pts.length - 1)).toFixed(1)}" height="${H}" fill="transparent" data-chart-i="${i}"/>`).join('');
    return `<div class="sec-head"><div><h2>${t('activity')}</h2><span class="muted">${t('activitySub', { n: total })}</span></div>
        <div class="seg small"><button data-act="chartRange" data-n="7" class="${S.chartRange === 7 ? 'on' : ''}">${t('rangeWeek')}</button>
        <button data-act="chartRange" data-n="30" class="${S.chartRange === 30 ? 'on' : ''}">${t('range30')}</button></div></div>
      <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${t('activity')}: ${fmtDate(pts[sel].date)} — ${t('agendasCount', { n: pts[sel].value })}">
        <defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4F5BF0" stop-opacity=".22"/><stop offset="1" stop-color="#4F5BF0" stop-opacity="0"/></linearGradient></defs>
        ${[0, 0.5, 1].map((f) => `<line x1="${L}" x2="${W - R}" y1="${(T + f * (H - T - B)).toFixed(1)}" y2="${(T + f * (H - T - B)).toFixed(1)}" class="grid"/>`).join('')}
        <path d="${area}" fill="url(#g1)"/><path d="${d}" class="line"/>
        <line x1="${sx.toFixed(1)}" x2="${sx.toFixed(1)}" y1="${(sy + 6).toFixed(1)}" y2="${H - B}" class="cross"/>
        <circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="5" class="dot"/>
        <rect x="${bx.toFixed(1)}" y="${Math.max(2, sy - 30).toFixed(1)}" width="${bw}" height="20" rx="7" class="bubble"/>
        <text x="${(bx + bw / 2).toFixed(1)}" y="${(Math.max(2, sy - 30) + 14.5).toFixed(1)}" text-anchor="middle" class="bubble-t">${pts[sel].value}</text>
        ${labels}${hit}
      </svg>
      <p class="chart-cap">${fmtDate(pts[sel].date, { weekday: 'long', day: 'numeric', month: 'long' })} · <b>${t('agendasCount', { n: pts[sel].value })}</b></p>`;
  }

  // ----- Agenda list -----
  function filteredAgenda() {
    const f = S.filter, td = todayStr(), q = f.q.trim().toLowerCase();
    let list = S.agenda.filter((x) => {
      if (f.cat !== 'all' && x.category !== f.cat) return false;
      if (f.status !== 'all' && x.status !== f.status) return false;
      if (f.from && x.date < f.from) return false;
      if (f.to && x.date > f.to) return false;
      if (!f.from && !f.to && !q) {
        if (f.scope === 'upcoming' && x.date < td) return false;
        if (f.scope === 'past' && x.date >= td) return false;
      }
      if (q && [x.title, x.location, x.notes, x.bring, x.followNote, t('cat_' + x.category)].join(' ').toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    list.sort(byWhen);
    if (!(f.scope === 'upcoming' && !f.from && !f.to && !q)) list.reverse();
    return list;
  }

  function agendaListHtml() {
    const list = filteredAgenda();
    if (!S.loaded && !S.agenda.length) return skeleton();
    if (!list.length) {
      const f = S.filter;
      const filtered = f.q || f.cat !== 'all' || f.status !== 'all' || f.from || f.to;
      if (!S.agenda.length) return emptyBox('cal', t('emptyAgenda'), t('emptyAgendaSub'), `<button class="btn soft" data-act="add">${icon('plus')}${t('addAgenda')}</button>`);
      return emptyBox('search', filtered ? t('emptySearch') : t('emptyDay'), filtered ? t('emptySearchSub') : '', filtered ? `<button class="btn soft" data-act="clearFilter">${t('clearFilter')}</button>` : '');
    }
    let html = `<p class="muted count">${t('results', { n: list.length })}</p>`, last = '';
    list.forEach((it) => {
      if (it.date !== last) {
        last = it.date;
        const rel = relDay(it.date);
        html += `<h3 class="day-head">${fmtDate(it.date)}${rel ? ` <span>${rel}</span>` : ''}</h3>`;
      }
      html += agCard(it);
    });
    return html;
  }

  function viewAgenda() {
    const f = S.filter;
    const chip = (v, label, color) => `<button class="chip ${f.cat === v ? 'on' : ''}" data-act="fCat" data-v="${v}" ${color ? `style="--c:${color}"` : ''}>${color ? '<u></u>' : ''}${label}</button>`;
    const nFilters = (f.status !== 'all' ? 1 : 0) + (f.from || f.to ? 1 : 0);
    return `<div class="page-head"><h1>${t('navAgenda')}</h1></div>
      <div class="search"><span>${icon('search')}</span><input type="search" data-in="agendaSearch" placeholder="${t('searchAgenda')}" value="${esc(f.q)}" aria-label="${t('search')}">
        <button class="icon-btn ${nFilters ? 'has' : ''}" data-act="toggleFilter" aria-label="${t('filter')}" aria-expanded="${f.open}">${icon('filter')}${nFilters ? `<em>${nFilters}</em>` : ''}</button></div>
      <div class="filters" ${f.open ? '' : 'hidden'}>
        <label>${t('from')}<input type="date" data-ch="fFrom" value="${f.from}"></label>
        <label>${t('to')}<input type="date" data-ch="fTo" value="${f.to}"></label>
        <label class="wide">${t('status')}<select data-ch="fStatus"><option value="all">${t('all')}</option>${STATUSES.map((s) => `<option value="${s}" ${f.status === s ? 'selected' : ''}>${t('st_' + s)}</option>`).join('')}</select></label>
        <button class="btn link wide" data-act="clearFilter">${t('clearFilter')}</button>
      </div>
      <div class="chips">${chip('all', t('all'))}${CATS.map((c) => chip(c, t('cat_' + c), CAT_COLOR[c])).join('')}</div>
      <div class="seg" ${f.from || f.to || f.q ? 'hidden' : ''}>${['upcoming', 'past', 'all'].map((s) => `<button data-act="fScope" data-v="${s}" class="${f.scope === s ? 'on' : ''}">${t(s)}</button>`).join('')}</div>
      <div id="agenda-list" class="ag-list">${agendaListHtml()}</div>`;
  }

  // ----- Notes -----
  function notesListHtml() {
    const f = S.noteFilter, q = f.q.trim().toLowerCase();
    let list = S.notes.filter((n) => (f.topic === 'all' || (n.topic || '') === f.topic) &&
      (!q || [n.title, n.content, n.topic].join(' ').toLowerCase().indexOf(q) >= 0));
    list.sort((a, b) => (b.pinned - a.pinned) || (b.date || '').localeCompare(a.date || '') || (b.updated || '').localeCompare(a.updated || ''));
    if (!S.notes.length) return emptyBox('note', t('emptyNotes'), t('emptyNotesSub'), `<button class="btn soft" data-act="addNote">${icon('plus')}${t('addNote')}</button>`);
    if (!list.length) return emptyBox('search', t('emptySearch'), t('emptySearchSub'));
    return list.map((n) => `<div class="note ${n.pinned ? 'pinned' : ''}" role="button" tabindex="0" data-act="openNote" data-id="${esc(n.id)}">
        <div class="note-top">${n.topic ? `<span class="tag">${esc(n.topic)}</span>` : '<span></span>'}${n.pinned ? `<span class="meta" title="${t('pinned')}">${icon('star')}</span>` : ''}</div>
        <strong>${esc(n.title)}</strong>
        ${n.content ? `<p>${esc(n.content.length > 140 ? n.content.slice(0, 140) + '…' : n.content)}</p>` : ''}
        <small class="muted">${fmtDate(n.date, { day: 'numeric', month: 'short', year: 'numeric' })}</small></div>`).join('');
  }

  function viewNotes() {
    const f = S.noteFilter;
    const topics = []; S.notes.forEach((n) => { if (n.topic && topics.indexOf(n.topic) < 0) topics.push(n.topic); });
    return `<div class="page-head"><div><h1>${t('notesTitle')}</h1><p class="muted">${t('notesSub')}</p></div>
        <button class="btn soft" data-act="addNote">${icon('plus')}${t('addNote')}</button></div>
      <div class="search"><span>${icon('search')}</span><input type="search" data-in="noteSearch" placeholder="${t('searchNotes')}" value="${esc(f.q)}" aria-label="${t('search')}"></div>
      ${topics.length ? `<div class="chips"><button class="chip ${f.topic === 'all' ? 'on' : ''}" data-act="nTopic" data-v="all">${t('all')}</button>
        ${topics.sort().map((x) => `<button class="chip ${f.topic === x ? 'on' : ''}" data-act="nTopic" data-v="${esc(x)}">${esc(x)}</button>`).join('')}</div>` : ''}
      <div id="notes-list" class="notes">${notesListHtml()}</div>`;
  }

  // ----- Insights -----
  function viewInsights() {
    const td = todayStr();
    const from = S.insPeriod === 'month' ? td.slice(0, 8) + '01' : S.insPeriod === '90' ? addDays(td, -89) : '';
    const to = S.insPeriod === 'month' ? ymd(new Date(+td.slice(0, 4), +td.slice(5, 7), 0)) : S.insPeriod === '90' ? td : '9999';
    const inP = S.agenda.filter((x) => (!from || x.date >= from) && x.date <= to);
    const follow = S.agenda.filter((x) => x.followUp && !x.followDone).sort(byWhen);
    const overdue = S.agenda.filter((x) => x.status === 'Scheduled' && x.date < td).sort(byWhen).reverse();
    const noMin = S.agenda.filter((x) => x.status === 'Done' && !String(x.notes || '').trim() && x.date >= addDays(td, -30)).sort(byWhen).reverse();

    const row = (it, extra) => `<div class="ins-row"><div role="button" tabindex="0" data-act="openAgenda" data-id="${esc(it.id)}">
        <strong>${esc(it.title)}</strong><small>${fmtDate(it.date, { weekday: 'short', day: 'numeric', month: 'short' })} · ${t('cat_' + it.category)}${it.followNote && extra === 'follow' ? ' · ' + esc(it.followNote) : ''}</small></div>
        ${extra === 'follow' ? `<button class="btn soft sm" data-act="followDone" data-id="${esc(it.id)}">${icon('check')}${t('st_Done')}</button>` : ''}
        ${extra === 'overdue' ? `<div class="mini"><button class="btn soft sm" data-act="quickStatus" data-id="${esc(it.id)}" data-v="Done" aria-label="${t('st_Done')}">${icon('check')}</button>
          <button class="btn soft sm" data-act="reschedule" data-id="${esc(it.id)}" aria-label="${t('reschedule')}">${icon('refresh')}</button>
          <button class="btn soft sm" data-act="quickStatus" data-id="${esc(it.id)}" data-v="Cancelled" aria-label="${t('st_Cancelled')}">${icon('x')}</button></div>` : ''}
        ${extra === 'minutes' ? `<button class="btn soft sm" data-act="editAgenda" data-id="${esc(it.id)}" data-focus="notes">${icon('edit')}${t('addNotes')}</button>` : ''}</div>`;
    const block = (title, n, list, kind, emptyText, tone) => `<section class="card ins ${tone}">
        <div class="sec-head"><h2>${title}</h2><span class="count-badge">${n}</span></div>
        ${list.length ? list.slice(0, 8).map((x) => row(x, kind)).join('') : `<p class="muted ok-line">${icon('check')}${emptyText}</p>`}</section>`;

    // charts
    const catCount = CATS.map((c) => ({ k: c, n: inP.filter((x) => x.category === c).length }));
    const catMax = Math.max(1, Math.max.apply(null, catCount.map((c) => c.n)));
    const stCount = STATUSES.map((s) => ({ k: s, n: inP.filter((x) => x.status === s).length })).filter((s) => s.n);
    const total = inP.length;
    const due = inP.filter((x) => active(x) && x.date <= td);
    const done = due.filter((x) => x.status === 'Done').length;
    const rate = due.length ? Math.round((done / due.length) * 100) : 0;
    const dow = [0, 0, 0, 0, 0, 0, 0];
    inP.forEach((x) => { if (active(x)) dow[(toDate(x.date).getDay() + 6) % 7]++; });
    const dowMax = Math.max(1, Math.max.apply(null, dow));
    const dowNames = t('dow').split(',');

    const charts = total ? `
      <section class="card"><div class="sec-head"><h2>${t('completion')}</h2></div>
        <div class="prog big">${ring(rate, 72)}<div><strong>${rate}%</strong><small>${t('completionSub', { done: done, total: due.length })}</small></div></div></section>
      <section class="card"><div class="sec-head"><h2>${t('chartCat')}</h2></div>
        <div class="hbars">${catCount.map((c) => `<div class="hbar" title="${t('cat_' + c.k)}: ${c.n}"><span>${t('cat_' + c.k)}</span>
          <div class="track"><i style="width:${(c.n / catMax) * 100}%;background:${CAT_COLOR[c.k]}"></i></div><b>${c.n}</b></div>`).join('')}</div></section>
      <section class="card"><div class="sec-head"><h2>${t('chartStatus')}</h2></div>
        <div class="stack" role="img" aria-label="${t('chartStatus')}">${stCount.map((s) => `<i style="flex:${s.n};background:${ST_COLOR[s.k]}" title="${t('st_' + s.k)}: ${s.n}"></i>`).join('')}</div>
        <div class="legend wrap">${stCount.map((s) => `<span><u style="background:${ST_COLOR[s.k]}"></u>${t('st_' + s.k)} <b>${s.n}</b></span>`).join('')}</div></section>
      <section class="card"><div class="sec-head"><h2>${t('chartDow')}</h2></div>
        <div class="vbars">${dow.map((n, i) => `<div class="vbar" title="${dowNames[i]}: ${n}"><b>${n || ''}</b><div class="vtrack"><i style="height:${(n / dowMax) * 100}%"></i></div><span>${dowNames[i]}</span></div>`).join('')}</div></section>`
      : `<section class="card">${emptyBox('chart', t('noData'), '')}</section>`;

    return `<div class="page-head"><h1>${t('insightsTitle')}</h1></div>
      ${block(t('insFollow'), follow.length, follow, 'follow', t('insFollowEmpty'), 'peach')}
      ${block(t('insOverdue'), overdue.length, overdue, 'overdue', t('insOverdueEmpty'), 'blue')}
      ${block(t('insMinutes'), noMin.length, noMin, 'minutes', t('insMinutesEmpty'), 'lilac')}
      <div class="seg">${[['month', 'pMonth'], ['90', 'p90'], ['all', 'pAll']].map((p) => `<button data-act="insPeriod" data-v="${p[0]}" class="${S.insPeriod === p[0] ? 'on' : ''}">${t(p[1])}</button>`).join('')}</div>
      ${charts}`;
  }

  /* ============ 7. SHEETS (slide-up panels) ============ */

  const wrap = $('#sheet-wrap'), sheetEl = $('#sheet');
  let sheet = null;       // { type, id, ... }
  let closeTimer = null;

  function openSheet(state, html) {
    clearTimeout(closeTimer);
    sheet = state;
    sheetEl.innerHTML = `<div class="grab"></div>${html}`;
    wrap.hidden = false;
    sheetEl.scrollTop = 0;
    requestAnimationFrame(() => wrap.classList.add('open'));
    document.body.classList.add('noscroll');
  }
  function closeSheet(now) {
    if (!sheet && wrap.hidden) return;
    sheet = null;
    wrap.classList.remove('open');
    document.body.classList.remove('noscroll');
    clearTimeout(closeTimer);
    if (now === true) wrap.hidden = true; else closeTimer = setTimeout(() => { wrap.hidden = true; sheetEl.innerHTML = ''; }, 240);
  }
  const sheetHead = (title, right) => `<div class="sheet-head"><h2>${title}</h2><div>${right || ''}<button class="icon-btn" data-act="closeSheet" aria-label="${t('close')}">${icon('x')}</button></div></div>`;

  // ----- Agenda form -----
  let draftBring = [];
  let draftSource = '';
  function openAgendaForm(item, opts) {
    opts = opts || {};
    const isNew = !item;
    const it = item || { id: '', category: 'Work', title: '', date: opts.date || todayStr(), start: '', end: '', location: '', link: '', bring: '', status: 'Scheduled', notes: '', followUp: false, followNote: '' };
    draftBring = bringList(it);
    draftSource = it.source || '';
    openSheet({ type: 'form', id: it.id, isNew: isNew }, `
      ${sheetHead(isNew ? t('newAgenda') : t('editAgenda'))}
      <form data-form="agenda" novalidate>
        ${isNew ? `<details class="paste" ${opts.paste ? 'open' : ''}><summary>${icon('paste')}<span><b>${t('pasteTitle')}</b><small>${t('pasteHelp')}</small></span>${icon('right', 'chev')}</summary>
          <textarea id="paste-text" rows="5" placeholder="${t('pastePlaceholder')}"></textarea>
          <div class="row"><button type="button" class="btn soft" data-act="pasteClip">${icon('paste')}${t('pasteBtn')}</button>
          <button type="button" class="btn primary grow" data-act="autoFill">${icon('spark')}${t('autoFill')}</button></div>
          <p class="hint" id="paste-msg" aria-live="polite"></p></details>` : ''}
        <div class="field"><label>${t('category')}</label>
          <div class="chips pick" id="f-cats">${CATS.map((c) => `<button type="button" class="chip ${it.category === c ? 'on' : ''}" data-act="pickCat" data-v="${c}" style="--c:${CAT_COLOR[c]}"><u></u>${t('cat_' + c)}</button>`).join('')}</div>
          <input type="hidden" id="f-category" value="${it.category}"></div>
        <div class="field" id="fw-title"><label for="f-title">${t('title')} <em>*</em></label>
          <input id="f-title" type="text" maxlength="200" placeholder="${t('titlePh')}" value="${esc(it.title)}" autocomplete="off"><p class="err"></p></div>
        <div class="grid3">
          <div class="field" id="fw-date"><label for="f-date">${t('date')} <em>*</em></label><input id="f-date" type="date" value="${esc(it.date)}"><p class="err"></p></div>
          <div class="field"><label for="f-start">${t('start')}</label><input id="f-start" type="time" value="${esc(it.start)}"></div>
          <div class="field" id="fw-end"><label for="f-end">${t('end')}</label><input id="f-end" type="time" value="${esc(it.end)}"></div>
        </div><p class="err" id="time-err"></p>
        <div class="field"><label for="f-location">${t('location')}</label><input id="f-location" type="text" maxlength="300" placeholder="${t('locationPh')}" value="${esc(it.location)}"></div>
        <div class="field" id="fw-link"><label for="f-link">${t('link')}</label><input id="f-link" type="url" inputmode="url" autocapitalize="off" placeholder="${t('linkPh')}" value="${esc(it.link)}"><p class="err"></p></div>
        <div class="field"><label for="f-bring">${t('bring')}</label>
          <div class="bring-chips" id="bring-chips"></div>
          <div class="with-btn"><input id="f-bring" type="text" maxlength="60" placeholder="${t('bringPh')}" enterkeyhint="done" autocomplete="off">
          <button type="button" class="btn soft" data-act="addBring" aria-label="${t('addAgenda')}">${icon('plus')}</button></div></div>
        <div class="field"><label for="f-status">${t('status')}</label>
          <select id="f-status">${STATUSES.map((s) => `<option value="${s}" ${it.status === s ? 'selected' : ''}>${t('st_' + s)}</option>`).join('')}</select></div>
        <div class="field"><label for="f-notes">${t('notes')} <span class="muted">(${t('optional')})</span></label>
          <textarea id="f-notes" rows="4" placeholder="${t('notesPh')}">${esc(it.notes)}</textarea></div>
        <label class="switch"><input type="checkbox" id="f-follow" ${it.followUp ? 'checked' : ''} data-ch="toggleFollow"><i></i><span>${t('followUp')}</span></label>
        <div class="field" id="fw-follow" ${it.followUp ? '' : 'hidden'}><label for="f-follownote">${t('followNote')}</label>
          <input id="f-follownote" type="text" maxlength="300" placeholder="${t('followNotePh')}" value="${esc(it.followNote)}"></div>
        <div class="sheet-foot"><button type="button" class="btn ghost" data-act="closeSheet">${t('cancel')}</button>
          <button class="btn primary grow big">${icon('check')}${t('save')}</button></div>
      </form>`);
    renderBring();
    if (opts.focus) { const el = $('#f-' + opts.focus); if (el) setTimeout(() => { el.focus(); el.scrollIntoView({ block: 'center' }); }, 300); }
  }
  function renderBring() {
    const el = $('#bring-chips'); if (!el) return;
    el.innerHTML = draftBring.map((b, i) => `<span class="bchip">${icon('bag')}${esc(b)}<button type="button" data-act="rmBring" data-i="${i}" aria-label="${t('delete')}">${icon('x')}</button></span>`).join('');
  }
  function addBringFromInput() {
    const inp = $('#f-bring'); if (!inp) return;
    inp.value.split(/[;,]/).map((x) => x.trim()).filter(Boolean).forEach((x) => { if (draftBring.map((b) => b.toLowerCase()).indexOf(x.toLowerCase()) < 0) draftBring.push(x); });
    inp.value = ''; renderBring();
  }
  function setFieldError(wrapId, msg) {
    const w = $('#' + wrapId); if (!w) return;
    w.classList.toggle('bad', !!msg);
    const e = $('.err', w); if (e) e.textContent = msg || '';
  }

  function runAutoFill() {
    const txt = $('#paste-text').value;
    const msg = $('#paste-msg');
    if (!txt.trim()) { msg.textContent = t('pasteEmpty'); msg.className = 'hint bad'; return; }
    const r = window.AKParser.parse(txt);
    const set = (id, v) => { if (v) $('#' + id).value = v; };
    set('f-title', r.title); set('f-date', r.date); set('f-start', r.start); set('f-end', r.end);
    set('f-location', r.location); set('f-link', r.link);
    if (r.notes) $('#f-notes').value = r.notes;
    if (r.bring.length) { draftBring = r.bring.slice(); renderBring(); }
    $('#f-category').value = r.category;
    $$('#f-cats .chip').forEach((c) => c.classList.toggle('on', c.dataset.v === r.category));
    draftSource = r.source;
    if (!r.found.length || (r.found.indexOf('date') < 0 && r.found.indexOf('title') < 0)) { msg.textContent = t('pasteNothing'); msg.className = 'hint bad'; return; }
    msg.textContent = t('pasteDone', { list: r.found.map((f) => t('f_' + f)).join(', ') }) + (r.multiple ? ' ' + t('pasteMulti') : '');
    msg.className = 'hint ok';
    setFieldError('fw-title', ''); setFieldError('fw-date', '');
    $('.paste').open = false;
    $('#fw-title').scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function submitAgendaForm() {
    addBringFromInput();
    const v = (id) => $('#' + id).value.trim();
    const title = v('f-title'), date = v('f-date'), start = v('f-start');
    let end = v('f-end'), link = v('f-link');
    let ok = true;
    setFieldError('fw-title', title ? '' : t('errTitle')); if (!title) ok = false;
    setFieldError('fw-date', /^\d{4}-\d{2}-\d{2}$/.test(date) ? '' : t('errDate')); if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) ok = false;
    const te = $('#time-err'); te.textContent = '';
    if (start && end && end <= start) { te.textContent = t('errEnd'); ok = false; }
    if (!start) end = '';
    if (link) { const u = safeUrl(link); setFieldError('fw-link', u ? '' : t('errLink')); if (!u) ok = false; else link = u; } else setFieldError('fw-link', '');
    if (!ok) { const bad = $('.field.bad input, #time-err:not(:empty)', sheetEl); if (bad && bad.focus) bad.focus(); const b2 = $('.field.bad', sheetEl); if (b2) b2.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
    const old = S.agenda.find((x) => x.id === sheet.id) || {};
    const follow = $('#f-follow').checked;
    const item = Object.assign({}, old, {
      id: old.id || uid('A'), category: v('f-category'), title: title, date: date, start: start, end: end,
      location: v('f-location'), link: link, bring: draftBring.join('; '), status: v('f-status'), notes: $('#f-notes').value.trim(),
      followUp: follow, followNote: follow ? v('f-follownote') : (old.followNote || ''), followDone: follow ? !!old.followDone : false,
      source: draftSource || old.source || '', created: old.created || nowStamp(), updated: nowStamp()
    });
    saveAgenda(item);
    closeSheet();
  }

  function saveAgenda(item) {
    const i = S.agenda.findIndex((x) => x.id === item.id);
    if (i >= 0) S.agenda[i] = item; else S.agenda.push(item);
    persist(); renderView();
    enqueue('saveAgenda', { item: item }, 'save');
  }

  // ----- Calendar helpers for "this phone only" mode -----
  function gcalUrl(it) {
    const d = it.date.replace(/-/g, '');
    let dates;
    if (it.start) {
      const end = it.end || pad(Math.min(23, Number(it.start.slice(0, 2)) + 1)) + ':' + it.start.slice(3);
      dates = d + 'T' + it.start.replace(':', '') + '00/' + d + 'T' + end.replace(':', '') + '00';
    } else dates = d + '/' + addDays(it.date, 1).replace(/-/g, '');
    const details = [bringList(it).length ? t('bring') + ': ' + bringList(it).join(', ') : '', safeUrl(it.link), it.notes].filter(Boolean).join('\n');
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(it.title) + '&dates=' + dates +
      '&details=' + encodeURIComponent(details.slice(0, 1500)) + '&location=' + encodeURIComponent(it.location || '');
  }
  function icsText(it) {
    const e = (v) => String(v || '').replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
    const d = it.date.replace(/-/g, '');
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//AgendaKu//EN', 'BEGIN:VEVENT', 'UID:' + it.id + '@agendaku', 'DTSTAMP:' + stamp];
    if (it.start) {
      const end = it.end || pad(Math.min(23, Number(it.start.slice(0, 2)) + 1)) + ':' + it.start.slice(3);
      out.push('DTSTART:' + d + 'T' + it.start.replace(':', '') + '00', 'DTEND:' + d + 'T' + end.replace(':', '') + '00');
    } else out.push('DTSTART;VALUE=DATE:' + d, 'DTEND;VALUE=DATE:' + addDays(it.date, 1).replace(/-/g, ''));
    out.push('SUMMARY:' + e(it.title));
    if (it.location) out.push('LOCATION:' + e(it.location));
    const desc = [bringList(it).length ? t('bring') + ': ' + bringList(it).join(', ') : '', it.notes].filter(Boolean).join('\n');
    if (desc) out.push('DESCRIPTION:' + e(desc));
    if (safeUrl(it.link)) out.push('URL:' + safeUrl(it.link));
    out.push('END:VEVENT', 'END:VCALENDAR');
    return out.join('\r\n');
  }
  /** Hands a file to the phone: share sheet when available, otherwise a normal download. */
  async function saveFile(name, mime, text) {
    const blob = new Blob([text], { type: mime });
    try {
      const file = new File([blob], name, { type: mime });
      if (/iphone|ipad|ipod|android/i.test(navigator.userAgent) && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: name });
        return true;
      }
    } catch (err) { if (err && err.name === 'AbortError') return false; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    return true;
  }

  // ----- Agenda detail -----
  function openDetail(id) {
    const it = S.agenda.find((x) => x.id === id);
    if (!it) return;
    const url = safeUrl(it.link);
    const items = bringList(it);
    const packed = S.packed[id] || [];
    const isMeet = /zoom\.us|meet\.google|teams\./i.test(url);
    const rel = relDay(it.date);
    openSheet({ type: 'detail', id: id }, `
      ${sheetHead(`<span class="pill cat" style="--p:${CAT_COLOR[it.category]}">${t('cat_' + it.category)}</span> <span class="pill" style="--p:${ST_COLOR[it.status]}">${t('st_' + it.status)}</span>`,
        `<button class="icon-btn" data-act="shareOne" data-id="${esc(id)}" aria-label="${t('share')}">${icon('share')}</button>
         <button class="icon-btn" data-act="editAgenda" data-id="${esc(id)}" aria-label="${t('edit')}">${icon('edit')}</button>
         <button class="icon-btn danger" data-act="askDelete" data-id="${esc(id)}" aria-label="${t('delete')}">${icon('trash')}</button>`)}
      <h1 class="d-title">${esc(it.title)}</h1>
      <div class="d-rows">
        <div>${icon('list')}<span>${fmtDate(it.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}${rel ? ` <em class="rel">${rel}</em>` : ''}</span></div>
        <div>${icon('clock')}<span>${fmtTime(it)}</span></div>
        ${it.location ? `<div>${icon('pin')}<span>${esc(it.location)}</span></div>` : ''}
        ${it.eventId && S.settings.calendarSync ? `<div class="muted">${icon('cal')}<span>${t('inCalendar')}</span></div>` : ''}
      </div>
      ${url ? `<div class="row"><a class="btn primary grow big" href="${esc(url)}" target="_blank" rel="noopener">${icon(isMeet ? 'phone' : 'out')}${isMeet ? t('joinMeeting') : t('openLink')}</a>
        <button class="btn soft big" data-act="copyLink" data-v="${esc(url)}" aria-label="${t('copyLink')}">${icon('copy')}</button></div>
        <p class="url">${esc(url)}</p>` : ''}
      ${S.local || S.demo ? `<div class="row cal-add"><a class="btn soft grow" href="${esc(gcalUrl(it))}" target="_blank" rel="noopener">${icon('cal')}${t('addGcal')}</a>
        <button class="btn soft" data-act="ics" data-id="${esc(id)}" aria-label="${t('addIcs')}">${icon('out')}.ics</button></div>` : ''}
      ${items.length ? `<div class="d-block"><div class="sec-head sub"><h3>${icon('bag')}${t('bring')}</h3><span class="muted" id="packed-count">${t('packed', { a: packed.filter((p) => items.indexOf(p) >= 0).length, b: items.length })}</span></div>
        ${items.map((b) => `<label class="check"><input type="checkbox" data-ch="pack" data-id="${esc(id)}" data-v="${esc(b)}" ${packed.indexOf(b) >= 0 ? 'checked' : ''}><i>${icon('check')}</i><span>${esc(b)}</span></label>`).join('')}</div>` : ''}
      ${it.notes ? `<div class="d-block"><div class="sec-head sub"><h3>${icon('note')}${t('notes')}</h3></div><p class="d-notes">${linkify(it.notes)}</p></div>`
        : `<button class="btn soft block" data-act="editAgenda" data-id="${esc(id)}" data-focus="notes">${icon('edit')}${t('addNotes')}</button>`}
      ${it.followUp ? `<div class="d-block follow ${it.followDone ? 'done' : ''}"><div class="sec-head sub"><h3>${icon('flag')}${it.followDone ? t('followDone') : t('followOpen')}</h3></div>
        ${it.followNote ? `<p>${esc(it.followNote)}</p>` : ''}
        ${it.followDone ? '' : `<button class="btn soft block" data-act="followDone" data-id="${esc(id)}">${icon('check')}${t('followMark')}</button>`}</div>` : ''}
      ${it.source ? `<details class="source"><summary>${t('showSource')}</summary><p>${linkify(it.source)}</p></details>` : ''}
      <div class="d-block"><div class="sec-head sub"><h3>${t('markAs')}</h3></div>
        <div class="status-grid">
          ${[['Done', 'check'], ['Postponed', 'clock'], ['Cancelled', 'x'], ['Scheduled', 'list']].filter((s) => s[0] !== it.status).map((s) => `<button class="btn soft" data-act="quickStatus" data-id="${esc(id)}" data-v="${s[0]}" style="--p:${ST_COLOR[s[0]]}">${icon(s[1])}${t('st_' + s[0])}</button>`).join('')}
          <button class="btn soft" data-act="reschedule" data-id="${esc(id)}">${icon('refresh')}${t('reschedule')}</button>
        </div></div>`);
  }

  // ----- Notes form -----
  function openNoteForm(note) {
    const isNew = !note;
    const n = note || { id: '', topic: S.noteFilter.topic !== 'all' ? S.noteFilter.topic : '', title: '', content: '', date: todayStr(), pinned: false };
    // topic suggestions: the user's own topics first, then the built-in list
    const defaults = t('topicDefaults').split(',');
    const own = [];
    S.notes.forEach((x) => { if (x.topic && defaults.indexOf(x.topic) < 0 && own.indexOf(x.topic) < 0) own.push(x.topic); });
    const topics = own.sort().concat(defaults);
    openSheet({ type: 'note', id: n.id }, `
      ${sheetHead(isNew ? t('newNote') : t('editNote'), isNew ? '' : `<button class="icon-btn danger" data-act="askDeleteNote" data-id="${esc(n.id)}" aria-label="${t('delete')}">${icon('trash')}</button>`)}
      <form data-form="note" novalidate>
        <div class="field"><label for="n-topic">${t('topic')}</label><input id="n-topic" list="topic-list" maxlength="60" placeholder="${t('topicPh')}" value="${esc(n.topic)}" autocomplete="off">
          <datalist id="topic-list">${topics.map((x) => `<option value="${esc(x)}">`).join('')}</datalist>
          <div class="chips mini-chips" id="topic-chips">${topics.map((x) => `<button type="button" class="chip ${n.topic === x ? 'on' : ''}" data-act="setTopic" data-v="${esc(x)}">${esc(x)}</button>`).join('')}</div></div>
        <div class="field" id="nw-title"><label for="n-title">${t('noteTitle')} <em>*</em></label><input id="n-title" maxlength="200" placeholder="${t('noteTitlePh')}" value="${esc(n.title)}" autocomplete="off"><p class="err"></p></div>
        <div class="field"><label for="n-content">${t('content')}</label><textarea id="n-content" rows="5" placeholder="${t('contentPh')}">${esc(n.content)}</textarea></div>
        <div class="field"><label for="n-date">${t('date')}</label><input id="n-date" type="date" value="${esc(n.date || todayStr())}"></div>
        <label class="switch"><input type="checkbox" id="n-pinned" ${n.pinned ? 'checked' : ''}><i></i><span>${t('pin')}</span></label>
        <div class="sheet-foot"><button type="button" class="btn ghost" data-act="closeSheet">${t('cancel')}</button>
          <button class="btn primary grow big">${icon('check')}${t('save')}</button></div>
      </form>`);
  }
  function submitNoteForm() {
    const title = $('#n-title').value.trim();
    setFieldError('nw-title', title ? '' : t('errNoteTitle'));
    if (!title) { $('#n-title').focus(); return; }
    const old = S.notes.find((x) => x.id === sheet.id) || {};
    const item = Object.assign({}, old, { id: old.id || uid('N'), topic: $('#n-topic').value.trim(), title: title, content: $('#n-content').value.trim(),
      date: $('#n-date').value || todayStr(), pinned: $('#n-pinned').checked, created: old.created || nowStamp(), updated: nowStamp() });
    const i = S.notes.findIndex((x) => x.id === item.id);
    if (i >= 0) S.notes[i] = item; else S.notes.push(item);
    persist(); closeSheet(); renderView();
    enqueue('saveNote', { item: item }, 'save');
  }

  // ----- Settings -----
  let installEvt = null;
  function openSettings() {
    const s = S.settings;
    const rems = [0, 10, 15, 30, 60, 120, 1440];
    const remLabel = (m) => (m === 0 ? t('rem0') : m === 1440 ? t('remDay') : m >= 60 ? t('remHour', { n: m / 60 }) : t('remMin', { n: m }));
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    openSheet({ type: 'settings' }, `
      ${sheetHead(t('settingsTitle'))}
      <div class="profile-card">
        <button class="av-edit" data-act="pickPhoto" aria-label="${t('changePhoto')}">${avatar(84)}<span class="av-cam">${icon('edit')}</span></button>
        <div class="pc-body"><strong id="pc-name">${esc(s.name || t('hiNoName'))}</strong><small id="pc-bio">${esc(S.profile.bio || t('bioEmpty'))}</small>
          <div class="row"><button class="btn soft sm" data-act="pickPhoto">${t('changePhoto')}</button>
          ${S.profile.photo ? `<button class="btn ghost sm" data-act="removePhoto">${t('removePhoto')}</button>` : ''}</div></div>
      </div>
      <input type="file" id="photo-file" accept="image/*" hidden data-ch="photoFile">
      ${S.profile.photo ? '' : `<div class="swatches" role="group" aria-label="${t('avatarColor')}">${AV_COLORS.map((c, i) => `<button data-act="avColor" data-i="${i}" class="${(Number(S.profile.color) || 0) === i ? 'on' : ''}" style="background:${c[0]};color:${c[1]}" aria-label="${t('avatarColor')} ${i + 1}">${icon('check')}</button>`).join('')}</div>`}
      <div class="field"><label for="s-name">${t('yourName')}</label><input id="s-name" maxlength="40" placeholder="${t('namePh')}" value="${esc(s.name)}" data-ch="setName" autocomplete="off"></div>
      <div class="field"><label for="s-bio">${t('bio')}</label><input id="s-bio" maxlength="80" placeholder="${t('bioPh')}" value="${esc(S.profile.bio)}" data-ch="setBio" autocomplete="off">
        <p class="hint">${t('profileNote')}</p></div>
      <div class="field"><label>${t('language')}</label><div class="seg"><button data-act="lang" data-lang="en" class="${S.lang === 'en' ? 'on' : ''}">English</button><button data-act="lang" data-lang="id" class="${S.lang === 'id' ? 'on' : ''}">Bahasa Indonesia</button></div></div>
      ${S.local ? '' : `<label class="switch"><input type="checkbox" ${s.calendarSync ? 'checked' : ''} data-ch="setCal"><i></i><span>${t('calSync')}<small>${t('calSyncSub')}</small></span></label>
      <div class="field"><label for="s-rem">${t('reminder')}</label><select id="s-rem" data-ch="setRem">${rems.map((m) => `<option value="${m}" ${Number(s.reminderMinutes) === m ? 'selected' : ''}>${remLabel(m)}</option>`).join('')}</select></div>`}
      ${S.demo ? '' : `<label class="switch"><input type="checkbox" ${S.lockOnOpen ? 'checked' : ''} data-ch="setLock"><i></i><span>${t('lockOnOpen')}</span></label>`}
      <div class="menu">
        ${S.demo ? '' : `<button data-act="changePin">${icon('lock')}<span>${t('changePin')}</span>${icon('right', 'chev')}</button>`}
        ${S.local ? `<button data-act="exportBackup">${icon('copy')}<span>${t('exportBackup')}</span>${icon('right', 'chev')}</button>
        <button data-act="importBackup">${icon('refresh')}<span>${t('importBackup')}</span>${icon('right', 'chev')}</button>
        <button data-act="exportCsv">${icon('sheet')}<span>${t('exportCsv')}</span>${icon('right', 'chev')}</button>`
        : `<button data-act="syncNow">${icon('refresh')}<span>${t('syncNow')}</span>${icon('right', 'chev')}</button>`}
        <button data-act="importList">${icon('up')}<span>${t('importList')}</span>${icon('right', 'chev')}</button>
        ${S.sheetUrl ? `<a href="${esc(S.sheetUrl)}" target="_blank" rel="noopener">${icon('sheet')}<span>${t('openSheet')}</span>${icon('out', 'chev')}</a>` : ''}
        ${installEvt ? `<button data-act="install">${icon('phone')}<span>${t('install')}</span>${icon('right', 'chev')}</button>` : ''}
      </div>
      ${S.local ? `<input type="file" id="import-file" accept=".json,application/json" hidden data-ch="importFile"><p class="hint">${icon('phone')} ${t('localNote')}</p>` : ''}
      ${installEvt ? '' : `<p class="hint">${icon('phone')} ${ios ? t('installIos') : t('installAndroid')}</p>`}
      <button class="btn ghost block danger" data-act="${S.demo ? 'exitDemo' : S.local ? 'askErase' : 'askDisconnect'}">${icon(S.local ? 'trash' : 'logout')}${S.demo ? t('exitDemo') : S.local ? t('eraseAll') : t('disconnect')}</button>
      <p class="muted center small">AgendaKu · ${t('version')} ${VERSION}<br>${CREDIT}</p>`);
  }
  function saveSettings(patch) {
    Object.assign(S.settings, patch); persist(); renderView();
    enqueue('saveSettings', { settings: patch }, 'settings');
  }

  // ----- Share agendas as a WhatsApp message -----
  let shareOpt = null;
  function shareItems(o) {
    if (o.id) return S.agenda.filter((x) => x.id === o.id);
    return S.agenda.filter((x) => x.date === o.date && (o.cat === 'all' || x.category === o.cat) && (o.cancelled || x.status !== 'Cancelled')).sort(byWhen);
  }
  /** Builds the message. WhatsApp shows *text* in bold and _text_ in italics, and makes plain links tappable. */
  function shareText(o) {
    const items = shareItems(o);
    const clean = (v) => String(v || '').replace(/\s+/g, ' ').trim();
    const L = [];
    if (o.opening.trim()) L.push(o.opening.trim(), '');
    const day = fmtDate(o.id ? items[0].date : o.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    L.push(o.id ? '*' + clean(items[0].title) + '*' : '*' + t('shareHead', { date: day }) + '*');
    if (o.id) L.push('🗓️ ' + day);
    else if (o.cat !== 'all') L.push('_' + t('category') + ': ' + t('cat_' + o.cat) + '_');
    L.push('');
    if (!items.length) L.push('_' + t('shareNone') + '_');
    items.forEach((it, i) => {
      if (!o.id) L.push('*' + (i + 1) + '. ' + clean(it.title) + '*');
      L.push('🕘 ' + (it.start ? it.start + (it.end ? '–' + it.end : '') : t('allDay')) + (it.status !== 'Scheduled' ? '  ·  ' + t('st_' + it.status) : ''));
      if (o.cat === 'all' && !o.id) L.push('🏷️ ' + t('cat_' + it.category));
      if (it.location) L.push('📍 ' + clean(it.location));
      const url = safeUrl(it.link);
      if (url) L.push('🔗 ' + url);
      if (o.bring && bringList(it).length) L.push('🎒 ' + t('shareBring') + ': ' + bringList(it).join(', '));
      if (o.notes && String(it.notes || '').trim()) {
        String(it.notes).trim().split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 6).forEach((x, k) => L.push((k ? '      ' : '📝 ') + x));
      }
      L.push('');
    });
    if (!o.id && items.length) L.push('_' + t('agendasCount', { n: items.length }) + '_');
    return L.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  function openShare(o) {
    const saved = store.get('ak_share', {});
    shareOpt = Object.assign({ date: todayStr(), cat: 'all', notes: saved.notes !== false, bring: saved.bring !== false, cancelled: false,
      opening: saved.opening || '', id: '' }, o || {});
    const single = !!shareOpt.id;
    const chip = (v, label, color) => `<button type="button" class="chip ${shareOpt.cat === v ? 'on' : ''}" data-act="shareCat" data-v="${v}" ${color ? `style="--c:${color}"` : ''}>${color ? '<u></u>' : ''}${label}</button>`;
    const td = todayStr(), tm = addDays(td, 1);
    openSheet({ type: 'share' }, `
      ${sheetHead(single ? t('shareOneTitle') : t('shareTitle'))}
      ${single ? '' : `<div class="field"><label>${t('date')}</label>
        <div class="row"><div class="seg small" style="flex:none">
          <button type="button" data-act="shareDate" data-date="${td}" class="${shareOpt.date === td ? 'on' : ''}">${t('today')}</button>
          <button type="button" data-act="shareDate" data-date="${tm}" class="${shareOpt.date === tm ? 'on' : ''}">${t('tomorrow')}</button></div>
          <input type="date" id="sh-date" value="${esc(shareOpt.date)}" data-ch="shareDateInput" style="flex:1"></div></div>
      <div class="field"><label>${t('category')}</label><div class="chips pick" id="sh-cats">${chip('all', t('all'))}${CATS.map((c) => chip(c, t('cat_' + c), CAT_COLOR[c])).join('')}</div></div>`}
      <div class="field"><label for="sh-open">${t('shareOpening')} <span class="muted">(${t('optional')})</span></label>
        <input id="sh-open" maxlength="160" placeholder="${t('shareOpeningPh')}" value="${esc(shareOpt.opening)}" data-in="shareOpening" autocomplete="off"></div>
      <div class="sh-toggles">
        <label class="switch"><input type="checkbox" data-ch="shareToggle" data-k="bring" ${shareOpt.bring ? 'checked' : ''}><i></i><span>${t('shareIncBring')}</span></label>
        <label class="switch"><input type="checkbox" data-ch="shareToggle" data-k="notes" ${shareOpt.notes ? 'checked' : ''}><i></i><span>${t('shareIncNotes')}</span></label>
        ${single ? '' : `<label class="switch"><input type="checkbox" data-ch="shareToggle" data-k="cancelled" ${shareOpt.cancelled ? 'checked' : ''}><i></i><span>${t('shareIncCancelled')}</span></label>`}
      </div>
      <div class="field"><label>${t('sharePreview')}</label><div class="wa-preview" id="sh-preview"></div></div>
      <div class="sheet-foot">
        <button type="button" class="btn ghost" data-act="shareCopy" aria-label="${t('copyText')}">${icon('copy')}${t('copyText')}</button>
        <a class="btn wa grow big" id="sh-wa" href="#" target="_blank" rel="noopener" data-act="shareWa">${icon('wa')}${t('shareWa')}</a>
      </div>
      ${navigator.share ? `<button class="btn link block" data-act="shareOther">${icon('share')}${t('shareOther')}</button>` : ''}`);
    renderSharePreview();
  }
  /** Shows the message as WhatsApp will: *bold* and _italic_ rendered, links underlined. */
  function renderSharePreview() {
    if (!shareOpt) return;
    const text = shareText(shareOpt);
    const html = esc(text)
      .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?:]|$)/gm, '$1<b>$2</b>')
      .replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,!?:]|$)/gm, '$1<i>$2</i>')
      .replace(/(https?:\/\/[^\s<]+)/g, '<u>$1</u>');
    const box = $('#sh-preview'); if (box) box.innerHTML = '<div class="bubble">' + html + '</div>';
    const wa = $('#sh-wa'); if (wa) wa.href = 'https://wa.me/?text=' + encodeURIComponent(text);
    const n = shareItems(shareOpt).length;
    if (wa) wa.classList.toggle('disabled', !n);
    saveShareOpt();   // remember the opening line and switches for next time
  }
  function saveShareOpt() { store.set('ak_share', { notes: shareOpt.notes, bring: shareOpt.bring, opening: shareOpt.opening }); }

  // ----- Import a list of agendas (CSV text or file) -----
  let importDraft = [];
  function openImport() {
    importDraft = [];
    openSheet({ type: 'import' }, `
      ${sheetHead(t('importList'))}
      <p class="muted">${t('importHelp')}</p>
      <div class="field" style="margin-top:12px"><textarea id="imp-text" rows="7" spellcheck="false" autocapitalize="off" placeholder="Date,Start,End,Category,Title,Location,Link,Bring,Status,Notes"></textarea></div>
      <div class="row"><button class="btn soft grow" data-act="impPaste">${icon('paste')}${t('pasteBtn')}</button>
        <button class="btn soft grow" data-act="impFile">${icon('up')}${t('chooseFile')}</button></div>
      <input type="file" id="imp-file" accept=".csv,.txt,text/csv,text/plain" hidden data-ch="impFile">
      <button class="btn primary block big" style="margin-top:12px" data-act="impCheck">${t('impCheck')}</button>
      <div id="imp-result"></div>`);
  }
  function parseTable(text) {
    text = String(text || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n').trim();
    const first = text.split('\n')[0] || '';
    const n = (re) => (first.match(re) || []).length;
    const delim = n(/\t/g) >= 2 ? '\t' : n(/;/g) > n(/,/g) ? ';' : ',';
    const rows = []; let row = [], cur = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else quoted = false; } else cur += ch; }
      else if (ch === '"' && cur === '') quoted = true;
      else if (ch === delim) { row.push(cur); cur = ''; }
      else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else cur += ch;
    }
    row.push(cur); rows.push(row);
    return rows.filter((r) => r.some((c) => c.trim()));
  }
  function readImport(text) {
    const rows = parseTable(text);
    const NAMES = { date: ['date', 'tanggal', 'tgl'], start: ['start', 'mulai', 'jam', 'time', 'waktu'], end: ['end', 'selesai'],
      category: ['category', 'kategori'], title: ['title', 'agenda', 'nama', 'judul', 'kegiatan', 'name', 'nama agenda'],
      location: ['location', 'tempat', 'lokasi', 'place'], link: ['link', 'url', 'tautan'], bring: ['bring', 'bawa', 'barang', 'barang bawaan'],
      status: ['status'], notes: ['notes', 'note', 'catatan', 'keterangan'], followUp: ['follow-up', 'followup', 'tindak lanjut'],
      followNote: ['follow-up note', 'followup note', 'catatan tindak lanjut'] };
    const col = {};
    (rows[0] || []).forEach((h, i) => { const k = h.trim().toLowerCase(); Object.keys(NAMES).forEach((f) => { if (col[f] === undefined && NAMES[f].indexOf(k) >= 0) col[f] = i; }); });
    if (col.date === undefined || col.title === undefined) return { error: true };
    const catMap = { work: 'Work', pekerjaan: 'Work', kerja: 'Work', kantor: 'Work', family: 'Family', keluarga: 'Family', school: 'School', sekolah: 'School', personal: 'Personal', pribadi: 'Personal' };
    const stMap = { scheduled: 'Scheduled', terjadwal: 'Scheduled', done: 'Done', selesai: 'Done', postponed: 'Postponed', tunda: 'Postponed', ditunda: 'Postponed', cancelled: 'Cancelled', canceled: 'Cancelled', batal: 'Cancelled', other: 'Other', lainnya: 'Other' };
    const have = {}; S.agenda.forEach((x) => { have[(x.title + '|' + x.date + '|' + (x.start || '')).toLowerCase()] = 1; });
    const items = []; let dup = 0, bad = 0;
    rows.slice(1).forEach((r) => {
      const v = (f) => { let x = col[f] === undefined ? '' : String(r[col[f]] || '').trim(); if (/^'[=+\-@]/.test(x)) x = x.slice(1); return x; };
      const title = v('title');
      let date = v('date');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) date = window.AKParser.findDate(date, new Date(), true);
      if (!title || !date) { bad++; return; }
      const ts = window.AKParser.findTime(v('start'), true), te = window.AKParser.findTime(v('end'), true);
      const start = ts ? ts.start : '', end = start ? (te ? te.start : (ts && ts.end) || '') : '';
      const key = (title + '|' + date + '|' + start).toLowerCase();
      if (have[key]) { dup++; return; }
      have[key] = 1;
      const fu = /^(true|yes|ya|1|x)$/i.test(v('followUp'));
      items.push({ id: uid('A'), date: date, start: start, end: end && end > start ? end : '', category: catMap[v('category').toLowerCase()] || 'Other', title: title.slice(0, 200),
        location: v('location'), link: safeUrl(v('link')), bring: v('bring'), status: stMap[v('status').toLowerCase()] || 'Scheduled', notes: v('notes'),
        followUp: fu, followNote: v('followNote'), followDone: false, source: '', eventId: '', created: nowStamp(), updated: nowStamp() });
    });
    return { items: items, dup: dup, bad: bad };
  }
  function checkImport() {
    const out = $('#imp-result'), r = readImport($('#imp-text').value);
    importDraft = [];
    if (r.error) { out.innerHTML = `<p class="hint bad">${t('impNoHeader')}</p>`; return; }
    importDraft = r.items;
    const preview = r.items.slice(0, 4).map((x) => `<div class="ins-row"><div><strong>${esc(x.title)}</strong><small>${fmtDate(x.date)}${x.start ? ' · ' + x.start : ''} · ${t('cat_' + x.category)}</small></div></div>`).join('');
    out.innerHTML = `<div class="card" style="margin-top:14px"><div class="sec-head"><h2>${t('impFound', { n: r.items.length })}</h2></div>
      ${r.dup ? `<p class="muted">${t('impDup', { n: r.dup })}</p>` : ''}${r.bad ? `<p class="muted">${t('impBad', { n: r.bad })}</p>` : ''}
      ${preview}${r.items.length > 4 ? `<p class="muted pad">+ ${r.items.length - 4} …</p>` : ''}</div>
      ${r.items.length ? `<button class="btn primary block big" style="margin-top:12px" data-act="impRun">${icon('check')}${t('impRun', { n: r.items.length })}</button>` : ''}`;
    out.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  function saveProfile() { store.set('ak_profile', S.profile); }

  // ----- Dialogs -----
  const dlgWrap = $('#dialog-wrap'), dlg = $('#dialog');
  let dlgOk = null;
  function openDialog(html, onOk) { dlg.innerHTML = html; dlgOk = onOk; dlgWrap.hidden = false; requestAnimationFrame(() => dlgWrap.classList.add('open')); }
  function closeDialog() { dlgWrap.classList.remove('open'); dlgOk = null; setTimeout(() => { if (!dlgWrap.classList.contains('open')) dlgWrap.hidden = true; }, 200); }
  function confirmBox(title, body, okText, onOk, danger) {
    openDialog(`<h2>${title}</h2><p>${body}</p><div class="row"><button class="btn ghost grow" data-act="dlgCancel">${t('cancel')}</button>
      <button class="btn ${danger ? 'dangerfill' : 'primary'} grow" data-act="dlgOk">${okText}</button></div>`, onOk);
  }
  function openReschedule(id) {
    const it = S.agenda.find((x) => x.id === id); if (!it) return;
    openDialog(`<h2>${t('rescheduleTitle')}</h2><p class="muted">${esc(it.title)}</p>
      <div class="field"><label for="r-date">${t('newDate')}</label><input id="r-date" type="date" value="${esc(it.date)}"></div>
      <div class="grid2"><div class="field"><label for="r-start">${t('start')}</label><input id="r-start" type="time" value="${esc(it.start)}"></div>
      <div class="field"><label for="r-end">${t('end')}</label><input id="r-end" type="time" value="${esc(it.end)}"></div></div>
      <p class="err" id="r-err"></p>
      <div class="row"><button class="btn ghost grow" data-act="dlgCancel">${t('cancel')}</button><button class="btn primary grow" data-act="dlgOk">${t('save')}</button></div>`,
    () => {
      const d = $('#r-date').value, s = $('#r-start').value, e = $('#r-end').value;
      if (!d) { $('#r-err').textContent = t('errDate'); return false; }
      if (s && e && e <= s) { $('#r-err').textContent = t('errEnd'); return false; }
      const stamp = t('rescheduledFrom', { date: fmtDate(it.date) + (it.start ? ' ' + it.start : '') });
      const changed = d !== it.date || s !== it.start;
      saveAgenda(Object.assign({}, it, { date: d, start: s, end: s ? e : '', status: 'Scheduled',
        notes: changed ? (it.notes ? it.notes + '\n' : '') + '[' + stamp + ']' : it.notes, updated: nowStamp() }));
      if (sheet && sheet.type === 'detail') openDetail(id);
    });
  }

  // ----- Toast -----
  let toastTimer = null;
  function toast(msg, type) {
    const el = $('#toast');
    el.className = 'toast show ' + (type || 'info');
    el.innerHTML = icon(type === 'success' ? 'check' : type === 'error' ? 'x' : 'cloud') + `<span>${esc(msg)}</span>`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.classList.remove('show'); }, type === 'error' ? 5000 : 2800);
  }

  /* ============ 8. ACTIONS & START-UP ============ */

  const A = {
    lang(el) { S.lang = el.dataset.lang; store.set('ak_lang', S.lang); document.documentElement.lang = S.lang;
      if (!gate.hidden) { ({ connect: showConnect, welcome: showWelcome, invite: showInvite }[pin.mode] || renderPin)(); return; }
      render(); if (sheet && sheet.type === 'settings') openSettings(); },
    demo() { S.local = false; S.demo = true; store.set('ak_demo', true); S.loaded = false; S.agenda = []; S.notes = []; enterApp(); },
    exitDemo() { ['ak_demo', 'ak_demo_db', 'ak_agenda', 'ak_notes', 'ak_outbox', 'ak_loaded', 'ak_settings'].forEach(store.del); location.reload(); },
    async pasteUrl() { try { const v = await navigator.clipboard.readText(); if (v) $('#api-url').value = v.trim(); } catch (e) { $('#api-url').focus(); } },
    digit(el) { if (pin.busy || pin.buf.length >= 4) return;
      if (S.local && pin.mode === 'unlock' && Date.now() < store.get('ak_lockuntil', 0)) { pinFail(t('pinLockedLocal')); return; }
      pin.buf += el.dataset.d; if (pin.msg) { pin.msg = ''; $('#pin-msg').textContent = ''; } pinDots(); if (pin.buf.length === 4) setTimeout(submitPin, 140); },
    pinDel() { if (pin.busy) return; pin.buf = pin.buf.slice(0, -1); pinDots(); },
    pinBack() {
      if (pin.mode === 'change') enterApp();
      else if (pin.mode === 'create') { S.local = false; store.del('ak_local'); showWelcome(); }
      else showPin(S.local || (S.token && S.pinHash) ? 'unlock' : 'login');
    },
    welcome() { showWelcome(); },
    chooseSheet() { showConnect(); },
    chooseLocal() { S.local = true; store.set('ak_local', true); S.agenda = []; S.notes = []; S.loaded = false; S.settings = { name: '', calendarSync: false, reminderMinutes: 0 }; showPin('create'); },
    recDone() { enterApp(); },
    pickPhoto() { const f = $('#photo-file'); if (f) f.click(); },
    removePhoto() { S.profile.photo = ''; saveProfile(); render(); openSettings(); },
    avColor(el) { S.profile.color = Number(el.dataset.i) || 0; saveProfile(); render(); openSettings(); },
    importList() { openImport(); },
    shareDay(el) { openShare({ date: el.dataset.date || todayStr() }); },
    shareOne(el) { openShare({ id: el.dataset.id }); },
    shareCat(el) { shareOpt.cat = el.dataset.v; $$('#sh-cats .chip').forEach((c) => c.classList.toggle('on', c === el)); renderSharePreview(); },
    shareDate(el) { shareOpt.date = el.dataset.date; $('#sh-date').value = shareOpt.date; $$('.seg [data-act="shareDate"]').forEach((b) => b.classList.toggle('on', b === el)); renderSharePreview(); },
    shareWa(el, e) {
      if (!shareItems(shareOpt).length) { e.preventDefault(); toast(t('shareNone'), 'info'); return; }
      saveShareOpt();
    },
    async shareCopy() {
      const text = shareText(shareOpt); saveShareOpt();
      try { await navigator.clipboard.writeText(text); toast(t('copied'), 'success'); }
      catch (err) { toast(t('copyFailed'), 'error'); }
    },
    async shareOther() {
      saveShareOpt();
      try { await navigator.share({ text: shareText(shareOpt) }); } catch (err) { /* cancelled */ }
    },
    async impPaste() { try { const v = await navigator.clipboard.readText(); if (v) { $('#imp-text').value = v; checkImport(); return; } } catch (e) { /* fall through */ } $('#imp-text').focus(); },
    impFile() { const f = $('#imp-file'); if (f) f.click(); },
    impCheck() { checkImport(); },
    impRun() {
      const list = importDraft; importDraft = [];
      if (!list.length) return;
      list.forEach((item) => { S.agenda.push(item); S.outbox.push({ action: 'saveAgenda', payload: { item: item }, kind: 'bulk' }); });
      persist(); closeSheet(); S.view = 'agenda'; A.clearFilter(null, true); render();
      toast(t('importing', { n: list.length }), 'info');
      flush();
    },
    askErase() {
      confirmBox(t('eraseQ'), t('eraseSub'), t('delete'), () => {
        ['ak_local', 'ak_local_db', 'ak_pinhash', 'ak_rechash', 'ak_agenda', 'ak_notes', 'ak_outbox', 'ak_loaded', 'ak_settings', 'ak_packed', 'ak_backup', 'ak_lockuntil', 'ak_profile'].forEach((k) => store.del(k));
        setTimeout(() => location.reload(), 300);
      }, true);
    },
    async exportBackup() {
      const data = { app: 'AgendaKu', version: VERSION, exportedAt: new Date().toISOString(), settings: S.settings, profile: S.profile, agenda: S.agenda, notes: S.notes };
      const ok = await saveFile('agendaku-backup-' + todayStr() + '.json', 'application/json', JSON.stringify(data, null, 1));
      if (ok) { S.lastBackup = Date.now(); store.set('ak_backup', S.lastBackup); toast(t('backupDone'), 'success'); renderView(); }
    },
    importBackup() { const f = $('#import-file'); if (f) f.click(); },
    async exportCsv() {
      const cell = (v) => { let x = String(v == null ? '' : v); if (/^[=+\-@]/.test(x)) x = "'" + x; return '"' + x.replace(/"/g, '""') + '"'; };
      const rows = [['Date', 'Start', 'End', 'Category', 'Title', 'Location', 'Link', 'Bring', 'Status', 'Notes', 'Follow-up', 'Follow-up Note', 'Follow-up Done']];
      S.agenda.slice().sort(byWhen).forEach((x) => rows.push([x.date, x.start, x.end, x.category, x.title, x.location, x.link, x.bring, x.status, x.notes, x.followUp ? 'TRUE' : 'FALSE', x.followNote, x.followDone ? 'TRUE' : 'FALSE']));
      await saveFile('agendaku-agenda-' + todayStr() + '.csv', 'text/csv', '\ufeff' + rows.map((r) => r.map(cell).join(',')).join('\r\n'));
    },
    async ics(el) { const it = S.agenda.find((x) => x.id === el.dataset.id); if (it) await saveFile('agenda-' + it.date + '.ics', 'text/calendar', icsText(it)); },
    forgot() { showPin('reset'); },
    async sendCode() {
      pin.busy = true; pin.msg = ''; renderPin();
      try { const r = await api('forgot'); pin.email = r.email; pin.step = 'code'; pin.busy = false; renderPin(); }
      catch (e) { pin.busy = false; pin.msg = pinError(e); renderPin(); }
    },
    go(el) { S.view = el.dataset.view; if (S.view === 'agenda' && el.closest('.hero')) A.clearFilter(null, true); render(); },
    add() { openAgendaForm(null, { paste: false, date: S.view === 'home' && S.selDate ? S.selDate : '' }); },
    addOn(el) { openAgendaForm(null, { date: el.dataset.date }); },
    settings() { openSettings(); },
    syncNow() { if (S.outbox.length) flush(); else pull(false); },
    closeSheet() { closeSheet(); },
    tileToday() { const td = todayStr(); S.filter = Object.assign(S.filter, { q: '', cat: 'all', status: 'all', from: td, to: td, open: true }); S.view = 'agenda'; render(); },
    tileWeek() { const ws = weekStart(todayStr()); S.filter = Object.assign(S.filter, { q: '', cat: 'all', status: 'all', from: ws, to: addDays(ws, 6), open: true }); S.view = 'agenda'; render(); },
    tileDone() { const td = todayStr(); S.filter = Object.assign(S.filter, { q: '', cat: 'all', status: 'Done', from: td.slice(0, 8) + '01', to: ymd(new Date(+td.slice(0, 4), +td.slice(5, 7), 0)), open: true }); S.view = 'agenda'; render(); },
    pickDay(el) { S.selDate = S.selDate === el.dataset.date ? '' : el.dataset.date; $('#cal-card').innerHTML = calendarHtml(); },
    calNav(el) { const p = S.calMonth.split('-').map(Number); const d = new Date(p[0], p[1] - 1 + Number(el.dataset.n), 1); S.calMonth = ymd(d).slice(0, 7); $('#cal-card').innerHTML = calendarHtml(); },
    chartRange(el) { S.chartRange = Number(el.dataset.n); S.chartSel = -1; $('#chart-card').innerHTML = homeChartHtml(); },
    openAgenda(el) { openDetail(el.dataset.id); },
    editAgenda(el) { const it = S.agenda.find((x) => x.id === el.dataset.id); if (it) openAgendaForm(it, { focus: el.dataset.focus }); },
    fCat(el) { S.filter.cat = el.dataset.v; renderView(); },
    fScope(el) { S.filter.scope = el.dataset.v; renderView(); },
    toggleFilter() { S.filter.open = !S.filter.open; renderView(); },
    clearFilter(el, quiet) { S.filter = { q: '', cat: 'all', status: 'all', scope: 'upcoming', from: '', to: '', open: false }; if (!quiet) renderView(true); },
    pickCat(el) { $('#f-category').value = el.dataset.v; $$('#f-cats .chip').forEach((c) => c.classList.toggle('on', c === el)); },
    addBring() { addBringFromInput(); $('#f-bring').focus(); },
    rmBring(el) { draftBring.splice(Number(el.dataset.i), 1); renderBring(); },
    async pasteClip() {
      try { const v = await navigator.clipboard.readText(); if (v) { $('#paste-text').value = v; runAutoFill(); return; } } catch (e) { /* fall through */ }
      const m = $('#paste-msg'); m.textContent = t('pasteDenied'); m.className = 'hint'; $('#paste-text').focus();
    },
    autoFill() { runAutoFill(); },
    async copyLink(el) { try { await navigator.clipboard.writeText(el.dataset.v); toast(t('copied'), 'success'); } catch (e) { /* ignore */ } },
    quickStatus(el) {
      const it = S.agenda.find((x) => x.id === el.dataset.id); if (!it) return;
      saveAgenda(Object.assign({}, it, { status: el.dataset.v, updated: nowStamp() }));
      if (sheet && sheet.type === 'detail') openDetail(it.id);
    },
    followDone(el) {
      const it = S.agenda.find((x) => x.id === el.dataset.id); if (!it) return;
      saveAgenda(Object.assign({}, it, { followDone: true, updated: nowStamp() }));
      if (sheet && sheet.type === 'detail') openDetail(it.id);
    },
    reschedule(el) { openReschedule(el.dataset.id); },
    askDelete(el) {
      const it = S.agenda.find((x) => x.id === el.dataset.id); if (!it) return;
      confirmBox(t('deleteAgendaQ'), t('deleteAgendaSub', { title: esc(it.title) }), t('delete'), () => {
        S.agenda = S.agenda.filter((x) => x.id !== it.id); delete S.packed[it.id]; store.set('ak_packed', S.packed);
        persist(); closeSheet(); renderView(); enqueue('deleteAgenda', { id: it.id }, 'delete');
      }, true);
    },
    addNote() { openNoteForm(null); },
    openNote(el) { const n = S.notes.find((x) => x.id === el.dataset.id); if (n) openNoteForm(n); },
    nTopic(el) { S.noteFilter.topic = el.dataset.v; renderView(); },
    setTopic(el) { $('#n-topic').value = el.dataset.v; $$('#topic-chips .chip').forEach((c) => c.classList.toggle('on', c === el)); },
    askDeleteNote(el) {
      const n = S.notes.find((x) => x.id === el.dataset.id); if (!n) return;
      confirmBox(t('deleteNoteQ'), t('deleteNoteSub', { title: esc(n.title) }), t('delete'), () => {
        S.notes = S.notes.filter((x) => x.id !== n.id); persist(); closeSheet(); renderView(); enqueue('deleteNote', { id: n.id }, 'delete');
      }, true);
    },
    insPeriod(el) { S.insPeriod = el.dataset.v; renderView(); },
    changePin() { closeSheet(true); showPin('change'); },
    async install() { if (!installEvt) return; installEvt.prompt(); try { await installEvt.userChoice; } catch (e) { /* ignore */ } installEvt = null; closeSheet(); },
    askDisconnect() {
      confirmBox(t('disconnectQ'), t('disconnectSub'), t('disconnect'), () => {
        api('logout').catch(() => {});
        ['ak_api', 'ak_token', 'ak_pinhash', 'ak_agenda', 'ak_notes', 'ak_outbox', 'ak_loaded', 'ak_settings', 'ak_sheet', 'ak_packed', 'ak_profile'].forEach(store.del);
        setTimeout(() => location.reload(), 300);
      }, true);
    },
    dlgCancel() { closeDialog(); },
    dlgOk() { const fn = dlgOk; if (fn && fn() === false) return; closeDialog(); }
  };

  // change events (inputs, selects, switches)
  const C = {
    fFrom(el) { S.filter.from = el.value; renderView(); },
    fTo(el) { S.filter.to = el.value; renderView(); },
    fStatus(el) { S.filter.status = el.value; renderView(); },
    toggleFollow(el) { $('#fw-follow').hidden = !el.checked; if (el.checked) $('#f-follownote').focus(); },
    pack(el) {
      const id = el.dataset.id, list = S.packed[id] || [];
      const i = list.indexOf(el.dataset.v);
      if (el.checked && i < 0) list.push(el.dataset.v); if (!el.checked && i >= 0) list.splice(i, 1);
      S.packed[id] = list; store.set('ak_packed', S.packed);
      const it = S.agenda.find((x) => x.id === id), items = it ? bringList(it) : [];
      const c = $('#packed-count'); if (c) c.textContent = t('packed', { a: list.filter((p) => items.indexOf(p) >= 0).length, b: items.length });
    },
    setName(el) {
      const v = el.value.trim(); if (v === S.settings.name) return;
      saveSettings({ name: v }); render();
      const n = $('#pc-name'); if (n) n.textContent = v || t('hiNoName');
      const a = $('.av-edit .av'); if (a) a.outerHTML = avatar(84);
    },
    setBio(el) { S.profile.bio = el.value.trim().slice(0, 80); saveProfile(); const b = $('#pc-bio'); if (b) b.textContent = S.profile.bio || t('bioEmpty'); },
    photoFile(el) {
      const file = el.files && el.files[0];
      if (!file) return;
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        const side = Math.min(img.width, img.height), c = document.createElement('canvas');
        c.width = c.height = 256;
        c.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 256, 256);
        S.profile.photo = c.toDataURL('image/jpeg', 0.85);
        saveProfile(); URL.revokeObjectURL(url); render(); openSettings();
      };
      img.onerror = () => { URL.revokeObjectURL(url); toast(t('photoBad'), 'error'); };
      img.src = url; el.value = '';
    },
    impFile(el) {
      const file = el.files && el.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => { $('#imp-text').value = String(reader.result || ''); el.value = ''; checkImport(); };
      reader.readAsText(file);
    },
    setCal(el) { saveSettings({ calendarSync: el.checked }); },
    setRem(el) { saveSettings({ reminderMinutes: Number(el.value) }); },
    setLock(el) { S.lockOnOpen = el.checked; store.set('ak_lock', S.lockOnOpen); },
    shareToggle(el) { shareOpt[el.dataset.k] = el.checked; renderSharePreview(); },
    shareDateInput(el) { if (!el.value) return; shareOpt.date = el.value; $$('.seg [data-act="shareDate"]').forEach((b) => b.classList.toggle('on', b.dataset.date === el.value)); renderSharePreview(); },
    importFile(el) {
      const file = el.files && el.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        let d = null;
        try { d = JSON.parse(reader.result); } catch (e) { d = null; }
        el.value = '';
        if (!d || d.app !== 'AgendaKu' || !Array.isArray(d.agenda) || !Array.isArray(d.notes)) { toast(t('importBad'), 'error'); return; }
        const agenda = d.agenda.filter((x) => x && x.id && x.title && /^\d{4}-\d{2}-\d{2}$/.test(x.date));
        const notes = d.notes.filter((x) => x && x.id && x.title);
        confirmBox(t('importQ'), t('importSub', { a: agenda.length, b: notes.length }), t('restore'), () => {
          const db = { settings: Object.assign({ name: '' }, d.settings || {}, { calendarSync: false, reminderMinutes: 0 }), agenda: agenda, notes: notes };
          store.set('ak_local_db', db);
          S.agenda = agenda; S.notes = notes; S.settings = db.settings; S.outbox = [];
          if (d.profile && typeof d.profile === 'object') { S.profile = { photo: /^data:image\//.test(d.profile.photo || '') ? d.profile.photo : '', bio: String(d.profile.bio || '').slice(0, 80), color: Number(d.profile.color) || 0 }; saveProfile(); }
          persist(); closeSheet(); render(); toast(t('importDone'), 'success');
        });
      };
      reader.readAsText(file);
    }
  };

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-stop]')) return;
    if (e.target.classList.contains('backdrop')) { if (e.target.parentNode === wrap) closeSheet(); else closeDialog(); return; }
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const fn = A[el.dataset.act];
    if (fn) { if (el.tagName === 'BUTTON' && el.type !== 'submit') e.preventDefault(); fn(el, e); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { if (!dlgWrap.hidden) closeDialog(); else if (sheet) closeSheet(); return; }
    if (e.target.id === 'f-bring' && (e.key === 'Enter' || e.key === ',')) { e.preventDefault(); addBringFromInput(); return; }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.getAttribute && e.target.getAttribute('role') === 'button') { e.preventDefault(); e.target.click(); return; }
    if (!gate.hidden && pin.mode !== 'connect' && (pin.step === 'new' || pin.step === 'confirm' || pin.step === 'enter' || pin.step === 'old')) {
      if (/^\d$/.test(e.key)) A.digit({ dataset: { d: e.key } });
      if (e.key === 'Backspace') A.pinDel();
    }
  });
  document.addEventListener('change', (e) => { const k = e.target.dataset && e.target.dataset.ch; if (k && C[k]) C[k](e.target); });
  document.addEventListener('input', (e) => {
    const k = e.target.dataset && e.target.dataset.in;
    if (k === 'agendaSearch') { S.filter.q = e.target.value; $('#agenda-list').innerHTML = agendaListHtml(); const seg = $('#view .seg'); if (seg) seg.hidden = !!(S.filter.q || S.filter.from || S.filter.to); }
    if (k === 'shareOpening' && shareOpt) { shareOpt.opening = e.target.value; renderSharePreview(); }
    if (k === 'noteSearch') { S.noteFilter.q = e.target.value; $('#notes-list').innerHTML = notesListHtml(); }
    if (e.target.id === 'f-title' && e.target.value.trim()) setFieldError('fw-title', '');
    if (e.target.id === 'n-title' && e.target.value.trim()) setFieldError('nw-title', '');
    if (e.target.id === 'n-topic') { const v = e.target.value.trim().toLowerCase(); $$('#topic-chips .chip').forEach((c) => c.classList.toggle('on', c.dataset.v.toLowerCase() === v)); }
  });
  document.addEventListener('submit', (e) => {
    const f = e.target.dataset && e.target.dataset.form;
    if (!f) return;
    e.preventDefault();
    if (f === 'connect') doConnect($('#api-url').value);
    if (f === 'invite') {
      const code = $('#invite-code').value;
      const btn = $('button', e.target); if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spin"></span>' + t('checking'); }
      setTimeout(() => {
        const h = window.AKHash.inviteHash(code);
        if (code.trim() && inviteList().indexOf(h) >= 0) { store.set('ak_invite', h); boot(); } else showInvite(t('inviteBad'));
      }, 40);
    }
    if (f === 'rcode') {
      if (S.recHash && recHashOf($('#rec-code').value) === S.recHash) { pin.step = 'new'; pin.msg = ''; renderPin(); }
      else { pin.msg = t('recBad'); renderPin(); }
    }
    if (f === 'agenda') submitAgendaForm();
    if (f === 'note') submitNoteForm();
    if (f === 'code') { const c = $('#reset-code').value.replace(/\D/g, ''); if (c.length !== 6) { $('#pin-msg').textContent = t('forgotCodeBad'); return; } pin.code = c; pin.step = 'new'; pin.msg = ''; renderPin(); }
  });
  // chart: move the marker with a finger or the mouse
  const chartPick = (e) => {
    const r = e.target.closest && e.target.closest('[data-chart-i]');
    if (!r) return; const i = Number(r.dataset.chartI);
    if (i !== S.chartSel) { S.chartSel = i; $('#chart-card').innerHTML = homeChartHtml(); }
  };
  document.addEventListener('pointermove', chartPick);
  document.addEventListener('pointerdown', chartPick);

  // lock again after the app was in the background for a while, and refresh data
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = Date.now(); return; }
    if (appEl.hidden) return;
    if (!S.demo && S.lockOnOpen && S.pinHash && hiddenAt && Date.now() - hiddenAt > 120000) { closeSheet(true); showPin('unlock'); return; }
    if (S.outbox.length) flush(); else pull(true);
  });
  window.addEventListener('online', () => { S.offline = false; if (!appEl.hidden) { if (S.outbox.length) flush(); else pull(true); } });
  window.addEventListener('offline', () => { S.offline = true; syncUI(); });
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; });

  function boot() {
    document.documentElement.lang = S.lang;
    const qp = new URLSearchParams(location.search);
    if ((qp.get('demo') === '1' || window.AK_FORCE_DEMO) && !S.api) { S.demo = true; store.set('ak_demo', true); }
    const preset = qp.get('api');
    if (preset && !S.api) { S.api = preset; }
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !window.AK_NO_SW) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
    if (inviteNeeded()) return showInvite();
    if (S.demo) return enterApp();
    if (S.local) {
      if (!S.pinHash) return showPin('create');
      return S.lockOnOpen ? showPin('unlock') : enterApp();
    }
    if (!store.get('ak_api', '')) return preset ? showConnect() : showWelcome();
    if (!S.token) {
      showGate(`<div class="gate-body"><span class="spin big"></span><p class="muted">${t('checking')}</p></div>`);
      api('status').then((r) => showPin(r.hasPin ? 'login' : 'create')).catch(() => showPin('login'));
      return;
    }
    if (S.lockOnOpen && S.pinHash) return showPin('unlock');
    enterApp();
  }
  boot();
})();
