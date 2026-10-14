/* TokenEconomizer project page: charts, examples, and small interactions.
 *
 * Numbers come from data.js (generated from the paper's tables); the appendix examples
 * below are transcribed from the paper. Charts are plain SVG, coloured from the CSS
 * tokens, and redrawn on resize and on a theme change.
 */
(() => {
  "use strict";
  const D = window.TE_DATA;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const root = document.documentElement;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const MINUS = "−";
  const sign = (v, d = 1) => (v > 0 ? "+" : v < 0 ? MINUS : "") + Math.abs(v).toFixed(d);
  const pct = (v, d = 1) => sign(v, d) + "%";
  const tok = (name) => getComputedStyle(root).getPropertyValue(name).trim();
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const settingOf = Object.fromEntries(D.settings.map((s) => [s.id, s]));
  const settingName = (id) => `${settingOf[id].agent} · ${settingOf[id].model}`;
  const REPO_NAME = { "scikit-learn": "scikit-learn", sympy: "SymPy", django: "Django", sphinx: "Sphinx", matplotlib: "Matplotlib", xarray: "xarray" };

  const METHOD = {
    medium: { label: "Effort: medium", color: "--m-effort", marker: "triUp" },
    low: { label: "Effort: low", color: "--m-effort", marker: "triDown" },
    rtk: { label: "RTK", color: "--m-rtk", marker: "circle" },
    serena: { label: "Serena", color: "--m-serena", marker: "triUp" },
    repomap: { label: "RepoMap", color: "--m-repomap", marker: "square" },
    te: { label: "TokenEconomizer", short: "TE", color: "--m-te", marker: "circle" },
    te_rtk: { label: "TE + RTK", color: "--m-te-rtk", marker: "diamond" },
    te_repomap: { label: "TE + RepoMap", color: "--m-te-repomap", marker: "plus" },
  };

  /* ---------------------------------------------------------------- svg helpers */
  const NS = "http://www.w3.org/2000/svg";
  function el(tag, attrs = {}, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function text(parent, x, y, str, attrs = {}) {
    const t = el("text", { x, y, fill: tok(attrs.class === "ink" ? "--ink" : "--muted"), ...attrs }, parent);
    t.textContent = str;
    return t;
  }
  // Marker shapes, centred on (0, 0), roughly equal in area at size r.
  function marker(parent, shape, x, y, r, fill, extra = {}) {
    const ring = tok("--surface");
    const common = { fill, stroke: ring, "stroke-width": 1.4, ...extra };
    switch (shape) {
      case "square":
        return el("rect", { x: x - r * .88, y: y - r * .88, width: r * 1.76, height: r * 1.76, rx: 1.2, ...common }, parent);
      case "triUp":
        return el("path", { d: `M${x},${y - r * 1.15}L${x + r * 1.1},${y + r * .75}L${x - r * 1.1},${y + r * .75}Z`, ...common }, parent);
      case "triDown":
        return el("path", { d: `M${x},${y + r * 1.15}L${x + r * 1.1},${y - r * .75}L${x - r * 1.1},${y - r * .75}Z`, ...common }, parent);
      case "diamond":
        return el("path", { d: `M${x},${y - r * 1.2}L${x + r * 1.05},${y}L${x},${y + r * 1.2}L${x - r * 1.05},${y}Z`, ...common }, parent);
      case "plus": {
        const a = r * 1.05, b = r * .38;
        return el("path", { d: `M${x - b},${y - a}h${2 * b}v${a - b}h${a - b}v${2 * b}h${b - a}v${a - b}h${-2 * b}v${b - a}h${b - a}v${-2 * b}h${a - b}Z`, ...common }, parent);
      }
      case "star": {
        let d = "";
        for (let i = 0; i < 10; i++) {
          const rr = i % 2 ? r * .5 : r * 1.25, a = Math.PI / 5 * i - Math.PI / 2;
          d += (i ? "L" : "M") + (x + rr * Math.cos(a)).toFixed(2) + "," + (y + rr * Math.sin(a)).toFixed(2);
        }
        return el("path", { d: d + "Z", ...common }, parent);
      }
      default:
        return el("circle", { cx: x, cy: y, r, ...common }, parent);
    }
  }
  function legendSwatch(shape, colorVar) {
    const s = document.createElementNS(NS, "svg");
    s.setAttribute("viewBox", "-7 -7 14 14");
    s.setAttribute("aria-hidden", "true");
    marker(s, shape, 0, 0, 4.6, `var(${colorVar})`, { stroke: "none" });
    return s;
  }
  const scale = (d0, d1, r0, r1) => (v) => r0 + (v - d0) / (d1 - d0) * (r1 - r0);
  const niceTicks = (lo, hi, step) => { const t = []; for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) t.push(+v.toFixed(6)); return t; };

  /* ---------------------------------------------------------------- tooltip */
  const tip = $("#tooltip");
  function showTip(html, x, y) {
    tip.innerHTML = html;
    tip.classList.add("on");
    const w = tip.offsetWidth, h = tip.offsetHeight, pad = 12;
    let left = x + 14, top = y - h - 12;
    if (left + w > innerWidth - pad) left = x - w - 14;
    if (top < pad) top = y + 18;
    tip.style.left = Math.max(pad, left) + "px";
    tip.style.top = top + "px";
  }
  const hideTip = () => tip.classList.remove("on");
  function bindTips(svg) {
    svg.addEventListener("pointermove", (e) => {
      const t = e.target.closest("[data-tip]");
      if (t) showTip(t.getAttribute("data-tip"), e.clientX, e.clientY); else hideTip();
    });
    svg.addEventListener("pointerleave", hideTip);
  }
  addEventListener("scroll", hideTip, { passive: true });
  const sw = (colorVar) => `<span class="tt-sw" style="background:var(${colorVar})"></span>`;

  /* ---------------------------------------------------------------- redraw registry */
  const charts = [];
  function chart(container, draw) {
    if (!container) return;
    const render = () => { container.innerHTML = ""; draw(container, container.clientWidth); };
    charts.push(render);
    render();
  }
  let resizeTimer;
  let lastWidth = innerWidth;
  addEventListener("resize", () => {
    if (innerWidth === lastWidth) return;
    lastWidth = innerWidth;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => charts.forEach((r) => r()), 120);
  });
  const redrawAll = () => charts.forEach((r) => r());

  /* ---------------------------------------------------------------- theme */
  const themeBtn = $("#theme");
  const sysDark = matchMedia("(prefers-color-scheme: dark)");
  const isDark = () => root.dataset.theme ? root.dataset.theme === "dark" : sysDark.matches;
  function syncThemeButton() {
    const dark = isDark();
    $(".i-moon", themeBtn).style.display = dark ? "none" : "";
    $(".i-sun", themeBtn).style.display = dark ? "" : "none";
    themeBtn.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
  }
  themeBtn.addEventListener("click", () => {
    const next = isDark() ? "light" : "dark";
    root.dataset.theme = next;
    try { localStorage.setItem("te-theme", next); } catch (e) { /* storage unavailable */ }
    syncThemeButton();
    redrawAll();
  });
  sysDark.addEventListener("change", () => { if (!root.dataset.theme) { syncThemeButton(); redrawAll(); } });
  syncThemeButton();

  /* ---------------------------------------------------------------- key numbers */
  (function stats() {
    const te = D.settings.map((s) => D.table1.te[s.id]);
    const costs = te.map((c) => Math.abs(c.cost.v));
    const range = (a) => `${Math.min(...a).toFixed(1)}–${Math.max(...a).toFixed(1)}<small>%</small>`;
    const cells = D.perRepo.filter((r) => r.arm === "te");
    const better = D.settings.filter((s) => D.table1.te[s.id].pass.v > D.table1.default[s.id].pass.v).length;
    const set = (k, html) => { const n = $(`[data-stat="${k}"]`); if (n) n.innerHTML = html; };
    set("swe-range", range(costs));
    set("cells", `${cells.filter((r) => r.cost < 0).length}<small> / ${cells.length}</small>`);
    set("pass", `${better}<small> of ${D.settings.length}</small>`);
    set("transfer-range", range(D.transfer.map((r) => Math.abs(r.cost.v))));
  })();

  /* ---------------------------------------------------------------- receipt */
  (function receipt() {
    const btns = $$(".receipt .seg button");
    let first = true;
    function show(id) {
      const a = D.ablation[id];
      btns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.model === id)));
      for (const k of ["skills", "pruning", "guard"]) {
        $(`[data-rt="${k}"]`).textContent = pct(a[k].cost.v);
        $(`[data-rt-bar="${k}"]`).style.width = (Math.abs(a[k].cost.v) / 35 * 100) + "%";
      }
      $('[data-rt="pass-default"]').textContent = a.default.pass.v.toFixed(1);
      $('[data-rt="pass-te"]').textContent = a.te.pass.v.toFixed(1);
      const big = $('[data-rt="te"]');
      const target = a.te.cost.v;
      if (reduceMotion || !first) { big.textContent = pct(target); return; }
      first = false;
      const t0 = performance.now(), dur = 900;
      const step = (t) => {
        const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        big.textContent = pct(target * e);
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
    btns.forEach((b) => b.addEventListener("click", () => show(b.dataset.model)));
    // Let the bars grow in from zero on load.
    requestAnimationFrame(() => requestAnimationFrame(() => show("cc-opus")));
  })();

  /* ---------------------------------------------------------------- Figure 1(b) */
  (function pilot() {
    const ORDER = ["sklearn", "sympy", "django", "sphinx", "matplotlib", "xarray", "all"];
    const NAMES = { sklearn: "scikit-learn", sympy: "SymPy", django: "Django", sphinx: "Sphinx", matplotlib: "Matplotlib", xarray: "xarray", all: "All 60 tasks" };
    const ARMS = ["rtk", "serena", "repomap", "te"];
    const on = Object.fromEntries(ARMS.map((a) => [a, true]));
    const legend = $("#pilot-legend");
    ARMS.forEach((a) => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("aria-pressed", "true");
      b.append(legendSwatch(METHOD[a].marker, METHOD[a].color), METHOD[a].label);
      b.addEventListener("click", () => { on[a] = !on[a]; b.setAttribute("aria-pressed", String(on[a])); redraw(); });
      li.append(b);
      legend.append(li);
    });

    let redraw = () => {};
    chart($("#pilot-chart"), (box, W) => {
      redraw = () => { box.innerHTML = ""; draw(box, box.clientWidth); };
      draw(box, W);
    });
    function draw(box, W) {
      const narrow = W < 520;
      const m = { l: narrow ? 92 : 112, r: 16, t: 26, b: 34 };
      const band = narrow ? 44 : 46, gap = 9;
      const H = m.t + ORDER.length * band + 10 + m.b;
      const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H }, box);
      const x = scale(-50, 40, m.l, W - m.r);
      const g = el("g", { class: "grid" }, svg);
      el("rect", { class: "wash", x: x(0), y: m.t - 6, width: x(40) - x(0), height: ORDER.length * band + 16 }, svg);
      for (const t of niceTicks(-40, 40, 20)) {
        el("line", { x1: x(t), x2: x(t), y1: m.t - 6, y2: H - m.b + 4 }, g);
        text(svg, x(t), H - m.b + 20, t ? sign(t, 0) : "0", { "text-anchor": "middle" });
      }
      text(svg, (m.l + W - m.r) / 2, H - 2, "Cost change vs. default (%)", { "text-anchor": "middle", class: "ink", "font-size": 12.5 });
      text(svg, x(0) + 8, m.t - 12, "costlier →", { "font-size": 11.5 });
      text(svg, x(0) - 8, m.t - 12, "← cheaper", { "font-size": 11.5, "text-anchor": "end", fill: tok("--good") });
      el("line", { class: "zero", x1: x(0), x2: x(0), y1: m.t - 6, y2: H - m.b + 4 }, svg);
      const marks = el("g", {}, svg);
      ORDER.forEach((repo, i) => {
        const y0 = m.t + i * band + (repo === "all" ? 10 : 0);
        if (repo === "all") el("line", { x1: 4, x2: W - m.r, y1: y0 - 6, y2: y0 - 6, stroke: tok("--rule-strong"), "stroke-dasharray": "3 3" }, svg);
        text(svg, m.l - 12, y0 + band / 2 + 4, NAMES[repo], { "text-anchor": "end", class: "ink", "font-weight": repo === "all" ? 600 : 400, "font-size": narrow ? 12 : 13 });
        const visible = ARMS.filter((a) => on[a]);
        visible.forEach((a, k) => {
          const v = D.pilot[repo][a];
          const y = y0 + band / 2 + (k - (visible.length - 1) / 2) * gap;
          const color = tok(METHOD[a].color);
          const emph = a === "te";
          el("line", { x1: x(0), x2: x(v), y1: y, y2: y, stroke: color, "stroke-width": emph ? 3 : 2.4, "stroke-linecap": "round", opacity: emph ? .9 : .6 }, marks);
          marker(marks, METHOD[a].marker, x(v), y, emph ? 4.6 : 4, color);
          const tipHtml = `${sw(METHOD[a].color)}<b>${METHOD[a].label}</b> · ${NAMES[repo]}<br><span class="tt-v">${pct(v)}</span> cost vs. default`;
          el("rect", { class: "hit", x: Math.min(x(0), x(v)) - 6, y: y - gap / 2, width: Math.abs(x(v) - x(0)) + 12, height: gap, "data-tip": tipHtml }, marks);
          if (repo === "all" && !narrow) {
            text(marks, x(v) + (v < 0 ? -9 : 9), y + 4, pct(v), { "text-anchor": v < 0 ? "end" : "start", "font-size": 11, class: emph ? "ink" : "", "font-weight": emph ? 600 : 400 });
          }
        });
      });
      bindTips(svg);
    }

    // data table
    const rows = ORDER.map((r) => `<tr><td>${NAMES[r]}</td>${ARMS.map((a) => `<td>${pct(D.pilot[r][a])}</td>`).join("")}</tr>`).join("");
    $("#pilot-table").innerHTML = `<table class="t"><thead><tr><th>Repository</th>${ARMS.map((a) => `<th>${METHOD[a].label}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>`;
  })();

  /* ---------------------------------------------------------------- Table 1 */
  let highlightSetting = null;
  const settingListeners = [];
  (function table1() {
    const ROWS = [["default", "Default"], ["medium", "Default (medium effort)", "Medium effort"], ["low", "Default (low effort)", "Low effort"], ["rtk", "RTK"], ["repomap", "RepoMap"],
      ["te", "TokenEconomizer", "TE"], ["te_rtk", "TokenEconomizer + RTK", "TE + RTK"], ["te_repomap", "TokenEconomizer + RepoMap", "TE + RepoMap"]];
    const agents = [];
    D.settings.forEach((s) => { const last = agents[agents.length - 1]; if (last && last.agent === s.agent) last.n++; else agents.push({ agent: s.agent, n: 1 }); });
    const cell = (c, kind, sid) => {
      if (!c) return `<td class="muted" data-col="${sid}">—</td>`;
      const v = kind === "cost" ? sign(c.v) : c.v.toFixed(1);
      const cls = [c.bold ? "best" : "", c.grey ? "greyed" : ""].join(" ").trim();
      return `<td class="${cls}" data-col="${sid}">${v}${c.sd != null ? `<span class="sd">±${c.sd.toFixed(1)}</span>` : ""}</td>`;
    };
    let html = `<table class="t"><thead><tr class="grp"><th></th>${agents.map((a) => `<th colspan="${a.n * 2}"><span>${a.agent}</span></th>`).join("")}</tr>`;
    html += `<tr class="grp"><th></th>${D.settings.map((s) => `<th colspan="2" data-col="${s.id}"><span>${s.model}</span></th>`).join("")}</tr>`;
    html += `<tr><th>Method</th>${D.settings.map((s) => `<th data-col="${s.id}">Δ Cost ↓</th><th data-col="${s.id}">Pass@1 ↑</th>`).join("")}</tr></thead><tbody>`;
    ROWS.forEach(([k, label, short]) => {
      const cls = [k.startsWith("te") ? "te" : "", k === "te" ? "sep" : ""].join(" ").trim();
      const name = short ? `<span class="lbl-full">${label}</span><span class="lbl-short">${short}</span>` : label;
      html += `<tr class="${cls}"><td>${name}</td>${D.settings.map((s) => cell(D.table1[k][s.id].cost, "cost", s.id) + cell(D.table1[k][s.id].pass, "pass", s.id)).join("")}</tr>`;
    });
    $("#table1").innerHTML = html + "</tbody></table>";
    settingListeners.push((id) => $$("#table1 [data-col]").forEach((c) => c.classList.toggle("col-hi", c.dataset.col === id)));
  })();

  /* ---------------------------------------------------------------- setting chips */
  (function chips() {
    const box = $("#setting-chips");
    const make = (id, html) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "chip"; b.innerHTML = html;
      b.setAttribute("aria-pressed", String(id === null));
      b.addEventListener("click", () => {
        highlightSetting = id;
        $$(".chip", box).forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
        settingListeners.forEach((f) => f(id));
      });
      box.append(b);
    };
    make(null, "All settings");
    D.settings.forEach((s) => make(s.id, `${s.agent} <small>${s.model}</small>`));
  })();

  /* ---------------------------------------------------------------- Figure 3(a): per-repository strip */
  (function strip() {
    const ARMS = ["rtk", "repomap", "te", "te_rtk", "te_repomap"];
    const box = $("#strip-chart");
    let render;
    chart(box, (b, W) => { render = () => { b.innerHTML = ""; draw(b, b.clientWidth); }; draw(b, W); });
    settingListeners.push(() => render && render());
    function draw(b, W) {
      const narrow = W < 440;
      const m = { l: narrow ? 6 : 108, r: 50, t: 22, b: 40 };
      const band = narrow ? 62 : 50;
      const H = m.t + ARMS.length * band + m.b;
      const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H }, b);
      const vals = D.perRepo.map((r) => r.cost);
      const lo = Math.floor((Math.min(...vals) - 3) / 10) * 10, hi = Math.ceil((Math.max(...vals) + 3) / 10) * 10;
      const x = scale(lo, hi, m.l, W - m.r);
      const g = el("g", { class: "grid" }, svg);
      el("rect", { class: "wash", x: x(0), y: m.t, width: x(hi) - x(0), height: ARMS.length * band }, svg);
      for (const t of niceTicks(lo, hi, 10)) {
        el("line", { x1: x(t), x2: x(t), y1: m.t, y2: m.t + ARMS.length * band }, g);
        if (!narrow || t % 20 === 0) text(svg, x(t), H - m.b + 18, t ? sign(t, 0) : "0", { "text-anchor": "middle" });
      }
      el("line", { class: "zero", x1: x(0), x2: x(0), y1: m.t, y2: m.t + ARMS.length * band }, svg);
      text(svg, (m.l + W - m.r) / 2, H - 4, "Cost change vs. default (%)", { "text-anchor": "middle", class: "ink", "font-size": 12.5 });
      // deterministic jitter, so a redraw does not move the dots
      let seed = 7;
      const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      ARMS.forEach((a, i) => {
        const yc = m.t + i * band + band / 2 + (narrow ? 8 : 0);
        const rows = D.perRepo.filter((r) => r.arm === a);
        const labelAttrs = { class: a.startsWith("te") ? "ink" : "", "font-weight": a === "te" ? 600 : 400, "font-size": narrow ? 12 : 12.5 };
        if (narrow) text(svg, m.l + 4, m.t + i * band + 13, METHOD[a].label, labelAttrs);
        else text(svg, m.l - 12, yc + 4, METHOD[a].label, { "text-anchor": "end", ...labelAttrs });
        const color = tok(METHOD[a].color);
        rows.forEach((r) => {
          const y = yc + (rand() - .5) * (narrow ? 26 : band * .5);
          const dim = highlightSetting && r.setting !== highlightSetting;
          const mk = marker(svg, METHOD[a].marker, x(r.cost), y, highlightSetting && !dim ? 4.6 : 3.8, color, { opacity: dim ? .14 : .9 });
          mk.setAttribute("data-tip", `${sw(METHOD[a].color)}<b>${METHOD[a].label}</b> · ${REPO_NAME[r.repo]}<br>${settingName(r.setting)}<br><span class="tt-v">${pct(r.cost)}</span> cost vs. default`);
        });
        const mean = rows.reduce((s, r) => s + r.cost, 0) / rows.length;
        el("line", { x1: x(mean), x2: x(mean), y1: yc - 14, y2: yc + 14, stroke: tok("--ink"), "stroke-width": 2, "stroke-linecap": "round", "data-tip": `<b>${METHOD[a].label}</b> mean over 30 cells<br><span class="tt-v">${pct(mean)}</span>` }, svg);
        const worse = rows.filter((r) => r.cost > 0).length;
        text(svg, W - m.r + 8, yc + 4, `${worse}/30`, { "font-size": 11.5, fill: worse ? tok("--ink-2") : tok("--good"), "font-weight": 600 });
      });
      text(svg, W - m.r + 8, 12, "costlier", { "font-size": 11 });
      bindTips(svg);
    }
    // data table
    const keys = [];
    D.settings.forEach((s) => D.repos.forEach((r) => keys.push([s.id, r])));
    const val = (sid, repo, arm) => D.perRepo.find((r) => r.setting === sid && r.repo === repo && r.arm === arm).cost;
    $("#strip-table").innerHTML = `<table class="t"><thead><tr><th>Setting · repository</th>${ARMS.map((a) => `<th>${METHOD[a].label}</th>`).join("")}</tr></thead><tbody>${keys.map(([sid, repo]) => `<tr><td>${settingName(sid)} · ${REPO_NAME[repo]}</td>${ARMS.map((a) => `<td>${pct(val(sid, repo, a))}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  })();

  /* ---------------------------------------------------------------- Figure 3(b): frontier */
  (function frontier() {
    const ARMS = ["medium", "low", "rtk", "repomap", "te", "te_rtk", "te_repomap"];
    const on = Object.fromEntries(ARMS.map((a) => [a, true]));
    const pts = [];
    D.settings.forEach((s) => ARMS.forEach((a) => {
      const c = D.table1[a][s.id];
      pts.push({ arm: a, setting: s.id, x: c.cost.v, y: +(c.pass.v - D.table1.default[s.id].pass.v).toFixed(1) });
    }));
    // Non-dominated set over every point: the cheapest method at or above each Pass@1 level.
    const front = [];
    let best = -Infinity;
    [...pts].sort((p, q) => p.x - q.x).forEach((p) => { if (p.y > best) { front.push(p); best = p.y; } });

    const legend = $("#frontier-legend");
    [...ARMS, "default"].forEach((a) => {
      const li = document.createElement("li");
      if (a === "default") {
        const s = document.createElementNS(NS, "svg"); s.setAttribute("viewBox", "-7 -7 14 14"); s.setAttribute("aria-hidden", "true");
        marker(s, "star", 0, 0, 4.6, "var(--surface)", { stroke: "var(--ink)", "stroke-width": 1.2 });
        li.append(s, "Default");
      } else {
        const b = document.createElement("button");
        b.type = "button"; b.setAttribute("aria-pressed", "true");
        b.append(legendSwatch(METHOD[a].marker, METHOD[a].color), METHOD[a].label);
        b.addEventListener("click", () => { on[a] = !on[a]; b.setAttribute("aria-pressed", String(on[a])); render(); });
        li.append(b);
      }
      legend.append(li);
    });

    let render;
    chart($("#frontier-chart"), (b, W) => { render = () => { b.innerHTML = ""; draw(b, b.clientWidth); }; draw(b, W); });
    settingListeners.push(() => render && render());
    function draw(b, W) {
      const m = { l: 48, r: 14, t: 10, b: 42 };
      const H = Math.round(Math.min(360, Math.max(270, W * .72)));
      const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H }, b);
      const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
      const x0 = Math.floor((Math.min(...xs) - 3) / 10) * 10, x1 = Math.max(10, Math.ceil((Math.max(...xs) + 3) / 10) * 10);
      const y0 = Math.floor(Math.min(...ys) - 1.5), y1 = Math.ceil(Math.max(...ys) + 2);
      const x = scale(x0, x1, m.l, W - m.r), y = scale(y0, y1, H - m.b, m.t);
      const g = el("g", { class: "grid" }, svg);
      for (const t of niceTicks(x0, x1, 10)) { el("line", { x1: x(t), x2: x(t), y1: m.t, y2: H - m.b }, g); text(svg, x(t), H - m.b + 17, t ? sign(t, 0) : "0", { "text-anchor": "middle" }); }
      for (const t of niceTicks(y0, y1, 2)) { el("line", { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t) }, g); text(svg, m.l - 8, y(t) + 4, t ? sign(t, 0) : "0", { "text-anchor": "end" }); }
      el("rect", { x: m.l, y: m.t, width: x(0) - m.l, height: y(0) - m.t, fill: tok("--good"), opacity: .06 }, svg);
      text(svg, m.l + 8, m.t + 16, "cheaper and more accurate", { "font-size": 11.5, fill: tok("--good") });
      el("line", { class: "zero", x1: x(0), x2: x(0), y1: m.t, y2: H - m.b }, svg);
      el("line", { class: "zero", x1: m.l, x2: W - m.r, y1: y(0), y2: y(0) }, svg);
      text(svg, (m.l + W - m.r) / 2, H - 4, "Cost change vs. default (%)", { "text-anchor": "middle", class: "ink", "font-size": 12.5 });
      const yl = text(svg, 0, 0, "Pass@1 change (points)", { "text-anchor": "middle", class: "ink", "font-size": 12.5, transform: `translate(12 ${(m.t + H - m.b) / 2}) rotate(-90)` });
      yl.removeAttribute("x"); yl.removeAttribute("y");
      el("path", { d: front.map((p, i) => (i ? "L" : "M") + x(p.x) + "," + y(p.y)).join(""), fill: "none", stroke: tok("--ink-2"), "stroke-width": 1.2, "stroke-dasharray": "5 4", opacity: .7 }, svg);
      const order = [...pts].sort((p, q) => (p.arm.startsWith("te") ? 1 : 0) - (q.arm.startsWith("te") ? 1 : 0));
      order.forEach((p) => {
        if (!on[p.arm]) return;
        const dim = highlightSetting && p.setting !== highlightSetting;
        const mk = marker(svg, METHOD[p.arm].marker, x(p.x), y(p.y), p.arm.startsWith("te") ? 5.4 : 4.6, tok(METHOD[p.arm].color), { opacity: dim ? .14 : .95 });
        mk.setAttribute("data-tip", `${sw(METHOD[p.arm].color)}<b>${METHOD[p.arm].label}</b><br>${settingName(p.setting)}<br>Cost <span class="tt-v">${pct(p.x)}</span> · Pass@1 <span class="tt-v">${sign(p.y)}</span> pts`);
      });
      marker(svg, "star", x(0), y(0), 6, tok("--surface"), { stroke: tok("--ink"), "stroke-width": 1.4, "data-tip": "<b>Default execution</b><br>high reasoning effort, no external control" });
      bindTips(svg);
    }
  })();

  /* ---------------------------------------------------------------- ablation */
  (function ablation() {
    const ROWS = [["skills", "Micro-skills", "--s1"], ["pruning", "Tool pruning", "--s2"], ["guard", "Failure-loop guard", "--s3"], ["te", "Combined", "--m-te"]];
    $("#ablation").innerHTML = ["cc-sonnet", "cc-opus"].map((id) => {
      const a = D.ablation[id];
      return `<div class="abl"><h4>${settingName(id)}</h4><div class="abl-row abl-head"><span></span><span></span><span class="v">Δ Cost</span><span class="v">Pass@1</span></div>` +
        `<div class="abl-row"><span>Default</span><span></span><span class="v">—</span><span class="v">${a.default.pass.v.toFixed(1)}</span></div>` +
        ROWS.map(([k, label, c]) =>
        `<div class="abl-row${k === "te" ? " total" : ""}"><span>${label}</span><span class="bar"><i style="width:${Math.abs(a[k].cost.v) / 35 * 100}%;background:var(${c})"></i></span><span class="v">${pct(a[k].cost.v)}</span><span class="v">${a[k].pass.v.toFixed(1)}</span></div>`).join("") + `</div>`;
    }).join("");
  })();

  /* ---------------------------------------------------------------- generalization */
  (function generalization() {
    const META = {
      "Web-Bench": { title: "Web-Bench", sub: "Sequential web development · 102 tasks in 5 projects · Pass@2", foot: "Tasks inherit the workspace. Savings hold even though each stream has only 20 or 21 tasks." },
      CredData: { title: "CredData", sub: "Credential detection · 100 tasks · detection F1", foot: "No repository recurs, yet tool pruning and the loop guard still save substantially under a shared audit procedure." },
      ReposVul: { title: "ReposVul", sub: "Vulnerability detection · 100 tasks · detection F1", foot: "Shorter trajectories leave less removable cost, so savings are smaller." },
    };
    const groups = [...new Set(D.transfer.map((r) => r.workload))];
    $("#gen").innerHTML = groups.map((w) => {
      const rows = D.transfer.filter((r) => r.workload === w);
      return `<article class="gcard reveal"><h3>${META[w].title}</h3><p class="sub">${META[w].sub}</p>${rows.map((r) =>
        `<div class="grow"><span>${r.agent}</span><span class="bar"><i style="width:${Math.abs(r.cost.v) / 25 * 100}%"></i></span><span class="v">${pct(r.cost.v)}</span></div>` +
        `<p class="grow-q">quality <b>${r.default.v.toFixed(1)}</b> → <b>${r.te.v.toFixed(1)}</b></p>`).join("")}<p class="gfoot">${META[w].foot}</p></article>`;
    }).join("");
  })();

  /* ---------------------------------------------------------------- appendix examples */
  // Trace lines: [kind, text]; kind is cmd, out, ok, bad, note, redirect, or stop.
  const TRACES = {
    skill: [
      { title: "Default", turns: "15 turns", lines: [
        ["note", "(10 tool calls: locate and edit Complement, run a reproduction)"],
        ["cmd", "$ python -m pytest sympy/sets/tests/test_sets.py -q 2>&1 | tail -15"],
        ["bad", "/opt/miniconda3/envs/testbed/bin/python: No module named pytest"],
        ["cmd", "$ python -m sympy.utilities.runtests sympy/sets/tests/test_sets.py 2>&1 | tail -20"],
        ["out", "(deprecation warnings only; no tests run)"],
        ["cmd", "$ python -c \"import sympy; sympy.test('sympy/sets/tests/test_sets.py')\" 2>&1 | tail -20"],
        ["ok", "tests finished: 72 passed, 2 expected to fail, in 5.48 seconds"],
        ["note", "(1 tool call: run the whole sympy/sets package)"],
      ] },
      { title: "TokenEconomizer", turns: "11 turns", te: true, lines: [
        ["note", "(9 tool calls: locate and edit Complement, run a reproduction)"],
        ["cmd", "$ python -c \"import sympy; sympy.test('sympy/sets/tests/test_sets.py')\" 2>&1 | tail -15"],
        ["ok", "tests finished: 72 passed, 2 expected to fail, in 5.37 seconds"],
      ] },
    ],
  };
  function traceHTML(t) {
    return `<div class="trace${t.te ? " te" : ""}"><header><b>${esc(t.title)}</b><span class="turns">${esc(t.turns)}</span></header><pre>${t.lines.map(([k, s]) => `<span class="ln ${k === "cmd" ? "" : k === "ok" || k === "bad" ? "out " + k : k}">${esc(s)}</span>`).join("")}</pre></div>`;
  }
  function play(container) {
    const traces = $$(".trace", container);
    if (reduceMotion) return;
    traces.forEach((t) => {
      const lines = $$(".ln", t);
      t.classList.add("playing");
      lines.forEach((l) => l.classList.remove("shown"));
      lines.forEach((l, i) => setTimeout(() => l.classList.add("shown"), 250 + i * 330));
    });
  }
  function onceVisible(node, fn) {
    if (!("IntersectionObserver" in window)) return fn();
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); fn(); } }, { threshold: .2 });
    io.observe(node);
  }
  const skillBox = $('[data-traces="skill"]');
  skillBox.innerHTML = TRACES.skill.map(traceHTML).join("");
  if (!reduceMotion) { $$(".trace", skillBox).forEach((t) => t.classList.add("playing")); onceVisible(skillBox, () => play(skillBox)); }
  $('[data-replay="skill"]').addEventListener("click", () => play(skillBox));

  /* tool pruning, examples (f) and (g) */
  const PRUNE = {
    cc: {
      kept: ["Bash", "Edit", "Read", "Write"],
      masked: ["AskUserQuestion", "CronCreate", "CronDelete", "CronList", "EnterPlanMode", "EnterWorktree", "ExitPlanMode", "ExitWorktree", "NotebookEdit", "ScheduleWakeup", "Skill", "Task", "TaskCreate", "TaskGet", "TaskList", "TaskOutput", "TaskStop", "TaskUpdate", "Workflow"],
      tasks: [["django-10097", 42866, 42866, "all 23 tools loaded"], ["django-10554", 16295, 43351, "the judge masks 19 tools"], ["django-10880", 15003, 42059, "the judge masks the same 19"], ["django-10914", 15299, 42355, "evidence masks the same 19, each unused for 3 tasks"]],
    },
    copilot: {
      kept: ["bash", "create", "edit", "glob", "grep", "list_bash", "read_bash", "stop_bash", "view"],
      masked: ["factories_manage", "fetch_copilot_cli_documentation", "list_agents", "read_agent", "run_factory", "session_store_sql", "skill", "sql", "task", "write_agent"],
      tasks: [["django-10097", 25765, 25760, "all 19 tools loaded"], ["django-10554", 11347, 26249, "the judge masks 10 tools"], ["django-10880", 10066, 24969, "the judge masks the same 10"], ["django-10914", 10343, 25248, "evidence masks the same 10, each unused for 3 tasks"]],
    },
  };
  (function pruning() {
    let agent = "cc", step = 0, timer = null;
    const grid = $("#toolgrid"), bars = $("#taskbars");
    function render() {
      const p = PRUNE[agent];
      const all = [...p.kept.map((n) => [n, true]), ...p.masked.map((n) => [n, false])].sort((a, b) => a[0].localeCompare(b[0], "en", { sensitivity: "base" }));
      grid.innerHTML = all.map(([n, keep]) => `<span class="tool${keep ? " core" : ""}${!keep && step > 0 ? " masked" : ""}">${esc(n)}</span>`).join("");
      const max = Math.max(...p.tasks.map((t) => Math.max(t[1], t[2])));
      bars.innerHTML = p.tasks.map(([id, te, def, note], i) => {
        const shown = i <= step;
        return `<div class="taskbar${i === step ? " current" : ""}"><span class="tn">Task ${i + 1}<small>${id}</small></span>` +
          `<span class="bars" title="${esc(note)}"><i class="def" style="width:${def / max * 100}%"></i><i class="te" style="width:${shown ? te / max * 100 : 0}%"></i></span>` +
          `<span class="tv">${shown ? te.toLocaleString("en-US") : "·"}<small>(${def.toLocaleString("en-US")})</small></span></div>`;
      }).join("") + `<p class="caption" style="margin:6px 0 0">Task ${step + 1}: ${esc(p.tasks[step][3])}. ${step > 0 ? `Loaded: ${p.kept.join(", ")}.` : ""}</p>` +
        `<div class="chips" style="margin-top:10px" role="group" aria-label="Task">${p.tasks.map((t, i) => `<button type="button" class="chip" data-step="${i}" aria-pressed="${i === step}">Task ${i + 1}</button>`).join("")}</div>`;
      $$("[data-step]", bars).forEach((b) => b.addEventListener("click", () => { stop(); step = +b.dataset.step; render(); }));
    }
    const stop = () => { clearInterval(timer); timer = null; };
    function auto() {
      if (reduceMotion) { step = 3; render(); return; }
      stop(); step = 0; render();
      timer = setInterval(() => { step++; render(); if (step >= 3) stop(); }, 1300);
    }
    $$("[data-prune]").forEach((b) => b.addEventListener("click", () => {
      agent = b.dataset.prune;
      $$("[data-prune]").forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
      auto();
    }));
    render();
  })();

  /* failure-loop intervention, examples (h) and (i) */
  const LOOP = {
    redirect: {
      title: "Example: a redirect that gets the agent testing", meta: "sphinx-11445 · Claude Code, Opus 4.8",
      strips: [
        { label: "Default", right: "42 turns · passes", n: 42, cells: () => "", caption: "18 edits to sphinx/util/rst.py and 3 test runs before the task passes" },
        { label: "TokenEconomizer", right: "31 turns · passes", n: 31, te: true, cells: (i) => (i < 18 ? "loop" : "after") },
      ],
      lines: [
        ["note", "turns 1–18: 11 edits to sphinx/util/rst.py, no test run, the same failure repeated 3 times"],
        ["redirect", "Redirect (trace judge: stuck, confidence 0.72)"],
        ["out", "Process check (automated): so far you've made 11 edits across 1 file(s) ... and run 0 verification(s) ... try a MATERIALLY DIFFERENT hypothesis: re-read the failing test's expectation ..."],
        ["cmd", "$ grep -rn \"prepend_prolog\\|rst_prolog\\|docinfo\" /testbed/tests/test_util_rst.py"],
        ["cmd", "$ python -c \"from sphinx.util.rst import prepend_prolog; ...\""],
        ["cmd", "$ python -m pytest tests/test_util_rst.py -q 2>&1 | tail -15"],
        ["ok", "7 passed in 0.65s"],
      ],
      legend: [["loop", "before the redirect"], ["after", "after the redirect"]],
    },
    stop: {
      title: "Example: a forced stop on a task both runs fail", meta: "xarray-6798 · Claude Code, Opus 4.8",
      strips: [
        { label: "Default", right: "32 turns · fails", n: 32, cells: () => "", caption: "6 edits to xarray/core/coordinates.py and 3 test runs; the task still fails" },
        { label: "TokenEconomizer", right: "25 turns · fails", n: 25, te: true, cells: (i) => (i === 24 ? "mark" : i >= 10 ? "loop" : ""), budget: 10.25 },
      ],
      lines: [
        ["note", "learned turn budget B_i = 10.25 turns; forced stop at 2.5 B_i"],
        ["note", "by then: 7 edits to xarray/core/coordinates.py, 14 error outputs, the same failure repeated 3 times"],
        ["stop", "Stop: past 2.5 B_i, and the strict stall rule fires"],
        ["note", "the task fails, as it does under default execution, 7 turns sooner"],
      ],
      legend: [["loop", "past the budget <i>B</i><sub>i</sub>"], ["mark", "forced stop"]],
    },
  };
  (function loops() {
    const box = $("#loop-example");
    function render(key) {
      const ex = LOOP[key];
      $("#loop-title").textContent = ex.title;
      const max = Math.max(...ex.strips.map((s) => s.n));
      box.innerHTML = `<p class="caption" style="margin:-4px 0 12px;font-family:var(--font-mono);font-size:12.5px">${esc(ex.meta)}</p>` + ex.strips.map((s) => {
        let cells = "";
        for (let i = 0; i < max; i++) cells += i < s.n ? `<i class="${s.cells(i)}"></i>` : `<i class="ghost"></i>`;
        const budget = s.budget ? `<span style="position:absolute;left:calc(${s.budget / max * 100}% - 1px);top:-3px;bottom:-3px;width:2px;background:var(--ink)"></span><span style="position:absolute;left:calc(${s.budget / max * 100}% + 5px);top:-19px;font-size:11.5px;color:var(--ink-2);font-family:var(--font-mono)">B<sub>i</sub> = ${s.budget}</span>` : "";
        return `<div class="turnstrip"${s.budget ? ' style="margin-top:24px"' : ""}><div class="lab"><b>${s.label}</b><span>${s.right}</span></div><div style="position:relative"><div class="cells" style="grid-template-columns:repeat(${max},minmax(0,1fr))">${cells}</div>${budget}</div>${s.caption ? `<p class="caption" style="margin:6px 0 0;font-size:13px">${esc(s.caption)}</p>` : ""}</div>`;
      }).join("") +
        `<div class="mini-legend" style="margin:-4px 0 14px">${ex.legend.map(([c, l]) => `<span><i class="" style="background:var(${c === "after" ? "--good" : "--s3"});opacity:${c === "loop" ? .45 : c === "after" ? .55 : 1}"></i>${l}</span>`).join("")}<span><i style="background:transparent;border:1px dashed var(--rule-strong)"></i>turns saved</span></div>` +
        traceHTML({ title: "TokenEconomizer", turns: ex.strips[1].right.split(" · ")[0], te: true, lines: ex.lines });
    }
    $$("[data-loop]").forEach((b) => b.addEventListener("click", () => {
      $$("[data-loop]").forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
      render(b.dataset.loop);
    }));
    render("redirect");
  })();

  /* method tabs (WAI-ARIA tabs pattern) */
  (function tabs() {
    const list = $$('.tabs [role="tab"]');
    function select(tab, focus) {
      list.forEach((t) => {
        const on = t === tab;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
        $("#" + t.getAttribute("aria-controls")).hidden = !on;
      });
      if (focus) tab.focus();
      if (tab.id === "tab-s2") $("#panel-s2").dispatchEvent(new Event("shown"));
    }
    list.forEach((t, i) => {
      t.addEventListener("click", () => select(t));
      t.addEventListener("keydown", (e) => {
        const k = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (k) { e.preventDefault(); select(list[(i + k + list.length) % list.length], true); }
        if (e.key === "Home") { e.preventDefault(); select(list[0], true); }
        if (e.key === "End") { e.preventDefault(); select(list[list.length - 1], true); }
      });
    });
    let started = false;
    $("#panel-s2").addEventListener("shown", () => { if (!started) { started = true; $$("[data-prune]")[0].click(); } });
  })();

  /* ---------------------------------------------------------------- micro-skill lifecycle explorer */
  const SKILLS = [
    {
      id: "a", repo: "sympy", setting: "Claude Code, Opus 4.8", badge: ["on", "Injected on tasks 10–60"],
      skill: "Besides pytest, tests can be run through the native runner `python -c \"import sympy; sympy.test('sympy/.../test_x.py')\"` or `python -m sympy.utilities.runtests`.",
      det: [["scope", "ran_tests"], ["confirm", "sympy\\.utilities\\.runtests|sympy\\.test\\("], ["contradict", "–"], ["need", "sympy_test_runner (sympy\\.utilities\\.runtests|sympy\\.test\\( in a command)"]],
      span: "60 tasks",
      life: [["proposed", "after task 9, citing tasks 5 and 6"], ["activated", "on admission: confirmed on tasks 3, 5, and 6, whose edits do not overlap (matexpr.py | permutations.py | sparse.py); need 4/4"], ["injected", "tasks 10–60"], ["end", "active; 10 confirmations and no contradiction over 10 exercised tasks"]],
      why: "On task 11, default execution tries pytest, which is not installed, and then the module runner, before it finds the native runner. With the skill, the agent runs the native runner directly and finishes in 11 turns instead of 15.",
    },
    {
      id: "b", repo: "sphinx", setting: "Claude Code, Sonnet 5", badge: ["on", "Injected on tasks 7–44"],
      skill: "The canonical way to reproduce an issue in this repo is to build a minimal Sphinx project under /tmp with a conf.py and run `python -m sphinx -b <builder> <srcdir> <outdir>`.",
      det: [["scope", "python -m sphinx -b"], ["confirm", "python -m sphinx -b \\S+ \\S+ \\S+"], ["contradict", "–"], ["need", "–"]],
      span: "44 tasks",
      life: [["proposed", "after task 4, citing tasks 1–3"], ["candidate", "confirmed on tasks 1 and 3, but both edited a file named conf.py, so the two count once toward the 3 confirmations with non-overlapping edits"], ["activated", "after task 6, once tasks 5 (inheritance_diagram.py) and 6 (other.py, toctree.py) confirm it; need 4/4"], ["injected", "tasks 7–44"], ["end", "active; 32 confirmations and no contradiction over 32 exercised tasks"]],
      why: "The non-overlap rule held the skill back until tasks editing different files confirmed it, so its evidence reflects the repository rather than one recurring file. On task 15, the agent reproduces the issue with a minimal project and finishes in 10 turns instead of 11.",
    },
    {
      id: "c", repo: "sympy", setting: "Claude Code, Sonnet 5", badge: ["off", "Retired after one injection"], stakes: true,
      skill: "Run sympy tests with `python -m pytest sympy/<subpackage>/tests/test_<name>.py -q`; this is the canonical test invocation for this repo.",
      det: [["scope", "pytest_module_used (python -m pytest sympy/.*test_.*\\.py in a command)"], ["confirm", "python -m pytest sympy/.*test_.*\\.py"], ["contradict", "ImportError|ModuleNotFoundError|no tests ran|error: unrecognized"], ["need", "–"]],
      span: "60 tasks",
      life: [["proposed", "after task 4, citing tasks 2 and 4"], ["confirmed", "on admission: tasks 2, 3, and 4, whose edits do not overlap (function.py | matexpr.py, summations.py | permutations.py)"], ["activated", "after task 5, once the need gate has 4 exercised tasks"], ["injected", "task 6 only"], ["retired", "after task 6, whose trace contradicts it, which drives its support below zero"], ["end", "retired; 40 confirmations and 11 contradictions over 51 exercised tasks"]],
      why: "The instruction is wrong for this environment, which has no pytest. It was activated because its confirming detector matches the pytest command itself rather than a passing result. The first task to receive it tried the command and then probed for the module; the probe's ModuleNotFoundError matched the contradicting detector, and, weighted by λ = 5, that single contradiction outweighed the decayed confirmations.",
    },
    {
      id: "d", repo: "sympy", setting: "Claude Code, Opus 4.8", badge: ["held", "Withheld by the need gate"], stakes: true,
      skill: "The sympy package is imported from the in-tree source, so edits to .py files take effect immediately; no `pip install`/`setup.py develop` reinstall is required before testing.",
      det: [["scope", "ran_tests"], ["confirm", "python -m pytest\\s+sympy/|sympy\\.test\\("], ["contradict", "pip install|setup\\.py\\s+(develop|install)"], ["need", "reinstall_invoked (pip install|setup\\.py\\s+(develop|install) in a command)"]],
      span: "60 tasks",
      life: [["proposed", "after task 9, citing tasks 3 and 6"], ["confirmed", "on admission: tasks 3, 5, and 6, whose edits do not overlap (matexpr.py | permutations.py | sparse.py); need 0/4"], ["activated", "never: no exercised task ever reinstalls, so the need rate stays 0 < 0.4"], ["end", "not activated; 10 confirmations, no contradiction, need 0/10"]],
      why: "Its confirmations hold, but the agent never attempts the reinstall it warns against, so injecting it would add its tokens to every turn without preventing any waste.",
    },
    {
      id: "e", repo: "sphinx", setting: "Claude Code, Sonnet 5", badge: ["cand", "Never activated"], stakes: true,
      skill: "The canonical test file for sphinx/domains/python.py is tests/test_domain_py.py; Python-domain edits are verified with `python -m pytest tests/test_domain_py.py`.",
      det: [["scope", "domains/python\\.py|test_domain_py"], ["confirm", "test_domain_py\\.py"], ["contradict", "test_domain_py\\.py.{0,20}(FAILED|ERROR|not found)"], ["need", "–"]],
      span: "44 tasks",
      life: [["proposed", "after task 34, citing tasks 30 and 34"], ["candidate", "confirmed on tasks 30, 33, 34, 38, 39, 40, and 43, which edited python.py | docfields.py | python.py | __init__.py, inspect.py, python.py | python.py | python.py | python.py"], ["end", "candidate; 7 confirmations, only 2 with non-overlapping edits"]],
      why: "Every confirmation except one comes from a task that edited a file named python.py, so the evidence reflects one module that recurs across tasks rather than a practice that holds across the repository.",
    },
  ];
  (function lifecycle() {
    const list = $("#lc-list"), detail = $("#lc-detail");
    SKILLS.forEach((s, i) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "lc-item"; b.setAttribute("role", "tab"); b.id = "lc-" + s.id;
      b.setAttribute("aria-controls", "lc-detail");
      b.innerHTML = `<span class="t"><span>(${s.id}) ${s.repo}</span><span>${s.setting.replace("Claude Code, ", "")}</span></span><span class="badge ${s.badge[0]}">${s.badge[1]}</span>`;
      b.addEventListener("click", () => show(i));
      b.addEventListener("keydown", (e) => {
        const k = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
        if (k) { e.preventDefault(); show((i + k + SKILLS.length) % SKILLS.length, true); }
      });
      list.append(b);
    });
    function show(i, focus) {
      const s = SKILLS[i];
      $$(".lc-item", list).forEach((b, j) => { b.setAttribute("aria-selected", String(i === j)); b.tabIndex = i === j ? 0 : -1; });
      if (focus) $$(".lc-item", list)[i].focus();
      detail.setAttribute("aria-labelledby", "lc-" + s.id);
      detail.innerHTML =
        `<div class="example-head"><h4>(${s.id}) ${s.repo} · ${s.setting}</h4><span class="badge ${s.badge[0]}" style="margin:0">${s.badge[1]}</span></div>` +
        `<div class="skillbox"><span class="tag">MICRO-SKILL${s.stakes ? " · HIGH-STAKES" : ""}</span>${esc(s.skill)}</div>` +
        `<h4 style="font-size:13.5px;color:var(--muted);font-weight:500;margin:0 0 6px">Detectors, as the proposer wrote them</h4>` +
        `<dl class="detectors">${s.det.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl>` +
        `<h4 style="font-size:13.5px;color:var(--muted);font-weight:500;margin:0 0 6px">Lifecycle over the stream's ${s.span}</h4>` +
        `<ul class="timeline">${s.life.map(([k, v]) => `<li><span>${k}</span><span>${esc(v)}</span></li>`).join("")}</ul>` +
        `<p class="why">${esc(s.why)}</p>`;
    }
    show(0);
  })();

  /* ---------------------------------------------------------------- copy BibTeX */
  (function copy() {
    const btn = $("#copy-bib"), label = $("span", btn);
    btn.addEventListener("click", async () => {
      const txt = $("#bibtex").textContent;
      try { await navigator.clipboard.writeText(txt); label.textContent = "Copied"; }
      catch (e) {
        const r = document.createRange(); r.selectNodeContents($("#bibtex"));
        const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
        label.textContent = "Press Ctrl+C";
      }
      setTimeout(() => (label.textContent = "Copy"), 1800);
    });
  })();

  /* ---------------------------------------------------------------- figure zoom */
  (function zoom() {
    const dlg = $("#zoom"), img = $("#zoom-img");
    if (!dlg.showModal) return;
    $$(".zoomable img, img.zoomable-img").forEach((im) => {
      im.style.cursor = "zoom-in";
      im.addEventListener("click", () => { img.src = im.currentSrc || im.src; img.alt = im.alt; dlg.showModal(); });
    });
    $("#zoom-close").addEventListener("click", () => dlg.close());
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
  })();

  /* ---------------------------------------------------------------- progress, rail, reveal */
  (function scrolling() {
    const bar = $(".progress"), rail = $(".rail"), hero = $(".hero");
    const links = $$(".rail a");
    const sections = links.map((a) => $(a.getAttribute("href")));
    let ticking = false;
    function update() {
      ticking = false;
      const max = document.documentElement.scrollHeight - innerHeight;
      bar.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
      rail.classList.toggle("on", hero.getBoundingClientRect().bottom < innerHeight * .4);
      let current = 0;
      sections.forEach((s, i) => { if (s.getBoundingClientRect().top < innerHeight * .35) current = i; });
      links.forEach((a, i) => { a.classList.toggle("active", i === current); if (i === current) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current"); });
    }
    addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();

    const items = $$(".reveal");
    if (!("IntersectionObserver" in window) || reduceMotion) { items.forEach((n) => n.classList.add("in")); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px" });
    items.forEach((n) => io.observe(n));
  })();
})();
