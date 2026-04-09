import type { SummaryPayload } from '../../types/api';

type SummaryHeroCardProps = {
  summary: SummaryPayload;
};

export function SummaryHeroCard({ summary }: SummaryHeroCardProps) {
  const sourceEntries = [
    ['신호', summary.dataContext.serviceSources.signals],
    ['버스', summary.dataContext.serviceSources.buses],
    ['이동지원', summary.dataContext.serviceSources.mobility],
  ].filter(([, source]) => source !== 'disabled');
  const factorLines = summary.movementBurden.factors.slice(0, 2);
  const burdenTone =
    summary.movementBurden.label === '낮음'
      ? 'calm'
      : summary.movementBurden.label === '보통'
        ? 'steady'
        : 'care';

  return (
    <section className={`hero-card ${burdenTone}`}>
      <div className="hero-main">
        <div className="hero-title-block">
          <span className={`hero-emblem ${burdenTone}`}>지금</span>
          <p className="eyebrow">지금 이동 느낌</p>
          <h1>{summary.movementBurden.label}</h1>
          <p className="hero-reason">{summary.movementBurden.reason}</p>
        </div>
        <div className="hero-guidance">
          <div className="hero-guidance-item">
            <span>먼저 보기</span>
            <strong>
              {summary.movementBurden.label === '높음'
                ? '이동지원과 다음 이동 수단을 먼저 살펴보세요'
                : summary.movementBurden.label === '보통'
                  ? '신호와 버스 시간을 같이 보고 움직이세요'
                  : '현재 정보로는 비교적 여유가 있는 편입니다'}
            </strong>
          </div>
          <div className="hero-guidance-item">
            <span>꼭 기억할 점</span>
            <strong>앱보다 현장 신호와 주변 상황을 먼저 확인하세요</strong>
          </div>
        </div>
        <div className="hero-factor-list">
          {factorLines.map((factor) => (
            <p key={factor}>{factor}</p>
          ))}
        </div>
        <div className="hero-sources">
          {sourceEntries.map(([label, source]) => (
            <span key={label} className={`source-badge ${source}`}>
              {label} {source === 'live' ? '바로 확인' : '참고'}
            </span>
          ))}
        </div>
      </div>
      <div className="score-badge">
        <span>한눈에 보기</span>
        <strong>{summary.movementBurden.score}점</strong>
        <em>안내 믿음 {summary.movementBurden.confidenceLabel}</em>
        <small>지금 주변 정보를 함께 보고 정리했어요.</small>
      </div>
    </section>
  );
}
