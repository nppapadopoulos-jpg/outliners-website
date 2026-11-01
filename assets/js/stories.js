/* OutLiners editorial hero: progressive enhancement, no external dependencies. */
(() => {
  const hero = document.querySelector('.hero--stories');
  if (!hero) return;
  const image = hero.querySelector('.story-image');
  const tabs = Array.from(hero.querySelectorAll('.story-tab'));
  const panel = hero.querySelector('#story-panel');
  const count = hero.querySelector('.story-count');
  const play = hero.querySelector('.story-play');
  const greek = document.documentElement.lang === 'el';
  const paths = ['determination.webp','vision.webp','responsibility.webp','innovation.webp'];
  const loaded = new Map();
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let current = 0, timer = null, playing = !reduceMotion.matches, requestId = 0;
  const preload = (index) => {
    if (loaded.has(index)) return loaded.get(index);
    const promise = new Promise((resolve) => {
      const asset = new Image();
      asset.onload = () => resolve(asset);
      asset.onerror = () => resolve(null);
      asset.src = '/assets/img/stories/' + paths[index];
    });
    loaded.set(index, promise);
    return promise;
  };
  const setPlayUI = () => {
    play.setAttribute('aria-pressed', String(playing));
    play.setAttribute('aria-label', greek ? (playing ? 'Παύση εναλλαγής ιστοριών' : 'Έναρξη εναλλαγής ιστοριών') : (playing ? 'Pause story rotation' : 'Resume story rotation'));
    play.querySelector('span').textContent = playing ? 'Ⅱ' : '▶';
  };
  const stopTimer = () => { if (timer !== null) clearInterval(timer); timer = null; };
  const schedule = () => {
    stopTimer();
    if (playing && !document.hidden) timer = setInterval(() => select((current + 1) % tabs.length, false), 6000);
  };
  async function select(index, userAction) {
    if (userAction) schedule();
    const id = ++requestId;
    const asset = await preload(index);
    if (id !== requestId) return;
    // Keep the existing approved photo as a safe fallback until standalone assets arrive.
    if (asset) {
      image.src = asset.src;
      image.width = asset.naturalWidth;
      image.height = asset.naturalHeight;
    }
    current = index;
    tabs.forEach((tab, i) => {
      tab.classList.toggle('is-active', i === index);
      tab.setAttribute('aria-selected', String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
    });
    panel.setAttribute('aria-labelledby', tabs[index].id);
    count.textContent = '0' + (index + 1) + ' / 04';
  }
  tabs.forEach((tab, index) => {
    tab.tabIndex = index === 0 ? 0 : -1;
    tab.addEventListener('click', () => select(index, true));
    tab.addEventListener('keydown', (event) => {
      let next;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index + tabs.length - 1) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault();
      tabs[next].focus();
      select(next, true);
    });
  });
  play.addEventListener('click', () => { playing = !playing; setPlayUI(); schedule(); });
  document.addEventListener('visibilitychange', schedule);
  reduceMotion.addEventListener('change', () => { if (reduceMotion.matches) { playing = false; setPlayUI(); schedule(); } });
  setPlayUI();
  // Only replace the fallback after the first standalone photograph is available.
  select(0, false);
  schedule();
  paths.forEach((_, index) => { if (index) preload(index); });
})();
