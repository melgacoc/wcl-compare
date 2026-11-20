// Resolve, para um jogador específico de um log, quais defensivos ele realmente
// tinha (de acordo com os talentos do CombatantInfo), qual variante da spell
// (ex.: Ice Block x Ice Cold), CD/cargas ajustados por talento e o estado de
// cada um no momento da morte.
//
// Os dados vêm de src/data/defensives.generated.json — gerado por
// `npm run update:defensives`. Nada aqui é específico de patch.
import generated from '@/data/defensives.generated.json';

// ----------------------------------------------------------------------------- tipos dos dados gerados
type SpecId = string; // chaves de JSON são strings

interface Gate { entries: number[]; free: boolean; maxRanks: number }
interface Mod { talent: number; name?: string; cooldownDelta: number; chargesDelta: number; gate: Record<SpecId, Gate> }
interface Option {
  spell: number;
  base: boolean;
  gate?: Record<SpecId, Gate>;
  castOnly?: boolean;
  requires?: Record<SpecId, Gate>;
  mods?: Mod[];
}
interface DefensiveDef {
  key: string;
  className: string;
  specs: number[];
  category: 'personal' | 'external' | 'raid';
  durationOverride?: number;
  options: Option[];
}
interface SpellInfo { id: number; name: string; icon: string; cooldown: number; charges: number; duration: number }
interface PotionTier { itemId: number; heal: number; quality: number }
interface ConsumableDef { key: string; potions: { spell: number; tiers: PotionTier[] }[] }

interface GeneratedData {
  meta: { wowBuild: string; environment: string; generatedAt: string };
  specs: Record<SpecId, { className: string; specName: string }>;
  spells: Record<string, SpellInfo>;
  defensives: DefensiveDef[];
  consumables: ConsumableDef[];
}

const DATA = generated as unknown as GeneratedData;
export const DEFENSIVES_BUILD = DATA.meta.wowBuild;

// ----------------------------------------------------------------------------- tipos públicos
export interface CastEvent { timestamp: number; abilityGameID: number; type?: string }
export interface HealEvent { timestamp: number; abilityGameID: number; amount?: number; overheal?: number; absorbed?: number; type?: string }

/** Talentos de um jogador: entry id do talento -> rank escolhido. */
export type PlayerTalents = Map<number, number>;

export type DefensiveStatus = 'AVAILABLE' | 'ON_COOLDOWN' | 'ACTIVE';

export interface ResolvedDefensive {
  key: string;
  category: DefensiveDef['category'];
  /** Variante escolhida (ex.: Ice Cold no lugar de Ice Block). */
  spell: SpellInfo;
  /** Todos os IDs de cast que contam como esta habilidade. */
  castIds: number[];
  cooldown: number;
  charges: number;
  duration: number;
  /** Como sabemos que o jogador tinha a habilidade. */
  source: 'baseline' | 'talent' | 'cast' | 'assumed';
  /** Talentos que alteraram CD/cargas (para exibir). */
  appliedMods: { name: string; cooldownDelta: number; chargesDelta: number; rank: number }[];
  /** Variante diferente da base, para exibir "Ice Block → Ice Cold". */
  replaces?: string;
}

export interface DefensiveAtDeath extends ResolvedDefensive {
  status: DefensiveStatus;
  chargesLeft: number;
  /** Segundos até a próxima carga, se em CD. */
  readyIn?: number;
  lastCast?: number;
  usesBeforeDeath: number;
  /** O jogador usou mais vezes do que o CD modelado permite (há redução de CD não modelada). */
  cooldownUncertain: boolean;
}

// ----------------------------------------------------------------------------- specs e talentos
const specIdByName = new Map<string, number>(
  Object.entries(DATA.specs).map(([id, s]) => [`${s.className}-${s.specName}`, Number(id)]),
);

/** "Mage" + "Arcane" -> 62. Aceita também o ícone do WCL ("Mage-Arcane"). */
export function getSpecId(className: string, specName?: string): number | undefined {
  if (!specName) return undefined;
  const key = specName.includes('-') ? specName : `${className}-${specName}`;
  return specIdByName.get(key.replace(/\s+/g, ''));
}

