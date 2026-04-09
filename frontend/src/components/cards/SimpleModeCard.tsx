import type { SummaryPayload } from '../../types/api';

type SimpleModeCardProps = {
  summary: SummaryPayload;
  visibleCards: Array<'signals' | 'buses' | 'mobility'>;
};

export function SimpleModeCard({ summary, visibleCards }: SimpleModeCardProps) {
  return (
    <section className="simple-mode-card">
      <div className="simple-mode-header">
        <strong>간단히 보기</strong>
        <span>안내 믿음 {summary.movementBurden.confidenceLabel}</span>
      </div>
      {visibleCards.includes('signals') ? (
        <p>
          <span>보행신호</span>
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
          ? '일부 정보는 갱신 시각을 바로 확인하기 어려워요.'
          : `가장 최근 기준으로 ${summary.movementBurden.freshnessMinutes}분 전 정보가 함께 보입니다.`}
      </small>
    </section>
  );
}
