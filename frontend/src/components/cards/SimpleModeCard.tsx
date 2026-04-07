import type { SummaryPayload } from '../../types/api';

type SimpleModeCardProps = {
  summary: SummaryPayload;
  visibleCards: Array<'signals' | 'buses' | 'mobility'>;
};

export function SimpleModeCard({ summary, visibleCards }: SimpleModeCardProps) {
  return (
    <section className="simple-mode-card">
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
    </section>
  );
}