export function spellName(spellId: number): string | undefined {
  return DATA.spells[String(spellId)]?.name;
}

export function getSpecInfo(specId: number) {
  return DATA.specs[String(specId)];
}

/** Extrai os talentos do evento CombatantInfo do Warcraft Logs. */
export function parseTalents(combatantInfo: { talentTree?: { id: number; rank: number }[] } | undefined): PlayerTalents | null {
  if (!combatantInfo?.talentTree?.length) return null;
  const map: PlayerTalents = new Map();
  for (const t of combatantInfo.talentTree) if (t.rank > 0) map.set(t.id, t.rank);
  return map;
}

/**
 * true/false se sabemos; null se não dá pra saber (sem talentos no log).
 * `absent` decide o que vale quando o talento nem existe na árvore desta spec:
 *  - 'baseline' para a habilidade em si (não é talento => todo mundo tem);
 *  - 'missing' para modificadores e variantes (não existe => não se aplica).
 */
function hasGate(
  gate: Record<SpecId, Gate> | undefined,
  specId: number,
  talents: PlayerTalents | null,
  absent: 'baseline' | 'missing' = 'baseline',
): { ok: boolean | null; rank: number } {
  const g = gate?.[String(specId)];
  if (!g) return absent === 'baseline' ? { ok: true, rank: 1 } : { ok: false, rank: 0 };
  if (g.free) return { ok: true, rank: g.maxRanks };
  if (!talents) return { ok: null, rank: 0 };
  const rank = Math.max(0, ...g.entries.map((e) => talents.get(e) ?? 0));
  return { ok: rank > 0, rank };
}

// ----------------------------------------------------------------------------- resolução
export function resolveDefensives(
  className: string,
  specId: number | undefined,
  talents: PlayerTalents | null,
  casts: CastEvent[],
): ResolvedDefensive[] {
  if (!specId) return [];
  const castSet = new Set(casts.filter((c) => !c.type || c.type === 'cast').map((c) => c.abilityGameID));
  const result: ResolvedDefensive[] = [];

  for (const def of DATA.defensives) {
    if (def.className !== className || !def.specs.includes(specId)) continue;

    // 1) evidência no log: a última variante usada vence
    const castOpt = [...def.options].reverse().find((o) => castSet.has(o.spell));
    // 2) talentos: variante cujo talento (ou requisito) está selecionado
    const talentOpt = def.options.find((o) => !o.base && !o.castOnly
      && hasGate(o.requires ?? o.gate, specId, talents, 'missing').ok === true);
    const base = def.options.find((o) => o.base);

    let chosen: Option | undefined;
    let source: ResolvedDefensive['source'];
    if (castOpt) { chosen = castOpt; source = 'cast'; }
    else if (talentOpt) { chosen = talentOpt; source = 'talent'; }
    else if (base) {
      const g = hasGate(base.gate, specId, talents);
      if (g.ok === false) continue;           // talento não escolhido => não tinha
      chosen = base;
      source = g.ok === null ? 'assumed' : base.gate?.[String(specId)] ? 'talent' : 'baseline';
    } else continue;

    const spell = DATA.spells[String(chosen.spell)];
    if (!spell) continue;

    let cooldown = spell.cooldown;
    let charges = spell.charges;
    const appliedMods: ResolvedDefensive['appliedMods'] = [];
    for (const m of chosen.mods ?? []) {
      const g = hasGate(m.gate, specId, talents, 'missing');
      if (g.ok !== true) continue;
      // A Wowhead mostra o efeito do rank 1; talentos com vários ranks escalam linearmente.
      const rank = Math.max(1, g.rank);
      cooldown += m.cooldownDelta * rank;
      charges += m.chargesDelta * rank;
      appliedMods.push({ name: m.name ?? `Talento ${m.talent}`, cooldownDelta: m.cooldownDelta * rank, chargesDelta: m.chargesDelta * rank, rank });
    }

    const baseSpell = base ? DATA.spells[String(base.spell)] : undefined;
    result.push({
      key: def.key,
      category: def.category,
      spell,
      castIds: def.options.map((o) => o.spell),
      cooldown: Math.max(0, cooldown),
      charges: Math.max(1, charges),
      duration: def.durationOverride ?? spell.duration,
      source,
      appliedMods,
      replaces: baseSpell && baseSpell.id !== spell.id && baseSpell.name !== spell.name ? baseSpell.name : undefined,
    });
  }
  return result;
}

