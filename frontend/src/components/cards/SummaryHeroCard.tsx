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

  return (
    <section className="hero-card">
      <div>
        <p className="eyebrow">현재 이동 부담도</p>
        <h1>{summary.movementBurden.label}</h1>
        <p className="hero-reason">{summary.movementBurden.reason}</p>
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
      </div>
    </section>
  );
}
