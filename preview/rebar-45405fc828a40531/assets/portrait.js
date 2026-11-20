(() => {
  const media = matchMedia('(max-width: 730px), (max-height: 540px), (prefers-reduced-motion: reduce)');
  const motion = matchMedia('(min-height: 540px) and (prefers-reduced-motion: no-preference)');
  const camera = document.querySelector('.p-camera');
  const frame = camera.querySelector('.p-camera-frame');
  const picture = frame.querySelector('svg');
  const next = document.querySelector('.p-beat-radar');
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  if (!CSS.supports('position', 'sticky') || !CSS.supports('height', '1svh')) return;
  let pending = 0;
  let listening = false;

  function update() {
    pending = 0;
    const screen = document.documentElement.clientHeight;
    const height = frame.clientHeight;
    if (!height || !screen) return;
    // Change crops while the next caption approaches, not after it arrives.
    const distance = next.getBoundingClientRect().top;
    const end = Math.max(screen * .59, camera.getBoundingClientRect().bottom + 12);
    const start = Math.max(screen * .90, end + 45);
    const t = clamp((start - distance) / (start - end), 0, 1);
    const ease = t * t * (3 - 2 * t);
    const centerX = 691 - 321 * ease;
    const centerY = 281 + 19 * ease;
    const ratio = frame.clientWidth / height;
    const h = clamp(340 / ratio, 398, 550);
    const w = Math.min(1000, h * ratio);
    const x = clamp(centerX - w / 2, 0, 1000 - w);
    const y = clamp(centerY - h / 2, 0, 558 - h);
    picture.setAttribute('viewBox', [x, y, w, h].map(v => v.toFixed(2)).join(' '));
    camera.dataset.focus = t <= .15 ? 'people' : t >= .87 ? 'radar' : 'between';
  }

  function queue() {
    if (!pending) pending = requestAnimationFrame(update);
  }

  function sync() {
    const enabled = media.matches && motion.matches;
    document.documentElement.classList.toggle('p-enhanced', enabled);
    if (enabled === listening) {
      if (enabled) queue();
      return;
    }
    listening = enabled;
    if (enabled) {
      window.addEventListener('scroll', queue, {passive: true});
      window.addEventListener('resize', queue);
      queue();
    } else {
      window.removeEventListener('scroll', queue);
      window.removeEventListener('resize', queue);
      cancelAnimationFrame(pending);
      pending = 0;
    }
  }
  media.addEventListener('change', sync);
  motion.addEventListener('change', sync);
  sync();
})();
