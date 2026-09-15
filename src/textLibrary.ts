/**
 * A small library of the text chunks a stat block repeats most: weapon attacks,
 * common monster traits, class features, spellcasting scaffolding and a few
 * spells. Wording follows the System Reference Document (SRD 5.1 for the 2014
 * rules, SRD 5.2 for the 2024 rules, both CC-BY-4.0), with "the creature" as the
 * subject so a snippet reads right in any block.
 */
import { SECTION_LABELS, insertSection, makeEmptySection, uid, type Creature, type Section, type SectionKind } from './model'

export type Edition = '2014' | '2024'
export const EDITIONS: Edition[] = ['2014', '2024']

/** One string when both editions agree, two when the wording differs. */
type Wording = string | Record<Edition, string>

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
  /** Section the entry belongs in. A few features moved section between editions. */
  kind: SectionKind | Record<Edition, SectionKind>
  category: Category
  /** Entry name as printed, e.g. 'Sneak Attack (1/Turn)'. */
  name: Wording
  /** Entry body. */
  text: Wording
  /** Extra search terms. */
  keywords?: string[]
  /** Also sets the section's intro paragraph (spellcasting, legendary actions). */
  intro?: Wording
  /** Title of the custom section this goes into (custom kind only). */
  section?: string
}

/** A snippet with one edition's wording picked. */
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

const pick = <T,>(w: T | Record<Edition, T>, edition: Edition): T =>
  typeof w === 'object' && w !== null && '2014' in (w as object) ? (w as Record<Edition, T>)[edition] : (w as T)

