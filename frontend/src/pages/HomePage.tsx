import { useState } from 'react';
import { RouteCompareCard } from '../components/cards/RouteCompareCard';
import { AppShell } from '../components/layout/AppShell';
import { SummaryMap } from '../components/map/SummaryMap';
import { useLocation } from '../hooks/useLocation';
import { useRouteCompare } from '../hooks/useRouteCompare';
import { useSummary } from '../hooks/useSummary';
import { useUiStore } from '../stores/uiStore';
import { formatRelativeTime } from '../utils/format';

type RecommendedPlace = {
  id: 'ulsan-live' | 'seoul-mobility';
  label: string;
  description: string;
  coordinates: { lat: number; lng: number };
  signalStdgCd?: string;
  busStdgCd?: string;
  mobilityStdgCd?: string;
  supportedCards: Array<'signals' | 'buses' | 'mobility'>;
};

type CompareTarget = {
  id: 'bus-stop' | 'support-center' | 'safe-crossing';
  label: string;
  description: string;
  offset: { lat: number; lng: number };
};

const RECOMMENDED_PLACES: RecommendedPlace[] = [
  {
    id: 'ulsan-live',
    label: '버스와 신호를 함께 보기',
    description: '걷기 전 신호와 버스 정보를 먼저 살펴봅니다.',
    coordinates: { lat: 35.5384, lng: 129.3114 },
    signalStdgCd: '3100000000',
    busStdgCd: '3100000000',
    mobilityStdgCd: '3100000000',
    supportedCards: ['signals', 'buses'],
  },
  {
    id: 'seoul-mobility',
    label: '이동지원 먼저 보기',
    description: '이동지원 정보를 먼저 확인합니다.',
    coordinates: { lat: 37.5665, lng: 126.978 },
    signalStdgCd: '1100000000',
    busStdgCd: '1100000000',
    mobilityStdgCd: '1100000000',
    supportedCards: ['mobility'],
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
    id: 'support-center',
    label: '이동지원 쪽으로 가기',
    description: '이동지원 쪽으로 움직일 때 더 편한지 살펴봅니다.',
    offset: { lat: -0.001, lng: 0.0009 },
  },
  {
    id: 'safe-crossing',
    label: '조금 더 편한 길 보기',
    description: '걷는 거리와 신호를 함께 보고 비교합니다.',
    offset: { lat: 0.0006, lng: 0.0012 },
  },
];

