import { useState } from 'react';
import { useLazyQuery } from '@apollo/client/react';
import { GET_DEATHS, GET_PLAYER_CASTS, GET_DEATH_TIMELINE } from '@/lib/queries';
import { DEFENSIVE_SPELLS, type DefensiveSpell } from '@/lib/wow-spells';
import { LiveFightSelector } from './LiveFightSelector';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skull, Clock, ShieldAlert, Search, Activity } from 'lucide-react';

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

interface CastEvent {
  timestamp: number;
  abilityGameID: number;
}

interface TimelineEvent {
  timestamp: number;
  type: 'damage' | 'healing';
  amount: number;
  abilityName: string;
  abilityIcon: string;
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
    events?: { data?: CastEvent[] };
    damageTaken?: { data?: any[] };
    healingReceived?: { data?: any[] };
  };
}

interface DeathsQueryData {
  reportData?: ReportData;
}

interface CastsQueryData {
  reportData?: ReportData;
}

interface TimelineQueryData {
  reportData?: ReportData;
}

export function DeathLog() {
  const [url, setUrl] = useState('');
  const [report, setReport] = useState({ code: '', fightId: 0 });
  const [deathLimit, setDeathLimit] = useState(5);
  const [isLive, setIsLive] = useState(false);
  
  const [analyzingId, setAnalyzingId] = useState<number | null>(null);
  const [resultOwnerId, setResultOwnerId] = useState<number | null>(null);
  
  const [defensiveResult, setDefensiveResult] = useState<{spell: DefensiveSpell, status: 'AVAILABLE' | 'ON_COOLDOWN' | 'ACTIVE'}[]>([]);
  const [timelineResult, setTimelineResult] = useState<TimelineEvent[]>([]);

  const [getDeaths, { data: deathData, loading: loadingDeaths }] = useLazyQuery<DeathsQueryData>(GET_DEATHS);
  const [getCasts] = useLazyQuery<CastsQueryData>(GET_PLAYER_CASTS);
  const [getTimeline] = useLazyQuery<TimelineQueryData>(GET_DEATH_TIMELINE);

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
    setDefensiveResult([]);
    setTimelineResult([]);
    setResultOwnerId(null);
  };

  const handleLiveFightSelect = (fightId: number) => {
    setReport(prev => ({ ...prev, fightId }));
    getDeaths({ variables: { code: report.code, fightId } });
    setDefensiveResult([]);
    setTimelineResult([]);
    setResultOwnerId(null);
  };

  const investigateDeath = async (player: DeathEntry) => {
    setAnalyzingId(player.id);
    setResultOwnerId(null);
    setDefensiveResult([]);
    setTimelineResult([]);

    // 1. CHECAR DEFENSIVOS
    const possibleDefensives = DEFENSIVE_SPELLS[player.type] || [];
    let newDefensiveResult: any[] = [];

    if (possibleDefensives.length > 0) {
      const { data: castDataRaw } = await getCasts({ 
        variables: { code: report.code, fightId: report.fightId, playerId: player.id } 
      });
      const castData = (castDataRaw || {}) as { reportData?: any };
      const casts: CastEvent[] = castData?.reportData?.report?.events?.data || [];
      newDefensiveResult = possibleDefensives.map(spell => {
        const uses = casts.filter(c => c.abilityGameID === spell.id);
        const deathTimestampAbs = player.timestamp;
        const castsBeforeDeath = uses.filter(c => c.timestamp < deathTimestampAbs);
        const lastCast = castsBeforeDeath[castsBeforeDeath.length - 1];

        let status: 'AVAILABLE' | 'ON_COOLDOWN' | 'ACTIVE' = 'AVAILABLE';
        if (lastCast) {
          const timeDiff = deathTimestampAbs - lastCast.timestamp; 
          if (timeDiff <= (spell.duration * 1000)) status = 'ACTIVE';
          else if (timeDiff < (spell.cooldown * 1000)) status = 'ON_COOLDOWN';
        }
        return { spell, status };
      });
    }

    // 2. CONSTRUIR TIMELINE (7s antes + 200ms depois pra garantir o kill)
    const endTime = player.timestamp + 200; 
    const startTime = player.timestamp - 7000;

    const { data: timelineDataRaw } = await getTimeline({
      variables: { 
        code: report.code, 
        fightId: report.fightId, 
        playerId: player.id, 
        startTime, 
        endTime 
      }
    });
    const timelineData = (timelineDataRaw || {}) as { reportData?: any };
    const damageEvents = timelineData?.reportData?.report?.damageTaken?.data || [];
    const healingEvents = timelineData?.reportData?.report?.healingReceived?.data || [];

    const formattedTimeline: TimelineEvent[] = [
      ...damageEvents.map((e: any) => ({
        timestamp: e.timestamp,
        type: 'damage' as const,
        // Proteção contra valores nulos
        amount: (e.amount || 0) + (e.absorbed || 0),
        abilityName: e.ability?.name || 'Melee',
        abilityIcon: e.ability?.abilityIcon || 'ability_meleedamage.jpg',
        sourceName: 'Inimigo',
        overkill: e.overkill,
        mitigated: e.mitigated,
        absorbed: e.absorbed
      })),
      ...healingEvents.map((e: any) => ({
        timestamp: e.timestamp,
        type: 'healing' as const,
        amount: e.amount || 0,
        abilityName: e.ability?.name || 'Heal',
        abilityIcon: e.ability?.abilityIcon || 'spell_holy_flashheal.jpg',
        sourceName: 'Healer',
        absorbed: e.absorbed
      }))
    ];

    formattedTimeline.sort((a, b) => a.timestamp - b.timestamp);

    setDefensiveResult(newDefensiveResult);
    setTimelineResult(formattedTimeline);
    setResultOwnerId(player.id);
    setAnalyzingId(null);
    };

  const processDeaths = (): DeathEntry[] => {
    if (!deathData?.reportData?.report?.table?.data?.entries) return [];
    const rawList = deathData.reportData.report.table.data.entries;
    const fightStartTime = deathData.reportData.report.fights?.[0]?.startTime || 0;

    const formatted = rawList.map((d: any) => ({
        name: d.name,
        id: d.id,
        type: d.type,
        icon: d.icon,
        timestamp: d.timestamp,
        spec: d.icon.split('-')[1] || d.type,
        deathRelativeTime: d.timestamp - fightStartTime,
        deathEvents: d.events
    }));

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
          <CardTitle className="flex items-center gap-2 text-red-500">
            <Skull /> Death Analyzer
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
                <Button onClick={handleSearch} className="bg-red-600 hover:bg-red-700 font-bold text-white"><Search className="mr-2" size={16}/> Buscar Mortes</Button>
            )}
          </div>
          {isLive && report.code && (
             <LiveFightSelector reportCode={report.code} selectedFightId={report.fightId} onSelect={handleLiveFightSelect} />
          )}
          <div className="flex items-center gap-2 text-zinc-400 text-sm">
            <span>Mostrar primeiros:</span>
            {[1, 3, 5, 10, 20].map(num => (
              <Button key={num} size="sm" variant={deathLimit === num ? "secondary" : "ghost"} onClick={() => setDeathLimit(num)} className={`h-6 px-2 ${deathLimit === num ? 'bg-zinc-700 text-white' : 'hover:text-white hover:bg-zinc-800'}`}>{num}</Button>
            ))}
          </div>
        </CardContent>
      </Card>

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
                                     {defensiveResult.length > 0 && (
                                         <div className="space-y-2">
                                            <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2"><ShieldAlert size={12}/> Status dos Defensivos</div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                {defensiveResult.map((res, idx) => (
                                                    <div key={idx} className={`flex items-center justify-between p-2.5 rounded border text-sm shadow-sm ${res.status === 'AVAILABLE' ? 'bg-red-500/10 border-red-500/30 text-red-200' : ''} ${res.status === 'ON_COOLDOWN' ? 'bg-zinc-800/50 border-zinc-700/50 text-zinc-500' : ''} ${res.status === 'ACTIVE' ? 'bg-green-500/10 border-green-500/30 text-green-200' : ''}`}>
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="w-8 h-8 bg-zinc-950 rounded border border-white/5 overflow-hidden shrink-0">
                                                                <img src={`https://assets.rpglogs.com/img/warcraft/abilities/${res.spell.icon}.jpg`} alt="" className={`w-full h-full object-cover ${res.status === 'ON_COOLDOWN' ? 'grayscale opacity-50' : ''}`}/>
                                                            </div>
                                                            <span className="font-medium">{res.spell.name}</span>
                                                        </div>
                                                        <div className="font-bold text-xs pl-2">
                                                            {res.status === 'AVAILABLE' && <span className="text-red-400">DISPONÍVEL</span>}
                                                            {res.status === 'ACTIVE' && <span className="text-green-400">ATIVO</span>}
                                                            {res.status === 'ON_COOLDOWN' && <span className="text-zinc-500">CD</span>}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                         </div>
                                     )}
                                     {timelineResult.length > 0 && (
                                         <div className="space-y-2">
                                            <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2 border-t border-zinc-800 pt-4 mt-4"><Activity size={12}/> Timeline (Últimos 7s)</div>
                                            <div className="space-y-1 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                                {timelineResult.map((event, idx) => {
                                                    const timeDiff = ((event.timestamp - death.timestamp) / 1000).toFixed(1);
                                                    const isHealing = event.type === 'healing';
                                                    return (
                                                        <div key={idx} className={`flex items-center justify-between text-xs p-1.5 rounded border border-transparent hover:border-zinc-700 transition-colors ${!isHealing ? 'bg-red-950/20 text-red-200' : 'bg-green-950/20 text-green-200'}`}>
                                                            <div className="flex items-center gap-2 w-16 shrink-0 font-mono opacity-50 text-[10px]">{timeDiff}s</div>
                                                            <div className="flex items-center gap-2 flex-1 overflow-hidden">
                                                                <img src={`https://assets.rpglogs.com/img/warcraft/abilities/${event.abilityIcon}`} className="w-5 h-5 rounded border border-white/10"/>
                                                                <div className="flex flex-col truncate">
                                                                    <span className="truncate font-medium">{event.abilityName}</span>
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
                                                <div className="flex items-center justify-between text-xs p-2 bg-red-600/20 border border-red-600/50 text-white font-bold rounded"><div className="w-16 font-mono">0.0s</div><div className="flex items-center gap-2 flex-1"><Skull size={16}/> MORTE</div></div>
                                            </div>
                                         </div>
                                     )}
                                </div>
                            )}
                        </div>
                    </div>
                </Card>
            ))}
        </div>
      )}
      {loadingDeaths && <div className="text-center p-10 text-zinc-500 animate-pulse">Carregando lista de óbitos...</div>}
    </div>
  );
}