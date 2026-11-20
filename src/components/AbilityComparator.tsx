import { useQuery } from '@apollo/client/react';
import { GET_PLAYER_DETAILS } from '@/lib/queries';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Zap } from 'lucide-react';
import { useSpellTooltip } from '@/hooks/useSpellTooltip';
import { SpellIcon } from '@/components/SpellIcon';
import { SpellTooltip } from '@/components/SpellTooltip';
import { useState, useEffect } from 'react';
import { PlayerName } from '@/components/PlayerName';

interface AbilityComparatorProps {
  playerA: { id: number; name: string; spec: string; className?: string };
  reportA: { code: string; fightId: number };
  playerB: { id: number; name: string; spec: string; className?: string };
  reportB: { code: string; fightId: number };
  dataType: 'DamageDone' | 'Healing';
}

interface AbilityData {
  name: string;
  total: number;
  uses: number;
  icon: string;
  guid?: number;
}

interface PlayerDetailsResponse {
  reportData: {
    report: {
      table: {
        data: {
          entries: AbilityData[];
        };
      };
    };
  };
}

const fetchIconName = async (spellId: number): Promise<string> => {
  try {
    const response = await fetch(`https://nether.wowhead.com/tooltip/spell/${spellId}?dataEnv=1&locale=8`);
    const data = await response.json();
    return data.icon || 'inv_misc_questionmark';
  } catch (error) {
    return 'inv_misc_questionmark';
  }
};

export function AbilityComparator({ playerA, reportA, playerB, reportB, dataType }: AbilityComparatorProps) {
  const { tooltip, showTooltip, hideTooltip } = useSpellTooltip();
  const [iconCache, setIconCache] = useState<Map<number, string>>(new Map());
  
  const { data: dataA, loading: loadA } = useQuery<PlayerDetailsResponse>(GET_PLAYER_DETAILS, {
    variables: { code: reportA.code, fightId: reportA.fightId, playerId: playerA.id, dataType }
  });

  const { data: dataB, loading: loadB } = useQuery<PlayerDetailsResponse>(GET_PLAYER_DETAILS, {
    variables: { code: reportB.code, fightId: reportB.fightId, playerId: playerB.id, dataType }
  });

  const entriesA: AbilityData[] = dataA?.reportData?.report?.table?.data?.entries || [];
  const entriesB: AbilityData[] = dataB?.reportData?.report?.table?.data?.entries || [];

  useEffect(() => {
    const loadIcons = async () => {
      const allEntries = [...entriesA, ...entriesB];
      const uniqueSpells = new Map<number, boolean>();
      
      for (const entry of allEntries) {
        if (entry.guid && !iconCache.has(entry.guid) && !uniqueSpells.has(entry.guid)) {
          uniqueSpells.set(entry.guid, true);
        }
      }

      for (const [spellId] of uniqueSpells) {
        const iconName = await fetchIconName(spellId);
        setIconCache(prev => new Map(prev).set(spellId, iconName));
      }
    };

    if (entriesA.length > 0 || entriesB.length > 0) {
      loadIcons();
    }
  }, [dataA, dataB]);

  if (loadA || loadB) return <div className="p-8 text-center text-muted-foreground animate-pulse">Carregando detalhes das habilidades...</div>;

  const allAbilities = Array.from(new Set([
    ...entriesA.map(e => e.name),
    ...entriesB.map(e => e.name)
  ])).sort();

  const mapA = new Map(entriesA.map(e => [e.name, e]));
  const mapB = new Map(entriesB.map(e => [e.name, e]));

  const comparisonList = allAbilities.map(name => {
    const skillA = mapA.get(name);
    const skillB = mapB.get(name);
    
    const maxVal = Math.max(skillA?.total || 0, skillB?.total || 0);

    return {
      name,
      skillA,
      skillB,
      maxVal
    };
  }).sort((a, b) => b.maxVal - a.maxVal);

  return (
    <Card className="mt-8 border-t-4 border-t-purple-500 shadow-xl bg-zinc-950 border-zinc-800">
      <CardHeader className="border-b border-zinc-800 pb-4">
        <CardTitle className="flex items-center gap-3 text-xl text-zinc-100">
          <Zap className="text-purple-400" />
          Comparativo de Habilidades: <span className="text-purple-300">{playerA.spec}</span>
        </CardTitle>
        <div className="flex justify-between text-sm mt-2 text-zinc-400">
          <span className="text-blue-400 font-bold">A: <PlayerName name={playerA.name} className={playerA.className} /></span>
          <span className="text-orange-400 font-bold">B: <PlayerName name={playerB.name} className={playerB.className} /></span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader className="bg-zinc-900">
            <TableRow className="border-zinc-800 hover:bg-zinc-900">
              <TableHead className="text-zinc-300 w-[50px]"></TableHead>
              <TableHead className="text-zinc-300 w-[200px]">Habilidade</TableHead>
              <TableHead className="text-right text-blue-500 font-bold bg-blue-950/20 border-l border-zinc-800">Casts (A)</TableHead>
              <TableHead className="text-right text-blue-500 font-bold bg-blue-950/20">Total (A)</TableHead>
              <TableHead className="text-right text-orange-500 font-bold bg-orange-950/20 border-l border-zinc-800">Casts (B)</TableHead>
              <TableHead className="text-right text-orange-500 font-bold bg-orange-950/20">Total (B)</TableHead>
              <TableHead className="text-right text-zinc-400 border-l border-zinc-800">Dif. Casts</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {comparisonList.map((row) => {
               const castsA = row.skillA?.uses || 0;
               const castsB = row.skillB?.uses || 0;
               const diffCasts = castsB - castsA;

               const spellId = row.skillA?.guid || row.skillB?.guid || 0;
               const icon = spellId > 0 && iconCache.has(spellId) 
                 ? iconCache.get(spellId)! 
                 : 'inv_misc_questionmark';
               
               return (
                <TableRow key={row.name} className="border-zinc-800 hover:bg-zinc-900/50">
                  <TableCell className="py-2">
                    {spellId > 0 && (
                      <SpellIcon 
                        spellId={spellId} 
                        icon={icon} 
                        size="sm"
                        onMouseEnter={showTooltip}
                        onMouseLeave={hideTooltip}
                      />
                    )}
                  </TableCell>
                  <TableCell className="font-medium text-zinc-200">{row.name}</TableCell>
                  <TableCell className="text-right font-mono text-blue-300 bg-blue-950/10 border-l border-zinc-800">
                    {castsA || '-'}
                  </TableCell>
                  <TableCell className="text-right font-mono text-blue-300 bg-blue-950/10">
                    {row.skillA?.total ? (row.skillA.total / 1000000).toFixed(2) + 'M' : '-'}
                  </TableCell>
                  <TableCell className="text-right font-mono text-orange-300 bg-orange-950/10 border-l border-zinc-800">
                    {castsB || '-'}
                  </TableCell>
                  <TableCell className="text-right font-mono text-orange-300 bg-orange-950/10">
                    {row.skillB?.total ? (row.skillB.total / 1000000).toFixed(2) + 'M' : '-'}
                  </TableCell>
                  <TableCell className={`text-right font-bold border-l border-zinc-800 ${diffCasts > 0 ? 'text-green-500' : diffCasts < 0 ? 'text-red-500' : 'text-zinc-600'}`}>
                    {diffCasts !== 0 ? (diffCasts > 0 ? `+${diffCasts}` : diffCasts) : '-'}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
      {tooltip && <SpellTooltip {...tooltip} />}
    </Card>
  );
}