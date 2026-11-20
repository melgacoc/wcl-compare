import { useEffect, useMemo, useState } from 'react';
import { useApolloClient } from '@apollo/client/react';
import { GET_NOTE_TIMER_FIGHT, GET_NOTE_TIMER_CASTS } from '@/lib/queries';
import { getSpecId, knownSpell, spellName } from '@/lib/defensives';
import {
  DEFAULT_TOLERANCE_S, castFilterExpression, evaluate, parseNote, planChecks, summarize,
  type CastRecord, type CheckPlan, type FightContext, type ParsedNote, type PlayerReport, type RosterPlayer, type TimerCheck,
} from '@/lib/noteTimers';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, Search, Skull, AlertTriangle, ClipboardPaste } from 'lucide-react';
import { useSpellTooltip } from '@/hooks/useSpellTooltip';
import { SpellIcon } from './SpellIcon';
import { SpellTooltip } from './SpellTooltip';

interface Props {
  code: string;
  fightId: number;
}

interface LoadedData {
  parsed: ParsedNote;
  plan: CheckPlan;
  casts: CastRecord[];
  fight: FightContext;
  pages: number;
}

type SpellMeta = { name: string; icon: string };

interface PlayerDetail { id: number; name: string; type: string; icon?: string }
interface FightQueryData {
  reportData?: {
    report?: {
      fights?: { startTime: number; endTime: number; phaseTransitions?: { id: number; startTime: number }[] }[];
      playerDetails?: { data?: { playerDetails?: Partial<Record<"tanks" | "healers" | "dps", PlayerDetail[]>> } };
      deaths?: { data?: { entries?: { id: number; timestamp: number }[] } };
    };
  };
}
interface CastsQueryData {
  reportData?: {
    report?: {
      events?: { data?: { type: string; sourceID: number; timestamp: number; abilityGameID: number }[]; nextPageTimestamp?: number | null };
    };
  };
}

// ----------------------------------------------------------------------------- helpers
const fmt = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const fmtOffset = (ms: number) => `${ms >= 0 ? '+' : '−'}${Math.abs(ms / 1000).toFixed(1)}s`;

const spellMetaCache = new Map<number, SpellMeta>();
async function fetchSpellMeta(id: number): Promise<SpellMeta> {
  const known = knownSpell(id);
  if (known) return known;
  const cached = spellMetaCache.get(id);
  if (cached) return cached;
  try {
    const res = await fetch(`https://nether.wowhead.com/tooltip/spell/${id}?dataEnv=1&locale=0`);
    const data = await res.json();
    const meta = { name: data.name || `Spell ${id}`, icon: data.icon || 'inv_misc_questionmark' };
    spellMetaCache.set(id, meta);
    return meta;
  } catch {
    return { name: `Spell ${id}`, icon: 'inv_misc_questionmark' };
  }
}

const ROLE_STYLE = { tank: 'text-blue-400', healer: 'text-green-400', dps: 'text-red-400' } as const;
const ROLE_LABEL = { tank: 'Tank', healer: 'Healer', dps: 'DPS' } as const;

const STATUS_STYLE: Record<TimerCheck['status'], { box: string; label: string; text: string }> = {
  used: { box: 'border-green-500/30 bg-green-950/20', label: 'USADO', text: 'text-green-400' },
  outside: { box: 'border-amber-500/30 bg-amber-950/20', label: 'FORA DA MARGEM', text: 'text-amber-400' },
  missed: { box: 'border-red-500/30 bg-red-950/20', label: 'NÃO USADO', text: 'text-red-400' },
  dead: { box: 'border-zinc-600/40 bg-zinc-900', label: 'MORTO', text: 'text-zinc-400' },
  'after-end': { box: 'border-zinc-800 bg-zinc-950/40', label: 'APÓS O FIM', text: 'text-zinc-600' },
};

// ----------------------------------------------------------------------------- barra de margem
/**
 * Linha do tempo de UM timer: faixa verde = margem para menos/mais; traço branco = momento exato da nota;
 * ponto = cast dentro da margem. Cast fora da margem não vira ponto: só é citado no texto.
 */
