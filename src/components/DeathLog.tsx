import { useState, useEffect } from 'react';
import { useLazyQuery } from '@apollo/client/react';
import { GET_DEATHS, GET_PLAYER_DEFENSIVE_CONTEXT, GET_DEATH_TIMELINE } from '@/lib/queries';
import {
  resolveDefensives, statusAt, consumablesAt, parseTalents, getSpecId,
  allConsumableSpellIds, DEFENSIVES_BUILD,
  type CastEvent, type HealEvent, type DefensiveAtDeath, type ConsumableAtDeath, type DefensiveStatus,
} from '@/lib/defensives';
import { LiveFightSelector } from './LiveFightSelector';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skull, Clock, ShieldAlert, Search, Activity } from 'lucide-react';
import { useSpellTooltip } from '@/hooks/useSpellTooltip';
import { SpellIcon } from './SpellIcon';
import { SpellTooltip } from './SpellTooltip';
import { NoteTimerChecker } from './NoteTimerChecker';

interface DeathEntry {
  name: string;
  id: number;
  type: string;
  icon: string;
  timestamp: number;
  spec?: string;
  deathRelativeTime?: number;
  deathEvents: any[];
}

interface DefensiveAnalysis {
  classDefensives: DefensiveAtDeath[];
  consumables: ConsumableAtDeath[];
  /** false quando o log não trouxe os talentos (CombatantInfo): defensivos de talento são presumidos. */
  talentsKnown: boolean;
}

const EMPTY_ANALYSIS: DefensiveAnalysis = { classDefensives: [], consumables: [], talentsKnown: true };

interface CombatantInfoEvent {
  specID?: number;
  talentTree?: { id: number; rank: number }[];
}

interface DefensiveContextData {
  reportData?: {
    report?: {
      casts?: { data?: CastEvent[] };
      combatantInfo?: { data?: CombatantInfoEvent[] };
      consumableHeals?: { data?: HealEvent[] };
    };
  };
}

const HEAL_FILTER = `ability.id IN (${allConsumableSpellIds().join(',')})`;

