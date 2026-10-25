// Section navigation: desktop top links and mobile sidebar drawer

document.addEventListener('DOMContentLoaded', () => {
  const drawer = document.getElementById('navDrawer');
  const backdrop = document.getElementById('navBackdrop');
  const menuBtn = document.getElementById('menuBtn');
  const links = [...document.querySelectorAll('[data-nav]')];

  function setOpen(open) {
    drawer.classList.toggle('is-open', open);
    backdrop.classList.toggle('hidden', !open);
    document.body.style.overflow = open ? 'hidden' : '';
  }

  menuBtn?.addEventListener('click', () => setOpen(true));
  document.getElementById('navCloseBtn')?.addEventListener('click', () => setOpen(false));
  backdrop?.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
  // Leaving the phone layout while the drawer is open would leave the page locked
  window.matchMedia('(min-width: 768px)').addEventListener('change', (e) => { if (e.matches) setOpen(false); });

  links.forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById(a.dataset.nav)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setOpen(false);
  }));

  // Sign out and user name inside the drawer mirror the header
  document.getElementById('drawerLogoutBtn')?.addEventListener('click', () => document.getElementById('logoutBtn')?.click());
  const name = document.getElementById('currentUserName')?.textContent;
  const drawerName = document.getElementById('drawerUserName');
  if (drawerName && name) drawerName.textContent = `Signed in as ${name}`;

  // Highlight the section currently in view
  const targets = links.map((a) => document.getElementById(a.dataset.nav)).filter(Boolean);
  const unique = [...new Set(targets)];
  const onScroll = () => {
    let current = unique[0]?.id;
    for (const t of unique) {
      if (t.getBoundingClientRect().top <= 120) current = t.id;
    }
    links.forEach((a) => a.classList.toggle('is-active', a.dataset.nav === current));
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  // Data loading changes section positions without a scroll event, so re-check when the page height changes
  if (window.ResizeObserver) new ResizeObserver(onScroll).observe(document.body);
  onScroll();
});
