/* ============================================================================
   TypeBound — shared page shell for Home and Profile:
   session check, account menu, logout, and the mobile navigation drawer.
   Pages wait on  TB_SHELL.ready  to get { id, name, guest }.
   ============================================================================ */
(function () {
  var A = window.CR_AUTH;
  var $ = function (id) { return document.getElementById(id); };

  function initials(name) {
    var n = (name || '?').replace(/[^A-Za-z0-9]/g, '');
    return (n.slice(0, 2) || '?').toUpperCase();
  }

  function item(tag, attrs, text) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    e.textContent = text;
    return e;
  }

  function paint(user) {
    $('accAvatar').textContent = initials(user.name);
    $('accName').textContent = user.name;
    var menu = $('accountMenu');
    menu.textContent = '';
    if (user.guest) {
      menu.appendChild(item('a', { 'class': 'menu-item', href: 'index.html' }, 'Log in or sign up'));
      menu.appendChild(item('a', { 'class': 'menu-item', href: 'leaderboard.html' }, 'Leaderboard'));
    } else {
      menu.appendChild(item('a', { 'class': 'menu-item', href: 'profile.html' }, 'Profile'));
      menu.appendChild(item('a', { 'class': 'menu-item', href: 'leaderboard.html' }, 'Leaderboard'));
      var out = item('button', { 'class': 'menu-item danger', type: 'button', id: 'logoutBtn' }, 'Log out');
      out.addEventListener('click', function () {
        out.disabled = true;
        A.signOut().then(function () { location.replace('index.html'); });
      });
      menu.appendChild(out);
    }
  }

  // ---- identity: signed-in account, guest, or neither (-> login) ----
  var ready = (A ? A.getSession() : Promise.resolve(null)).then(function (session) {
    var guest = !session && !!A && A.isGuest();
    if (!session && !guest) {
      location.replace('index.html');
      return new Promise(function () {});          // the page is leaving; never resolve
    }
    var user;
    if (session) {
      A.clearGuest();
      user = { id: session.user.id, name: A.displayName(session.user), guest: false };
    } else {
      user = { id: null, name: 'Guest', guest: true };
    }
    paint(user);
    return user;
  });

  // ---- account dropdown (a simple disclosure: button + list, closes on Esc / outside click) ----
  var accBtn = $('accountBtn'), accMenu = $('accountMenu');
  function setAccount(open) {
    accMenu.classList.toggle('hidden', !open);
    accBtn.setAttribute('aria-expanded', String(open));
  }
  accBtn.addEventListener('click', function (e) { e.stopPropagation(); setAccount(accMenu.classList.contains('hidden')); });
  document.addEventListener('click', function (e) { if (!$('account').contains(e.target)) setAccount(false); });

  // ---- mobile navigation drawer ----
  var menuBtn = $('menuBtn'), scrim = $('scrim');
  function setNav(open) {
    document.body.classList.toggle('nav-open', open);
    scrim.classList.toggle('hidden', !open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  }
  menuBtn.addEventListener('click', function () { setNav(!document.body.classList.contains('nav-open')); });
  scrim.addEventListener('click', function () { setNav(false); });
  document.querySelectorAll('#sidebar a').forEach(function (a) { a.addEventListener('click', function () { setNav(false); }); });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (!accMenu.classList.contains('hidden')) { setAccount(false); accBtn.focus(); }
    if (document.body.classList.contains('nav-open')) { setNav(false); menuBtn.focus(); }
  });
  window.matchMedia('(min-width: 901px)').addEventListener('change', function (m) { if (m.matches) setNav(false); });

  window.TB_SHELL = { ready: ready };
})();
