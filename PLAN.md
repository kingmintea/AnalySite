# 한국 주소 기반 토지정보 조회 웹사이트 — 구현 계획

## Context

사용자는 웹사이트 입력창에 한국 주소(예: "서울특별시 성북구 안암동2가 40")를 입력하면 해당 필지의 **도시계획도(용도지역/지구, 지적도)**, **면적**, **개별공시지가**, **지역지구 지정 여부**를 결과로 보여주는 사이트를 만들고 싶어하며, 이를 공공 Open API로 구현 가능한지 확인을 요청했다.

작업 디렉터리(`D:\Git_Proj\AnalySite`)는 완전히 빈 디렉터리(git 저장소도 아님)이므로 그린필드 프로젝트로 시작한다. 계획 수립 전 웹 검색으로 다음을 실제로 확인했다:

- **V-World Geocoder API**가 주소 → 좌표 변환을 제공하지만 **PNU(필지고유번호)는 반환하지 않는다** — 이는 사용자가 제시한 프로세스에 없던 중요한 보완 지점으로, 좌표를 얻은 뒤 V-World 데이터API(WFS)로 연속지적도 레이어를 좌표 기반 공간검색해 PNU를 별도로 구해야 한다.
- **data.go.kr의 "국토교통부_토지이용계획정보서비스"**가 PNU로 용도지역/지구 배열을 반환하는 것을 확인했다.
- **data.go.kr의 "국토교통부_개별공시지가정보"**가 PNU+연도로 ㎡당 공시지가를 반환하는 것을 확인했다.
- **V-World WMS/WMTS**가 용도지역 4종(LT_C_UQ111~114) 및 연속지적도 레이어를 타일로 제공해 OpenLayers로 시각화 가능함을 확인했다.

결론: **사용자가 제시한 흐름은 API로 구현 가능하다.** 다만 "지오코더가 PNU까지 준다"는 원래 프로세스 설명은 부정확하며, PNU 획득을 위한 별도 공간검색 단계가 필요하다 — 이 계획에 반영했다.

사용자와 협의해 기술 스택을 확정했다: **백엔드 Node.js+Express(프록시 서버로 CORS 우회 및 서비스키 보호), 프론트엔드 순수 HTML/CSS/JS, 지도 라이브러리 OpenLayers**. API 인증키(V-World, data.go.kr)는 아직 발급받지 않은 상태이므로, 계획에 키 발급 절차와 키 없이도 개발을 진행할 수 있는 목(mock) 데이터 모드를 포함한다.

구현 승인 후 첫 단계에서 이 계획 내용을 프로젝트 루트의 `PLAN.md`로도 저장한다(사용자가 원래 요청한 위치).

---

## 1. 전체 아키텍처

```
[브라우저: HTML/CSS/JS + OpenLayers]
        │ fetch (동일 오리진, /api/*)
        ▼
[Express 서버 (Node.js) — 프록시 + 조합 레이어]
        │ 서버사이드 HTTPS 요청 (서비스키는 서버에만 보관)
        ▼
[V-World Geocoder / Data API(WFS) / WMS·WMTS]   [data.go.kr 토지이용계획정보서비스 / 개별공시지가정보]
```

- 프론트는 외부 API 키를 알지 못한다. 모든 외부 호출은 Express 서버를 경유한다.
- Express는 단순 프록시가 아니라 여러 공공 API 응답을 하나의 "필지 정보" 도메인 모델로 조합하는 서비스 계층을 가진다.
- 지도 타일(WMS)은 트래픽이 크므로, 초기에는 OpenLayers가 V-World WMS를 브라우저에서 직접 호출하고, 실제 키 발급 후 도메인 인증 동작을 보고 필요 시 서버 프록시(`/api/map/wms`)로 전환한다(§9 리스크).

## 2. 디렉터리/파일 구조

```
D:\Git_Proj\AnalySite\
├── PLAN.md                      # 이 계획을 저장 (구현 착수 시 생성)
├── .env                          # 실제 키 (gitignore 대상)
├── .env.example                  # 키 없이 커밋되는 템플릿
├── .gitignore
├── package.json
├── README.md
├── server/
│   ├── index.js                  # Express 앱 진입점, 미들웨어/라우터 등록
│   ├── config/env.js             # dotenv 로드·검증, 키 없으면 USE_MOCK 자동 폴백
│   ├── routes/
│   │   ├── geocode.js            # GET /api/geocode
│   │   ├── pnu.js                # GET /api/pnu
│   │   ├── landUse.js            # GET /api/land-use
│   │   ├── landPrice.js          # GET /api/land-price
│   │   └── parcelInfo.js         # GET /api/parcel-info (통합 엔드포인트)
│   ├── services/
│   │   ├── vworldGeocode.js      # V-World Geocoder 호출
│   │   ├── vworldParcel.js       # V-World 데이터API(WFS) 연속지적도 공간검색 → PNU/면적/지목
│   │   ├── dataGoKrLandUse.js    # 토지이용계획정보서비스 호출
│   │   ├── dataGoKrLandPrice.js  # 개별공시지가정보 호출
│   │   └── httpClient.js         # axios 공통 설정(timeout, 로깅)
│   ├── utils/
│   │   ├── errors.js             # AppError, 에러 코드 정의
│   │   └── asyncHandler.js
│   └── mock/sampleParcel.json    # 키 발급 전 프론트 개발용 목데이터
├── public/
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── main.js               # 부트스트랩, 이벤트 바인딩
│       ├── api.js                # /api/* fetch 래퍼
│       ├── map.js                # OpenLayers 지도/레이어 관리
│       └── resultPanel.js        # 결과(면적/공시지가/용도지역) 렌더링
```

