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

## Note Timer Checker

Cole a nota de raid (formato MRT/ExRT) na aba **Note Timer Checker**. O parser
(`src/lib/noteTimers.ts`) extrai só o que é timer:

- `time:…;tag:Jogador;spellid:…` — habilidade que o jogador deve usar naquele momento;
- `tag:everyone;spellid:<poção>` — todos devem usar (poção de vida, healthstone);
- `tag:everyone;text:Cd pessoal!` — todos devem usar ALGUM defensivo pessoal da sua classe/spec.

Tudo o mais (posições, ordem de mecânicas, `assign:`, `invitelist`, blocos de texto) é descartado.
Cada cast só "paga" um timer, então a mesma spell em 1:00 e 4:00 é verificada separadamente.
Para cada timer a tela mostra a faixa da margem (± segundos, ajustável), o ponto exato da nota e,
se foi usado dentro da margem, onde caiu; fora da margem só informa quando foi usado.

Para ficar leve, é feita **uma** consulta ao WCL com `filterExpression` contendo apenas os IDs de spell
que a nota exige (variantes por talento incluídas), para todos os jogadores de uma vez; só entram
defensivos/poções se a nota pedir. Detalhe da API: `startTime` sem `endTime` retorna 0 eventos, então
sempre se envia os dois.

### Kick assign

Linhas `tag:Jogador;assign:{moon} Kick and mark add #1;` (ícones: star, circle, diamond, triangle,
moon, square, cross, skull) viram a escala de interrupts. Para cada uma o checker baixa os eventos
de **interrupt** de todo o elenco e os **casts** de kick dos escalados. Ambos trazem o alvo
(`targetID` + `targetInstance`, que distingue mobs de mesmo nome) e `targetMarker`, a marcação que o
alvo tinha naquele instante. O resultado mostra, por marca, a sequência de kicks (de escalados ou
não) e, por jogador, se interrompeu a marca certa, outra marca, um alvo sem marcação ou se o kick
não surtiu efeito.

Os interrupts por classe/spec ficam em `INTERRUPTS` no `scripts/defensives.config.mjs`. O gerador
usa a árvore de talentos do patch para saber em que specs cada um existe (ex.: Quell só em
Devastation/Augmentation; healers perderam interrupts no Midnight, exceto Wind Shear do Resto
Shaman). `ids` lista todos os IDs de log de um interrupt (o do cast e o do efeito, que podem
diferir: Skull Bash 106839/93985, Silence 15487/220543, Solar Beam 78675/97547). Se um patch mudar
os IDs, meça no log: `dataType: Interrupts` mostra o `abilityGameID` real de cada kick.
`incidental: true` marca dano que só às vezes interrompe (Avenger's Shield).
