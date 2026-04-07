import type { Coordinates, SummaryData } from '../types/internal.js';
import { getNearbyBuses } from './busService.js';
import { getNearbyMobilitySupport } from './mobilityService.js';
import { getNearbySignals } from './signalService.js';
import type { StdgOverride, SummaryScope } from '../utils/stdg.js';

const SERVICE_LABELS = {
  signals: '신호',
  buses: '버스',
  mobility: '이동지원',
} as const;

function getSignalScore(summary: SummaryData['topSignal']) {
  if (!summary) {
    return 45;
  }

  if (summary.pedestrianSignalStatus === 'GREEN') {
    return 88;
  }

  if (summary.pedestrianSignalStatus === 'RED') {
    return 62;
  }

  return 50;
}

function getBusScore(summary: SummaryData['topBus']) {
  if (!summary) {
    return 45;
  }

  if (summary.etaCategory === '여유 있음') {
    return 82;
  }

  if (summary.etaCategory === '주의 필요') {
    return 66;
  }

  if (summary.etaCategory === '촉박') {
    return 44;
  }

  return 50;
}

function getMobilityScore(summary: SummaryData['topMobility']) {
  if (!summary) {
    return 45;
  }

  if (summary.serviceStatus === '이용 가능') {
    return 86;
  }

  if (summary.serviceStatus === '확인 필요') {
    return 60;
  }

  return 48;
}

function getScopeLabel(enabledServices: SummaryScope['enabledServices']) {
  if (enabledServices.length === 0) {
    return '선택한 데이터';
  }

  return enabledServices.map((service) => SERVICE_LABELS[service]).join('·');
}

function getMovementBurden(score: number, enabledServices: SummaryScope['enabledServices']) {
  const scopeLabel = getScopeLabel(enabledServices);

  if (score >= 80) {
    return {
      label: '낮음' as const,
      reason: `${scopeLabel} 실데이터를 기준으로 현재 이동 부담이 비교적 낮게 보입니다.`,
    };
  }

  if (score >= 50) {
    return {
      label: '보통' as const,
      reason: `${scopeLabel} 실데이터 중 일부만 여유가 확인되어 현장 판단을 함께 권장합니다.`,
    };
  }

  return {
    label: '높음' as const,
    reason: `${scopeLabel} 실데이터만으로는 여유를 확인하기 어려워 보수적으로 판단했습니다.`,
  };
}

export async function getLocationSummary(
  origin: Coordinates,
  stdg: StdgOverride,
  scope: SummaryScope,
): Promise<SummaryData> {
  const [signals, buses, mobilityCenters] = await Promise.all([
    scope.includeSignals
      ? getNearbySignals(origin, { stdgCd: stdg.signalStdgCd })
      : Promise.resolve({ items: [], source: 'disabled' as const }),
    scope.includeBuses
      ? getNearbyBuses(origin, { stdgCd: stdg.busStdgCd })
      : Promise.resolve({ items: [], source: 'disabled' as const }),
    scope.includeMobility
      ? getNearbyMobilitySupport(origin, { stdgCd: stdg.mobilityStdgCd })
      : Promise.resolve({ items: [], source: 'disabled' as const }),
  ]);

  const topSignal = signals.items[0] ?? null;
  const topBus = buses.items[0] ?? null;
  const topMobility = mobilityCenters.items[0] ?? null;
  const scoreParts = [
    scope.includeSignals ? getSignalScore(topSignal) : null,
    scope.includeBuses ? getBusScore(topBus) : null,
    scope.includeMobility ? getMobilityScore(topMobility) : null,
  ].filter((value): value is number => value !== null);
  const score =
    scoreParts.length > 0
      ? Math.round(scoreParts.reduce((sum, value) => sum + value, 0) / scoreParts.length)
      : 50;
  const movementBurden = getMovementBurden(score, scope.enabledServices);

  return {
    location: origin,
    dataContext: {
      signalStdgCd: stdg.signalStdgCd,
      busStdgCd: stdg.busStdgCd,
      mobilityStdgCd: stdg.mobilityStdgCd,
      enabledServices: scope.enabledServices,
      serviceSources: {
        signals: signals.source,
        buses: buses.source,
        mobility: mobilityCenters.source,
      },
    },
    lastUpdatedAt: new Date().toISOString(),
    movementBurden: {
      score,
      ...movementBurden,
    },
    topSignal,
    topBus,
    topMobility,
    signals: signals.items,
    buses: buses.items,
    mobilityCenters: mobilityCenters.items,
    disclaimer: '신호와 도착 정보는 참고용입니다. 반드시 실제 현장 신호와 주변 상황을 우선 확인하세요.',
  };
}
