# dnd-statblock-editor

A tiny editor for D&D 5e style stat blocks (monsters or PCs). Click the text in the block to edit it,
add sections from the side menu, drop in an image, and export the result as PNG or share it as a link.

- Nothing is stored. The whole creature is compressed into the URL hash, so the link *is* the save file.
- Sections are modular: the minimum is a name and six ability scores. Add AC/HP/Speed, attribute lines,
  traits, actions, bonus actions, reactions, legendary actions, spellcasting or custom sections as needed.
- Ability modifiers are computed. Everything else is free text.
- `*italic*` and `**bold**` work inside descriptions.
- Optional iconography (Layout → Iconography): weapon icons after attack names ("Shortsword"),
  a die icon before every `1d6`, a damage-type icon after every "piercing damage", and one pip per
  spell slot in the spellcasting section ("1st level (4 slots)", "3/day each", cantrips).

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
