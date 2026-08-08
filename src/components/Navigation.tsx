interface Props {
  onBack: () => void;
  onContinue: () => void;
  canContinue: boolean;
  continueLabel?: string;
}

export function Navigation({ onBack, onContinue, canContinue, continueLabel = "Продолжить" }: Props) {
  return (
    <nav className="navigation" aria-label="Навигация по игре">
      <button type="button" className="secondary" onClick={onBack}>Назад</button>
      <button type="button" onClick={onContinue} disabled={!canContinue}>{continueLabel}</button>
    </nav>
  );
}
