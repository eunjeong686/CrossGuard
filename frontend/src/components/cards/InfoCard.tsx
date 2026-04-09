import { formatRelativeTime } from '../../utils/format';

type InfoCardProps = {
  title: string;
  eyebrow: string;
  highlight: string;
  body: string;
  meta: string;
  updatedAt: string;
  tone?: 'default' | 'warn' | 'safe';
  sourceTone?: 'live' | 'mock' | 'off';
  sourceText?: string;
  iconLabel?: string;
};

export function InfoCard({
  title,
  eyebrow,
  highlight,
  body,
  meta,
  updatedAt,
  tone = 'default',
  sourceText,
  sourceTone,
  iconLabel,
}: InfoCardProps) {
  return (
    <article className={`info-card ${tone}`}>
      <div className="card-heading">
        <div className="card-heading-main">
          {iconLabel ? <span className={`card-icon ${tone}`}>{iconLabel}</span> : null}
          <p className="eyebrow">{eyebrow}</p>
        </div>
        {sourceText && sourceTone ? <span className={`source-badge ${sourceTone}`}>{sourceText}</span> : null}
      </div>
      <h2>{title}</h2>
      <strong>{highlight}</strong>
      <p>{body}</p>
      <div className="card-footer">
        <span>{meta}</span>
        <span>{formatRelativeTime(updatedAt)}</span>
      </div>
    </article>
  );
}
