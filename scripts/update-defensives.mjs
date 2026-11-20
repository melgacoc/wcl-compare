#!/usr/bin/env node
// Gera src/data/defensives.generated.json a partir de:
//   - scripts/defensives.config.mjs         (lista curada de defensivos)
//   - Raidbots talents.json (patch "live")  (árvores de talento: entry id -> spell id)
//   - Tooltips da Wowhead                   (nome, ícone, CD, cargas, duração e
//                                            modificadores de CD/cargas por talento)
//
// Uso:  npm run update:defensives            (ambiente live)
//       npm run update:defensives -- --env ptr
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFENSIVES, CONSUMABLES, CAST_ALIASES, INTERRUPTS } from './defensives.config.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'src/data/defensives.generated.json');
const ENV = process.argv.includes('--env') ? process.argv[process.argv.indexOf('--env') + 1] : 'live';
const RAIDBOTS = `https://www.raidbots.com/static/data/${ENV}`;
const WOWHEAD_ENV = ENV === 'ptr' ? 2 : 1;

const warnings = [];
const warn = (msg) => { warnings.push(msg); };
const compact = (s) => s.replace(/\s+/g, '');

// ---------------------------------------------------------------- fetch helpers
async function getJson(url, tries = 3) {
  for (let i = 0; ; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'wcl-compare-defensives-generator' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (i >= tries - 1) throw new Error(`${url}: ${err.message}`);
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: limit }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); }
  }));
  return out;
}

const wowheadSpell = (id) => getJson(`https://nether.wowhead.com/tooltip/spell/${id}?dataEnv=${WOWHEAD_ENV}&locale=0`);
const wowheadItem = (id) => getJson(`https://nether.wowhead.com/tooltip/item/${id}?dataEnv=${WOWHEAD_ENV}&locale=0`);

// ---------------------------------------------------------------- tooltip parsing
function parseTime(text) {
  const m = /([\d.]+)\s*(min|sec|hour)/i.exec(text ?? '');
  if (!m) return null;
  const v = parseFloat(m[1]);
  return m[2].toLowerCase().startsWith('min') ? v * 60 : m[2].toLowerCase().startsWith('hour') ? v * 3600 : v;
}

function parseSpellTooltip(id, tt) {
  const html = tt.tooltip ?? '';
  const baseCdText = /<!--baseCooldown:([^>]*?)-->/.exec(html)?.[1]
    ?? /<!--cooldownText-->([^<]*?)<!--cooldownText-->/.exec(html)?.[1];
  const cooldown = parseTime(baseCdText) ?? 0;
  const charges = Number(/<!--baseCharges:(\d+)/.exec(html)?.[1] ?? 1);
  const isTalent = /<div class="q0">Talent<\/div>/.test(html);

  // Duração: 1) texto do buff ("8 seconds remaining"), 2) descrição ("for 10 sec").
  const buffText = (tt.buff ?? '').replace(/<[^>]+>/g, ' ');
  const descText = html.replace(/<!--[^>]*-->/g, '').replace(/<[^>]+>/g, ' ');
  let duration = parseTime(/([\d.]+\s*(?:seconds?|minutes?|sec|min))\s*remaining/i.exec(buffText)?.[1]);
  if (duration == null) duration = parseTime(/\bLasts (?:up to )?([\d.]+\s*(?:sec|min))/i.exec(descText)?.[1]);
  if (duration == null) duration = parseTime(/\b(?:for|after) ([\d.]+\s*(?:sec|min))/i.exec(descText)?.[1]) ?? 0;

  // Modificadores: <!--cooldown:TALENT:3.5 min cooldown-->  <!--charges:TALENT:2 Charges-->
  const mods = new Map();
  for (const m of html.matchAll(/<!--(cooldown|charges):(\d+):([^>]*?)-->/g)) {
    const talent = Number(m[2]);
    const mod = mods.get(talent) ?? { talent, cooldownDelta: 0, chargesDelta: 0 };
    if (m[1] === 'cooldown') {
      const v = parseTime(m[3]);
      if (v != null) mod.cooldownDelta = Math.round((v - cooldown) * 10) / 10;
    } else {
      mod.chargesDelta = Number(/(\d+)/.exec(m[3])?.[1] ?? charges) - charges;
    }
    mods.set(talent, mod);
  }
  return {
    id, name: tt.name, icon: tt.icon, cooldown, charges, duration, isTalent,
    mods: [...mods.values()].filter((m) => m.cooldownDelta || m.chargesDelta),
  };
}

