// Note Timer Checker — lógica pura (sem React/API):
//   1) parseNote:   extrai da nota (formato MRT/ExRT) só as linhas que são timers de habilidade;
//   2) planChecks:  decide quem precisa ser verificado em cada timer e quais spells baixar;
//   3) evaluate:    casa os casts do log com os timers (margem para mais e para menos).
//
// Tudo que na nota serve a addons/posicionamento/mecânicas (text:, assign:, invitelist,
// blocos "intstart", etc.) é descartado: só interessa linha `time:` com `spellid:` ou
// com um texto que peça CD pessoal.
import {
  allPersonalDefensiveIds, castGroup, classesWithSpell, consumableKind, defensiveCastIds, getSpecId,
} from '@/lib/defensives';

export const DEFAULT_TOLERANCE_S = 10;
/** Um cast fora da margem só é citado se estiver a até esse tempo do timer. */
export const NEAR_CAST_LIMIT_S = 120;

// ----------------------------------------------------------------------------- tipos
export type TimerKind = 'spell' | 'personal-defensive';

export interface NoteTimer {
  id: string;            // estável: "<linha>"
  line: number;          // nº da linha na nota (1-based)
  time: number;          // segundos desde o início da fase
  phase: number;
  kind: TimerKind;
  spellId?: number;      // só para kind 'spell'
  /** Nomes de jogador (normalizados na comparação) ou 'everyone'. */
  targets: string[] | 'everyone';
  /** Texto original da linha, para exibir/depurar. */
  raw: string;
}

export type RaidIcon = 'star' | 'circle' | 'diamond' | 'triangle' | 'moon' | 'square' | 'cross' | 'skull';

/** Número do marcador de raid, como o WCL o grava em `targetMarker`. */
export const RAID_ICON_ID: Record<RaidIcon, number> = {
  star: 1, circle: 2, diamond: 3, triangle: 4, moon: 5, square: 6, cross: 7, skull: 8,
};
export const RAID_ICON_BY_ID = Object.fromEntries(Object.entries(RAID_ICON_ID).map(([k, v]) => [v, k])) as Record<number, RaidIcon>;

/** `tag:Jogador;assign:{moon} Kick and mark add #1;` — quem deve interromper o alvo marcado. */
export interface KickAssign {
  id: string;
  line: number;
  /** Jogador (um por linha; tags com vários nomes viram várias entradas). */
  name: string;
  icon: RaidIcon;
  /** "Kick and mark add": quem marca o alvo e dá o primeiro kick. */
  marker: boolean;
  /** Número do kick (#1, #2...), se houver. */
  seq?: number;
  raw: string;
}

export interface ParsedNote {
  encounter?: { id?: number; name?: string; difficulty?: string };
  timers: NoteTimer[];
  kicks: KickAssign[];
  totalLines: number;
  timerLines: number;
  kickLines: number;
  ignoredLines: number;
}

export interface RosterPlayer {
  id: number;
  name: string;
  className: string;   // formato WCL: "DeathKnight"
  specName: string;    // "Blood"
  specId?: number;
  role: 'tank' | 'healer' | 'dps';
}

export interface CastRecord {
  sourceID: number;
  /** ms desde o início da luta. */
  t: number;
  spellId: number;
  /** Alvo e marcador de raid do alvo no instante do cast (quando o log os traz). */
  targetId?: number;
  targetInstance?: number;
  targetMarker?: number;
}

export type CheckStatus =
  | 'used'          // cast dentro da margem
  | 'outside'       // houve cast, mas fora da margem
  | 'missed'        // nenhum cast
  | 'dead'          // morreu antes do timer
  | 'after-end';    // o timer é depois do fim da luta

export interface TimerCheck {
  timer: NoteTimer;
  /** Momento ideal (ms desde o início da luta). */
  targetMs: number;
  status: CheckStatus;
  /** Cast associado (dentro ou fora da margem). */
  cast?: { t: number; spellId: number; offsetMs: number };
  deathMs?: number;
}

export interface PlayerReport {
  player: RosterPlayer;
  checks: TimerCheck[];
}

