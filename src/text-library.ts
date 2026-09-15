/**
 * A small library of the text chunks a stat block repeats most: weapon attacks,
 * common monster traits, class features, spellcasting scaffolding and a few
 * spells. Wording follows the System Reference Document (SRD 5.2, the 2024
 * rules, CC-BY-4.0), with "the creature" as the subject so a snippet reads
 * right in any block.
 */
import { SECTION_LABELS, insertSection, makeEmptySection, uid, type Creature, type Section, type SectionKind } from './model'

export const CATEGORIES = [
  'Melee weapons',
  'Ranged weapons',
  'Natural weapons',
  'Multiattack',
  'Common traits',
  'Class features',
  'Reactions',
  'Spellcasting',
  'Legendary',
  'Spells',
] as const
export type Category = (typeof CATEGORIES)[number]

export interface Snippet {
  /** Stable slug, e.g. 'attack-shortsword'. */
  id: string
  /** Section the entry belongs in. */
  kind: SectionKind
  category: Category
  /** Entry name as printed, e.g. 'Sneak Attack (1/Turn)'. */
  name: string
  /** Entry body. */
  text: string
  /** Extra search terms. */
  keywords?: string[]
  /** Also sets the section's intro paragraph (spellcasting, legendary actions). */
  intro?: string
  /** Title of the custom section this goes into (custom kind only). */
  section?: string
}

/** A snippet prepared for the picker. */
export interface ResolvedSnippet {
  id: string
  kind: SectionKind
  category: Category
  name: string
  text: string
  intro: string | null
  section?: string
  /** Lower-cased haystack for type-to-filter. */
  search: string
}

export function resolve(snippet: Snippet): ResolvedSnippet {
  const { id, kind, category, name, text, section } = snippet
  const search = [name, category, sectionLabel(kind, section), ...(snippet.keywords ?? []), text].join(' ').toLowerCase()
  return { id, kind, category, name, text, intro: snippet.intro ?? null, section, search }
}

/** Short label of the section a snippet lands in: "Actions", "Spells"… */
export const sectionLabel = (kind: SectionKind, section?: string) =>
  kind === 'custom' ? section ?? SECTION_LABELS.custom : SECTION_LABELS[kind]

/* ---------------------------------------------------------------- inserting */

export interface Destination {
  section: Section | null
  title: string
}

/** Where a snippet would go: a given section, the first matching one, or a new one. */
export function destination(creature: Creature, snippet: ResolvedSnippet, into: Section | null): Destination {
  const section =
    into ??
    creature.sections.find(
      (sec) => sec.kind === snippet.kind && (snippet.kind !== 'custom' || sec.title === snippet.section),
    ) ??
    null
  const title = section ? section.title || SECTION_LABELS[section.kind] : snippet.section ?? SECTION_LABELS[snippet.kind]
  return { section, title }
}

/** Appends the snippet as a plain entry, creating the section in book order if needed. */
export function insertSnippet(
  creature: Creature,
  snippet: ResolvedSnippet,
  into: Section | null,
): { creature: Creature; title: string } {
  const dest = destination(creature, snippet, into)
  const entry = { id: uid(), name: snippet.name, text: snippet.text }
  if (dest.section) {
    const id = dest.section.id
    const sections = creature.sections.map((sec) =>
      sec.id === id
        ? { ...sec, intro: snippet.intro ?? sec.intro, entries: [...sec.entries, entry] }
        : sec,
    )
    return { creature: { ...creature, sections }, title: dest.title }
  }
  const section = makeEmptySection(snippet.kind)
  if (snippet.kind === 'custom' && snippet.section) section.title = snippet.section
  if (snippet.intro) section.intro = snippet.intro
  section.entries.push(entry)
  return { creature: { ...creature, sections: insertSection(creature.sections, section) }, title: dest.title }
}

/* ------------------------------------------------------------------ attacks */

type Mode = 'melee' | 'ranged' | 'both'
interface AttackSpec {
  category: Category
  mode: Mode
  /** Average and dice, e.g. '5 (1d6 + 2)'. */
  hit: string
  type: string
  reach?: number
  /** Normal/long range in feet, e.g. '80/320'. */
  range?: string
  /** Two-handed damage for versatile weapons, e.g. '7 (1d10 + 2)'. */
  versatile?: string
  keywords?: string[]
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1)

function attack(id: string, name: string, spec: AttackSpec): Snippet {
  const reach = `reach ${spec.reach ?? 5} ft.`
  const range = `range ${spec.range} ft.`
  const where = spec.mode === 'melee' ? reach : spec.mode === 'ranged' ? range : `${reach} or ${range}`
  const label = { melee: 'Melee Attack Roll', ranged: 'Ranged Attack Roll', both: 'Melee or Ranged Attack Roll' }[spec.mode]
  const twoHands = spec.mode === 'both' ? 'if used with two hands to make a melee attack' : 'if used with two hands'
  const damage = (type: string) =>
    `${spec.hit} ${type} damage${spec.versatile ? `, or ${spec.versatile} ${type} damage ${twoHands}` : ''}.`
  return {
    id: `attack-${id}`,
    kind: 'actions',
    category: spec.category,
    name,
    text: `*${label}:* +4, ${where} *Hit:* ${damage(cap(spec.type))}`,
    keywords: ['attack', 'weapon', spec.mode === 'ranged' ? 'ranged' : 'melee', ...(spec.keywords ?? [])],
  }
}

