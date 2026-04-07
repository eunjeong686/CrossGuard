# SafeCross Mobility

`safecross_mobility_5_day_plan.md`를 기준으로 만든 초기 개발 베이스입니다.

현재 상태:

- React + TypeScript 프론트엔드 MVP 홈 화면
- Express + TypeScript 백엔드 API 뼈대
- 공통 응답 포맷 적용
- 실제 공공데이터 연동 + 목업 폴백 흐름 구성
- 위치 권한, 수동 위치 선택, 큰 글씨 모드, 단순 화면 모드 반영
- `mock / hybrid / live` 데이터 모드와 TTL 캐시 구조 추가
- 실연동 준비 상태를 확인하는 상태 점검 API 추가
- 실데이터가 검증된 지역만 바로 시연할 수 있는 데모 프리셋 추가
- 심사 데모 시나리오 시작 버튼과 PWA 기본 설정 추가

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

## 검증된 데모 프리셋

- 울산 `3100000000`: 신호등 + 버스 실데이터 검증 완료
- 서울 `1100000000`: 이동지원 실데이터 검증 완료

홈 화면 프리셋 버튼을 누르면 해당 데이터셋만 점수, 지도, 카드에 반영됩니다. 그래서 데모 중에는 "숨겨진 폴백 데이터가 상단 요약 점수에 섞이는 문제" 없이 설명할 수 있습니다.
또한 카드와 상단 요약에 `LIVE`, `MOCK`, `OFF` 출처 배지를 함께 표시해 현재 응답 상태를 바로 확인할 수 있습니다.

## 현재 검증 결론

- 2026-04-07 기준으로 재검증한 후보 지역에서는 신호, 버스, 이동지원 3종이 같은 `stdgCd`에서 동시에 live로 확인되지는 않았습니다.
- 그래서 현재 데모 전략은 `울산 = 신호·버스`, `서울 = 이동지원`으로 분리해 보여주는 방식입니다.

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

## 실데이터 요약 API 예시

```bash
curl "http://localhost:8787/api/location/summary?lat=35.5384&lng=129.3114&signalStdgCd=3100000000&busStdgCd=3100000000&mobilityStdgCd=3100000000&includeSignals=true&includeBuses=true&includeMobility=false"

curl "http://localhost:8787/api/location/summary?lat=37.5665&lng=126.9780&signalStdgCd=1100000000&busStdgCd=1100000000&mobilityStdgCd=1100000000&includeSignals=false&includeBuses=false&includeMobility=true"
```

## 참고

- 신호와 버스 정보는 계속 `참고용` 문구를 유지해야 합니다.
- 현재 지도는 검증 안정성을 위해 클릭형 좌표 보드로 구현되어 있습니다.
- 실제 타일 지도는 다음 단계에서 Leaflet 또는 다른 지도 컴포넌트로 교체하면 됩니다.
- 현재 실데이터는 `.env`의 `*_STDG_CD`로 지정한 지자체 코드 범위를 기준으로 조회합니다.
- 울산은 신호등·버스, 서울은 이동지원이 실데이터 기준으로 특히 안정적이어서 심사용 데모 프리셋으로 두었습니다.
