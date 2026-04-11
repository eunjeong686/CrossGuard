# SafeCross Mobility

교통약자와 보호자가 버스를 타러 나가기 전, `지금 출발해도 덜 불안한지` 먼저 판단할 수 있도록 신호와 버스 실시간 정보를 다시 읽어 주는 웹앱입니다.

현재 상태:

- React + TypeScript 지도 중심 모바일 UI
- Express + TypeScript 백엔드 API
- 공통 응답 포맷, 캐시, 오류 처리 적용
- 실제 공공데이터 연동 + 목업 폴백 흐름 구성
- 위치 권한, 수동 위치 선택, 큰 글씨 모드, 단순 화면 모드 반영
- 울산 신호·버스 실데이터 기반 이동 부담도와 맞춤 이동 안내 알고리즘
- 교차로 복잡도와 정류장 접근 부담을 함께 보는 판단 근거 패널
- OpenStreetMap 기반 보행 맥락 요약
- 경로 비교 보조 기능과 PWA 기본 설정
- Render 단일 웹 서비스 배포 구조

## 실행

```bash
npm install
npm run dev
```

- 프론트엔드: `http://localhost:5173`
- 백엔드: `http://localhost:8787`

프론트가 다른 도메인에서 배포될 경우 `frontend/.env.example`를 참고해 `VITE_API_BASE_URL`을 실제 백엔드 URL로 지정합니다.

## 현재 구현된 API

- `GET /api/health`
- `GET /api/location/summary?lat={lat}&lng={lng}`
- `GET /api/signals/nearby?lat={lat}&lng={lng}`
- `GET /api/buses/nearby?lat={lat}&lng={lng}`
- `GET /api/mobility-support/nearby?lat={lat}&lng={lng}`
- `GET /api/routes/compare`
- `GET /api/meta/disclaimer`
- `GET /api/meta/status`

## 데이터 모드

- `mock`: 모든 데이터를 목업으로 응답
- `hybrid`: 실데이터 연동 시도 후 실패하면 목업으로 폴백
- `live`: 실데이터 연동 실패 시 그대로 오류 응답

기본값은 `hybrid`입니다.

## 서비스 핵심 정의

- 문제: 교통약자에게는 길찾기보다 `지금 출발해도 되는지` 판단이 더 어렵습니다.
- 해결: 신호 잔여시간, 버스 여유, 정류장 접근 부담을 한 문장 판단과 근거로 다시 정리합니다.
- 차별점: 일반 지도앱이 길과 도착을 보여준다면, SafeCross는 `출발 직전의 부담 판단`을 먼저 돕습니다.
- 대상 사용자: 천천히 걷는 사용자, 보호자와 함께 확인하는 사용자

## 검증된 추천 위치

- 울산 `3100000000`: 신호등 + 버스 실데이터 검증 완료

앱 화면에서는 사용자에게 개발자용 상태값을 노출하지 않고, 현재 위치가 울산이면 신호·버스 데이터 묶음을 바로 보여줍니다. 지원 범위 밖 위치에서는 무리하게 전국 데이터를 섞어 보여주지 않고, 울산 신호·버스 확인 흐름으로 안내합니다.

## 울산 데모 노출 정책

- 울산 내부 샘플 좌표를 백테스트(`scan-ulsan-coverage`)로 측정한 뒤 정책을 고정합니다.
- 커버리지 `70% 이상`이면 `VITE_ULSAN_SELECTION_POLICY=free`, 미만이면 `preset`으로 설정합니다.
- `hybrid` 모드에서도 캐시에 `source(live/mock)`를 함께 저장해, live/mock 불일치 표시가 생기지 않도록 처리합니다.

## 실데이터 검증 근거

