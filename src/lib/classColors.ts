// Cores oficiais das classes do WoW (RAID_CLASS_COLORS).
// Fonte: https://warcraft.wiki.gg/wiki/Class_colors
// As chaves seguem o formato do Warcraft Logs (sem espaços): "DeathKnight", "DemonHunter"...
export const CLASS_COLORS: Record<string, string> = {
  DeathKnight: '#C41E3A',
  DemonHunter: '#A330C9',
  Druid: '#FF7C0A',
  Evoker: '#33937F',
  Hunter: '#AAD372',
  Mage: '#3FC7EB',
  Monk: '#00FF98',
  Paladin: '#F48CBA',
  Priest: '#FFFFFF',
  Rogue: '#FFF468',
  Shaman: '#0070DD',
  Warlock: '#8788EE',
  Warrior: '#C69B6D',
};

/** Cor da classe; aceita "DeathKnight", "Death Knight", "death-knight"... Sem classe conhecida, undefined. */
export function classColor(className?: string): string | undefined {
  if (!className) return undefined;
  const key = className.replace(/[\s_-]+/g, '').toLowerCase();
  const hit = Object.keys(CLASS_COLORS).find((k) => k.toLowerCase() === key);
  return hit ? CLASS_COLORS[hit] : undefined;
}

/** "DeathKnight" -> "Death Knight" para exibição. */
export const prettyClass = (className: string) => className.replace(/([a-z])([A-Z])/g, "$1 $2");