/** IDs de cast de todos os defensivos de uma classe/spec (para o Note Timer Checker). */
export function defensiveCastIds(className: string, specId: number | undefined): number[] {
  if (!specId) return [];
  return DATA.defensives
    .filter((d) => d.className === className && d.specs.includes(specId))
    .flatMap((d) => d.options.map((o) => o.spell));
}

// ----------------------------------------------------------------------------- estado na hora da morte
/** Simula cargas/recarga até `atTimestamp`. */
export function statusAt(def: ResolvedDefensive, casts: CastEvent[], atTimestamp: number): DefensiveAtDeath {
  const ids = new Set(def.castIds);
  const uses = casts
    .filter((c) => ids.has(c.abilityGameID) && (!c.type || c.type === 'cast') && c.timestamp <= atTimestamp)
    .map((c) => c.timestamp)
    .sort((a, b) => a - b);

  const cdMs = def.cooldown * 1000;
  let available = def.charges;
  let rechargeEnd: number | null = null;
  let uncertain = false;

  const advance = (t: number) => {
    while (rechargeEnd !== null && rechargeEnd <= t) {
      available++;
      rechargeEnd = available < def.charges ? rechargeEnd + cdMs : null;
    }
  };

  for (const t of uses) {
    advance(t);
    if (available <= 0) {
      // Usou antes do CD modelado acabar: existe redução de CD que não modelamos
      // (procs, resets, CDR por recurso...). Reinicia a recarga a partir daqui.
      uncertain = true;
      available = 1;
      rechargeEnd = null;
    }
    available--;
    if (rechargeEnd === null && cdMs > 0) rechargeEnd = t + cdMs;
    if (cdMs === 0) available = def.charges;
  }
  advance(atTimestamp);

  const lastCast = uses[uses.length - 1];
  let status: DefensiveStatus = available > 0 ? 'AVAILABLE' : 'ON_COOLDOWN';
  if (lastCast !== undefined && def.duration > 0 && atTimestamp - lastCast <= def.duration * 1000) status = 'ACTIVE';

  return {
    ...def,
    status,
    chargesLeft: available,
    readyIn: available <= 0 && rechargeEnd !== null ? Math.max(0, (rechargeEnd - atTimestamp) / 1000) : undefined,
    lastCast,
    usesBeforeDeath: uses.length,
    cooldownUncertain: uncertain,
  };
}

// ----------------------------------------------------------------------------- consumíveis
export interface PotionUse {
  timestamp: number;
  spell: SpellInfo;
  /** Cura bruta observada (efetiva + overheal + absorvida). */
  rawHeal: number;
  /** Qualidade (estrelas) estimada; undefined se a poção não tem qualidade. */
  quality?: number;
  maxQuality?: number;
  /**
   * A cura veio com bônus (talentos/buffs de cura): uma qualidade menor com bônus
   * fica igual a uma maior, então a estrela é estimada.
   */
  approximate: boolean;
  /** Cura muito abaixo de qualquer qualidade (debuff de redução/absorção de cura): qualidade desconhecida. */
  reduced?: boolean;
}

export interface ConsumableAtDeath {
  key: string;
  /** Spell exibida: a usada no log ou, se nenhuma, a mais forte do patch. */
  spell: SpellInfo;
  castIds: number[];
  status: DefensiveStatus;
  readyIn?: number;
  uses: PotionUse[];
}

