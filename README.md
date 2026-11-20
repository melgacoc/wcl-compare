# wcl-compare

Ferramenta para analisar logs do Warcraft Logs: comparação de logs, análise de mortes
(defensivos/consumíveis disponíveis no momento da morte + timeline) e checagem de
timers de nota de raid.

## Rodando

```bash
cp .env.example .env   # preencha WCL_CLIENT_ID e WCL_CLIENT_SECRET
npm install
npm run dev
```

As credenciais ficam só no servidor: o app chama `/api/wcl`, que obtém o token OAuth
(client credentials) e repassa a query para `https://www.warcraftlogs.com/api/v2/client`.
Em dev isso é feito pelo plugin em `vite.config.ts`; no deploy, pela função
`netlify/functions/wcl.mts` (configure as duas variáveis no painel do Netlify).

## Defensivos e talentos — atualizando a cada patch

Vários talentos trocam ou alteram defensivos (ex.: **Ice Cold** substitui o Ice Block,
**Glacial Bulwark** dá uma carga extra, **Defender's Aegis** muda o Shield Wall). A análise
de morte lê os talentos reais do jogador no evento `CombatantInfo` do log e resolve:

- quais defensivos ele tinha (talento escolhido ou habilidade baseline);
- qual variante da spell estava ativa;
- CD e cargas ajustados pelos talentos;
- o estado no momento da morte (ativo / disponível / em CD e quanto faltava),
  simulando cargas e recargas.

Os dados por patch são **gerados**, não digitados:

```bash
npm run update:defensives          # patch live
npm run update:defensives -- --env ptr
```

O script `scripts/update-defensives.mjs` lê a lista curada em
`scripts/defensives.config.mjs` (só IDs de spell por classe/spec e variantes), baixa as
árvores de talento do patch no Raidbots e os tooltips da Wowhead, e grava
`src/data/defensives.generated.json` com nome, ícone, CD, cargas, duração, quais talentos
liberam cada spell e quais talentos alteram CD/cargas. Ele avisa quando uma spell da lista
foi removida do patch ou um ID não existe mais. Ao sair um patch: rode o script, leia os
avisos, ajuste o config se preciso e faça commit do JSON gerado.

### Poções de vida e qualidade

As qualidades de uma poção usam a mesma spell, então a qualidade (estrelas) é estimada
pela cura bruta do evento (efetiva + overheal + absorvida) comparada com a cura de cada
item na Wowhead. Bônus de cura aumentam o valor, então uma qualidade menor com bônus pode
parecer a maior: nesses casos a estrela aparece como "estimado". No Midnight os itens
craftados têm 2 qualidades; os itens de cada poção ficam em `CONSUMABLES` no config.