export interface CheckPlan {
  /** Linhas por jogador presente na luta. */
  assignments: { player: RosterPlayer; timers: NoteTimer[] }[];
  /** Nomes citados na nota que não estavam na luta. */
  missingPlayers: string[];
  /** IDs de cast a pedir à API (já com variantes). Vazio = nada a baixar. */
  castIds: number[];
  /** spellIds citados explicitamente na nota (para buscar nome/ícone). */
  noteSpellIds: number[];
}

// ----------------------------------------------------------------------------- utilidades
export const normalizeName = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/-.+$/, '').trim().toLowerCase();

function parseTime(v: string): number | null {
  const t = v.trim();
  const mmss = /^(\d+):(\d{1,2}(?:\.\d+)?)$/.exec(t);
  if (mmss) return Number(mmss[1]) * 60 + Number(mmss[2]);
  const n = Number(t);
  return Number.isFinite(n) && t !== '' ? n : null;
}

const PERSONAL_CD_TEXT = /\b(?:cds?|cooldowns?|defensivos?|defensives?)\s+(?:pessoa(?:l|is)|personal)\b|\bpersonal\s+(?:cds?|cooldowns?|defensives?)\b|\bpessoal\s+(?:cd|defensivo)\b/i;
const EVERYONE = new Set(['everyone', 'all', 'todos', 'raid']);

// ----------------------------------------------------------------------------- 1) parser
const ICON_TOKEN = /\{(star|circle|diamond|triangle|moon|square|cross|skull|x|rt([1-8]))\}/i;
const ICON_BY_RT = Object.keys(RAID_ICON_ID) as RaidIcon[];
const KICK_TEXT = /\b(?:kicks?|interrupts?|interromp\w*|quebr\w*)\b/i;

/** Lê "assign:{moon} Kick and mark add #1" -> ícone, se marca e nº do kick; null se não for um kick. */
function parseKickAssign(assign: string): { icon: RaidIcon; marker: boolean; seq?: number } | null {
  const m = ICON_TOKEN.exec(assign);
  if (!m || !KICK_TEXT.test(assign)) return null;
  const token = m[1].toLowerCase();
  const icon: RaidIcon = m[2] ? ICON_BY_RT[Number(m[2]) - 1] : token === 'x' ? 'cross' : (token as RaidIcon);
  const seq = /#\s*(\d+)/.exec(assign)?.[1];
  return { icon, marker: /\bmark/i.test(assign), seq: seq ? Number(seq) : undefined };
}

export function parseNote(text: string): ParsedNote {
  const lines = text.split(/\r?\n/);
  const timers: NoteTimer[] = [];
  const kicks: KickAssign[] = [];
  let encounter: ParsedNote['encounter'];
  let timerLines = 0;
  let kickLines = 0;
  let nonEmpty = 0;

  lines.forEach((rawLine, i) => {
    const line = rawLine.trim();
    if (!line) return;
    nonEmpty++;

    if (/^EncounterID:/i.test(line)) {
      const f = parseFields(line);
      encounter = { id: Number(f.encounterid) || undefined, name: f.name, difficulty: f.difficulty };
      return;
    }
    if (!/^time:/i.test(line)) {
      // `tag:Nome;assign:{ícone} Kick ...` é o único assign que nos interessa.
      if (/^tag:/i.test(line)) {
        const f = parseFields(line);
        const kick = f.assign ? parseKickAssign(f.assign) : null;
        if (kick) {
          kickLines++;
          (f.tag ?? '').split(/\s+/).filter(Boolean).forEach((name) =>
            kicks.push({ id: `${i + 1}:${name}`, line: i + 1, name, ...kick, raw: line }));
        }
      }
      return; // blocos de texto, invitelist, intstart... não são timers
    }

    const f = parseFields(line);
    const time = parseTime(f.time ?? '');
    if (time === null) return;
    const tag = (f.tag ?? '').trim();
    if (!tag) return;
    const targets: NoteTimer['targets'] = tag.split(/\s+/).some((t) => EVERYONE.has(t.toLowerCase()))
      ? 'everyone'
      : tag.split(/\s+/).filter(Boolean);
    const phase = Number(f.ph) || 1;

    const spellId = Number(f.spellid);
    if (spellId > 0) {
      timers.push({ id: String(i + 1), line: i + 1, time, phase, kind: 'spell', spellId, targets, raw: line });
      timerLines++;
    } else if (f.text && PERSONAL_CD_TEXT.test(f.text)) {
      timers.push({ id: String(i + 1), line: i + 1, time, phase, kind: 'personal-defensive', targets, raw: line });
      timerLines++;
    }
  });

  timers.sort((a, b) => a.phase - b.phase || a.time - b.time || a.line - b.line);
  return {
    encounter, timers, kicks, totalLines: nonEmpty, timerLines, kickLines,
    ignoredLines: nonEmpty - timerLines - kickLines - (encounter ? 1 : 0),
  };
}