export function MarginBar({ check, toleranceS }: { check: TimerCheck; toleranceS: number }) {
  const W = toleranceS * 1000;
  const span = W * 3;                     // a trilha cobre 1,5 margem para cada lado
  const pct = (offsetMs: number) => 50 + (offsetMs / span) * 100;
  const inside = check.status === 'used' && check.cast;

  return (
    <div className="w-full select-none" aria-hidden>
      <div className="relative h-6 rounded bg-zinc-950 border border-zinc-800">
        <div className="absolute inset-y-0 bg-emerald-500/15 border-x border-emerald-500/40" style={{ left: `${pct(-W)}%`, width: `${(2 * W / span) * 100}%` }} />
        <div className="absolute inset-y-0 w-px bg-white/80" style={{ left: '50%' }} />
        {inside && (
          <div
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-green-400 ring-2 ring-zinc-950"
            style={{ left: `${pct(check.cast!.offsetMs)}%` }}
            title={`${fmt(check.cast!.t)} (${fmtOffset(check.cast!.offsetMs)})`}
          />
        )}
      </div>
      <div className="relative h-4 text-[9px] text-zinc-500 font-mono">
        <span className="absolute -translate-x-1/2" style={{ left: `${pct(-W)}%` }}>−{toleranceS}s</span>
        <span className="absolute -translate-x-1/2 text-zinc-300" style={{ left: '50%' }}>{fmt(check.targetMs)}</span>
        <span className="absolute -translate-x-1/2" style={{ left: `${pct(W)}%` }}>+{toleranceS}s</span>
      </div>
    </div>
  );
}

