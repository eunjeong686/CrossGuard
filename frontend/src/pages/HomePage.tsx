import { useRef, useState, type PointerEvent } from 'react';
import { RouteCompareCard } from '../components/cards/RouteCompareCard';
import { AppShell } from '../components/layout/AppShell';
import { SummaryMap } from '../components/map/SummaryMap';
import { useLocation } from '../hooks/useLocation';
import { useRouteCompare } from '../hooks/useRouteCompare';
import { useSummary } from '../hooks/useSummary';
import { useUiStore } from '../stores/uiStore';
import { formatRelativeTime } from '../utils/format';
import type { PaceProfile, Persona } from '../types/api';

type RecommendedPlace = {
  id: 'ulsan-live';
  label: string;
  description: string;
  currentLabel: string;
  coordinates: { lat: number; lng: number };
  signalStdgCd?: string;
  busStdgCd?: string;
  mobilityStdgCd?: string;
  supportedCards: Array<'signals' | 'buses' | 'mobility'>;
};

type SupportedArea = {
  id: RecommendedPlace['id'];
  bounds: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };
};

type CompareTarget = {
  id: 'bus-stop' | 'safe-crossing';
  label: string;
  description: string;
  offset: { lat: number; lng: number };
};

type SheetState = 'collapsed' | 'mid' | 'expanded';
type ScenarioOption = {
  id: Persona;
  label: string;
  subtitle: string;
  goal: string;
};

const RECOMMENDED_PLACES: RecommendedPlace[] = [
  {
    id: 'ulsan-live',
    label: '울산 신호·버스 보기',
    currentLabel: '울산 주변',
    description: '걷기 전 신호와 버스 정보를 먼저 살펴봅니다.',
    coordinates: { lat: 35.5384, lng: 129.3114 },
    signalStdgCd: '3100000000',
    busStdgCd: '3100000000',
    mobilityStdgCd: '3100000000',
    supportedCards: ['signals', 'buses'],
  },
];

const SUPPORTED_AREAS: SupportedArea[] = [
  {
    id: 'ulsan-live',
    bounds: { minLat: 35.3, maxLat: 35.75, minLng: 129, maxLng: 129.47 },
  },
];

const COMPARE_TARGETS: CompareTarget[] = [
  {
    id: 'bus-stop',
    label: '버스 쪽으로 가기',
    description: '버스를 탈지, 다른 이동 수단을 볼지 비교합니다.',
    offset: { lat: 0.0012, lng: -0.0008 },
  },
  {
    id: 'safe-crossing',
    label: '조금 더 편한 길 보기',
    description: '걷는 거리와 신호를 함께 보고 비교합니다.',
    offset: { lat: 0.0006, lng: 0.0012 },
  },
];

const SCENARIO_OPTIONS: ScenarioOption[] = [
  {
    id: 'elder',
    label: '천천히 걷는 사용자',
    subtitle: '건너기 전 신호와 정류장 접근을 더 보수적으로 봅니다.',
    goal: '건너기 전 신호',
  },
  {
    id: 'guardian',
    label: '보호자와 함께 보기',
    subtitle: '설명과 데이터 최신성을 더 자세히 보여줍니다.',
    goal: '근거와 확인 포인트',
  },
];

function getSupportedArea(coordinates: { lat: number; lng: number }) {
  return (
    SUPPORTED_AREAS.find(
      (area) =>
        coordinates.lat >= area.bounds.minLat &&
        coordinates.lat <= area.bounds.maxLat &&
        coordinates.lng >= area.bounds.minLng &&
        coordinates.lng <= area.bounds.maxLng,
    ) ?? null
  );
}

function getPlaceProfileById(id: RecommendedPlace['id']) {
  return RECOMMENDED_PLACES.find((place) => place.id === id) ?? RECOMMENDED_PLACES[0];
}

function getServiceSourceLabel(source?: 'live' | 'mock' | 'disabled') {
  if (source === 'live') {
    return '실시간 연동';
  }

  if (source === 'mock') {
    return '보조 예시';
  }

  return '숨김';
}

function getNextSheetState(state: SheetState): SheetState {
  if (state === 'collapsed') {
    return 'mid';
  }

  if (state === 'mid') {
    return 'expanded';
  }

  return 'collapsed';
}

