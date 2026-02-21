import { useState } from 'react';

interface TooltipData {
  spellId: number;
  name: string;
  icon: string;
  html: string;
  x: number;
  y: number;
}

interface SpellData {
  name: string;
  icon: string;
  html: string;
}

export const useSpellTooltip = () => {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [cache, setCache] = useState<Map<number, SpellData>>(new Map());

  const fetchTooltip = async (spellId: number, x: number, y: number) => {
    if (cache.has(spellId)) {
      const cached = cache.get(spellId)!;
      setTooltip({
        spellId,
        name: cached.name,
        icon: cached.icon,
        html: cached.html,
        x,
        y
      });
      return;
    }

    try {
      const response = await fetch(`https://nether.wowhead.com/tooltip/spell/${spellId}?dataEnv=1&locale=8`);
      const data = await response.json();
      const tooltipData = {
        name: data.name || '',
        icon: data.icon || '',
        html: data.tooltip || ''
      };
      
      setCache(prev => new Map(prev).set(spellId, tooltipData));
      setTooltip({
        spellId,
        name: tooltipData.name,
        icon: tooltipData.icon,
        html: tooltipData.html,
        x,
        y
      });
    } catch (error) {
      console.error('Erro ao buscar tooltip:', error);
    }
  };

  const showTooltip = (spellId: number, event: React.MouseEvent) => {
    fetchTooltip(spellId, event.clientX, event.clientY);
  };

  const hideTooltip = () => {
    setTooltip(null);
  };

  return { tooltip, showTooltip, hideTooltip };
};
