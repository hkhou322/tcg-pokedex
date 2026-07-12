# hkhou322.github.io

Personal GitHub Pages website for [@hkhou322](https://github.com/hkhou322).

## What this is

A minimal, single-page personal site served for free by GitHub Pages at:

**https://hkhou322.github.io**

## Customizing

Everything lives in two files:

- `index.html` — content (name, bio, links). Look for the `🔧 CUSTOMIZE` comments.
- `styles.css` — look & feel. Edit the `:root` variables (colors, width) up top.

After editing, commit and push to the `main` branch:

```bash
git add .
git commit -m "Update site content"
git push
```

Changes appear at https://hkhou322.github.io within a minute or two.

## Publishing setup (one-time)

This repo must be named exactly `hkhou322.github.io` and live under the
`hkhou322` account for the free `*.github.io` URL to work.

1. Create the repo at https://github.com/new — name it `hkhou322.github.io`,
   set it **Public**, and you can leave it empty (don't add a README).
2. Enable Pages: repo **Settings → Pages → Source: Deploy from a branch →
   `main` / `(root)` → Save**.
3. Push these files:
   ```bash
   cd hkhou322.github.io
   git init
   git add .
   git commit -m "Initial personal site"
   git branch -M main
   git remote add origin https://github.com/hkhou322/hkhou322.github.io.git
   git push -u origin main
   ```

Done. Your site is live at https://hkhou322.github.io
