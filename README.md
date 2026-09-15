# dnd-statblock-editor

A tiny editor for D&D 5e style stat blocks (monsters or PCs). Click the text in the block to edit it,
add sections from the side menu, drop in an image, and export the result as PNG or share it as a link.

- The whole creature is compressed into the URL hash, so a link *is* a portable copy of the creature.
- Saves live in your browser's localStorage (no account, nothing leaves the machine): Save / Save as new,
  and a Library screen to load, rename, duplicate or delete them.
- Export JSON downloads a versioned file (`{ schemaVersion, id, savedAt, updatedAt, creature }`);
  Import JSON reads one back, filling in defaults for missing fields and rejecting anything malformed.
- Sections are modular: the minimum is a name and six ability scores. Add AC/HP/Speed, attribute lines,
  traits, actions, bonus actions, reactions, legendary actions, spellcasting or custom sections as needed.
- Ability modifiers are computed. Everything else is free text.
- `*italic*` and `**bold**` work inside descriptions.
- Optional iconography (Layout → Iconography): weapon icons after attack names ("Shortsword"),
  a die icon before every `1d6`, a damage-type icon after every "piercing damage", and one pip per
  spell slot in the spellcasting section ("1st level (4 slots)", "3/day each", cantrips).

## Text library

Stat blocks repeat the same chunks of text: a shortsword attack, Pack Tactics, a Sneak Attack paragraph,
a spellcasting intro. The library holds about 120 of those in the rulebook wording, so you pick them
instead of typing them.

- Open it from the side menu (**Insert from library…**) or with `Cmd/Ctrl+K`. Search, filter by category,
  move with the arrow keys and press Enter: the entry lands in the first matching section (Actions,
  Traits, Spells…), which is created if the block has none.
- Every section also has a **+ from library** button next to **+ entry**; it opens the picker filtered to
  that section and inserts there.

The wording follows the 2024 rules ("*Melee Attack Roll:* +4…"), as published in the System Reference
Document 5.2. This work includes material from the System Reference Document 5.2 by Wizards of the Coast
LLC, available at <https://www.dndbeyond.com/srd>, licensed under the Creative Commons Attribution 4.0
International License (<https://creativecommons.org/licenses/by/4.0/legalcode>).

## Run

```sh
pnpm install
pnpm dev
```

Stack: Vite, Preact, TypeScript, CSS Modules, `html-to-image` for PNG export, `lz-string` for the URL.

## Icons

Game iconography (dice, damage types, actions, spells, classes, weapons...) comes from
[bg3.wiki](https://bg3.wiki) and lives in `public/icons/bg3/`, sorted into folders by the wiki's
own file categories. See `public/icons/bg3/README.md` for the folder map.

```sh
pnpm icons                  # fetch everything; re-runs only download changed files
pnpm icons -- --only spells # one folder (prefix match)
pnpm icons -- --dry-run     # show what would be fetched
```