function parseFields(line: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of line.split(';')) {
    const idx = part.indexOf(':');
    if (idx < 0) continue;
    out[part.slice(0, idx).trim().toLowerCase()] = part.slice(idx + 1).trim();
  }
  return out;
}

// ----------------------------------------------------------------------------- 2) plano
/** Spells aceitas para um timer, já considerando variantes e a classe/spec do jogador. */
function acceptedSpells(timer: NoteTimer, player: RosterPlayer): number[] {
  if (timer.kind === 'personal-defensive') return defensiveCastIds(player.className, player.specId, ['personal']);
  return castGroup(timer.spellId!);
}

/** O timer (de 'everyone') se aplica a este jogador? Spells de classe só valem para quem as tem. */
function appliesToPlayer(timer: NoteTimer, player: RosterPlayer): boolean {
  if (timer.targets !== 'everyone') return timer.targets.some((n) => normalizeName(n) === normalizeName(player.name));
  if (timer.kind === 'personal-defensive' || consumableKind(timer.spellId!)) return true;
  const owners = classesWithSpell(timer.spellId!);
  if (!owners.length) return true; // spell fora da nossa lista de classes: não dá para restringir
  return owners.some((o) => o.className === player.className && (!player.specId || o.specs.includes(player.specId)));
}

export function planChecks(parsed: ParsedNote, roster: RosterPlayer[]): CheckPlan {
  const assignments = roster
    .map((player) => ({ player, timers: parsed.timers.filter((t) => appliesToPlayer(t, player)) }))
    .filter((a) => a.timers.length > 0);

  const rosterNames = new Set(roster.map((p) => normalizeName(p.name)));
  const missing = new Set<string>();
  for (const t of parsed.timers) {
    if (t.targets === 'everyone') continue;
    for (const n of t.targets) if (!rosterNames.has(normalizeName(n))) missing.add(n);
  }

  // Filtro enxuto para a API: só o que algum timer realmente precisa.
  const ids = new Set<number>();
  for (const { player, timers } of assignments) {
    for (const t of timers) acceptedSpells(t, player).forEach((id) => ids.add(id));
  }
  const noteSpellIds = [...new Set(parsed.timers.filter((t) => t.spellId).map((t) => t.spellId!))];
  return { assignments, missingPlayers: [...missing], castIds: [...ids], noteSpellIds };
}

/** Pontos de filtro "ability.id IN (...)" para a API do WCL. */
export const castFilterExpression = (ids: number[]) => `type = 'cast' and ability.id in (${ids.join(',')})`;

export { allPersonalDefensiveIds, getSpecId };

// ----------------------------------------------------------------------------- 3) avaliação
export interface FightContext {
  durationMs: number;
  /** Início de cada fase (ms desde o início da luta), indexado pelo nº da fase da nota. */
  phaseStartMs: Record<number, number>;
  /** Morte de cada jogador (ms desde o início da luta), por id de ator. */
  deaths: Record<number, number>;
}

/** Converte o tempo da nota (relativo à fase) para ms desde o início da luta; null se a fase não é conhecida. */
export function timerToFightMs(timer: NoteTimer, fight: FightContext): number | null {
  const base = timer.phase === 1 ? 0 : fight.phaseStartMs[timer.phase];
  if (base === undefined) return null;
  return base + timer.time * 1000;
}

