import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { AppShell } from '../components/layout/AppShell';
import { SummaryMap } from '../components/map/SummaryMap';
import { useLocation } from '../hooks/useLocation';
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

type SheetState = 'collapsed' | 'mid' | 'expanded';
type SignalCountdownState = 'countdown' | 'stale' | 'unknown';
type ScenarioOption = {
  id: Persona;
  label: string;
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

const SCENARIO_OPTIONS: ScenarioOption[] = [
  {
    id: 'elder',
    label: '혼자 보기',
    goal: '건너기 전 신호',
  },
  {
    id: 'guardian',
    label: '보호자 함께 보기',
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
  const [persona, setPersona] = useState<Persona>('elder');
  const [scoreOpen, setScoreOpen] = useState(false);
  const [concernOpen, setConcernOpen] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [sheetState, setSheetState] = useState<SheetState>('mid');
  const [displayRemainingSeconds, setDisplayRemainingSeconds] = useState<number | null>(null);
  const [signalCountdownState, setSignalCountdownState] = useState<SignalCountdownState>('unknown');
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
  const selectedScenario =
    SCENARIO_OPTIONS.find((option) => option.id === persona) ?? SCENARIO_OPTIONS[0];
  const placeLabel = selectedPlace?.label ?? activePlaceProfile?.currentLabel ?? locationLabel;
  const summaryMessage =
    summary?.movementBurden.assistiveInsight.message ?? '신호와 이동수단을 함께 확인해 주세요.';
  const summaryReason = summary?.movementBurden.assistiveInsight.reason;
  const safetyReminder =
    summary?.movementBurden.assistiveInsight.safetyReminder ??
    '앱 안내는 참고용이며, 실제 현장 신호와 주변 상황을 우선 확인해 주세요.';

  useEffect(() => {
    const remainingSeconds = summary?.topSignal?.remainingSeconds;
    const collectedAt = summary?.topSignal?.collectedAt;

    if (remainingSeconds == null || !collectedAt) {
      const fallbackTimer = window.setTimeout(() => {
        setDisplayRemainingSeconds(null);
        setSignalCountdownState('unknown');
      }, 0);

      return () => {
        window.clearTimeout(fallbackTimer);
      };
    }

    const remainingSecondsValue = remainingSeconds;
    const collectedAtValue = collectedAt;

    function updateCountdown() {
      const elapsedSeconds = Math.max(
        0,
        Math.floor((Date.now() - new Date(collectedAtValue).getTime()) / 1000),
      );
      const nextRemaining = Math.max(0, remainingSecondsValue - elapsedSeconds);

      setDisplayRemainingSeconds(nextRemaining);
      setSignalCountdownState(nextRemaining > 0 ? 'countdown' : 'stale');
    }

    const initialTimer = window.setTimeout(updateCountdown, 0);
    const timer = window.setInterval(updateCountdown, 1000);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [summary?.topSignal?.remainingSeconds, summary?.topSignal?.collectedAt]);

  const signalCountdownLabel =
    signalCountdownState === 'countdown'
      ? `${displayRemainingSeconds ?? 0}초 남음`
      : signalCountdownState === 'stale'
        ? '다시 확인 중'
        : (summary?.topSignal?.pedestrianSignalStatusLabel ?? '확인 필요');

  const nearbyRows = summary
    ? [
        visibleCards.includes('signals')
          ? {
              id: 'signals',
              label: '가까운 신호',
              title: summary.topSignal?.intersectionName ?? '도착 전 신호 확인',
              value: signalCountdownLabel,
            }
          : null,
        visibleCards.includes('buses')
          ? {
              id: 'buses',
              label: '버스 여유',
              title: summary.topBus
                ? `${summary.topBus.routeNo}번`
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
                  ? `약 ${Math.round(summary.topBus.stopDistanceMeters)}m`
                  : '확인 필요',
            }
          : null,
        {
          id: 'walk-access',
          label: '보행 접근',
          title: summary.walkContext.accessibilityLabel,
          value: summary.walkContext.stepsNearby ? '계단 가능성 있음' : '계단 정보 없음',
        },
      ].filter((row) => row != null)
    : [];
  const simpleRows = summary
    ? [
        {
          label: '신호 참고',
          value: signalCountdownLabel,
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
  const viewMode: 'solo' | 'guardian' = persona === 'guardian' ? 'guardian' : 'solo';
  const topBusEta = summary?.topBus?.etaCategory ?? '버스 상태 확인';
  const busDistanceLabel =
    nearbyRows.find((row) => row.id === 'bus-distance')?.value ?? '거리 확인';
  const primaryFocus =
    signalCountdownState === 'stale' || signalCountdownState === 'unknown'
      ? {
          label: '먼저 확인할 것',
          title: '가까운 신호부터 다시 확인해 주세요',
          description: '신호 정보가 곧 바뀔 수 있어 눈앞의 신호와 차량 흐름을 먼저 보는 편이 좋습니다.',
          support: ['버스 여유 함께 보기', topBusEta],
        }
      : topBusEta === '촉박'
        ? {
            label: '먼저 확인할 것',
            title: '신호를 먼저 보고 버스는 서두르지 마세요',
            description: '이번 버스를 급하게 맞추기보다 가까운 신호와 정류장 접근을 함께 보는 편이 좋습니다.',
            support: [signalCountdownLabel, topBusEta],
          }
        : {
            label: '먼저 확인할 것',
            title: '버스 여유를 보고 천천히 움직여 보세요',
            description: '정류장까지 거리가 아주 멀지 않아 버스 상태와 신호를 함께 보며 이동하기 좋은 편입니다.',
            support: [topBusEta, busDistanceLabel],
          };
  const guardianChecks = [
    signalCountdownState !== 'countdown'
      ? '신호가 곧 바뀔 수 있어 현장 신호를 다시 확인해 주세요.'
      : `가까운 신호는 ${signalCountdownLabel} 기준입니다.`,
    busDistanceLabel !== '거리 확인'
      ? `정류장 접근 거리 ${busDistanceLabel}`
      : '정류장 접근 거리를 먼저 확인해 주세요.',
    '앱보다 실제 현장 신호와 차량 흐름을 우선해 주세요.',
  ];
  const soloHighlights = nearbyRows.slice(0, 4);

  function handleSheetPointerDown(event: PointerEvent<HTMLButtonElement>) {
    sheetDragStartY.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleSheetPointerUp(event: PointerEvent<HTMLButtonElement>) {
    const startY = sheetDragStartY.current;
    sheetDragStartY.current = null;

    if (startY === null) {
      return undefined;
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
    setConcernOpen(viewMode === 'guardian');
    setSheetState('mid');
  }

  function handleManualSelect(next: { lat: number; lng: number }) {
    setSelectedPlaceId(null);
    setManualLocation(next);
    setConcernOpen(viewMode === 'guardian');
    setSheetState('mid');
  }

  function handleCurrentLocation() {
    setSelectedPlaceId(null);
    requestCurrentLocation();
    setConcernOpen(viewMode === 'guardian');
    setSheetState('mid');
  }

  useEffect(() => {
    setConcernOpen(viewMode === 'guardian');
  }, [viewMode]);

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
              <div className="top-location-actions">
                <button className="mini-map-button" onClick={() => setEvidenceOpen((open) => !open)} type="button">
                  정보
                </button>
                <button className="mini-map-button" onClick={handleCurrentLocation} type="button">
                  내 위치
                </button>
              </div>
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
                <div className="scenario-selector">
                  {SCENARIO_OPTIONS.map((option) => (
                    <button
                      className={persona === option.id ? 'active' : ''}
                      key={option.id}
                      onClick={() => setPersona(option.id)}
                      type="button"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <div className="sheet-summary">
                  <div>
                    <span>{selectedScenario.goal}</span>
                    <h1>{summaryMessage}</h1>
                    <p>{viewMode === 'guardian' ? summary.movementBurden.whyNow : summaryReason ?? summary.movementBurden.whyNow}</p>
                  </div>
                  <div className="score-cluster">
                    <div className="sheet-score-pill">
                      <strong>{summary.movementBurden.score}점</strong>
                      <span>신호·버스·거리 기준</span>
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
                    <p>신호, 버스, 정류장 접근을 중심으로 참고 점수를 보여줍니다.</p>
                    <div className="score-breakdown-list">
                      {summary.movementBurden.scoreBreakdown
                        .filter((item) =>
                          ['signal', 'bus', 'walkAccess'].includes(item.id),
                        )
                        .map((item) => (
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

                <section className="priority-card" aria-label="지금 먼저 볼 것">
                  <span className="priority-card-label">{primaryFocus.label}</span>
                  <h2>{primaryFocus.title}</h2>
                  <p>{primaryFocus.description}</p>
                  <div className="priority-support-grid">
                    {primaryFocus.support.map((item) => (
                      <span key={item}>{item}</span>
                    ))}
                  </div>
                </section>

                {viewMode === 'guardian' ? (
                  <section className="guardian-check-card" aria-label="함께 다시 확인할 것">
                    <span className="guardian-check-label">함께 다시 확인할 것</span>
                    <div className="guardian-check-list">
                      {guardianChecks.map((item) => (
                        <p key={item}>{item}</p>
                      ))}
                    </div>
                  </section>
                ) : null}

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
                    {(viewMode === 'solo' ? soloHighlights : nearbyRows).map((row) => (
                      <article className="nearby-row" key={row.id}>
                        <span>{row.label}</span>
                        <strong>{row.title}</strong>
                        <em>{row.value}</em>
                      </article>
                    ))}
                  </div>
                )}

                <div className="concern-drawer">
                  <button
                    className="compare-toggle"
                    onClick={() => setConcernOpen((open) => !open)}
                    type="button"
                  >
                    <span>왜 이렇게 안내하나요?</span>
                    <strong>{concernOpen ? '닫기' : '보기'}</strong>
                  </button>

                  {concernOpen ? (
                    <div className="concern-panel">
                      {viewMode === 'guardian' ? <strong>판단 이유와 확인 포인트</strong> : null}
                      <div className="concern-list">
                        {summary.movementBurden.topConcerns.length > 0 ? (
                          summary.movementBurden.topConcerns.map((concern) => <span key={concern}>{concern}</span>)
                        ) : (
                          <span>과도한 주의 요소보다는 현장 확인을 함께 권장하는 상태입니다.</span>
                        )}
                      </div>
                      <p className="concern-note">{safetyReminder}</p>
                    </div>
                  ) : null}
                </div>

                {evidenceOpen ? (
                  <div className="evidence-inline-panel">
                    <p>
                      신호 {getServiceSourceLabel(summary.dataContext.serviceSources.signals)} · 버스{' '}
                      {getServiceSourceLabel(summary.dataContext.serviceSources.buses)} · 보행 맥락{' '}
                      {summary.walkContext.source === 'osm' ? 'OpenStreetMap' : '기본 추정치'}
                    </p>
                    <p>울산은 신호와 버스 실데이터가 함께 안정적으로 확인된 기준 위치입니다.</p>
                  </div>
                ) : null}

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
