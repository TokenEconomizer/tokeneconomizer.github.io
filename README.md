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

- **Numbers in charts and tables.** `assets/js/data.js` is generated from the paper's tables by
  `scripts/build_page_assets.py` in the paper repository, which also renders the figures in
  `assets/img/fig_*`. Re-run that script instead of editing these files by hand. The numbers in the
  prose of `index.html` are written out and must be updated by hand.
- **arXiv link and BibTeX.** Once the paper is on arXiv, replace `XXXX.XXXXX` in the arXiv button's
  link in `index.html` with its identifier, and add the identifier to the BibTeX entry's `journal`
  field.