export function evaluate(
  plan: CheckPlan,
  casts: CastRecord[],
  fight: FightContext,
  toleranceS: number,
): { reports: PlayerReport[]; unmappedPhaseTimers: NoteTimer[] } {
  const windowMs = toleranceS * 1000;
  const unmapped = new Map<string, NoteTimer>();
  const reports: PlayerReport[] = [];

  for (const { player, timers } of plan.assignments) {
    const mine = casts.filter((c) => c.sourceID === player.id).sort((a, b) => a.t - b.t);
    const deathMs = fight.deaths[player.id];
    const checks: TimerCheck[] = [];

    // Cada cast só pode "pagar" um timer: agrupa timers equivalentes (mesmas spells aceitas).
    const groups = new Map<string, NoteTimer[]>();
    for (const t of timers) {
      const key = acceptedSpells(t, player).slice().sort((a, b) => a - b).join(',') || `none:${t.id}`;
      groups.set(key, [...(groups.get(key) ?? []), t]);
    }

    for (const [key, group] of groups) {
      const accepted = new Set(key.startsWith('none:') ? [] : key.split(',').map(Number));
      const groupCasts = mine.filter((c) => accepted.has(c.spellId));
      const used = new Set<CastRecord>();
      const pending: TimerCheck[] = [];

      const withTarget = group
        .map((timer) => ({ timer, targetMs: timerToFightMs(timer, fight) }))
        .filter((x): x is { timer: NoteTimer; targetMs: number } => {
          if (x.targetMs === null) unmapped.set(x.timer.id, x.timer);
          return x.targetMs !== null;
        })
        .sort((a, b) => a.targetMs - b.targetMs);

      // passo 1: casts dentro da margem (o mais próximo livre)
      for (const { timer, targetMs } of withTarget) {
        if (targetMs > fight.durationMs) { checks.push({ timer, targetMs, status: 'after-end' }); continue; }
        let best: CastRecord | undefined;
        for (const c of groupCasts) {
          if (used.has(c) || Math.abs(c.t - targetMs) > windowMs) continue;
          if (!best || Math.abs(c.t - targetMs) < Math.abs(best.t - targetMs)) best = c;
        }
        if (best) {
          used.add(best);
          checks.push({ timer, targetMs, status: 'used', cast: { t: best.t, spellId: best.spellId, offsetMs: best.t - targetMs } });
        } else pending.push({ timer, targetMs, status: 'missed' });
      }

      // passo 2: o que sobrou — cast fora da margem (informativo), morte ou nada
      for (const p of pending) {
        let near: CastRecord | undefined;
        for (const c of groupCasts) {
          if (used.has(c) || Math.abs(c.t - p.targetMs) > NEAR_CAST_LIMIT_S * 1000) continue;
          if (!near || Math.abs(c.t - p.targetMs) < Math.abs(near.t - p.targetMs)) near = c;
        }
        if (near) {
          used.add(near);
          checks.push({ ...p, status: 'outside', cast: { t: near.t, spellId: near.spellId, offsetMs: near.t - p.targetMs } });
        } else if (deathMs !== undefined && deathMs < p.targetMs - windowMs) {
          checks.push({ ...p, status: 'dead', deathMs });
        } else checks.push(p);
      }
    }

    checks.sort((a, b) => a.targetMs - b.targetMs || a.timer.line - b.timer.line);
    reports.push({ player, checks });
  }

  const roleOrder = { tank: 0, healer: 1, dps: 2 } as const;
  reports.sort((a, b) => roleOrder[a.player.role] - roleOrder[b.player.role] || a.player.name.localeCompare(b.player.name));
  return { reports, unmappedPhaseTimers: [...unmapped.values()] };
}

export function summarize(reports: PlayerReport[]) {
  const s = { total: 0, used: 0, outside: 0, missed: 0, dead: 0, afterEnd: 0 };
  for (const r of reports) for (const c of r.checks) {
    if (c.status === 'after-end') { s.afterEnd++; continue; }
    s.total++;
    if (c.status === 'used') s.used++;
    else if (c.status === 'outside') s.outside++;
    else if (c.status === 'dead') s.dead++;
    else s.missed++;
  }
  return s;
}
