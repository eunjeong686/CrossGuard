import { useState } from 'react';
import { InfoCard } from '../components/cards/InfoCard';
import { RouteCompareCard } from '../components/cards/RouteCompareCard';
import { SimpleModeCard } from '../components/cards/SimpleModeCard';
import { SummaryHeroCard } from '../components/cards/SummaryHeroCard';
import { ModeToggle } from '../components/common/ModeToggle';
import { AppShell } from '../components/layout/AppShell';
import { SummaryMap } from '../components/map/SummaryMap';
import { useLocation } from '../hooks/useLocation';
import { useRouteCompare } from '../hooks/useRouteCompare';
import { useSummary } from '../hooks/useSummary';
import { useUiStore } from '../stores/uiStore';
import { formatCoordinates, formatRelativeTime } from '../utils/format';
import type { DataOrigin } from '../types/api';

type DemoPreset = {
  id: 'ulsan-live' | 'seoul-mobility';
  label: string;
  description: string;
  coordinates?: { lat: number; lng: number };
  signalStdgCd?: string;
  busStdgCd?: string;
  mobilityStdgCd?: string;
  supportedCards: Array<'signals' | 'buses' | 'mobility'>;
};

const DEMO_PRESETS: DemoPreset[] = [
  {
    id: 'ulsan-live',
    label: '버스 보기',
    description: '횡단보도와 버스 정보를 함께 보여줘요',
    coordinates: { lat: 35.5384, lng: 129.3114 },
    signalStdgCd: '3100000000',
    busStdgCd: '3100000000',
    mobilityStdgCd: '3100000000',
    supportedCards: ['signals', 'buses'],
  },
  {
    id: 'seoul-mobility',
    label: '이동지원 보기',
    description: '이동지원 정보를 먼저 보여줘요',
    coordinates: { lat: 37.5665, lng: 126.978 },
    signalStdgCd: '1100000000',
    busStdgCd: '1100000000',
    mobilityStdgCd: '1100000000',
    supportedCards: ['mobility'],
  },
];

type DemoScenario = {
  id: 'senior-bus' | 'guardian-mode' | 'signal-safety';
  title: string;
  description: string;
  actionLabel: string;
  presetId: DemoPreset['id'];
  largeText: boolean;
  simpleMode: boolean;
};

type CompareTarget = {
  id: 'bus-stop' | 'support-center' | 'safe-crossing';
  label: string;
  description: string;
  offset: { lat: number; lng: number };
};

const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: 'senior-bus',
    title: '버스를 타러 가기 전에 보기',
    description: '횡단보도와 버스 시간을 같이 보면서 움직일 수 있어요.',
    actionLabel: '버스 먼저 보기',
    presetId: 'ulsan-live',
    largeText: false,
    simpleMode: false,
  },
  {
    id: 'guardian-mode',
    title: '보호자와 함께 보기',
    description: '글자를 키우고 화면을 단순하게 바꿔서 바로 보여줍니다.',
    actionLabel: '크고 간단하게 보기',
    presetId: 'seoul-mobility',
    largeText: true,
    simpleMode: true,
  },
  {
    id: 'signal-safety',
    title: '횡단 전에 한 번 더 보기',
    description: '신호 정보는 참고용으로만 보여주고 꼭 확인할 점을 함께 안내합니다.',
    actionLabel: '횡단 전 정보 보기',
    presetId: 'ulsan-live',
    largeText: false,
    simpleMode: false,
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
    description: '걷는 거리와 신호를 함께 보고 보수적으로 비교합니다.',
    offset: { lat: 0.0006, lng: 0.0012 },
  },
];

function getSourceLabel(source: DataOrigin) {
  if (source === 'live') {
    return '바로 확인';
  }

  if (source === 'mock') {
    return '참고';
  }

  return '꺼짐';
}

