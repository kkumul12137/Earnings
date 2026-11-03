/* Standalone runtime for the earnings dashboard page (replaces the Claude Dashboard runtime). */
(function () {
  const FILES = {earnings: 'data/earnings.json', prices: 'data/prices.json', fin: 'data/fin.json', bench: 'data/bench.json'};
  const store = {};
  const draws = {};
  const onData = [];
  let params = {};
  try { const q = new URLSearchParams(location.search).get('p'); if (q) params = JSON.parse(q) || {}; } catch (e) {}
  let pending = false;
  const schedule = () => { if (pending) return; pending = true; requestAnimationFrame(() => { pending = false; render(); }); };
  function load(id) {
    if (store[id]) return store[id];
    const s = store[id] = {status: 'loading', data: [], columns: [], meta: [], refreshing: false};
    if (!FILES[id]) { s.status = 'missing'; return s; }
    fetch(FILES[id] + '?v=' + (window.DASH_VERSION || '')).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then((j) => { const rows = Array.isArray(j) ? j : (j.rows || j.data || j.results || []); s.data = rows; s.rows = rows; s.columns = rows.length ? Object.keys(rows[0]) : []; s.status = 'ok'; schedule(); })
      .catch((e) => { s.status = 'error'; s.message = String(e); schedule(); });
    return s;
  }
  function visible(el) { return el.isConnected && !el.closest('[hidden]'); }
  function runDraw(name) {
    const fn = draws[name]; if (!fn) return;
    document.querySelectorAll('[data-draw="' + name + '"]').forEach((el) => {
      if (!visible(el)) return;
      el.querySelectorAll('[data-source]').forEach(() => {});
      try {
        if (typeof fn === 'function') fn(el);
        else { if (!el.__made) el.__made = fn.mount ? fn.mount(el) : undefined; if (fn.update) fn.update(el, el.__made); }
      } catch (e) { console.error('draw ' + name, e); }
    });
  }
  function render() {
    onData.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
    Object.keys(draws).forEach(runDraw);
  }
  const colors = ['#2a78d6', '#e07a2f', '#2f9e6b', '#c4497d', '#7a5cd6', '#b8962e', '#3aa5b8', '#8a8a8a'];
  window.dash = {
    data: (id) => load(id),
    draw: (name, fn) => { if (fn === undefined) { runDraw(name); return; } draws[name] = fn; schedule(); },
    onData: (fn) => { onData.push(fn); try { fn(); } catch (e) { console.error(e); } },
    params: () => ({...params}),
    setParams: (o) => {
      for (const [k, v] of Object.entries(o)) { if (v === null || v === undefined || v === '') delete params[k]; else params[k] = v; }
      const u = new URL(location.href);
      if (Object.keys(params).length) u.searchParams.set('p', JSON.stringify(params)); else u.searchParams.delete('p');
      history.replaceState(null, '', u);
      schedule();
    },
    resetParams: () => { params = {}; dash.setParams({}); },
    setLink: (name) => { const u = new URL(location.href); u.hash = name ? '#' + name : ''; history.replaceState(null, '', u); },
    refresh: () => {}, calc: () => {}, loader: () => {},
    colors,
  };
  // re-render when hidden attributes change (drawings under [hidden] skip) and on resize
  new MutationObserver((ms) => { if (ms.some((m) => (m.oldValue !== null) !== m.target.hasAttribute('hidden'))) schedule(); })
    .observe(document.documentElement, {subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ['hidden']});
  let w = 0; new ResizeObserver(() => { const nw = document.documentElement.clientWidth; if (nw !== w) { w = nw; schedule(); } }).observe(document.documentElement);
})();
