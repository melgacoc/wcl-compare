import { ApolloProvider } from '@apollo/client/react';
import { client } from './lib/apollo';
import { LogComparator } from './components/LogComparator';

function App() {
  return (
    <ApolloProvider client={client}>
      {/* MUDANÇA AQUI: Fundo escuro (zinc-950) e texto claro */}
      <div className="min-h-screen bg-zinc-950 text-zinc-100 py-12 px-4 font-sans antialiased">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-4xl font-extrabold text-center mb-10 tracking-tight text-white drop-shadow-md">
            WCL Comparator <span className="text-blue-500">Pro</span>
          </h1>
          <LogComparator />
        </div>
      </div>
    </ApolloProvider>
  )
}

export default App