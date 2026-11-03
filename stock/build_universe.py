# 종목 검색 인덱스(stock/universe.json) 생성. 원천: SEC(미), DART corpCode + KIND(한), EDINET 코드리스트(일).
# 사용: python3 -I stock/build_universe.py [out=stock/universe.json]   (DART_API_KEY 환경 변수 있으면 한국 corp_code 포함)
import csv, io, json, os, re, sys, urllib.request, zipfile, datetime, html
from xml.etree import ElementTree as ET
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'universe.json')
SEC_UA = 'research-script admin@example.com'
CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
def get(url, ua=CHROME, data=None, timeout=60):
    req = urllib.request.Request(url, data=data, headers={'User-Agent': ua, 'Accept': '*/*'})
    with urllib.request.urlopen(req, timeout=timeout) as r: return r.read()
rows, notes = [], []
# 미국: [m, sym, name, alt, id(cik), exch, industry]
try:
    try:
        j = json.loads(get('https://www.sec.gov/files/company_tickers_exchange.json', SEC_UA))
        f = j['fields']; us = [dict(zip(f, d)) for d in j['data']]
    except Exception:
        us = [{'cik': v['cik_str'], 'ticker': v['ticker'], 'name': v['title'], 'exchange': None} for v in json.loads(get('https://www.sec.gov/files/company_tickers.json', SEC_UA)).values()]
    seen = set()
    for d in us:
        t = d['ticker']
        if t in seen: continue
        seen.add(t); rows.append(['U', t, d['name'], None, d['cik'], d.get('exchange'), None])
    notes.append(f'US {len(seen)}')
except Exception as e: notes.append(f'US 실패 {e}')
# 한국: KIND 상장법인 목록(시장 구분·업종) + DART corpCode(corp_code·영문명)
kr = {}
for mk, label in (('stockMkt', 'KOSPI'), ('kosdaqMkt', 'KOSDAQ'), ('konexMkt', 'KONEX')):
    try:
        t = get(f'https://kind.krx.co.kr/corpgeneral/corpList.do?method=download&marketType={mk}').decode('euc-kr', 'ignore')
        for tr in re.findall(r'<tr>(.*?)</tr>', t, re.S)[1:]:
            td = [html.unescape(re.sub(r'<[^>]+>', '', x)).strip() for x in re.findall(r'<td[^>]*>(.*?)</td>', tr, re.S)]
            code = next((x for x in td if re.fullmatch(r'[0-9A-Z]{6}', x)), None)
            if code: kr[code] = {'name': td[0], 'x': label, 'ind': td[3] if len(td) > 3 and not re.fullmatch(r'[0-9A-Z]{6}', td[3]) else (td[2] if len(td) > 2 else None)}
    except Exception as e: notes.append(f'KIND {mk} 실패 {e}')
key = os.environ.get('DART_API_KEY') or os.environ.get('Dart_API_key')
dart = {}
if key:
    try:
        z = zipfile.ZipFile(io.BytesIO(get('https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=' + key, timeout=120)))
        for el in ET.fromstring(z.read(z.namelist()[0])).iter('list'):
            sc = (el.findtext('stock_code') or '').strip()
            if sc: dart[sc] = {'cc': el.findtext('corp_code'), 'name': (el.findtext('corp_name') or '').strip(), 'en': (el.findtext('corp_eng_name') or '').strip() or None}
    except Exception as e: notes.append(f'DART 실패 {e}')
for code in sorted(set(kr) | (set(dart) if not kr else set())):
    a, b = kr.get(code, {}), dart.get(code, {})
    rows.append(['K', code, a.get('name') or b.get('name'), b.get('en'), b.get('cc'), a.get('x'), a.get('ind')])
if not kr and not dart:  # 원천 실패 시 대시보드 국장 행으로 최소 시드
    try:
        ej = json.load(open(os.path.join(os.path.dirname(OUT), '..', 'data', 'earnings.json'), encoding='utf-8'))
        ej = ej if isinstance(ej, list) else ej.get('rows', [])
        seed = {r['ticker']: r for r in ej if r.get('mkt') == '국장'}
        for code, r in sorted(seed.items()):
            if re.fullmatch(r'[0-9A-Z]{6}', code or ''): rows.append(['K', code, r['name'], None, None, r.get('exch'), (r.get('industry') or '').split('\n')[0].strip() or None])
        notes.append(f'KR 시드 {len(seed)}')
    except Exception as e: notes.append(f'KR 시드 실패 {e}')
notes.append(f'KR KIND {len(kr)} DART {len(dart)}')
# 일본: EDINET 코드리스트(上場, 証券コード 있는 곳)
try:
    z = zipfile.ZipFile(io.BytesIO(get('https://disclosure2dl.edinet-fsa.go.jp/searchdocument/codelist/Edinetcode.zip')))
    txt = z.read(z.namelist()[0]).decode('cp932', 'ignore').splitlines()[1:]
    n = 0
    for d in csv.DictReader(txt):
        sc = (d.get('証券コード') or '').strip()
        if d.get('上場区分') != '上場' or not sc: continue
        rows.append(['J', sc[:4], d['提出者名'], d.get('提出者名（英字）') or None, d['ＥＤＩＮＥＴコード'], None, d.get('提出者業種') or None]); n += 1
    notes.append(f'JP {n}')
except Exception as e: notes.append(f'JP 실패 {e}')
if not rows: sys.exit('no rows')
# 기존 파일에서 이번에 못 받은 시장은 유지
if os.path.exists(OUT):
    old = json.load(open(OUT, encoding='utf-8'))
    have = {r[0] for r in rows if not (r[0] == 'K' and not kr and not dart)}
    if 'K' not in have and any(r[0] == 'K' for r in old.get('r', [])): rows = [r for r in rows if r[0] != 'K']
    rows += [r for r in old.get('r', []) if r[0] not in have]
json.dump({'v': datetime.date.today().isoformat(), 'cols': ['m', 'sym', 'name', 'alt', 'id', 'x', 'ind'], 'r': rows}, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(OUT, len(rows), '; '.join(notes))
