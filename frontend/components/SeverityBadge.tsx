const COLORS: Record<string, string> = {
  "baixo": "#34d399",
  "médio": "#fbbf24",
  "alto": "#fb923c",
  "crítico": "#f87171",
};

export function SeverityBadge({ severity }: { severity: string }) {
  const color = COLORS[severity] ?? "#8aa0b8";
  return (
    <span
      style={{ background: `${color}22`, color, border: `1px solid ${color}` }}
      className="px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide"
    >
      {severity}
    </span>
  );
}
