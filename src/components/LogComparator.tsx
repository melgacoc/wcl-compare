import { useState, useMemo, useEffect } from 'react';
import { useLazyQuery } from '@apollo/client/react';
import { GET_REPORT_DATA } from '@/lib/queries';
import { AbilityComparator } from './AbilityComparator';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Swords, Link as LinkIcon, Filter, XCircle, Shield, Cross, Zap, Heart, Split } from 'lucide-react';

const CLASS_COLORS: Record<string, string> = {
  "DeathKnight": "#C41F3B", "DemonHunter": "#A330C9", "Druid": "#FF7D0A",
  "Evoker": "#33937F", "Hunter": "#ABD473", "Mage": "#40C7EB",
  "Monk": "#00FF96", "Paladin": "#F58CBA", "Priest": "#FFFFFF",
  "Rogue": "#FFF569", "Shaman": "#0070DE", "Warlock": "#8787ED",
  "Warrior": "#C79C6E", 
};

const getRoleIcon = (spec: string) => {
  const tanks = ['Blood', 'Vengeance', 'Guardian', 'Brewmaster', 'Protection', 'Protection Warrior'];
  const healers = ['Restoration', 'Holy', 'Discipline', 'Mistweaver', 'Preservation'];
  if (tanks.some(t => spec.includes(t))) return <Shield size={14} className="text-blue-400" />;
  if (healers.some(h => spec.includes(h))) return <Cross size={14} className="text-green-400" />;
  return <Zap size={14} className="text-red-400" />;
};

interface PlayerData { 
  name: string; 
  id: number; 
  type: string; 
  icon: string; 
  total: number; 
  activeTime: number;
  cleanName: string;
  value: number;
}

interface ReportDataResponse {
  reportData: {
    report: {
      table: {
        data: {
          entries: Omit<PlayerData, 'cleanName' | 'value'>[];
          totalTime: number;
        };
      };
    };
  };
}