const formatSeconds = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}m${String(Math.round(s % 60)).padStart(2, '0')}s` : `${Math.ceil(s)}s`);

interface TimelineEvent {
  timestamp: number;
  type: 'damage' | 'healing';
  amount: number;
  abilityName: string;
  abilityIcon: string;
  abilityGameID: number;
  sourceName?: string;
  overkill?: number;
  mitigated?: number;
  absorbed?: number;
}

interface ReportData {
  report: {
    table?: {
      data?: {
        entries?: any[];
      };
    };
    fights?: { startTime: number }[];
    damageTaken?: { data?: any[] };
    healingReceived?: { data?: any[] };
  };
}

interface DeathsQueryData {
  reportData?: ReportData;
}

interface TimelineQueryData {
  reportData?: ReportData;
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

type TooltipHandlers = {
  onMouseEnter: NonNullable<React.ComponentProps<typeof SpellIcon>['onMouseEnter']>;
  onMouseLeave: () => void;
};

const statusBox = (status: DefensiveStatus) => ({
  AVAILABLE: 'bg-red-500/10 border-red-500/30 text-red-200',
  ON_COOLDOWN: 'bg-zinc-800/50 border-zinc-700/50 text-zinc-500',
  ACTIVE: 'bg-green-500/10 border-green-500/30 text-green-200',
}[status]);

function StatusLabel({ status, readyIn }: { status: DefensiveStatus; readyIn?: number }) {
  if (status === 'AVAILABLE') return <span className="text-red-400">DISPONÍVEL</span>;
  if (status === 'ACTIVE') return <span className="text-green-400">ATIVO</span>;
  return <span className="text-zinc-500">CD{readyIn !== undefined ? ` ${formatSeconds(readyIn)}` : ''}</span>;
}

const CATEGORY_LABEL = { personal: null, external: 'externo', raid: 'raid' } as const;

function DefensiveCard({ d, tooltip }: { d: DefensiveAtDeath; tooltip: TooltipHandlers }) {
  const details = [
    `CD ${formatSeconds(d.cooldown)}${d.charges > 1 ? ` · ${d.charges} cargas` : ''}`,
    ...d.appliedMods.map((m) => `${m.name}${m.rank > 1 ? ` (rank ${m.rank})` : ''}: ${[
      m.cooldownDelta ? `${m.cooldownDelta > 0 ? '+' : ''}${m.cooldownDelta}s CD` : '',
      m.chargesDelta ? `+${m.chargesDelta} carga` : '',
    ].filter(Boolean).join(', ')}`),
    d.source === 'assumed' ? 'Talentos ausentes no log: presumido que o jogador tinha.' : '',
    d.cooldownUncertain ? 'Usado mais vezes do que o CD permite: há redução de CD não modelada, o estado pode estar errado.' : '',
  ].filter(Boolean).join('\n');

  return (
    <div title={details} className={`flex items-center justify-between p-2.5 rounded border text-sm shadow-sm ${statusBox(d.status)}`}>
      <div className="flex items-center gap-2.5 min-w-0">
        <SpellIcon spellId={d.spell.id} icon={d.spell.icon} size="md" grayscale={d.status === 'ON_COOLDOWN'} onMouseEnter={tooltip.onMouseEnter} onMouseLeave={tooltip.onMouseLeave} />
        <div className="flex flex-col min-w-0">
          <span className="font-medium truncate">
            {d.spell.name}
            {d.source === 'assumed' && <span className="text-zinc-500" title="talento não confirmado">?</span>}
          </span>
          <span className="text-[10px] opacity-60 truncate">
            {d.replaces && <>substitui {d.replaces} · </>}
            {CATEGORY_LABEL[d.category] && <>{CATEGORY_LABEL[d.category]} · </>}
            {d.charges > 1 ? `${d.chargesLeft}/${d.charges} cargas` : `CD ${formatSeconds(d.cooldown)}`}
            {d.appliedMods.length > 0 && ' · talentos'}
            {d.cooldownUncertain && ' · CD incerto'}
          </span>
        </div>
      </div>
      <div className="font-bold text-xs pl-2 text-right shrink-0">
        <StatusLabel status={d.status} readyIn={d.readyIn} />
      </div>
    </div>
  );
}

function Stars({ quality, max }: { quality: number; max: number }) {
  return (
    <span className="text-amber-400 tracking-tighter" aria-label={`qualidade ${quality} de ${max}`}>
      {'★'.repeat(quality)}<span className="text-zinc-600">{'★'.repeat(Math.max(0, max - quality))}</span>
    </span>
  );
}

function ConsumableCard({ c, tooltip }: { c: ConsumableAtDeath; tooltip: TooltipHandlers }) {
  const last = c.uses[c.uses.length - 1];
  const qualityNote = !last ? '' : last.reduced
    ? 'Cura muito reduzida (debuff): não dá para saber a qualidade.'
    : last.approximate
      ? `Curou ${last.rawHeal.toLocaleString()} com bônus de cura: uma qualidade menor com bônus pode chegar a esse valor, então a estrela é estimada.`
      : last.quality ? `Curou ${last.rawHeal.toLocaleString()}.` : '';
  return (
    <div title={qualityNote} className={`flex items-center justify-between p-2.5 rounded border text-sm shadow-sm ${statusBox(c.status)}`}>
      <div className="flex items-center gap-2.5 min-w-0">
        <SpellIcon spellId={c.spell.id} icon={c.spell.icon} size="md" grayscale={c.status === 'ON_COOLDOWN'} onMouseEnter={tooltip.onMouseEnter} onMouseLeave={tooltip.onMouseLeave} />
        <div className="flex flex-col min-w-0">
          <span className="font-medium truncate">{c.spell.name}</span>
          <span className="text-[10px] opacity-70 truncate">
            {!last && 'não usado'}
            {last && <>usado {c.uses.length}x</>}
            {last?.quality && last.maxQuality && <> · <Stars quality={last.quality} max={last.maxQuality} />{last.approximate && ' (estimado)'}</>}
            {last?.reduced && ' · qualidade ?'}
          </span>
        </div>
      </div>
      <div className="font-bold text-xs pl-2 text-right shrink-0">
        <StatusLabel status={c.status} readyIn={c.readyIn} />
      </div>
    </div>
  );
}

export function DeathLog() {
  const [url, setUrl] = useState('');
  const [report, setReport] = useState({ code: '', fightId: 0 });
  const [deathLimit, setDeathLimit] = useState(5);
  const [isLive, setIsLive] = useState(false);
  
  const [analyzingId, setAnalyzingId] = useState<number | null>(null);
  const [resultOwnerId, setResultOwnerId] = useState<number | null>(null);
  
  const [defensiveResult, setDefensiveResult] = useState<DefensiveAnalysis>(EMPTY_ANALYSIS);
  const [timelineResult, setTimelineResult] = useState<TimelineEvent[]>([]);
  
  const [iconCache, setIconCache] = useState<Map<number, string>>(new Map());

  const { tooltip, showTooltip, hideTooltip } = useSpellTooltip();

  const [getDeaths, { data: deathData, loading: loadingDeaths }] = useLazyQuery<DeathsQueryData>(GET_DEATHS);
  const [getDefensiveContext] = useLazyQuery<DefensiveContextData>(GET_PLAYER_DEFENSIVE_CONTEXT);

  /** Casts, talentos e curas de consumível de um jogador na luta atual. */
  const loadPlayerContext = async (playerId: number) => {
    const { data } = await getDefensiveContext({
      variables: { code: report.code, fightId: report.fightId, playerId, healFilter: HEAL_FILTER },
    });
    const rep = data?.reportData?.report;
    const casts = (rep?.casts?.data ?? []).filter((c) => !c.type || c.type === 'cast');
    const combatant = rep?.combatantInfo?.data?.[0];
    return { casts, combatant, heals: rep?.consumableHeals?.data ?? [] };
  };
  const [getTimeline] = useLazyQuery<TimelineQueryData>(GET_DEATH_TIMELINE);

  useEffect(() => {
    const loadIcons = async () => {
      const uniqueSpells = new Map<number, boolean>();
      
      for (const event of timelineResult) {
        if (event.abilityGameID && !iconCache.has(event.abilityGameID) && !uniqueSpells.has(event.abilityGameID)) {
          uniqueSpells.set(event.abilityGameID, true);
        }
      }

      for (const [spellId] of uniqueSpells) {
        const iconName = await fetchIconName(spellId);
        setIconCache(prev => new Map(prev).set(spellId, iconName));
      }
    };

    if (timelineResult.length > 0) {
      loadIcons();
    }
  }, [timelineResult]);

  const parseUrl = (val: string) => {
    setUrl(val);
    let code = val;
    let fightId = 0;

    try {
      if (val.includes('warcraftlogs.com/reports/')) {
        const urlObj = new URL(val);
        const pathParts = urlObj.pathname.split('/');
        const reportIndex = pathParts.indexOf('reports');
        if (reportIndex !== -1 && pathParts[reportIndex + 1]) {
          code = pathParts[reportIndex + 1];
          const fightParam = urlObj.searchParams.get('fight');
          if (fightParam && !isNaN(Number(fightParam))) fightId = Number(fightParam);
        }
      }
      setReport({ code, fightId: isLive ? report.fightId : fightId });
    } catch (e) { console.error(e); }
  };

  const handleSearch = () => {
    if (!report.code || (!report.fightId && !isLive)) return alert("URL inválida ou luta não selecionada.");
    if (isLive && !report.fightId) return alert("Por favor, selecione uma luta na lista abaixo.");

    getDeaths({ variables: { code: report.code, fightId: report.fightId } });
    setDefensiveResult(EMPTY_ANALYSIS);
    setTimelineResult([]);
    setResultOwnerId(null);
  };

  const handleLiveFightSelect = (fightId: number) => {
    setReport(prev => ({ ...prev, fightId }));
    getDeaths({ variables: { code: report.code, fightId } });
    setDefensiveResult(EMPTY_ANALYSIS);
    setTimelineResult([]);
    setResultOwnerId(null);
  };

  const investigateDeath = async (player: DeathEntry) => {
    setAnalyzingId(player.id);
    setResultOwnerId(null);
    setDefensiveResult(EMPTY_ANALYSIS);
    setTimelineResult([]);

    const className = player.type;
    const { casts, combatant, heals } = await loadPlayerContext(player.id);
    // specID do CombatantInfo é o mais confiável; o ícone ("Mage-Arcane") é o fallback.
    const specId = combatant?.specID ?? getSpecId(className, player.spec);
    const talents = parseTalents(combatant);
    const deathTimestampAbs = player.timestamp;
    const castsBeforeDeath = casts.filter((c) => c.timestamp < deathTimestampAbs);

    const categoryOrder = { personal: 0, external: 1, raid: 2 } as const;
    const classDefensiveResults = resolveDefensives(className, specId, talents, castsBeforeDeath)
      .map((d) => statusAt(d, castsBeforeDeath, deathTimestampAbs))
      .sort((a, b) => categoryOrder[a.category] - categoryOrder[b.category]);

    const consumableResults = consumablesAt(castsBeforeDeath, heals, deathTimestampAbs);

    const fightStartTime = deathData?.reportData?.report?.fights?.[0]?.startTime || 0;
    const deathRelativeTime = player.timestamp - fightStartTime;
    const startTimeRelative = Math.max(0, deathRelativeTime - 7000);
    const endTimeRelative = deathRelativeTime + 200;
    const startTimeAbsolute = fightStartTime + startTimeRelative;
    const endTimeAbsolute = fightStartTime + endTimeRelative;

    const { data: timelineDataRaw } = await getTimeline({
      variables: { 
        code: report.code, 
        fightId: report.fightId, 
        playerId: player.id, 
        startTime: startTimeAbsolute, 
        endTime: endTimeAbsolute 
      }
    });
    
    const timelineData = (timelineDataRaw || {}) as { reportData?: any };
    const damageEvents = timelineData?.reportData?.report?.damageTaken?.data || [];
    const healingEvents = timelineData?.reportData?.report?.healingReceived?.data || [];
    const masterData = timelineData?.reportData?.report?.masterData || {};

    const abilityMap = new Map<number, { name: string, icon: string }>();
    const actorMap = new Map<number, string>();

    if (masterData.abilities) {
      masterData.abilities.forEach((ability: any) => {
        abilityMap.set(ability.gameID, {
          name: ability.name || `Spell ${ability.gameID}`,
          icon: ability.icon || 'inv_misc_questionmark'
        });
      });
    }

    if (masterData.actors) {
      masterData.actors.forEach((actor: any) => {
        actorMap.set(actor.id, actor.name || `Actor ${actor.id}`);
      });
    }

    const playerMap = new Map<number, string>();
    if (deathData?.reportData?.report?.table?.data?.entries) {
      deathData.reportData.report.table.data.entries.forEach((entry: any) => {
        playerMap.set(entry.id, entry.name);
      });
    }

    const formattedTimeline: TimelineEvent[] = [
      ...damageEvents
        .map((e: any) => {
          const ability = abilityMap.get(e.abilityGameID);
          return {
            timestamp: e.timestamp,
            type: 'damage' as const,
            amount: (e.amount || 0) + (e.absorbed || 0),
            abilityName: ability?.name || `Spell ${e.abilityGameID}`,
            abilityIcon: ability?.icon || 'inv_misc_questionmark',
            abilityGameID: e.abilityGameID,
            sourceName: actorMap.get(e.sourceID) || playerMap.get(e.sourceID) || `Enemy ${e.sourceID}`,
            overkill: e.overkill,
            mitigated: e.mitigated,
            absorbed: e.absorbed
          };
        })
        .filter((e: TimelineEvent) => e.amount > 0),
      ...healingEvents
        .map((e: any) => {
          const ability = abilityMap.get(e.abilityGameID);
          return {
            timestamp: e.timestamp,
            type: 'healing' as const,
            amount: e.amount || 0,
            abilityName: ability?.name || `Heal ${e.abilityGameID}`,
            abilityIcon: ability?.icon || 'spell_holy_flashheal',
            abilityGameID: e.abilityGameID,
            sourceName: actorMap.get(e.sourceID) || playerMap.get(e.sourceID) || `Healer ${e.sourceID}`,
            absorbed: e.absorbed
          };
        })
        .filter((e: TimelineEvent) => e.amount > 0)
    ];

    formattedTimeline.sort((a, b) => a.timestamp - b.timestamp);

    setDefensiveResult({
      classDefensives: classDefensiveResults,
      consumables: consumableResults,
      talentsKnown: !!talents,
    });
    setTimelineResult(formattedTimeline);
    setResultOwnerId(player.id);
    setAnalyzingId(null);
    };

  const processDeaths = (): DeathEntry[] => {
    if (!deathData?.reportData?.report?.table?.data?.entries) return [];
    const rawList = deathData.reportData.report.table.data.entries;
    const fightStartTime = deathData.reportData.report.fights?.[0]?.startTime || 0;

    const formatted = rawList.map((d: any) => {
        const iconParts = d.icon.split('-');
        const specFromIcon = iconParts.length > 1 ? iconParts[1] : '';
        
        return {
            name: d.name,
            id: d.id,
            type: d.type,
            icon: d.icon,
            timestamp: d.timestamp,
            spec: specFromIcon || d.type,
            deathRelativeTime: d.timestamp - fightStartTime,
            deathEvents: d.events
        };
    });

    return formatted.sort((a: DeathEntry, b: DeathEntry) => a.timestamp - b.timestamp);
  };
  
  const filteredDeaths = processDeaths().slice(0, deathLimit);

  const formatTime = (ms: number) => {
    if (ms < 0) return "00:00";
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-blue-500">
            <Activity /> WCL Compare
          </CardTitle>
          <label className="flex items-center gap-2 text-xs cursor-pointer select-none bg-zinc-950 px-3 py-1.5 rounded border border-zinc-800 hover:border-zinc-700 transition-colors">
            <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-500 animate-pulse' : 'bg-zinc-600'}`} />
            <input type="checkbox" className="hidden" checked={isLive} onChange={(e) => { setIsLive(e.target.checked); parseUrl(url); }} />
            <span className={isLive ? "text-zinc-200 font-bold" : "text-zinc-500"}>Modo Live Log</span>
          </label>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input className="bg-zinc-950 border-zinc-700 text-zinc-100 placeholder:text-zinc-600" placeholder={isLive ? "Cole o código do Report (ex: a1b2c3...)" : "Cole a URL do Report..."} value={url} onChange={e => parseUrl(e.target.value)} />
            {!isLive && (
                <Button onClick={handleSearch} className="bg-red-600 hover:bg-red-700 font-bold text-white"><Search className="mr-2" size={16}/> Buscar</Button>
            )}
          </div>
          {isLive && report.code && (
             <LiveFightSelector reportCode={report.code} selectedFightId={report.fightId} onSelect={handleLiveFightSelect} />
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="death-analyzer" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="death-analyzer">Death Analyzer</TabsTrigger>
          <TabsTrigger value="note-timer">Note Timer Checker</TabsTrigger>
        </TabsList>

        <TabsContent value="death-analyzer" className="space-y-6">
      <div className="flex items-center gap-2 text-zinc-400 text-sm">
        <span>Mostrar primeiros:</span>
        {[1, 3, 5, 10, 20].map(num => (
          <Button key={num} size="sm" variant={deathLimit === num ? "secondary" : "ghost"} onClick={() => setDeathLimit(num)} className={`h-6 px-2 ${deathLimit === num ? 'bg-zinc-700 text-white' : 'hover:text-white hover:bg-zinc-800'}`}>{num}</Button>
        ))}
      </div>

      {filteredDeaths.length > 0 && (
        <div className="grid grid-cols-1 gap-4">
            {filteredDeaths.map((death, index) => (
                <Card key={death.id} className="bg-zinc-900 border-zinc-800 overflow-hidden shadow-lg hover:border-zinc-700 transition-colors">
                    <div className="flex flex-col md:flex-row">
                        <div className="p-4 flex items-center gap-4 min-w-[300px] border-b md:border-b-0 md:border-r border-zinc-800 bg-zinc-950/50">
                            <span className="text-3xl font-black text-zinc-700">#{index + 1}</span>
                            <div>
                                <div className="flex items-baseline gap-2">
                                    <h3 className="text-lg font-bold text-zinc-100">{death.name}</h3>
                                    <span className="text-xs font-semibold text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">{death.spec}</span>
                                </div>
                                <div className="flex items-center gap-2 text-red-400 font-mono text-sm mt-1">
                                    <Clock size={14} /> Morreu aos {formatTime(death.deathRelativeTime || 0)}
                                </div>
                                <span className="text-[10px] text-zinc-600 uppercase tracking-widest">{death.type}</span>
                            </div>
                        </div>
                        <div className="p-4 flex-1 flex flex-col justify-center">
                            {analyzingId !== death.id && resultOwnerId !== death.id && (
                                <div className="flex items-center gap-4">
                                    <Button variant="outline" className="border-red-900/50 text-red-400 bg-red-950/10 hover:bg-red-950/30 hover:text-red-300 transition-all" onClick={() => investigateDeath(death)} disabled={!!analyzingId}>
                                        <Activity className="mr-2" size={16}/> Investigar Morte
                                    </Button>
                                </div>
                            )}
                            {analyzingId === death.id && (
                                <div className="text-sm text-zinc-500 flex items-center gap-2 animate-pulse"><div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>Buscando dados de combate...</div>
                            )}
                            {resultOwnerId === death.id && (
                                <div className="space-y-6 animate-in slide-in-from-left-2 fade-in duration-300">
                                     {/* SEÇÃO DE CONSUMABLES */}
                                     {defensiveResult.consumables.length > 0 && (
                                         <div className="space-y-2">
                                            <div className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center gap-2">
                                                <ShieldAlert size={12}/> Consumíveis
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                {defensiveResult.consumables.map((res) => (
                                                    <ConsumableCard key={res.key} c={res} tooltip={{ onMouseEnter: showTooltip, onMouseLeave: hideTooltip }} />
                                                ))}
                                            </div>
                                         </div>
                                     )}
                                     
                                     {/* SEÇÃO DE DEFENSIVOS DA CLASSE/SPEC */}
                                     {defensiveResult.classDefensives.length > 0 && (
                                         <div className="space-y-2">
                                            <div className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2">
                                                <ShieldAlert size={12}/> Defensivos da Classe ({death.spec})
                                                <span className="ml-auto normal-case tracking-normal font-normal text-[10px] text-zinc-600">
                                                    {defensiveResult.talentsKnown ? 'baseado nos talentos do log' : 'log sem talentos: defensivos de talento presumidos'} · build {DEFENSIVES_BUILD}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                {defensiveResult.classDefensives.map((res) => (
                                                    <DefensiveCard key={res.key} d={res} tooltip={{ onMouseEnter: showTooltip, onMouseLeave: hideTooltip }} />
                                                ))}
                                            </div>
                                         </div>
                                     )}
                                     
                                     {/* SEÇÃO TIMELINE */}
                                     <div className="space-y-2">
                                        <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2 border-t border-zinc-800 pt-4 mt-4">
                                            <Activity size={12}/> Timeline (Últimos 7s)
                                        </div>
                                        {timelineResult.length === 0 ? (
                                            <div className="text-center text-zinc-600 text-xs py-4 bg-zinc-950/30 rounded border border-zinc-800">
                                                Nenhum evento encontrado
                                            </div>
                                        ) : (
                                            <div className="space-y-1 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                                {timelineResult.map((event, idx) => {
                                                    const timeDiff = ((event.timestamp - death.timestamp) / 1000).toFixed(1);
                                                    const isHealing = event.type === 'healing';
                                                    return (
                                                        <div key={idx} className={`flex items-center justify-between text-xs p-1.5 rounded border border-transparent hover:border-zinc-700 transition-colors ${!isHealing ? 'bg-red-950/20 text-red-200' : 'bg-green-950/20 text-green-200'}`}>
                                                            <div className="flex items-center gap-2 w-16 shrink-0 font-mono opacity-50 text-[10px]">{timeDiff}s</div>
                                                            <div className="flex items-center gap-2 flex-1 overflow-hidden">
                                                                <SpellIcon 
                                                                    spellId={event.abilityGameID} 
                                                                    icon={iconCache.get(event.abilityGameID) || event.abilityIcon} 
                                                                    size="sm" 
                                                                    className="border-white/10"
                                                                    onMouseEnter={showTooltip}
                                                                    onMouseLeave={hideTooltip}
                                                                />
                                                                <div className="flex flex-col truncate">
                                                                    <span className="truncate font-medium">{event.abilityName}</span>
                                                                    <span className="truncate text-[9px] opacity-60">{event.sourceName}</span>
                                                                    <div className="flex gap-2">
                                                                        {event.mitigated ? <span className="text-[9px] opacity-60">Mitigado: {(event.mitigated || 0).toLocaleString()}</span> : null}
                                                                        {event.absorbed ? <span className="text-[9px] opacity-60">Absorvido: {(event.absorbed || 0).toLocaleString()}</span> : null}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="font-mono font-bold text-right pl-2">
                                                                {isHealing ? '+' : '-'}{(event.amount || 0).toLocaleString()}
                                                                {(event.overkill || 0) > 0 && <div className="text-[9px] text-red-500 font-black">KILL ({(event.overkill || 0).toLocaleString()})</div>}
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                                <div className="flex items-center justify-between text-xs p-2 bg-red-600/20 border border-red-600/50 text-white font-bold rounded">
                                                    <div className="w-16 font-mono">0.0s</div>
                                                    <div className="flex items-center gap-2 flex-1">
                                                        <Skull size={16}/> MORTE
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                     </div>
                                </div>
                            )}
                        </div>
                    </div>
                </Card>
            ))}
        </div>
      )}
      {loadingDeaths && <div className="text-center p-10 text-zinc-500 animate-pulse">Carregando lista de óbitos...</div>}
        </TabsContent>

        <TabsContent value="note-timer" className="space-y-6">
          <NoteTimerChecker code={report.code} fightId={report.fightId} />
        </TabsContent>
      </Tabs>

      {tooltip && <SpellTooltip {...tooltip} />}
    </div>
  );
}