export function consumableSpellIds(key: string): number[] {
  return DATA.consumables.find((c) => c.key === key)?.potions.map((p) => p.spell) ?? [];
}

export function allConsumableSpellIds(): number[] {
  return DATA.consumables.flatMap((c) => c.potions.map((p) => p.spell));
}

// Calibrado com logs do 12.1.5: sem bônus, a cura observada fica ~96% do valor do
// tooltip (ex.: 403.6k para a Q2 de 421.2k). Bônus de cura só aumentam o valor.
const POTION_FLOOR = 0.93;   // abaixo disso, não é esta qualidade (sem debuff)
const POTION_EXACT = 1.04;   // até aqui, a cura bate com a qualidade sem bônus
const POTION_REDUCED = 0.8;  // muito abaixo da menor qualidade: cura reduzida por debuff

/**
 * Estima a qualidade (estrelas) pela cura bruta (efetiva + overheal + absorvida).
 * Escolhe a maior qualidade cuja cura base o valor observado alcança.
 */
export function classifyPotionQuality(spellId: number, rawHeal: number): Pick<PotionUse, 'quality' | 'maxQuality' | 'approximate' | 'reduced'> {
  const tiers = [...(DATA.consumables.flatMap((c) => c.potions).find((p) => p.spell === spellId)?.tiers ?? [])]
    .sort((a, b) => a.heal - b.heal);
  if (!tiers.length || rawHeal <= 0) return { approximate: false };
  const maxQuality = tiers.length;

  let pick: PotionTier | undefined;
  for (const t of tiers) if (rawHeal >= t.heal * POTION_FLOOR) pick = t;

  if (!pick) {
    if (rawHeal < tiers[0].heal * POTION_REDUCED) return { maxQuality, approximate: true, reduced: true };
    return { quality: tiers[0].quality, maxQuality, approximate: true };
  }
  const buffed = rawHeal > pick.heal * POTION_EXACT;
  // Com bônus, só há ambiguidade se existir uma qualidade menor que poderia ter chegado aqui.
  return { quality: pick.quality, maxQuality, approximate: buffed && pick !== tiers[0] };
}

export function consumablesAt(casts: CastEvent[], heals: HealEvent[], atTimestamp: number): ConsumableAtDeath[] {
  const result: ConsumableAtDeath[] = [];
  for (const c of DATA.consumables) {
    const ids = c.potions.map((p) => p.spell);
    const idSet = new Set(ids);
    const castTimes = casts
      .filter((e) => idSet.has(e.abilityGameID) && (!e.type || e.type === 'cast') && e.timestamp <= atTimestamp)
      .sort((a, b) => a.timestamp - b.timestamp);

    const uses: PotionUse[] = castTimes.map((cast) => {
      const spell = DATA.spells[String(cast.abilityGameID)];
      // A cura chega junto do cast — às vezes 1 ms ANTES dele no log.
      const heal = heals.find((h) => h.abilityGameID === cast.abilityGameID
        && (!h.type || h.type === 'heal') && h.timestamp - cast.timestamp >= -100 && h.timestamp - cast.timestamp < 1000);
      const rawHeal = heal ? (heal.amount ?? 0) + (heal.overheal ?? 0) + (heal.absorbed ?? 0) : 0;
      return { timestamp: cast.timestamp, spell, rawHeal, ...classifyPotionQuality(cast.abilityGameID, rawHeal) };
    });

    const last = uses[uses.length - 1];
    const shown = last?.spell ?? DATA.spells[String(ids[0])];
    if (!shown) continue;
    let status: DefensiveStatus = 'AVAILABLE';
    let readyIn: number | undefined;
    if (last) {
      const elapsed = (atTimestamp - last.timestamp) / 1000;
      if (elapsed < shown.cooldown) { status = 'ON_COOLDOWN'; readyIn = shown.cooldown - elapsed; }
    }
    result.push({ key: c.key, spell: shown, castIds: ids, status, readyIn, uses });
  }
  return result;
}
