// =============================================================================
// Lista de defensivos por classe — ÚNICA parte mantida à mão.
//
// Tudo o mais (nome, ícone, CD, cargas, duração, quais talentos liberam a spell,
// quais talentos alteram CD/cargas, valores de cura das poções) é gerado por:
//
//     npm run update:defensives
//
// que lê os dados do patch atual (Raidbots talents.json + tooltips da Wowhead)
// e grava src/data/defensives.generated.json. Rode de novo a cada patch e leia
// os avisos que o script imprime (spell removida, ID não encontrado etc.).
//
// Campos de cada entrada:
//   spell     ID do cast (o que aparece em eventos "cast" no Warcraft Logs).
//   specs     Nomes das specs como o WCL escreve (ex.: "BeastMastery").
//             Omitido = todas as specs da classe.
//   category  'personal' (só no próprio jogador), 'external' (em aliado) ou 'raid'.
//   variants  Outros IDs de cast da MESMA habilidade. Usados quando um talento
//             troca a spell (ex.: Ice Cold substitui Ice Block). Se a variante
//             for ela mesma um talento, o gerador detecta sozinho quando ela
//             está ativa. Se não for, ela só é escolhida quando aparece nos
//             casts do log — ou informe `requires` com o ID do talento.
//   talent    (opcional) ID da spell do talento que libera a habilidade, quando
//             for diferente do ID do cast e o Raidbots não ligar os dois.
//   duration  (opcional) duração em segundos, se o parser do tooltip errar.
// =============================================================================

