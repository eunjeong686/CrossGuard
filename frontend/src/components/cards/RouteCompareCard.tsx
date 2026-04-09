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
          <p className="eyebrow">어느 쪽이 덜 힘들까요</p>
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
                <span className="card-icon route">{option.id === 'bus-priority' ? '버스' : '지원'}</span>
                <strong>{option.label}</strong>
              </div>
              <span className={`source-badge ${option.recommended ? 'live' : 'mock'}`}>
                {option.recommended ? '조금 더 편함' : '다른 선택'}
              </span>
            </div>
            <div className="route-option-stats">
              <p>
                <span>움직이기</span>
                <strong>{option.burden}</strong>
              </p>
              <p>
                <span>종합 점수</span>
                <strong>{option.score}점</strong>
              </p>
              <p>
                <span>정보 믿음도</span>
                <strong>{option.confidenceLabel}</strong>
              </p>
            </div>
            <p>{option.note}</p>
            <div className="route-tags">
              {option.includedServices.map((service) => (
                <span key={service}>
                  {service === 'signals' ? '신호' : service === 'buses' ? '버스' : '이동지원'}
                </span>
              ))}
            </div>
            <div className="route-tags subdued">
              {option.sourceLabels.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