export function LogComparator() {
  const [inputA, setInputA] = useState('');
  const [inputB, setInputB] = useState('');
  const [reportA, setReportA] = useState({ code: '', fightId: 0 });
  const [reportB, setReportB] = useState({ code: '', fightId: 0 });
  const [metric, setMetric] = useState<'DamageDone' | 'Healing'>('DamageDone');
  
  const [selectedPlayerA, setSelectedPlayerA] = useState<PlayerData | null>(null);
  const [selectedPlayerB, setSelectedPlayerB] = useState<PlayerData | null>(null);
  const [showAbilityComparison, setShowAbilityComparison] = useState(false);

  const [selectedClass, setSelectedClass] = useState<string>('All');
  const [selectedSpec, setSelectedSpec] = useState<string>('All');

  const [getDataA, { data: dataA, loading: loadA }] = useLazyQuery<ReportDataResponse>(GET_REPORT_DATA);
  const [getDataB, { data: dataB, loading: loadB }] = useLazyQuery<ReportDataResponse>(GET_REPORT_DATA);

  const parseAndSet = (value: string, side: 'A' | 'B') => {
    if (side === 'A') setInputA(value); else setInputB(value);
    let code = value;
    let fightId = 0;
    if (value.includes('warcraftlogs.com/reports/')) {
      try {
        const urlObj = new URL(value);
        const pathParts = urlObj.pathname.split('/');
        const reportIndex = pathParts.indexOf('reports');
        if (reportIndex !== -1 && pathParts[reportIndex + 1]) code = pathParts[reportIndex + 1];
        const fightParam = urlObj.searchParams.get('fight');
        if (fightParam && !isNaN(Number(fightParam))) fightId = Number(fightParam);
      } catch (e) { console.error("URL inválida", e); }
    }
    if (side === 'A') setReportA({ code, fightId }); else setReportB({ code, fightId });
  };

  const handleCompare = () => {
    if (!reportA.code || !reportA.fightId) return alert("Report A inválido");
    if (!reportB.code || !reportB.fightId) return alert("Report B inválido");
    getDataA({ variables: { code: reportA.code, fightId: reportA.fightId, dataType: metric } });
    getDataB({ variables: { code: reportB.code, fightId: reportB.fightId, dataType: metric } });
    setSelectedPlayerA(null);
    setSelectedPlayerB(null);
    setShowAbilityComparison(false);
  };

  useEffect(() => { if (dataA && reportA.code) handleCompare(); }, [metric]);

  const processList = (data: ReportDataResponse | undefined): PlayerData[] => {
    if (!data?.reportData?.report?.table?.data?.entries) return [];
    const entries = data.reportData.report.table.data.entries;
    const totalTime = data.reportData.report.table.data.totalTime || 1;
    return entries.filter(p => CLASS_COLORS[p.type]).map(p => ({
      ...p,
      cleanName: p.name.split('-')[0],
      value: Math.floor(p.total / (totalTime / 1000))
    })).sort((a, b) => b.value - a.value);
  };

  const rawListA = useMemo(() => processList(dataA), [dataA, metric]);
  const rawListB = useMemo(() => processList(dataB), [dataB, metric]);

  const availableClasses = useMemo(() => {
    const all = [...rawListA, ...rawListB];
    return Array.from(new Set(all.map(p => p.type))).sort();
  }, [rawListA, rawListB]);

  const availableSpecs = useMemo(() => {
    const all = [...rawListA, ...rawListB];
    return Array.from(new Set(all.filter(p => selectedClass === 'All' || p.type === selectedClass).map(p => p.icon))).sort();
  }, [rawListA, rawListB, selectedClass]);

  const listA = rawListA.filter(p => (selectedClass === 'All' || p.type === selectedClass) && (selectedSpec === 'All' || p.icon === selectedSpec));
  const listB = rawListB.filter(p => (selectedClass === 'All' || p.type === selectedClass) && (selectedSpec === 'All' || p.icon === selectedSpec));

  const canCompareAbilities = selectedPlayerA && selectedPlayerB && selectedPlayerA.icon === selectedPlayerB.icon;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-center gap-2 mb-4">
        <Button variant={metric === 'DamageDone' ? 'default' : 'outline'} onClick={() => setMetric('DamageDone')} className={`w-32 gap-2 border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800 ${metric === 'DamageDone' ? '!bg-red-900/80 !text-white !border-red-700' : ''}`}>
          <Swords size={16} /> Dano
        </Button>
        <Button variant={metric === 'Healing' ? 'default' : 'outline'} onClick={() => setMetric('Healing')} className={`w-32 gap-2 border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800 ${metric === 'Healing' ? '!bg-green-900/80 !text-white !border-green-700' : ''}`}>
          <Heart size={16} /> Cura
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-zinc-900 border-zinc-800 shadow-lg">
           <CardHeader className="py-3 border-b border-zinc-800">
             <CardTitle className="text-sm flex items-center gap-2 text-zinc-100">
               <LinkIcon size={14} className="text-blue-500"/> Report A
             </CardTitle>
           </CardHeader>
           <CardContent className="space-y-2 py-4">
             <Input 
                className="h-9 text-xs font-mono bg-zinc-950 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-blue-900" 
                placeholder="Cole a URL..." 
                onChange={e => parseAndSet(e.target.value, 'A')} 
                value={inputA} 
             />
           </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800 shadow-lg">
           <CardHeader className="py-3 border-b border-zinc-800">
             <CardTitle className="text-sm flex items-center gap-2 text-zinc-100">
               <LinkIcon size={14} className="text-orange-500"/> Report B
             </CardTitle>
           </CardHeader>
           <CardContent className="space-y-2 py-4">
             <Input 
                className="h-9 text-xs font-mono bg-zinc-950 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-orange-900" 
                placeholder="Cole a URL..." 
                onChange={e => parseAndSet(e.target.value, 'B')} 
                value={inputB} 
             />
           </CardContent>
        </Card>
      </div>

      <Button className="w-full font-bold h-12 bg-zinc-100 text-zinc-900 hover:bg-zinc-300" onClick={handleCompare} disabled={loadA || loadB}>
        {loadA || loadB ? 'Carregando...' : 'ATUALIZAR DADOS'}
      </Button>

      {(rawListA.length > 0 || rawListB.length > 0) && (
        <Card className="bg-zinc-900 border-zinc-800 shadow-xl">
          <CardHeader className="pb-3 border-b border-zinc-800">
            <div className="flex justify-between items-center gap-4">
              <CardTitle className="text-lg flex items-center gap-2 text-zinc-100">
                Ranking de {metric === 'DamageDone' ? 'Dano' : 'Cura'}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-zinc-500" />
                <select className="h-8 text-sm border border-zinc-700 rounded px-2 bg-zinc-950 text-zinc-300" value={selectedClass} onChange={(e) => { setSelectedClass(e.target.value); setSelectedSpec('All'); }}>
                    <option value="All">Todas as Classes</option>
                    {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select className="h-8 text-sm border border-zinc-700 rounded px-2 bg-zinc-950 text-zinc-300" value={selectedSpec} onChange={(e) => setSelectedSpec(e.target.value)} disabled={selectedClass === 'All'}>
                    <option value="All">Todas as Specs</option>
                    {availableSpecs.map(s => <option key={s} value={s}>{s.split('-').pop()}</option>)}
                </select>
                {(selectedClass !== 'All' || selectedSpec !== 'All') && <Button variant="ghost" size="sm" onClick={() => { setSelectedClass('All'); setSelectedSpec('All'); }}><XCircle size={16} className="text-red-500" /></Button>}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 bg-zinc-950">
            <div className="grid grid-cols-1 md:grid-cols-2 divide-x divide-zinc-800">
              
              <div className="p-0">
                <Table>
                    <TableHeader className="bg-zinc-950"><TableRow className="hover:bg-zinc-950 border-zinc-800"><TableHead className="text-zinc-500">Jogadores A</TableHead><TableHead className="text-right text-blue-500 font-bold">{metric === 'DamageDone' ? 'DPS' : 'HPS'}</TableHead></TableRow></TableHeader>
                    <TableBody className="bg-zinc-900 text-zinc-100">
                        {listA.map(p => (
                            <TableRow 
                                key={p.id} 
                                className={`cursor-pointer transition-colors border-zinc-800 h-12 ${selectedPlayerA?.id === p.id ? 'bg-blue-900/30 hover:bg-blue-900/40' : 'hover:bg-zinc-800'}`}
                                onClick={() => setSelectedPlayerA(p)}
                            >
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <div className="bg-zinc-950 p-1 rounded-full border border-zinc-700"><span title={p.icon}>{getRoleIcon(p.icon)}</span></div>
                                        <div className="flex flex-col">
                                            <span className="font-bold text-sm tracking-wide" style={{ color: CLASS_COLORS[p.type] }}>{p.cleanName}</span>
                                            <span className="text-[10px] text-zinc-400 uppercase font-semibold">{p.icon.split('-').pop()}</span>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right font-mono text-zinc-300">{p.value.toLocaleString()}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
              </div>

              <div className="p-0">
                <Table>
                    <TableHeader className="bg-zinc-950"><TableRow className="hover:bg-zinc-950 border-zinc-800"><TableHead className="text-zinc-500">Jogadores B</TableHead><TableHead className="text-right text-orange-500 font-bold">{metric === 'DamageDone' ? 'DPS' : 'HPS'}</TableHead></TableRow></TableHeader>
                    <TableBody className="bg-zinc-900 text-zinc-100">
                        {listB.map(p => (
                            <TableRow 
                                key={p.id} 
                                className={`cursor-pointer transition-colors border-zinc-800 h-12 ${selectedPlayerB?.id === p.id ? 'bg-orange-900/30 hover:bg-orange-900/40' : 'hover:bg-zinc-800'}`}
                                onClick={() => setSelectedPlayerB(p)}
                            >
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <div className="bg-zinc-950 p-1 rounded-full border border-zinc-700"><span title={p.icon}>{getRoleIcon(p.icon)}</span></div>
                                        <div className="flex flex-col">
                                            <span className="font-bold text-sm tracking-wide" style={{ color: CLASS_COLORS[p.type] }}>{p.cleanName}</span>
                                            <span className="text-[10px] text-zinc-400 uppercase font-semibold">{p.icon.split('-').pop()}</span>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right font-mono text-zinc-300">{p.value.toLocaleString()}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-center mt-6">
        {canCompareAbilities ? (
             <Button size="lg" className="bg-purple-600 hover:bg-purple-700 text-white animate-in fade-in zoom-in duration-300 shadow-lg shadow-purple-900/20" onClick={() => setShowAbilityComparison(true)}>
                <Split className="mr-2" /> Comparar Habilidades: {selectedPlayerA?.cleanName} vs {selectedPlayerB?.cleanName}
             </Button>
        ) : (
            selectedPlayerA && selectedPlayerB && (
                <div className="text-red-400 text-sm font-bold bg-red-950/30 px-6 py-3 rounded-full border border-red-900/50 shadow-sm">
                    ⚠️ Selecione jogadores da mesma Classe/Spec para comparar.
                </div>
            )
        )}
      </div>

      {showAbilityComparison && selectedPlayerA && selectedPlayerB && (
          <AbilityComparator 
             playerA={{ id: selectedPlayerA.id, name: selectedPlayerA.cleanName, spec: selectedPlayerA.icon.split('-').pop() || '' }}
             reportA={reportA}
             playerB={{ id: selectedPlayerB.id, name: selectedPlayerB.cleanName, spec: selectedPlayerB.icon.split('-').pop() || '' }}
             reportB={reportB}
             dataType={metric}
          />
      )}
    </div>
  );
}