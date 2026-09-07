'use strict';

(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const scrollByView = { beauty: 0, journeys: 0 };
  let activeView = location.hash === '#journeys' ? 'journeys' : 'beauty';
  let lightboxOpener = null;
  let pointerStart = null;

  function syncTabs(view = activeView) {
    activeView = view === 'journeys' ? 'journeys' : 'beauty';
    document.body.dataset.view = activeView;
    $$('[data-view-target]').forEach((button) => {
      const on = button.dataset.viewTarget === activeView;
      button.setAttribute('aria-current', on ? 'page' : 'false');
      if (button.classList.contains('mobile-tab')) button.tabIndex = on ? 0 : -1;
    });
  }

  syncTabs();

  $$('[data-view-target]').forEach((button) => {
    button.addEventListener('click', () => {
      const next = button.dataset.viewTarget === 'journeys' ? 'journeys' : 'beauty';
      if (next === activeView) return;
      scrollByView[activeView] = window.scrollY;
      activeView = next;
      syncTabs(next);
      requestAnimationFrame(() => window.scrollTo({ top: scrollByView[next] || 0, behavior: 'auto' }));
    });
  });

  window.addEventListener('hashchange', () => syncTabs(location.hash === '#journeys' ? 'journeys' : 'beauty'));

  const entries = $('#entries');
  if (entries) {
    entries.addEventListener('click', (event) => {
      const opener = event.target.closest('[data-entry][data-index],[data-source]');
      if (opener) lightboxOpener = opener;
    }, true);
  }

  const hero = $('#heroCard');
  hero?.addEventListener('click', () => { lightboxOpener = hero; }, true);

  const lightbox = $('#lightbox');
  if (lightbox) {
    lightbox.addEventListener('click', (event) => {
      if (event.target === lightbox) lightbox.close();
    });

    lightbox.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'touch') return;
      pointerStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
    });

    lightbox.addEventListener('pointerup', (event) => {
      if (!pointerStart || pointerStart.id !== event.pointerId) return;
      const dx = event.clientX - pointerStart.x;
      const dy = event.clientY - pointerStart.y;
      pointerStart = null;
      if (Math.abs(dx) < 55 || Math.abs(dx) <= Math.abs(dy) * 1.2) return;
      (dx > 0 ? $('#prevPhoto') : $('#nextPhoto'))?.click();
    });

    lightbox.addEventListener('close', () => {
      requestAnimationFrame(() => lightboxOpener?.focus?.({ preventScroll: true }));
    });
  }

  const journeys = $('#journeys');
  journeys?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-journey]');
    if (!button) return;
    requestAnimationFrame(() => {
      const detail = document.querySelector(`[data-detail="${CSS.escape(button.dataset.journey || '')}"]`);
      button.setAttribute('aria-expanded', detail && !detail.hidden ? 'true' : 'false');
    });
  });

  $('.mobile-tabs')?.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    const tabs = $$('.mobile-tab');
    const current = Math.max(0, tabs.indexOf(document.activeElement));
    const next = (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    event.preventDefault();
    tabs[next]?.focus();
    tabs[next]?.click();
  });
})();
