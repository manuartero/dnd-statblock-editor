# BG3 iconography

Game icons fetched from [bg3.wiki](https://bg3.wiki) by `scripts/fetch-bg3-icons.mjs` (`pnpm icons`).
Do not edit these files by hand; re-run the script instead. `manifest.json` lists every icon with
its original wiki title, source page, size and checksum.

## Folders

| Folder | What is in it |
| --- | --- |
| `dice/` | d4, d6, d8, d10, d12, d20 in every damage colour (`d8-fire.png`, `d20.png`) |
| `damage-types/` | acid, bludgeoning, cold, fire, force, lightning, necrotic, piercing, poison, psychic, radiant, slashing, thunder |
| `resources/` | action, bonus action, reaction, movement, spell slot, class charges |
| `interface/` | saving throw, attack roll, concentration, range, duration, proficiency, upcast, ritual... |
| `abilities/` | the six ability scores |
| `skills/` | the eighteen skills |
| `weapon-types/` | one icon per weapon type (longswords, hand crossbows...) |
| `hud/`, `menu/`, `map/`, `generic/` | other UI iconography |
| `classes/` | class and subclass badges and hotbar icons |
| `races/`, `backgrounds/`, `deities/` | character-creation icons |
| `spells/` | one icon per spell |
| `actions/`, `weapon-actions/`, `legendary-actions/`, `passive-features/`, `tadpole/`, `areas/` | non-spell abilities |
| `conditions/` | status-effect icons |
| `items/` | item icons, mirroring the wiki tree: `items/equipment/weapon/longsword/`, `items/consumable/potion/`... |
| `achievements/` | achievement badges |

File names are the wiki title in kebab-case with the `Icon` / `Unfaded Icon` suffix dropped:
`File:Hold Person Unfaded Icon.webp` becomes `spells/hold-person.webp`.

## Attribution

The wiki text is CC BY-NC-SA 4.0; the icons themselves are © Larian Studios and are
reproduced here for a non-commercial fan tool. See <https://bg3.wiki/wiki/Bg3.wiki:Copyrights>.
