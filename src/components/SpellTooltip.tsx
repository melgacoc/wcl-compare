interface SpellTooltipProps {
  spellId: number;
  name: string;
  icon: string;
  html: string;
  x: number;
  y: number;
}

export function SpellTooltip({ name, icon, html, x, y }: SpellTooltipProps) {
  return (
    <div 
      className="fixed z-50 pointer-events-none" 
      style={{ left: `${x + 15}px`, top: `${y + 15}px`, maxWidth: '400px' }}
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 bg-zinc-950 border-b border-zinc-700 p-2">
          <img 
            src={`https://assets.rpglogs.com/img/warcraft/abilities/${icon}.jpg`} 
            alt="" 
            className="w-10 h-10 rounded border border-zinc-600" 
          />
          <span className="font-bold text-sm text-zinc-100">{name}</span>
        </div>
        <div 
          className="p-3 text-xs text-zinc-300 wowhead-tooltip" 
          dangerouslySetInnerHTML={{ __html: html }} 
        />
      </div>
    </div>
  );
}
