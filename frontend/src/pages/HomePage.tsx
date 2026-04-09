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
    label: '울산 실데이터 데모',
    description: '신호등·버스 실시간 검증 완료',
    coordinates: { lat: 35.5384, lng: 129.3114 },
    signalStdgCd: '3100000000',
    busStdgCd: '3100000000',
    mobilityStdgCd: '3100000000',
    supportedCards: ['signals', 'buses'],
  },
  {
    id: 'seoul-mobility',
    label: '서울 이동지원 데모',
    description: '이동지원 실시간 검증 완료',
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
    title: '데모 1. 버스를 타러 가는 고령 사용자',
    description: '울산 실데이터로 신호 참고 정보와 버스 여유를 함께 보여줍니다.',
    actionLabel: '울산 버스 데모 시작',
    presetId: 'ulsan-live',
    largeText: false,
    simpleMode: false,
  },
  {
    id: 'guardian-mode',
    title: '데모 2. 보호자/동행 모드',
    description: '서울 이동지원 데이터를 큰 글씨와 단순 화면으로 바로 시연합니다.',
    actionLabel: '보호자 모드 시작',
    presetId: 'seoul-mobility',
    largeText: true,
    simpleMode: true,
  },
  {
    id: 'signal-safety',
    title: '데모 3. 책임 있는 신호 안내',
    description: '울산 신호 데이터를 참고용 문구와 함께 열어 한계를 숨기지 않는 설계를 보여줍니다.',
    actionLabel: '신호 안전 데모 시작',
    presetId: 'ulsan-live',
    largeText: false,
    simpleMode: false,
  },
];

const PLAN_CHECKPOINTS = [
  '위치 기반 조회와 수동 위치 선택',
  '신호·버스·이동지원 통합 카드',
  '큰 글씨·단순 화면 접근성 모드',
  '실데이터 데모 프리셋과 출처 표기',
] as const;

const COMPARE_TARGETS: CompareTarget[] = [
  {
    id: 'bus-stop',
    label: '가까운 버스 정류장 방향 비교',
    description: '버스에 맞춰 움직일지, 이동지원으로 우회할지 비교합니다.',
    offset: { lat: 0.0012, lng: -0.0008 },
  },
  {
    id: 'support-center',
    label: '이동지원 센터 연결 지점 비교',
    description: '이동지원 접근성이 있는 방향에서 더 편한 선택지를 찾습니다.',
    offset: { lat: -0.001, lng: 0.0009 },
  },
  {
    id: 'safe-crossing',
    label: '안전한 횡단 우선 비교',
    description: '신호와 걷는 부담을 함께 보수적으로 따져봅니다.',
    offset: { lat: 0.0006, lng: 0.0012 },
  },
];

