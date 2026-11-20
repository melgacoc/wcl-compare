import type { KickReport, KickAttempt, KickVerdict, PlayerKickReport } from '@/lib/kicks';
import type { RaidIcon } from '@/lib/noteTimers';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { SpellIcon } from './SpellIcon';

export type SpellMeta = { name: string; icon: string };

interface Props {
  report: KickReport;
  npcNames: Map<number, string>;
  meta: Map<number, SpellMeta>;
  onlyProblems: boolean;
  tooltip: { show: (id: number, e: React.MouseEvent) => void; hide: () => void };
}

const fmt = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// Glifo e cor de cada marcador de raid do WoW.
const ICON_STYLE: Record<RaidIcon, { glyph: string; color: string; label: string }> = {
  star: { glyph: '★', color: '#f5d142', label: 'Star' },
  circle: { glyph: '●', color: '#f58b2b', label: 'Circle' },
  diamond: { glyph: '◆', color: '#b04fe0', label: 'Diamond' },
  triangle: { glyph: '▲', color: '#3ccf4e', label: 'Triangle' },
  moon: { glyph: '☾', color: '#a8c8e8', label: 'Moon' },
  square: { glyph: '■', color: '#3b82f6', label: 'Square' },
  cross: { glyph: '✖', color: '#ef4444', label: 'Cross' },
  skull: { glyph: '☠', color: '#e5e7eb', label: 'Skull' },
};

export function RaidIconBadge({ icon, withLabel = false }: { icon: RaidIcon; withLabel?: boolean }) {
  const s = ICON_STYLE[icon];
  return (
    <span className="inline-flex items-center gap-1 font-bold" style={{ color: s.color }} title={s.label}>
      <span className="text-base leading-none">{s.glyph}</span>
      {withLabel && <span className="text-xs">{s.label}</span>}
    </span>
  );
}

const VERDICT_TEXT: Record<KickVerdict, string> = {
  'on-mark': 'Marca correta',
  'other-mark': 'Marca que não é a dele',
  unmarked: 'Alvo sem marcação',
};

function TargetLabel({ a, npcNames }: { a: KickAttempt; npcNames: Map<number, string> }) {
  const name = npcNames.get(a.targetId) ?? `NPC ${a.targetId}`;
  return (
    <span className="text-zinc-300">
      {name} <span className="text-zinc-500 font-mono">#{a.targetInstance}</span>
    </span>
  );
}

function SpellChip({ id, meta, tooltip }: { id: number; meta: Map<number, SpellMeta>; tooltip: Props['tooltip'] }) {
  const m = meta.get(id);
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      <SpellIcon spellId={id} icon={m?.icon ?? 'inv_misc_questionmark'} size="sm" onMouseEnter={(sid, e) => tooltip.show(sid, e)} onMouseLeave={tooltip.hide} />
      <span className="truncate">{m?.name ?? `Spell ${id}`}</span>
    </span>
  );
}

function AttemptRow({
  a, verdict, npcNames, meta, tooltip,
}: {
  a: KickAttempt; verdict: KickVerdict; npcNames: Map<number, string>; meta: Map<number, SpellMeta>; tooltip: Props['tooltip'];
}) {
  const good = a.success && verdict === 'on-mark';
  const box = !a.success ? 'border-zinc-700/60 bg-zinc-900' : good ? 'border-green-500/30 bg-green-950/20' : 'border-red-500/30 bg-red-950/20';
  const headline = !a.success
    ? 'Kick sem efeito'
    : verdict === 'on-mark' ? 'Interrompeu a marca certa'
      : verdict === 'other-mark' ? 'Interrompeu marca que não é a dele'
        : 'Interrompeu alvo sem marcação';
  const color = !a.success ? 'text-zinc-400' : good ? 'text-green-400' : 'text-red-400';

  return (
    <div className={`grid grid-cols-[3rem_minmax(0,1fr)_minmax(0,1.2fr)] gap-3 items-center p-2 rounded border text-xs ${box}`}>
      <span className="font-mono text-zinc-400">{fmt(a.t)}</span>
      <div className="min-w-0 space-y-0.5">
        <div className="text-zinc-200"><SpellChip id={a.spellId} meta={meta} tooltip={tooltip} /></div>
        {a.interruptedSpellId ? (
          <div className="text-[10px] text-zinc-500 truncate">interrompeu: {meta.get(a.interruptedSpellId)?.name ?? `Spell ${a.interruptedSpellId}`}</div>
        ) : null}
      </div>
      <div className="min-w-0">
        <div className={`font-bold ${color}`}>{headline}</div>
        <div className="flex items-center gap-2 flex-wrap text-zinc-400">
          <TargetLabel a={a} npcNames={npcNames} />
          {a.icon ? <RaidIconBadge icon={a.icon} /> : <span className="text-zinc-600">sem marca</span>}
          {a.success && !good && <span className="text-[10px] text-red-300/80">({VERDICT_TEXT[verdict]})</span>}
        </div>
      </div>
    </div>
  );
}

