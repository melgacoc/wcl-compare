import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Swords, Skull, ArrowRight } from 'lucide-react';

interface HomePageProps {
  onNavigate: (view: 'comparator' | 'deaths') => void;
}

export function HomePage({ onNavigate }: HomePageProps) {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center space-y-4">
        <h2 className="text-2xl font-light text-zinc-400">Selecione uma ferramenta</h2>
        <p className="text-zinc-500 max-w-lg mx-auto">
          Ferramentas avançadas para análise de logs do Warcraft. Compare performance ou analise mortes detalhadamente.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {/* CARD 1: LOG COMPARATOR */}
        <Card 
          className="bg-zinc-900 border-zinc-800 hover:border-blue-500/50 hover:bg-zinc-900/80 transition-all cursor-pointer group relative overflow-hidden"
          onClick={() => onNavigate('comparator')}
        >
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-600 group-hover:h-full transition-all" />
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-zinc-100 group-hover:text-blue-400 transition-colors">
              <div className="p-2 bg-zinc-950 rounded-lg border border-zinc-800 group-hover:border-blue-500/30">
                <Swords size={24} className="text-blue-500" />
              </div>
              Log Comparator
            </CardTitle>
            <CardDescription className="text-zinc-400 pt-2">
              Compare dois logs lado a lado. Analise DPS, HPS e compare o uso de habilidades entre jogadores da mesma classe.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-sm font-bold text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-[-10px] group-hover:translate-x-0">
              ACESSAR FERRAMENTA <ArrowRight size={16} className="ml-2" />
            </div>
          </CardContent>
        </Card>

        {/* CARD 2: DEATH LOG */}
        <Card 
          className="bg-zinc-900 border-zinc-800 hover:border-red-500/50 hover:bg-zinc-900/80 transition-all cursor-pointer group relative overflow-hidden"
          onClick={() => onNavigate('deaths')}
        >
          <div className="absolute top-0 left-0 w-1 h-full bg-red-600 group-hover:h-full transition-all" />
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-zinc-100 group-hover:text-red-400 transition-colors">
              <div className="p-2 bg-zinc-950 rounded-lg border border-zinc-800 group-hover:border-red-500/30">
                <Skull size={24} className="text-red-500" />
              </div>
              Death Analyzer
            </CardTitle>
            <CardDescription className="text-zinc-400 pt-2">
              Investigue a causa raiz das mortes. Linha do tempo de dano recebido, curas e cooldowns defensivos antes do óbito.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-sm font-bold text-red-500 opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-[-10px] group-hover:translate-x-0">
              ACESSAR FERRAMENTA <ArrowRight size={16} className="ml-2" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}