export function HomePage() {
  const {
    coordinates,
    errorMessage,
    locationLabel,
    selectionMode,
    setManualLocation,
    setSelectionMode,
    requestCurrentLocation,
  } = useLocation();
  const [selectedPlaceId, setSelectedPlaceId] = useState<RecommendedPlace['id'] | null>(null);
  const [selectedCompareTargetId, setSelectedCompareTargetId] =
    useState<CompareTarget['id']>('bus-stop');
  const [persona, setPersona] = useState<Persona>('elder');
  const [compareOpen, setCompareOpen] = useState(false);
  const [scoreOpen, setScoreOpen] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [sheetState, setSheetState] = useState<SheetState>('mid');
  const sheetDragStartY = useRef<number | null>(null);
  const { largeText, simpleMode, toggleLargeText, toggleSimpleMode } = useUiStore();
  const selectedPlace =
    RECOMMENDED_PLACES.find((place) => place.id === selectedPlaceId) ?? null;
  const activeCoordinates = selectedPlace?.coordinates ?? coordinates;
  const supportedArea = getSupportedArea(activeCoordinates);
  const activePlaceProfile = selectedPlace ?? (supportedArea ? getPlaceProfileById(supportedArea.id) : null);
  const isSupportedArea = Boolean(activePlaceProfile);
  const visibleCards = activePlaceProfile?.supportedCards ?? [];
  const paceProfile: PaceProfile = persona === 'elder' ? 'slow' : 'default';
  const summaryOptions = {
    signalStdgCd: activePlaceProfile?.signalStdgCd,
    busStdgCd: activePlaceProfile?.busStdgCd,
    mobilityStdgCd: activePlaceProfile?.mobilityStdgCd,
    includeSignals: visibleCards.includes('signals'),
    includeBuses: visibleCards.includes('buses'),
    includeMobility: visibleCards.includes('mobility'),
    persona,
    paceProfile,
    enabled: isSupportedArea,
  };
  const { data, isLoading, isError, refetch, isFetching } = useSummary(
    activeCoordinates.lat,
    activeCoordinates.lng,
    summaryOptions,
  );
  const summary = data?.data;
  const selectedCompareTarget =
    COMPARE_TARGETS.find((target) => target.id === selectedCompareTargetId) ?? COMPARE_TARGETS[0];
  const compareDestination = {
    lat: activeCoordinates.lat + selectedCompareTarget.offset.lat,
    lng: activeCoordinates.lng + selectedCompareTarget.offset.lng,
  };
  const compareOptions = {
    signalStdgCd: activePlaceProfile?.signalStdgCd,
    busStdgCd: activePlaceProfile?.busStdgCd,
    mobilityStdgCd: activePlaceProfile?.mobilityStdgCd,
    enabled: isSupportedArea,
  };
  const {
    data: compareData,
    isLoading: isCompareLoading,
    isError: isCompareError,
  } = useRouteCompare(
    activeCoordinates.lat,
    activeCoordinates.lng,
    compareDestination.lat,
    compareDestination.lng,
    compareOptions,
  );
  const compare = compareData?.data;
  const selectedScenario =
    SCENARIO_OPTIONS.find((option) => option.id === persona) ?? SCENARIO_OPTIONS[0];
  const placeLabel = selectedPlace?.label ?? activePlaceProfile?.currentLabel ?? locationLabel;
  const summaryMessage =
    summary?.movementBurden.assistiveInsight.message ?? '신호와 이동수단을 함께 확인해 주세요.';
  const summaryReason = summary?.movementBurden.assistiveInsight.reason;
  const safetyReminder =
    summary?.movementBurden.assistiveInsight.safetyReminder ??
    '앱 안내는 참고용이며, 실제 현장 신호와 주변 상황을 우선 확인해 주세요.';
  const nearbyRows = summary
    ? [
        visibleCards.includes('signals')
          ? {
              id: 'signals',
              label: '가까운 신호',
              title: summary.topSignal?.intersectionName ?? '가까운 신호 정보 없음',
              value:
                summary.topSignal?.remainingSeconds != null
                  ? `${summary.topSignal.remainingSeconds}초 남음 · ${summary.topSignal.intersectionComplexity}`
                  : (summary.topSignal?.pedestrianSignalStatusLabel ?? '확인 필요'),
            }
          : null,
        visibleCards.includes('buses')
          ? {
              id: 'buses',
              label: '버스 여유',
              title: summary.topBus
                ? `${summary.topBus.routeType} ${summary.topBus.routeNo}번 · ${summary.topBus.routeTerminus ?? '종점 확인 중'}`
                : '가까운 버스 정보 없음',
              value: summary.topBus?.etaCategory ?? '확인 필요',
            }
          : null,
        visibleCards.includes('buses')
          ? {
              id: 'bus-distance',
              label: '정류장까지',
              title: summary.topBus?.nearStopName ?? '가까운 정류장 정보 없음',
              value:
                summary.topBus?.stopDistanceMeters != null
                  ? `약 ${Math.round(summary.topBus.stopDistanceMeters)}m · 접근 ${summary.topBus.stopAccessStatus}`
                  : '확인 필요',
            }
          : null,
        {
          id: 'walk-access',
          label: '보행 접근',
          title: summary.walkContext.note,
          value: summary.walkContext.accessibilityLabel,
        },
      ].filter((row) => row != null)
    : [];
  const simpleRows = summary
    ? [
        {
          label: '신호 참고',
          value:
            summary.topSignal?.remainingSeconds != null
              ? `${summary.topSignal.remainingSeconds}초 남음`
              : (summary.topSignal?.pedestrianSignalStatusLabel ?? '확인 필요'),
        },
        {
          label: '버스 여유',
          value: summary.topBus?.etaCategory ?? '확인 필요',
        },
        {
          label: '현장 확인',
          value: '앱보다 눈앞의 신호를 우선해 주세요',
        },
      ]
    : [];

  function handleSheetPointerDown(event: PointerEvent<HTMLButtonElement>) {
    sheetDragStartY.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleSheetPointerUp(event: PointerEvent<HTMLButtonElement>) {
    const startY = sheetDragStartY.current;
    sheetDragStartY.current = null;

    if (startY === null) {
      return;
    }

    const deltaY = event.clientY - startY;

    if (Math.abs(deltaY) < 36) {
      setSheetState((state) => getNextSheetState(state));
      return;
    }

    if (deltaY > 0) {
      setSheetState((state) => (state === 'expanded' ? 'mid' : 'collapsed'));
      return;
    }

    setSheetState((state) => (state === 'collapsed' ? 'mid' : 'expanded'));
  }

  function handleSheetPointerCancel() {
    sheetDragStartY.current = null;
  }

  function chooseRecommendedPlace(place: RecommendedPlace) {
    setSelectedPlaceId(place.id);
    setManualLocation(place.coordinates);
    setCompareOpen(false);
    setSheetState('mid');
  }

  function handleManualSelect(next: { lat: number; lng: number }) {
    setSelectedPlaceId(null);
    setManualLocation(next);
    setCompareOpen(false);
    setSheetState('mid');
  }

  function handleCurrentLocation() {
    setSelectedPlaceId(null);
    requestCurrentLocation();
    setCompareOpen(false);
    setSheetState('mid');
  }

  return (
    <AppShell largeText={largeText}>
      <main className="map-app-page">
        <section className="map-app-shell" aria-label="주변 이동 정보">
          <div className="map-surface">
            <div className="top-location-bar">
              <div>
                <span>{isFetching ? '정보 확인 중' : '걷기 전 확인'}</span>
                <strong>{placeLabel}</strong>
              </div>
              <button className="mini-map-button" onClick={handleCurrentLocation} type="button">
                내 위치
              </button>
            </div>

            <SummaryMap
              coordinates={activeCoordinates}
              onManualSelect={handleManualSelect}
              selectionMode={selectionMode}
              summary={summary}
            />
          </div>

          <aside className={`bottom-summary-sheet ${sheetState}`} aria-label="이동 정보 요약">
            <button
              aria-label={`정보 시트 상태 변경, 현재 ${sheetState}`}
              className="sheet-handle"
              onPointerCancel={handleSheetPointerCancel}
              onPointerDown={handleSheetPointerDown}
              onPointerUp={handleSheetPointerUp}
              type="button"
            >
              <span aria-hidden="true" />
            </button>

            {!isSupportedArea ? (
              <div className="support-area-card" role="status" aria-live="polite">
                <span>지원 지역 안내</span>
                <h1>아직 이 위치는 지원 범위 밖이에요</h1>
                <p>
                  지금은 신호와 버스 실데이터가 안정적으로 확인된 울산을 중심으로 안내합니다.
                  아래에서 바로 확인할 수 있어요.
                </p>
                <div className="verified-place-grid">
                  {RECOMMENDED_PLACES.map((place) => (
                    <button
                      className="primary-button"
                      key={place.id}
                      onClick={() => chooseRecommendedPlace(place)}
                      type="button"
                    >
                      {place.label}
                    </button>
                  ))}
                  <button
                    className="secondary-button"
                    onClick={() => setSelectionMode(!selectionMode)}
                    type="button"
                  >
                    {selectionMode ? '위치 선택 중' : '지도에서 고르기'}
                  </button>
                </div>
                {errorMessage ? <div className="inline-notice">{errorMessage}</div> : null}
              </div>
            ) : null}

            {isSupportedArea && isLoading ? (
              <div className="sheet-message">
                <strong>주변 정보를 불러오고 있어요</strong>
                <p>잠시만 기다려 주세요.</p>
              </div>
            ) : null}

            {isSupportedArea && isError ? (
              <div className="sheet-message error">
                <strong>정보를 가져오지 못했어요</strong>
                <p>잠시 후 다시 시도해 주세요.</p>
                <button className="primary-button" onClick={() => refetch()} type="button">
                  다시 불러오기
                </button>
              </div>
            ) : null}

            {summary ? (
              <>
                <div className="service-identity-card">
                  <div className="identity-pill-row">
                    <span>교통약자 출발 전 판단 보조</span>
                    <span>길찾기보다 지금 판단</span>
                  </div>
                  <h2>길찾기 앱이 아니라, 지금 출발해도 덜 불안한지 먼저 봐요</h2>
                  <p>
                    신호와 버스 실시간 정보를 교통약자 관점으로 다시 읽어, 건너기 전 신호와
                    버스 탈 여유, 정류장 접근 부담을 먼저 보여줍니다.
                  </p>
                  <div className="value-chip-row">
                    <span>건너기 전 신호</span>
                    <span>버스 탈 여유</span>
                    <span>정류장 접근 부담</span>
                  </div>
                </div>

                <div className="scenario-selector">
                  {SCENARIO_OPTIONS.map((option) => (
                    <button
                      className={persona === option.id ? 'active' : ''}
                      key={option.id}
                      onClick={() => setPersona(option.id)}
                      type="button"
                    >
                      <strong>{option.label}</strong>
                      <span>{option.subtitle}</span>
                    </button>
                  ))}
                </div>

                <div className="sheet-summary">
                  <div>
                    <span>{selectedScenario.goal}</span>
                    <h1>{summaryMessage}</h1>
                    <p>{summary.movementBurden.whyNow}</p>
                    {summaryReason ? <em className="assistive-reason">{summaryReason}</em> : null}
                  </div>
                  <div className="score-cluster">
                    <div className="sheet-score-pill">
                      <strong>{summary.movementBurden.score}점</strong>
                      <span>참고 지표</span>
                    </div>
                    <button
                      className="score-help-button"
                      onClick={() => setScoreOpen((open) => !open)}
                      type="button"
                    >
                      점수 뜻
                    </button>
                  </div>
                </div>

                {scoreOpen ? (
                  <div className="score-help-panel">
                    <p>
                      신호 잔여시간, 버스 여유, 교차로 복잡도, 정류장 접근 부담, 데이터 최신성을
                      합친 참고 지표입니다.
                    </p>
                    <div className="score-breakdown-list">
                      {summary.movementBurden.scoreBreakdown.map((item) => (
                        <article key={item.id}>
                          <div>
                            <strong>{item.label}</strong>
                            <span>{item.score}점</span>
                          </div>
                          <p>{item.reason}</p>
                        </article>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="sheet-action-grid">
                  <button className="primary-button" onClick={handleCurrentLocation} type="button">
                    내 위치로 보기
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => setSelectionMode(!selectionMode)}
                    type="button"
                  >
                    {selectionMode ? '선택 마치기' : '지도에서 고르기'}
                  </button>
                  <button
                    className={`chip-button${largeText ? ' active' : ''}`}
                    onClick={toggleLargeText}
                    type="button"
                  >
                    글자 크게
                  </button>
                  <button
                    className={`chip-button${simpleMode ? ' active' : ''}`}
                    onClick={toggleSimpleMode}
                    type="button"
                  >
                    간단히
                  </button>
                </div>

                {errorMessage ? <div className="inline-notice">{errorMessage}</div> : null}

                <div className="why-different-card">
                  <strong>왜 다른가</strong>
                  <p>일반 지도앱이 길과 도착을 보여준다면, SafeCross는 출발 직전의 부담 판단을 먼저 돕습니다.</p>
                </div>

                {simpleMode ? (
                  <div className="simple-sheet-note">
                    <strong>간단히 보는 중</strong>
                    <div className="simple-row-list">
                      {simpleRows.map((row) => (
                        <p key={row.label}>
                          <span>{row.label}</span>
                          <strong>{row.value}</strong>
                        </p>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="nearby-list">
                    {nearbyRows.map((row) => (
                      <article className="nearby-row" key={row.id}>
                        <span>{row.label}</span>
                        <strong>{row.title}</strong>
                        <em>{row.value}</em>
                      </article>
                    ))}
                  </div>
                )}

                {!simpleMode ? (
                  <div className="compare-drawer">
                    <button
                      className="compare-toggle"
                      onClick={() => setCompareOpen((open) => !open)}
                      type="button"
                    >
                      <span>다른 방법도 볼까요?</span>
                      <strong>{compareOpen ? '닫기' : '보기'}</strong>
                    </button>

                    {compareOpen ? (
                      <div className="compare-drawer-body">
                        <div className="target-chip-row">
                          {COMPARE_TARGETS.map((target) => (
                            <button
                              className={selectedCompareTargetId === target.id ? 'active' : ''}
                              key={target.id}
                              onClick={() => setSelectedCompareTargetId(target.id)}
                              type="button"
                            >
                              {target.label}
                            </button>
                          ))}
                        </div>
                        {isCompareLoading ? (
                          <div className="inline-notice">비교 정보를 불러오는 중입니다.</div>
                        ) : null}
                        {isCompareError ? (
                          <div className="inline-notice">비교 정보를 불러오지 못했습니다.</div>
                        ) : null}
                        {compare ? (
                          <RouteCompareCard
                            compare={compare}
                            targetDescription={selectedCompareTarget.description}
                            targetLabel={selectedCompareTarget.label}
                          />
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="concern-card">
                  <strong>왜 이렇게 안내하나요?</strong>
                  <p>{summary.movementBurden.whyNow}</p>
                  <div className="concern-list">
                    {summary.movementBurden.topConcerns.length > 0 ? (
                      summary.movementBurden.topConcerns.map((concern) => <span key={concern}>{concern}</span>)
                    ) : (
                      <span>현재는 과도한 주의 요소보다 현장 확인을 함께 권장하는 상태입니다.</span>
                    )}
                  </div>
                  <em>{safetyReminder}</em>
                </div>

                <div className="scenario-card-grid">
                  <article>
                    <strong>천천히 걸어 버스를 타러 갈 때</strong>
                    <p>신호가 곧 바뀌는지와 정류장까지 접근 부담을 같이 보고 서두를 필요가 있는지 확인합니다.</p>
                  </article>
                  <article>
                    <strong>보호자가 함께 확인할 때</strong>
                    <p>데이터 최신성과 주의 포인트를 더 자세히 보고 출발 전에 같이 판단할 수 있습니다.</p>
                  </article>
                </div>

                <div className="evidence-card">
                  <button
                    className="compare-toggle"
                    onClick={() => setEvidenceOpen((open) => !open)}
                    type="button"
                  >
                    <span>데이터 근거 보기</span>
                    <strong>{evidenceOpen ? '닫기' : '보기'}</strong>
                  </button>

                  {evidenceOpen ? (
                    <div className="evidence-card-body">
                      <div className="evidence-grid">
                        <article>
                          <strong>신호 데이터</strong>
                          <p>{getServiceSourceLabel(summary.dataContext.serviceSources.signals)} · 교차로 기본 정보와 잔여시간을 함께 봅니다.</p>
                        </article>
                        <article>
                          <strong>버스 데이터</strong>
                          <p>{getServiceSourceLabel(summary.dataContext.serviceSources.buses)} · 노선, 종점, 가까운 정류장 맥락을 함께 봅니다.</p>
                        </article>
                        <article>
                          <strong>보행 맥락</strong>
                          <p>{summary.walkContext.source === 'osm' ? 'OpenStreetMap 기반' : '기본 추정치'} · 횡단보도, 계단, 정류장 접근 단서를 함께 봅니다.</p>
                        </article>
                      </div>
                      <p className="evidence-note">
                        울산은 신호와 버스 실데이터가 함께 안정적으로 검증된 지역이라 기본 기준
                        위치로 사용합니다.
                      </p>
                    </div>
                  ) : null}
                </div>

                <div className="sheet-footnote">
                  <span>마지막 확인 {formatRelativeTime(summary.lastUpdatedAt)}</span>
                  <span>현장 상황을 우선해 주세요.</span>
                </div>
              </>
            ) : null}
          </aside>
        </section>
      </main>
    </AppShell>
  );
}
