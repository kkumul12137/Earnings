/* 전 종목 검색 + 종목 상세 (미·한·일). 원천: SEC·DART·EDINET(사실), stockanalysis(시세·차트·지표, 일본 분기재무).
   데이터는 Worker 프록시(window.STOCK_API)를 거쳐 받고, 파싱은 여기서 한다. */
(function () {
  'use strict';
  const BASE = (document.currentScript && document.currentScript.src) ? new URL('.', document.currentScript.src).href : 'stock/';
  const API = () => (window.STOCK_API || '').replace(/\/$/, '');
  const MK = {U: '미장', K: '국장', J: '일장'};
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const $ = (sel, el) => (el || document).querySelector(sel);

  // ---------- 네트워크 ----------
  const memo = new Map();
  function px(src, path, params, kind) {
    if (!API()) return Promise.reject(new Error('no-api'));
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    const url = `${API()}/p/${src}/${path}${qs}`;
    if (!memo.has(url)) {
      memo.set(url, fetch(url).then((r) => { if (!r.ok) throw new Error(src + ' ' + r.status); return kind === 'text' ? r.text() : r.json(); })
        .catch((e) => { memo.delete(url); throw e; }));
    }
    return memo.get(url);
  }
  let UNI = null;
  function universe() {
    if (!UNI) UNI = fetch(BASE + 'universe.json').then((r) => r.json()).then((j) => j.r.map((r) => ({m: r[0], sym: String(r[1]), name: r[2] || '', alt: r[3] || '', id: r[4], x: r[5], ind: r[6]})));
    return UNI;
  }

  // ---------- 포맷 ----------
  const nf = (v, d = 0) => (v == null || isNaN(v)) ? '—' : Number(v).toLocaleString('ko-KR', {maximumFractionDigits: d, minimumFractionDigits: d});
  const pct = (v, d = 1) => (v == null || !isFinite(v)) ? '—' : (v > 0 ? '+' : '') + v.toFixed(d) + '%';
  function money(v, cur) {
    if (v == null || isNaN(v)) return '—';
    const a = Math.abs(v), s = v < 0 ? '-' : '';
    if (cur === 'KRW') return a >= 1e12 ? s + nf(a / 1e12, 2) + '조' : s + nf(a / 1e8, 0) + '억';
    if (cur === 'JPY') return a >= 1e12 ? s + nf(a / 1e12, 2) + '兆円' : s + nf(a / 1e8, 0) + '億円';
    const p = cur && cur !== 'USD' ? cur + ' ' : '$';
    return a >= 1e9 ? s + p + nf(a / 1e9, 2) + 'B' : s + p + nf(a / 1e6, 0) + 'M';
  }
  const norm = (s) => String(s || '').normalize('NFKC').toLowerCase().replace(/[\s.,()㈜]|株式会社|\(주\)|주식회사|inc|corp|co\b|ltd/g, '');

  // ---------- 스타일 ----------
  const css = `
.stk-bar{position:sticky;top:0;z-index:30;display:flex;gap:8px;align-items:center;padding:8px 0 10px;background:var(--color-bg)}
.stk-q{flex:1;min-width:0;font:inherit;font-size:15px;padding:10px 12px;border:1px solid var(--color-border-line);border-radius:var(--cds-radius,8px);background:var(--color-panel);color:var(--color-fg)}
.stk-q:focus{outline:2px solid color-mix(in srgb,var(--color-fg) 30%,transparent);outline-offset:1px}
.stk-dd{position:absolute;left:0;right:0;top:100%;margin-top:-4px;background:var(--cds-surface-popover,var(--color-panel));box-shadow:var(--cds-shadow-popover);border:1px solid var(--color-border-line);border-radius:8px;max-height:60vh;overflow:auto;z-index:31}
.stk-dd button{display:flex;gap:8px;align-items:baseline;width:100%;text-align:left;padding:8px 12px;border:0;background:none;color:inherit;font:inherit;cursor:pointer}
.stk-dd button:hover,.stk-dd button.on{background:color-mix(in srgb,var(--color-fg) 7%,transparent)}
.stk-dd small{color:var(--color-fg-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.stk-tag{font-size:11px;padding:1px 6px;border-radius:4px;background:color-mix(in srgb,var(--color-fg) 9%,transparent);white-space:nowrap}
.stk-sym{font-weight:600;min-width:58px}
.stk-ov{position:fixed;inset:0;z-index:100;background:var(--color-bg);overflow:auto;-webkit-overflow-scrolling:touch}
.stk-in{max-width:1100px;margin:0 auto;padding:12px 16px 64px}
.stk-top{display:flex;gap:8px;align-items:center;position:sticky;top:0;background:var(--color-bg);padding:8px 0;z-index:2}
.stk-top .stk-q{max-width:520px}
.stk-x{font:inherit;padding:9px 12px;border:1px solid var(--color-border-line);border-radius:8px;background:var(--color-panel);color:inherit;cursor:pointer;white-space:nowrap}
.stk-h{display:flex;flex-wrap:wrap;gap:4px 16px;align-items:baseline;margin:12px 0 4px}
.stk-h h2{margin:0;font-size:24px}
.stk-px{font-size:26px;font-weight:600}
.stk-up{color:var(--color-ok)}.stk-dn{color:var(--color-bad)}
.stk-mut{color:var(--color-fg-muted);font-size:13px}
.stk-card{background:var(--color-panel);border:1px solid var(--color-border-line);border-radius:10px;padding:14px 16px;margin-top:14px}
.stk-card h3{margin:0 0 10px;font-size:16px;display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}
.stk-card h3 em{font-style:normal;font-weight:400;font-size:12px;color:var(--color-fg-muted)}
.stk-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px 16px}
.stk-grid div b{display:block;font-size:12px;font-weight:400;color:var(--color-fg-muted)}
.stk-grid div span{font-size:15px;font-weight:600;overflow-wrap:anywhere}
.stk-rng{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px}
.stk-rng button{font:inherit;font-size:12px;padding:4px 10px;border:1px solid var(--color-border-line);border-radius:6px;background:none;color:inherit;cursor:pointer}
.stk-rng button[aria-pressed=true]{background:var(--color-fg);color:var(--color-bg);border-color:var(--color-fg)}
.stk-chart{position:relative;height:260px}
.stk-chart svg{display:block;width:100%;height:100%;touch-action:pan-y}
.stk-tip{position:absolute;pointer-events:none;background:var(--cds-surface-popover,var(--color-panel));box-shadow:var(--cds-shadow-popover);border-radius:6px;padding:4px 8px;font-size:12px;white-space:nowrap}
.stk-tw{overflow-x:auto}
.stk-t{border-collapse:collapse;width:100%;font-size:13px;font-variant-numeric:tabular-nums}
.stk-t th,.stk-t td{padding:6px 8px;border-bottom:1px solid var(--color-border-line);text-align:right;white-space:nowrap}
.stk-t th:first-child,.stk-t td:first-child{text-align:left;position:sticky;left:0;background:var(--color-panel)}
.stk-t td small{display:block;font-size:11px}
.stk-list{list-style:none;margin:0;padding:0}
.stk-list li{padding:7px 0;border-bottom:1px solid var(--color-border-line);display:flex;gap:8px;flex-wrap:wrap;align-items:baseline}
.stk-list li:last-child{border-bottom:0}
.stk-list a{color:inherit}
.stk-ir{background:color-mix(in srgb,var(--color-ok) 18%,transparent)}
.stk-desc{margin:0;line-height:1.6;font-size:14px}
.stk-err{color:var(--color-warn);font-size:13px}
.stk-dlink{margin-left:auto;font:inherit;font-size:12px;padding:4px 10px;border:1px solid var(--color-border-line);border-radius:6px;background:none;color:inherit;cursor:pointer}
@media (max-width:600px){.stk-h h2{font-size:20px}.stk-px{font-size:22px}.stk-chart{height:220px}}
`;
  function addCss() { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); }

  // ---------- 검색 ----------
  async function search(q) {
    q = q.trim(); if (!q) return [];
    const u = await universe();
    const nq = norm(q), uq = q.toUpperCase();
    const scored = [];
    for (const r of u) {
      let s = 0;
      if (r.sym.toUpperCase() === uq) s = 100;
      else if (r.sym.toUpperCase().startsWith(uq)) s = 60;
      else {
        const n = norm(r.name), a = norm(r.alt);
        if (n === nq || a === nq) s = 90;
        else if (n.startsWith(nq) || a.startsWith(nq)) s = 50;
        else if (nq.length >= 2 && (n.includes(nq) || a.includes(nq))) s = 20;
      }
      if (s) { if (r.m === 'U' && /^[A-Z]+$/.test(r.sym) && r.x) s += 2; scored.push([s - r.sym.length * 0.01, r]); }
    }
    scored.sort((a, b) => b[0] - a[0]);
    const out = scored.slice(0, 12).map((x) => x[1]);
    if (out.length < 5 && API()) { // 인덱스에 없으면 stockanalysis 검색으로 보충(영문)
      try {
        const j = await px('sa', 'api/search', {q});
        for (const d of (j.data || [])) {
          const m = /^(krx|kosdaq)\/(\w+)/i.exec(d.s) ? 'K' : /^tyo\/(\w+)/i.exec(d.s) ? 'J' : (d.t === 's' && !d.s.includes('/')) ? 'U' : null;
          if (!m) continue;
          const sym = m === 'U' ? d.s : d.s.split('/')[1];
          if (out.some((r) => r.m === m && r.sym === sym)) continue;
          const known = u.find((r) => r.m === m && r.sym === sym);
          out.push(known || {m, sym, name: d.n, alt: '', id: null, x: m === 'K' ? (/^kosdaq/i.test(d.s) ? 'KOSDAQ' : 'KOSPI') : null});
          if (out.length >= 12) break;
        }
      } catch (e) { /* 보충 실패는 무시 */ }
    }
    return out;
  }
  function mountSearch(host, opts) {
    const wrap = document.createElement('div'); wrap.style.position = 'relative'; wrap.style.flex = '1'; wrap.style.minWidth = '0';
    wrap.innerHTML = `<input class="stk-q" type="search" placeholder="종목 검색: 티커·회사명 (AAPL, 삼성전자, 005930, トヨタ, 7203)" aria-label="종목 검색" autocomplete="off" spellcheck="false"><div class="stk-dd" hidden role="listbox"></div>`;
    host.appendChild(wrap);
    const inp = $('input', wrap), dd = $('.stk-dd', wrap);
    let items = [], on = -1, seq = 0;
    const draw = () => {
      dd.hidden = !items.length;
      dd.innerHTML = items.map((r, i) => `<button type="button" role="option" class="${i === on ? 'on' : ''}" data-i="${i}"><span class="stk-tag">${MK[r.m]}</span><span class="stk-sym">${esc(r.sym)}</span><span>${esc(r.name)}</span><small>${esc(r.alt || r.ind || r.x || '')}</small></button>`).join('');
    };
    const pick = (r) => { items = []; draw(); inp.value = ''; inp.blur(); open(r); };
    inp.addEventListener('focus', () => universe());
    inp.addEventListener('input', async () => { const my = ++seq; const r = await search(inp.value); if (my !== seq) return; items = r; on = r.length ? 0 : -1; draw(); });
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' && items.length) { on = (on + 1) % items.length; draw(); e.preventDefault(); }
      else if (e.key === 'ArrowUp' && items.length) { on = (on - 1 + items.length) % items.length; draw(); e.preventDefault(); }
      else if (e.key === 'Enter' && items[on]) { pick(items[on]); e.preventDefault(); }
      else if (e.key === 'Escape') { items = []; draw(); }
    });
    dd.addEventListener('mousedown', (e) => { const b = e.target.closest('button[data-i]'); if (b) { e.preventDefault(); pick(items[+b.dataset.i]); } });
    inp.addEventListener('blur', () => setTimeout(() => { items = []; draw(); }, 150));
    if (opts && opts.focus) setTimeout(() => inp.focus(), 0);
    return inp;
  }

  // ---------- 종목 상세 ----------
  let ov = null;
  function slugs(r) {
    const s = r.sym.toLowerCase();
    if (r.m === 'U') return {q: 's/' + s, page: `stocks/${s}/`, web: `https://stockanalysis.com/stocks/${s}/`};
    if (r.m === 'J') return {q: 'a/tyo-' + s, page: `quote/tyo/${s}/`, web: `https://stockanalysis.com/quote/tyo/${s}/`};
    const ex = r.x === 'KOSDAQ' ? 'kosdaq' : 'krx';
    return {q: `a/${ex}-${s}`, page: `quote/${ex}/${s}/`, web: `https://stockanalysis.com/quote/${ex}/${s}/`};
  }
  async function resolveKR(r) { // 시장 구분을 모르면 stockanalysis 검색으로 확인
    if (r.m !== 'K' || r.x === 'KOSPI' || r.x === 'KOSDAQ') return r;
    try { const j = await px('sa', 'api/search', {q: r.sym}); const d = (j.data || []).find((d) => d.s && d.s.endsWith('/' + r.sym)); if (d) r.x = /^kosdaq/i.test(d.s) ? 'KOSDAQ' : 'KOSPI'; } catch (e) {}
    return r;
  }
  function open(r, push = true) {
    if (!ov) {
      ov = document.createElement('div'); ov.className = 'stk-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
      ov.innerHTML = `<div class="stk-in"><div class="stk-top"></div><div class="stk-body"></div></div>`;
      document.body.appendChild(ov);
      const top = $('.stk-top', ov);
      mountSearch(top);
      const x = document.createElement('button'); x.className = 'stk-x'; x.type = 'button'; x.textContent = '닫기 ✕'; x.onclick = close; top.appendChild(x);
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && ov && !ov.hidden && !e.target.closest('.stk-q')) close(); });
    }
    ov.hidden = false; document.documentElement.style.overflow = 'hidden'; ov.scrollTop = 0;
    if (push) history.pushState({stk: 1}, '', '#s=' + r.m + ':' + encodeURIComponent(r.sym));
    render(r);
  }
  function close() {
    if (!ov) return; ov.hidden = true; document.documentElement.style.overflow = '';
    if (/^#s=/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
  }
  async function fromHash() {
    const m = /^#s=([UKJ]):(.+)$/.exec(location.hash);
    if (!m) { if (ov && !ov.hidden) close(); return; }
    const sym = decodeURIComponent(m[2]);
    const u = await universe();
    open(u.find((r) => r.m === m[1] && r.sym === sym) || {m: m[1], sym, name: sym, alt: '', id: null}, false);
  }

  const card = (id, title, note) => `<section class="stk-card" id="stk-${id}"><h3>${title}${note ? `<em>${note}</em>` : ''}</h3><div class="stk-c"><span class="stk-mut">불러오는 중…</span></div></section>`;
  const fill = (id, html) => { const el = ov && $('#stk-' + id + ' .stk-c', ov); if (el) el.innerHTML = html; return el; };
  const fail = (id, e) => fill(id, `<span class="stk-err">${e && e.message === 'no-api' ? '데이터 서버(Worker)가 아직 연결되지 않았어요.' : '불러오지 못했어요 (' + esc(e && e.message) + ')'}</span>`);

  let cur = 0;
  async function render(r0) {
    const my = ++cur;
    const r = await resolveKR({...r0});
    if (my !== cur) return;
    const sl = slugs(r);
    const body = $('.stk-body', ov);
    const rawFin = r.m === 'U' ? 'SEC XBRL · 사실' : r.m === 'K' ? 'DART 정기보고서 · 사실' : 'stockanalysis · 사실';
    body.innerHTML = `
      <div class="stk-h"><h2>${esc(r.name)}</h2><span class="stk-tag">${MK[r.m]}</span><span class="stk-mut">${esc(r.sym)}${r.x ? ' · ' + esc(r.x) : ''}${r.alt ? ' · ' + esc(r.alt) : ''}</span></div>
      <div class="stk-h" id="stk-quote"><span class="stk-mut">시세 불러오는 중…</span></div>
      ${card('chart', '주가 차트', 'stockanalysis 일별 종가')}
      ${card('stats', '주요 지표', 'stockanalysis')}
      ${card('profile', '기업 정보', r.m === 'U' ? 'SEC EDGAR' : r.m === 'K' ? 'DART' : 'EDINET 코드리스트')}
      ${card('fin', '분기 실적', rawFin)}
      ${card('docs', '실적 공시 · IR 자료', r.m === 'U' ? 'SEC 8-K (Item 2.02)' : r.m === 'K' ? 'DART 공시 목록' : 'TDnet · EDINET')}
      <p class="stk-mut" style="margin-top:14px">어닝콜 스크립트는 아직 넣지 않았어요(유료 데이터). <a href="${sl.web}" target="_blank" rel="noopener">stockanalysis에서 보기 ↗</a></p>`;
    const tasks = [quote(r, sl), chart(r, sl), stats(r, sl), profile(r), fin(r, sl), docs(r)];
    tasks.forEach((p) => p.catch(() => {}));
  }

  async function quote(r, sl) {
    const el = $('#stk-quote', ov);
    try {
      const q = (await px('sa', 'api/quotes/' + sl.q)).data || {};
      const cls = (v) => v > 0 ? 'stk-up' : v < 0 ? 'stk-dn' : '';
      let h = `<span class="stk-px">${nf(q.p, r.m === 'U' ? 2 : 0)}</span><span class="${cls(q.cp)}">${q.c > 0 ? '+' : ''}${nf(q.c, r.m === 'U' ? 2 : 0)} (${pct(q.cp, 2)})</span><span class="stk-mut">${esc(q.u || '')}</span>`;
      if (q.e && q.ep) h += `<span class="stk-mut">${esc(q.es || '시간외')}: <b class="${cls(q.ecp)}">${nf(q.ep, 2)} (${pct(q.ecp, 2)})</b></span>`;
      if (q.h52) h += `<span class="stk-mut">52주 ${nf(q.l52, r.m === 'U' ? 2 : 0)} – ${nf(q.h52, r.m === 'U' ? 2 : 0)}</span>`;
      el.innerHTML = h;
    } catch (e) { el.innerHTML = `<span class="stk-err">${e.message === 'no-api' ? '데이터 서버(Worker)가 아직 연결되지 않았어요. 검색 인덱스만 동작해요.' : '시세를 불러오지 못했어요'}</span>`; }
  }

  // 차트
  async function chart(r, sl) {
    try {
      const j = await px('sa', `api/symbol/${sl.q}/history`, {range: '5Y', period: 'daily'});
      const pts = (j.data || []).map((d) => [d.t, d.a != null ? d.a : d.c]).filter((d) => d[1] != null).sort((a, b) => a[0] < b[0] ? -1 : 1);
      if (!pts.length) return fill('chart', '<span class="stk-mut">데이터 없음</span>');
      const el = fill('chart', `<div class="stk-rng">${['1M', '3M', '6M', 'YTD', '1Y', '3Y', '5Y'].map((k) => `<button type="button" data-r="${k}" aria-pressed="${k === '1Y'}">${k}</button>`).join('')}<span class="stk-mut" data-chg style="margin-left:8px"></span></div><div class="stk-chart"></div>`);
      const box = $('.stk-chart', el);
      const draw = (k) => {
        el.querySelectorAll('[data-r]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.r === k)));
        const last = new Date(pts[pts.length - 1][0]);
        const from = new Date(last);
        if (k === 'YTD') from.setMonth(0, 1); else { const n = parseInt(k); if (k.endsWith('M')) from.setMonth(from.getMonth() - n); else from.setFullYear(from.getFullYear() - n); }
        const fs = from.toISOString().slice(0, 10);
        const p = pts.filter((d) => d[0] >= fs);
        lineChart(box, p, r.m === 'U' ? 2 : 0);
        const ch = p.length > 1 ? (p[p.length - 1][1] / p[0][1] - 1) * 100 : null;
        const c = $('[data-chg]', el); c.textContent = `${k} ${pct(ch)}`; c.className = ch > 0 ? 'stk-up' : ch < 0 ? 'stk-dn' : 'stk-mut';
      };
      el.querySelectorAll('[data-r]').forEach((b) => b.addEventListener('click', () => draw(b.dataset.r)));
      draw('1Y');
    } catch (e) { fail('chart', e); }
  }
  function lineChart(box, p, dec) {
    const W = box.clientWidth || 600, H = box.clientHeight || 260, L = 8, R = 56, T = 10, B = 22;
    const ys = p.map((d) => d[1]); let lo = Math.min(...ys), hi = Math.max(...ys); const pad = (hi - lo) * 0.06 || 1; lo -= pad; hi += pad;
    const x = (i) => L + (W - L - R) * (p.length > 1 ? i / (p.length - 1) : 0.5);
    const y = (v) => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
    const up = p[p.length - 1][1] >= p[0][1];
    const col = up ? 'var(--color-ok)' : 'var(--color-bad)';
    const path = p.map((d, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(d[1]).toFixed(1)).join('');
    const ticks = []; for (let k = 0; k <= 4; k++) ticks.push(lo + (hi - lo) * k / 4);
    const nx = Math.min(5, p.length); const xt = []; for (let k = 0; k < nx; k++) xt.push(Math.round((p.length - 1) * k / Math.max(1, nx - 1)));
    box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="주가 차트">
      ${ticks.map((v) => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--cds-chart-grid)"/><text x="${W - R + 6}" y="${y(v) + 4}" font-size="11" fill="var(--cds-chart-axis)">${nf(v, v < 100 ? Math.max(dec, 1) : 0)}</text>`).join('')}
      ${xt.map((i) => `<text x="${x(i)}" y="${H - 6}" font-size="11" fill="var(--cds-chart-axis)" text-anchor="${i === 0 ? 'start' : i === p.length - 1 ? 'end' : 'middle'}">${p[i][0].slice(2, 7).replace('-', '.')}</text>`).join('')}
      <path d="${path} L${x(p.length - 1)} ${H - B} L${x(0)} ${H - B}Z" fill="${col}" opacity=".08"/>
      <path d="${path}" fill="none" stroke="${col}" stroke-width="1.6"/>
      <line class="hx" y1="${T}" y2="${H - B}" stroke="var(--cds-chart-reference)" stroke-dasharray="3 3" visibility="hidden"/>
      <circle class="hc" r="3.5" fill="${col}" visibility="hidden"/>
      <rect x="0" y="0" width="${W}" height="${H}" fill="transparent"/></svg><div class="stk-tip" hidden></div>`;
    const svg = $('svg', box), tip = $('.stk-tip', box), hx = $('.hx', box), hc = $('.hc', box);
    const move = (ev) => {
      const rc = svg.getBoundingClientRect(); const mx = (ev.clientX - rc.left) * W / rc.width;
      const i = Math.max(0, Math.min(p.length - 1, Math.round((mx - L) / (W - L - R) * (p.length - 1))));
      hx.setAttribute('x1', x(i)); hx.setAttribute('x2', x(i)); hc.setAttribute('cx', x(i)); hc.setAttribute('cy', y(p[i][1]));
      hx.setAttribute('visibility', 'visible'); hc.setAttribute('visibility', 'visible');
      tip.hidden = false; tip.textContent = `${p[i][0]}  ${nf(p[i][1], dec)}  (${pct((p[i][1] / p[0][1] - 1) * 100)})`;
      const tx = x(i) * rc.width / W; tip.style.left = Math.min(rc.width - tip.offsetWidth, Math.max(0, tx - tip.offsetWidth / 2)) + 'px'; tip.style.top = '0px';
    };
    svg.addEventListener('pointermove', move); svg.addEventListener('pointerdown', move);
    svg.addEventListener('pointerleave', () => { tip.hidden = true; hx.setAttribute('visibility', 'hidden'); hc.setAttribute('visibility', 'hidden'); });
  }

  // stockanalysis 페이지 안의 JS 객체 값 읽기
  function jsv(s, k) {
    const m = new RegExp('[{,]' + k + ':(?:"((?:[^"\\\\]|\\\\.)*)"|(-?[\\d.e+-]+|null|true|false))').exec(s);
    if (!m) return null; if (m[1] != null) return m[1].replace(/\\u([\da-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\"/g, '"');
    return m[2] === 'null' ? null : m[2];
  }
  async function stats(r, sl) {
    try {
      const html = await px('sa', sl.page, null, 'text');
      const i = html.indexOf('marketCap:"'); const s = i >= 0 ? html.slice(i - 1, i + 12000) : '';
      const L = [['시가총액', 'marketCap'], ['매출(TTM)', 'revenue'], ['순이익(TTM)', 'netIncome'], ['EPS(TTM)', 'eps'], ['PER', 'peRatio'], ['Fwd PER', 'forwardPE'],
        ['배당', 'dividend'], ['배당락일', 'exDividendDate'], ['베타', 'beta'], ['상장주식수', 'sharesOut'], ['애널리스트', 'analysts'], ['목표가', 'target'], ['다음 실적일', 'earningsDate']];
      const cells = L.map(([n, k]) => [n, jsv(s, k)]).filter((x) => x[1] != null && x[1] !== '' && x[1] !== 'n/a' && !/^(true|false)$/.test(x[1]));
      const tb = /infoTable:\[(.*?)\]/.exec(s);
      const KO = {Industry: '산업', Sector: '섹터', 'IPO Date': '상장일', Employees: '직원 수', 'Stock Exchange': '거래소', Website: '웹사이트', 'Fiscal Year': '회계연도', 'Reporting Currency': '보고 통화', CEO: 'CEO', Country: '국가'};
      if (tb) for (const m of tb[1].matchAll(/\{t:"([^"]+)",v:"((?:[^"\\]|\\.)*)"/g)) if (KO[m[1]]) cells.push([KO[m[1]], m[2]]);
      const desc = jsv(s, 'description');
      const cur = (/Financials in [a-z]+ ([A-Z]{3})/.exec(html) || [])[1];
      fill('stats', (cells.length ? grid(cells) : '<span class="stk-mut">지표 없음</span>') +
        (desc ? `<details style="margin-top:10px"><summary class="stk-mut">회사 설명 (stockanalysis, 영문)</summary><p class="stk-desc">${esc(desc)}</p></details>` : '') +
        (cur ? `<p class="stk-mut" style="margin:8px 0 0">재무 보고 통화 ${cur}</p>` : ''));
    } catch (e) { fail('stats', e); }
  }

  // 기업 정보 + 공시
  const cik10 = (c) => String(c).padStart(10, '0');
  async function cikOf(r) {
    if (r.id) return r.id;
    const u = await universe(); const f = u.find((x) => x.m === r.m && x.sym === r.sym); return f && f.id;
  }
  async function profile(r) {
    try {
      if (r.m === 'U') {
        const cik = await cikOf(r); if (!cik) return fill('profile', '<span class="stk-mut">SEC CIK 없음(외국 상장 등)</span>');
        const s = await px('sec', `submissions/CIK${cik10(cik)}.json`);
        const a = (s.addresses || {}).business || {};
        const fy = s.fiscalYearEnd ? s.fiscalYearEnd.slice(0, 2) + '/' + s.fiscalYearEnd.slice(2) : null;
        const rows = [['정식 명칭', s.name], ['업종(SIC)', s.sicDescription], ['거래소', (s.exchanges || []).join(', ')], ['티커', (s.tickers || []).join(', ')],
          ['회계연도 말', fy], ['설립지', s.stateOfIncorporation], ['본사', [a.city, a.stateOrCountryDescription || a.stateOrCountry].filter(Boolean).join(', ')],
          ['웹사이트', s.website], ['IR', s.investorWebsite], ['CIK', cik]];
        fill('profile', grid(rows));
      } else if (r.m === 'K') {
        if (!r.id) return fill('profile', '<span class="stk-mut">DART 고유번호가 아직 없어요(검색 인덱스 갱신 후 표시).</span>');
        const c = await px('dart', 'company.json', {corp_code: r.id});
        if (c.status !== '000') throw new Error('DART ' + c.status + ' ' + (c.message || ''));
        const cls = {Y: 'KOSPI', K: 'KOSDAQ', N: 'KONEX', E: '기타'}[c.corp_cls];
        fill('profile', grid([['정식 명칭', c.corp_name], ['영문명', c.corp_name_eng], ['시장', cls], ['대표', c.ceo_nm], ['업종코드', c.induty_code], ['설립일', fmtD(c.est_dt)],
          ['결산월', c.acc_mt ? c.acc_mt + '월' : null], ['본사', c.adres], ['홈페이지', c.hm_url], ['IR', c.ir_url], ['DART 고유번호', r.id]]));
      } else {
        fill('profile', grid([['정식 명칭', r.name], ['영문명', r.alt], ['업종', r.ind], ['EDINET 코드', r.id], ['증권코드', r.sym]]));
      }
    } catch (e) { fail('profile', e); }
  }
  const fmtD = (d) => d && /^\d{8}$/.test(d) ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}` : d;
  const link = (v) => /^(https?:\/\/|www\.)/i.test(v || '') ? `<a href="${esc(/^www/i.test(v) ? 'https://' + v : v)}" target="_blank" rel="noopener">${esc(v)}</a>` : esc(v);
  const grid = (rows) => `<div class="stk-grid">${rows.filter((x) => x[1] != null && x[1] !== '').map(([n, v]) => `<div><b>${n}</b><span>${link(v)}</span></div>`).join('')}</div>`;

  async function docs(r) {
    try {
      if (r.m === 'U') {
        const cik = await cikOf(r); if (!cik) return fill('docs', '<span class="stk-mut">SEC 공시 없음</span>');
        const s = await px('sec', `submissions/CIK${cik10(cik)}.json`);
        const f = s.filings.recent; const list = [];
        for (let i = 0; i < f.form.length && list.length < 8; i++) {
          if ((f.form[i] === '8-K' || f.form[i] === '6-K') && (f.form[i] === '6-K' || String(f.items[i]).includes('2.02')))
            list.push({date: f.filingDate[i], form: f.form[i], acc: f.accessionNumber[i], doc: f.primaryDocument[i], rep: f.reportDate[i]});
          if (f.form[i] === '6-K' && list.length >= 8) break;
        }
        const base = (acc) => `https://www.sec.gov/Archives/edgar/data/${+cik}/${acc.replace(/-/g, '')}/`;
        const el = fill('docs', list.length ? `<ul class="stk-list">${list.map((d, i) => `<li data-i="${i}"><b>${d.date}</b><span>${d.form}${d.form === '8-K' ? ' 실적(2.02)' : ''}</span><a href="${base(d.acc)}${esc(d.doc)}" target="_blank" rel="noopener">본문 ↗</a><span class="ex stk-mut">${i < 4 ? '첨부 확인 중…' : ''}</span></li>`).join('')}</ul>
          <p class="stk-mut" style="margin:8px 0 0">EX-99.1은 보통 실적 보도자료, EX-99.2 이후나 PDF는 프레젠테이션인 경우가 많아요(회사마다 다름). 없으면 회사 IR 페이지에만 올라와 있어요.</p>` : '<span class="stk-mut">최근 실적 8-K 없음</span>');
        list.slice(0, 4).forEach(async (d, i) => {
          const sp = el.querySelector(`li[data-i="${i}"] .ex`);
          try {
            const ix = await px('secw', `Archives/edgar/data/${+cik}/${d.acc.replace(/-/g, '')}/index.json`);
            const ex = (ix.directory.item || []).filter((it) => /ex-?99|exhibit99|\.pdf$/i.test(it.name));
            sp.innerHTML = ex.length ? ex.map((it) => { const pres = /\.pdf$/i.test(it.name) || /99[-_.]?[2-9]|99[2-9]|present|slide|deck|investor/i.test(it.name); return `<a class="stk-tag ${pres ? 'stk-ir' : ''}" href="${base(d.acc)}${esc(it.name)}" target="_blank" rel="noopener">${pres ? '자료' : '보도자료'} ${esc(it.name.replace(/^.*?(ex-?99[^.]*)?(\.\w+)$/i, (m0, a, b) => (a || '') + b))}</a>`; }).join(' ') : '첨부 없음';
          } catch (e) { sp.textContent = ''; }
        });
      } else if (r.m === 'K') {
        if (!r.id) return fill('docs', `<span class="stk-mut">DART 고유번호가 아직 없어요. <a href="https://dart.fss.or.kr/dsab007/main.do?option=corp&textCrpNm=${encodeURIComponent(r.name)}" target="_blank" rel="noopener">DART에서 찾기 ↗</a></span>`);
        const d = new Date(); d.setFullYear(d.getFullYear() - 1);
        const j = await px('dart', 'list.json', {corp_code: r.id, bgn_de: d.toISOString().slice(0, 10).replace(/-/g, ''), page_count: '100'});
        if (j.status !== '000' && j.status !== '013') throw new Error('DART ' + j.status);
        const L = (j.list || []).filter((x) => /기업설명회|IR|잠정|실적|분기보고서|반기보고서|사업보고서|결산/.test(x.report_nm)).slice(0, 15);
        fill('docs', L.length ? `<ul class="stk-list">${L.map((x) => { const ir = /기업설명회|IR/.test(x.report_nm); return `<li><b>${fmtD(x.rcept_dt)}</b>${ir ? '<span class="stk-tag stk-ir">IR 자료</span>' : ''}<a href="https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${x.rcept_no}" target="_blank" rel="noopener">${esc(x.report_nm.trim())} ↗</a><span class="stk-mut">${esc(x.flr_nm)}</span></li>`; }).join('')}</ul>
          <p class="stk-mut" style="margin:8px 0 0">'기업설명회(IR)개최' 공시를 열면 첨부파일에 발표 자료 PDF가 있는 경우가 많아요.</p>` : '<span class="stk-mut">최근 1년 실적·IR 공시 없음</span>');
      } else {
        fill('docs', `<ul class="stk-list"><li><a href="https://www.release.tdnet.info/inbs/I_main_00.html" target="_blank" rel="noopener">TDnet 適時開示 ↗</a><span class="stk-mut">決算短信·決算説明資料 (최근 31일)</span></li>
          <li><a href="https://disclosure2.edinet-fsa.go.jp/WEEK0010.aspx" target="_blank" rel="noopener">EDINET ↗</a><span class="stk-mut">有価証券報告書·半期報告書 (${esc(r.id || '')})</span></li></ul>`);
      }
    } catch (e) { fail('docs', e); }
  }

  // ---------- 분기 실적 ----------
  const DAY = 864e5, dur = (a, b) => (Date.parse(b) - Date.parse(a)) / DAY;
  function qSeries(facts, additive = true) { // SEC duration facts → {end: 분기값}
    const by = new Map();
    for (const f of facts || []) { if (!f.start || !f.end) continue; const k = f.start + '|' + f.end; const o = by.get(k); if (!o || f.filed > o.filed) by.set(k, f); }
    const all = [...by.values()], q = {};
    for (const f of all) { const d = dur(f.start, f.end); if (d >= 80 && d <= 100) q[f.end] = f.val; }
    if (additive) for (const f of all) {
      if (q[f.end] != null || dur(f.start, f.end) <= 100) continue;
      const g = all.find((g) => g.start === f.start && dur(g.end, f.end) >= 80 && dur(g.end, f.end) <= 100);
      if (g) q[f.end] = f.val - g.val;
    }
    return q;
  }
  function pickSec(gaap, names, unit = 'USD', additive = true) {
    const out = {};
    for (const n of names) {
      const u = gaap[n] && gaap[n].units && gaap[n].units[unit]; if (!u) continue;
      const q = qSeries(u, additive);
      for (const [k, v] of Object.entries(q)) if (out[k] == null) out[k] = v;
    }
    return out;
  }
  async function finUS(r) {
    const cik = await cikOf(r); if (!cik) throw new Error('CIK 없음');
    const j = await px('sec', `api/xbrl/companyfacts/CIK${cik10(cik)}.json`);
    const g = (j.facts || {})['us-gaap'] || {};
    let cur = 'USD';
    const rev = pickSec(g, ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet', 'RevenueFromContractWithCustomerIncludingAssessedTax', 'RevenuesNetOfInterestExpense', 'InterestAndDividendIncomeOperating']);
    if (!Object.keys(rev).length && j.facts && j.facts['ifrs-full']) throw new Error('IFRS 제출사(20-F/6-K)는 아직 미지원');
    const S = {
      rev, gp: pickSec(g, ['GrossProfit']), op: pickSec(g, ['OperatingIncomeLoss']),
      ni: pickSec(g, ['NetIncomeLoss', 'ProfitLoss', 'NetIncomeLossAvailableToCommonStockholdersBasic']),
      eps: pickSec(g, ['EarningsPerShareDiluted', 'EarningsPerShareBasicAndDiluted', 'EarningsPerShareBasic'], 'USD/shares', false),
      cfo: pickSec(g, ['NetCashProvidedByUsedInOperatingActivities', 'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations']),
      capex: pickSec(g, ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets']),
    };
    S.fcf = {}; for (const k in S.cfo) if (S.capex[k] != null) S.fcf[k] = S.cfo[k] - S.capex[k];
    return {cur, S, rows: [['매출', 'rev'], ['매출총이익', 'gp'], ['영업이익', 'op'], ['순이익', 'ni'], ['EPS(희석)', 'eps', 'eps'], ['영업현금흐름', 'cfo'], ['설비투자', 'capex'], ['FCF', 'fcf']],
      note: 'SEC companyfacts. 4분기·현금흐름은 연간/누적에서 앞 분기를 빼서 계산(EPS 4분기는 공시값만).'};
  }
  const amt = (s) => { if (s == null) return null; const v = String(s).replace(/,/g, '').trim(); return v === '' || v === '-' ? null : +v; };
  async function finKR(r) {
    if (!r.id) throw new Error('DART 고유번호 없음(검색 인덱스 갱신 필요)');
    const y0 = new Date().getFullYear(), RC = [['11013', 1], ['11012', 2], ['11014', 3], ['11011', 4]];
    const jobs = [];
    for (let y = y0 - 3; y <= y0; y++) for (const [rc, q] of RC) jobs.push({y, rc, q});
    const get = async (y, rc, fs) => { const j = await px('dart', 'fnlttSinglAcntAll.json', {corp_code: r.id, bsns_year: String(y), reprt_code: rc, fs_div: fs}); return j.status === '000' ? j.list : null; };
    let fs = 'CFS';
    const res = await Promise.all(jobs.map(async (jb) => { try { let l = await get(jb.y, jb.rc, 'CFS'); if (!l) { l = await get(jb.y, jb.rc, 'OFS'); if (l) fs = 'OFS'; } return {...jb, l}; } catch (e) { return {...jb, l: null}; } }));
    const find = (l, sj, ids, nm) => { const it = l.find((x) => sj.includes(x.sj_div) && ids.includes(x.account_id)) || l.find((x) => sj.includes(x.sj_div) && nm.test((x.account_nm || '').replace(/\s/g, ''))); return it ? amt(it.thstrm_amount) : null; };
    const IS = ['IS', 'CIS'];
    const K = {
      rev: (l) => find(l, IS, ['ifrs-full_Revenue', 'ifrs_Revenue'], /^(매출액|영업수익|수익\(매출액\)|매출|매출액\(영업수익\))$/),
      op: (l) => find(l, IS, ['dart_OperatingIncomeLoss', 'ifrs-full_ProfitLossFromOperatingActivities'], /^영업이익(\(손실\))?$/),
      ni: (l) => find(l, IS, ['ifrs-full_ProfitLoss', 'ifrs_ProfitLoss'], /^(당기순이익|분기순이익|반기순이익|당기순이익\(손실\)|분기순이익\(손실\)|반기순이익\(손실\))$/),
      nio: (l) => find(l, IS, ['ifrs-full_ProfitLossAttributableToOwnersOfParent', 'ifrs_ProfitLossAttributableToOwnersOfParent'], /지배기업.*소유주/),
      cfo: (l) => find(l, ['CF'], ['ifrs-full_CashFlowsFromUsedInOperatingActivities', 'ifrs_CashFlowsFromUsedInOperatingActivities'], /^영업활동(으로인한)?현금흐름$/),
    };
    const raw = {}; // raw[key][y][q] (IS: q1~3은 3개월, q4는 연간 / CF: 누적)
    for (const x of res) if (x.l) for (const k in K) { const v = K[k](x.l); if (v != null) ((raw[k] = raw[k] || {})[x.y] = raw[k][x.y] || {})[x.q] = v; }
    const S = {}; const ends = {1: '03-31', 2: '06-30', 3: '09-30', 4: '12-31'};
    for (const k in raw) {
      S[k] = {};
      for (const y in raw[k]) {
        const a = raw[k][y];
        for (let q = 1; q <= 4; q++) {
          let v = null;
          if (k === 'cfo') { if (a[q] != null) v = q === 1 ? a[1] : (a[q - 1] != null ? a[q] - a[q - 1] : null); }
          else if (q < 4) v = a[q] ?? null;
          else if (a[4] != null && a[1] != null && a[2] != null && a[3] != null) v = a[4] - a[1] - a[2] - a[3];
          if (v != null) S[k][`${y}-${ends[q]}`] = v;
        }
      }
    }
    return {cur: 'KRW', S, rows: [['매출', 'rev'], ['영업이익', 'op'], ['순이익', 'ni'], ['지배주주 순이익', 'nio'], ['영업현금흐름', 'cfo']],
      note: `DART 정기보고서(${fs === 'OFS' ? '별도' : '연결'}). 4분기는 사업보고서 연간 − 1~3분기, 현금흐름은 누적 차감. 12월 결산 기준 날짜 표기. 아직 정기보고서가 안 나온 최신 분기는 공시 목록의 잠정실적을 확인하세요.`};
  }
  async function finSA(r, sl) {
    const [is, cf] = await Promise.all([px('sa', sl.page + 'financials/', {p: 'quarterly'}, 'text'), px('sa', sl.page + 'financials/cash-flow-statement/', {p: 'quarterly'}, 'text').catch(() => '')]);
    const grab = (s, keys) => {
      const i = s.indexOf('datekey:['); if (i < 0) return null; const seg = s.slice(i - 10, i + 150000); const o = {};
      for (const k of ['datekey', ...keys]) { const m = new RegExp('[,{]' + k + ':\\[([^\\]]*)\\]').exec(seg); o[k] = m ? m[1].split(',').map((v) => v === 'null' || v === 'void 0' || v === '' ? null : v[0] === '"' ? v.slice(1, -1) : +v) : null; }
      return o;
    };
    const a = grab(is, ['revenue', 'gp', 'opinc', 'netinc', 'epsdil']); if (!a || !a.datekey) throw new Error('재무 없음');
    const b = cf ? grab(cf, ['ncfo', 'capex', 'fcf']) : null;
    const cur = (/Financials in [a-z]+ ([A-Z]{3})/.exec(is) || [])[1] || (r.m === 'J' ? 'JPY' : r.m === 'K' ? 'KRW' : 'USD');
    const mult = /Financials in millions/.test(is) ? 1e6 : /Financials in thousands/.test(is) ? 1e3 : 1;
    const S = {};
    const put = (src, k, key, m) => { S[k] = {}; if (src && src[key]) src.datekey.forEach((d, i) => { if (src[key][i] != null) S[k][d] = src[key][i] * m; }); };
    // stockanalysis 페이지 배열 값은 원 단위(표시만 millions)인 경우가 많아 크기로 판별
    const big = (a.revenue || []).some((v) => v != null && Math.abs(v) > 1e7);
    const m = big ? 1 : mult;
    put(a, 'rev', 'revenue', m); put(a, 'gp', 'gp', m); put(a, 'op', 'opinc', m); put(a, 'ni', 'netinc', m); put(a, 'eps', 'epsdil', 1);
    put(b, 'cfo', 'ncfo', m); put(b, 'capex', 'capex', m); put(b, 'fcf', 'fcf', m);
    return {cur, S, rows: [['매출', 'rev'], ['매출총이익', 'gp'], ['영업이익', 'op'], ['순이익', 'ni'], ['EPS(희석)', 'eps', 'eps'], ['영업현금흐름', 'cfo'], ['설비투자', 'capex'], ['FCF', 'fcf']],
      note: 'stockanalysis 분기 재무(일본은 2024년 분기보고서 폐지로 공시 원천이 반기 단위뿐).'};
  }
  async function fin(r, sl) {
    try {
      let F;
      try { F = r.m === 'U' ? await finUS(r) : r.m === 'K' ? await finKR(r) : await finSA(r, sl); }
      catch (e) { if (e.message === 'no-api') throw e; const f2 = await finSA(r, sl); f2.note = `원천(${r.m === 'U' ? 'SEC' : 'DART'})을 못 읽어 stockanalysis로 대체: ${e.message}. ` + f2.note; F = f2; const em = ov && $('#stk-fin h3 em', ov); if (em) em.textContent = 'stockanalysis (원천 대체) · 사실'; }
      const ends = [...new Set(Object.values(F.S).flatMap((o) => Object.keys(o)))].sort().reverse();
      const keyEnds = ends.filter((d) => (F.S.rev && F.S.rev[d] != null) || (F.S.ni && F.S.ni[d] != null)).slice(0, 8);
      if (!keyEnds.length) return fill('fin', '<span class="stk-mut">분기 재무 없음</span>');
      const near = (o, d) => { const t = Date.parse(d) - 365 * DAY; const k = Object.keys(o || {}).find((x) => Math.abs(Date.parse(x) - t) < 20 * DAY); return k ? o[k] : null; };
      const head = `<tr><th>${F.cur}</th>${keyEnds.map((d) => `<th>${qLabel(d)}</th>`).join('')}</tr>`;
      const body = F.rows.filter(([, k]) => F.S[k] && keyEnds.some((d) => F.S[k][d] != null)).map(([n, k, t]) => `<tr><td>${n}</td>${keyEnds.map((d) => {
        const v = F.S[k][d]; if (v == null) return '<td>—</td>';
        const p = near(F.S[k], d); const yoy = p != null && p !== 0 && (p > 0 || t !== 'eps') ? (v / p - 1) * 100 * (p < 0 ? -1 : 1) : null;
        return `<td>${t === 'eps' ? nf(v, 2) : money(v, F.cur)}${yoy != null ? `<small class="${yoy > 0 ? 'stk-up' : 'stk-dn'}">YoY ${pct(yoy, 0)}</small>` : ''}</td>`;
      }).join('')}</tr>`).join('');
      fill('fin', `<div class="stk-tw"><table class="stk-t"><thead>${head}</thead><tbody>${body}</tbody></table></div><p class="stk-mut" style="margin:8px 0 0">${esc(F.note)}</p>`);
    } catch (e) { fail('fin', e); }
  }
  const qLabel = (d) => { const m = +d.slice(5, 7); return `${d.slice(2, 4)}.${String(m).padStart(2, '0')}`; };

  // ---------- 대시보드 연결 ----------
  function hookDashboard() {
    const ed = $('#dash-root .ed') || $('#dash-root') || document.body;
    const bar = document.createElement('div'); bar.className = 'stk-bar';
    ed.insertBefore(bar, ed.firstChild);
    mountSearch(bar);
    const dh = $('#detail .ed-dhead');
    if (dh) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'stk-dlink'; b.textContent = '종목 페이지 →';
      b.addEventListener('click', async () => {
        const sel = (window.dash && dash.params && dash.params().sel) || '';
        const m = /^\d{4}-\d\d-\d\d_(US|KR|JP)_(.+)$/.exec(sel); if (!m) return;
        const mk = {US: 'U', KR: 'K', JP: 'J'}[m[1]];
        const u = await universe();
        open(u.find((r) => r.m === mk && r.sym === m[2]) || {m: mk, sym: m[2], name: m[2], alt: '', id: null});
      });
      dh.appendChild(b);
    }
  }

  function init() {
    addCss(); hookDashboard();
    window.addEventListener('popstate', fromHash);
    window.addEventListener('hashchange', fromHash);
    if (/^#s=/.test(location.hash)) fromHash();
  }
  window.stockPlatform = {open, search, universe};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
