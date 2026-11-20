// Kick assign — cruza as linhas `assign:{ícone} Kick ...` da nota com o que aconteceu no log.
//
// Fontes (todas do Warcraft Logs):
//   - eventos "interrupt": quem interrompeu, qual alvo (id + instância, que separa mobs de mesmo
//     nome), a spell interrompida e o marcador de raid (`targetMarker`) do alvo naquele instante;
//   - eventos "cast" dos interrupts dos jogadores escalados: também trazem alvo e marcador, e
//     revelam kicks que não surtiram efeito (alvo não estava castando / já interrompido).
//   - `friendlyPets.petOwner`: Spell Lock / Axe Toss do warlock são executados pelo pet.
import { incidentalInterruptIds, interruptIdsFor, interruptsFor, type InterruptDef } from '@/lib/defensives';
import {
  RAID_ICON_BY_ID, RAID_ICON_ID, normalizeName,
  type CastRecord, type KickAssign, type RaidIcon, type RosterPlayer,
} from '@/lib/noteTimers';

/** Margem para ligar um cast de kick ao evento de interrupt correspondente. */
const MATCH_WINDOW_MS = 1500;
/** Casts duplicados (cast + efeito do mesmo kick) mais próximos que isso viram um só. */
const DEDUPE_MS = 500;

export interface InterruptRecord {
  sourceID: number;
  t: number;
  spellId: number;
  targetId: number;
  targetInstance: number;
  marker?: number;
  interruptedSpellId?: number;
}

export type KickVerdict = 'on-mark' | 'other-mark' | 'unmarked';

export interface KickAttempt {
  /** Jogador dono (o pet já foi convertido para o dono). */
  playerId: number;
  t: number;
  spellId: number;
  targetId: number;
  targetInstance: number;
  marker?: number;
  icon?: RaidIcon;
  interruptedSpellId?: number;
  /** true = evento de interrupt; false = cast sem interrupt correspondente. */
  success: boolean;
}

export interface PlayerKickReport {
  name: string;
  player?: RosterPlayer;
  assigns: KickAssign[];
  icons: RaidIcon[];
  /** Interrupts que a spec pode ter (vazio => spec sem interrupt neste patch). */
  available: InterruptDef[];
  attempts: (KickAttempt & { verdict: KickVerdict })[];
  counts: { onMark: number; otherMark: number; unmarked: number; noEffect: number };
}

export interface IconSequenceEntry extends KickAttempt {
  n: number;
  /** Quem fez o kick; undefined se o jogador nem está no elenco mapeado. */
  playerName?: string;
  className?: string;
  byAssigned: boolean;
}

export interface IconKickReport {
  icon: RaidIcon;
  marker: number;
  assigned: { name: string; className?: string; marker: boolean; seqs: number[]; present: boolean }[];
  sequence: IconSequenceEntry[];
}

export interface KickReport {
  players: PlayerKickReport[];
  icons: IconKickReport[];
  missingPlayers: string[];
  /** Quantos kicks marcados foram feitos / quantos por escalados. */
  totals: { markedKicks: number; byAssigned: number; byOthers: number };
}

/** IDs de log dos interrupts dos jogadores escalados — acrescentados ao filtro de casts. */
export function kickCastIds(kicks: KickAssign[], roster: RosterPlayer[]): number[] {
  const names = new Set(kicks.map((k) => normalizeName(k.name)));
  const ids = new Set<number>();
  for (const p of roster) {
    if (names.has(normalizeName(p.name))) interruptIdsFor(p.className, p.specId).forEach((id) => ids.add(id));
  }
  return [...ids];
}

