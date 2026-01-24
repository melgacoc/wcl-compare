import { useState } from 'react';
import { ApolloProvider } from '@apollo/client/react';
import { client } from './lib/apollo';
import { LogComparator } from './components/LogComparator';
import { HomePage } from './components/HomePage';
import { DeathLog } from './components/DeathLog';
import { Button } from './components/ui/button';
import { ChevronLeft, LayoutGrid } from 'lucide-react';

// Tipos de visualização possíveis
type ViewState = 'home' | 'comparator' | 'deaths';

function App() {
  const [currentView, setCurrentView] = useState<ViewState>('home');

  return (
    <ApolloProvider client={client}>
      <div className="min-h-screen bg-zinc-950 text-zinc-100 py-8 px-4 font-sans antialiased">
        <div className="max-w-7xl mx-auto">
          
          {/* HEADER DA APLICAÇÃO */}
          <header className="flex items-center justify-between mb-10 pb-6 border-b border-zinc-800">
            <div className="flex items-center gap-4">
              {currentView !== 'home' && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setCurrentView('home')}
                  className="text-zinc-400 hover:text-white hover:bg-zinc-800"
                >
                  <ChevronLeft className="mr-1" size={18} /> Voltar
                </Button>
              )}
              
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
                  <LayoutGrid className="text-blue-600" />
                  WCL Tools <span className="text-blue-500 font-light">Pro</span>
                </h1>
              </div>
            </div>

            {/* Breadcrumb simples (Opcional) */}
            {currentView !== 'home' && (
               <div className="text-sm font-mono text-zinc-500 uppercase tracking-widest hidden md:block">
                 {currentView === 'comparator' ? 'LOG COMPARATOR' : 'DEATH ANALYZER'}
               </div>
            )}
          </header>

          {/* CONTEÚDO DINÂMICO */}
          <main>
            {currentView === 'home' && (
              <HomePage onNavigate={setCurrentView} />
            )}

            {currentView === 'comparator' && (
              <LogComparator />
            )}

            {currentView === 'deaths' && (
              <DeathLog />
            )}
          </main>

        </div>
      </div>
    </ApolloProvider>
  )
}

export default App;