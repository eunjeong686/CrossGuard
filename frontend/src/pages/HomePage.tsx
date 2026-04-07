import { useState } from 'react';
import { InfoCard } from '../components/cards/InfoCard';
import { SimpleModeCard } from '../components/cards/SimpleModeCard';
import { SummaryHeroCard } from '../components/cards/SummaryHeroCard';
import { ModeToggle } from '../components/common/ModeToggle';
import { AppShell } from '../components/layout/AppShell';
import { SummaryMap } from '../components/map/SummaryMap';
import { useLocation } from '../hooks/useLocation';
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
        <section className="masthead">
          <div className="badge-row">
            <span className="service-badge">참고용 이동 보조 서비스</span>
            <span className="status-chip">{isFetching ? '데이터 갱신 중' : '짧은 캐시 활성화'}</span>
          </div>
          <div className="masthead-copy">
            <div>
              <p className="eyebrow">SafeCross Mobility</p>
              <h1>교통약자와 보호자를 위한 보조형 이동 지원 웹앱</h1>
              <p>
                신호 참고 정보, 버스 여유 상태, 이동지원 수단 가능성을 한 화면에 묶어
                이동 전후 의사결정 부담을 줄이는 MVP입니다.
              </p>
            </div>
            <div className="safety-panel">
              <strong>현장 신호를 반드시 우선 확인하세요.</strong>
              <p>신호 및 도착 정보는 참고용이며 실제 현장 상황과 차이가 있을 수 있습니다.</p>
            </div>
          </div>
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
              label="큰 글씨 모드"
              onClick={toggleLargeText}
            />
            <ModeToggle
              active={simpleMode}
              description="핵심 정보 3줄만 우선 보여줍니다."
              label="단순 화면 모드"
              onClick={toggleSimpleMode}
            />
          </div>
        </section>

        <section className="scenario-section">
          <div className="scenario-header">
            <div>
              <p className="eyebrow">심사 데모 시작</p>
              <h2>계획서 기준 3개 시나리오를 바로 재현할 수 있게 준비했습니다</h2>
            </div>
            <small>발표 흐름에 맞춰 프리셋 위치와 접근성 모드를 함께 전환합니다.</small>
          </div>
          <div className="scenario-grid">
            {DEMO_SCENARIOS.map((scenario) => (
              <article className="scenario-card" key={scenario.id}>
                <strong>{scenario.title}</strong>
                <p>{scenario.description}</p>
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
                  <p>
                    {selectedPreset
                      ? `${selectedPreset.label}에서는 ${summary.dataContext.enabledServices.join(', ')} 데이터만 점수와 카드에 반영합니다.`
                      : '울산 3100000000은 신호등·버스 live, 서울 1100000000은 이동지원 live가 확인됐습니다.'}
                  </p>
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