function getSourceTone(source: DataOrigin): 'live' | 'mock' | 'off' {
  if (source === 'live') {
    return 'live';
  }

  if (source === 'mock') {
    return 'mock';
  }

  return 'off';
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
    status,
  } = useLocation();
  const [selectedPresetId, setSelectedPresetId] = useState<DemoPreset['id'] | null>(null);
  const [selectedCompareTargetId, setSelectedCompareTargetId] =
    useState<CompareTarget['id']>('bus-stop');
  const {
    largeText,
    simpleMode,
    setLargeText,
    setSimpleMode,
    toggleLargeText,
    toggleSimpleMode,
  } = useUiStore();
  const selectedPreset = DEMO_PRESETS.find((preset) => preset.id === selectedPresetId) ?? null;
  const activeCoordinates = selectedPreset?.coordinates ?? coordinates;
  const summaryOptions =
    !selectedPreset
      ? undefined
      : {
          signalStdgCd: selectedPreset.signalStdgCd,
          busStdgCd: selectedPreset.busStdgCd,
          mobilityStdgCd: selectedPreset.mobilityStdgCd,
          includeSignals: selectedPreset.supportedCards.includes('signals'),
          includeBuses: selectedPreset.supportedCards.includes('buses'),
          includeMobility: selectedPreset.supportedCards.includes('mobility'),
        };
  const visibleCards = selectedPreset?.supportedCards ?? ['signals', 'buses', 'mobility'];
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
  const compareOptions = selectedPreset
    ? {
        signalStdgCd: selectedPreset.signalStdgCd,
        busStdgCd: selectedPreset.busStdgCd,
        mobilityStdgCd: selectedPreset.mobilityStdgCd,
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
  const primaryScenario = DEMO_SCENARIOS[0];
  function activateScenario(scenario: DemoScenario) {
    setSelectedPresetId(scenario.presetId);
    setLargeText(scenario.largeText);
    setSimpleMode(scenario.simpleMode);

    const preset = DEMO_PRESETS.find((item) => item.id === scenario.presetId);
    if (preset?.coordinates) {
      setManualLocation(preset.coordinates);
    }
  }

  return (
    <AppShell largeText={largeText}>
      <main className="page">
        <section className="masthead hero-stage">
          <div className="hero-copy-panel">
            <div className="badge-row">
              <span className="service-badge">걷기 전 확인 도우미</span>
              <span className="status-chip">{isFetching ? '지금 정보 확인 중' : '바로 확인 가능'}</span>
            </div>
            <div className="masthead-copy">
              <div>
                <p className="eyebrow">SafeCross Mobility</p>
                <h1>횡단보도, 버스, 이동지원 정보를 한눈에 보여주는 생활 도우미</h1>
                <p className="hero-lead">
                  멀리 걷기 전에, 버스를 기다리기 전에, 다른 이동 수단이 필요한지 먼저 살펴볼 수
                  있게 핵심 정보만 모아 보여줍니다.
                </p>
              </div>
            </div>
            <div className="hero-action-row">
              <button className="primary-button hero-button" onClick={() => activateScenario(primaryScenario)} type="button">
                지금 보기
              </button>
              <button
                className="secondary-button hero-button"
                onClick={() => {
                  setSelectedPresetId(null);
                  requestCurrentLocation();
                }}
                type="button"
              >
                현재 위치 보기
              </button>
            </div>
            <div className="hero-proof-grid compact">
              <article className="proof-card">
                <span>먼저 보기</span>
                <strong>신호와 버스</strong>
                <p>횡단하기 전과 버스를 기다릴 때 필요한 정보부터 보여줍니다.</p>
              </article>
              <article className="proof-card">
                <span>같이 보기</span>
                <strong>글자 크게, 화면 간단히</strong>
                <p>부모님이나 보호자와 볼 때 헷갈리지 않도록 바로 바꿀 수 있습니다.</p>
              </article>
            </div>
          </div>

          <div className="hero-side-panel">
            <div className="safety-panel">
              <strong>앱보다 현장 신호를 먼저 확인해 주세요.</strong>
              <p>이 화면은 참고용이고, 실제 신호와 주변 상황이 가장 중요합니다.</p>
            </div>
            <div className="checkpoint-card soft">
              <p className="eyebrow">도움말</p>
              <p>지금 필요한 정보부터 보고, 조금 더 편한 선택을 고를 수 있어요.</p>
            </div>
          </div>
        </section>

        <section className="control-strip">
          <div className="location-card">
            <div>
              <p className="eyebrow">현재 위치</p>
              <h2>{selectedPreset ? selectedPreset.label : locationLabel}</h2>
              <p>{formatCoordinates(activeCoordinates.lat, activeCoordinates.lng)}</p>
              <small>
                {!selectedPreset
                  ? status === 'loading'
                    ? '위치를 확인하고 있어요.'
                    : '위치를 허용하지 않아도 지도에서 직접 고를 수 있어요.'
                  : selectedPreset.description}
              </small>
            </div>
            <div className="button-row">
              <button
                className="primary-button"
                onClick={() => {
                  setSelectedPresetId(null);
                  requestCurrentLocation();
                }}
                type="button"
              >
                현재 위치 사용
              </button>
              <button className="secondary-button" onClick={() => setSelectionMode(!selectionMode)} type="button">
                {selectionMode ? '선택 마치기' : '지도에서 고르기'}
              </button>
            </div>
            {errorMessage ? <div className="inline-notice">{errorMessage}</div> : null}
            <div className="preset-strip">
              {DEMO_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  className={`preset-button${selectedPresetId === preset.id ? ' active' : ''}`}
                  onClick={() => {
                    setSelectedPresetId(preset.id);
                    if (preset.coordinates) {
                      setManualLocation(preset.coordinates);
                    }
                  }}
                  type="button"
                >
                  <span>{preset.label}</span>
                  <small>{preset.description}</small>
                </button>
              ))}
            </div>
            {selectedPreset ? (
              <div className="demo-callout">
                <strong>{selectedPreset.label}</strong>
                <p>{selectedPreset.description}.</p>
              </div>
            ) : null}
          </div>

          <div className="mode-strip">
            <ModeToggle
              active={largeText}
              description="글자를 더 크게 보여줘요."
              iconLabel="글씨"
              label="글자 크게 보기"
              onClick={toggleLargeText}
            />
            <ModeToggle
              active={simpleMode}
              description="꼭 필요한 정보만 남겨요."
              iconLabel="간단"
              label="간단히 보기"
              onClick={toggleSimpleMode}
            />
          </div>
        </section>

        <section className="scenario-section">
          <div className="scenario-header">
            <div>
              <p className="eyebrow">자주 쓰는 보기</p>
              <h2>원하는 방식으로 바로 바꿔 보기</h2>
            </div>
          </div>
          <div className="scenario-grid compact">
            {DEMO_SCENARIOS.map((scenario, index) => (
              <button
                className="scenario-quick-button"
                key={scenario.id}
                onClick={() => activateScenario(scenario)}
                type="button"
              >
                <span className="scenario-step">바로 보기 {index + 1}</span>
                <strong>{scenario.title}</strong>
                <small>{scenario.description}</small>
              </button>
            ))}
          </div>
        </section>

        {isLoading ? (
          <section className="loading-panel">
            <h2>주변 정보를 불러오는 중입니다</h2>
            <p>가장 가까운 교차로, 버스, 이동지원 수단을 정리하고 있습니다.</p>
          </section>
        ) : null}

        {isError ? (
          <section className="error-panel">
            <h2>요약 정보를 가져오지 못했습니다</h2>
            <p>일시적인 API 문제일 수 있습니다. 다시 시도해 주세요.</p>
            <button className="primary-button" onClick={() => refetch()} type="button">
              다시 불러오기
            </button>
          </section>
        ) : null}

        {summary ? (
          <>
            <SummaryHeroCard summary={summary} />
            {simpleMode ? <SimpleModeCard summary={summary} visibleCards={visibleCards} /> : null}

            {!simpleMode ? (
              <>
                <SummaryMap
                  coordinates={activeCoordinates}
                  onManualSelect={(next) => {
                    setSelectedPresetId(null);
                    setManualLocation(next);
                  }}
                  selectionMode={selectionMode}
                  summary={summary}
                />

                <section className="route-compare-section">
                  <div className="route-compare-controls">
                    <div>
                      <p className="eyebrow">비교해서 보기</p>
                      <h2>어느 쪽이 조금 더 편한지 비교해 볼 수 있어요</h2>
                    </div>
                    <div className="preset-strip">
                      {COMPARE_TARGETS.map((target) => (
                        <button
                          key={target.id}
                          className={`preset-button${selectedCompareTargetId === target.id ? ' active' : ''}`}
                          onClick={() => setSelectedCompareTargetId(target.id)}
                          type="button"
                        >
                          <span>{target.label}</span>
                          <small>{target.description}</small>
                        </button>
                      ))}
                    </div>
                  </div>
                  {isCompareLoading ? (
                    <div className="inline-notice">비교 정보를 불러오는 중입니다.</div>
                  ) : null}
                  {isCompareError ? (
                    <div className="inline-notice">비교 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</div>
                  ) : null}
                  {compare ? (
                    <RouteCompareCard
                      compare={compare}
                      targetDescription={selectedCompareTarget.description}
                      targetLabel={selectedCompareTarget.label}
                    />
                  ) : null}
                </section>

                <section className="card-grid">
                  {visibleCards.includes('signals') ? (
                    <InfoCard
                      body="실제 신호를 꼭 다시 확인해 주세요."
                      eyebrow="횡단보도 정보"
                      highlight={
                        summary.topSignal?.remainingSeconds != null
                          ? `${summary.topSignal.remainingSeconds}초 남음`
                          : '시간 정보 없음'
                      }
                      meta={summary.topSignal?.direction ?? '방향 정보 없음'}
                      iconLabel="신호"
                      sourceText={getSourceLabel(summary.dataContext.serviceSources.signals)}
                      sourceTone={getSourceTone(summary.dataContext.serviceSources.signals)}
                      title={summary.topSignal?.intersectionName ?? '주변 횡단보도 정보 없음'}
                      tone={summary.topSignal?.pedestrianSignalStatus === 'GREEN' ? 'safe' : 'warn'}
                      updatedAt={summary.topSignal?.collectedAt ?? summary.lastUpdatedAt}
                    />
                  ) : null}
                  {visibleCards.includes('buses') ? (
                    <InfoCard
                      body="금방 오는지, 조금 서둘러야 하는지 쉽게 보여줘요."
                      eyebrow="버스 정보"
                      highlight={summary.topBus?.etaCategory ?? '정보 없음'}
                      meta={summary.topBus ? `${summary.topBus.routeNo}번 · ${summary.topBus.nearStopName}` : '버스 정보 없음'}
                      iconLabel="버스"
                      sourceText={getSourceLabel(summary.dataContext.serviceSources.buses)}
                      sourceTone={getSourceTone(summary.dataContext.serviceSources.buses)}
                      title={summary.topBus ? `${summary.topBus.routeType} ${summary.topBus.routeNo}번` : '주변 버스 정보 없음'}
                      updatedAt={summary.topBus?.lastUpdatedAt ?? summary.lastUpdatedAt}
                    />
                  ) : null}
                  {visibleCards.includes('mobility') ? (
                    <InfoCard
                      body="바로 이용할 수 있는지, 더 확인이 필요한지 보여줘요."
                      eyebrow="이동지원 정보"
                      highlight={summary.topMobility?.serviceStatus ?? '정보 없음'}
                      meta={
                        summary.topMobility
                          ? `가용 차량 ${summary.topMobility.availableVehicleCount ?? 0}대`
                          : '주변 이동지원 정보 없음'
                      }
                      iconLabel="지원"
                      sourceText={getSourceLabel(summary.dataContext.serviceSources.mobility)}
                      sourceTone={getSourceTone(summary.dataContext.serviceSources.mobility)}
                      title={summary.topMobility?.centerName ?? '주변 이동지원 정보 없음'}
                      updatedAt={summary.topMobility?.lastUpdatedAt ?? summary.lastUpdatedAt}
                    />
                  ) : null}
                </section>
              </>
            ) : null}

            <section className="footer-note">
              <div>
                <p className="eyebrow">안전 안내</p>
                <h2>{summary.disclaimer}</h2>
              </div>
              <small>마지막 갱신 {formatRelativeTime(summary.lastUpdatedAt)}</small>
            </section>
          </>
        ) : null}
      </main>
    </AppShell>
  );
}
