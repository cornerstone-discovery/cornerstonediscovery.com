// Site behaviour, no dependencies (replaces jQuery + bootstrap.js):
// mobile nav, About Us accordion, testimonial carousel, lazy reCAPTCHA,
// GA4 key events, and the contact/newsletter/landing-page forms.
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- nav: mark the current section (the server marks most pages; this catches the rest)
  var here = window.location.pathname;
  $$('#menu-primary-menu a').forEach(function (a) {
    var href = a.getAttribute('href');
    if (href && href !== '/' && here.indexOf(href) === 0) { a.parentNode.classList.add('active'); }
  });

  // ---- Bootstrap-style collapse: mobile nav toggle and the About Us team accordion
  function setOpen(target, open, trigger) {
    target.classList.toggle('in', open);
    if (trigger) {
      trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
      trigger.classList.toggle('collapsed', !open);
      var icon = trigger.querySelector('i.indicator');
      if (icon) {
        icon.classList.toggle('fa-chevron-up', open);
        icon.classList.toggle('fa-chevron-down', !open);
      }
    }
  }
  document.addEventListener('click', function (e) {
    var trigger = e.target.closest('[data-toggle="collapse"]');
    if (!trigger) { return; }
    e.preventDefault();
    var target = document.querySelector(trigger.getAttribute('data-target') || trigger.getAttribute('href'));
    if (!target) { return; }
    var open = !target.classList.contains('in');
    var parentSel = trigger.getAttribute('data-parent');
    if (open && parentSel) {
      $$('.panel-collapse.in', document.querySelector(parentSel)).forEach(function (other) {
        if (other !== target) {
          setOpen(other, false, document.querySelector('[data-toggle="collapse"][href="#' + other.id + '"]'));
        }
      });
    }
    setOpen(target, open, trigger);
  });

  // ---- testimonial carousel (Bootstrap 3 markup; slide classes so the theme CSS animates it)
  $$('.carousel[data-ride="carousel"]').forEach(function (carousel) {
    var items = $$('.item', carousel);
    if (items.length < 2) { return; }
    var interval = parseInt(carousel.getAttribute('data-interval'), 10) || 5000;
    var busy = false;
    var timer = null;

    function current() { return items.findIndex(function (i) { return i.classList.contains('active'); }); }
    function go(dir) {
      if (busy) { return; }
      var from = items[current()];
      var to = items[(current() + (dir === 'next' ? 1 : items.length - 1)) % items.length];
      if (reduceMotion) {
        from.classList.remove('active'); to.classList.add('active');
        return;
      }
      busy = true;
      var side = dir === 'next' ? 'left' : 'right';
      to.classList.add(dir);
      void to.offsetWidth; // force reflow so the transition runs
      from.classList.add(side);
      to.classList.add(side);
      var done = function () {
        to.classList.remove(dir, side); to.classList.add('active');
        from.classList.remove('active', side);
        busy = false;
      };
      var fired = false;
      from.addEventListener('transitionend', function once() { from.removeEventListener('transitionend', once); if (!fired) { fired = true; done(); } });
      setTimeout(function () { if (!fired) { fired = true; done(); } }, 700);
    }
    function start() { stop(); if (!reduceMotion) { timer = setInterval(function () { go('next'); }, interval); } }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }

    $$('[data-slide]', carousel).forEach(function (btn) {
      btn.addEventListener('click', function (e) { e.preventDefault(); go(btn.getAttribute('data-slide')); start(); });
    });
    carousel.addEventListener('mouseenter', stop);
    carousel.addEventListener('mouseleave', start);
    carousel.addEventListener('focusin', stop);
    carousel.addEventListener('focusout', start);
    document.addEventListener('visibilitychange', function () { if (document.hidden) { stop(); } else { start(); } });
    start();
  });

  // ---- GA4 key events (no-ops when analytics isn't configured)
  function track(name, params) {
    if (typeof window.gtag === 'function') { window.gtag('event', name, params || {}); }
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="tel:"], a[href^="mailto:"]');
    if (!a) { return; }
    track(a.protocol === 'tel:' ? 'click_to_call' : 'click_to_email', { link_url: a.href, page_location: window.location.href });
  });

  // ---- reCAPTCHA: fetch Google's script only once a form is near the viewport or touched
  var captchaLoaded = false;
  function loadCaptcha() {
    if (captchaLoaded || !document.querySelector('.g-recaptcha')) { return; }
    captchaLoaded = true;
    var s = document.createElement('script');
    s.src = 'https://www.google.com/recaptcha/api.js';
    s.async = true;
    document.head.appendChild(s);
  }
  var forms = $$('form.js-contact-form');
  if (forms.length && document.querySelector('.g-recaptcha')) {
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        if (entries.some(function (en) { return en.isIntersecting; })) { loadCaptcha(); io.disconnect(); }
      }, { rootMargin: '400px' });
      forms.forEach(function (f) { io.observe(f); });
    } else {
      loadCaptcha();
    }
    forms.forEach(function (f) { f.addEventListener('focusin', loadCaptcha, { once: true }); });
  }

  // ---- checkbox groups: "Select All", and "at least one" for required groups
  document.addEventListener('change', function (e) {
    if (!e.target.classList.contains('js-select-all')) { return; }
    $$('input[type=checkbox]', e.target.closest('fieldset')).forEach(function (cb) {
      if (cb !== e.target) { cb.checked = e.target.checked; }
    });
  });
  function missingRequiredGroup(form) {
    var groups = $$('fieldset.js-require-one', form);
    for (var i = 0; i < groups.length; i++) {
      if (!$('input[type=checkbox]:not(.js-select-all):checked', groups[i])) {
        var legend = $('legend', groups[i]);
        return legend ? legend.textContent.replace(/\s*(\*|\(Required\))\s*$/, '').trim() : 'options';
      }
    }
    return null;
  }

  // ---- forms: submit to the worker with fetch; a plain POST still works without JS
  forms.forEach(function (form) {
    var status = $('.form-status', form);
    var button = $('button[type=submit]', form);

    function show(kind, msg) {
      status.classList.remove('alert-success', 'alert-danger', 'hidden');
      status.classList.add('alert-' + kind);
      status.textContent = msg;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      var group = missingRequiredGroup(form);
      if (group) { show('danger', 'Please choose at least one option for "' + group + '".'); return; }
      if (form.hasAttribute('data-unconnected')) {
        show('danger', 'Online submissions aren’t switched on yet. Please call (267) 639-6900 or email info@cornerstonediscovery.com.');
        return;
      }
      if ($('.g-recaptcha', form) && (!window.grecaptcha || !window.grecaptcha.getResponse())) {
        loadCaptcha();
        show('danger', 'Please check the "I\'m not a robot" box.');
        return;
      }
      button.disabled = true;
      fetch(form.getAttribute('action'), {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: new FormData(form)
      })
        .then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
        .then(function (data) {
          if (data.ok) {
            show('success', 'Thanks — your message is on its way. We\'ll get right back to you.');
            var idField = form.querySelector('input[name=form_id]');
            var fid = (idField && idField.value) || 'contact';
            track(fid === 'newsletter' ? 'sign_up' : 'generate_lead', { form_id: fid, page_location: window.location.href });
            if (window.CSD_ADS_LEAD && fid !== 'newsletter') { track('conversion', { send_to: window.CSD_ADS_LEAD }); }
            form.reset();
          } else {
            show('danger', data.error || 'Something went wrong sending your message. Please email or call us instead.');
          }
        })
        .catch(function () {
          show('danger', 'We couldn\'t reach the server. Please email or call us instead.');
        })
        .then(function () {
          button.disabled = false;
          if (window.grecaptcha) { try { window.grecaptcha.reset(); } catch (err) { /* widget not rendered */ } }
        });
    });
  });
})();
