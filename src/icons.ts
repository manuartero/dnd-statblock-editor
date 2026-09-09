/**
 * Opt-in game iconography (BG3 wiki icons in public/icons/bg3). Everything here
 * is best-effort text matching: a stat block is free text, so we look for the
 * words a 5e block conventionally uses and decorate them.
 */

const BASE = `${import.meta.env.BASE_URL}icons/bg3/`

const icon = (file: string, kind: string, alt: string) =>
  `<img class="icon icon-${kind}" src="${BASE}${file}" alt="${alt}" draggable="false">`

/* ------------------------------------------------------------------ weapons */

/**
 * Weapon name (as written in a stat block) → file in weapon-types/.
 * A space in a name is optional when matching: "shortsword" and "short sword" both work.
 */
const WEAPONS: Record<string, string> = {
  'battle axe': 'battleaxes',
  club: 'clubs',
  dagger: 'daggers',
  dart: 'darts',
  flail: 'flails',
  glaive: 'glaives',
  'great axe': 'greataxes',
  'great club': 'greatclubs',
  'great sword': 'greatswords',
  halberd: 'halberds',
  'hand crossbow': 'hand-crossbows',
  'hand axe': 'handaxes',
  'heavy crossbow': 'heavy-crossbows',
  javelin: 'javelins',
  'light crossbow': 'light-crossbows',
  'light hammer': 'light-hammers',
  'long bow': 'longbows',
  'long sword': 'longswords',
  mace: 'maces',
  maul: 'mauls',
  'morning star': 'morningstars',
  pike: 'pikes',
  'quarter staff': 'quarterstaves',
  rapier: 'rapiers',
  scimitar: 'scimitars',
  'short bow': 'shortbows',
  'short sword': 'shortswords',
  sickle: 'sickles',
  sling: 'slings',
  spear: 'spears',
  trident: 'tridents',
  'war pick': 'war-picks',
  'war hammer': 'warhammers',
  // loose aliases, matched only when nothing more specific fits
  staff: 'quarterstaves',
  crossbow: 'light-crossbows',
  bow: 'longbows',
  sword: 'longswords',
  axe: 'battleaxes',
  hatchet: 'handaxes',
  hammer: 'warhammers',
  knife: 'daggers',
  cudgel: 'clubs',
  pitchfork: 'tridents',
}

const plural = (word: string) =>
  word.endsWith('ff') ? `${word.slice(0, -2)}(?:ff|ves)` : word.endsWith('fe') ? `${word.slice(0, -2)}(?:fe|ves)` : `${word}s?`

/** Longest names first so "shortsword" beats "sword" and "hand crossbow" beats "crossbow". */
const WEAPON_PATTERNS = Object.entries(WEAPONS)
  .sort(([a], [b]) => b.length - a.length)
  .map(([name, file]) => ({
    file,
    re: new RegExp(`\\b${plural(name).replace(/ /g, '\\s?')}\\b`, 'i'),
  }))

/** Icon URL for a weapon mentioned in an action name ("Shortsword", "+1 Longbow (two-handed)"). */
export function weaponIcon(name: string): string | null {
  const hit = WEAPON_PATTERNS.find(({ re }) => re.test(name))
  return hit ? `${BASE}weapon-types/${hit.file}.png` : null
}

/* -------------------------------------------------------------- spell slots */

export interface SlotIcons {
  src: string
  count: number
  alt: string
}

/**
 * Spell slots are never written literally in a block, only implied:
 * "1st level (4 slots)", "Cantrips (at will)", "3/day each". Turn those into
 * one slot pip per slot, or the cantrip badge for at-will casting.
 */
export function spellSlotIcons(entryName: string): SlotIcons | null {
  const slots = entryName.match(/(\d+)\s*(?:slots?|\/\s*day)/i)
  if (slots) {
    const count = Math.min(parseInt(slots[1], 10), 9)
    return { src: `${BASE}resources/spell-slot.png`, count, alt: 'spell slot' }
  }
  if (/cantrip|at will/i.test(entryName)) {
    return { src: `${BASE}interface/ico-classcantrip.png`, count: 1, alt: 'cantrip' }
  }
  return null
}

/* ------------------------------------------------------- damage and dice */

const DAMAGE_TYPES = [
  'acid',
  'bludgeoning',
  'cold',
  'fire',
  'force',
  'lightning',
  'necrotic',
  'piercing',
  'poison',
  'psychic',
  'radiant',
  'slashing',
  'thunder',
] as const
type DamageType = (typeof DAMAGE_TYPES)[number]

const PHYSICAL = new Set<string>(['bludgeoning', 'piercing', 'slashing'])
const TYPE_ALT = `(?:${DAMAGE_TYPES.join('|')})`
const NEAR_TYPE = new RegExp(`\\b(${DAMAGE_TYPES.join('|')})\\b|\\b(hit points?|healing|heals?|regains?)\\b`, 'i')

/**
 * One combined pass: dice expressions and "<type> damage" phrases, in order.
 * An opening parenthesis before the dice and punctuation after "damage" are
 * captured too, so the icon can be kept on the same line as them.
 */
const TOKEN = new RegExp(
  `(\\(?)\\b(\\d+d(?:4|6|8|10|12|20))\\b|\\b(${TYPE_ALT}\\s+damage)\\b([.,;:]?)`,
  'gi',
)

/** Browsers may wrap before or after an inline image; keep icon and text together. */
const group = (html: string) => `<span class="icon-group">${html}</span>`

/** The dice folder colours dice by damage family: physical, an element, or healing. */
function dieColour(text: string, at: number): string {
  const after = text.slice(at, at + 70).match(NEAR_TYPE)
  const before = after ? null : text.slice(Math.max(0, at - 70), at).match(NEAR_TYPE)
  const hit = after ?? before
  if (!hit) return 'physical'
  if (hit[2]) return 'healing'
  const type = hit[1].toLowerCase() as DamageType
  return PHYSICAL.has(type) ? 'physical' : type
}

/**
 * Decorates already-rendered inline HTML (escaped, with <b>/<i>) with a die icon
 * before every dice expression and a damage-type icon after every "x damage".
 */
export function iconifyHtml(html: string): string {
  return html.replace(
    TOKEN,
    (match, paren: string, dice: string | undefined, phrase: string | undefined, punct: string, offset: number) => {
      if (dice) {
        const size = dice.slice(dice.indexOf('d'))
        const file = size === 'd20' ? 'd20' : `${size}-${dieColour(html, offset + match.length)}`
        return group(`${paren}${icon(`dice/${file}.png`, 'die', size)}${dice}`)
      }
      const type = phrase!.split(/\s+/)[0].toLowerCase()
      return group(`${phrase}${icon(`damage-types/${type}-damage.png`, 'damage', type)}${punct}`)
    },
  )
}