의존성: 서버 `express`, `dotenv`, `axios`, `cors`, `morgan` / 개발 `nodemon` / 프론트는 OpenLayers(`ol`)를 CDN 또는 로컬 vendor로, 필요 시 `proj4`.

## 3. .env 구성 및 API 키 발급 절차

```
PORT=3000
VWORLD_API_KEY=
VWORLD_DOMAIN=localhost          # 배포 시 실제 도메인으로 재등록
DATA_GO_KR_SERVICE_KEY=
USE_MOCK=false                    # 키 미설정 시 서버가 자동으로 true처럼 동작
```

**data.go.kr**: 회원가입 → "국토교통부_토지이용계획정보서비스", "국토교통부_개별공시지가정보" 각각 활용신청 → 마이페이지에서 서비스키 확인(Decoding 키를 axios에 사용 권장, 이중 인코딩 방지). 요청 파라미터명(PNU, 연도 등)은 실제 문서로 1단계에서 재확인.

**V-World**: 회원가입 → Open API 인증키 발급 신청 시 **도메인 등록 필수**(개발: localhost, 배포: 실서비스 도메인) → 발급된 키를 `VWORLD_API_KEY`에 설정. 서버사이드 호출 시 도메인 인증이 Referer 기반이면 Node 서버에서 실패할 수 있어 M1~M2에서 조기 검증 필요.

## 4. 백엔드 설계

- **GET /api/geocode?address=**: V-World Geocoder(`type=PARCEL` 우선, 실패 시 `ROAD` 재시도) → `{x, y, roadAddr, parcelAddr}`. 미검색 시 404 `ADDRESS_NOT_FOUND`.
- **GET /api/pnu?x=&y=**: V-World 데이터API(WFS)로 `LP_PA_CBND_BUBUN` 레이어를 좌표 기반 INTERSECTS 공간검색 → `{pnu, area, jimok}`. 미검색 시 404 `PARCEL_NOT_FOUND`.
- **GET /api/land-use?pnu=**: 토지이용계획정보서비스 → `[{code, name, lastUpdated}, ...]`(결과 없음은 정상, 빈 배열).
- **GET /api/land-price?pnu=&year=**: 개별공시지가정보 → `{year, pricePerSqm, baseDate}`. year 미지정 시 전년도 기본, 데이터 없으면 1회 전년도 재조회.
- **GET /api/parcel-info?address=** (프론트가 실제 사용하는 통합 엔드포인트): geocode → getPnu → `Promise.allSettled([getLandUse, getLandPrice])` 병렬 조회, 부분 실패는 `warnings` 배열에 담아 200으로 반환(지도/기본정보는 보여주고 실패한 표만 "조회 실패" 표시). 완전 실패(주소/필지 못 찾음)는 4xx.
- **에러 코드 정책**: `ADDRESS_NOT_FOUND`(404), `PARCEL_NOT_FOUND`(404), `UPSTREAM_AUTH_ERROR`(502), `UPSTREAM_RATE_LIMIT`(429), `UPSTREAM_TIMEOUT`(504), `INVALID_REQUEST`(400).
- **목데이터 모드**: `USE_MOCK=true`(또는 키 미설정 자동 감지) 시 `parcelInfo.js`가 `server/mock/sampleParcel.json`("성북구 안암동2가 40" 예시)을 반환 — 키 발급 전 프론트/지도 UI 완성 가능.

## 5. 프론트엔드 설계

