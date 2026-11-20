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

// =============================================================================
// Interrupts por classe (usado pelo "kick assign" do Note Timer Checker).
//
//   spell  ID do CAST (o que o jogador aperta). Define nome/ícone/CD.
//   ids    TODOS os IDs que aparecem no log para esse interrupt: o do cast e os do
//          efeito (ex.: Skull Bash casta 106839 mas o evento "interrupt" vem como 93985;
//          Silence 15487 -> 220543; Solar Beam 78675 -> 97547).
//   pet    true se quem executa é o pet (Spell Lock / Axe Toss): o evento vem com o id do
//          pet, ligado ao dono por `friendlyPets.petOwner`.
//   incidental  true = habilidade de dano que só ÀS VEZES interrompe (Avenger's Shield): só conta
//          quando gerou um evento de interrupt; um cast sem interrupt NÃO é kick falho.
//   specs  (opcional) limita a certas specs. Sem isso, vale para toda spec em que a
//          habilidade existir (o gerador consulta a árvore de talentos do patch).
//
// Validação (12.1.5): IDs medidos em ~90 lutas de Venomous Abyss. O Midnight removeu
// interrupts dos healers, exceto o Wind Shear do Resto Shaman — consistente com os logs.
// =============================================================================
export const INTERRUPTS = {
  DeathKnight: [{ spell: 47528, ids: [47528] }],                                   // Mind Freeze
  DemonHunter: [{ spell: 183752, ids: [183752] }],                                 // Disrupt
  Druid: [
    { spell: 106839, ids: [106839, 93985] },                                       // Skull Bash
    { spell: 78675, ids: [78675, 97547] },                                         // Solar Beam
  ],
  Evoker: [{ spell: 351338, ids: [351338] }],                                      // Quell
  Hunter: [
    { spell: 147362, ids: [147362] },                                              // Counter Shot
    { spell: 187707, ids: [187707] },                                              // Muzzle
  ],
  Mage: [{ spell: 2139, ids: [2139] }],                                            // Counterspell
  Monk: [{ spell: 116705, ids: [116705] }],                                        // Spear Hand Strike
  Paladin: [
    { spell: 96231, ids: [96231] },                                                // Rebuke
    { spell: 31935, ids: [31935], specs: ['Protection'], incidental: true },  // Avenger's Shield: dano que às vezes interrompe
  ],
  Priest: [{ spell: 15487, ids: [15487, 220543], specs: ['Shadow'] }],             // Silence (healers perderam interrupt no Midnight)
  Rogue: [{ spell: 1766, ids: [1766] }],                                           // Kick
  Shaman: [{ spell: 57994, ids: [57994] }],                                        // Wind Shear
  Warlock: [
    { spell: 119910, ids: [119910, 19647, 132409, 119898], pet: true },            // Spell Lock / Command Demon (Felhunter)
    { spell: 119914, ids: [119914, 89766], pet: true, specs: ['Demonology'] },     // Axe Toss (Felguard)
  ],
  Warrior: [{ spell: 6552, ids: [6552] }],                                         // Pummel
};

// Grupos de IDs de cast que são a MESMA habilidade para efeito de nota de raid
// (a nota usa um ID, o log pode registrar outro conforme spec/talento). Defensivos
// da lista acima já agrupam suas próprias variantes; aqui entram as demais.
export const CAST_ALIASES = [
  [106898, 77761, 77764],        // Stampeding Roar
  [115310, 388615],              // Revival / Restoral (talento troca)
  [114050, 114051, 114052],      // Ascendance (Elemental / Enhancement / Restoration)
  [110959, 110960],              // Greater Invisibility
  [342245, 342247],              // Alter Time
  [212641, 86659],               // Guardian of Ancient Kings
  [633, 471195],                 // Lay on Hands
  [360995, 361195],              // Verdant Embrace
  [102558, 102560, 102543, 102558], // Incarnations (Guardian / Balance / Feral)
  [6262, 452930, 385898],        // Healthstone / Demonic Healthstone / Soulburn
];

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
