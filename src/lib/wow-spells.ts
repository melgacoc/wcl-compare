export interface DefensiveSpell {
  id: number;
  name: string;
  cooldown: number;
  duration: number;
  icon: string;
}

export const DEFENSIVE_SPELLS: Record<string, DefensiveSpell[]> = {
  "DeathKnight": [
    { id: 48707, name: "Icebound Fortitude", cooldown: 180, duration: 8, icon: "spell_deathknight_iceboundfortitude" },
    { id: 48792, name: "Icebound Fortitude", cooldown: 120, duration: 8, icon: "spell_deathknight_iceboundfortitude" },
    { id: 48743, name: "Death Pact", cooldown: 120, duration: 0, icon: "spell_shadow_deathpact" },
    { id: 51052, name: "Anti-Magic Zone", cooldown: 120, duration: 10, icon: "spell_deathknight_antimagiczone" },
    { id: 49028, name: "Dancing Rune Weapon", cooldown: 120, duration: 8, icon: "inv_sword_07" },
    { id: 55233, name: "Vampiric Blood", cooldown: 90, duration: 10, icon: "spell_shadow_lifedrain" },
    { id: 49039, name: "Lichborne", cooldown: 120, duration: 10, icon: "spell_shadow_raisedead" }
  ],
  "DemonHunter": [
    { id: 198589, name: "Blur", cooldown: 60, duration: 10, icon: "ability_demonhunter_blur" },
    { id: 196555, name: "Netherwalk", cooldown: 180, duration: 5, icon: "spell_warlock_demonsoul" },
    { id: 204021, name: "Fiery Brand", cooldown: 60, duration: 8, icon: "ability_demonhunter_fierybrand" },
    { id: 187827, name: "Metamorphosis", cooldown: 180, duration: 15, icon: "ability_demonhunter_metamorphosisdps" },
    { id: 196718, name: "Darkness", cooldown: 180, duration: 8, icon: "ability_demonhunter_darkness" }
  ],
  "Druid": [
    { id: 22812, name: "Barkskin", cooldown: 60, duration: 12, icon: "spell_nature_stoneclawtotem" },
    { id: 61336, name: "Survival Instincts", cooldown: 180, duration: 6, icon: "ability_druid_tigersroar" },
    { id: 102342, name: "Ironbark", cooldown: 90, duration: 12, icon: "spell_druid_ironbark" },
    { id: 22842, name: "Frenzied Regeneration", cooldown: 36, duration: 3, icon: "ability_bullrush" }
  ],
  "Evoker": [
    { id: 363916, name: "Obsidian Scales", cooldown: 90, duration: 12, icon: "inv_artifact_dragonscales" },
    { id: 374348, name: "Renewing Blaze", cooldown: 90, duration: 8, icon: "ability_evoker_renewingblaze" },
    { id: 357214, name: "Time Dilation", cooldown: 60, duration: 8, icon: "ability_evoker_timedilation" },
    { id: 370960, name: "Emerald Communion", cooldown: 180, duration: 5, icon: "ability_evoker_green_01" }
  ],
  "Hunter": [
    { id: 186265, name: "Aspect of the Turtle", cooldown: 180, duration: 8, icon: "ability_hunter_aspectofthecheetah" },
    { id: 109304, name: "Exhilaration", cooldown: 120, duration: 0, icon: "ability_hunter_onewithnature" },
    { id: 264735, name: "Survival of the Fittest", cooldown: 180, duration: 6, icon: "spell_nature_spiritarmor" },
    { id: 5384, name: "Feign Death", cooldown: 30, duration: 360, icon: "ability_rogue_feigndeath" }
  ],
  "Mage": [
    { id: 45438, name: "Ice Block", cooldown: 240, duration: 10, icon: "spell_frost_frost" },
    { id: 11426, name: "Ice Barrier", cooldown: 25, duration: 60, icon: "spell_ice_lament" },
    { id: 235313, name: "Blazing Barrier", cooldown: 25, duration: 60, icon: "ability_mage_moltenarmor" },
    { id: 235450, name: "Prismatic Barrier", cooldown: 25, duration: 60, icon: "spell_magearmor" },
    { id: 55342, name: "Mirror Image", cooldown: 120, duration: 40, icon: "spell_magic_lesserinvisibilty" },
    { id: 113862, name: "Greater Invisibility", cooldown: 120, duration: 20, icon: "ability_mage_greaterinvisibility" },
    { id: 342245, name: "Alter Time", cooldown: 60, duration: 10, icon: "spell_mage_altertime" }
  ],
  "Monk": [
    { id: 115203, name: "Fortifying Brew", cooldown: 180, duration: 15, icon: "ability_monk_fortifyingale_new" },
    { id: 122783, name: "Diffuse Magic", cooldown: 90, duration: 6, icon: "spell_monk_diffusemagic" },
    { id: 122278, name: "Dampen Harm", cooldown: 120, duration: 10, icon: "ability_monk_dampenharm" },
    { id: 122470, name: "Touch of Karma", cooldown: 90, duration: 10, icon: "ability_monk_touchofkarma" },
    { id: 115176, name: "Zen Meditation", cooldown: 300, duration: 8, icon: "ability_monk_zenmeditation" },
    { id: 116849, name: "Life Cocoon", cooldown: 120, duration: 12, icon: "ability_monk_chicocoon" }
  ],
  "Paladin": [
    { id: 642, name: "Divine Shield", cooldown: 300, duration: 8, icon: "spell_holy_divineshield" },
    { id: 498, name: "Divine Protection", cooldown: 60, duration: 8, icon: "spell_holy_divineprotection" },
    { id: 31850, name: "Ardent Defender", cooldown: 120, duration: 8, icon: "spell_holy_ardentdefender" },
    { id: 86659, name: "Guardian of Ancient Kings", cooldown: 300, duration: 8, icon: "spell_holy_heroism" },
    { id: 204018, name: "Blessing of Spellwarding", cooldown: 180, duration: 10, icon: "spell_holy_blessingofprotection" },
    { id: 6940, name: "Blessing of Sacrifice", cooldown: 120, duration: 12, icon: "spell_holy_sealofsacrifice" }
  ],
  "Priest": [
    { id: 19236, name: "Desperate Prayer", cooldown: 90, duration: 0, icon: "spell_holy_testoffaith" },
    { id: 47585, name: "Dispersion", cooldown: 90, duration: 6, icon: "spell_shadow_dispersion" },
    { id: 33206, name: "Pain Suppression", cooldown: 180, duration: 8, icon: "spell_holy_painsupression" },
    { id: 47788, name: "Guardian Spirit", cooldown: 180, duration: 10, icon: "spell_holy_guardianspirit" },
    { id: 586, name: "Fade", cooldown: 30, duration: 10, icon: "spell_magic_lesserinvisibilty" },
    { id: 62618, name: "Power Word: Barrier", cooldown: 180, duration: 10, icon: "spell_holy_powerwordbarrier" }
  ],
  "Rogue": [
    { id: 31224, name: "Cloak of Shadows", cooldown: 120, duration: 5, icon: "spell_shadow_nethercloak" },
    { id: 5277, name: "Evasion", cooldown: 120, duration: 10, icon: "spell_shadow_shadowward" },
    { id: 185311, name: "Crimson Vial", cooldown: 30, duration: 0, icon: "ability_rogue_crimsonvial" },
    { id: 1966, name: "Feint", cooldown: 15, duration: 6, icon: "ability_rogue_feint" },
    { id: 11327, name: "Vanish", cooldown: 120, duration: 0, icon: "ability_vanish" }
  ],
  "Shaman": [
    { id: 108271, name: "Astral Shift", cooldown: 90, duration: 12, icon: "ability_shaman_astralshift" },
    { id: 198103, name: "Earth Elemental", cooldown: 300, duration: 60, icon: "spell_nature_earthelemental_totem" },
    { id: 204336, name: "Grounding Totem", cooldown: 30, duration: 3, icon: "spell_shaman_groundingtotem" }
  ],
  "Warlock": [
    { id: 104773, name: "Unending Resolve", cooldown: 180, duration: 8, icon: "spell_shadow_demonictactics" },
    { id: 108416, name: "Dark Pact", cooldown: 60, duration: 20, icon: "spell_shadow_deathpact" },
    { id: 132413, name: "Shadow Bulwark", cooldown: 120, duration: 20, icon: "spell_shadow_rageofmannoroth" }
  ],
  "Warrior": [
    { id: 871, name: "Shield Wall", cooldown: 240, duration: 8, icon: "ability_warrior_shieldwall" },
    { id: 97462, name: "Rallying Cry", cooldown: 180, duration: 10, icon: "ability_warrior_rallyingcry" },
    { id: 118038, name: "Die by the Sword", cooldown: 120, duration: 8, icon: "ability_warrior_challange" },
    { id: 184364, name: "Enraged Regeneration", cooldown: 120, duration: 8, icon: "ability_warrior_focusedrage" },
    { id: 23920, name: "Spell Reflection", cooldown: 25, duration: 5, icon: "ability_warrior_shieldreflection" },
    { id: 12975, name: "Last Stand", cooldown: 180, duration: 15, icon: "spell_holy_ashenlight" }
  ]
};