const melee = (id: string, name: string, hit: string, type: string, extra: Partial<AttackSpec> = {}) =>
  attack(id, name, { category: 'Melee weapons', mode: 'melee', hit, type, ...extra })
const ranged = (id: string, name: string, hit: string, type: string, range: string, extra: Partial<AttackSpec> = {}) =>
  attack(id, name, { category: 'Ranged weapons', mode: 'ranged', hit, type, range, ...extra })
const natural = (id: string, name: string, hit: string, type: string, extra: Partial<AttackSpec> = {}) =>
  attack(id, name, { category: 'Natural weapons', mode: 'melee', hit, type, ...extra })

/* ------------------------------------------------------------------- traits */

const trait = (id: string, name: string, text: string, keywords: string[] = [], kind: SectionKind = 'traits'): Snippet => ({
  id: `trait-${id}`,
  kind,
  category: 'Common traits',
  name,
  text,
  keywords,
})

const feature = (id: string, name: string, kind: SectionKind, text: string, keywords: string[] = []): Snippet => ({
  id: `feature-${id}`,
  kind,
  category: 'Class features',
  name,
  text,
  keywords,
})

/* ------------------------------------------------------------- spellcasting */

interface CasterSpec {
  level: string
  dc: number
  attack: number
  cantrips: string[]
}

/** Intro template for a prepared caster; the entry itself is the cantrip line. */
function caster(spec: CasterSpec): Snippet {
  const list = spec.cantrips.map((c) => c.split(' ').map(cap).join(' ')).join(', ')
  return {
    id: `spellcasting-${spec.level.replace(/\D/g, '')}`,
    kind: 'spellcasting',
    category: 'Spellcasting',
    name: 'At Will',
    text: list,
    intro: `The creature casts one of the following spells, using Intelligence as the spellcasting ability (spell save DC ${spec.dc}, +${spec.attack} to hit with spell attacks):`,
    keywords: ['spellcaster', 'caster level', 'intro', 'wizard', `${spec.level} level`],
  }
}

/** A spell-list line: capitalised spell names, comma separated. */
const spellLine = (id: string, name: string, spells: string[], keywords: string[] = []): Snippet => ({
  id: `spells-${id}`,
  kind: 'spellcasting',
  category: 'Spellcasting',
  name,
  text: spells.map((c) => c.split(' ').map(cap).join(' ')).join(', '),
  keywords: ['spell list', 'slots', ...keywords],
})

/* ------------------------------------------------------------------- spells */

interface SpellSpec {
  level: number
  school: string
  ritual?: boolean
  time: string
  range: string
  duration: string
  text: string
  keywords?: string[]
}

