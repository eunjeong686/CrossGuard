import type { RouteComparePayload } from '../../types/api';

type RouteCompareCardProps = {
  compare: RouteComparePayload;
  targetLabel: string;
  targetDescription: string;
};

export function RouteCompareCard({
  compare,
  targetLabel,
  targetDescription,
}: RouteCompareCardProps) {
  return (
    <section className="route-compare-card">
      <div className="route-compare-header">
        <div>
          <p className="eyebrow">조금 더 편한 쪽</p>
          <h2>{targetLabel}</h2>
          <p>{targetDescription}</p>
        </div>
        <div className="route-distance-badge">
          <span>목적지까지</span>
          <strong>약 {compare.destinationDistanceMeters}m</strong>
        </div>
      </div>
      <div className="route-options-grid">
        {compare.options.map((option) => (
          <article
            className={`route-option-card${option.recommended ? ' recommended' : ''}`}
            key={option.id}
          >
            <div className="route-option-top">
              <div className="route-option-title">
                <span className="card-icon route">{option.id === 'bus-priority' ? '버스' : '신호'}</span>
                <strong>{option.label}</strong>
              </div>
              <span className={`source-badge ${option.recommended ? 'live' : 'mock'}`}>
                {option.recommended ? '조금 더 편해요' : '다른 선택'}
              </span>
            </div>
            <div className="route-option-stats">
              <p>
                <span>느낌</span>
                <strong>{option.burden}</strong>
              </p>
              <p>
                <span>점수</span>
                <strong>{option.score}점</strong>
              </p>
              <p>
                <span>안내 믿음</span>
                <strong>{option.confidenceLabel}</strong>
              </p>
            </div>
            <p>{option.note}</p>
            <div className="route-tags">
              {option.includedServices.map((service) => (
                <span key={service}>
                  {service === 'signals' ? '신호' : service === 'buses' ? '버스' : '보조'}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
