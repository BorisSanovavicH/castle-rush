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
  var SUPABASE_URL = '';        // e.g. 'https://abcdxyz.supabase.co'
  var SUPABASE_ANON_KEY = '';   // e.g. 'eyJhbGciOi...'

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

  window.CR_AUTH = CR;
})();