// ---------------------------------------------------------------- main
console.log(`Baixando dados do Raidbots (${ENV})...`);
const [meta, trees] = await Promise.all([getJson(`${RAIDBOTS}/metadata.json`), getJson(`${RAIDBOTS}/talents.json`)]);
console.log(`Build do jogo: ${meta.wowBuild}`);

// specs[specId] = { className (formato WCL), specName (formato WCL) }
const specs = {};
const specsOfClass = {};
// talentIndex[specId][spellId] = [{ entry, maxRanks, free, name }]
const talentIndex = {};
for (const tree of trees) {
  const cls = compact(tree.className);
  const spec = compact(tree.specName);
  specs[tree.specId] = { className: cls, specName: spec };
  (specsOfClass[cls] ??= []).push(tree.specId);
  const idx = (talentIndex[tree.specId] = {});
  for (const group of ['classNodes', 'specNodes', 'heroNodes']) {
    for (const node of tree[group] ?? []) {
      for (const e of node.entries ?? []) {
        for (const sid of new Set([e.spellId, e.visibleSpellId].filter(Boolean))) {
          (idx[sid] ??= []).push({ entry: e.id, maxRanks: e.maxRanks ?? node.maxRanks ?? 1, free: !!node.freeNode, name: e.name, type: e.type });
        }
      }
    }
  }
}

/** Como o talento `spellId` aparece em cada spec (somente as specs onde existe). */
function talentGate(spellId, specIds) {
  const gate = {};
  for (const s of specIds) {
    const found = talentIndex[s]?.[spellId];
    if (found?.length) gate[s] = { entries: [...new Set(found.map((f) => f.entry))], free: found.some((f) => f.free), maxRanks: Math.max(...found.map((f) => f.maxRanks)) };
  }
  return gate;
}

// Coleta todos os IDs de spell a consultar
const allSpellIds = new Set();
for (const list of Object.values(DEFENSIVES)) for (const d of list) {
  allSpellIds.add(d.spell);
  for (const v of d.variants ?? []) allSpellIds.add(typeof v === 'number' ? v : v.spell);
}
for (const c of CONSUMABLES) for (const p of c.potions) allSpellIds.add(p.spell);
for (const list of Object.values(INTERRUPTS)) for (const i of list) allSpellIds.add(i.spell);

console.log(`Consultando ${allSpellIds.size} tooltips na Wowhead...`);
const spells = {};
await mapLimit([...allSpellIds], 6, async (id) => {
  try { spells[id] = parseSpellTooltip(id, await wowheadSpell(id)); }
  catch (err) { warn(`Spell ${id}: falha ao ler tooltip (${err.message})`); }
});

const defensives = [];
for (const [cls, list] of Object.entries(DEFENSIVES)) {
  const classSpecs = specsOfClass[cls];
  if (!classSpecs) { warn(`Classe "${cls}" não existe no Raidbots`); continue; }
  for (const d of list) {
    const specIds = d.specs
      ? d.specs.map((name) => {
        const id = classSpecs.find((s) => specs[s].specName === name);
        if (!id) warn(`${cls}: spec "${name}" não encontrada (spell ${d.spell})`);
        return id;
      }).filter(Boolean)
      : classSpecs;

    const optionDefs = [{ spell: d.spell, talent: d.talent, base: true },
      ...(d.variants ?? []).map((v) => (typeof v === 'number' ? { spell: v } : v))];

    const options = [];
    for (const o of optionDefs) {
      const sp = spells[o.spell];
      if (!sp) continue;
      const gate = talentGate(o.talent ?? o.spell, specIds);
      if (sp.isTalent && Object.keys(gate).length === 0 && !o.requires) {
        warn(`${cls}: "${sp.name}" (${o.spell}) é talento na Wowhead mas não está em nenhuma árvore do patch — provavelmente foi removido. Ignorado.`);
        continue;
      }
      const requiresGate = o.requires ? talentGate(o.requires, specIds) : null;
      if (o.requires && !Object.keys(requiresGate).length) warn(`${cls}: talento ${o.requires} (requisito de ${o.spell}) não encontrado nas árvores.`);

      // Modificadores de CD/cargas: só aceitamos os que são talentos dessas specs.
      const mods = [];
      for (const m of sp.mods) {
        const g = talentGate(m.talent, specIds);
        if (!Object.keys(g).length) continue; // PvP talent, set bonus, outra classe etc.
        const found = specIds.flatMap((s) => talentIndex[s]?.[m.talent] ?? []);
        const name = found[0]?.name;
        // Talento ATIVO (ex.: Incarnation) só altera o CD enquanto o buff dele está
        // ligado — não é um modificador permanente. Ignorado.
        if (found.every((f) => f.type === 'active')) {
          console.log(`  (ignorado) ${name} altera ${sp.name} só enquanto ativo`);
          continue;
        }
        mods.push({ talent: m.talent, name, cooldownDelta: m.cooldownDelta, chargesDelta: m.chargesDelta, gate: g });
      }
      options.push({
        spell: o.spell,
        base: !!o.base,
        // gate = só nas specs em que é talento; spec ausente => baseline (sempre disponível).
        gate: Object.keys(gate).length ? gate : undefined,
        // variante sem talento próprio: só é escolhida pelo log (cast) ou por `requires`.
        castOnly: !o.base && !Object.keys(gate).length && !o.requires ? true : undefined,
        requires: requiresGate && Object.keys(requiresGate).length ? requiresGate : undefined,
        mods: mods.length ? mods : undefined,
      });
    }
    if (!options.length) { warn(`${cls}: nenhuma opção válida para ${d.spell}`); continue; }
    if (!options.some((o) => o.base)) warn(`${cls}: spell base ${d.spell} inválida; usando só variantes.`);

    defensives.push({
      key: `${cls}:${d.spell}`,
      className: cls,
      specs: specIds,
      category: d.category,
      durationOverride: d.duration,
      options,
    });
  }
}

