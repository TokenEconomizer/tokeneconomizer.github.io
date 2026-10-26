# tokeneconomizer.github.io

Project page for **TokenEconomizer: Experience-Driven Black-Box Cost Control for Coding Agents**,
served at <https://tokeneconomizer.github.io>.

It is a static site with no build step: `index.html`, plus `assets/css`, `assets/js`, and `assets/img`.
`.nojekyll` makes GitHub Pages serve the files as they are.

## Preview locally

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

## Updating

- **Numbers in charts and tables.** `assets/js/data.js` is generated from the paper's tables and
  figures by `scripts/build_page_assets.py` in the paper repository. Re-run that script instead of
  editing the file by hand. The numbers in the prose of `index.html` are written out and must be
  updated by hand.
- **The teaser.** `assets/img/teaser.{webm,mp4,png}` are drawn by `docs/assets/teaser.py` in the
  [code repository](https://github.com/microsoft/TokenEconomizer):
  `python docs/assets/teaser.py --plex FONTS --page <this repo>/assets/img` (its docstring says
  where to get the IBM Plex fonts).