- 2026-04-10 기준 전국 법정동 시군구 코드 270개를 별도 검증 스크립트로 재스캔했습니다.
- 신호, 버스, 이동지원 3종이 같은 코드에서 동시에 live로 확인된 지역은 없었습니다.
- 분류 결과: 3종 모두 가능 0개, 신호+버스 1개, 이동지원 116개, 부분 가능 9개, 응답 없음/오류 144개.
- 신호+버스가 함께 안정적으로 확인된 지역은 울산 `3100000000`이었습니다.
- 제출용 사용자 화면은 처음부터 `신호+버스 기반 출발 전 판단 보조`라는 문제정의에 맞춰 울산 실데이터 데모로 집중합니다.
- 이동지원 API와 전국 스캔 결과는 내부 검증 및 향후 확장 근거로만 유지합니다.
- 로컬 검증 결과 파일은 `tmp/live-region-scan-20260410-1401.json`, `tmp/live-region-scan-20260410-1401.md`에 생성됐습니다. `tmp/`는 제출 앱 코드에 포함하지 않는 검증 산출물입니다.

## 맞춤 이동 안내 알고리즘

SafeCross Mobility는 사용자 화면에서 과하게 AI를 강조하지 않고, `가까운 신호 잔여시간이 짧아 출발 타이밍을 보수적으로 보고 있습니다`, `정류장 주변 보행 접근 정보에 주의 요소가 있어 신호와 거리 판단을 함께 반영했습니다`처럼 바로 이해할 수 있는 한 문장 안내로 녹여 보여줍니다.

- 엔진명: `Mobility Companion AI`
- 현재 구현: 서버 내 로컬 규칙 기반 알고리즘(`local-rules`)
- 입력값: 보행 신호 상태와 잔여시간, 버스 여유 상태, 가까운 정류장 거리, 교차로 기본 정보, OpenStreetMap 기반 보행 맥락, 데이터 신선도, 사용자 시나리오
- 출력값: 대표 안내 문장, 판단 이유, 점수 세부 근거, 주의 포인트, 안전 확인 문구, 내부 엔진 정보
- 안전 원칙: 앱이 이동을 단정하거나 현장 판단을 대체하지 않고, 항상 실제 신호와 주변 상황 확인을 우선 안내합니다.

이 구조는 외부 LLM 키 없이도 제출용 데모에서 안정적으로 동작하며, 이후에는 같은 응답 타입에 LLM 기반 문장 개선 또는 개인화 모델을 붙일 수 있도록 확장 가능하게 설계했습니다.

## 데이터 활용

- 공공데이터포털 신호 API: 교차로 기본 정보, 보행 신호 상태, 신호 잔여시간
- 공공데이터포털 버스 API: 노선 기본 정보, 노선 경유지, 버스 실시간 위치
- OpenStreetMap/Overpass: 횡단보도, 신호기, 계단, 보도, 정류장, 쉼터 기반 보행 맥락
- 자체 가공 지표:
  - `intersectionComplexity`: 제한속도, 차로 폭 등으로 교차로 부담을 `단순/주의/복잡`으로 분류
  - `stopAccessStatus`: 정류장까지 거리와 보행 맥락으로 접근 부담을 `편함/보통/주의`로 분류
  - `movementBurden.scoreBreakdown`: 신호, 버스, 교차로, 접근, 최신성의 판단 근거 분해

## 공모전 평가 기준 대응

- 참신성: 기존 지도앱처럼 경로만 보여주지 않고, 이동 직전의 신호·버스 정보를 교통약자 관점의 한 문장 판단과 근거로 묶습니다.
- 공공데이터 활용성: 신호 API, 버스 API, OSM 보행 맥락 데이터를 함께 가공해 교차로 부담과 정류장 접근 상태까지 해석합니다.
- 국민편익: 고령자, 장애인, 보호자에게 큰 글씨·단순 화면·검증 지역 추천 흐름을 제공해 이동 전 확인 부담을 줄입니다.
- 구현 및 실현가능성: 울산 검증 지역 정책, 실데이터 실패 시 폴백, CORS 안정화, PWA 기본 설정, Render 단일 배포를 반영했습니다.
- AI 활용: `Mobility Companion AI`가 신호, 버스, 보행 맥락, 데이터 최신성을 함께 해석해 사용자가 바로 이해할 수 있는 맞춤 안내 문장과 이유를 제공합니다.

## 계획서 기준 진행 상태

- Day 1~3 목표: 대부분 완료
- Day 4 목표: 예외 처리, 문구 정리, UI polish까지 상당 부분 완료
- Day 5 목표: PWA 기본 설정은 시작했고, 배포 URL/실기기 QA/최종 리허설은 아직 남아 있습니다.

