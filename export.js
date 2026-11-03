/* 엑셀 다운로드: 분기 재무(fin 데이터만)를 EAT.xlsx 'Quarterly' 형식으로. 상세 패널에 기업이 열려 있으면 그 기업, 아니면 지금 필터에 걸린 기업 전부(기업별 시트). */
(function () {
  const LBL = 'AppleSDGothicNeoM00', HDR = 'AppleSDGothicNeoB00', TTL = 'AppleSDGothicNeoH00', NUMF = 'Arial';
  const BLUE = 'FF0000FF', BLACK = 'FF000000';
  const FMT_N = '#,##0.0;\\(#,##0.0\\);\\-', FMT_N0 = '#,##0;\\(#,##0\\);\\-', FMT_P = '0.0%', FMT_EPS = '#,##0.00;\\(#,##0.00\\);\\-';
  const unitOf = (cur) => cur === 'KRW' ? {div: 1e8, label: '(Unit: KRW 억)', fmt: FMT_N0} : cur === 'JPY' ? {div: 1e8, label: '(Unit: JPY 億)', fmt: FMT_N0} : {div: 1e6, label: `(Unit: ${cur}mn)`, fmt: FMT_N};
  const qLabel = (q) => { const m = /Q(\d)\s+(\d{4})/.exec(q.fq || ''); return (m ? `${m[1]}Q FY${m[2].slice(2)}` : q.p) + (q.prov ? '(P)' : ''); };
  const col = (i) => { let s = '', n = i; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; };

  // 행 정의: [라벨, 종류, 키/식]  종류: in(입력값), sub(소계 입력값, 윗줄 테두리), f(식), qoq, yoy, pct, sec(구분 머리줄)
  const ROWS = [
    ['Total revenues', 'sub', 'revenue'], ['  QoQ(%)', 'qoq', 'Total revenues'], ['  YoY(%)', 'yoy', 'Total revenues'],
    ['Cost of revenue', 'in', 'cor'],
    ['Gross profit', 'gp'], ['GPM(%)', 'pct', ['Gross profit', 'Total revenues']],
    ['SG&A', 'in', 'sgna'], ['R&D', 'in', 'rnd'],
    ['Operating income', 'sub', 'opinc'], ['  QoQ(%)', 'qoq', 'Operating income'], ['  YoY(%)', 'yoy', 'Operating income'], ['OPM(%)', 'pct', ['Operating income', 'Total revenues']],
    ['Income before income taxes', 'in', 'pretax'], ['Provision for income taxes', 'in', 'taxexp'],
    ['Net income (attributable)', 'sub', 'netinccmn'], ['  QoQ(%)', 'qoq', 'Net income (attributable)'], ['  YoY(%)', 'yoy', 'Net income (attributable)'], ['NPM(%)', 'pct', ['Net income (attributable)', 'Total revenues']],
    ['Effective tax rate', 'etr'],
    ['Diluted EPS', 'eps', 'epsdil'],
    ['EBITDA', 'in', 'ebitda'], ['EBITDA margin', 'pct', ['EBITDA', 'Total revenues']],
    ['Cash Flow', 'sec'],
    ['Operating cash flow', 'in', 'ncfo'], ['Capital expenditures', 'in', 'capex'],
    ['Free cash flow', 'fcf'], ['FCF margin', 'pct', ['Free cash flow', 'Total revenues']],
    ['Stock-based compensation', 'in', 'sbcomp'], ['Share repurchases', 'in', 'commonRepurchased'], ['Dividends paid', 'in', 'commonDividendCF'],
  ];

  function sheet(wb, name, fin) {
    const qs = JSON.parse(fin.j || '[]'); const u = unitOf(fin.cur);
    const ws = wb.addWorksheet(name + '_Q', {views: [{showGridLines: false, state: 'frozen', xSplit: 3, ySplit: 3}]});
    ws.getColumn(1).width = 2.625; ws.getColumn(2).width = 2.625; ws.getColumn(3).width = 49.25;
    const C0 = 4, last = C0 + qs.length - 1;
    for (let c = C0; c <= last; c++) ws.getColumn(c).width = 11;
    // 제목
    for (let c = 3; c <= last; c++) { const x = ws.getCell(2, c); x.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'FF595959'}}; x.font = {name: TTL, size: 11, color: {argb: 'FFFFFFFF'}}; }
    ws.getCell(2, 3).value = `${name} Income Statement_Quarterly`;
    // 머리줄
    const h = ws.getCell(3, 3); h.value = u.label; h.font = {name: HDR, size: 11}; h.border = {bottom: {style: 'double'}};
    qs.forEach((q, i) => { const x = ws.getCell(3, C0 + i); x.value = qLabel(q); x.font = {name: HDR, size: 11}; x.alignment = {horizontal: 'right'}; x.border = {bottom: {style: 'double'}}; });
    ws.getRow(3).height = 16.5;
    const rowOf = {}, present = {}; let r = 4;
    const has = (k) => qs.some((q) => q[k] != null);
    const val = (q, k) => q[k] == null ? null : (k === 'epsdil' ? q[k] : q[k] / u.div);
    for (const [label, kind, arg] of ROWS) {
      if (kind === 'in' && !has(arg)) continue;
      if (kind === 'gp' && !has('gp') && !(has('cor'))) continue;
      if (kind === 'fcf' && !has('fcf') && !(has('ncfo') && has('capex'))) continue;
      if (kind === 'eps' && !has(arg)) continue;
      if (kind === 'etr' && !(rowOf['Income before income taxes'] && rowOf['Provision for income taxes'])) continue;
      if ((kind === 'qoq' || kind === 'yoy') && !rowOf[arg]) continue;
      if (kind === 'pct' && !(rowOf[arg[0]] && rowOf[arg[1]])) continue;
      if (kind === 'sec') { // 이후 행이 하나도 없으면 생략
        if (!['ncfo', 'capex', 'fcf', 'sbcomp', 'commonRepurchased', 'commonDividendCF'].some(has)) continue;
      }
      const lc = ws.getCell(r, 3); lc.value = label;
      const isPct = kind === 'qoq' || kind === 'yoy' || kind === 'pct' || kind === 'etr';
      lc.font = isPct ? {name: NUMF, size: 11, bold: kind === 'qoq' || kind === 'yoy', italic: true} : {name: LBL, size: 11, color: {argb: BLACK}};
      if (kind === 'qoq' || kind === 'yoy') lc.alignment = {horizontal: 'right'};
      if (kind === 'in' && ['cor', 'sgna', 'rnd', 'taxexp', 'capex'].includes(arg)) lc.alignment = {indent: 1};
      const top = kind === 'sub' || kind === 'gp' || kind === 'fcf' || kind === 'sec';
      if (kind === 'sec') { for (let c = 3; c <= last; c++) { const x = ws.getCell(r, c); x.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'FFF2F2F2'}}; x.border = {top: {style: 'thin'}}; } rowOf[label] = r++; continue; }
      qs.forEach((q, i) => {
        const c = C0 + i, L = col(c), x = ws.getCell(r, c);
        let v = null, input = false, fmt = u.fmt;
        const ref = (lab, cc = c) => `${col(cc)}${rowOf[lab]}`;
        const ok = (lab, j = i) => present[lab] && present[lab][j];
        if (kind === 'in' || kind === 'sub') { v = val(q, arg); input = true; }
        else if (kind === 'eps') { v = val(q, arg); input = true; fmt = FMT_EPS; }
        else if (kind === 'gp') {
          if (q.revenue != null && q.cor != null && q.gp != null && Math.abs(q.revenue - q.cor - q.gp) <= Math.abs(q.gp) * 0.005 + 1) v = {formula: `${ref('Total revenues')}-${ref('Cost of revenue')}`, result: q.gp / u.div};
          else { v = val(q, 'gp'); input = true; }
        } else if (kind === 'fcf') {
          if (q.ncfo != null && q.capex != null && q.fcf != null && Math.abs(q.ncfo + q.capex - q.fcf) <= Math.abs(q.fcf) * 0.005 + 1) v = {formula: `${ref('Operating cash flow')}+${ref('Capital expenditures')}`, result: q.fcf / u.div};
          else { v = val(q, 'fcf'); input = true; }
        } else if (kind === 'qoq') { fmt = FMT_P; if (i > 0 && ok(arg) && ok(arg, i - 1)) v = {formula: `IFERROR(${ref(arg)}/${ref(arg, c - 1)}-1,"n/a")`}; }
        else if (kind === 'yoy') { fmt = FMT_P; if (i > 3 && ok(arg) && ok(arg, i - 4)) v = {formula: `IFERROR(${ref(arg)}/${ref(arg, c - 4)}-1,"n/a")`}; }
        else if (kind === 'pct') { fmt = FMT_P; if (ok(arg[0]) && ok(arg[1])) v = {formula: `IFERROR(${ref(arg[0])}/${ref(arg[1])},"n/a")`}; }
        else if (kind === 'etr') { fmt = FMT_P; if (ok('Income before income taxes') && ok('Provision for income taxes')) v = {formula: `IFERROR(IF(${ref('Income before income taxes')}=0,0,${ref('Provision for income taxes')}/${ref('Income before income taxes')}),"n/a")`}; }
        x.value = v; x.numFmt = fmt;
        (present[label] = present[label] || [])[i] = v != null;
        x.font = {name: NUMF, size: 11, color: {argb: input ? BLUE : BLACK}, bold: kind === 'qoq' || kind === 'yoy', italic: isPct};
        if (kind === 'qoq' || kind === 'yoy') x.alignment = {horizontal: 'right'};
        if (top) x.border = {top: {style: 'thin'}};
      });
      if (top) lc.border = {top: {style: 'thin'}};
      rowOf[label] = r++;
    }
    r++;
    const note = (t) => { const x = ws.getCell(r++, 3); x.value = t; x.font = {name: LBL, size: 9, color: {argb: 'FF7F7F7F'}}; };
    note('출처: stockanalysis 분기 재무(S&P Global). 파란 글씨 = 원자료 입력값, 검정 = 수식.');
    if (qs.some((q) => q.prov)) note('(P) = 잠정: stockanalysis 미반영 최신 분기를 DART 잠정실적 또는 회사 보도자료로 채운 값(매출·영업이익·순이익만).');
    note('Capex·자사주 매입·배당은 현금 유출이라 음수로 표시.');
    return {qs, u, rowOf, present, C0, last};
  }

  // 연간: 분기 시트를 회계연도별로 SUM (4개 분기가 모두 있는 연도만, 항목별로 4분기 값이 다 있을 때만)
  function annual(wb, name, info) {
    const {qs, u, rowOf, present, C0} = info;
    const years = [];
    qs.forEach((q, i) => {
      const m = /Q(\d)\s+(\d{4})/.exec(q.fq || ''); if (!m) return;
      let y = years.find((x) => x.y === m[2]); if (!y) years.push(y = {y: m[2], idx: {}});
      y.idx[m[1]] = i; if (q.prov) y.prov = true;
    });
    const fy = years.filter((y) => ['1', '2', '3', '4'].every((k) => y.idx[k] != null) && y.idx['4'] - y.idx['1'] === 3);
    if (!fy.length) return false;
    const QN = name + '_Q';
    const ws = wb.addWorksheet(name + '_A', {views: [{showGridLines: false, state: 'frozen', xSplit: 3, ySplit: 3}]});
    ws.getColumn(1).width = 2.625; ws.getColumn(2).width = 2.625; ws.getColumn(3).width = 49.25;
    const last = C0 + fy.length - 1;
    for (let c = C0; c <= last; c++) ws.getColumn(c).width = 11;
    for (let c = 3; c <= last; c++) { const x = ws.getCell(2, c); x.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'FF595959'}}; x.font = {name: TTL, size: 11, color: {argb: 'FFFFFFFF'}}; }
    ws.getCell(2, 3).value = `${name} Income Statement_Annually`;
    const h = ws.getCell(3, 3); h.value = u.label; h.font = {name: HDR, size: 11}; h.border = {bottom: {style: 'double'}};
    fy.forEach((y, i) => { const x = ws.getCell(3, C0 + i); x.value = `FY${y.y.slice(2)}` + (y.prov ? '(P)' : ''); x.font = {name: HDR, size: 11}; x.alignment = {horizontal: 'right'}; x.border = {bottom: {style: 'double'}}; });
    ws.getRow(3).height = 16.5;
    const aRow = {}, aPresent = {}; let r = 4;
    for (const [label, kind, arg] of ROWS) {
      if (kind === 'qoq') continue;
      if (kind === 'sec') { if (!rowOf[label]) continue; for (let c = 3; c <= last; c++) { const x = ws.getCell(r, c); x.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'FFF2F2F2'}}; x.border = {top: {style: 'thin'}}; } ws.getCell(r, 3).value = label; ws.getCell(r, 3).font = {name: LBL, size: 11, color: {argb: BLACK}}; aRow[label] = r++; continue; }
      const base = kind === 'yoy' ? arg : kind === 'pct' ? null : label;
      if (kind === 'yoy' && !aRow[arg]) continue;
      if (kind === 'pct' && !(aRow[arg[0]] && aRow[arg[1]])) continue;
      if (kind === 'etr' && !(aRow['Income before income taxes'] && aRow['Provision for income taxes'])) continue;
      if (!['yoy', 'pct', 'etr'].includes(kind) && !rowOf[label]) continue;
      const isPct = kind === 'yoy' || kind === 'pct' || kind === 'etr';
      const lc = ws.getCell(r, 3); lc.value = kind === 'yoy' ? '  YoY(%)' : label;
      lc.font = isPct ? {name: NUMF, size: 11, bold: kind === 'yoy', italic: true} : {name: LBL, size: 11, color: {argb: BLACK}};
      if (kind === 'yoy') lc.alignment = {horizontal: 'right'};
      const top = kind === 'sub' || kind === 'gp' || kind === 'fcf';
      if (top) lc.border = {top: {style: 'thin'}};
      fy.forEach((y, i) => {
        const c = C0 + i, x = ws.getCell(r, c); let v = null;
        const a = (lab, j = i) => aPresent[lab] && aPresent[lab][j];
        const ref = (lab, cc = c) => `${col(cc)}${aRow[lab]}`;
        if (kind === 'yoy') { if (i > 0 && a(arg) && a(arg, i - 1)) v = {formula: `IFERROR(${ref(arg)}/${ref(arg, c - 1)}-1,"n/a")`}; }
        else if (kind === 'pct') { if (a(arg[0]) && a(arg[1])) v = {formula: `IFERROR(${ref(arg[0])}/${ref(arg[1])},"n/a")`}; }
        else if (kind === 'etr') { if (a('Income before income taxes') && a('Provision for income taxes')) v = {formula: `IFERROR(IF(${ref('Income before income taxes')}=0,0,${ref('Provision for income taxes')}/${ref('Income before income taxes')}),"n/a")`}; }
        else {
          const qi = ['1', '2', '3', '4'].map((k) => y.idx[k]);
          if (qi.every((j) => present[label] && present[label][j])) v = {formula: `SUM('${QN}'!${col(C0 + qi[0])}${rowOf[label]}:${col(C0 + qi[3])}${rowOf[label]})`};
        }
        (aPresent[kind === 'yoy' ? '_' : label] = aPresent[kind === 'yoy' ? '_' : label] || [])[i] = v != null;
        x.value = v; x.numFmt = isPct ? FMT_P : kind === 'eps' ? FMT_EPS : u.fmt;
        x.font = {name: NUMF, size: 11, color: {argb: BLACK}, bold: kind === 'yoy', italic: isPct};
        if (kind === 'yoy') x.alignment = {horizontal: 'right'};
        if (top) x.border = {top: {style: 'thin'}};
      });
      if (kind !== 'yoy') aRow[label] = r; r++;
    }
    r++;
    const note = (t) => { const x = ws.getCell(r++, 3); x.value = t; x.font = {name: LBL, size: 9, color: {argb: 'FF7F7F7F'}}; };
    note(`연간 = '${QN}' 시트 4개 분기 합계(회계연도 기준). 분기가 모두 있는 연도만 표시하고, 4개 분기 값이 다 없는 항목은 비움.`);
    note('Diluted EPS 연간값은 분기 EPS 합계라 회사 공시 연간 EPS와 조금 다를 수 있음.');
    return true;
  }

  let lib;
  const loadLib = () => lib || (lib = new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'exceljs.min.js'; s.onload = ok; s.onerror = () => { lib = null; no(new Error('라이브러리 로드 실패')); }; document.head.appendChild(s); }));
  async function run(btn) {
    const f = window.edRows && window.edRows(); if (!f) return;
    btn.disabled = true; const t = btn.textContent; btn.textContent = '만드는 중…';
    try {
      let fin = dash.data('fin');
      for (let i = 0; fin.status === 'loading' && i < 120; i++) { await new Promise((ok) => setTimeout(ok, 250)); fin = dash.data('fin'); }
      if (fin.status !== 'ok') throw new Error('재무 데이터를 불러오지 못했어요');
      await loadLib();
      const sel = window.edSelected && window.edSelected();
      const ids = sel ? [sel.id] : f.rows.map((r) => r.id);
      const byId = new Map(fin.data.map((x) => [x.id, x]));
      const wb = new ExcelJS.Workbook(); wb.calcProperties.fullCalcOnLoad = true;
      const used = new Set(); let n = 0;
      for (const id of ids) {
        const x = byId.get(id); if (!x || !x.j) continue;
        let nm = (id.split('_').slice(2).join('_') || id).replace(/[\\/?*\[\]:]/g, '').slice(0, 26) || 'Sheet';
        let k = nm, i = 2; while (used.has(k.toLowerCase())) k = `${nm}_${i++}`; used.add(k.toLowerCase());
        annual(wb, k, sheet(wb, k, x)); n++;
      }
      if (!n) { alert('이 조건에 분기 재무가 있는 기업이 없어요.'); return; }
      const buf = await wb.xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([buf], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
      const a = document.createElement('a'); a.href = url;
      a.download = sel ? `Financials_${[...used][0].toUpperCase()}_${f.date}.xlsx` : `Financials_${[f.date, dash.params().mkt, dash.params().sector].filter(Boolean).join('_')}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) { alert('엑셀 생성 실패: ' + e.message); }
    finally { btn.disabled = false; btn.textContent = t; }
  }
  function add() {
    const bar = document.getElementById('filters'); if (!bar || bar.querySelector('.ed-xlsx')) return;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'ed-xlsx'; b.textContent = '⬇ 재무 엑셀';
    b.title = '분기 재무를 엑셀로 받기: 상세에 연 기업이 있으면 그 기업, 없으면 지금 필터에 걸린 기업 전부(기업별 시트)';
    b.addEventListener('click', () => run(b));
    bar.appendChild(b);
  }
  const st = document.createElement('style');
  st.textContent = '.ed-xlsx{font:inherit;font-size:var(--cds-font-size-caption);padding:var(--cds-pad-xs) var(--cds-pad-md);border:1px solid var(--color-fg);border-radius:var(--cds-radius);background:var(--color-fg);color:var(--color-bg);cursor:pointer;white-space:nowrap}.ed-xlsx:disabled{opacity:.6;cursor:wait}';
  document.head.appendChild(st);
  add();
})();
