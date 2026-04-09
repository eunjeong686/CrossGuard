type ModeToggleProps = {
  label: string;
  description: string;
  active: boolean;
  onClick: () => void;
  iconLabel?: string;
};

export function ModeToggle({ label, description, active, onClick, iconLabel }: ModeToggleProps) {
  return (
    <button className={`mode-toggle${active ? ' active' : ''}`} onClick={onClick} type="button">
      <div className="toggle-topline">
        {iconLabel ? <span className="toggle-icon">{iconLabel}</span> : null}
        <span>{label}</span>
      </div>
      <small>{description}</small>
    </button>
  );
}