function getSourceLabel(source: DataOrigin) {
  if (source === 'live') {
    return 'LIVE';
  }

  if (source === 'mock') {
    return 'MOCK';
  }

  return 'OFF';
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
  const selectedSummaryText = selectedPreset
    ? `${selectedPreset.label}에서는 ${visibleCards.join(', ')} 카드만 발표 흐름에 맞게 강조합니다.`
    : '현재 위치 기준으로 3개 데이터 축을 함께 조회합니다.';

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
              <span className="service-badge">참고용 이동 보조 서비스</span>
              <span className="status-chip">{isFetching ? '데이터 갱신 중' : '실시간 데모 준비 완료'}</span>
            </div>
            <div className="masthead-copy">
              <div>
                <p className="eyebrow">SafeCross Mobility</p>
                <h1>교통약자와 보호자가 이동 전후에 덜 불안한 선택을 하도록 돕는 웹앱</h1>
                <p className="hero-lead">
                  계획서의 핵심인 신호 참고 정보, 버스 여유 상태, 이동지원 대체 수단을 한 화면에
                  묶어 지금 가장 필요한 판단만 먼저 보여줍니다.
                </p>
              </div>
            </div>
            <div className="hero-action-row">
              <button className="primary-button hero-button" onClick={() => activateScenario(primaryScenario)} type="button">
                {primaryScenario.actionLabel}
              </button>
              <button
                className="secondary-button hero-button"
                onClick={() => {
                  setSelectedPresetId(null);
                  requestCurrentLocation();
                }}
                type="button"
              >
                현재 위치로 바로 시작
              </button>
            </div>
            <div className="hero-proof-grid">
              <article className="proof-card">
                <span>실데이터 데모</span>
                <strong>울산 + 서울</strong>
                <p>울산은 신호·버스, 서울은 이동지원을 실연동으로 시연합니다.</p>
              </article>
              <article className="proof-card">
                <span>접근성 모드</span>
                <strong>큰 글씨 + 단순 화면</strong>
                <p>보호자와 고령 사용자 시나리오를 버튼 한 번으로 전환합니다.</p>
              </article>
              <article className="proof-card">
                <span>심사 준비도</span>
                <strong>{DEMO_SCENARIOS.length}개 데모 흐름</strong>
                <p>발표에서 바로 누를 수 있는 시나리오 시작 버튼을 준비했습니다.</p>
              </article>
            </div>
          </div>

          <div className="hero-side-panel">
            <div className="safety-panel">
              <strong>현장 신호를 반드시 우선 확인하세요.</strong>
              <p>신호 및 도착 정보는 참고용이며 실제 현장 상황과 차이가 있을 수 있습니다.</p>
            </div>
            <div className="principle-card">
              <p className="eyebrow">제품 원칙</p>
              <ul className="principle-list">
                <li>건너라고 지시하지 않고 참고용 정보만 제공합니다.</li>
                <li>데이터 출처를 LIVE, MOCK, OFF로 명확히 구분합니다.</li>
                <li>정보가 부족하면 단정하지 않고 확인 필요로 표시합니다.</li>
              </ul>
            </div>
            <div className="checkpoint-card">
              <div className="card-heading">
                <p className="eyebrow">계획서 핵심 구현</p>
                <span className="service-badge">진행 중</span>
              </div>
              <div className="checkpoint-list">
                {PLAN_CHECKPOINTS.map((checkpoint) => (
                  <div className="checkpoint-item" key={checkpoint}>
                    <strong>{checkpoint}</strong>
                    <span>완료</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="focus-strip">
          <article className="focus-card">
            <p className="eyebrow">핵심 1</p>
            <h2>지금 주변에서 참고할 수 있는 신호 정보</h2>
            <p>보행신호 상태와 잔여시간을 안전 문구와 함께 짧게 보여줍니다.</p>
          </article>
          <article className="focus-card">
            <p className="eyebrow">핵심 2</p>
            <h2>이번 버스를 탈 수 있을지 판단하는 여유 상태</h2>
            <p>복잡한 ETA 대신 교통약자 기준으로 여유 있음, 주의 필요, 촉박으로 정리합니다.</p>
          </article>
          <article className="focus-card">
            <p className="eyebrow">핵심 3</p>
            <h2>불편할 때 바로 볼 수 있는 대체 이동지원 수단</h2>
            <p>이용 가능한 차량 수와 센터 정보를 통해 버스 외 대안을 함께 제시합니다.</p>
          </article>
        </section>

        <section className="control-strip">
          <div className="location-card">
            <div>
              <p className="eyebrow">현재 위치</p>
              <h2>{selectedPreset ? `${selectedPreset.label} 기준 위치` : locationLabel}</h2>
              <p>{formatCoordinates(activeCoordinates.lat, activeCoordinates.lng)}</p>
              <small>
                {!selectedPreset
                  ? status === 'loading'
                    ? '위치를 확인하는 중입니다.'
                    : '위치 권한이 없으면 지도로 직접 선택할 수 있습니다.'
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
                {selectionMode ? '선택 모드 종료' : '지도에서 위치 선택'}
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
                <p>{selectedPreset.description} 데이터만 점수와 카드에 반영합니다.</p>
              </div>
            ) : null}
            <small>
              2026-04-07 검증 기준으로 신호, 버스, 이동지원 3종이 같은 지자체 코드에서 동시에 live인 지역은
              아직 확인되지 않아 울산과 서울 프리셋을 나눠 시연합니다.
            </small>
          </div>

          <div className="mode-strip">
            <ModeToggle
              active={largeText}
              description="글자를 키우고 주요 여백을 넓힙니다."
              iconLabel="TXT"
              label="큰 글씨 모드"
              onClick={toggleLargeText}
            />
            <ModeToggle
              active={simpleMode}
              description="핵심 정보 3줄만 우선 보여줍니다."
              iconLabel="SIM"
              label="단순 화면 모드"
              onClick={toggleSimpleMode}
            />
          </div>
        </section>

        <section className="scenario-section">
          <div className="scenario-header">
            <div>
              <p className="eyebrow">심사 데모 시작</p>
              <h2>계획서 기준 3개 시나리오를 바로 재현할 수 있게 다듬었습니다</h2>
            </div>
            <small>{selectedSummaryText}</small>
          </div>
          <div className="scenario-grid">
            {DEMO_SCENARIOS.map((scenario, index) => (
              <article className="scenario-card" key={scenario.id}>
                <div className="scenario-step">Scenario {index + 1}</div>
                <strong>{scenario.title}</strong>
                <p>{scenario.description}</p>
                <div className="scenario-meta">
                  <span>{scenario.presetId === 'ulsan-live' ? '울산 실데이터' : '서울 이동지원'}</span>
                  <span>{scenario.largeText ? '큰 글씨' : '표준 화면'}</span>
                  <span>{scenario.simpleMode ? '단순 화면' : '상세 화면'}</span>
                </div>
                <button className="primary-button" onClick={() => activateScenario(scenario)} type="button">
                  {scenario.actionLabel}
                </button>
              </article>
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

                <section className="data-context-card">
                  <p className="eyebrow">{selectedPreset ? '실데이터 데모 범위' : '데이터 범위'}</p>
                  <div className="context-tags">
                    <span>신호 {summary.dataContext.signalStdgCd}</span>
                    <span>버스 {summary.dataContext.busStdgCd}</span>
                    <span>이동지원 {summary.dataContext.mobilityStdgCd}</span>
                  </div>
                  <div className="context-tags">
                    <span>신호 {getSourceLabel(summary.dataContext.serviceSources.signals)}</span>
                    <span>버스 {getSourceLabel(summary.dataContext.serviceSources.buses)}</span>
                    <span>이동지원 {getSourceLabel(summary.dataContext.serviceSources.mobility)}</span>
                  </div>
                  <div className="context-summary-grid">
                    <article>
                      <strong>부담도 신뢰도</strong>
                      <p>{summary.movementBurden.confidenceLabel}</p>
                    </article>
                    <article>
                      <strong>데이터 신선도</strong>
                      <p>
                        {summary.movementBurden.freshnessMinutes == null
                          ? '확인 어려움'
                          : `${summary.movementBurden.freshnessMinutes}분 전 기준`}
                      </p>
                    </article>
                    <article>
                      <strong>핵심 카드 수</strong>
                      <p>{visibleCards.length}개</p>
                    </article>
                  </div>
                  <p>
                    {selectedPreset
                      ? `${selectedPreset.label}에서는 ${summary.dataContext.enabledServices.join(', ')} 데이터만 점수와 카드에 반영합니다.`
                      : '울산 3100000000은 신호등·버스 live, 서울 1100000000은 이동지원 live가 확인됐습니다.'}
                  </p>
                </section>

                <section className="route-compare-section">
                  <div className="route-compare-controls">
                    <div>
                      <p className="eyebrow">발표용 의사결정 비교</p>
                      <h2>같은 목적지에서 어떤 선택이 덜 부담스러운지 바로 설명할 수 있습니다</h2>
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
                    <div className="inline-notice">경로 비교안을 계산하는 중입니다.</div>
                  ) : null}
                  {isCompareError ? (
                    <div className="inline-notice">경로 비교안을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</div>
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
                      body="보행 신호는 참고용으로만 제공하며, 현장 신호를 우선 확인해야 합니다."
                      eyebrow="신호 참고 정보"
                      highlight={
                        summary.topSignal?.remainingSeconds != null
                          ? `${summary.topSignal.remainingSeconds}초 남음`
                          : '잔여시간 정보 없음'
                      }
                      meta={summary.topSignal?.direction ?? '방향 정보 없음'}
                      iconLabel="SIG"
                      sourceLabel={getSourceLabel(summary.dataContext.serviceSources.signals)}
                      title={summary.topSignal?.intersectionName ?? '주변 교차로 정보 없음'}
                      tone={summary.topSignal?.pedestrianSignalStatus === 'GREEN' ? 'safe' : 'warn'}
                      updatedAt={summary.topSignal?.collectedAt ?? summary.lastUpdatedAt}
                    />
                  ) : null}
                  {visibleCards.includes('buses') ? (
                    <InfoCard
                      body="정확한 ETA 대신 교통약자 기준으로 여유 여부를 분류형으로 보여줍니다."
                      eyebrow="버스 참고 정보"
                      highlight={summary.topBus?.etaCategory ?? '정보 부족'}
                      meta={summary.topBus ? `${summary.topBus.routeNo}번 · ${summary.topBus.nearStopName}` : '버스 정보 없음'}
                      iconLabel="BUS"
                      sourceLabel={getSourceLabel(summary.dataContext.serviceSources.buses)}
                      title={summary.topBus ? `${summary.topBus.routeType} ${summary.topBus.routeNo}번` : '주변 버스 정보 없음'}
                      updatedAt={summary.topBus?.lastUpdatedAt ?? summary.lastUpdatedAt}
                    />
                  ) : null}
                  {visibleCards.includes('mobility') ? (
                    <InfoCard
                      body="데이터가 부족하면 단정하지 않고 확인 필요 상태로 보여줍니다."
                      eyebrow="이동지원 정보"
                      highlight={summary.topMobility?.serviceStatus ?? '정보 없음'}
                      meta={
                        summary.topMobility
                          ? `가용 차량 ${summary.topMobility.availableVehicleCount ?? 0}대`
                          : '조회 가능한 이동지원 센터 없음'
                      }
                      iconLabel="AID"
                      sourceLabel={getSourceLabel(summary.dataContext.serviceSources.mobility)}
                      title={summary.topMobility?.centerName ?? '주변 이동지원 센터 정보 없음'}
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
