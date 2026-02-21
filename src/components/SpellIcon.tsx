interface SpellIconProps {
  spellId: number;
  icon: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  grayscale?: boolean;
  onMouseEnter?: (spellId: number, event: React.MouseEvent) => void;
  onMouseLeave?: () => void;
}

export function SpellIcon({ 
  spellId, 
  icon, 
  size = 'md', 
  className = '', 
  grayscale = false,
  onMouseEnter,
  onMouseLeave
}: SpellIconProps) {
  const sizeClasses = {
    sm: 'w-5 h-5',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  const handleMouseEnter = (e: React.MouseEvent) => {
    if (onMouseEnter) {
      onMouseEnter(spellId, e);
    }
  };

  return (
    <div 
      className={`${sizeClasses[size]} bg-zinc-950 rounded border border-white/5 overflow-hidden shrink-0 cursor-pointer ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <img 
        src={`https://wow.zamimg.com/images/wow/icons/large/${icon}.jpg`} 
        alt="" 
        className={`w-full h-full object-cover ${grayscale ? 'grayscale opacity-50' : ''}`}
        onError={(e) => {
          // Fallback para rpglogs se Wowhead falhar
          const target = e.target as HTMLImageElement;
          if (target.src.includes('zamimg')) {
            target.src = `https://assets.rpglogs.com/img/warcraft/abilities/${icon}.jpg`;
          }
        }}
      />
    </div>
  );
}
