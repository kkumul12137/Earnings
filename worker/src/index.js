// 종목 상세용 얇은 프록시: 원천 데이터(SEC·DART·EDINET·stockanalysis·TDnet)를 CORS로 중계하고 캐시한다.
// 파싱은 브라우저(stock/stock.js)가 한다. 무료 티어 CPU 한도(10ms) 안에서 돌도록 본문을 그대로 흘려보낸다.
const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const SEC_UA = 'research-script admin@example.com';

// 소스별 허용 경로(열린 프록시 방지)와 캐시 시간(초)
const SRC = {
  sec: {base: 'https://data.sec.gov/', ua: SEC_UA, rules: [
    [/^submissions\/CIK\d{10}\.json$/, 21600],
    [/^api\/xbrl\/companyfacts\/CIK\d{10}\.json$/, 43200]]},
  secw: {base: 'https://www.sec.gov/', ua: SEC_UA, rules: [
    [/^Archives\/edgar\/data\/\d+\/\d{18}\/index\.json$/, 604800]]},
  dart: {base: 'https://opendart.fss.or.kr/api/', key: ['crtfc_key', 'DART_API_KEY'], rules: [
    [/^company\.json$/, 604800],
    [/^list\.json$/, 3600],
    [/^fnlttSinglAcntAll\.json$/, 43200]]},
  edinet: {base: 'https://api.edinet-fsa.go.jp/api/v2/', key: ['Subscription-Key', 'EDINET_API_KEY'], rules: [
    [/^documents\.json$/, 3600]]},
  sa: {base: 'https://stockanalysis.com/', ua: CHROME, rules: [
    [/^api\/quotes\/[as]\/[\w.-]+$/, 60],
    [/^api\/symbol\/[as]\/[\w.-]+\/history$/, 3600],
    [/^api\/search$/, 86400],
    [/^(stocks\/[\w.-]+|quote\/(krx|kosdaq|tyo)\/[\w.-]+)\/(financials\/(cash-flow-statement\/)?|forecast\/)?$/, 21600]]},
  tdnet: {base: 'https://www.release.tdnet.info/', ua: CHROME, rules: [
    [/^inbs\/I_list_\d{3}_\d{8}\.html$/, 1800]]},
};

function cors(origin) {
  return {'access-control-allow-origin': origin || '*', 'access-control-allow-methods': 'GET, OPTIONS', 'vary': 'Origin'};
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const origin = req.headers.get('origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (allowed.length && !allowed.includes(origin)) return new Response('forbidden origin', {status: 403});
    if (req.method === 'OPTIONS') return new Response(null, {headers: cors(origin)});
    if (req.method !== 'GET') return new Response('method', {status: 405, headers: cors(origin)});

    const m = url.pathname.match(/^\/p\/(\w+)\/(.*)$/);
    const src = m && SRC[m[1]];
    if (!src) return new Response('unknown source', {status: 404, headers: cors(origin)});
    const path = m[2];
    const rule = src.rules.find(([re]) => re.test(path));
    if (!rule) return new Response('path not allowed', {status: 403, headers: cors(origin)});

    const up = new URL(src.base + path);
    url.searchParams.forEach((v, k) => { if (!src.key || k !== src.key[0]) up.searchParams.set(k, v); });
    if (src.key) {
      const secret = env[src.key[1]];
      if (!secret) return new Response('missing secret ' + src.key[1], {status: 500, headers: cors(origin)});
      up.searchParams.set(src.key[0], secret);
    }
    const ttl = rule[1];
    let r;
    try {
      r = await fetch(up.toString(), {
        headers: {'user-agent': src.ua || CHROME, 'accept': '*/*', 'accept-language': 'en-US,en;q=0.9'},
        cf: {cacheTtl: ttl, cacheEverything: true},
      });
    } catch (e) {
      return new Response('upstream error', {status: 502, headers: cors(origin)});
    }
    const h = new Headers(cors(origin));
    h.set('content-type', r.headers.get('content-type') || 'application/octet-stream');
    h.set('cache-control', 'public, max-age=' + Math.min(ttl, 3600));
    return new Response(r.body, {status: r.status, headers: h});
  },
};