- `index.html`: 주소 입력창 + 검색 버튼(Enter 지원), 좌측 지도 패널(레이어 토글: 용도지역/지적도/배경지도) + 우측 결과 패널(기본정보/공시지가 카드/용도지역 표), 로딩·에러 상태 표시 영역.
- `api.js`: `/api/parcel-info?address=` fetch, 실패 시 서버 에러 메시지 그대로 노출.
- `main.js`: 검색 클릭 → 로딩 → 결과 렌더링 + 지도 이동/하이라이트, 실패 시 에러 배너.
- `resultPanel.js`: 면적(㎡, 천단위 구분), 공시지가(원/㎡ + 기준연도, 없으면 "정보 없음"), 용도지역/지구 표(여러 행, 빈 배열이면 "지정 정보 없음"), `warnings` 있으면 경고 배너.
- `map.js` (OpenLayers): 배경 OSM 또는 V-World Base 타일, 좌표계는 Geocoder 호출 시 `crs=epsg:4326`으로 통일해 단순화(WFS가 EPSG:5179만 준다면 `proj4` 등록으로 변환). 용도지역 4종(LT_C_UQ111~114)·지적도 WMS 레이어를 `TileWMS`/`ImageWMS`로 추가, 체크박스로 토글. 검색 좌표로 `view.animate()` 이동, 가능하면 필지 geometry를 Vector 레이어로 하이라이트(최소 구현은 마커만).

## 6. 단계별 구현 순서

1. **M1 스캐폴딩+지오코딩**: npm init, 디렉터리 생성, `.env.example`/`.gitignore`, Express 기본 앱, `GET /api/geocode`+mock 폴백. 검증: curl로 주소→좌표 확인.
2. **M2 PNU 조회**: `vworldParcel.js`(WFS 공간검색), `GET /api/pnu`. 검증: M1 좌표로 PNU/면적/지목 확인.
3. **M3 토지이용계획+공시지가+통합 API**: `landUse`/`landPrice` 서비스·라우트, `GET /api/parcel-info` 통합(병렬+부분실패 허용). 검증: 통합 엔드포인트 curl 테스트, 실패 케이스 확인.
4. **M4 프론트 UI**: (M3과 병행 가능, `USE_MOCK=true`로 먼저 진행) `index.html`/`style.css`/`api.js`/`main.js`/`resultPanel.js`. 검증: 브라우저에서 주소 입력 → 표 렌더링, 키가 프론트로 노출 안 됨을 Network 탭에서 확인.
5. **M5 OpenLayers 지도 연동**: 기본 지도+마커 이동 → V-World WMS 레이어(용도지역/지적도) 추가 → 토글 UI. 좌표계 문제 시 proj4. 검증: 실제 주소 검색 시 지도 이동 + 용도지역 오버레이 표시 확인.
6. **M6 에러처리/폴리싱**: 전역 에러 핸들러, 프론트 에러 배너, 키 오류/한도초과/타임아웃 각각 재현해 메시지 확인, 간단한 응답 캐싱(TTL) 검토, README 정리.

## 7. 실행 방법

```
npm install
copy .env.example .env      # 키 입력 또는 USE_MOCK=true로 우선 진행
npm run dev                 # http://localhost:3000
```

## 8. 검증 방법

- 서버 단독: 각 마일스톤에서 `/api/geocode`, `/api/pnu`, `/api/land-use`, `/api/land-price`, `/api/parcel-info`를 curl/PowerShell `Invoke-RestMethod`로 실제 주소값 호출해 스키마·상태코드 확인.
- 브라우저 통합: "서울특별시 성북구 안암동2가 40" 입력 → 지도 이동/레이어 표시, 결과 표 출력 확인. 개발자도구 Network에서 외부 키가 `/api/*` 요청에 노출되지 않는지 점검.
- 키 미발급 상태에서는 `USE_MOCK=true`로 M4(프론트)를 먼저 완성하고, 키 발급 후 `USE_MOCK=false`로 전환해 실데이터 연동만 디버깅.
- 에러 케이스: 존재하지 않는 주소, PNU 없는 좌표(예: 바다), 공시지가 미등록 필지, 잘못된 키 각각 사용자 메시지 확인.

## 9. 리스크 및 구현 중 재확인 필요 사항

1. **V-World 도메인 인증**: Referer 기반이면 Node 서버(비브라우저) 호출 시 실패 가능 — M1~M2에서 조기 검증, 필요 시 IP 기반 인증 전환 또는 Referer 헤더 수동 설정.
2. **data.go.kr 활용신청 승인 지연**(최대 1~2일 가능) — 이 기간 mock 모드로 개발 지속.
3. **레이어명/필드명**(`LP_PA_CBND_BUBUN`, `LT_C_UQ111~114`, `prposAreaDstrcCode` 등)은 리서치로 확인된 이름이며, 실제 키로 1회 테스트 호출 후 필드 매핑 재확인 필요.
4. **좌표계 혼용**(Geocoder 경위도 vs WFS 지적도 EPSG:5179 가능성) — 서버 내부는 단일 CRS로 통일, 필요 지점만 변환.
5. **API 일일 호출 한도** — 개발 중 반복 호출로 소진 가능, M6에서 간단한 캐싱 고려.

### 핵심 구현 파일
- `server/index.js`, `server/routes/parcelInfo.js`, `server/services/vworldGeocode.js`, `server/services/vworldParcel.js`, `public/js/map.js`, `.env.example`
