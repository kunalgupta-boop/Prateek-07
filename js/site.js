/* Navigation and lightweight motion. No animation libraries required. */
(() => {
  'use strict';

  document.documentElement.classList.add('js-enabled');
  const menu = document.querySelector('#main-navigation');
  const toggle = document.querySelector('.menu-toggle');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');


  // Replace the public "Log In" link with the signed-in user's first initial.
  // The session itself remains server-side; this only changes the navigation UI.
  async function updateAuthNavigation() {
    const loginLink = document.querySelector('.login-link');
    if (!loginLink) return;

    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'same-origin',
        cache: 'no-store'
      });

      if (!response.ok) return;

      const user = await response.json();
      const fullName = typeof user.fullName === 'string' ? user.fullName.trim() : '';
      if (user.authenticated !== true || !fullName) return;

      const firstLetter = Array.from(fullName)[0].toUpperCase();
      loginLink.textContent = firstLetter;
      loginLink.href = 'dashboard.html';
      loginLink.classList.add('user-avatar-link');
      loginLink.setAttribute('aria-label', 'Open account for ' + fullName);
      loginLink.setAttribute('title', fullName);
    } catch (_) {
      // If the session check fails, keep the normal Log In link visible.
    }
  }

  updateAuthNavigation();

  function closeMenu() {
    menu.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open menu');
  }

  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    menu.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  });

  menu.addEventListener('click', (event) => {
    if (event.target.closest('a')) closeMenu();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu.classList.contains('is-open')) {
      closeMenu();
      toggle.focus();
    }
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.nav-container')) closeMenu();
  });

  window.matchMedia('(min-width: 961px)').addEventListener('change', closeMenu);

  if ('IntersectionObserver' in window && !reducedMotion.matches) {
    const reveal = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.07 });

    document.querySelectorAll('.reveal').forEach((item) => {
      item.classList.add('will-reveal');
      reveal.observe(item);
    });
  }

  const links = [...menu.querySelectorAll('a[href^="#"]')];
  const sections = links.map((link) => document.querySelector(link.hash)).filter(Boolean);
  const topButton = document.querySelector('.back-to-top');
  let scheduled = false;

  function updateScrollState() {
    const current = [...sections].reverse().find((section) => section.getBoundingClientRect().top <= 150);
    links.forEach((link) => {
      const active = link.hash === '#' + (current?.id || 'top');
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    topButton.hidden = window.scrollY < 650;
    scheduled = false;
  }

  window.addEventListener('scroll', () => {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(updateScrollState);
  }, { passive: true });

  topButton.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
    document.querySelector('.brand-logo').focus({ preventScroll: true });
  });
  updateScrollState();
})();
