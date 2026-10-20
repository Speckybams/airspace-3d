import { getIcaoClassDefinition, normalizeIcaoClass } from "@/lib/icaoClasses";

interface Props {
  icaoClass: string;
  onClick?: () => void;
}

export function IcaoClassChip({ icaoClass, onClick }: Props) {
  const id = normalizeIcaoClass(icaoClass);
  const def = getIcaoClassDefinition(id);
  const label = `Class ${id}`;

  if (onClick) {
    return (
      <button
        type="button"
        className="icao-class-chip linkish"
        style={{ color: def.color, background: def.background, borderColor: def.color }}
        onClick={onClick}
        aria-label={`${label}. Open airspace type legend`}
      >
        {label}
      </button>
    );
  }

  return (
    <span
      className="icao-class-chip"
      style={{ color: def.color, background: def.background, borderColor: def.color }}
    >
      {label}
    </span>
  );
}
