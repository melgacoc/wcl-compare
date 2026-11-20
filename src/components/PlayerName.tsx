import { classColor } from '@/lib/classColors';

interface Props {
  name: string;
  /** Classe no formato do Warcraft Logs ("DeathKnight"). Sem ela, usa a cor herdada. */
  className?: string;
  /** Classes extras de estilo (tamanho, peso...). */
  extra?: string;
}

/** Nome de jogador na cor da sua classe. */
export function PlayerName({ name, className, extra = '' }: Props) {
  const color = classColor(className);
  return (
    <span className={extra} style={color ? { color } : undefined}>
      {name}
    </span>
  );
}

/**
 * Selo de classe/spec na cor da classe (texto, borda e fundo suaves).
 * Sem classe conhecida, cai no cinza padrão do portal.
 */
export function ClassTag({ label, className, extra = "" }: { label: string; className?: string; extra?: string }) {
  const color = classColor(className);
  return (
    <span
      className={`text-xs font-semibold px-2 py-0.5 rounded border ${color ? "" : "text-zinc-500 bg-zinc-900 border-zinc-800"} ${extra}`}
      style={color ? { color, borderColor: `${color}66`, backgroundColor: `${color}14` } : undefined}
    >
      {label}
    </span>
  );
}