export function evaluateKicks(
  kicks: KickAssign[],
  roster: RosterPlayer[],
  pets: Record<number, number>,
  casts: CastRecord[],
  interrupts: InterruptRecord[],
): KickReport {
  const owner = (id: number) => pets[id] ?? id;
  const playerById = new Map(roster.map((p) => [p.id, p]));
  const markerToIcon = (m?: number) => (m ? RAID_ICON_BY_ID[m] : undefined);

  // --- tentativas de kick de todo o elenco -----------------------------------
  const attempts: KickAttempt[] = interrupts.map((e) => ({
    playerId: owner(e.sourceID), t: e.t, spellId: e.spellId, targetId: e.targetId, targetInstance: e.targetInstance,
    marker: e.marker, icon: markerToIcon(e.marker), interruptedSpellId: e.interruptedSpellId, success: true,
  }));

  const usedInterrupts = new Set<InterruptRecord>();
  const kickIdsByPlayer = new Map<number, Set<number>>();
  const idsFor = (playerId: number) => {
    let s = kickIdsByPlayer.get(playerId);
    if (!s) {
      const p = playerById.get(playerId);
      s = new Set(p ? interruptIdsFor(p.className, p.specId) : []);
      kickIdsByPlayer.set(playerId, s);
    }
    return s;
  };

  // Kick sem efeito só é conhecido para quem foi escalado (só baixamos os casts deles).
  const assignedNames = new Set(kicks.map((x) => normalizeName(x.name)));
  const assignedIds = new Set(roster.filter((p) => assignedNames.has(normalizeName(p.name))).map((p) => p.id));
  const incidental = incidentalInterruptIds();
  const sortedCasts = casts
    .filter((c) => (c.targetId ?? -1) > 0 && !incidental.has(c.spellId) && idsFor(owner(c.sourceID)).has(c.spellId))
    .sort((a, b) => a.t - b.t);
  const lastCast = new Map<string, number>();
  for (const c of sortedCasts) {
    const pid = owner(c.sourceID);
    const key = `${pid}:${c.targetId}:${c.targetInstance ?? 0}`;
    const prev = lastCast.get(key);
    lastCast.set(key, c.t);
    if (prev !== undefined && c.t - prev < DEDUPE_MS) continue; // cast + efeito do mesmo kick

    const hit = interrupts.find((e) =>
      !usedInterrupts.has(e) && owner(e.sourceID) === pid && e.targetId === c.targetId
      && e.targetInstance === (c.targetInstance ?? e.targetInstance) && Math.abs(e.t - c.t) <= MATCH_WINDOW_MS);
    if (hit) { usedInterrupts.add(hit); continue; } // já contado como sucesso
    if (!assignedIds.has(pid)) continue;
    attempts.push({
      playerId: pid, t: c.t, spellId: c.spellId, targetId: c.targetId!, targetInstance: c.targetInstance ?? 0,
      marker: c.targetMarker, icon: markerToIcon(c.targetMarker), success: false,
    });
  }
  attempts.sort((a, b) => a.t - b.t);

  // --- por jogador escalado ---------------------------------------------------
  const byName = new Map<string, KickAssign[]>();
  for (const k of kicks) byName.set(normalizeName(k.name), [...(byName.get(normalizeName(k.name)) ?? []), k]);
  const rosterByName = new Map(roster.map((p) => [normalizeName(p.name), p]));

  const players: PlayerKickReport[] = [];
  const missing: string[] = [];
  for (const [norm, assigns] of byName) {
    const player = rosterByName.get(norm);
    const name = assigns[0].name;
    if (!player) { missing.push(name); continue; }
    const icons = [...new Set(assigns.map((a) => a.icon))];
    const markers = new Set(icons.map((i) => RAID_ICON_ID[i]));
    const mine = attempts
      .filter((a) => a.playerId === player.id)
      .map((a) => ({ ...a, verdict: (a.marker && markers.has(a.marker) ? 'on-mark' : a.marker ? 'other-mark' : 'unmarked') as KickVerdict }));
    players.push({
      name: player.name, player, assigns, icons,
      available: interruptsFor(player.className, player.specId),
      attempts: mine,
      counts: {
        onMark: mine.filter((a) => a.success && a.verdict === 'on-mark').length,
        otherMark: mine.filter((a) => a.success && a.verdict === 'other-mark').length,
        unmarked: mine.filter((a) => a.success && a.verdict === 'unmarked').length,
        noEffect: mine.filter((a) => !a.success).length,
      },
    });
  }
  players.sort((a, b) => a.icons[0].localeCompare(b.icons[0]) || a.name.localeCompare(b.name));

  // --- por ícone: sequência de kicks naquela marca, de quem for -----------------
  const iconSet = [...new Set(kicks.map((k) => k.icon))];
  let markedKicks = 0;
  let byAssigned = 0;
  const icons: IconKickReport[] = iconSet.map((icon) => {
    const marker = RAID_ICON_ID[icon];
    const assignedAssigns = kicks.filter((k) => k.icon === icon);
    const assignedNames = new Set(assignedAssigns.map((k) => normalizeName(k.name)));
    const assigned = [...assignedNames].map((n) => {
      const list = assignedAssigns.filter((k) => normalizeName(k.name) === n);
      return {
        name: list[0].name,
        className: rosterByName.get(n)?.className,
        marker: list.some((k) => k.marker),
        seqs: list.map((k) => k.seq).filter((s): s is number => s !== undefined),
        present: rosterByName.has(n),
      };
    });
    const sequence = attempts.filter((a) => a.marker === marker).map((a, i): IconSequenceEntry => {
      const p = playerById.get(a.playerId);
      const isAssigned = !!p && assignedNames.has(normalizeName(p.name));
      if (a.success) { markedKicks++; if (isAssigned) byAssigned++; }
      return { ...a, n: i + 1, playerName: p?.name, className: p?.className, byAssigned: isAssigned };
    });
    return { icon, marker, assigned, sequence };
  });

  return { players, icons, missingPlayers: missing, totals: { markedKicks, byAssigned, byOthers: markedKicks - byAssigned } };
}
