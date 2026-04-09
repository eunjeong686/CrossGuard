import { formatRelativeTime } from '../../utils/format';

type InfoCardProps = {
  title: string;
  eyebrow: string;
  highlight: string;
  body: string;
  meta: string;
  updatedAt: string;
  tone?: 'default' | 'warn' | 'safe';
  sourceLabel?: string;
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
  sourceLabel,
  iconLabel,
}: InfoCardProps) {
  return (
    <article className={`info-card ${tone}`}>
      <div className="card-heading">
        <div className="card-heading-main">
          {iconLabel ? <span className={`card-icon ${tone}`}>{iconLabel}</span> : null}
          <p className="eyebrow">{eyebrow}</p>
        </div>
        {sourceLabel ? <span className={`source-badge ${sourceLabel.toLowerCase()}`}>{sourceLabel}</span> : null}
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