/** @type {Record<string, Array<{spell:number, specs?:string[], category:'personal'|'external'|'raid', variants?:Array<number|{spell:number, requires?:number}>, talent?:number, duration?:number}>>} */
export const DEFENSIVES = {
  DeathKnight: [
    { spell: 48707, category: 'personal' },                     // Anti-Magic Shell
    { spell: 48792, category: 'personal' },                     // Icebound Fortitude
    { spell: 49039, category: 'personal' },                     // Lichborne
    { spell: 48743, category: 'personal', duration: 0 },        // Death Pact (cura instantânea; os 15s são heal absorb)
    { spell: 55233, specs: ['Blood'], category: 'personal' },   // Vampiric Blood
    { spell: 49028, specs: ['Blood'], category: 'personal' },   // Dancing Rune Weapon
    { spell: 51052, category: 'raid' },                         // Anti-Magic Zone
  ],
  DemonHunter: [
    { spell: 198589, specs: ['Havoc', 'Devourer'], category: 'personal' }, // Blur
    { spell: 204021, specs: ['Vengeance'], category: 'personal', duration: 12 }, // Fiery Brand (debuff no alvo)
    { spell: 187827, specs: ['Vengeance'], category: 'personal' },         // Metamorphosis (Vengeance)
    { spell: 196718, category: 'raid' },                                   // Darkness
  ],
  Druid: [
    { spell: 22812, category: 'personal' },                                // Barkskin
    { spell: 22842, category: 'personal' },                                // Frenzied Regeneration
    { spell: 61336, specs: ['Feral', 'Guardian'], category: 'personal' },  // Survival Instincts
    { spell: 102342, specs: ['Restoration'], category: 'external' },       // Ironbark
  ],
  Evoker: [
    { spell: 363916, category: 'personal' },                               // Obsidian Scales
    { spell: 357170, specs: ['Preservation'], category: 'external' },      // Time Dilation
    { spell: 374227, category: 'raid' },                                   // Zephyr
    { spell: 363534, specs: ['Preservation'], category: 'raid' },          // Rewind
  ],
  Hunter: [
    { spell: 186265, category: 'personal' },   // Aspect of the Turtle
    { spell: 109304, category: 'personal' },   // Exhilaration
    { spell: 264735, category: 'personal' },   // Survival of the Fittest
    { spell: 5384, category: 'personal', duration: 0 }, // Feign Death (buff de 6 min não é proteção)
    { spell: 53480, category: 'external' },    // Roar of Sacrifice
  ],
  Mage: [
    { spell: 45438, category: 'personal', variants: [414658] },           // Ice Block -> Ice Cold (talento)
    { spell: 235450, specs: ['Arcane'], category: 'personal' },           // Prismatic Barrier
    { spell: 235313, specs: ['Fire'], category: 'personal' },             // Blazing Barrier
    { spell: 11426, specs: ['Frost'], category: 'personal' },             // Ice Barrier
    { spell: 55342, category: 'personal' },                               // Mirror Image
    { spell: 110959, category: 'personal' },                              // Greater Invisibility
    { spell: 342245, category: 'personal' },                              // Alter Time
  ],
  Monk: [
    { spell: 115203, category: 'personal' },                                 // Fortifying Brew
    { spell: 1241059, specs: ['Brewmaster'], category: 'personal' },         // Celestial Infusion
    { spell: 322507, specs: ['Brewmaster'], category: 'personal' },          // Celestial Brew
    { spell: 122470, specs: ['Windwalker'], category: 'personal' },          // Touch of Karma
    { spell: 116849, specs: ['Mistweaver'], category: 'external' },          // Life Cocoon
  ],
  Paladin: [
    { spell: 642, category: 'personal' },                                    // Divine Shield
    { spell: 498, specs: ['Holy'], category: 'personal' },                   // Divine Protection (Holy)
    { spell: 403876, specs: ['Retribution'], category: 'personal' },         // Divine Protection (Ret)
    { spell: 31850, specs: ['Protection'], category: 'personal' },           // Ardent Defender
    { spell: 86659, specs: ['Protection'], category: 'personal', variants: [212641] }, // Guardian of Ancient Kings
    { spell: 633, category: 'external', variants: [471195], duration: 0 },   // Lay on Hands (os 30s são Forbearance)
    { spell: 6940, category: 'external' },                                   // Blessing of Sacrifice
    { spell: 1022, category: 'external' },                                   // Blessing of Protection
    { spell: 204018, specs: ['Protection'], category: 'external' },          // Blessing of Spellwarding
    { spell: 31821, specs: ['Holy'], category: 'raid' },                     // Aura Mastery
  ],
  Priest: [
    { spell: 19236, category: 'personal' },                                  // Desperate Prayer
    { spell: 586, category: 'personal' },                                    // Fade
    { spell: 47585, specs: ['Shadow'], category: 'personal' },               // Dispersion
    { spell: 33206, specs: ['Discipline'], category: 'external' },           // Pain Suppression
    { spell: 47788, specs: ['Holy'], category: 'external' },                 // Guardian Spirit
    { spell: 62618, specs: ['Discipline'], category: 'raid' },               // Power Word: Barrier
    { spell: 15286, specs: ['Shadow'], category: 'raid' },                   // Vampiric Embrace
  ],
  Rogue: [
    { spell: 31224, category: 'personal' },    // Cloak of Shadows
    { spell: 5277, category: 'personal' },     // Evasion
    { spell: 185311, category: 'personal' },   // Crimson Vial
    { spell: 1966, category: 'personal' },     // Feint
    { spell: 1856, category: 'personal', duration: 3 }, // Vanish (3s sem quebrar stealth)
  ],
  Shaman: [
    { spell: 108271, category: 'personal' },                                 // Astral Shift
    { spell: 98008, specs: ['Restoration'], category: 'raid' },              // Spirit Link Totem
  ],
  Warlock: [
    { spell: 104773, category: 'personal' },   // Unending Resolve
    { spell: 108416, category: 'personal' },   // Dark Pact
  ],
  Warrior: [
    { spell: 118038, specs: ['Arms'], category: 'personal' },                // Die by the Sword
    { spell: 184364, specs: ['Fury'], category: 'personal' },                // Enraged Regeneration
    { spell: 871, specs: ['Protection'], category: 'personal' },             // Shield Wall
    { spell: 23920, category: 'personal' },                                  // Spell Reflection
    { spell: 97462, category: 'raid' },                                      // Rallying Cry
  ],
};

// Consumíveis disponíveis para qualquer classe.
// `items` lista os itens (uma entrada por qualidade/estrela). O gerador lê a cura
// de cada item na Wowhead e ordena: a menor cura é a qualidade 1. No Midnight os
// itens craftados têm 2 qualidades; se um patch voltar a ter 3, basta incluir o item.
export const CONSUMABLES = [
  {
    key: 'health-potion',
    // A primeira é a mais forte do patch; as demais contam como "poção de vida" também
    // (todas dividem o mesmo CD de poção).
    potions: [
      { spell: 1295247, items: [271883, 271884] }, // Concentrated Silvermoon Health Potion (12.1)
      { spell: 1234768, items: [241305, 241304] }, // Silvermoon Health Potion
      { spell: 1262857, items: [] },               // Potent Healing Potion (cura % da vida, sem qualidade)
    ],
  },
  {
    key: 'healthstone',
    potions: [
      { spell: 6262, items: [] },    // Healthstone
      { spell: 452930, items: [] },  // Demonic Healthstone (talento do Warlock)
    ],
  },
];