// ---------------------------------------------------------------- consumíveis
const consumables = [];
for (const c of CONSUMABLES) {
  const potions = [];
  for (const p of c.potions) {
    if (!spells[p.spell]) continue;
    const tiers = [];
    for (const itemId of p.items) {
      try {
        const it = await wowheadItem(itemId);
        const text = (it.tooltip ?? '').replace(/<[^>]+>/g, ' ');
        const heal = Number(/Restores\s+([\d,]+)\s+health/i.exec(text)?.[1]?.replace(/,/g, ''));
        if (!heal) { warn(`Item ${itemId}: não achei o valor de cura no tooltip`); continue; }
        if (!(it.tooltip ?? '').includes(`spell=${p.spell}`)) warn(`Item ${itemId} não usa a spell ${p.spell} — confira o config.`);
        tiers.push({ itemId, heal });
      } catch (err) { warn(`Item ${itemId}: ${err.message}`); }
    }
    tiers.sort((a, b) => a.heal - b.heal).forEach((t, i) => { t.quality = i + 1; });
    potions.push({ spell: p.spell, tiers });
  }
  consumables.push({ key: c.key, potions });
}

// ---------------------------------------------------------------- interrupts
const interrupts = [];
for (const [cls, list] of Object.entries(INTERRUPTS)) {
  const classSpecs = specsOfClass[cls];
  if (!classSpecs) { warn(`Interrupts: classe "${cls}" não existe no Raidbots`); continue; }
  for (const i of list) {
    const sp = spells[i.spell];
    if (!sp) continue;
    const wanted = i.specs
      ? i.specs.map((n) => classSpecs.find((s) => specs[s].specName === n)).filter(Boolean)
      : classSpecs;
    // Talento: só existe nas specs cuja árvore o contém. Não-talento: todas as specs pedidas.
    const eligible = wanted.filter((s) => !sp.isTalent || talentIndex[s]?.[i.spell]?.length);
    if (!eligible.length) { warn(`Interrupts: "${sp.name}" (${i.spell}) não está em nenhuma árvore de ${cls} neste patch — removido? Ignorado.`); continue; }
    interrupts.push({ key: `${cls}:${i.spell}`, className: cls, spell: i.spell, ids: [...new Set([i.spell, ...i.ids])], pet: !!i.pet, incidental: !!i.incidental, specs: eligible });
  }
}

// Só guardamos no JSON as spells efetivamente usadas.
const usedSpells = {};
for (const d of defensives) for (const o of d.options) usedSpells[o.spell] = spells[o.spell];
for (const c of consumables) for (const p of c.potions) usedSpells[p.spell] = spells[p.spell];
for (const i of interrupts) usedSpells[i.spell] = spells[i.spell];
for (const s of Object.values(usedSpells)) { delete s.mods; delete s.isTalent; }

const output = {
  meta: { wowBuild: meta.wowBuild, environment: ENV, generatedAt: new Date().toISOString() },
  specs,
  spells: usedSpells,
  defensives,
  consumables,
  aliases: CAST_ALIASES.map((g) => [...new Set(g)]),
  interrupts,
};
await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, JSON.stringify(output, null, 1) + '\n');

console.log(`\nGerado ${path.relative(ROOT, OUT)}: ${defensives.length} defensivos, ${Object.keys(usedSpells).length} spells, build ${meta.wowBuild}.`);
if (warnings.length) {
  console.log(`\n${warnings.length} aviso(s) — revise scripts/defensives.config.mjs:`);
  for (const w of warnings) console.log('  - ' + w);
}
