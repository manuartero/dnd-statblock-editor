export const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const
export type Ability = (typeof ABILITIES)[number]

export interface Entry {
  id: string
  name: string
  text: string
}

export type SectionKind =
  | 'traits'
  | 'actions'
  | 'bonus'
  | 'reactions'
  | 'legendary'
  | 'spellcasting'
  | 'custom'

export interface Section {
  id: string
  kind: SectionKind
  /** Empty title renders the entries without a heading (traits). */
  title: string
  /** Optional italic paragraph under the heading (legendary actions, spellcasting). */
  intro: string | null
  entries: Entry[]
}

export interface AttrLine {
  id: string
  label: string
  value: string
}

export interface Core {
  ac: string
  hp: string
  speed: string
}

export interface Creature {
  name: string
  subtitle: string
  core: Core | null
  abilities: Record<Ability, number>
  attributes: AttrLine[]
  sections: Section[]
  /** URL or data URL. Rendered as full-page art behind the block. */
  image: string | null
  columns: 1 | 2
}

export const uid = () => Math.random().toString(36).slice(2, 8)

export const modifier = (score: number) => {
  const m = Math.floor((score - 10) / 2)
  return `${m >= 0 ? '+' : ''}${m}`
}

export const ATTRIBUTE_PRESETS = [
  'Saving Throws',
  'Skills',
  'Damage Vulnerabilities',
  'Damage Resistances',
  'Damage Immunities',
  'Condition Immunities',
  'Senses',
  'Languages',
  'Challenge',
  'Proficiency Bonus',
]

/** Labels rendered side by side on one line, as in the official books. */
export const INLINE_ATTRIBUTES = new Set(['Challenge', 'Proficiency Bonus'])

export const SECTION_PRESETS: Record<SectionKind, Omit<Section, 'id' | 'kind'>> = {
  traits: {
    title: '',
    intro: null,
    entries: [{ id: '', name: 'Trait', text: 'Describe the trait.' }],
  },
  actions: {
    title: 'Actions',
    intro: null,
    entries: [
      {
        id: '',
        name: 'Attack',
        text: '*Melee Weapon Attack:* +4 to hit, reach 5 ft., one target. *Hit:* 5 (1d6 + 2) slashing damage.',
      },
    ],
  },
  bonus: {
    title: 'Bonus Actions',
    intro: null,
    entries: [{ id: '', name: 'Bonus Action', text: 'Describe the bonus action.' }],
  },
  reactions: {
    title: 'Reactions',
    intro: null,
    entries: [{ id: '', name: 'Reaction', text: 'Describe the reaction.' }],
  },
  legendary: {
    title: 'Legendary Actions',
    intro:
      'The creature can take 3 legendary actions, choosing from the options below. Only one legendary action option can be used at a time and only at the end of another creature\'s turn. The creature regains spent legendary actions at the start of its turn.',
    entries: [
      { id: '', name: 'Detect', text: 'The creature makes a Wisdom (Perception) check.' },
      { id: '', name: 'Attack (Costs 2 Actions)', text: 'The creature makes one attack.' },
    ],
  },
  spellcasting: {
    title: 'Spellcasting',
    intro:
      'The creature is a 5th-level spellcaster. Its spellcasting ability is Intelligence (spell save DC 14, +6 to hit with spell attacks).',
    entries: [
      { id: '', name: 'Cantrips (at will)', text: 'fire bolt, mage hand, prestidigitation' },
      { id: '', name: '1st level (4 slots)', text: 'magic missile, shield' },
    ],
  },
  custom: {
    title: 'Section',
    intro: null,
    entries: [{ id: '', name: 'Entry', text: 'Describe it.' }],
  },
}

export const SECTION_LABELS: Record<SectionKind, string> = {
  traits: 'Traits',
  actions: 'Actions',
  bonus: 'Bonus Actions',
  reactions: 'Reactions',
  legendary: 'Legendary Actions',
  spellcasting: 'Spellcasting',
  custom: 'Custom section',
}

export function makeSection(kind: SectionKind): Section {
  const preset = SECTION_PRESETS[kind]
  return {
    id: uid(),
    kind,
    title: preset.title,
    intro: preset.intro,
    entries: preset.entries.map((e) => ({ ...e, id: uid() })),
  }
}

export function makeEntry(): Entry {
  return { id: uid(), name: 'Name', text: 'Describe it.' }
}

export function makeAttribute(label: string): AttrLine {
  return { id: uid(), label, value: '—' }
}

export const blankCreature = (): Creature => ({
  name: 'Creature',
  subtitle: 'Medium humanoid, any alignment',
  core: { ac: '10', hp: '10 (2d8 + 1)', speed: '30 ft.' },
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  attributes: [],
  sections: [],
  image: null,
  columns: 1,
})

export const sampleCreature = (): Creature => ({
  name: 'Skeleton',
  subtitle: 'Medium undead, lawful evil',
  core: { ac: '13 (armor scraps)', hp: '13 (2d8 + 4)', speed: '30 ft.' },
  abilities: { str: 10, dex: 14, con: 15, int: 6, wis: 8, cha: 5 },
  attributes: [
    { id: uid(), label: 'Damage Vulnerabilities', value: 'bludgeoning' },
    { id: uid(), label: 'Damage Immunities', value: 'poison' },
    { id: uid(), label: 'Condition Immunities', value: 'exhaustion, poisoned' },
    { id: uid(), label: 'Senses', value: 'darkvision 60 ft., passive Perception 9' },
    { id: uid(), label: 'Languages', value: "understands all languages it knew in life but can't speak" },
    { id: uid(), label: 'Challenge', value: '1/4 (50 XP)' },
    { id: uid(), label: 'Proficiency Bonus', value: '+2' },
  ],
  sections: [
    {
      id: uid(),
      kind: 'actions',
      title: 'Actions',
      intro: null,
      entries: [
        {
          id: uid(),
          name: 'Shortsword',
          text: '*Melee Weapon Attack:* +4 to hit, reach 5 ft., one target. *Hit:* 5 (1d6 + 2) piercing damage.',
        },
        {
          id: uid(),
          name: 'Shortbow',
          text: '*Ranged Weapon Attack:* +4 to hit, range 80/320 ft., one target. *Hit:* 5 (1d6 + 2) piercing damage.',
        },
      ],
    },
  ],
  image: null,
  columns: 1,
})

/** Book order: traits, spellcasting, actions, bonus actions, reactions, legendary, then custom. */
const SECTION_ORDER: SectionKind[] = ['traits', 'spellcasting', 'actions', 'bonus', 'reactions', 'legendary', 'custom']

/** Inserts a section after the last one of the same or an earlier kind. */
export function insertSection(sections: Section[], section: Section): Section[] {
  const rank = (kind: SectionKind) => SECTION_ORDER.indexOf(kind)
  let index = sections.length
  while (index > 0 && rank(sections[index - 1].kind) > rank(section.kind)) index--
  return [...sections.slice(0, index), section, ...sections.slice(index)]
}
