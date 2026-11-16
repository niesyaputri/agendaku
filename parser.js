/**
 * ============================================================
 *  AgendaKu — parser.js
 *  Reads a pasted message (WhatsApp invitation, school notice…)
 *  and pulls out: title, date, time, place, link, things to bring.
 *  Works fully on the phone. No internet or AI service needed.
 *  Understands Indonesian and English.
 * ============================================================
 */
(function (root) {
  'use strict';

  var MONTHS = {
    januari: 1, january: 1, jan: 1,
    februari: 2, pebruari: 2, february: 2, feb: 2,
    maret: 3, march: 3, mar: 3,
    april: 4, apr: 4,
    mei: 5, may: 5,
    juni: 6, june: 6, jun: 6,
    juli: 7, july: 7, jul: 7,
    agustus: 8, august: 8, agu: 8, agt: 8, ags: 8, aug: 8,
    september: 9, sept: 9, sep: 9,
    oktober: 10, october: 10, okt: 10, oct: 10,
    november: 11, nopember: 11, nov: 11, nop: 11,
    desember: 12, december: 12, des: 12, dec: 12
  };
  var DAYS = {
    minggu: 0, ahad: 0, sunday: 0,
    senin: 1, monday: 1,
    selasa: 2, tuesday: 2,
    rabu: 3, wednesday: 3,
    kamis: 4, thursday: 4,
    jumat: 5, "jum'at": 5, jumaat: 5, friday: 5,
    sabtu: 6, saturday: 6
  };

  var LABELS = {
    date: /^(hari\s*[,\/&]?\s*(dan\s+)?(tanggal|tgl)|hari\s*\/\s*tgl|tanggal|tgl|hari|day\s*[,\/&]?\s*(and\s+)?date|date|day|when)$/i,
    time: /^(waktu|pukul|jam|time)$/i,
    place: /^(tempat|lokasi|venue|ruang|ruangan|location|place|media|via|alamat)$/i,
    title: /^(agenda|acara|kegiatan|nama kegiatan|perihal|hal|topik|judul|tema|rapat|event|subject|topic|title)$/i,
    link: /^(link|tautan|url|link zoom|zoom|link meeting|link rapat|join zoom meeting|gmeet|google meet|link gmeet|link meet|teams|link pendaftaran|registrasi|registration)$/i,
    notes: /^(catatan|note|notes|nb|n\.b\.?|keterangan|ket)$/i,
    bring: /^(membawa|bawa|dibawa|yang (perlu |harus |wajib )?dibawa|barang bawaan|perlengkapan|bring|what to bring|to bring)$/i,
    extra: /^(meeting id|id meeting|id rapat|passcode|password|kode akses|kata sandi|sandi|dress\s*code|dresscode|pakaian|busana|pic|narahubung|contact person|cp|peserta|pembicara|narasumber|speaker)$/i
  };

  var GREETING = /^(assalam|bismillah|wa'?alaikum|yth\b|kepada\b|dear\b|selamat (pagi|siang|sore|malam)|salam\b|hi\b|hai\b|halo\b|hello\b|ayah\b|bunda\b|bapak\b|ibu\b|bpk\b|rekan\b|teman\b|forwarded|diteruskan|dengan hormat)/i;
  var BARE_WORD = /^(undangan|pengumuman|pemberitahuan|informasi|info|reminder|pengingat|invitation|announcement)\s*[:!.]?$/i;

  var EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu;
  var URL = /((?:https?:\/\/|www\.)[^\s<>"']+|(?:[a-z0-9-]+\.)*(?:zoom\.us|meet\.google\.com|teams\.microsoft\.com|teams\.live\.com|bit\.ly|s\.id|forms\.gle|linktr\.ee|youtu\.be|tinyurl\.com)\/[^\s<>"']+)/gi;

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  function clean(s) {
    return String(s || '')
      .replace(EMOJI, ' ')
      .replace(/[*~`]/g, '')
      .replace(/(^|\s)_+|_+(?=\s|$)/g, '$1')
      .replace(/[ \t ]+/g, ' ')
      .trim();
  }

  function cleanUrl(u) {
    u = u.replace(/[),.;:!?\]}>*_~]+$/, '');
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    return u;
  }

  /* ---------- date ---------- */

  function resolveYear(y, m, d, today) {
    if (y) { y = Number(y); return y < 100 ? 2000 + y : y; }
    var year = today.getFullYear();
    var cand = new Date(year, m - 1, d);
    if ((today - cand) / 86400000 > 90) year += 1;     // "13 Januari" said in December = next year
    return year;
  }

  function validDate(y, m, d) {
    if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31)) return '';
    var dt = new Date(y, m - 1, d);
    return dt.getMonth() === m - 1 ? ymd(dt) : '';
  }

  function findDate(text, today, lenient) {
    var s = String(text || '');
    var m;

    m = s.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
    if (m) { var iso = validDate(+m[1], +m[2], +m[3]); if (iso) return iso; }

    // 13 November 2026 | 13-14 Nov 2026 | 13 Nov
    var re = /\b(\d{1,2})(?:\s*(?:-|–|—|s\.?\/?d\.?|dan|&)\s*\d{1,2})?\s+([A-Za-z']{3,10})\.?(?:,?\s+(\d{4}|'\d{2}))?/g;
    while ((m = re.exec(s))) {
      var mon = MONTHS[m[2].toLowerCase()];
      if (!mon) continue;
      var yr = m[3] ? m[3].replace("'", '') : '';
      var v = validDate(resolveYear(yr, mon, +m[1], today), mon, +m[1]);
      if (v) return v;
    }

    // November 13, 2026
    re = /\b([A-Za-z]{3,10})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/g;
    while ((m = re.exec(s))) {
      var mon2 = MONTHS[m[1].toLowerCase()];
      if (!mon2) continue;
      var v2 = validDate(resolveYear(m[3], mon2, +m[2], today), mon2, +m[2]);
      if (v2) return v2;
    }

    // 13/11/2026 | 13-11-26 | 13.11.2026  (day first, as used in Indonesia)
    m = s.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4}|\d{2})\b/);
    if (m) {
      var d1 = +m[1], m1 = +m[2];
      if (m1 > 12 && d1 <= 12) { var t = d1; d1 = m1; m1 = t; }
      var v3 = validDate(resolveYear(m[3], m1, d1, today), m1, d1);
      if (v3) return v3;
    }

    var low = s.toLowerCase();
    if (/\b(hari ini|today)\b/.test(low)) return ymd(today);
    if (/\b(besok|tomorrow)\b/.test(low)) return ymd(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1));
    if (/\blusa\b/.test(low)) return ymd(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2));

    if (lenient) {
      // 13/11 with no year
      m = s.match(/\b(\d{1,2})\/(\d{1,2})\b/);
      if (m) {
        var v4 = validDate(resolveYear('', +m[2], +m[1], today), +m[2], +m[1]);
        if (v4) return v4;
      }
      // only a day name: the next such day
      var words = low.split(/[^a-z']+/);
      for (var i = 0; i < words.length; i++) {
        if (DAYS.hasOwnProperty(words[i])) {
          var diff = (DAYS[words[i]] - today.getDay() + 7) % 7;
          return ymd(new Date(today.getFullYear(), today.getMonth(), today.getDate() + diff));
        }
      }
    }
    return '';
  }

  /* ---------- time ---------- */

  function toClock(h, mi, mer) {
    h = Number(h); mi = Number(mi || 0);
    mer = (mer || '').toLowerCase().replace(/\./g, '');
    if (mer === 'pm' && h < 12) h += 12;
    else if (mer === 'am' && h === 12) h = 0;
    else if (mer === 'siang' && h <= 6) h += 12;
    else if (mer === 'sore' && h < 12) h += 12;
    else if (mer === 'malam') { if (h >= 5 && h < 12) h += 12; else if (h === 12) h = 0; }
    if (h > 23 || mi > 59) return '';
    return pad(h) + ':' + pad(mi);
  }

  var T = '(\\d{1,2})(?:\\s?[.:]\\s?(\\d{2}))?\\s*(a\\.?m\\.?|p\\.?m\\.?|pagi|siang|sore|malam)?';
  var ZONE = '(?:\\s*(?:wib|wita|wit))?';
  var SEP = '\\s*(?:-|–|—|s\\.?\\/?d\\.?|sd|sampai dengan|sampai|hingga|until|till|to)\\s*';

  /** lenient = the text is known to be about time (e.g. after "Waktu:") */
  function findTime(text, lenient) {
    var s = String(text || '').replace(/–|—/g, '-');
    var m;
    var range = new RegExp('(?:^|[^\\d.:/])' + T + ZONE + SEP + T, 'i');
    m = s.match(range);
    if (m && (lenient || m[2] || m[5] || m[3] || m[6])) {
      var a = toClock(m[1], m[2], m[3] || (m[6] && /m/i.test(m[6]) && !m[3] && Number(m[1]) <= Number(m[4]) ? m[6] : ''));
      var b = toClock(m[4], m[5], m[6]);
      if (a && b) return { start: a, end: b };
    }
    var kw = new RegExp('(?:pukul|pkl\\.?|jam|at|@)\\s*' + T, 'i');
    m = s.match(kw);
    if (m) { var c = toClock(m[1], m[2], m[3]); if (c) return { start: c, end: '' }; }

    var zoned = new RegExp('(?:^|[^\\d.:/])(\\d{1,2})[.:](\\d{2})\\s*(?:wib|wita|wit)\\b', 'i');
    m = s.match(zoned);
    if (m) { var z = toClock(m[1], m[2]); if (z) return { start: z, end: '' }; }

    var ampm = /(?:^|[^\d.:/])(\d{1,2})(?:[.:](\d{2}))?\s*(a\.?m\.?|p\.?m\.?)(?![a-z])/i;
    m = s.match(ampm);
    if (m) { var p = toClock(m[1], m[2], m[3]); if (p) return { start: p, end: '' }; }

    if (lenient) {
      m = s.match(/(?:^|[^\d.:/])(\d{1,2})[.:](\d{2})(?!\d)/);
      if (m) { var l = toClock(m[1], m[2]); if (l) return { start: l, end: '' }; }
    }
    return null;
  }

  /* ---------- things to bring ---------- */

  function splitItems(s) {
    var out = [], depth = 0, cur = '';
    var tokens = String(s).split(/(\(|\)|,|;|\/(?=\s)|\s+(?:dan|and|serta|&)\s+)/i);
    tokens.forEach(function (t) {
      if (t === undefined) return;
      if (t === '(') { depth++; cur += t; return; }
      if (t === ')') { depth = Math.max(0, depth - 1); cur += t; return; }
      if (depth === 0 && /^(,|;|\/|\s+(?:dan|and|serta|&)\s+)$/i.test(t)) { out.push(cur); cur = ''; return; }
      cur += t;
    });
    out.push(cur);
    return out.map(function (x) {
      return clean(x).replace(/^[-•·\d.)\s]+/, '').replace(/^(dan|and|serta|sebuah|seperangkat|your|a|an|the)\s+/i, '')
        .replace(/[.:!]+$/, '').trim();
    }).filter(function (x) { return x.length > 1 && x.length <= 60; });
  }

  function findBring(text) {
    var items = [];
    var re = /\b(?:membawa|bawa|bawalah|bring)\s+([^.\n;:!?]+?)(?=\s*,\s*(?:pada|serta|agar|untuk|supaya|dan pastikan|ya)\b|\s+(?:pada|untuk|agar|supaya|ke|di|saat|ketika|for|to|on|at)\s|\s*[.\n;:!?]|\s*$)/gi;
    var m;
    while ((m = re.exec(text))) {
      splitItems(m[1]).forEach(function (x) { items.push(x); });
    }
    return items;
  }

  function unique(list) {
    var seen = {}, out = [];
    list.forEach(function (x) {
      var k = x.toLowerCase();
      if (!seen[k]) { seen[k] = 1; out.push(x); }
    });
    return out;
  }

  /* ---------- category guess ---------- */

  function guessCategory(text) {
    var t = text.toLowerCase();
    var score = {
      School: (t.match(/\b(ananda|siswa|siswi|murid|sekolah|sdit|sd|smp|sma|tk|paud|wali murid|orang ?tua|kelas|guru|ustadz|ustadzah|ujian|rapor|raport|pembelajaran|parent|student|school|teacher|class)\b/g) || []).length * 2,
      Work: (t.match(/\b(rapat|meeting|zoom|koordinasi|pembahasan|undangan|dinas|kantor|seminar|webinar|fgd|sosialisasi|workshop|bimtek|pimpinan|direktur|divisi|departemen|satker|notulen|risalah|audit|office|agenda rapat|town ?hall)\b/g) || []).length,
      Family: (t.match(/\b(keluarga|arisan|ulang tahun|ultah|pernikahan|resepsi|akikah|aqiqah|silaturahmi|lebaran|mudik|family|birthday|wedding)\b/g) || []).length * 2,
      Personal: (t.match(/\b(dokter|klinik|rumah sakit|kontrol|salon|gym|olahraga|servis|bengkel|doctor|dentist|workout)\b/g) || []).length * 2
    };
    var best = 'Other', top = 0;
    ['School', 'Work', 'Family', 'Personal'].forEach(function (k) { if (score[k] > top) { top = score[k]; best = k; } });
    return best;
  }

  /* ---------- main ---------- */

  function parse(raw, now) {
    var today = now ? new Date(now) : new Date();
    today = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    var source = String(raw || '').replace(/\r\n?/g, '\n').trim();
    var out = { title: '', date: '', start: '', end: '', location: '', link: '', bring: [], notes: '',
      category: 'Other', source: source, found: [], multiple: false };
    if (!source) return out;

    // WhatsApp export prefix: "[13/11/26 08.15] Name: " or "13/11/26 08.15 - Name: "
    var text = source.split('\n').map(function (l) {
      return l.replace(/^\s*\[?\d{1,2}[\/.]\d{1,2}[\/.]\d{2,4},?\s+\d{1,2}[.:]\d{2}(?:[.:]\d{2})?(?:\s?[AP]M)?\]?\s*(?:-\s*)?[^:\n]{1,40}:\s+/i, '');
    }).join('\n');

    // 1. links
    var links = [];
    (text.match(URL) || []).forEach(function (u) { links.push(cleanUrl(u)); });
    links = unique(links);
    var noUrl = text.replace(URL, ' ');

    // 2. labelled lines   "Hari, Tanggal : Jumat, 13 November 2026"
    var lines = noUrl.split('\n');
    var rawLines = text.split('\n');
    var field = {};            // first value per label
    var labelledAt = [];       // line indexes that carry a known label
    var extras = [];
    var notesStart = -1;
    var dateLabels = 0;
    lines.forEach(function (line, i) {
      var c = clean(line);
      var m = c.match(/^[^A-Za-z0-9]*([A-Za-z][A-Za-z ,\/&.']{0,32}?)\s*[:=]\s*(.*)$/);
      if (!m) return;
      var label = m[1].trim(), value = m[2].trim();
      var kind = null;
      Object.keys(LABELS).forEach(function (k) { if (!kind && LABELS[k].test(label)) kind = k; });
      if (!kind) return;
      labelledAt.push(i);
      if (kind === 'date') dateLabels++;
      if (kind === 'extra') { if (value) extras.push(label + ': ' + value); return; }
      if (kind === 'notes') { if (notesStart < 0) { notesStart = i; field.notesFirst = value; } return; }
      if (field[kind] === undefined) { field[kind] = value; field[kind + 'Line'] = i; }
    });
    out.multiple = dateLabels > 1;

    // 3. date
    if (field.date) out.date = findDate(field.date, today, true);
    if (!out.date) out.date = findDate(noUrl, today, false);
    if (out.date) out.found.push('date');

    // 4. time
    var time = null, timeNote = '';
    if (field.time !== undefined) {
      time = findTime(field.time, true);
      if (!time && field.time) timeNote = field.time;
    }
    if (!time && field.date) time = findTime(field.date.replace(/\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}/g, ' '), false);
    if (!time) {
      var body = lines.filter(function (l, i) { return labelledAt.indexOf(i) < 0 || i === field.timeLine; }).join('\n');
      time = findTime(body.replace(/\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}/g, ' '), false);
    }
    if (time) { out.start = time.start; out.end = time.end; out.found.push('time'); }

    // 5. place and link
    if (field.place) out.location = field.place.replace(/[\s,;:-]+$/, '').slice(0, 120);
    if (links.length) {
      var meet = links.filter(function (u) { return /zoom\.us|meet\.google|teams\.(microsoft|live)/i.test(u); })[0];
      out.link = meet || links[0];
      out.found.push('link');
      if (!out.location && meet) out.location = /zoom/i.test(meet) ? 'Zoom' : /meet\.google/i.test(meet) ? 'Google Meet' : 'Microsoft Teams';
    }
    if (out.location) out.found.push('place');

    // 6. title
    var firstLabel = labelledAt.length ? labelledAt[0] : lines.length;
    if (field.title) out.title = field.title;
    if (!out.title) {
      for (var i = 0; i < Math.min(firstLabel, lines.length); i++) {
        var c = clean(lines[i]).replace(/^[^A-Za-z0-9]+/, '');
        if (c.length < 3 || c.length > 90) continue;
        if (GREETING.test(c) || BARE_WORD.test(c) || /[:,]$/.test(c)) continue;
        out.title = c; break;
      }
    }
    if (!out.title) {
      var flat = clean(noUrl.replace(/\n+/g, ' '));
      var k = flat.match(/\b(?:kegiatan|acara|rapat|agenda|mengikuti|menghadiri|pelaksanaan|attend|join)\s+([A-Z][^,.;:!?]{2,60})/);
      if (k) out.title = k[1].trim();
    }
    if (!out.title) {
      for (var j = 0; j < lines.length; j++) {
        var c2 = clean(lines[j]).replace(/^[^A-Za-z0-9]+/, '');
        if (c2.length < 3 || GREETING.test(c2) || labelledAt.indexOf(j) >= 0) continue;
        out.title = c2.length > 70 ? c2.slice(0, 67).replace(/\s+\S*$/, '') + '…' : c2; break;
      }
    }
    out.title = out.title.replace(/[\s.:;,-]+$/, '').slice(0, 120);
    if (out.title) out.found.push('title');

    // 7. things to bring
    var bring = [];
    if (field.bring) bring = bring.concat(splitItems(field.bring));
    if (field.bringLine !== undefined && !field.bring) {
      for (var b = field.bringLine + 1; b < lines.length; b++) {     // a bullet list under "Membawa:"
        var bl = clean(lines[b]);
        if (!bl) { if (bring.length) break; continue; }
        if (!/^[-•·*\d]/.test(lines[b].trim()) || labelledAt.indexOf(b) >= 0) break;
        bring = bring.concat(splitItems(bl));
      }
    }
    bring = bring.concat(findBring(clean(noUrl.replace(/\n/g, ' \n ')).replace(/ \n /g, '\n')));
    out.bring = unique(bring).slice(0, 12);
    if (out.bring.length) out.found.push('bring');

    // 8. notes
    var notes = [];
    if (timeNote) notes.push('Waktu: ' + timeNote);
    extras.forEach(function (e) { notes.push(e); });
    links.forEach(function (u) { if (u !== out.link) notes.push(u); });
    if (notesStart >= 0) {
      var chunk = [];
      if (field.notesFirst) chunk.push(field.notesFirst);
      for (var n = notesStart + 1; n < rawLines.length; n++) {
        if (labelledAt.indexOf(n) >= 0) break;
        var nl = clean(rawLines[n]);
        if (nl) chunk.push(nl);
      }
      if (chunk.length) notes.push(chunk.join('\n'));
    }
    out.notes = notes.join('\n');

    out.category = guessCategory(noUrl);
    return out;
  }

  var api = { parse: parse, findDate: findDate, findTime: findTime };
  root.AKParser = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : this);
