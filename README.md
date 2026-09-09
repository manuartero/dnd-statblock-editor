# dnd-statblock-editor

A tiny editor for D&D 5e style stat blocks (monsters or PCs). Click the text in the block to edit it,
add sections from the side menu, drop in an image, and export the result as PNG or share it as a link.

- Nothing is stored. The whole creature is compressed into the URL hash, so the link *is* the save file.
- Sections are modular: the minimum is a name and six ability scores. Add AC/HP/Speed, attribute lines,
  traits, actions, bonus actions, reactions, legendary actions, spellcasting or custom sections as needed.
- Ability modifiers are computed. Everything else is free text.
- `*italic*` and `**bold**` work inside descriptions.

## Run

```sh
pnpm install
pnpm dev
```

Stack: Vite, Preact, TypeScript, CSS Modules, `html-to-image` for PNG export, `lz-string` for the URL.