## 배포 준비

현재 기준으로 가장 빠른 배포 경로는 `Render 단일 웹 서비스`입니다. 서버가 프로덕션에서 `frontend/dist`를 함께 서빙하도록 구성해 두었기 때문에, 프론트/백엔드를 따로 올리지 않고 한 번에 배포할 수 있습니다.

### 백엔드

```bash
cd server
cp .env.example .env
npm install
npm run build
npm run start
```

- `PUBLIC_DATA_SERVICE_KEY`는 실제 인증키로 채워야 합니다.
- 프론트 공개 URL이 정해지면 `CLIENT_ORIGIN`도 같이 바꿔야 합니다.

### 프론트엔드

```bash
cd frontend
cp .env.example .env
npm install
npm run build
npm run preview -- --host 0.0.0.0
```

- 백엔드가 별도 도메인이라면 `VITE_API_BASE_URL=https://your-api-domain` 형태로 설정합니다.
- 현재 PWA 기본 설정, manifest, service worker는 포함되어 있습니다.

### Render 단일 배포

루트의 [render.yaml](/home/eunjeong/CrossGuard/render.yaml#L1)을 기준으로 배포할 수 있습니다.

1. Render에서 `Blueprint` 또는 `Web Service`로 저장소를 연결합니다.
2. 루트의 `render.yaml`을 읽게 합니다.
3. `PUBLIC_DATA_SERVICE_KEY`만 실제 값으로 입력합니다.
4. 첫 배포 후 `/api/health`, `/api/meta/status`, 홈 화면을 확인합니다.

이 경로에서는 프론트가 같은 서비스에서 같이 제공되므로 `VITE_API_BASE_URL`을 따로 넣지 않아도 됩니다.

## 공공데이터 참고 링크

- 신호등: `https://www.data.go.kr/data/15157604/openapi.do`
- 버스: `https://www.data.go.kr/data/15157601/openapi.do`
- 이동지원: `https://www.data.go.kr/data/15140825/openapi.do`

## 전국 시군구 실데이터 스캔

제출 앱 코드와 분리된 검증용 스크립트로 전국 시군구 live 응답 여부를 확인할 수 있습니다.

```bash
node scripts/scan-live-regions.mjs --limit 5
node scripts/scan-live-regions.mjs --all --concurrency 2 --delay-ms 120
node scripts/scan-ulsan-coverage.mjs --base-url=http://localhost:8787 --rounds=2 --threshold=70
```

- 스크립트 위치: `scripts/scan-live-regions.mjs`, `scripts/scan-ulsan-coverage.mjs`
- 환경변수: `server/.env` 또는 환경변수의 `PUBLIC_DATA_SERVICE_KEY`, `SIGNAL_API_URL`, `BUS_API_URL`, `MOBILITY_API_URL`
- 결과 출력: `tmp/live-region-scan-{YYYYMMDD-HHmm}.json`, `tmp/live-region-scan-{YYYYMMDD-HHmm}.md`
- 분류: `3종 모두 가능`, `신호+버스`, `이동지원`, `부분 가능`, `응답 없음/오류`

## 실데이터 요약 API 예시

```bash
curl "http://localhost:8787/api/location/summary?lat=35.5384&lng=129.3114&signalStdgCd=3100000000&busStdgCd=3100000000&mobilityStdgCd=3100000000&includeSignals=true&includeBuses=true&includeMobility=false"

# 제출용 사용자 화면은 울산 신호·버스 중심으로 구성합니다.
```

## 참고

- 신호와 버스 정보는 계속 `참고용` 문구를 유지해야 합니다.
- 현재 지도는 Leaflet + OpenStreetMap 기반으로 동작합니다.
- 보행 맥락은 OpenStreetMap/Overpass 질의를 통해 보조적으로 반영합니다.
- 현재 실데이터는 `.env`의 `*_STDG_CD`로 지정한 지자체 코드 범위를 기준으로 조회합니다.
- 울산은 신호등·버스 실데이터 기준으로 가장 안정적이어서 제출용 추천 위치로 두었습니다.