function PlayerCard({ p, props }: { p: PlayerKickReport; props: Props }) {
  const rows = props.onlyProblems ? p.attempts.filter((a) => !(a.success && a.verdict === 'on-mark')) : p.attempts;
  const noKick = p.available.length === 0;
  return (
    <Card className="bg-zinc-950 border-zinc-800">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3 flex-wrap">
          <CardTitle className="text-base text-zinc-100">{p.name}</CardTitle>
          {p.player && (
            <span className="text-xs font-semibold text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
              {p.player.specName} {p.player.className}
            </span>
          )}
          <span className="flex items-center gap-1.5 text-xs text-zinc-400">
            escalado em {p.icons.map((i) => <RaidIconBadge key={i} icon={i} />)}
            {p.assigns.some((a) => a.marker) && <span className="text-[10px] text-zinc-500">(marca o add)</span>}
          </span>
          <span className="ml-auto flex gap-2 text-[11px] font-mono">
            <span className="text-green-400" title="interrupts na marca certa">✓{p.counts.onMark}</span>
            <span className="text-red-400" title="interrupts em outra marca">✗{p.counts.otherMark}</span>
            <span className="text-red-400" title="interrupts em alvo sem marcação">∅{p.counts.unmarked}</span>
            <span className="text-zinc-500" title="kicks sem efeito">○{p.counts.noEffect}</span>
          </span>
        </div>
        {noKick && (
          <div className="flex items-center gap-1.5 text-xs text-amber-400 mt-2">
            <AlertTriangle size={13} /> A spec {p.player?.specName} {p.player?.className} não tem interrupt neste patch — não consegue cumprir este assign.
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-1.5">
        {rows.length === 0 ? (
          <div className="text-xs text-zinc-500 py-2">
            {p.attempts.length === 0 ? 'Nenhum interrupt registrado nesta luta.' : 'Todos os interrupts foram na marca certa.'}
          </div>
        ) : rows.map((a, i) => (
          <AttemptRow key={`${a.t}-${i}`} a={a} verdict={a.verdict} npcNames={props.npcNames} meta={props.meta} tooltip={props.tooltip} />
        ))}
      </CardContent>
    </Card>
  );
}

export function KickAssignReport(props: Props) {
  const { report, npcNames } = props;
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-zinc-200">Interrupts (kick assign)</h3>
        <p className="text-xs text-zinc-500 mt-1">
          Cada kick é ligado ao alvo (id + instância, então mobs de mesmo nome não se confundem) e à marcação que o alvo tinha no momento.
          Kicks sem efeito só são conhecidos para quem está escalado.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          ['Kicks em alvos marcados', report.totals.markedKicks, 'text-zinc-200'],
          ['Por escalados da marca', report.totals.byAssigned, 'text-green-400'],
          ['Por outros jogadores', report.totals.byOthers, report.totals.byOthers ? 'text-amber-400' : 'text-zinc-500'],
        ].map(([label, n, color]) => (
          <div key={label as string} className="rounded border border-zinc-800 bg-zinc-950 p-2">
            <div className={`text-xl font-black ${color}`}>{n as number}</div>
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
          </div>
        ))}
      </div>

      {report.missingPlayers.length > 0 && (
        <div className="text-[11px] text-amber-500">Escalados na nota e ausentes desta luta: {report.missingPlayers.join(', ')}.</div>
      )}

      {/* Por marcação: quem deveria kickar e quem kickou, na ordem */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {report.icons.map((ic) => (
          <Card key={ic.icon} className="bg-zinc-950 border-zinc-800">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <RaidIconBadge icon={ic.icon} withLabel />
                <span className="text-xs text-zinc-500">escalados:</span>
                {ic.assigned.map((a) => (
                  <span key={a.name} className={`text-xs px-1.5 py-0.5 rounded border ${a.present ? 'border-zinc-700 text-zinc-300' : 'border-amber-700/50 text-amber-500'}`}
                    title={a.present ? undefined : 'ausente desta luta'}>
                    {a.name}{a.marker ? ' ✎' : ''}
                  </span>
                ))}
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              {ic.sequence.length === 0 ? (
                <div className="text-xs text-zinc-500 py-1">Nenhum kick nesta marca.</div>
              ) : ic.sequence
                .filter((s) => !props.onlyProblems || !s.byAssigned || !s.success)
                .map((s) => (
                  <div key={`${s.t}-${s.n}`} className={`flex items-center gap-2 text-xs px-2 py-1 rounded border ${
                    !s.success ? 'border-zinc-700/60 bg-zinc-900' : s.byAssigned ? 'border-green-500/30 bg-green-950/20' : 'border-amber-500/30 bg-amber-950/20'}`}>
                    <span className="font-mono text-zinc-500 w-6">#{s.n}</span>
                    <span className="font-mono text-zinc-400 w-10">{fmt(s.t)}</span>
                    <span className={`font-medium ${s.byAssigned ? 'text-green-300' : 'text-amber-300'}`}>{s.playerName ?? `Jogador ${s.playerId}`}</span>
                    <span className="text-zinc-500 truncate">→ {npcNames.get(s.targetId) ?? `NPC ${s.targetId}`} #{s.targetInstance}</span>
                    <span className="ml-auto text-[10px] font-bold shrink-0">
                      {!s.success ? <span className="text-zinc-500">SEM EFEITO</span> : s.byAssigned ? <span className="text-green-400">ESCALADO</span> : <span className="text-amber-400">NÃO ESCALADO</span>}
                    </span>
                  </div>
                ))}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Por jogador escalado */}
      <div className="space-y-3">
        {report.players.map((p) => (
          <PlayerCard key={p.name} p={p} props={props} />
        ))}
      </div>
    </div>
  );
}