export function resolve(snippet: Snippet, edition: Edition): ResolvedSnippet {
  const kind = pick(snippet.kind, edition)
  const name = pick(snippet.name, edition)
  const text = pick(snippet.text, edition)
  const intro = snippet.intro ? pick(snippet.intro, edition) : null
  const search = [name, snippet.category, sectionLabel(kind, snippet.section), ...(snippet.keywords ?? []), text]
    .join(' ')
    .toLowerCase()
  return { id: snippet.id, kind, category: snippet.category, name, text, intro, section: snippet.section, search }
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
  const label2014 = { melee: 'Melee Weapon Attack', ranged: 'Ranged Weapon Attack', both: 'Melee or Ranged Weapon Attack' }[spec.mode]
  const label2024 = { melee: 'Melee Attack Roll', ranged: 'Ranged Attack Roll', both: 'Melee or Ranged Attack Roll' }[spec.mode]
  const twoHands = spec.mode === 'both' ? 'if used with two hands to make a melee attack' : 'if used with two hands'
  const damage = (type: string) =>
    `${spec.hit} ${type} damage${spec.versatile ? `, or ${spec.versatile} ${type} damage ${twoHands}` : ''}.`
  return {
    id: `attack-${id}`,
    kind: 'actions',
    category: spec.category,
    name,
    text: {
      '2014': `*${label2014}:* +4 to hit, ${where}, one target. *Hit:* ${damage(spec.type)}`,
      '2024': `*${label2024}:* +4, ${where} *Hit:* ${damage(cap(spec.type))}`,
    },
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

const trait = (id: string, name: Wording, text: Wording, keywords: string[] = [], kind: Snippet['kind'] = 'traits'): Snippet => ({
  id: `trait-${id}`,
  kind,
  category: 'Common traits',
  name,
  text,
  keywords,
})

const feature = (id: string, name: Wording, kind: Snippet['kind'], text: Wording, keywords: string[] = []): Snippet => ({
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
  const list2014 = `*${spec.cantrips.join(', ')}*`
  const list2024 = spec.cantrips.map((c) => c.split(' ').map(cap).join(' ')).join(', ')
  return {
    id: `spellcasting-${spec.level.replace(/\D/g, '')}`,
    kind: 'spellcasting',
    category: 'Spellcasting',
    name: { '2014': 'Cantrips (at will)', '2024': 'At Will' },
    text: { '2014': list2014, '2024': list2024 },
    intro: {
      '2014': `The creature is a ${spec.level}-level spellcaster. Its spellcasting ability is Intelligence (spell save DC ${spec.dc}, +${spec.attack} to hit with spell attacks). The creature has the following spells prepared:`,
      '2024': `The creature casts one of the following spells, using Intelligence as the spellcasting ability (spell save DC ${spec.dc}, +${spec.attack} to hit with spell attacks):`,
    },
    keywords: ['spellcaster', 'caster level', 'intro', 'wizard', `${spec.level} level`],
  }
}

/** A spell-list line: italic lowercase names in 2014, capitalised in 2024. */
const spellLine = (id: string, name: Wording, spells: string[], keywords: string[] = []): Snippet => ({
  id: `spells-${id}`,
  kind: 'spellcasting',
  category: 'Spellcasting',
  name,
  text: {
    '2014': `*${spells.join(', ')}*`,
    '2024': spells.map((c) => c.split(' ').map(cap).join(' ')).join(', '),
  },
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
  text: Wording
  keywords?: string[]
}

const ORDINAL = ['cantrip', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th']

/** 2024 books name the casting time by its action: "Action", "Bonus Action", "Reaction". */
const time2024 = (time: string) =>
  time.replace(/^1 (action|bonus action|reaction)/, (_, w: string) => w.split(' ').map(cap).join(' '))

/** A spell for a player-character block: a compact italic header, then the SRD text. */
function spell(id: string, name: string, spec: SpellSpec): Snippet {
  const level2014 = spec.level === 0 ? `${cap(spec.school)} cantrip` : `${ORDINAL[spec.level]}-level ${spec.school}`
  const level2024 = spec.level === 0 ? `${cap(spec.school)} Cantrip` : `Level ${spec.level} ${cap(spec.school)}`
  const head2014 = `*${level2014}${spec.ritual ? ' (ritual)' : ''}: ${spec.time}, ${spec.range}, ${spec.duration}.*`
  const head2024 = `*${level2024}${spec.ritual ? ' (Ritual)' : ''}: ${time2024(spec.time)}, ${cap(spec.range)}, ${cap(spec.duration)}.*`
  return {
    id: `spell-${id}`,
    kind: 'custom',
    section: 'Spells',
    category: 'Spells',
    name,
    text: {
      '2014': `${head2014} ${pick(spec.text, '2014')}`,
      '2024': `${head2024} ${pick(spec.text, '2024')}`,
    },
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
    text: {
      '2014': '*Melee Weapon Attack:* +4 to hit, reach 5 ft., one target. *Hit:* 3 bludgeoning damage.',
      '2024': '*Melee Attack Roll:* +4, reach 5 ft. *Hit:* 3 Bludgeoning damage.',
    },
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
    text: {
      '2014':
        '*Melee Weapon Attack:* +4 to hit, reach 5 ft., one creature. *Hit:* 5 (1d6 + 2) piercing damage, and the target must make a DC 12 Constitution saving throw, taking 7 (2d6) poison damage on a failed save, or half as much damage on a successful one.',
      '2024':
        '*Melee Attack Roll:* +4, reach 5 ft. *Hit:* 5 (1d6 + 2) Piercing damage, and the target is subjected to the following effect. *Constitution Saving Throw:* DC 12. *Failure:* 7 (2d6) Poison damage. *Success:* Half damage.',
    },
    keywords: ['attack', 'melee', 'poison', 'saving throw', 'scorpion', 'wasp'],
  },
  {
    id: 'attack-tentacle',
    kind: 'actions',
    category: 'Natural weapons',
    name: 'Tentacle',
    text: {
      '2014':
        "*Melee Weapon Attack:* +4 to hit, reach 10 ft., one target. *Hit:* 5 (1d6 + 2) bludgeoning damage, and the target is grappled (escape DC 12). Until this grapple ends, the target is restrained, and the creature can't use this tentacle on another target.",
      '2024':
        '*Melee Attack Roll:* +4, reach 10 ft. *Hit:* 5 (1d6 + 2) Bludgeoning damage. If the target is a Large or smaller creature, it has the Grappled condition (escape DC 12) and the Restrained condition until the grapple ends.',
    },
    keywords: ['attack', 'melee', 'grapple', 'restrained', 'reach', 'aberration'],
  },

  // Multiattack
  {
    id: 'multiattack-2',
    kind: 'actions',
    category: 'Multiattack',
    name: 'Multiattack',
    text: {
      '2014': 'The creature makes two melee attacks.',
      '2024': 'The creature makes two attacks, using Shortsword or Shortbow in any combination.',
    },
    keywords: ['two attacks', 'extra attack'],
  },
  {
    id: 'multiattack-3',
    kind: 'actions',
    category: 'Multiattack',
    name: 'Multiattack',
    text: {
      '2014': 'The creature makes three attacks: two with its shortsword and one with its dagger.',
      '2024': 'The creature makes three attacks, using Shortsword or Shortbow in any combination.',
    },
    keywords: ['three attacks', 'extra attack'],
  },

  // Common traits
  trait('amphibious', 'Amphibious', 'The creature can breathe air and water.', ['water', 'breathe']),
  trait('keen-hearing-and-smell', 'Keen Hearing and Smell', {
    '2014': 'The creature has advantage on Wisdom (Perception) checks that rely on hearing or smell.',
    '2024': 'The creature has Advantage on Wisdom (Perception) checks that rely on hearing or smell.',
  }, ['perception', 'wolf', 'beast']),
  trait('keen-sight', 'Keen Sight', {
    '2014': 'The creature has advantage on Wisdom (Perception) checks that rely on sight.',
    '2024': 'The creature has Advantage on Wisdom (Perception) checks that rely on sight.',
  }, ['perception', 'eagle', 'hawk']),
  trait('pack-tactics', 'Pack Tactics', {
    '2014':
      "The creature has advantage on an attack roll against a creature if at least one of the creature's allies is within 5 feet of the creature and the ally isn't incapacitated.",
    '2024':
      "The creature has Advantage on an attack roll against a creature if at least one of the creature's allies is within 5 feet of the creature and the ally doesn't have the Incapacitated condition.",
  }, ['allies', 'wolf', 'kobold']),
  trait('sunlight-sensitivity', 'Sunlight Sensitivity', {
    '2014': 'While in sunlight, the creature has disadvantage on attack rolls, as well as on Wisdom (Perception) checks that rely on sight.',
    '2024': 'While in sunlight, the creature has Disadvantage on ability checks and attack rolls.',
  }, ['drow', 'kobold', 'underdark']),
  trait('magic-resistance', 'Magic Resistance', {
    '2014': 'The creature has advantage on saving throws against spells and other magical effects.',
    '2024': 'The creature has Advantage on saving throws against spells and other magical effects.',
  }, ['saving throws', 'fiend', 'demon']),
  trait('legendary-resistance', 'Legendary Resistance (3/Day)', 'If the creature fails a saving throw, it can choose to succeed instead.', ['boss', 'dragon']),
  trait('spider-climb', 'Spider Climb', 'The creature can climb difficult surfaces, including upside down on ceilings, without needing to make an ability check.', ['climb', 'ceiling']),
  trait('undead-fortitude', 'Undead Fortitude', {
    '2014':
      'If damage reduces the creature to 0 hit points, it must make a Constitution saving throw with a DC of 5 + the damage taken, unless the damage is radiant or from a critical hit. On a success, the creature drops to 1 hit point instead.',
    '2024':
      'If damage reduces the creature to 0 Hit Points, it makes a Constitution saving throw (DC 5 plus the damage taken) unless the damage is Radiant or from a Critical Hit. On a successful save, the creature drops to 1 Hit Point instead.',
  }, ['zombie', 'undead']),
  trait('regeneration', 'Regeneration', {
    '2014':
      "The creature regains 10 hit points at the start of its turn. If the creature takes acid or fire damage, this trait doesn't function at the start of the creature's next turn. The creature dies only if it starts its turn with 0 hit points and doesn't regenerate.",
    '2024':
      "The creature regains 10 Hit Points at the start of each of its turns. If the creature takes Acid or Fire damage, this trait doesn't function on the creature's next turn. The creature dies only if it starts its turn with 0 Hit Points and doesn't regenerate.",
  }, ['troll', 'heal']),
  trait('flyby', 'Flyby', {
    '2014': "The creature doesn't provoke an opportunity attack when it flies out of an enemy's reach.",
    '2024': "The creature doesn't provoke an Opportunity Attack when it flies out of an enemy's reach.",
  }, ['fly', 'bird']),
  trait('nimble-escape', 'Nimble Escape', {
    '2014': 'The creature can take the Disengage or Hide action as a bonus action on each of its turns.',
    '2024': 'The creature takes the Disengage or Hide action.',
  }, ['goblin', 'disengage', 'hide'], 'bonus'),
  trait('shadow-stealth', 'Shadow Stealth', {
    '2014': 'While in dim light or darkness, the creature can take the Hide action as a bonus action.',
    '2024': 'While in Dim Light or Darkness, the creature takes the Hide action.',
  }, ['hide', 'darkness', 'shadow'], { '2014': 'traits', '2024': 'bonus' }),
  trait('aggressive', 'Aggressive', {
    '2014': 'As a bonus action, the creature can move up to its speed toward a hostile creature that it can see.',
    '2024': 'The creature moves up to its Speed toward an enemy it can see.',
  }, ['orc', 'charge', 'move'], 'bonus'),
  trait('brute', 'Brute', 'A melee weapon deals one extra die of its damage when the creature hits with it (included in the attack).', ['bugbear', 'extra die']),
  trait('turn-resistance', 'Turn Resistance', {
    '2014': 'The creature has advantage on saving throws against any effect that turns undead.',
    '2024': 'The creature has Advantage on saving throws against any effect that turns Undead.',
  }, ['undead', 'cleric']),
  trait('incorporeal-movement', 'Incorporeal Movement', {
    '2014': 'The creature can move through other creatures and objects as if they were difficult terrain. It takes 5 (1d10) force damage if it ends its turn inside an object.',
    '2024': 'The creature can move through creatures and objects as if they were Difficult Terrain. It takes 5 (1d10) Force damage if it ends its turn inside an object.',
  }, ['ghost', 'specter', 'walls']),
  trait('charge', 'Charge', {
    '2014':
      'If the creature moves at least 20 feet straight toward a target and then hits it with a gore attack on the same turn, the target takes an extra 3 (1d6) piercing damage. If the target is a creature, it must succeed on a DC 13 Strength saving throw or be knocked prone.',
    '2024':
      'If the creature moves at least 20 feet straight toward a target and then hits it with a Gore attack on the same turn, the target takes an extra 3 (1d6) Piercing damage. If the target is a creature, it must succeed on a DC 13 Strength saving throw or have the Prone condition.',
  }, ['boar', 'gore', 'prone']),
  trait('ambusher', 'Ambusher', {
    '2014': 'In the first round of a combat, the creature has advantage on attack rolls against any creature it surprised.',
    '2024': 'In the first round of a combat, the creature has Advantage on attack rolls against any creature it surprised.',
  }, ['surprise', 'stealth']),
  trait('surprise-attack', 'Surprise Attack', 'If the creature surprises a creature and hits it with an attack during the first round of combat, the target takes an extra 10 (3d6) damage from the attack.', ['bugbear', 'stealth']),
  trait('false-appearance', 'False Appearance', {
    '2014': 'While the creature remains motionless, it is indistinguishable from an ordinary statue.',
    '2024':
      "If the creature is motionless at the start of combat, it has Advantage on its Initiative roll. Moreover, if a creature hasn't observed the creature move or act, that creature must succeed on a DC 15 Intelligence (Investigation) check to discern the creature is animate.",
  }, ['gargoyle', 'mimic', 'statue', 'disguise']),
  trait('hold-breath', 'Hold Breath', 'The creature can hold its breath for 15 minutes.', ['water', 'crocodile']),
  trait('web-sense', 'Web Sense', 'While in contact with a web, the creature knows the exact location of any other creature in contact with the same web.', ['spider']),
  trait('web-walker', 'Web Walker', 'The creature ignores movement restrictions caused by webbing.', ['spider']),
  trait('devils-sight', "Devil's Sight", "Magical darkness doesn't impede the creature's darkvision.", ['darkvision', 'fiend', 'devil']),
  trait('blood-frenzy', 'Blood Frenzy', {
    '2014': "The creature has advantage on melee attack rolls against any creature that doesn't have all its hit points.",
    '2024': "The creature has Advantage on attack rolls against any creature that doesn't have all its Hit Points.",
  }, ['shark', 'sahuagin', 'wounded']),
  trait('mimicry', 'Mimicry', 'The creature can mimic animal sounds and humanoid voices. A creature that hears the sounds can tell they are imitations with a successful DC 14 Wisdom (Insight) check.', ['voice', 'raven', 'kenku']),
  trait('rampage', 'Rampage', {
    '2014': 'When the creature reduces a creature to 0 hit points with a melee attack on its turn, the creature can take a bonus action to move up to half its speed and make a bite attack.',
    '2024': 'Immediately after dealing damage to a creature that is already Bloodied, the creature moves up to half its Speed and makes one Bite attack.',
  }, ['gnoll', 'bonus'], { '2014': 'traits', '2024': 'bonus' }),
  trait('reckless', 'Reckless', {
    '2014': 'At the start of its turn, the creature can gain advantage on all melee weapon attack rolls during that turn, but attack rolls against it have advantage until the start of its next turn.',
    '2024': 'At the start of its turns, the creature can gain Advantage on all melee attack rolls it makes during that turn, but attack rolls against it have Advantage until the start of its next turn.',
  }, ['berserker', 'barbarian']),
  trait('relentless', 'Relentless (Recharges after a Short or Long Rest)', {
    '2014': 'If the creature takes 7 damage or less that would reduce it to 0 hit points, it is reduced to 1 hit point instead.',
    '2024': 'If the creature takes 7 damage or less that would reduce it to 0 Hit Points, it is reduced to 1 Hit Point instead.',
  }, ['boar', 'tough']),
  trait('standing-leap', 'Standing Leap', "The creature's long jump is up to 20 feet and its high jump is up to 10 feet, with or without a running start.", ['jump', 'frog', 'toad']),
  trait('stench', 'Stench', {
    '2014':
      "Any other creature that starts its turn within 5 feet of the creature must succeed on a DC 10 Constitution saving throw or be poisoned until the start of its next turn. On a successful saving throw, that creature is immune to this creature's Stench for 24 hours.",
    '2024':
      '*Constitution Saving Throw:* DC 10, any creature that starts its turn in a 5-foot Emanation originating from the creature. *Failure:* The target has the Poisoned condition until the start of its next turn. *Success:* The target is immune to this Stench for 24 hours.',
  }, ['ghast', 'troglodyte', 'poisoned', 'smell']),
  trait('swarm', 'Swarm', {
    '2014':
      "The swarm can occupy another creature's space and vice versa, and the swarm can move through any opening large enough for a Tiny creature. The swarm can't regain hit points or gain temporary hit points.",
    '2024':
      "The swarm can occupy another creature's space and vice versa, and the swarm can move through any opening large enough for a Tiny creature. The swarm can't regain Hit Points or gain Temporary Hit Points.",
  }, ['rats', 'bats', 'insects']),

  // Class features for player-character blocks
  feature('sneak-attack', 'Sneak Attack (1/Turn)', 'traits', {
    '2014':
      "Once per turn, the creature deals an extra 7 (2d6) damage when it hits a target with a weapon attack and has advantage on the attack roll, or when the target is within 5 feet of an ally of the creature that isn't incapacitated and the creature doesn't have disadvantage on the attack roll.",
    '2024':
      "The creature deals an extra 7 (2d6) damage when it hits a target with a weapon attack and has Advantage on the attack roll, or when the target is within 5 feet of an ally of the creature that doesn't have the Incapacitated condition and the creature doesn't have Disadvantage on the attack roll.",
  }, ['rogue', 'assassin']),
  feature('cunning-action', 'Cunning Action', 'bonus', {
    '2014': 'On each of its turns, the creature can use a bonus action to take the Dash, Disengage, or Hide action.',
    '2024': 'The creature takes the Dash, Disengage, or Hide action.',
  }, ['rogue', 'dash', 'disengage', 'hide']),
  feature('second-wind', 'Second Wind', 'bonus', {
    '2014': 'The creature regains 1d10 + 3 hit points. Once it uses this feature, it must finish a short or long rest before it can use it again.',
    '2024': 'The creature regains 1d10 + 3 Hit Points. It can use this feature twice, regaining one expended use when it finishes a Short Rest and all expended uses when it finishes a Long Rest.',
  }, ['fighter', 'heal', 'hit points']),
  feature('action-surge', 'Action Surge (Recharges after a Short or Long Rest)', 'traits', {
    '2014': 'On its turn, the creature can take one additional action.',
    '2024': 'On its turn, the creature can take one additional action, except the Magic action.',
  }, ['fighter', 'extra action']),
  feature('rage', 'Rage', 'bonus', {
    '2014':
      "The creature enters a rage for 1 minute. While raging, it has advantage on Strength checks and Strength saving throws, deals an extra 2 damage with melee weapon attacks that use Strength, and has resistance to bludgeoning, piercing, and slashing damage. The rage ends early if the creature is knocked unconscious or if its turn ends and it hasn't attacked a hostile creature or taken damage since its last turn.",
    '2024':
      "The creature enters a Rage for 1 minute. While raging, it has Advantage on Strength checks and Strength saving throws, deals an extra 2 damage with Strength-based attacks, and has Resistance to Bludgeoning, Piercing, and Slashing damage. The Rage ends early if the creature has the Incapacitated condition or dons Heavy Armor; otherwise it lasts until the end of the creature's next turn unless it makes an attack roll, forces a saving throw, or takes a Bonus Action to extend it.",
  }, ['barbarian', 'resistance']),
  feature('divine-smite', 'Divine Smite', { '2014': 'traits', '2024': 'bonus' }, {
    '2014':
      "When the creature hits a creature with a melee weapon attack, it can expend one spell slot to deal 9 (2d8) radiant damage to the target, in addition to the weapon's damage, plus 1d8 for each spell level higher than 1st (maximum 5d8). The damage increases by 1d8 if the target is an undead or a fiend.",
    '2024':
      'Immediately after the creature hits a creature with a Melee weapon or an Unarmed Strike, it expends a spell slot to deal an extra 9 (2d8) Radiant damage to the target, plus 1d8 for each spell slot level above 1. The damage increases by 1d8 if the target is a Fiend or an Undead.',
  }, ['paladin', 'radiant', 'smite']),
  feature('lay-on-hands', 'Lay on Hands', { '2014': 'actions', '2024': 'bonus' }, {
    '2014':
      'The creature has a pool of 15 hit points. As an action, it can touch a creature and restore any number of hit points remaining in the pool, or expend 5 hit points from the pool to cure the target of one disease or neutralize one poison affecting it. The pool replenishes when the creature finishes a long rest.',
    '2024':
      'The creature has a pool of 15 Hit Points that replenishes when it finishes a Long Rest. It touches a creature and draws from the pool to restore a number of Hit Points to that creature, up to the maximum amount remaining in the pool. It can also expend 5 Hit Points from the pool to remove the Poisoned condition from the target.',
  }, ['paladin', 'heal', 'healing']),
  feature('martial-arts', 'Martial Arts', 'traits', {
    '2014':
      'The creature can use Dexterity instead of Strength for the attack and damage rolls of its unarmed strikes and monk weapons, roll a d4 in place of the normal damage of its unarmed strike or monk weapon, and, when it uses the Attack action with an unarmed strike or a monk weapon on its turn, make one unarmed strike as a bonus action.',
    '2024':
      'The creature can use Dexterity instead of Strength for the attack and damage rolls of its Unarmed Strikes and Monk weapons, roll a d6 in place of the normal damage of its Unarmed Strike or Monk weapons, and, when it takes the Attack action on its turn with an Unarmed Strike or a Monk weapon, make one Unarmed Strike as a Bonus Action.',
  }, ['monk', 'unarmed']),
  feature('flurry-of-blows', 'Flurry of Blows', 'bonus', {
    '2014': 'Immediately after the creature takes the Attack action on its turn, it can spend 1 ki point to make two unarmed strikes as a bonus action.',
    '2024': 'The creature expends 1 Focus Point to make two Unarmed Strikes.',
  }, ['monk', 'ki', 'focus', 'unarmed']),
  feature('uncanny-dodge', 'Uncanny Dodge', 'reactions', {
    '2014': 'When an attacker that the creature can see hits it with an attack, the creature can use its reaction to halve the attack’s damage against it.',
    '2024': 'When an attacker that the creature can see hits it with an attack roll, the creature halves the attack’s damage against it (round down).',
  }, ['rogue', 'ranger', 'half damage']),
  feature('evasion', 'Evasion', 'traits', {
    '2014':
      'When the creature is subjected to an effect that allows it to make a Dexterity saving throw to take only half damage, it instead takes no damage if it succeeds on the saving throw, and only half damage if it fails.',
    '2024':
      "When the creature is subjected to an effect that allows it to make a Dexterity saving throw to take only half damage, it instead takes no damage if it succeeds on the saving throw and only half damage if it fails. It can't use this feature if it has the Incapacitated condition.",
  }, ['rogue', 'monk', 'dexterity']),
  feature('extra-attack', 'Extra Attack', 'traits', 'The creature can attack twice, instead of once, whenever it takes the Attack action on its turn.', ['fighter', 'multiattack', 'two attacks']),
  feature('bardic-inspiration', 'Bardic Inspiration', 'bonus', {
    '2014':
      'The creature gives one creature other than itself within 60 feet a Bardic Inspiration die, a d6. Once within the next 10 minutes, that creature can roll the die and add the number rolled to one ability check, attack roll, or saving throw it makes. The creature can use this feature 3 times, regaining expended uses when it finishes a long rest.',
    '2024':
      'The creature gives one creature other than itself within 60 feet a Bardic Inspiration die, a d6. Once within the next hour, when that creature fails a D20 Test, it can roll the die and add the number rolled to the d20, potentially turning the failure into a success. The creature can use this feature 3 times, regaining expended uses when it finishes a Long Rest.',
  }, ['bard', 'd6', 'inspire']),

  // Reactions
  {
    id: 'reaction-parry',
    kind: 'reactions',
    category: 'Reactions',
    name: 'Parry',
    text: {
      '2014': 'The creature adds 2 to its AC against one melee attack that would hit it. To do so, the creature must see the attacker and be wielding a melee weapon.',
      '2024': '*Trigger:* The creature is hit by a melee attack roll while holding a weapon. *Response:* The creature adds 2 to its AC against that attack, possibly causing it to miss.',
    },
    keywords: ['ac', 'block', 'knight', 'captain'],
  },
  {
    id: 'reaction-shield',
    kind: 'reactions',
    category: 'Reactions',
    name: 'Shield (Spell)',
    text: {
      '2014':
        'When the creature is hit by an attack or targeted by the *magic missile* spell, it casts *shield*: until the start of its next turn, it has a +5 bonus to AC, including against the triggering attack, and it takes no damage from *magic missile*.',
      '2024':
        '*Trigger:* The creature is hit by an attack roll or targeted by *Magic Missile*. *Response:* The creature casts *Shield*: until the start of its next turn, it has a +5 bonus to AC, including against the triggering attack, and it takes no damage from *Magic Missile*.',
    },
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
    name: { '2014': 'At will', '2024': 'At Will' },
    text: { '2014': '*detect magic, disguise self*', '2024': 'Detect Magic, Disguise Self' },
    intro: {
      '2014':
        "The creature's innate spellcasting ability is Charisma (spell save DC 13, +5 to hit with spell attacks). It can innately cast the following spells, requiring no material components:",
      '2024':
        'The creature casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 13, +5 to hit with spell attacks):',
    },
    keywords: ['innate spellcasting', 'intro', 'charisma', 'fiend', 'fey'],
  },
  // Spell-list lines
  spellLine('cantrips', 'Cantrips (at will)', ['fire bolt', 'light', 'mage hand', 'prestidigitation'], ['cantrip', 'at will']),
  spellLine('1st', '1st level (4 slots)', ['detect magic', 'mage armor', 'magic missile', 'shield'], ['first level']),
  spellLine('2nd', '2nd level (3 slots)', ['misty step', 'suggestion'], ['second level']),
  spellLine('3rd', '3rd level (3 slots)', ['counterspell', 'fireball', 'fly'], ['third level']),
  spellLine('at-will', 'At Will', ['detect magic', 'light', 'mage armor', 'mage hand', 'prestidigitation'], ['2024', 'cantrip']),
  spellLine('2-day', '2/Day Each', ['fireball', 'invisibility'], ['2024', 'per day']),
  spellLine('1-day', '1/Day Each', ['fly', 'lightning bolt'], ['2024', 'per day']),

  // Legendary actions
  {
    id: 'legendary-intro',
    kind: 'legendary',
    category: 'Legendary',
    name: 'Detect',
    text: 'The creature makes a Wisdom (Perception) check.',
    intro: {
      '2014':
        "The creature can take 3 legendary actions, choosing from the options below. Only one legendary action option can be used at a time and only at the end of another creature's turn. The creature regains spent legendary actions at the start of its turn.",
      '2024':
        '*Legendary Action Uses:* 3. Immediately after another creature’s turn, the creature can expend a use to take one of the following actions. The creature regains all expended uses at the start of each of its turns.',
    },
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
    text: {
      '2014':
        'The creature beats its wings. Each creature within 10 feet of the creature must succeed on a DC 15 Dexterity saving throw or take 9 (2d6 + 2) bludgeoning damage and be knocked prone. The creature can then fly up to half its flying speed.',
      '2024':
        'The creature beats its wings. *Dexterity Saving Throw:* DC 15, each creature in a 10-foot Emanation originating from the creature. *Failure:* 9 (2d6 + 2) Bludgeoning damage, and the target has the Prone condition. The creature can then fly up to half its Fly Speed.',
    },
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
    text: {
      '2014':
        "You gain the service of a familiar, a spirit that takes an animal form you choose: bat, cat, crab, frog (toad), hawk, lizard, octopus, owl, poisonous snake, fish (quipper), rat, raven, sea horse, spider, or weasel. It has the statistics of the chosen form, though it is a celestial, fey, or fiend (your choice) instead of a beast. Your familiar acts independently of you, but it always obeys your commands. In combat, it rolls its own initiative and acts on its own turn. A familiar can't attack, but it can take other actions as normal. While your familiar is within 100 feet of you, you can communicate with it telepathically. Additionally, as an action, you can see through your familiar's eyes and hear what it hears until the start of your next turn. When you cast a spell with a range of touch, your familiar can deliver the spell as if it had cast the spell; if the spell requires an attack roll, you use your attack modifier. You can't have more than one familiar at a time. As an action, you can temporarily dismiss it to a pocket dimension or dismiss it forever; recast the spell to call it back or to give it a new form.",
      '2024':
        "You gain the service of a familiar, a spirit that takes an animal form you choose: Bat, Cat, Frog, Hawk, Lizard, Octopus, Owl, Rat, Raven, Spider, Weasel, or another Beast that has a Challenge Rating of 0. It has the statistics of the chosen form, though it is a Celestial, Fey, or Fiend (your choice) instead of a Beast. Your familiar acts independently of you, but it obeys your commands. In combat, it rolls its own Initiative and acts on its own turn. A familiar can't attack, but it can take other actions as normal. While your familiar is within 100 feet of you, you can communicate with it telepathically. Additionally, as a Bonus Action, you can see through the familiar's eyes and hear what it hears until the start of your next turn. When you cast a spell with a range of touch, your familiar can deliver the spell as if it had cast the spell; it must be within 100 feet of you, and it must take a Reaction to deliver the spell when you cast it. You can't have more than one familiar at a time. As a Magic action, you can temporarily dismiss it to a pocket dimension or dismiss it forever; recast the spell to call it back or to give it a new form.",
    },
    keywords: ['wizard', 'pet', 'owl', 'cat'],
  }),
  spell('shield', 'Shield', {
    level: 1,
    school: 'abjuration',
    time: '1 reaction, which you take when you are hit by an attack or targeted by the magic missile spell',
    range: 'self',
    duration: '1 round',
    text: {
      '2014':
        'An invisible barrier of magical force appears and protects you. Until the start of your next turn, you have a +5 bonus to AC, including against the triggering attack, and you take no damage from *magic missile*.',
      '2024':
        'An imperceptible barrier of magical force protects you. Until the start of your next turn, you have a +5 bonus to AC, including against the triggering attack, and you take no damage from *Magic Missile*.',
    },
    keywords: ['wizard', 'sorcerer', 'ac', 'reaction'],
  }),
  spell('mage-armor', 'Mage Armor', {
    level: 1,
    school: 'abjuration',
    time: '1 action',
    range: 'touch',
    duration: '8 hours',
    text: {
      '2014':
        "You touch a willing creature who isn't wearing armor, and a protective magical force surrounds it until the spell ends. The target's base AC becomes 13 + its Dexterity modifier. The spell ends if the target dons armor or if you dismiss the spell as an action.",
      '2024':
        "You touch a willing creature who isn't wearing armor. Until the spell ends, the target's base AC becomes 13 plus its Dexterity modifier. The spell ends early if the target dons armor.",
    },
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
    text: {
      '2014':
        'You create three glowing darts of magical force. Each dart hits a creature of your choice that you can see within range. A dart deals 1d4 + 1 force damage to its target. The darts all strike simultaneously, and you can direct them to hit one creature or several. *At Higher Levels.* The spell creates one more dart for each slot level above 1st.',
      '2024':
        'You create three glowing darts of magical force. Each dart strikes a creature of your choice that you can see within range. A dart deals 1d4 + 1 Force damage to its target. The darts all strike simultaneously, and you can direct them to hit one creature or several. *Using a Higher-Level Spell Slot.* The spell creates one more dart for each spell slot level above 1.',
    },
    keywords: ['wizard', 'sorcerer', 'force'],
  }),
  spell('fire-bolt', 'Fire Bolt', {
    level: 0,
    school: 'evocation',
    time: '1 action',
    range: '120 feet',
    duration: 'instantaneous',
    text: {
      '2014':
        "You hurl a mote of fire at a creature or object within range. Make a ranged spell attack against the target. On a hit, the target takes 1d10 fire damage. A flammable object hit by this spell ignites if it isn't being worn or carried. This spell's damage increases by 1d10 when you reach 5th level (2d10), 11th level (3d10), and 17th level (4d10).",
      '2024':
        "You hurl a mote of fire at a creature or an object within range. Make a ranged spell attack against the target. On a hit, the target takes 1d10 Fire damage. A flammable object hit by this spell starts burning if it isn't being worn or carried. *Cantrip Upgrade.* The damage increases by 1d10 when you reach levels 5 (2d10), 11 (3d10), and 17 (4d10).",
    },
    keywords: ['wizard', 'sorcerer', 'cantrip', 'fire'],
  }),
  spell('cure-wounds', 'Cure Wounds', {
    level: 1,
    school: 'abjuration',
    time: '1 action',
    range: 'touch',
    duration: 'instantaneous',
    text: {
      '2014':
        'A creature you touch regains a number of hit points equal to 1d8 + your spellcasting ability modifier. This spell has no effect on undead or constructs. *At Higher Levels.* The healing increases by 1d8 for each slot level above 1st.',
      '2024':
        'A creature you touch regains a number of Hit Points equal to 2d8 plus your spellcasting ability modifier. *Using a Higher-Level Spell Slot.* The healing increases by 2d8 for each spell slot level above 1.',
    },
    keywords: ['cleric', 'druid', 'paladin', 'ranger', 'heal', 'healing'],
  }),
  spell('healing-word', 'Healing Word', {
    level: 1,
    school: 'abjuration',
    time: '1 bonus action',
    range: '60 feet',
    duration: 'instantaneous',
    text: {
      '2014':
        'A creature of your choice that you can see within range regains hit points equal to 1d4 + your spellcasting ability modifier. This spell has no effect on undead or constructs. *At Higher Levels.* The healing increases by 1d4 for each slot level above 1st.',
      '2024':
        'A creature of your choice that you can see within range regains Hit Points equal to 2d4 plus your spellcasting ability modifier. *Using a Higher-Level Spell Slot.* The healing increases by 2d4 for each spell slot level above 1.',
    },
    keywords: ['cleric', 'bard', 'druid', 'heal', 'healing', 'bonus action'],
  }),
  spell('hunters-mark', "Hunter's Mark", {
    level: 1,
    school: 'divination',
    time: '1 bonus action',
    range: '90 feet',
    duration: 'concentration, up to 1 hour',
    text: {
      '2014':
        'You choose a creature you can see within range and mystically mark it as your quarry. Until the spell ends, you deal an extra 1d6 damage to the target whenever you hit it with a weapon attack, and you have advantage on any Wisdom (Perception) or Wisdom (Survival) check you make to find it. If the target drops to 0 hit points before this spell ends, you can use a bonus action on a subsequent turn of yours to mark a new creature. *At Higher Levels.* With a 3rd- or 4th-level slot, you can maintain concentration for up to 8 hours; with a 5th-level slot or higher, up to 24 hours.',
      '2024':
        'You magically mark one creature you can see within range as your quarry. Until the spell ends, you deal an extra 1d6 Force damage to the target whenever you hit it with an attack roll. You also have Advantage on any Wisdom (Perception or Survival) check you make to find it. If the target drops to 0 Hit Points before this spell ends, you can take a Bonus Action to move the mark to a new creature you can see within range. *Using a Higher-Level Spell Slot.* Your Concentration can last longer with a spell slot of level 3–4 (up to 8 hours) or 5+ (up to 24 hours).',
    },
    keywords: ['ranger', 'bonus action', 'concentration'],
  }),
  spell('bless', 'Bless', {
    level: 1,
    school: 'enchantment',
    time: '1 action',
    range: '30 feet',
    duration: 'concentration, up to 1 minute',
    text: {
      '2014':
        'You bless up to three creatures of your choice within range. Whenever a target makes an attack roll or a saving throw before the spell ends, the target can roll a d4 and add the number rolled to the attack roll or saving throw. *At Higher Levels.* You can target one additional creature for each slot level above 1st.',
      '2024':
        'You bless up to three creatures within range. Whenever a target makes an attack roll or a saving throw before the spell ends, the target adds 1d4 to the attack roll or save. *Using a Higher-Level Spell Slot.* You can target one additional creature for each spell slot level above 1.',
    },
    keywords: ['cleric', 'paladin', 'concentration', 'd4'],
  }),
  spell('eldritch-blast', 'Eldritch Blast', {
    level: 0,
    school: 'evocation',
    time: '1 action',
    range: '120 feet',
    duration: 'instantaneous',
    text: {
      '2014':
        'A beam of crackling energy streaks toward a creature within range. Make a ranged spell attack against the target. On a hit, the target takes 1d10 force damage. The spell creates more than one beam when you reach higher levels: two beams at 5th level, three beams at 11th level, and four beams at 17th level. You can direct the beams at the same target or at different ones. Make a separate attack roll for each beam.',
      '2024':
        'A beam of crackling energy streaks toward a creature within range. Make a ranged spell attack against the target. On a hit, the target takes 1d10 Force damage. *Cantrip Upgrade.* The spell creates two beams at level 5, three beams at level 11, and four beams at level 17. You can direct the beams at the same target or at different ones. Make a separate attack roll for each beam.',
    },
    keywords: ['warlock', 'cantrip', 'force'],
  }),
  spell('guidance', 'Guidance', {
    level: 0,
    school: 'divination',
    time: '1 action',
    range: 'touch',
    duration: 'concentration, up to 1 minute',
    text: {
      '2014':
        'You touch one willing creature. Once before the spell ends, the target can roll a d4 and add the number rolled to one ability check of its choice. It can roll the die before or after making the ability check. The spell then ends.',
      '2024':
        'You touch a willing creature and choose a skill. Until the spell ends, the creature adds 1d4 to any ability check using the chosen skill.',
    },
    keywords: ['cleric', 'druid', 'cantrip', 'd4', 'ability check'],
  }),
  spell('detect-magic', 'Detect Magic', {
    level: 1,
    school: 'divination',
    ritual: true,
    time: '1 action',
    range: 'self',
    duration: 'concentration, up to 10 minutes',
    text: {
      '2014':
        'For the duration, you sense the presence of magic within 30 feet of you. If you sense magic in this way, you can use your action to see a faint aura around any visible creature or object in the area that bears magic, and you learn its school of magic, if any. The spell can penetrate most barriers, but it is blocked by 1 foot of stone, 1 inch of common metal, a thin sheet of lead, or 3 feet of wood or dirt.',
      '2024':
        "For the duration, you sense the presence of magical effects within 30 feet of yourself. If you sense such effects, you can take the Magic action to see a faint aura around any visible creature or object in the area that bears the magic, and if an effect was created by a spell, you learn the spell's school of magic. The spell is blocked by 1 foot of stone, dirt, or wood; 1 inch of metal; or a thin sheet of lead.",
    },
    keywords: ['ritual', 'concentration', 'aura'],
  }),
  spell('counterspell', 'Counterspell', {
    level: 3,
    school: 'abjuration',
    time: '1 reaction, which you take when you see a creature within 60 feet of you casting a spell',
    range: '60 feet',
    duration: 'instantaneous',
    text: {
      '2014':
        "You attempt to interrupt a creature in the process of casting a spell. If the creature is casting a spell of 3rd level or lower, its spell fails and has no effect. If it is casting a spell of 4th level or higher, make an ability check using your spellcasting ability. The DC equals 10 + the spell's level. On a success, the creature's spell fails and has no effect. *At Higher Levels.* The interrupted spell has no effect if its level is less than or equal to the level of the spell slot you used.",
      '2024':
        "You attempt to interrupt a creature in the process of casting a spell. The target must succeed on a Constitution saving throw, or the spell dissipates with no effect, and the action, Bonus Action, or Reaction used to cast it is wasted. If that spell was cast with a spell slot, the slot isn't expended.",
    },
    keywords: ['wizard', 'sorcerer', 'warlock', 'reaction'],
  }),
  spell('fireball', 'Fireball', {
    level: 3,
    school: 'evocation',
    time: '1 action',
    range: '150 feet',
    duration: 'instantaneous',
    text: {
      '2014':
        "A bright streak flashes from your pointing finger to a point you choose within range and then blossoms with a low roar into an explosion of flame. Each creature in a 20-foot-radius sphere centered on that point must make a Dexterity saving throw. A target takes 8d6 fire damage on a failed save, or half as much damage on a successful one. The fire spreads around corners. It ignites flammable objects in the area that aren't being worn or carried. *At Higher Levels.* The damage increases by 1d6 for each slot level above 3rd.",
      '2024':
        "A bright streak flashes from you to a point you choose within range and then blossoms with a low roar into a fiery explosion. Each creature in a 20-foot-radius Sphere centered on that point makes a Dexterity saving throw, taking 8d6 Fire damage on a failed save or half as much damage on a successful one. Flammable objects in the area that aren't being worn or carried start burning. *Using a Higher-Level Spell Slot.* The damage increases by 1d6 for each spell slot level above 3.",
    },
    keywords: ['wizard', 'sorcerer', 'fire', 'area'],
  }),
]