export function CheckRow({
  check, meta, tooltip, toleranceS,
}: {
  check: TimerCheck;
  meta: Map<number, SpellMeta>;
  tooltip: { show: (id: number, e: React.MouseEvent) => void; hide: () => void };
  toleranceS: number;
}) {
  const st = STATUS_STYLE[check.status];
  const isPersonal = check.timer.kind === 'personal-defensive';
  const noteSpell = check.timer.spellId;
  const shownSpellId = noteSpell ?? check.cast?.spellId;
  const shownMeta = shownSpellId ? meta.get(shownSpellId) : undefined;
  const castName = check.cast ? (spellName(check.cast.spellId) ?? meta.get(check.cast.spellId)?.name ?? `Spell ${check.cast.spellId}`) : undefined;

  let detail: React.ReactNode;
  switch (check.status) {
    case 'used':
      detail = <>Usado às <b>{fmt(check.cast!.t)}</b> ({fmtOffset(check.cast!.offsetMs)}){isPersonal && castName ? <> — {castName}</> : null}</>;
      break;
    case 'outside':
      detail = <>Usado às <b>{fmt(check.cast!.t)}</b> ({fmtOffset(check.cast!.offsetMs)}), fora da margem{isPersonal && castName ? <> — {castName}</> : null}</>;
      break;
    case 'dead':
      detail = <span className="inline-flex items-center gap-1"><Skull size={12} /> Morreu às {fmt(check.deathMs ?? 0)}, antes do timer</span>;
      break;
    case 'after-end':
      detail = 'A luta acabou antes deste timer';
      break;
    default:
      detail = 'Não usado';
  }

  return (
    <div className={`grid grid-cols-1 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_minmax(0,1.3fr)] gap-3 items-center p-2.5 rounded border ${st.box}`}>
      <div className="flex items-center gap-2.5 min-w-0">
        {isPersonal ? (
          <div className="w-8 h-8 rounded border border-white/5 bg-zinc-950 flex items-center justify-center shrink-0 text-zinc-400" title="qualquer defensivo pessoal">🛡</div>
        ) : (
          <SpellIcon spellId={noteSpell!} icon={shownMeta?.icon ?? 'inv_misc_questionmark'} size="md" onMouseEnter={(id, e) => tooltip.show(id, e)} onMouseLeave={tooltip.hide} />
        )}
        <div className="min-w-0">
          <div className="text-sm font-medium text-zinc-100 truncate">
            {isPersonal ? 'Defensivo pessoal' : (shownMeta?.name ?? `Spell ${noteSpell}`)}
          </div>
          <div className="text-[10px] text-zinc-500 font-mono">
            nota {fmt(check.targetMs)} · linha {check.timer.line}
            {check.timer.phase > 1 && ` · fase ${check.timer.phase}`}
          </div>
        </div>
      </div>
      <div className="min-w-0">
        {check.status === 'after-end' ? <div className="h-10" /> : <MarginBar check={check} toleranceS={toleranceS} />}
      </div>
      <div className="text-xs">
        <div className={`font-bold ${st.text}`}>{st.label}</div>
        <div className="text-zinc-400">{detail}</div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------- componente principal
export function NoteTimerChecker({ code, fightId }: Props) {
  const client = useApolloClient();
  const [noteText, setNoteText] = useState('');
  const [toleranceS, setToleranceS] = useState(DEFAULT_TOLERANCE_S);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<LoadedData | null>(null);
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [meta, setMeta] = useState<Map<number, SpellMeta>>(new Map());
  const { tooltip, showTooltip, hideTooltip } = useSpellTooltip();

  const parsedPreview = useMemo(() => (noteText.trim() ? parseNote(noteText) : null), [noteText]);

  const analyze = async () => {
    setError(null);
    setData(null);
    if (!code || !fightId) { setError('Selecione um report e uma luta primeiro (campo acima).'); return; }
    const parsed = parseNote(noteText);
    if (!parsed.timers.length) {
      setError('Não encontrei nenhum timer na nota. Procuro linhas "time:…;tag:…;spellid:…" (ou texto pedindo "CD pessoal").');
      return;
    }

    setLoading(true);
    try {
      // 1) luta: tempos, fases, elenco e mortes (uma query leve)
      const fightRes = await client.query<FightQueryData>({ query: GET_NOTE_TIMER_FIGHT, variables: { code, fightId }, fetchPolicy: 'network-only' });
      const rep = fightRes.data?.reportData?.report;
      const f = rep?.fights?.[0];
      if (!f) throw new Error('Luta não encontrada neste report.');
      const pd = rep.playerDetails?.data?.playerDetails ?? {};

      const roster: RosterPlayer[] = (['tanks', 'healers', 'dps'] as const).flatMap((k) =>
        (pd[k] ?? []).map((p): RosterPlayer => {
          const specName = String(p.icon ?? '').split('-')[1] ?? '';
          return { id: p.id, name: p.name, className: p.type, specName, specId: getSpecId(p.type, specName), role: k === 'tanks' ? 'tank' : k === 'healers' ? 'healer' : 'dps' };
        }));

      const fight: FightContext = { durationMs: f.endTime - f.startTime, phaseStartMs: {}, deaths: {} };
      for (const p of f.phaseTransitions ?? []) fight.phaseStartMs[p.id] = p.startTime - f.startTime;
      for (const e of rep.deaths?.data?.entries ?? []) fight.deaths[e.id] = e.timestamp - f.startTime;

      // 2) só os casts que a nota exige, de todos os jogadores, em uma consulta filtrada
      const plan = planChecks(parsed, roster);
      const casts: CastRecord[] = [];
      let pages = 0;
      if (plan.castIds.length) {
        const filter = castFilterExpression(plan.castIds);
        let start: number | null = f.startTime;
        while (start !== null && pages < 30) {
          const res: { data?: CastsQueryData } = await client.query<CastsQueryData>({
            query: GET_NOTE_TIMER_CASTS,
            variables: { code, fightId, filter, startTime: start, endTime: f.endTime },
            fetchPolicy: 'network-only',
          });
          const ev = res.data?.reportData?.report?.events;
          for (const c of ev?.data ?? []) {
            if (c.type === 'cast') casts.push({ sourceID: c.sourceID, t: c.timestamp - f.startTime, spellId: c.abilityGameID });
          }
          start = ev?.nextPageTimestamp ?? null;
          pages++;
        }
      }

      setData({ parsed, plan, casts, fight, pages });

      // 3) nome/ícone das spells da nota (e dos casts de defensivos) para exibir
      const ids = new Set<number>([...plan.noteSpellIds, ...casts.map((c) => c.spellId)]);
      const entries = await Promise.all([...ids].map(async (id) => [id, await fetchSpellMeta(id)] as const));
      setMeta(new Map(entries));
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Erro ao analisar a nota.');
    } finally {
      setLoading(false);
    }
  };

  // Reavaliar com outra margem não precisa baixar nada de novo.
  const evaluation = useMemo(
    () => (data ? evaluate(data.plan, data.casts, data.fight, toleranceS) : null),
    [data, toleranceS],
  );
  const summary = useMemo(() => (evaluation ? summarize(evaluation.reports) : null), [evaluation]);

  useEffect(() => { setData(null); setError(null); }, [code, fightId]);

  const visibleReports: PlayerReport[] = useMemo(() => {
    if (!evaluation) return [];
    if (!onlyProblems) return evaluation.reports;
    return evaluation.reports
      .map((r) => ({ ...r, checks: r.checks.filter((c) => c.status !== 'used' && c.status !== 'after-end') }))
      .filter((r) => r.checks.length > 0);
  }, [evaluation, onlyProblems]);

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-500"><Clock /> Note Timer Checker</CardTitle>
        <p className="text-sm text-zinc-400 mt-2">
          Cole a nota de raid. Eu extraio só os timers de habilidades (e pedidos de "CD pessoal"), ignorando posicionamento, addons e mecânicas,
          e confiro nos casts do log se cada um foi usado dentro da margem.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-xs text-zinc-400 flex items-center gap-1.5"><ClipboardPaste size={13} /> Nota</label>
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            spellCheck={false}
            placeholder={'EncounterID:3492;Name:m;Difficulty:Mythic\n\ntime:15.1;ph:1;tag:Sharyo;spellid:98008;\ntime:206;ph:1;tag:everyone;text:Cd pessoal!;\ntime:285;ph:1;tag:everyone;spellid:1295247;'}
            className="w-full h-44 p-3 rounded-md bg-zinc-950 border border-zinc-700 text-zinc-100 text-xs font-mono placeholder:text-zinc-600 focus:outline-none focus:border-blue-600"
          />
          {parsedPreview && (
            <div className="text-xs text-zinc-500">
              {parsedPreview.timers.length > 0
                ? <><b className="text-zinc-300">{parsedPreview.timers.length}</b> timers encontrados · {parsedPreview.ignoredLines} linhas descartadas (addons, posições, mecânicas)</>
                : 'Nenhum timer reconhecido ainda.'}
              {parsedPreview.encounter?.id ? <> · encounter {parsedPreview.encounter.id}</> : null}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Margem (± segundos)</label>
            <input
              type="number" min={1} max={60} value={toleranceS}
              onChange={(e) => setToleranceS(Math.max(1, Math.min(60, Number(e.target.value) || DEFAULT_TOLERANCE_S)))}
              className="w-24 h-10 px-3 rounded-md bg-zinc-950 border border-zinc-700 text-zinc-100 text-sm"
            />
          </div>
          <Button onClick={analyze} disabled={loading || !noteText.trim() || !code || !fightId} className="bg-green-600 hover:bg-green-700 text-white">
            {loading
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />Analisando...</>
              : <><Search className="mr-2" size={16} /> Analisar nota</>}
          </Button>
          {(!code || !fightId) && <span className="text-xs text-amber-500">Informe o report e a luta no campo do topo.</span>}
        </div>

        {error && (
          <div className="flex items-start gap-2 text-sm text-red-300 bg-red-950/30 border border-red-900/50 rounded p-3">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}
          </div>
        )}

        {evaluation && summary && data && (
          <div className="space-y-4 pt-4 border-t border-zinc-800">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-center">
              {[
                ['Cumpridos', summary.used, 'text-green-400'],
                ['Fora da margem', summary.outside, 'text-amber-400'],
                ['Não usados', summary.missed, 'text-red-400'],
                ['Morreu antes', summary.dead, 'text-zinc-400'],
                ['Após o fim da luta', summary.afterEnd, 'text-zinc-600'],
              ].map(([label, n, color]) => (
                <div key={label as string} className="rounded border border-zinc-800 bg-zinc-950 p-2">
                  <div className={`text-xl font-black ${color}`}>{n as number}</div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
                </div>
              ))}
            </div>

            <div className="text-[11px] text-zinc-500 space-y-1">
              <div>
                Baixados <b className="text-zinc-300">{data.casts.length}</b> casts em {data.pages} requisição(ões), filtrados por{' '}
                <b className="text-zinc-300">{data.plan.castIds.length}</b> spells — só as que a nota exige.
              </div>
              {data.plan.missingPlayers.length > 0 && (
                <div className="text-amber-500">Citados na nota e ausentes desta luta: {data.plan.missingPlayers.join(', ')}.</div>
              )}
              {evaluation.unmappedPhaseTimers.length > 0 && (
                <div className="text-amber-500">
                  {evaluation.unmappedPhaseTimers.length} timer(s) de fase não encontrada no log foram ignorados (linhas {evaluation.unmappedPhaseTimers.map((t) => t.line).join(', ')}).
                </div>
              )}
            </div>

            <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer select-none w-fit">
              <input type="checkbox" checked={onlyProblems} onChange={(e) => setOnlyProblems(e.target.checked)} />
              Mostrar só o que não foi cumprido
            </label>

            <div className="space-y-3">
              {visibleReports.map(({ player, checks }) => {
                const ok = checks.filter((c) => c.status === 'used').length;
                const countable = checks.filter((c) => c.status !== 'after-end').length;
                return (
                  <Card key={player.id} className="bg-zinc-950 border-zinc-800">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        <CardTitle className="text-base text-zinc-100">{player.name}</CardTitle>
                        <span className="text-xs font-semibold text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                          {player.specName} {player.className}
                        </span>
                        <span className={`text-[10px] font-bold uppercase ${ROLE_STYLE[player.role]}`}>{ROLE_LABEL[player.role]}</span>
                        <span className="ml-auto text-xs font-mono text-zinc-400">{ok}/{countable}</span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {checks.map((c) => (
                        <CheckRow
                          key={`${c.timer.id}-${player.id}`}
                          check={c}
                          meta={meta}
                          tooltip={{ show: showTooltip, hide: hideTooltip }}
                          toleranceS={toleranceS}
                        />
                      ))}
                    </CardContent>
                  </Card>
                );
              })}
              {visibleReports.length === 0 && (
                <div className="text-center p-6 text-sm text-zinc-500 bg-zinc-950/30 rounded border border-zinc-800">
                  {onlyProblems ? 'Tudo que a nota pede foi cumprido. 🎉' : 'Nenhum jogador desta luta é citado na nota.'}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
      {tooltip && <SpellTooltip {...tooltip} />}
    </Card>
  );
}
