// 로컬 테스트: NODE_USE_ENV_PROXY=1 DART_API_KEY=... node worker/dev.mjs 8787
import http from 'node:http';
import w from './src/index.js';
const port = +process.argv[2] || 8787;
const env = {ALLOWED_ORIGINS: '', DART_API_KEY: process.env.DART_API_KEY || process.env.Dart_API_key, EDINET_API_KEY: process.env.EDINET_API_KEY || process.env.EDINET_API_key};
http.createServer(async (req, res) => {
  const r = await w.fetch(new Request('http://localhost:' + port + req.url, {method: req.method, headers: req.headers}), env);
  res.writeHead(r.status, Object.fromEntries(r.headers));
  res.end(Buffer.from(await r.arrayBuffer()));
}).listen(port, () => console.log('dev proxy on', port));
