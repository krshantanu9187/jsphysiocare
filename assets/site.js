(function () {
  var T = window.JSP_T || {};
  var CFG = window.JSP_CONFIG || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };

  // ---------- language ----------
  var lang = store.get('jsp_lang') === 'hi' ? 'hi' : 'en';
  function applyLang(l) {
    lang = l; store.set('jsp_lang', l);
    document.documentElement.lang = l;
    $$('[data-t]').forEach(function (el) { var v = T[l] && T[l][el.getAttribute('data-t')]; if (v) el.textContent = v; });
    $$('[data-hi]').forEach(function (el) {
      if (!el.hasAttribute('data-en')) el.setAttribute('data-en', el.textContent);
      el.textContent = l === 'hi' ? el.getAttribute('data-hi') : el.getAttribute('data-en');
    });
    $$('[data-lang]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-lang') === l); });
  }
  $$('[data-lang]').forEach(function (b) { b.addEventListener('click', function () { applyLang(b.getAttribute('data-lang')); }); });
  applyLang(lang);
  var t = function (k) { return (T[lang] && T[lang][k]) || T.en[k] || k; };

  // ---------- mobile menu ----------
  var burger = $('.hamburger'), mmenu = $('.m-menu');
  if (burger && mmenu) burger.addEventListener('click', function () {
    var open = mmenu.hasAttribute('hidden');
    if (open) mmenu.removeAttribute('hidden'); else mmenu.setAttribute('hidden', '');
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  // ---------- scroll state (FAB / mobile bar) ----------
  var onScroll = function () { document.body.classList.toggle('scrolled', window.scrollY > 500); };
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

  // ---------- booking prefill (?svc=...) + focus ----------
  var bookForm = $('.book-form');
  if (bookForm) {
    var svc = new URLSearchParams(location.search).get('svc');
    var sel = bookForm.querySelector('[name=service]');
    if (svc && sel && sel.querySelector('option[value="' + svc + '"]')) sel.value = svc;
    var focusName = function () { setTimeout(function () { var n = bookForm.querySelector('[name=name]'); if (n) n.focus({ preventScroll: true }); }, 450); };
    if (location.hash === '#book') focusName();
    $$('[data-focus-book]').forEach(function (a) { a.addEventListener('click', focusName); });
    var d = bookForm.querySelector('[name=preferred_date]');
    if (d) { var now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset()); d.min = now.toISOString().slice(0, 10); }
  }

  // ---------- registration modal ----------
  var modal = $('.reg-modal');
  $$('.reg-open').forEach(function (b) { b.addEventListener('click', function () { if (modal && modal.showModal) modal.showModal(); }); });
  $$('.reg-close').forEach(function (b) { b.addEventListener('click', function () { modal.close(); }); });
  if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) modal.close(); });

  // ---------- story tabs ----------
  $$('.tab[data-cat]').forEach(function (b) {
    b.addEventListener('click', function () {
      var c = b.getAttribute('data-cat');
      $$('.tab[data-cat]').forEach(function (x) { x.classList.toggle('on', x === b); });
      $$('.story').forEach(function (s) { s.hidden = !(c === '-1' || s.getAttribute('data-cat') === c); });
    });
  });
  // ---------- gallery tabs ----------
  $$('[data-gal-tab]').forEach(function (b) {
    b.addEventListener('click', function () {
      var k = b.getAttribute('data-gal-tab');
      $$('[data-gal-tab]').forEach(function (x) { x.classList.toggle('on', x === b); });
      $$('[data-gal]').forEach(function (g) { g.hidden = g.getAttribute('data-gal') !== k; });
    });
  });

  // ---------- forms → Web3Forms (email) + Google Sheet ----------
  var configured = function (v) { return v && v.indexOf('PASTE_') !== 0; };
  var phoneOk = function (p) { return (p || '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '').length === 10; };

  function collect(form) {
    var out = {};
    new FormData(form).forEach(function (v, k) {
      if (k === 'botcheck') return;
      out[k] = out[k] ? out[k] + ', ' + v : v;
    });
    var svc = form.querySelector('select[name=service]');
    if (svc) { var o = svc.options[svc.selectedIndex]; out.service = o.getAttribute('data-en') || o.textContent; }
    return out;
  }

  function send(formName, data) {
    var payload = Object.assign({ form: formName, page: location.pathname, submitted_at: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) }, data);
    var jobs = [];
    if (configured(CFG.SHEET_URL)) {
      var body = new URLSearchParams(); Object.keys(payload).forEach(function (k) { body.append(k, payload[k]); });
      jobs.push(fetch(CFG.SHEET_URL, { method: 'POST', mode: 'no-cors', body: body }).then(function () { return true; }).catch(function () { return false; }));
    }
    if (configured(CFG.WEB3FORMS_KEY)) {
      var w = Object.assign({ access_key: CFG.WEB3FORMS_KEY, subject: 'New ' + formName + ' — ' + (data.name || '') + ' (' + (data.phone || '') + ')', from_name: 'JS Physiocare Website' }, payload);
      jobs.push(fetch('https://api.web3forms.com/submit', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(w) })
        .then(function (r) { return r.json(); }).then(function (j) { return !!j.success; }).catch(function () { return false; }));
    }
    if (!jobs.length) return Promise.resolve(false);
    return Promise.all(jobs).then(function (res) { return res.some(Boolean); });
  }

  $$('.js-form').forEach(function (form) {
    var err = form.querySelector('.form-err');
    var btn = form.querySelector('[type=submit]');
    var btnHtml = btn.innerHTML;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (form.botcheck && form.botcheck.checked) return;
      var data = collect(form);
      var bad = [];
      $$('[required]', form).forEach(function (el) {
        var ok = el.type === 'checkbox' ? el.checked : el.value.trim() !== '';
        if (ok && el.type === 'tel') ok = phoneOk(el.value);
        el.classList.toggle('bad', !ok); if (!ok) bad.push(el);
      });
      if (bad.length) { err.textContent = t('err'); err.hidden = false; return; }
      err.hidden = true;
      btn.disabled = true; btn.textContent = t('sending');
      send(form.getAttribute('data-form'), data).then(function (ok) {
        btn.disabled = false; btn.innerHTML = btnHtml;
        if (!ok) { err.textContent = t('sendFail'); err.hidden = false; return; }
        done(form, data);
      });
    });
  });

  function done(form, data) {
    var wrap = form.parentElement;
    var doneEl = wrap.querySelector('.form-done, .reg-done');
    form.hidden = true; if (doneEl) doneEl.hidden = false;
    if (form.classList.contains('book-form')) {
      var sel = form.querySelector('[name=service]');
      var svcLabel = sel.options[sel.selectedIndex].textContent;
      var dt = data.preferred_date ? new Date(data.preferred_date + 'T00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) : (lang === 'hi' ? 'जल्द से जल्द' : 'Earliest available');
      var rows = [[t('fName'), data.name], [t('fFor'), data.visit_type], [t('fPain'), svcLabel], [t('fClinic'), data.clinic], [t('fDate'), dt]];
      var dl = wrap.querySelector('.summary'); dl.innerHTML = '';
      rows.forEach(function (r) { var d = document.createElement('div'); var a = document.createElement('dt'); a.textContent = r[0]; var b = document.createElement('dd'); b.textContent = r[1] || '—'; d.appendChild(a); d.appendChild(b); dl.appendChild(d); });
    }
  }
  $$('.book-again').forEach(function (b) {
    b.addEventListener('click', function () {
      var f = $('.book-form'); f.reset(); f.hidden = false; b.closest('.form-done').hidden = true;
    });
  });
  if (modal) modal.addEventListener('close', function () {
    var f = $('.reg-form', modal), d = $('.reg-done', modal);
    if (!d.hidden) { f.reset(); f.hidden = false; d.hidden = true; }
  });
})();
