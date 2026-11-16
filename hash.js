/**
 * ============================================================
 *  AgendaKu — hash.js
 *  Turns a PIN or an invitation code into a "fingerprint" (hash)
 *  so the real PIN / code is never stored or published anywhere.
 * ============================================================
 */
(function (root) {
  'use strict';

  // Standard SHA-256. Returns 64 hex characters.
  var K = [], H0 = [];
  (function () {
    var n = 2, count = 0, frac = function (x) { return ((x - Math.floor(x)) * 4294967296) | 0; };
    while (count < 64) {
      var prime = true;
      for (var d = 2; d * d <= n; d++) if (n % d === 0) { prime = false; break; }
      if (prime) {
        if (count < 8) H0[count] = frac(Math.pow(n, 1 / 2));
        K[count++] = frac(Math.pow(n, 1 / 3));
      }
      n++;
    }
  })();

  function utf8(str) {
    var out = [], s = unescape(encodeURIComponent(String(str)));
    for (var i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
    return out;
  }

  function sha256(str) {
    var b = utf8(str), bits = b.length * 8, h = H0.slice(), w = new Array(64), i, j;
    b.push(0x80);
    while (b.length % 64 !== 56) b.push(0);
    var hi = Math.floor(bits / 4294967296), lo = bits >>> 0;
    b.push((hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255,
      (lo >>> 24) & 255, (lo >>> 16) & 255, (lo >>> 8) & 255, lo & 255);
    var r = function (x, n) { return (x >>> n) | (x << (32 - n)); };
    for (i = 0; i < b.length; i += 64) {
      for (j = 0; j < 16; j++) w[j] = (b[i + j * 4] << 24) | (b[i + j * 4 + 1] << 16) | (b[i + j * 4 + 2] << 8) | b[i + j * 4 + 3];
      for (j = 16; j < 64; j++) {
        var s0 = r(w[j - 15], 7) ^ r(w[j - 15], 18) ^ (w[j - 15] >>> 3);
        var s1 = r(w[j - 2], 17) ^ r(w[j - 2], 19) ^ (w[j - 2] >>> 10);
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
      }
      var a = h[0], bb = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
      for (j = 0; j < 64; j++) {
        var t1 = (hh + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K[j] + w[j]) | 0;
        var t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & bb) ^ (a & c) ^ (bb & c))) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = bb; bb = a; a = (t1 + t2) | 0;
      }
      h[0] = (h[0] + a) | 0; h[1] = (h[1] + bb) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
      h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
    }
    var hex = '';
    for (i = 0; i < 8; i++) hex += ('00000000' + (h[i] >>> 0).toString(16)).slice(-8);
    return hex;
  }

  /** Invitation codes are not case-sensitive. Hashed many times to slow down guessing. */
  function inviteHash(code) {
    var n = String(code || '').trim().toLowerCase();
    var h = sha256('agendaku-invite:' + n);
    for (var i = 0; i < 5000; i++) h = sha256(h + ':' + n);
    return h;
  }

  var api = { sha256: sha256, inviteHash: inviteHash };
  root.AKHash = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : this);
