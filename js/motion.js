// Motion between sections: cards ease in as they scroll into view, the section you jump to
// pulses on arrival, and panels, tabs, forms and the edit window animate when they open.

const Motion = (() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Run a one-shot CSS animation class on an element and clean up afterwards
  function play(el, cls) {
    if (reduce.matches || !el) return;
    el.classList.remove(cls);
    void el.offsetWidth; // restart the animation if it is already playing
    el.classList.add(cls);
    const done = (e) => { if (e && e.target !== el) return; el.classList.remove(cls); el.removeEventListener('animationend', done); };
    el.addEventListener('animationend', done);
    setTimeout(done, 1400);
  }

  /** Called after jumping to a section from the menu: a short ring pulse once the scroll settles. */
  function arrive(el) {
    if (!el || reduce.matches) return;
    let fired = false;
    const go = () => { if (fired) return; fired = true; play(el, 'section-arrive'); };
    if ('onscrollend' in window) window.addEventListener('scrollend', go, { once: true });
    setTimeout(go, 900);
  }

  function initReveal() {
    const cards = [...document.querySelectorAll('main > section')];
    if (reduce.matches || !('IntersectionObserver' in window)) return;
    // Start hidden without a transition (otherwise they would visibly fade out first), then allow transitions
    cards.forEach((c) => c.classList.add('reveal', 'reveal-init'));
    void document.body.offsetWidth; // flush styles so the hidden state is applied instantly
    cards.forEach((c) => c.classList.remove('reveal-init'));
    let reported = false;
    const io = new IntersectionObserver((entries) => {
      reported = true;
      let n = 0;
      entries.filter((e) => e.isIntersecting).forEach((e) => {
        e.target.style.transitionDelay = `${n++ * 80}ms`; // cards that appear together land one after another
        e.target.classList.add('in');
        io.unobserve(e.target);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });
    cards.forEach((c) => io.observe(c));
    // If the observer never reports (throttled or unsupported environment), show everything rather than hide it
    setTimeout(() => { if (!reported) cards.forEach((c) => c.classList.add('in')); }, 2000);
  }

  // Anything the app un-hides (statement panel, account tabs, forms, the edit window) eases in
  function initViews() {
    const SKIP = /^(TR|TD|TH|OPTION|SVG|PATH)$/i;
    new MutationObserver((muts) => {
      for (const m of muts) {
        const el = m.target;
        if (SKIP.test(el.tagName) || el.closest('#appLoader, #loginOverlay')) continue;
        const wasHidden = /(^|\s)hidden(\s|$)/.test(m.oldValue || '');
        if (!wasHidden || el.classList.contains('hidden')) continue;
        if (el.classList.contains('reveal') && !el.classList.contains('in')) continue; // reveal handles it
        play(el, 'view-in');
      }
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true });
  }

  document.addEventListener('DOMContentLoaded', () => { initReveal(); initViews(); });
  return { arrive, play };
})();

window.Motion = Motion;
