# AnalySite (대지분석 도우미)

한국 주소 하나만 입력하면 그 땅(필지)에 대한 정보를 한 화면에서 확인할 수 있는 웹 서비스입니다.
면적, 개별공시지가, 용도지역/지구, 건폐율·용적률 법정 상한, 주변 기후, 네이버 지도·거리뷰,
주변 시설(지하철·버스·편의점·학교 등)까지 조회한 뒤, 그 내용을 바탕으로 AI 설계 도구에 바로
붙여넣을 수 있는 분석 프롬프트까지 생성해 줍니다.

## 주요 기능

- **주소 검색**: 도로명주소·지번주소 자동완성, 시/구/동/번지로 나눠 검색하는 방식도 지원
- **토지정보**: 면적, 지목, PNU, 개별공시지가(같은 동 평균 대비 비교 포함), 용도지역/지구 지정 내역
- **건폐율·용적률**: 법정 상한을 자동으로 붙여주고, 층별로 치수를 입력해 실제 건축면적/연면적이
  법정 범위 안에 드는지 확인하는 면적 계산기(등각 시각화 포함) 제공
- **기후정보**: 실시간 기온/습도/강수량과 전국 평균 비교, 절기별(계절) 기후평년값(1991–2020) 비교,
  설계 시 고려할 점 자동 요약
- **네이버 지도**: 일반/위성/하이브리드/지형 지도, 거리뷰(Panorama), 대중교통·주변 시설 마커,
  모바일 화면에서는 지도와 거리뷰가 각각 전체 화면으로 표시됨
- **주변 시설 검색**: 지하철역, 버스정류장, 편의점, 카페, 공원, 학교, 헬스장, 도서관 등을 도보
  이동 시간과 함께 표시
- **분석 프롬프트 생성**: 위 조회 결과와 설계 질문 6가지에 대한 답변을 하나의 프롬프트로 정리
- API 키가 없어도 목(mock) 데이터로 전체 화면 흐름을 바로 확인 가능
- 다크모드 지원

화면 구성과 설계 배경이 궁금하다면 [DESIGN.md](./DESIGN.md), [PLAN.md](./PLAN.md)를 참고하세요.

## 기술 스택

