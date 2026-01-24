import { useEffect } from 'react';
import { useQuery } from '@apollo/client/react';
import { GET_REPORT_FIGHTS } from '@/lib/queries';
import { RefreshCw, Skull, Trophy } from 'lucide-react';

interface LiveFightSelectorProps {
  reportCode: string;
  selectedFightId: number;
  onSelect: (fightId: number) => void;
}

interface ReportFightsQueryData {
  reportData?: {
    report?: {
      fights?: any[];
    };
  };
}

export function LiveFightSelector({ reportCode, selectedFightId, onSelect }: LiveFightSelectorProps) {
  const { data, loading, error, startPolling, stopPolling } = useQuery<ReportFightsQueryData>(GET_REPORT_FIGHTS, {
    variables: { code: reportCode },
    pollInterval: 40000, 
    notifyOnNetworkStatusChange: true,
    skip: !reportCode
  });

  useEffect(() => {
    startPolling(40000);
    return () => stopPolling();
  }, [startPolling, stopPolling]);

  if (!reportCode) return null;
  if (error) return <div className="text-red-500 text-xs p-2">Erro ao buscar lutas: {error.message}</div>;

  const fights = [...(data?.reportData?.report?.fights || [])].reverse();

  return (
    <div className="mt-4 border border-zinc-800 rounded-md bg-zinc-950/50 p-2 animate-in fade-in slide-in-from-top-2">
      <div className="flex items-center justify-between mb-2 px-2">
        <span className="text-xs font-bold text-blue-400 flex items-center gap-2">
          {loading ? <RefreshCw size={12} className="animate-spin"/> : <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"/>}
          AO VIVO (Atualizando a cada 40s)
        </span>
        <span className="text-[10px] text-zinc-500">{fights.length} lutas encontradas</span>
      </div>

      <div className="h-48 overflow-y-auto pr-2 custom-scrollbar space-y-1">
        {fights.length === 0 && !loading && (
            <div className="text-center text-zinc-500 text-xs py-8">Nenhuma luta encontrada ainda...</div>
        )}
        
        {fights.map((fight: any) => (
          <button
            key={fight.id}
            onClick={() => onSelect(fight.id)}
            className={`
              w-full flex items-center justify-between p-2 rounded text-xs transition-all border
              ${selectedFightId === fight.id 
                ? 'bg-blue-900/40 border-blue-500 text-white' 
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:border-zinc-700'}
            `}
          >
            <div className="flex items-center gap-2">
               {fight.kill ? <Trophy size={14} className="text-yellow-500"/> : <Skull size={14} className="text-red-500"/>}
               <span className="font-bold">{fight.name}</span>
            </div>
            
            <div className="flex items-center gap-2">
                {!fight.kill && (
                    <span className="text-red-400 font-mono">
                        {fight.fightPercentage ? `${fight.fightPercentage}%` : `${fight.bossPercentage / 100}%`}
                    </span>
                )}
                <span className="bg-zinc-950 px-1.5 py-0.5 rounded text-[10px] border border-zinc-800">
                    #{fight.id}
                </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}