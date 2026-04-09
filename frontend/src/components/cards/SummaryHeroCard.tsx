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
          <span className={`hero-emblem ${burdenTone}`}>SAFE</span>
          <p className="eyebrow">현재 이동 부담도</p>
          <h1>{summary.movementBurden.label}</h1>
          <p className="hero-reason">{summary.movementBurden.reason}</p>
        </div>
        <div className="hero-guidance">
          <div className="hero-guidance-item">
            <span>추천 행동</span>
            <strong>
              {summary.movementBurden.label === '높음'
                ? '이동지원과 다음 선택지를 우선 확인'
                : summary.movementBurden.label === '보통'
                  ? '신호와 버스 여유를 함께 비교'
                  : '현재 정보 기준으로 부담이 비교적 낮음'}
            </strong>
          </div>
          <div className="hero-guidance-item">
            <span>안전 원칙</span>
            <strong>현장 신호와 실제 상황을 항상 우선 확인</strong>
          </div>
        </div>
        <div className="hero-factor-list">
          {summary.movementBurden.factors.map((factor) => (
            <p key={factor}>{factor}</p>
          ))}
        </div>
        <div className="hero-sources">
          {sourceEntries.map(([label, source]) => (
            <span key={label} className={`source-badge ${source}`}>
              {label} {source === 'live' ? 'LIVE' : 'MOCK'}
            </span>
          ))}
        </div>
      </div>
      <div className="score-badge">
        <span>추천 지표</span>
        <strong>{summary.movementBurden.score}점</strong>
        <em>신뢰도 {summary.movementBurden.confidenceLabel}</em>
        <small>신호 참고 시간, 버스 여유, 이동지원 가능성을 함께 반영</small>
      </div>
    </section>
  );
}
