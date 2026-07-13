# TCG Pokédex

A live, searchable **Pokémon Trading Card Game** browser, served as a static site
on GitHub Pages at:

**https://hkhou322.github.io/tcg-pokedex/**

It pulls card data in real time from the free [Pokémon TCG API](https://pokemontcg.io)
(`api.pokemontcg.io/v2`) — no backend, no build step, no database.

## Features

- **Search** cards by name (live, debounced, wildcard match).
- **Filter** by Pokémon type (Fire, Water, Psychic, …) and by set (newest first).
- **Card grid** with artwork, HP, type badges, and set info.
- **Detail modal** on click: large image, attacks/abilities with energy cost & damage,
  weaknesses/resistances/retreat cost, rarity, and flavor text.
- **Load more** pagination; keyboard `Esc` closes the modal; responsive layout.

## Files

- `index.html` — page structure (toolbar, grid, modal).
- `styles.css` — dark Pokéball-red theme, responsive grid & modal.
- `app.js` — fetches from the API, handles search/filters/pagination/modal.

## Local development

It's plain static files, so any static server works:

```bash
cd tcg-pokedex
python -m http.server 8000
# open http://localhost:8000
```

> The `pokemontcg.io` API sends `Access-Control-Allow-Origin: *`, so it works
> straight from `file://` or `localhost` — no proxy needed.

## Deploy

The repo is `hkhou322/tcg-pokedex`. Push to `main` and GitHub Pages (source:
`main` / root) serves it at the URL above within ~1–2 minutes.

```bash
git add index.html styles.css app.js README.md
git commit -m "Update TCG Pokédex"
git push origin main
```

## Notes

- Without an API key, requests are anonymous and subject to rate limits. The UI
  degrades gracefully (skeleton loaders + an error/retry state) if a request fails.
- The set dropdown loads the 60 most recent sets for a usable list; the name
  search/filter covers the whole catalogue.
