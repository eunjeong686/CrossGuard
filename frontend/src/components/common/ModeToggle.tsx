type ModeToggleProps = {
  label: string;
  description: string;
  active: boolean;
  onClick: () => void;
};

export function ModeToggle({ label, description, active, onClick }: ModeToggleProps) {
  return (
    <button className={`mode-toggle${active ? ' active' : ''}`} onClick={onClick} type="button">
      <span>{label}</span>
      <small>{description}</small>
    </button>
  );
}
