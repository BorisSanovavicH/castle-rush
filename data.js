/* ============================================================================
   TypeBound — data helpers for the Home dashboard and Profile page.
   Everything here reads the signed-in player's OWN saved runs (the `scores` table)
   and their own `profiles` row. The database enforces ownership (row-level security),
   so these queries can only ever return the caller's own data.
   ============================================================================ */
(function () {
  var A = window.CR_AUTH;

  function client() {
    if (!A || !A.client) throw new Error('not configured');
    return A.client;
  }
  function unwrap(r) { if (r.error) throw r.error; return r.data; }

  var DATA = {
    // totals per duration, computed in the database: [{duration, runs, best_wpm, best_accuracy, accuracy_sum, total_seconds, last_run_at}]
    myStats: function () {
      return Promise.resolve().then(function () {
        return client().rpc('my_stats').then(unwrap);
      }).then(function (rows) { return rows || []; });
    },
    // the player's own profile row: {username, created_at} (or null)
    myProfile: function (userId) {
      return Promise.resolve().then(function () {
        return client().from('profiles').select('username,created_at').eq('id', userId).maybeSingle().then(unwrap);
      });
    },
    // newest-first list of the player's completed runs
    recentRuns: function (userId, limit) {
      return Promise.resolve().then(function () {
        return client().from('scores').select('duration,wpm,accuracy,created_at')
          .eq('user_id', userId).order('created_at', { ascending: false }).limit(limit || 10).then(unwrap);
      }).then(function (rows) { return rows || []; });
    },

    // Combine the per-duration rows into overall numbers.
    //  - bestWpm: highest WPM of any run (bestDuration says which test it was set in)
    //  - avgAccuracy: the plain average of every completed run's accuracy (sum of accuracies / number of runs)
    //  - totalSeconds: sum of the lengths of all completed runs
    summarize: function (rows) {
      var out = { runs: 0, bestWpm: null, bestDuration: null, avgAccuracy: null, totalSeconds: 0, byDuration: {} };
      var accSum = 0;
      (rows || []).forEach(function (r) {
        var runs = Number(r.runs) || 0;
        out.byDuration[r.duration] = {
          runs: runs, bestWpm: r.best_wpm, bestAccuracy: r.best_accuracy,
          avgAccuracy: runs ? Number(r.accuracy_sum) / runs : null
        };
        out.runs += runs;
        accSum += Number(r.accuracy_sum) || 0;
        out.totalSeconds += Number(r.total_seconds) || 0;
        if (out.bestWpm === null || r.best_wpm > out.bestWpm) { out.bestWpm = r.best_wpm; out.bestDuration = r.duration; }
      });
      if (out.runs > 0) out.avgAccuracy = accSum / out.runs;
      return out;
    }
  };

  var FORMAT = {
    // 45 -> "45s", 150 -> "2m 30s", 4320 -> "1h 12m"
    duration: function (sec) {
      sec = Math.round(sec);
      if (sec < 60) return sec + 's';
      var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
      if (h > 0) return h + 'h ' + m + 'm';
      return s ? m + 'm ' + s + 's' : m + 'm';
    },
    percent: function (n) { return n === null || n === undefined ? '\u2014' : (Math.round(n * 10) / 10).toFixed(1) + '%'; },
    date: function (iso) { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); },
    monthYear: function (iso) { return new Date(iso).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }); },
    ago: function (iso) {
      var s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
      if (s < 60) return 'just now';
      if (s < 3600) return Math.floor(s / 60) + 'm ago';
      if (s < 86400) return Math.floor(s / 3600) + 'h ago';
      if (s < 7 * 86400) return Math.floor(s / 86400) + 'd ago';
      return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
  };

  window.TB_DATA = DATA;
  window.TB_FORMAT = FORMAT;
})();
