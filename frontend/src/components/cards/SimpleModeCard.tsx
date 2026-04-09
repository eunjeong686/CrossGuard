import type { SummaryPayload } from '../../types/api';

type SimpleModeCardProps = {
  summary: SummaryPayload;
  visibleCards: Array<'signals' | 'buses' | 'mobility'>;
};

export function SimpleModeCard({ summary, visibleCards }: SimpleModeCardProps) {
  return (
    <section className="simple-mode-card">
      <div className="simple-mode-header">
        <strong>핵심 정보만 먼저 보기</strong>
        <span>신뢰도 {summary.movementBurden.confidenceLabel}</span>
      </div>
      {visibleCards.includes('signals') ? (
        <p>
          <span>참고용 보행신호</span>
          <strong>{summary.topSignal?.pedestrianSignalStatusLabel ?? '정보 없음'}</strong>
        </p>
      ) : null}
      {visibleCards.includes('buses') ? (
        <p>
          <span>버스 여유</span>
          <strong>{summary.topBus?.etaCategory ?? '정보 부족'}</strong>
        </p>
      ) : null}
      {visibleCards.includes('mobility') ? (
        <p>
          <span>대체 수단</span>
          <strong>{summary.topMobility?.serviceStatus ?? '정보 없음'}</strong>
        </p>
      ) : null}
      <small className="simple-mode-footnote">
        {summary.movementBurden.freshnessMinutes == null
          ? '데이터 갱신 시각은 일부만 확인됩니다.'
          : `최근 갱신 기준 ${summary.movementBurden.freshnessMinutes}분 전 데이터가 포함됩니다.`}
      </small>
    </section>
  );
}