- **백엔드**: Node.js, Express
- **프론트엔드**: 순수 JavaScript(프레임워크 없음), [OpenLayers](https://openlayers.org/)(용도지역·지적도 지도),
  [네이버 지도 JS SDK](https://www.ncloud.com/product/applicationService/maps)(지도·거리뷰)
- **외부 데이터**: V-World(토지·지적 정보), 기상청(날씨), 도로명주소 API, NAVER API HUB(지역검색)

## 시작하기

### 요구 사항

- Node.js 18 이상

### 설치 및 실행

```bash
npm install
npm run dev                # http://localhost:3000
```

`npm run dev`는 nodemon으로 실행되어 서버 코드 수정 시 자동 재시작됩니다. 배포/운영 환경에서는
`npm start`를 사용하세요.

### 환경 변수 설정

프로젝트 루트에 `.env` 파일을 만들고 아래 값을 채워 넣습니다. **모든 키는 선택 사항**이며,
비워두면 해당 기능만 목(mock) 데이터로 동작합니다 — 키를 하나도 넣지 않아도 서비스 전체 흐름을
바로 확인할 수 있습니다.

```bash
PORT=3000
USE_MOCK=false

VWORLD_API_KEY=
VWORLD_DOMAIN=localhost
VWORLD_GATEWAY_DOMAIN=

NAVER_MAP_CLIENT_ID=
NAVER_MAP_CLIENT_SECRET=

DATA_GO_KR_WEATHER_KEY=

JUSO_API_KEY=

NAVER_SEARCH_CLIENT_ID=
NAVER_SEARCH_CLIENT_SECRET=
```

| 변수 | 비워두면 | 용도 |
| --- | --- | --- |
| `PORT` | 3000 사용 | 서버 포트 |
| `USE_MOCK` | 자동 판단 | `true`로 두면 키 유무와 상관없이 항상 목 데이터 사용 |
| `VWORLD_API_KEY` | 토지정보 전체가 목 데이터로 동작 | 면적/지목/PNU/공시지가/용도지역/지적도 조회 |
| `VWORLD_DOMAIN` / `VWORLD_GATEWAY_DOMAIN` | 기본값 `localhost` | V-World에 등록한 도메인과 정확히 일치해야 함 |
| `NAVER_MAP_CLIENT_ID` / `_SECRET` | 네이버 지도 탭이 표시되지 않음 | 네이버 지도·거리뷰 |
| `DATA_GO_KR_WEATHER_KEY` | 현재 기온/습도/강수량만 목 데이터 | 기상청 실시간 날씨(절기별 평년값은 키 없이도 항상 실데이터) |
| `JUSO_API_KEY` | 주소 자동완성이 동작하지 않음 | 도로명주소 검색 |
| `NAVER_SEARCH_CLIENT_ID` / `_SECRET` | 주변 시설이 목 데이터로 동작 | 지하철/버스/편의점 등 주변 시설 검색 |

## API 키 발급 방법

### V-World (토지정보 — 필수에 가까움)

1. https://www.vworld.kr 회원가입 → Open API 인증키 발급 신청(도메인 등록 필요)
2. 발급받은 키를 `VWORLD_API_KEY`에 입력
3. **주의**: V-World는 인증키 발급 시 등록한 도메인과 `VWORLD_DOMAIN`/`VWORLD_GATEWAY_DOMAIN` 값이
   정확히 일치해야 요청이 통과합니다. 마이페이지에 등록한 도메인 문자열을 그대로 사용하세요.
   불일치 시 `INCORRECT_KEY` 또는 도메인 불일치 오류로 실패합니다.
4. 공공데이터포털(data.go.kr)에서 별도로 키를 받을 필요는 없습니다 — 토지이용계획정보·개별공시지가정보가
   V-World API로 통합 제공됩니다.

### 네이버 지도 (지도·거리뷰)

1. https://console.ncloud.com → Services > AI·NAVER API > Application > **Maps**에서 클라이언트 ID 발급
   (Dynamic Map 상품 체크 필요)
2. 발급받은 값을 `NAVER_MAP_CLIENT_ID`/`NAVER_MAP_CLIENT_SECRET`에 입력
3. **Web 서비스 URL을 여러 개 등록할 수 있습니다.** 로컬 개발 시에는 운영 도메인과 별도로
   `http://localhost:3000`(포트 포함, 경로 제외)을 등록해야 로컬에서 지도가 표시됩니다.
   미등록 시 원인이 드러나지 않는 `500 Internal Server Error`로 실패하니 주의하세요.
4. 지도 유형 전환(일반/위성/하이브리드/지형)과 거리뷰는 같은 클라이언트 ID로 동작하며 추가 키가
   필요 없습니다.

### 기상청 실시간 날씨

1. https://www.data.go.kr → "기상청_단기예보 조회서비스" 활용신청(자동승인)
2. 서비스키를 `DATA_GO_KR_WEATHER_KEY`에 입력

### 도로명주소 검색

1. https://business.juso.go.kr → 주소기반산업지원서비스 API 키 발급
2. `JUSO_API_KEY`에 입력

### 네이버 주변 시설 검색

1. https://console.ncloud.com → **NAVER API HUB**(지도용 "Maps"와는 별개 상품)에서 지역검색 키 발급
2. `NAVER_SEARCH_CLIENT_ID`/`NAVER_SEARCH_CLIENT_SECRET`에 입력
3. 옛 "네이버 개발자센터"(openapi.naver.com)의 지역검색은 신규 신청이 종료되어 반드시 API HUB
   경로로 신청해야 합니다.

## 정적 데이터로 처리하는 기능

일부 기능은 외부 API 대신 `server/data/`에 저장된 정적 데이터를 사용합니다(추가 키 불필요):

- **절기별 기후평년값**: 기상자료개방포털의 1991–2020 평년값을 `climateNormals.json`에 저장해두고
  가장 가까운 관측소를 찾아 응답합니다. 10년 주기로만 갱신되는 값이라 매 요청마다 외부를 호출하지
  않습니다.
- **건폐율·용적률 법정 상한**: 「국토의 계획 및 이용에 관한 법률 시행령」의 용도지역별 상한/범위를
  `zoningLimits.json`에 저장해두고 조회된 용도지역과 매칭합니다. 화면에 표시되는 수치는 **법령상
  상한**이며, 지자체 조례로 정해지는 실제 적용 수치와 다를 수 있습니다. 정확한 수치는
  [토지이음](https://www.eum.go.kr)에서 지번으로 직접 확인하세요.

## 서버 API

| 엔드포인트 | 설명 |
| --- | --- |
| `GET /api/geocode?address=` | 주소 → 좌표(및 지번주소인 경우 PNU) |
| `GET /api/pnu?x=&y=` | 좌표 → PNU/면적/지목 (연속지적도 조회) |
| `GET /api/land-use?x=&y=` | 용도지역 목록 |
| `GET /api/land-price?x=&y=` | 개별공시지가 |
| `GET /api/parcel-info?address=` | 위 항목을 모두 조합한 통합 조회 (프론트에서 사용) |
| `GET /api/map/wms?...` | V-World WMS 타일 프록시 (키 미노출) |
| `GET /api/config` | 프론트에 필요한 공개 설정값(네이버 지도 클라이언트 ID) 전달 |
| `GET /api/weather?x=&y=` | 기상청 초단기실황(현재 기온/습도/강수량) + 전국 15개 도시 비교 |
| `GET /api/climate-normals?x=&y=` | 계절별 기후평년값(기온/강수량/습도/풍속/일조시간) |
| `GET /api/nearby-places?x=&y=&categories=` | 부지 인근 주변 시설 검색 |
| `GET /api/address-search?keyword=` | 도로명주소 자동완성 후보 검색 |

## 프로젝트 구조

```
public/            프론트엔드 (정적 파일)
  index.html
  css/style.css
  js/               화면별 기능 모듈 (지도, 검색, 기후, 프롬프트 등)
server/             백엔드 (Express)
  routes/           API 라우트
  services/         외부 API 연동 로직
  data/             정적 데이터 (기후평년값, 건폐율·용적률 등)
  mock/             API 키가 없을 때 사용하는 목 데이터
  config/           환경 변수 로딩
scripts/            개발용 보조 스크립트
```

## 라이선스

이 저장소는 현재 별도의 오픈소스 라이선스 없이 공개되어 있습니다(`UNLICENSED`).