function getMoveSuggestion(label?: string) {
  if (label === '높음') {
    return '이동지원이나 다른 이동 방법을 먼저 살펴보세요.';
  }

  if (label === '낮음') {
    return '현재 정보로는 비교적 여유가 있어요.';
  }

  return '신호와 버스를 같이 확인하고 움직이세요.';
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
  const [compareOpen, setCompareOpen] = useState(false);
  const { largeText, simpleMode, toggleLargeText, toggleSimpleMode } = useUiStore();
  const selectedPlace =
    RECOMMENDED_PLACES.find((place) => place.id === selectedPlaceId) ?? null;
  const activeCoordinates = selectedPlace?.coordinates ?? coordinates;
  const visibleCards = selectedPlace?.supportedCards ?? ['signals', 'buses', 'mobility'];
  const summaryOptions =
    !selectedPlace
      ? undefined
      : {
          signalStdgCd: selectedPlace.signalStdgCd,
          busStdgCd: selectedPlace.busStdgCd,
          mobilityStdgCd: selectedPlace.mobilityStdgCd,
          includeSignals: selectedPlace.supportedCards.includes('signals'),
          includeBuses: selectedPlace.supportedCards.includes('buses'),
          includeMobility: selectedPlace.supportedCards.includes('mobility'),
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
  const compareOptions = selectedPlace
    ? {
        signalStdgCd: selectedPlace.signalStdgCd,
        busStdgCd: selectedPlace.busStdgCd,
        mobilityStdgCd: selectedPlace.mobilityStdgCd,
      }
    : undefined;
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
  const placeLabel = selectedPlace?.label ?? locationLabel;
  const nearbyRows = summary
    ? [
        visibleCards.includes('signals')
          ? {
              id: 'signals',
              label: '횡단보도',
              title: summary.topSignal?.intersectionName ?? '가까운 신호 정보 없음',
              value:
                summary.topSignal?.remainingSeconds != null
                  ? `${summary.topSignal.remainingSeconds}초 남음`
                  : (summary.topSignal?.pedestrianSignalStatusLabel ?? '확인 필요'),
            }
          : null,
        visibleCards.includes('buses')
          ? {
              id: 'buses',
              label: '버스',
              title: summary.topBus
                ? `${summary.topBus.routeType} ${summary.topBus.routeNo}번`
                : '가까운 버스 정보 없음',
              value: summary.topBus?.etaCategory ?? '확인 필요',
            }
          : null,
        visibleCards.includes('mobility')
          ? {
              id: 'mobility',
              label: '이동지원',
              title: summary.topMobility?.centerName ?? '가까운 이동지원 정보 없음',
              value: summary.topMobility?.serviceStatus ?? '확인 필요',
            }
          : null,
      ].filter((row) => row != null)
    : [];

  function chooseRecommendedPlace(place: RecommendedPlace) {
    setSelectedPlaceId(place.id);
    setManualLocation(place.coordinates);
    setCompareOpen(false);
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
              <button
                className="mini-map-button"
                onClick={() => {
                  setSelectedPlaceId(null);
                  requestCurrentLocation();
                }}
                type="button"
              >
                내 위치
              </button>
            </div>

            {summary ? (
              <SummaryMap
                coordinates={activeCoordinates}
                onManualSelect={(next) => {
                  setSelectedPlaceId(null);
                  setManualLocation(next);
                  setCompareOpen(false);
                }}
                selectionMode={selectionMode}
                summary={summary}
              />
            ) : (
              <div className="empty-map-panel">
                <strong>{isLoading ? '주변 정보를 불러오고 있어요' : '지도를 준비하고 있어요'}</strong>
                <p>위치를 기준으로 신호, 버스, 이동지원 정보를 정리합니다.</p>
              </div>
            )}
          </div>

          <aside className="bottom-summary-sheet" aria-label="이동 정보 요약">
            <div className="sheet-handle" aria-hidden="true" />

            {isLoading ? (
              <div className="sheet-message">
                <strong>주변 정보를 불러오고 있어요</strong>
                <p>잠시만 기다려 주세요.</p>
              </div>
            ) : null}

            {isError ? (
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
                <div className="sheet-summary">
                  <div>
                    <span>지금은 {summary.movementBurden.label}</span>
                    <h1>{getMoveSuggestion(summary.movementBurden.label)}</h1>
                    <p>앱 안내보다 현장 신호와 주변 상황을 먼저 확인해 주세요.</p>
                  </div>
                  <div className="sheet-score-pill">
                    <strong>{summary.movementBurden.score}</strong>
                    <span>점</span>
                  </div>
                </div>

                <div className="sheet-action-grid">
                  <button
                    className="primary-button"
                    onClick={() => {
                      setSelectedPlaceId(null);
                      requestCurrentLocation();
                    }}
                    type="button"
                  >
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

                <details className="recommended-places">
                  <summary>추천 위치</summary>
                  <div className="recommended-place-list">
                    {RECOMMENDED_PLACES.map((place) => (
                      <button
                        className={selectedPlaceId === place.id ? 'active' : ''}
                        key={place.id}
                        onClick={() => chooseRecommendedPlace(place)}
                        type="button"
                      >
                        <strong>{place.label}</strong>
                        <span>{place.description}</span>
                      </button>
                    ))}
                  </div>
                </details>

                <div className="nearby-list">
                  {nearbyRows.map((row) => (
                    <article className="nearby-row" key={row.id}>
                      <span>{row.label}</span>
                      <strong>{row.title}</strong>
                      <em>{row.value}</em>
                    </article>
                  ))}
                </div>

                {simpleMode ? (
                  <div className="simple-sheet-note">
                    <strong>간단히 보는 중</strong>
                    <p>꼭 필요한 정보만 먼저 보여드리고 있어요.</p>
                  </div>
                ) : null}

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
