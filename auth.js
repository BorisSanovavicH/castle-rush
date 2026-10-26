/* ============================================================================
   Castle Rush — shared auth helper (used by index.html and play.html)

   SETUP: paste your Supabase project values below.
   Supabase dashboard -> Project Settings -> API
     - Project URL        -> SUPABASE_URL
     - anon / public key  -> SUPABASE_ANON_KEY
   The anon key is meant to be public (it is safe to commit to GitHub).
   Never paste the "service_role" key here.
   ============================================================================ */
(function () {
  var SUPABASE_URL = 'https://pseqjkghosqncbxwjpnm.supabase.co';        // e.g. 'https://abcdxyz.supabase.co'
  var SUPABASE_ANON_KEY = 'sb_publishable_ef6wIq9X_xKDYh8Mviw4tA_jv3apKdX';   // e.g. 'eyJhbGciOi...'

  var GUEST_KEY = 'castlerush_guest';

  var hasKeys = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
  var hasLib = !!(window.supabase && window.supabase.createClient);
  var configured = hasKeys && hasLib;
  var client = configured ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

  function safeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function safeSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function safeDel(k) { try { localStorage.removeItem(k); } catch (e) {} }

  var CR = {
    configured: configured,
    // why accounts are unavailable: 'no-keys' | 'no-library' | null
    reason: configured ? null : (!hasKeys ? 'no-keys' : 'no-library'),
    client: client,

    isGuest: function () { return safeGet(GUEST_KEY) === '1'; },
    enterGuest: function () { safeSet(GUEST_KEY, '1'); },
    clearGuest: function () { safeDel(GUEST_KEY); },

    getSession: function () {
      if (!client) return Promise.resolve(null);
      return client.auth.getSession()
        .then(function (r) { return (r && r.data && r.data.session) || null; })
        .catch(function () { return null; });
    },

    displayName: function (user) {
      if (!user) return 'Guest';
      var meta = user.user_metadata || {};
      if (meta.username) return meta.username;
      if (user.email) return user.email.split('@')[0];
      return 'Player';
    },

    signOut: function () {
      var p = client ? client.auth.signOut().catch(function () {}) : Promise.resolve();
      return p.then(function () { CR.clearGuest(); });
    }
  };

  // ---------- cloud scores & leaderboard (these need supabase_setup.sql to have been run) ----------
  var PENDING_KEY = 'castlerush_pending_scores';
  function readPending() { try { return JSON.parse(safeGet(PENDING_KEY) || '[]'); } catch (e) { return []; } }
  function writePending(list) { safeSet(PENDING_KEY, JSON.stringify(list.slice(-10))); }

  // "this week" = the last 7 days
  CR.weekStart = function () { return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(); };

  CR.cloudBest = function (userId, duration) {
    if (!client) return Promise.reject(new Error('not configured'));
    return client.from('scores').select('wpm').eq('user_id', userId).eq('duration', duration)
      .order('wpm', { ascending: false }).limit(1)
      .then(function (r) {
        if (r.error) throw r.error;
        return (r.data && r.data.length) ? r.data[0].wpm : null;
      });
  };

  // row: { user_id, duration, wpm, accuracy, correct_words, mistakes }
  CR.saveScore = function (row) {
    if (!client) return Promise.reject(new Error('not configured'));
    return client.from('scores').insert(row).then(function (r) {
      if (r.error) throw r.error;
      return true;
    });
  };

  // a run that could not be saved is kept on this device and retried on a later visit
  CR.queueScore = function (row) {
    var list = readPending();
    list.push(Object.assign({ queued_at: Date.now() }, row));
    writePending(list);
  };
  CR.flushPending = function (userId) {
    if (!client) return Promise.resolve(0);
    var all = readPending().filter(function (r) { return Date.now() - r.queued_at < 7 * 24 * 60 * 60 * 1000; });
    var mine = all.filter(function (r) { return r.user_id === userId; });
    var rest = all.filter(function (r) { return r.user_id !== userId; });
    if (!mine.length) { writePending(rest); return Promise.resolve(0); }
    // send only the best waiting run per visit (the server limits how fast runs can be saved)
    mine.sort(function (a, b) { return b.wpm - a.wpm; });
    var best = mine[0];
    var payload = Object.assign({}, best); delete payload.queued_at;
    return CR.saveScore(payload).then(
      function () { writePending(rest); return 1; },       // sent; older leftovers are dropped
      function () { writePending(rest.concat(mine)); return 0; }
    );
  };

  CR.leaderboard = function (duration, since, limit) {
    if (!client) return Promise.reject(new Error('not configured'));
    return client.rpc('leaderboard', { p_duration: duration, p_since: since || null, p_limit: limit || 25 })
      .then(function (r) { if (r.error) throw r.error; return r.data || []; });
  };
  CR.myRank = function (duration, since) {
    if (!client) return Promise.reject(new Error('not configured'));
    return client.rpc('my_rank', { p_duration: duration, p_since: since || null })
      .then(function (r) { if (r.error) throw r.error; return (r.data && r.data[0]) || null; });
  };
  CR.usernameAvailable = function (name) {
    if (!client) return Promise.reject(new Error('not configured'));
    return client.rpc('username_available', { p_username: name })
      .then(function (r) { if (r.error) throw r.error; return r.data; });
  };

  window.CR_AUTH = CR;
})();