const ORDINAL = ['cantrip', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th']

/** The books name the casting time by its action: "Action", "Bonus Action", "Reaction". */
const castingTime = (time: string) =>
  time.replace(/^1 (action|bonus action|reaction)/, (_, w: string) => w.split(' ').map(cap).join(' '))

/** A spell for a player-character block: a compact italic header, then the SRD text. */
function spell(id: string, name: string, spec: SpellSpec): Snippet {
  const level = spec.level === 0 ? `${cap(spec.school)} Cantrip` : `Level ${spec.level} ${cap(spec.school)}`
  const head = `*${level}${spec.ritual ? ' (Ritual)' : ''}: ${castingTime(spec.time)}, ${cap(spec.range)}, ${cap(spec.duration)}.*`
  return {
    id: `spell-${id}`,
    kind: 'custom',
    section: 'Spells',
    category: 'Spells',
    name,
    text: `${head} ${spec.text}`,
    keywords: ['spell', spec.school, ORDINAL[spec.level], ...(spec.keywords ?? [])],
  }
}

/* ------------------------------------------------------------------ library */

export const LIBRARY: Snippet[] = [
  // Melee weapons (+4 to hit, +2 damage modifier)
  melee('dagger', 'Dagger', '4 (1d4 + 2)', 'piercing', { mode: 'both', range: '20/60', keywords: ['thrown', 'light', 'finesse'] }),
  melee('shortsword', 'Shortsword', '5 (1d6 + 2)', 'piercing', { keywords: ['light', 'finesse'] }),
  melee('longsword', 'Longsword', '6 (1d8 + 2)', 'slashing', { versatile: '7 (1d10 + 2)', keywords: ['versatile'] }),
  melee('greatsword', 'Greatsword', '9 (2d6 + 2)', 'slashing', { keywords: ['two-handed', 'heavy'] }),
  melee('scimitar', 'Scimitar', '5 (1d6 + 2)', 'slashing', { keywords: ['light', 'finesse'] }),
  melee('rapier', 'Rapier', '6 (1d8 + 2)', 'piercing', { keywords: ['finesse'] }),
  melee('spear', 'Spear', '5 (1d6 + 2)', 'piercing', { mode: 'both', range: '20/60', versatile: '6 (1d8 + 2)', keywords: ['thrown', 'versatile'] }),
  melee('mace', 'Mace', '5 (1d6 + 2)', 'bludgeoning'),
  melee('warhammer', 'Warhammer', '6 (1d8 + 2)', 'bludgeoning', { versatile: '7 (1d10 + 2)', keywords: ['versatile'] }),
  melee('greataxe', 'Greataxe', '8 (1d12 + 2)', 'slashing', { keywords: ['two-handed', 'heavy'] }),
  melee('battleaxe', 'Battleaxe', '6 (1d8 + 2)', 'slashing', { versatile: '7 (1d10 + 2)', keywords: ['versatile'] }),
  melee('handaxe', 'Handaxe', '5 (1d6 + 2)', 'slashing', { mode: 'both', range: '20/60', keywords: ['thrown', 'light'] }),
  melee('quarterstaff', 'Quarterstaff', '5 (1d6 + 2)', 'bludgeoning', { versatile: '6 (1d8 + 2)', keywords: ['staff', 'versatile'] }),
  melee('club', 'Club', '4 (1d4 + 2)', 'bludgeoning', { keywords: ['light'] }),
  melee('greatclub', 'Greatclub', '6 (1d8 + 2)', 'bludgeoning', { keywords: ['two-handed'] }),
  melee('morningstar', 'Morningstar', '6 (1d8 + 2)', 'piercing'),
  melee('glaive', 'Glaive', '7 (1d10 + 2)', 'slashing', { reach: 10, keywords: ['reach', 'polearm', 'heavy'] }),
  melee('halberd', 'Halberd', '7 (1d10 + 2)', 'slashing', { reach: 10, keywords: ['reach', 'polearm', 'heavy'] }),
  melee('whip', 'Whip', '4 (1d4 + 2)', 'slashing', { reach: 10, keywords: ['reach', 'finesse'] }),
  {
    id: 'attack-unarmed-strike',
    kind: 'actions',
    category: 'Melee weapons',
    name: 'Unarmed Strike',
    text: '*Melee Attack Roll:* +4, reach 5 ft. *Hit:* 3 Bludgeoning damage.',
    keywords: ['attack', 'melee', 'punch', 'fist', 'kick'],
  },

  // Ranged weapons
  ranged('shortbow', 'Shortbow', '5 (1d6 + 2)', 'piercing', '80/320', { keywords: ['bow', 'two-handed'] }),
  ranged('longbow', 'Longbow', '6 (1d8 + 2)', 'piercing', '150/600', { keywords: ['bow', 'two-handed', 'heavy'] }),
  ranged('light-crossbow', 'Light Crossbow', '6 (1d8 + 2)', 'piercing', '80/320', { keywords: ['crossbow', 'loading'] }),
  ranged('heavy-crossbow', 'Heavy Crossbow', '7 (1d10 + 2)', 'piercing', '100/400', { keywords: ['crossbow', 'loading', 'heavy'] }),
  ranged('hand-crossbow', 'Hand Crossbow', '5 (1d6 + 2)', 'piercing', '30/120', { keywords: ['crossbow', 'light', 'loading'] }),
  ranged('sling', 'Sling', '4 (1d4 + 2)', 'bludgeoning', '30/120'),
  ranged('dart', 'Dart', '4 (1d4 + 2)', 'piercing', '20/60', { keywords: ['thrown', 'finesse'] }),
  ranged('javelin', 'Javelin', '5 (1d6 + 2)', 'piercing', '30/120', { mode: 'both', keywords: ['thrown'] }),

  // Natural weapons
  natural('bite', 'Bite', '7 (2d4 + 2)', 'piercing', { keywords: ['beast', 'jaws', 'teeth'] }),
  natural('claws', 'Claws', '6 (1d8 + 2)', 'slashing', { keywords: ['beast', 'claw'] }),
  natural('slam', 'Slam', '6 (1d8 + 2)', 'bludgeoning', { keywords: ['fist', 'construct', 'undead'] }),
  natural('tail', 'Tail', '6 (1d8 + 2)', 'bludgeoning', { reach: 10, keywords: ['reach', 'dragon'] }),
  natural('gore', 'Gore', '6 (1d8 + 2)', 'piercing', { keywords: ['horns', 'tusks', 'beast'] }),
  {
    id: 'attack-sting',
    kind: 'actions',
    category: 'Natural weapons',
    name: 'Sting',
    text: '*Melee Attack Roll:* +4, reach 5 ft. *Hit:* 5 (1d6 + 2) Piercing damage, and the target is subjected to the following effect. *Constitution Saving Throw:* DC 12. *Failure:* 7 (2d6) Poison damage. *Success:* Half damage.',
    keywords: ['attack', 'melee', 'poison', 'saving throw', 'scorpion', 'wasp'],
  },
  {
    id: 'attack-tentacle',
    kind: 'actions',
    category: 'Natural weapons',
    name: 'Tentacle',
    text: '*Melee Attack Roll:* +4, reach 10 ft. *Hit:* 5 (1d6 + 2) Bludgeoning damage. If the target is a Large or smaller creature, it has the Grappled condition (escape DC 12) and the Restrained condition until the grapple ends.',
    keywords: ['attack', 'melee', 'grapple', 'restrained', 'reach', 'aberration'],
  },

  // Multiattack
  {
    id: 'multiattack-2',
    kind: 'actions',
    category: 'Multiattack',
    name: 'Multiattack',
    text: 'The creature makes two attacks, using Shortsword or Shortbow in any combination.',
    keywords: ['two attacks', 'extra attack'],
  },
  {
    id: 'multiattack-3',
    kind: 'actions',
    category: 'Multiattack',
    name: 'Multiattack',
    text: 'The creature makes three attacks, using Shortsword or Shortbow in any combination.',
    keywords: ['three attacks', 'extra attack'],
  },

  // Common traits
  trait('amphibious', 'Amphibious', 'The creature can breathe air and water.', ['water', 'breathe']),
  trait('keen-hearing-and-smell', 'Keen Hearing and Smell', 'The creature has Advantage on Wisdom (Perception) checks that rely on hearing or smell.', ['perception', 'wolf', 'beast']),
  trait('keen-sight', 'Keen Sight', 'The creature has Advantage on Wisdom (Perception) checks that rely on sight.', ['perception', 'eagle', 'hawk']),
  trait('pack-tactics', 'Pack Tactics', "The creature has Advantage on an attack roll against a creature if at least one of the creature's allies is within 5 feet of the creature and the ally doesn't have the Incapacitated condition.", ['allies', 'wolf', 'kobold']),
  trait('sunlight-sensitivity', 'Sunlight Sensitivity', 'While in sunlight, the creature has Disadvantage on ability checks and attack rolls.', ['drow', 'kobold', 'underdark']),
  trait('magic-resistance', 'Magic Resistance', 'The creature has Advantage on saving throws against spells and other magical effects.', ['saving throws', 'fiend', 'demon']),
  trait('legendary-resistance', 'Legendary Resistance (3/Day)', 'If the creature fails a saving throw, it can choose to succeed instead.', ['boss', 'dragon']),
  trait('spider-climb', 'Spider Climb', 'The creature can climb difficult surfaces, including upside down on ceilings, without needing to make an ability check.', ['climb', 'ceiling']),
  trait('undead-fortitude', 'Undead Fortitude', 'If damage reduces the creature to 0 Hit Points, it makes a Constitution saving throw (DC 5 plus the damage taken) unless the damage is Radiant or from a Critical Hit. On a successful save, the creature drops to 1 Hit Point instead.', ['zombie', 'undead']),
  trait('regeneration', 'Regeneration', "The creature regains 10 Hit Points at the start of each of its turns. If the creature takes Acid or Fire damage, this trait doesn't function on the creature's next turn. The creature dies only if it starts its turn with 0 Hit Points and doesn't regenerate.", ['troll', 'heal']),
  trait('flyby', 'Flyby', "The creature doesn't provoke an Opportunity Attack when it flies out of an enemy's reach.", ['fly', 'bird']),
  trait('nimble-escape', 'Nimble Escape', 'The creature takes the Disengage or Hide action.', ['goblin', 'disengage', 'hide'], 'bonus'),
  trait('shadow-stealth', 'Shadow Stealth', 'While in Dim Light or Darkness, the creature takes the Hide action.', ['hide', 'darkness', 'shadow'], 'bonus'),
  trait('aggressive', 'Aggressive', 'The creature moves up to its Speed toward an enemy it can see.', ['orc', 'charge', 'move'], 'bonus'),
  trait('brute', 'Brute', 'A melee weapon deals one extra die of its damage when the creature hits with it (included in the attack).', ['bugbear', 'extra die']),
  trait('turn-resistance', 'Turn Resistance', 'The creature has Advantage on saving throws against any effect that turns Undead.', ['undead', 'cleric']),
  trait('incorporeal-movement', 'Incorporeal Movement', 'The creature can move through creatures and objects as if they were Difficult Terrain. It takes 5 (1d10) Force damage if it ends its turn inside an object.', ['ghost', 'specter', 'walls']),
  trait('charge', 'Charge', 'If the creature moves at least 20 feet straight toward a target and then hits it with a Gore attack on the same turn, the target takes an extra 3 (1d6) Piercing damage. If the target is a creature, it must succeed on a DC 13 Strength saving throw or have the Prone condition.', ['boar', 'gore', 'prone']),
  trait('ambusher', 'Ambusher', 'In the first round of a combat, the creature has Advantage on attack rolls against any creature it surprised.', ['surprise', 'stealth']),
  trait('surprise-attack', 'Surprise Attack', 'If the creature surprises a creature and hits it with an attack during the first round of combat, the target takes an extra 10 (3d6) damage from the attack.', ['bugbear', 'stealth']),
  trait('false-appearance', 'False Appearance', "If the creature is motionless at the start of combat, it has Advantage on its Initiative roll. Moreover, if a creature hasn't observed the creature move or act, that creature must succeed on a DC 15 Intelligence (Investigation) check to discern the creature is animate.", ['gargoyle', 'mimic', 'statue', 'disguise']),
  trait('hold-breath', 'Hold Breath', 'The creature can hold its breath for 15 minutes.', ['water', 'crocodile']),
  trait('web-sense', 'Web Sense', 'While in contact with a web, the creature knows the exact location of any other creature in contact with the same web.', ['spider']),
  trait('web-walker', 'Web Walker', 'The creature ignores movement restrictions caused by webbing.', ['spider']),
  trait('devils-sight', "Devil's Sight", "Magical darkness doesn't impede the creature's darkvision.", ['darkvision', 'fiend', 'devil']),
  trait('blood-frenzy', 'Blood Frenzy', "The creature has Advantage on attack rolls against any creature that doesn't have all its Hit Points.", ['shark', 'sahuagin', 'wounded']),
  trait('mimicry', 'Mimicry', 'The creature can mimic animal sounds and humanoid voices. A creature that hears the sounds can tell they are imitations with a successful DC 14 Wisdom (Insight) check.', ['voice', 'raven', 'kenku']),
  trait('rampage', 'Rampage', 'Immediately after dealing damage to a creature that is already Bloodied, the creature moves up to half its Speed and makes one Bite attack.', ['gnoll', 'bonus'], 'bonus'),
  trait('reckless', 'Reckless', 'At the start of its turns, the creature can gain Advantage on all melee attack rolls it makes during that turn, but attack rolls against it have Advantage until the start of its next turn.', ['berserker', 'barbarian']),
  trait('relentless', 'Relentless (Recharges after a Short or Long Rest)', 'If the creature takes 7 damage or less that would reduce it to 0 Hit Points, it is reduced to 1 Hit Point instead.', ['boar', 'tough']),
  trait('standing-leap', 'Standing Leap', "The creature's long jump is up to 20 feet and its high jump is up to 10 feet, with or without a running start.", ['jump', 'frog', 'toad']),
  trait('stench', 'Stench', '*Constitution Saving Throw:* DC 10, any creature that starts its turn in a 5-foot Emanation originating from the creature. *Failure:* The target has the Poisoned condition until the start of its next turn. *Success:* The target is immune to this Stench for 24 hours.', ['ghast', 'troglodyte', 'poisoned', 'smell']),
  trait('swarm', 'Swarm', "The swarm can occupy another creature's space and vice versa, and the swarm can move through any opening large enough for a Tiny creature. The swarm can't regain Hit Points or gain Temporary Hit Points.", ['rats', 'bats', 'insects']),

  // Class features for player-character blocks
  feature('sneak-attack', 'Sneak Attack (1/Turn)', 'traits', "The creature deals an extra 7 (2d6) damage when it hits a target with a weapon attack and has Advantage on the attack roll, or when the target is within 5 feet of an ally of the creature that doesn't have the Incapacitated condition and the creature doesn't have Disadvantage on the attack roll.", ['rogue', 'assassin']),
  feature('cunning-action', 'Cunning Action', 'bonus', 'The creature takes the Dash, Disengage, or Hide action.', ['rogue', 'dash', 'disengage', 'hide']),
  feature('second-wind', 'Second Wind', 'bonus', 'The creature regains 1d10 + 3 Hit Points. It can use this feature twice, regaining one expended use when it finishes a Short Rest and all expended uses when it finishes a Long Rest.', ['fighter', 'heal', 'hit points']),
  feature('action-surge', 'Action Surge (Recharges after a Short or Long Rest)', 'traits', 'On its turn, the creature can take one additional action, except the Magic action.', ['fighter', 'extra action']),
  feature('rage', 'Rage', 'bonus', "The creature enters a Rage for 1 minute. While raging, it has Advantage on Strength checks and Strength saving throws, deals an extra 2 damage with Strength-based attacks, and has Resistance to Bludgeoning, Piercing, and Slashing damage. The Rage ends early if the creature has the Incapacitated condition or dons Heavy Armor; otherwise it lasts until the end of the creature's next turn unless it makes an attack roll, forces a saving throw, or takes a Bonus Action to extend it.", ['barbarian', 'resistance']),
  feature('divine-smite', 'Divine Smite', 'bonus', 'Immediately after the creature hits a creature with a Melee weapon or an Unarmed Strike, it expends a spell slot to deal an extra 9 (2d8) Radiant damage to the target, plus 1d8 for each spell slot level above 1. The damage increases by 1d8 if the target is a Fiend or an Undead.', ['paladin', 'radiant', 'smite']),
  feature('lay-on-hands', 'Lay on Hands', 'bonus', 'The creature has a pool of 15 Hit Points that replenishes when it finishes a Long Rest. It touches a creature and draws from the pool to restore a number of Hit Points to that creature, up to the maximum amount remaining in the pool. It can also expend 5 Hit Points from the pool to remove the Poisoned condition from the target.', ['paladin', 'heal', 'healing']),
  feature('martial-arts', 'Martial Arts', 'traits', 'The creature can use Dexterity instead of Strength for the attack and damage rolls of its Unarmed Strikes and Monk weapons, roll a d6 in place of the normal damage of its Unarmed Strike or Monk weapons, and, when it takes the Attack action on its turn with an Unarmed Strike or a Monk weapon, make one Unarmed Strike as a Bonus Action.', ['monk', 'unarmed']),
  feature('flurry-of-blows', 'Flurry of Blows', 'bonus', 'The creature expends 1 Focus Point to make two Unarmed Strikes.', ['monk', 'ki', 'focus', 'unarmed']),
  feature('uncanny-dodge', 'Uncanny Dodge', 'reactions', 'When an attacker that the creature can see hits it with an attack roll, the creature halves the attack’s damage against it (round down).', ['rogue', 'ranger', 'half damage']),
  feature('evasion', 'Evasion', 'traits', "When the creature is subjected to an effect that allows it to make a Dexterity saving throw to take only half damage, it instead takes no damage if it succeeds on the saving throw and only half damage if it fails. It can't use this feature if it has the Incapacitated condition.", ['rogue', 'monk', 'dexterity']),
  feature('extra-attack', 'Extra Attack', 'traits', 'The creature can attack twice, instead of once, whenever it takes the Attack action on its turn.', ['fighter', 'multiattack', 'two attacks']),
  feature('bardic-inspiration', 'Bardic Inspiration', 'bonus', 'The creature gives one creature other than itself within 60 feet a Bardic Inspiration die, a d6. Once within the next hour, when that creature fails a D20 Test, it can roll the die and add the number rolled to the d20, potentially turning the failure into a success. The creature can use this feature 3 times, regaining expended uses when it finishes a Long Rest.', ['bard', 'd6', 'inspire']),

  // Reactions
  {
    id: 'reaction-parry',
    kind: 'reactions',
    category: 'Reactions',
    name: 'Parry',
    text: '*Trigger:* The creature is hit by a melee attack roll while holding a weapon. *Response:* The creature adds 2 to its AC against that attack, possibly causing it to miss.',
    keywords: ['ac', 'block', 'knight', 'captain'],
  },
  {
    id: 'reaction-shield',
    kind: 'reactions',
    category: 'Reactions',
    name: 'Shield (Spell)',
    text: '*Trigger:* The creature is hit by an attack roll or targeted by *Magic Missile*. *Response:* The creature casts *Shield*: until the start of its next turn, it has a +5 bonus to AC, including against the triggering attack, and it takes no damage from *Magic Missile*.',
    keywords: ['spell', 'ac', 'mage', 'wizard'],
  },

  // Spellcasting intros (entry is the cantrip line; the intro sets the paragraph)
  caster({ level: '1st', dc: 12, attack: 4, cantrips: ['fire bolt', 'light', 'mage hand'] }),
  caster({ level: '3rd', dc: 13, attack: 5, cantrips: ['fire bolt', 'light', 'mage hand'] }),
  caster({ level: '5th', dc: 14, attack: 6, cantrips: ['fire bolt', 'light', 'mage hand', 'prestidigitation'] }),
  caster({ level: '9th', dc: 16, attack: 8, cantrips: ['fire bolt', 'light', 'mage hand', 'prestidigitation'] }),
  caster({ level: '11th', dc: 17, attack: 9, cantrips: ['fire bolt', 'light', 'mage hand', 'minor illusion', 'prestidigitation'] }),
  caster({ level: '17th', dc: 19, attack: 11, cantrips: ['fire bolt', 'light', 'mage hand', 'minor illusion', 'prestidigitation'] }),
  {
    id: 'spellcasting-innate',
    kind: 'spellcasting',
    category: 'Spellcasting',
    name: 'At Will',
    text: 'Detect Magic, Disguise Self',
    intro: 'The creature casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 13, +5 to hit with spell attacks):',
    keywords: ['innate spellcasting', 'intro', 'charisma', 'fiend', 'fey'],
  },
  // Spell-list lines
  spellLine('cantrips', 'Cantrips (at will)', ['fire bolt', 'light', 'mage hand', 'prestidigitation'], ['cantrip', 'at will']),
  spellLine('1st', '1st level (4 slots)', ['detect magic', 'mage armor', 'magic missile', 'shield'], ['first level']),
  spellLine('2nd', '2nd level (3 slots)', ['misty step', 'suggestion'], ['second level']),
  spellLine('3rd', '3rd level (3 slots)', ['counterspell', 'fireball', 'fly'], ['third level']),
  spellLine('at-will', 'At Will', ['detect magic', 'light', 'mage armor', 'mage hand', 'prestidigitation'], ['cantrip']),
  spellLine('2-day', '2/Day Each', ['fireball', 'invisibility'], ['per day']),
  spellLine('1-day', '1/Day Each', ['fly', 'lightning bolt'], ['per day']),

  // Legendary actions
  {
    id: 'legendary-intro',
    kind: 'legendary',
    category: 'Legendary',
    name: 'Detect',
    text: 'The creature makes a Wisdom (Perception) check.',
    intro: '*Legendary Action Uses:* 3. Immediately after another creature’s turn, the creature can expend a use to take one of the following actions. The creature regains all expended uses at the start of each of its turns.',
    keywords: ['legendary actions', 'intro', '3 actions', 'boss', 'perception'],
  },
  {
    id: 'legendary-attack',
    kind: 'legendary',
    category: 'Legendary',
    name: 'Attack',
    text: 'The creature makes one attack.',
    keywords: ['legendary', 'boss'],
  },
  {
    id: 'legendary-tail-attack',
    kind: 'legendary',
    category: 'Legendary',
    name: 'Tail Attack',
    text: 'The creature makes a tail attack.',
    keywords: ['legendary', 'dragon'],
  },
  {
    id: 'legendary-wing-attack',
    kind: 'legendary',
    category: 'Legendary',
    name: 'Wing Attack (Costs 2 Actions)',
    text: 'The creature beats its wings. *Dexterity Saving Throw:* DC 15, each creature in a 10-foot Emanation originating from the creature. *Failure:* 9 (2d6 + 2) Bludgeoning damage, and the target has the Prone condition. The creature can then fly up to half its Fly Speed.',
    keywords: ['legendary', 'dragon', 'prone', 'fly'],
  },

  // Spells for player-character blocks (condensed SRD text; proof-read against the SRD)
  spell('find-familiar', 'Find Familiar', {
    level: 1,
    school: 'conjuration',
    ritual: true,
    time: '1 hour',
    range: '10 feet',
    duration: 'instantaneous',
    text: "You gain the service of a familiar, a spirit that takes an animal form you choose: Bat, Cat, Frog, Hawk, Lizard, Octopus, Owl, Rat, Raven, Spider, Weasel, or another Beast that has a Challenge Rating of 0. It has the statistics of the chosen form, though it is a Celestial, Fey, or Fiend (your choice) instead of a Beast. Your familiar acts independently of you, but it obeys your commands. In combat, it rolls its own Initiative and acts on its own turn. A familiar can't attack, but it can take other actions as normal. While your familiar is within 100 feet of you, you can communicate with it telepathically. Additionally, as a Bonus Action, you can see through the familiar's eyes and hear what it hears until the start of your next turn. When you cast a spell with a range of touch, your familiar can deliver the spell as if it had cast the spell; it must be within 100 feet of you, and it must take a Reaction to deliver the spell when you cast it. You can't have more than one familiar at a time. As a Magic action, you can temporarily dismiss it to a pocket dimension or dismiss it forever; recast the spell to call it back or to give it a new form.",
    keywords: ['wizard', 'pet', 'owl', 'cat'],
  }),
  spell('shield', 'Shield', {
    level: 1,
    school: 'abjuration',
    time: '1 reaction, which you take when you are hit by an attack or targeted by the magic missile spell',
    range: 'self',
    duration: '1 round',
    text: 'An imperceptible barrier of magical force protects you. Until the start of your next turn, you have a +5 bonus to AC, including against the triggering attack, and you take no damage from *Magic Missile*.',
    keywords: ['wizard', 'sorcerer', 'ac', 'reaction'],
  }),
  spell('mage-armor', 'Mage Armor', {
    level: 1,
    school: 'abjuration',
    time: '1 action',
    range: 'touch',
    duration: '8 hours',
    text: "You touch a willing creature who isn't wearing armor. Until the spell ends, the target's base AC becomes 13 plus its Dexterity modifier. The spell ends early if the target dons armor.",
    keywords: ['wizard', 'sorcerer', 'ac'],
  }),
  spell('misty-step', 'Misty Step', {
    level: 2,
    school: 'conjuration',
    time: '1 bonus action',
    range: 'self',
    duration: 'instantaneous',
    text: 'Briefly surrounded by silvery mist, you teleport up to 30 feet to an unoccupied space that you can see.',
    keywords: ['teleport', 'bonus action'],
  }),
  spell('magic-missile', 'Magic Missile', {
    level: 1,
    school: 'evocation',
    time: '1 action',
    range: '120 feet',
    duration: 'instantaneous',
    text: 'You create three glowing darts of magical force. Each dart strikes a creature of your choice that you can see within range. A dart deals 1d4 + 1 Force damage to its target. The darts all strike simultaneously, and you can direct them to hit one creature or several. *Using a Higher-Level Spell Slot.* The spell creates one more dart for each spell slot level above 1.',
    keywords: ['wizard', 'sorcerer', 'force'],
  }),
  spell('fire-bolt', 'Fire Bolt', {
    level: 0,
    school: 'evocation',
    time: '1 action',
    range: '120 feet',
    duration: 'instantaneous',
    text: "You hurl a mote of fire at a creature or an object within range. Make a ranged spell attack against the target. On a hit, the target takes 1d10 Fire damage. A flammable object hit by this spell starts burning if it isn't being worn or carried. *Cantrip Upgrade.* The damage increases by 1d10 when you reach levels 5 (2d10), 11 (3d10), and 17 (4d10).",
    keywords: ['wizard', 'sorcerer', 'cantrip', 'fire'],
  }),
  spell('cure-wounds', 'Cure Wounds', {
    level: 1,
    school: 'abjuration',
    time: '1 action',
    range: 'touch',
    duration: 'instantaneous',
    text: 'A creature you touch regains a number of Hit Points equal to 2d8 plus your spellcasting ability modifier. *Using a Higher-Level Spell Slot.* The healing increases by 2d8 for each spell slot level above 1.',
    keywords: ['cleric', 'druid', 'paladin', 'ranger', 'heal', 'healing'],
  }),
  spell('healing-word', 'Healing Word', {
    level: 1,
    school: 'abjuration',
    time: '1 bonus action',
    range: '60 feet',
    duration: 'instantaneous',
    text: 'A creature of your choice that you can see within range regains Hit Points equal to 2d4 plus your spellcasting ability modifier. *Using a Higher-Level Spell Slot.* The healing increases by 2d4 for each spell slot level above 1.',
    keywords: ['cleric', 'bard', 'druid', 'heal', 'healing', 'bonus action'],
  }),
  spell('hunters-mark', "Hunter's Mark", {
    level: 1,
    school: 'divination',
    time: '1 bonus action',
    range: '90 feet',
    duration: 'concentration, up to 1 hour',
    text: 'You magically mark one creature you can see within range as your quarry. Until the spell ends, you deal an extra 1d6 Force damage to the target whenever you hit it with an attack roll. You also have Advantage on any Wisdom (Perception or Survival) check you make to find it. If the target drops to 0 Hit Points before this spell ends, you can take a Bonus Action to move the mark to a new creature you can see within range. *Using a Higher-Level Spell Slot.* Your Concentration can last longer with a spell slot of level 3–4 (up to 8 hours) or 5+ (up to 24 hours).',
    keywords: ['ranger', 'bonus action', 'concentration'],
  }),
  spell('bless', 'Bless', {
    level: 1,
    school: 'enchantment',
    time: '1 action',
    range: '30 feet',
    duration: 'concentration, up to 1 minute',
    text: 'You bless up to three creatures within range. Whenever a target makes an attack roll or a saving throw before the spell ends, the target adds 1d4 to the attack roll or save. *Using a Higher-Level Spell Slot.* You can target one additional creature for each spell slot level above 1.',
    keywords: ['cleric', 'paladin', 'concentration', 'd4'],
  }),
  spell('eldritch-blast', 'Eldritch Blast', {
    level: 0,
    school: 'evocation',
    time: '1 action',
    range: '120 feet',
    duration: 'instantaneous',
    text: 'A beam of crackling energy streaks toward a creature within range. Make a ranged spell attack against the target. On a hit, the target takes 1d10 Force damage. *Cantrip Upgrade.* The spell creates two beams at level 5, three beams at level 11, and four beams at level 17. You can direct the beams at the same target or at different ones. Make a separate attack roll for each beam.',
    keywords: ['warlock', 'cantrip', 'force'],
  }),
  spell('guidance', 'Guidance', {
    level: 0,
    school: 'divination',
    time: '1 action',
    range: 'touch',
    duration: 'concentration, up to 1 minute',
    text: 'You touch a willing creature and choose a skill. Until the spell ends, the creature adds 1d4 to any ability check using the chosen skill.',
    keywords: ['cleric', 'druid', 'cantrip', 'd4', 'ability check'],
  }),
  spell('detect-magic', 'Detect Magic', {
    level: 1,
    school: 'divination',
    ritual: true,
    time: '1 action',
    range: 'self',
    duration: 'concentration, up to 10 minutes',
    text: "For the duration, you sense the presence of magical effects within 30 feet of yourself. If you sense such effects, you can take the Magic action to see a faint aura around any visible creature or object in the area that bears the magic, and if an effect was created by a spell, you learn the spell's school of magic. The spell is blocked by 1 foot of stone, dirt, or wood; 1 inch of metal; or a thin sheet of lead.",
    keywords: ['ritual', 'concentration', 'aura'],
  }),
  spell('counterspell', 'Counterspell', {
    level: 3,
    school: 'abjuration',
    time: '1 reaction, which you take when you see a creature within 60 feet of you casting a spell',
    range: '60 feet',
    duration: 'instantaneous',
    text: "You attempt to interrupt a creature in the process of casting a spell. The target must succeed on a Constitution saving throw, or the spell dissipates with no effect, and the action, Bonus Action, or Reaction used to cast it is wasted. If that spell was cast with a spell slot, the slot isn't expended.",
    keywords: ['wizard', 'sorcerer', 'warlock', 'reaction'],
  }),
  spell('fireball', 'Fireball', {
    level: 3,
    school: 'evocation',
    time: '1 action',
    range: '150 feet',
    duration: 'instantaneous',
    text: "A bright streak flashes from you to a point you choose within range and then blossoms with a low roar into a fiery explosion. Each creature in a 20-foot-radius Sphere centered on that point makes a Dexterity saving throw, taking 8d6 Fire damage on a failed save or half as much damage on a successful one. Flammable objects in the area that aren't being worn or carried start burning. *Using a Higher-Level Spell Slot.* The damage increases by 1d6 for each spell slot level above 3.",
    keywords: ['wizard', 'sorcerer', 'fire', 'area'],
  }),
]
