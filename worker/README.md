# 종목 데이터 프록시 (Cloudflare Worker)

대시보드의 종목 검색·상세 화면(`stock/stock.js`)이 원천 데이터를 받는 통로. 브라우저에서 직접 못 부르는 곳(CORS 없음, API 키 필요)을 대신 호출하고 캐시한다. 파싱은 브라우저가 한다.

| 경로 | 원천 | 용도 |
|---|---|---|
| `/p/sec/…` | data.sec.gov | 미국 기업정보·XBRL 재무 |
| `/p/secw/…` | www.sec.gov | 8-K 첨부 목록(EX-99.x) |
| `/p/dart/…` | opendart.fss.or.kr | 한국 기업개황·공시목록·재무 (키 자동 첨부) |
| `/p/edinet/…` | api.edinet-fsa.go.jp | 일본 공시 (키 자동 첨부) |
| `/p/sa/…` | stockanalysis.com | 시세·차트·지표, 일본 분기재무 |
| `/p/tdnet/…` | release.tdnet.info | 적시공시 목록 |

허용 경로만 통과(열린 프록시 방지), `ALLOWED_ORIGINS`(기본 `https://kkumul12137.github.io`) 외 Origin은 403.

## 배포 (한 번)
1. Cloudflare 무료 계정 만들기.
2. 이 폴더에서:
   ```
   npx wrangler login
   npx wrangler secret put DART_API_KEY
   npx wrangler secret put EDINET_API_KEY
   npx wrangler deploy
   ```
3. 출력된 주소(`https://earnings-stock-proxy.<계정>.workers.dev`)를 `stock/config.js`의 `STOCK_API`에 넣고 커밋.

비용: 무료 티어(일 10만 요청)로 개인·지인용 충분.

## 로컬 테스트
`NODE_USE_ENV_PROXY=1 node worker/dev.mjs 8787` 후 `stock/config.js`의 주소를 `http://localhost:8787`로.
