/* 엑셀 다운로드 버튼: 현재 필터(날짜·시장·섹터·시점·시총·반응·검색) 그대로 내보냄 */
(function () {
  const COLS = [
    ['date', '발표일'], ['mkt', '시장'], ['exch', '거래소'], ['ticker', '티커'], ['name', '회사'], ['sector', '섹터'], ['industry', '산업'], ['timing', '발표 시점'],
    ['mcapUsd', '시총($)', 'n'], ['fpe', 'Fwd P/E', 'n'],
    ['epsAct', 'EPS 실제', 'n'], ['epsEst', 'EPS 컨센', 'n'], ['epsSurpPct', 'EPS 서프(%)', 'n'],
    ['revAct', '매출 실제', 'n'], ['revEst', '매출 컨센', 'n'], ['revSurpPct', '매출 서프(%)', 'n'],
    ['reactPct', '주가 반응(%)', 'n'], ['reactBasis', '반응 기준'], ['benchPct', '벤치(%)', 'n'], ['excessPct', '시장 대비(%)', 'n'], ['score', '매력도 점수', 'n'], ['guide', '가이던스'],
    ['bm', 'BM'], ['results', '실적'], ['call', '컨콜·경영진 코멘트'], ['qa', 'Q&A'], ['perf', '주가 퍼포먼스'],
    ['whyFact', '반응 이유(사실)'], ['whyInfer', '반응 이유(추론)'], ['attract', '투자 매력도(추론)'], ['sources', '출처'],
  ];
  const W = {name: 24, industry: 22, bm: 50, results: 60, call: 60, qa: 50, perf: 40, whyFact: 50, whyInfer: 50, attract: 50, sources: 50};
  let lib;
  const loadLib = () => lib || (lib = new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'xlsx.mini.min.js'; s.onload = ok; s.onerror = no; document.head.appendChild(s); }));
  const clean = (v) => typeof v === 'string' ? v.replace(/ \|\| /g, '\n').slice(0, 32000) : v;
  async function run(btn) {
    const f = window.edRows && window.edRows(); if (!f) return;
    btn.disabled = true; const t = btn.textContent; btn.textContent = '만드는 중…';
    try {
      await loadLib();
      const p = dash.params();
      let rows = f.rows.slice();
      if (p.sort) rows.sort((a, b) => { const x = a[p.sort], y = b[p.sort]; const c = (x == null) - (y == null) || (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))); return p.desc ? -c : c; });
      const aoa = [COLS.map((c) => c[1])].concat(rows.map((r) => COLS.map(([k, , ty]) => { const v = r[k]; if (v == null || v === '') return null; if (ty === 'n') { const n = Number(v); return isNaN(n) ? v : n; } return clean(v); })));
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = COLS.map(([k]) => ({wch: W[k] || 11}));
      ws['!autofilter'] = {ref: XLSX.utils.encode_range({s: {r: 0, c: 0}, e: {r: rows.length, c: COLS.length - 1}})};
      ws['!freeze'] = {xSplit: 5, ySplit: 1};
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, '실적 정리');
      const tag = [f.date, p.mkt, p.sector].filter(Boolean).join('_');
      const buf = XLSX.write(wb, {bookType: 'xlsx', type: 'array'});
      const url = URL.createObjectURL(new Blob([buf], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
      const a = document.createElement('a'); a.href = url; a.download = `실적정리_${tag}.xlsx`; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) { alert('엑셀 생성 실패: ' + e); }
    btn.disabled = false; btn.textContent = t;
  }
  function add() {
    const bar = document.getElementById('filters'); if (!bar || bar.querySelector('.ed-xlsx')) return;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'ed-xlsx'; b.textContent = '⬇ 엑셀 다운로드'; b.title = '지금 필터에 걸린 기업을 엑셀로 받기';
    b.addEventListener('click', () => run(b));
    bar.appendChild(b);
  }
  const st = document.createElement('style');
  st.textContent = '.ed-xlsx{font:inherit;font-size:var(--cds-font-size-caption);padding:var(--cds-pad-xs) var(--cds-pad-md);border:1px solid var(--color-fg);border-radius:var(--cds-radius);background:var(--color-fg);color:var(--color-bg);cursor:pointer;white-space:nowrap}.ed-xlsx:disabled{opacity:.6;cursor:wait}';
  document.head.appendChild(st);
  add();
})();
