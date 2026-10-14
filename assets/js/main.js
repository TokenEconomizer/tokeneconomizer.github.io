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
    // A chart inside a closed <details> has no width yet; it is drawn when the details open.
    const render = () => { container.innerHTML = ""; if (container.clientWidth >= 60) draw(container, container.clientWidth); };
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
  $$("details").forEach((d) => d.addEventListener("toggle", () => { if (d.open) redrawAll(); }));

  /* ---------------------------------------------------------------- motion helpers */
  // Each animation plays once, when its element first scrolls into view, and is skipped
  // (the final state shows at once) when the reader prefers reduced motion.
  function onceVisible(node, fn, threshold = .25) {
    if (!node) return;
    if (!("IntersectionObserver" in window)) return fn();
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); fn(); } }, { threshold });
    io.observe(node);
  }
  // Calls step(e) with e easing from 0 to 1 over dur milliseconds.
  function tween(dur, step) {
    if (reduceMotion) { step(1); return; }
    const t0 = performance.now();
    const frame = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      step(1 - Math.pow(1 - k, 3));
      if (k < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
  // Bars carrying data-w grow to that width (in %) once their container is in view.
  function growBars(scope) {
    const go = () => requestAnimationFrame(() => $$("[data-w]", scope).forEach((b) => (b.style.width = b.dataset.w + "%")));
    if (reduceMotion) go(); else onceVisible(scope, go);
  }
  // Restarts the CSS animations under node by toggling a class across a reflow.
  function restart(node, cls) {
    node.classList.remove(cls);
    void node.getBoundingClientRect();
    node.classList.add(cls);
  }

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
    const cheaper = cells.filter((r) => r.cost < 0).length;
    const scaled = (a, e) => a.map((v) => v * e);
    const fill = (e) => {
      set("swe-range", range(scaled(costs, e)));
      set("cells", `${Math.round(cheaper * e)}<small> / ${cells.length}</small>`);
      set("pass", `${Math.round(better * e)}<small> of ${D.settings.length}</small>`);
    };
    fill(reduceMotion ? 1 : 0);
    onceVisible($(".stats"), () => tween(1200, fill), .5);
  })();

  /* ---------------------------------------------------------------- Figure 1(a): the billed trajectory */
  // The paper's schematic, redrawn so the turns can build up one at a time: every row is one
  // turn's billed context, and each new turn replays all the earlier ones (hatched).
  (function anatomy() {
    const A = D.anatomy, box = $("#anatomy-chart");
    if (!box) return;
    const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const hex = (c) => "#" + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
    // mix(c, toward, f): move colour c a fraction f of the way to the colour toward
    const mix = (c, toward, f) => { const a = rgb(c), b = rgb(toward); return hex(a.map((v, i) => v + (b[i] - v) * f)); };
    const bgHex = () => { const m = getComputedStyle(document.body).backgroundColor.match(/\d+/g); return hex(m.slice(0, 3).map(Number)); };
    // The paper's shading (lighten toward white, darken toward black) becomes, on the page, a move
    // toward the background for replayed history and away from it for what is new on a turn.
    function palette() {
      const bg = bgHex(), dark = isDark(), fg = dark ? "#ffffff" : "#000000";
      return {
        bg, prefix: mix("#9aa3ad", bg, .45),
        replayed: (c) => mix(c, bg, .62),
        written: (c) => mix(c, fg, dark ? .18 : .32),
        output: (c) => mix(c, bg, dark ? .1 : .36),
      };
    }
    const n = A.calls.length;
    const rowsFor = (P) => Array.from({ length: n }, (_, r) => {
      const segs = [{ w: A.prefix, fill: P.prefix, hatch: r > 0 }];
      A.calls.forEach(([cat, written, output], t) => {
        const c = A.colors[cat];
        if (t < r) segs.push({ w: written + output, fill: P.replayed(c), hatch: true });
        if (t === r) {
          segs.push({ w: written, fill: P.written(c), fresh: true });
          if (output) segs.push({ w: output, fill: P.output(c), fresh: true });
        }
      });
      return segs;
    });
    const widest = A.prefix + A.calls.reduce((a, [, w, o]) => a + w + o, 0);
    let state = reduceMotion ? "done" : "waiting";

    chart(box, (b, W) => {
      const P = palette(), rows = rowsFor(P), INK = tok("--ink"), MUTED = tok("--muted");
      const narrow = W < 460;
      const m = { l: narrow ? 30 : 38, r: 6, t: 18, b: 30 };
      const rh = narrow ? 15 : 18, gap = narrow ? 5 : 7;
      const H = m.t + n * (rh + gap) + m.b;
      const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: `anatomy ${state === "waiting" ? "wait" : ""}` }, b);
      const pat = el("pattern", { id: "hatch", width: 5, height: 5, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, el("defs", {}, svg));
      el("rect", { width: 1.7, height: 5, fill: P.bg, opacity: .9 }, pat);
      const x = scale(0, widest * 1.01, m.l, W - m.r);
      rows.forEach((segs, r) => {
        const y = m.t + r * (rh + gap);
        text(svg, m.l - 10, y + rh / 2 + 4, String(r + 1), { "text-anchor": "end", fill: MUTED, "font-size": narrow ? 11 : 12 });
        const g = el("g", { class: "arow", style: `--i:${r}` }, svg);
        let left = 0;
        segs.forEach((sg) => {
          const x0 = x(left), w = Math.max(0, x(left + sg.w) - x0 - .8);
          el("rect", { x: x0, y, width: w, height: rh, fill: sg.fill, class: sg.fresh ? "fresh" : "" }, g);
          if (sg.hatch) el("rect", { x: x0, y, width: w, height: rh, fill: "url(#hatch)" }, g);
          left += sg.w;
        });
      });
      el("line", { x1: m.l - 3, x2: m.l - 3, y1: m.t, y2: m.t + n * (rh + gap) - gap, stroke: INK, "stroke-width": 1.2 }, svg);
      text(svg, m.l, H - 8, "Context billed at each turn →", { fill: INK, "font-size": 12.5 });
      text(svg, m.l - 10, m.t - 6, "Turn", { "text-anchor": "end", fill: MUTED, "font-size": 10.5 });
      // legend, in the same colours
      const sw = (fill, extra = "") => `<span class="asw" style="background:${fill};${extra}"></span>`;
      $("#anatomy-legend").innerHTML = Object.entries(A.labels).map(([cat, label]) => `<li>${sw(P.written(A.colors[cat]))}${label}</li>`).join("") +
        `<li>${sw(P.prefix)}Prefix: system + tools</li>` +
        `<li>${sw(P.replayed(A.colors.Read), `background-image:repeating-linear-gradient(45deg,${P.bg} 0 2px,transparent 2px 5px)`)}Replayed from earlier turns</li>`;
    });

    function play() {
      state = "done";
      const svg = $("svg", box);
      if (!svg) return;
      svg.classList.remove("wait");
      restart(svg, "play");
    }
    if (state === "waiting") onceVisible(box, play, .35);
    $("#anatomy-replay").addEventListener("click", () => { if (!reduceMotion) play(); });
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
    settingListeners.push((id) => {
      $("#table1 table").classList.toggle("has-hi", !!id);
      $$("#table1 [data-col]").forEach((c) => c.classList.toggle("col-hi", c.dataset.col === id));
    });
  })();

  /* ---------------------------------------------------------------- setting chips */
  // Two chip groups, one beside the charts and one above the table, share one selection.
  (function chips() {
    const groups = $$("[data-setting-chips]");
    const options = [[null, "All"], ...D.settings.map((st) => [st.id, `${st.agent} <small>${st.model}</small>`])];
    groups.forEach((box) => options.forEach(([id, html]) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "chip"; b.innerHTML = html; b.dataset.setting = id || "";
      b.setAttribute("aria-pressed", String(id === null));
      b.addEventListener("click", () => {
        highlightSetting = id;
        $$("[data-setting-chips] .chip").forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.setting === (id || ""))));
        settingListeners.forEach((f) => f(id));
      });
      box.append(b);
    }));
  })();

  /* ---------------------------------------------------------------- Figure 3(a): per-repository strip */
  (function strip() {
    const ARMS = ["rtk", "repomap", "te", "te_rtk", "te_repomap"];
    const box = $("#strip-chart");
    let render, state = reduceMotion ? "done" : "waiting";
    chart(box, (b, W) => { render = () => { b.innerHTML = ""; draw(b, b.clientWidth); }; draw(b, W); });
    settingListeners.push(() => render && render());
    function draw(b, W) {
      const narrow = W < 440;
      const m = { l: narrow ? 6 : 122, r: 50, t: 22, b: 40 };
      const band = narrow ? 62 : 50;
      const H = m.t + ARMS.length * band + m.b;
      const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: state === "waiting" ? "slide-wait" : "" }, b);
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
          const mk = marker(svg, METHOD[a].marker, x(r.cost), y, highlightSetting && !dim ? 4.6 : 3.8, color, { opacity: dim ? .14 : .9, class: "sm", style: `--dx:${(x(0) - x(r.cost)).toFixed(1)}px;--d:${i * 140 + Math.round(rand() * 160)}ms` });
          mk.setAttribute("data-tip", `${sw(METHOD[a].color)}<b>${METHOD[a].label}</b> · ${REPO_NAME[r.repo]}<br>${settingName(r.setting)}<br><span class="tt-v">${pct(r.cost)}</span> cost vs. default`);
        });
        const mean = rows.reduce((s, r) => s + r.cost, 0) / rows.length;
        el("line", { class: "late", x1: x(mean), x2: x(mean), y1: yc - 14, y2: yc + 14, stroke: tok("--ink"), "stroke-width": 2, "stroke-linecap": "round", "data-tip": `<b>${METHOD[a].label}</b> mean over 30 cells<br><span class="tt-v">${pct(mean)}</span>` }, svg);
        const worse = rows.filter((r) => r.cost > 0).length;
        text(svg, W - m.r + 8, yc + 4, `${worse}/30`, { class: "late", "font-size": 11.5, fill: worse ? tok("--ink-2") : tok("--good"), "font-weight": 600 });
      });
      text(svg, W - m.r + 8, 12, "costlier", { "font-size": 11 });
      bindTips(svg);
    }
    if (state === "waiting") onceVisible(box, () => {
      state = "done";
      const svg = $("svg", box);
      if (svg) { svg.classList.add("slide-go"); svg.classList.remove("slide-wait"); }
    }, .4);
    // data table
    const keys = [];
    D.settings.forEach((s) => D.repos.forEach((r) => keys.push([s.id, r])));
    const val = (sid, repo, arm) => D.perRepo.find((r) => r.setting === sid && r.repo === repo && r.arm === arm).cost;
    $("#strip-table").innerHTML = `<table class="t"><thead><tr><th>Setting · repository</th>${ARMS.map((a) => `<th>${METHOD[a].label}</th>`).join("")}</tr></thead><tbody>${keys.map(([sid, repo]) => `<tr><td>${settingName(sid)} · ${REPO_NAME[repo]}</td>${ARMS.map((a) => `<td>${pct(val(sid, repo, a))}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  })();

  /* ---------------------------------------------------------------- Figure 3(b): frontier */
  // On first view the chart tells its story in steps: the default, then reduced effort,
  // then the fixed strategies, then TokenEconomizer, and finally the frontier line.
  (function frontier() {
    const ARMS = ["medium", "low", "rtk", "repomap", "te", "te_rtk", "te_repomap"];
    const GROUP = { medium: "effort", low: "effort", rtk: "fixed", repomap: "fixed", te: "te", te_rtk: "te", te_repomap: "te" };
    const STORY = [
      "Default execution sits at the origin of every setting.",
      "Lowering reasoning effort cuts cost, but Pass@1 falls.",
      "RTK and RepoMap move cost a little, in both directions.",
      "TokenEconomizer variants cut cost by up to a third, with Pass@1 near or above default.",
      "The dashed line is the frontier: the cheapest result at each Pass@1 level.",
    ];
    const STEP_CLASS = ["", "g-effort", "g-fixed", "g-te", "g-front"];
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

    // step: -1 before the story plays, 0-4 while it plays, 5 once it is over
    let step = reduceMotion ? 5 : -1, timers = [], frontClip = null, frontX = [0, 0];
    const box = $("#frontier-chart"), caption = $("#frontier-story");
    let render;
    chart(box, (b, W) => { render = () => { b.innerHTML = ""; draw(b, b.clientWidth); }; draw(b, W); });
    settingListeners.push(() => { finish(); render && render(); });

    function draw(b, W) {
      const m = { l: 48, r: 14, t: 10, b: 42 };
      const H = W >= 420 ? 312 : Math.round(Math.max(260, W * .8));
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
      // the frontier draws in from the left, through a clip that widens
      frontX = [x(front[0].x) - 8, x(front[front.length - 1].x) + 8];
      frontClip = el("rect", { x: frontX[0], y: 0, height: H, width: step >= 4 ? frontX[1] - frontX[0] : 0 }, el("clipPath", { id: "front-clip" }, el("defs", {}, svg)));
      el("path", { d: front.map((p, i) => (i ? "L" : "M") + x(p.x) + "," + y(p.y)).join(""), fill: "none", stroke: tok("--ink-2"), "stroke-width": 1.2, "stroke-dasharray": "5 4", opacity: .7, "clip-path": "url(#front-clip)" }, svg);
      const order = [...pts].sort((p, q) => (p.arm.startsWith("te") ? 1 : 0) - (q.arm.startsWith("te") ? 1 : 0));
      order.forEach((p) => {
        if (!on[p.arm]) return;
        const dim = highlightSetting && p.setting !== highlightSetting;
        const mk = marker(svg, METHOD[p.arm].marker, x(p.x), y(p.y), p.arm.startsWith("te") ? 5.4 : 4.6, tok(METHOD[p.arm].color), { opacity: dim ? .14 : .95, class: "pt", "data-g": GROUP[p.arm] });
        mk.setAttribute("data-tip", `${sw(METHOD[p.arm].color)}<b>${METHOD[p.arm].label}</b><br>${settingName(p.setting)}<br>Cost <span class="tt-v">${pct(p.x)}</span> · Pass@1 <span class="tt-v">${sign(p.y)}</span> pts`);
      });
      marker(svg, "star", x(0), y(0), 6, tok("--surface"), { stroke: tok("--ink"), "stroke-width": 1.4, class: "star0", "data-tip": "<b>Default execution</b><br>high reasoning effort, no external control" });
      if (step < 5) svg.classList.add("story", ...STEP_CLASS.slice(1, Math.max(1, step + 1)).filter(Boolean));
      bindTips(svg);
    }

    function setStep(i) {
      step = i;
      caption.textContent = STORY[Math.min(i, STORY.length - 1)];
      caption.classList.remove("in"); void caption.offsetWidth; caption.classList.add("in");
      const svg = $("svg", box);
      if (svg && STEP_CLASS[i]) svg.classList.add(STEP_CLASS[i]);
      if (i === 4) tween(1300, (e) => frontClip && frontClip.setAttribute("width", (frontX[1] - frontX[0]) * e));
    }
    function finish() {
      timers.forEach(clearTimeout); timers = [];
      if (step >= 5) return;
      step = 5;
      caption.textContent = STORY[STORY.length - 1];
      const svg = $("svg", box);
      if (svg) { svg.classList.remove("story"); if (frontClip) frontClip.setAttribute("width", frontX[1] - frontX[0]); }
    }
    function play() {
      if (reduceMotion) return;
      timers.forEach(clearTimeout); timers = [];
      step = -1; render();
      [0, 1, 2, 3, 4].forEach((i) => timers.push(setTimeout(() => setStep(i), 300 + i * 1500)));
      timers.push(setTimeout(finish, 300 + 5 * 1500 + 600));
    }
    caption.textContent = STORY[STORY.length - 1];
    if (step === -1) { caption.textContent = STORY[0]; onceVisible(box, play, .45); }
    $("#frontier-replay").addEventListener("click", play);
  })();

  /* ---------------------------------------------------------------- Figure 3(c): savings over the stream */
  // Cumulative cost change after each task, one line per repository, averaged over the two
  // Claude Code settings. The lines draw in together, task by task, so the moment each
  // repository turns cheaper is visible; hovering reads off every repository at one task.
  (function amortization() {
    const C = D.amortization, box = $("#amort-chart");
    if (!box) return;
    const REPOS = ["django", "matplotlib", "scikit-learn", "sphinx", "sympy", "xarray"];
    const COLOR = (r) => `--r-${r.replace("scikit-", "sk")}`;
    const KMAX = Math.max(...REPOS.map((r) => C[r][C[r].length - 1][0]));
    let k = reduceMotion ? KMAX : 1, state = reduceMotion ? "done" : "waiting", focus = null, refs = null;

    const legend = $("#amort-legend");
    REPOS.forEach((r) => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("aria-pressed", "false");
      b.innerHTML = `<svg viewBox="0 0 16 10" aria-hidden="true"><line x1="1" x2="15" y1="5" y2="5" stroke="var(${COLOR(r)})" stroke-width="2.6" stroke-linecap="round"/></svg>${REPO_NAME[r]}`;
      b.addEventListener("click", () => {
        focus = focus === r ? null : r;
        $$("button", legend).forEach((x) => x.setAttribute("aria-pressed", String(x === b && focus === r)));
        legend.classList.toggle("has-focus", !!focus);
        paintFocus();
      });
      li.append(b);
      legend.append(li);
    });

    chart(box, draw);
    function draw(b, W) {
      const m = { l: 46, r: 14, t: 14, b: 42 };
      const H = Math.round(Math.min(330, Math.max(240, W * .6)));
      const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H }, b);
      const x = scale(1, KMAX, m.l, W - m.r), y = scale(-48, 40, H - m.b, m.t);
      el("rect", { class: "wash", x: m.l, y: y(40), width: W - m.r - m.l, height: y(0) - y(40) }, svg);
      const g = el("g", { class: "grid" }, svg);
      for (const t of [-40, -20, 20, 40]) el("line", { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t) }, g);
      for (const t of [-40, -20, 0, 20, 40]) text(svg, m.l - 8, y(t) + 4, t ? sign(t, 0) : "0", { "text-anchor": "end" });
      for (const t of [1, 10, 20, 30, 40, 50, 60]) text(svg, x(t), H - m.b + 18, String(t), { "text-anchor": "middle" });
      el("line", { class: "zero", x1: m.l, x2: W - m.r, y1: y(0), y2: y(0) }, svg);
      text(svg, W - m.r - 6, y(40) + 16, "more expensive", { "text-anchor": "end", "font-size": 11.5 });
      text(svg, W - m.r - 6, y(-48) - 8, "cheaper", { "text-anchor": "end", "font-size": 11.5, fill: tok("--good") });
      text(svg, (m.l + W - m.r) / 2, H - 4, "Tasks completed in the repository", { "text-anchor": "middle", class: "ink", "font-size": 12.5 });
      const yl = text(svg, 0, 0, "Cumulative cost change (%)", { "text-anchor": "middle", class: "ink", "font-size": 12.5, transform: `translate(12 ${(m.t + H - m.b) / 2}) rotate(-90)` });
      yl.removeAttribute("x"); yl.removeAttribute("y");

      const clipId = "amort-clip";
      const clip = el("rect", { x: 0, y: 0, height: H, width: x(k) + 2 }, el("clipPath", { id: clipId }, el("defs", {}, svg)));
      const lines = el("g", { "clip-path": `url(#${clipId})` }, svg);
      const paths = {};
      REPOS.forEach((r) => {
        paths[r] = el("path", { d: C[r].map(([kk, v], i) => (i ? "L" : "M") + x(kk).toFixed(1) + "," + y(v).toFixed(1)).join(""), fill: "none", stroke: tok(COLOR(r)), "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }, lines);
      });
      const cursor = el("g", { class: "cursor", opacity: state === "playing" ? 1 : 0 }, svg);
      const cline = el("line", { x1: x(k), x2: x(k), y1: m.t, y2: H - m.b, stroke: tok("--ink-2"), "stroke-width": 1, "stroke-dasharray": "3 3" }, cursor);
      const ctext = text(cursor, x(k) + 6, m.t + 12, `task ${k}`, { class: "ink", "font-size": 11.5, "font-weight": 600 });
      const hover = el("g", { opacity: 0 }, svg);
      const hline = el("line", { y1: m.t, y2: H - m.b, stroke: tok("--ink-2"), "stroke-width": 1 }, hover);
      const dots = Object.fromEntries(REPOS.map((r) => [r, el("circle", { r: 4, fill: tok(COLOR(r)), stroke: tok("--surface"), "stroke-width": 1.5 }, hover)]));
      refs = { clip, cline, ctext, cursor, paths, x };

      // crosshair: the nearest task, every repository that reached it
      const hit = el("rect", { x: m.l, y: m.t, width: W - m.r - m.l, height: H - m.b - m.t, fill: "transparent" }, svg);
      hit.addEventListener("pointermove", (e) => {
        if (state === "playing") return;
        const pt = svg.getBoundingClientRect();
        const kk = Math.max(1, Math.min(KMAX, Math.round(1 + (e.clientX - pt.left - m.l) / (W - m.r - m.l) * (KMAX - 1))));
        hover.setAttribute("opacity", 1);
        hline.setAttribute("x1", x(kk)); hline.setAttribute("x2", x(kk));
        const rowsAt = REPOS.map((r) => [r, (C[r].find((p) => p[0] === kk) || [])[1]]).filter(([, v]) => v != null).sort((a, b2) => a[1] - b2[1]);
        REPOS.forEach((r) => {
          const v = (C[r].find((p) => p[0] === kk) || [])[1];
          dots[r].setAttribute("opacity", v == null ? 0 : 1);
          if (v != null) { dots[r].setAttribute("cx", x(kk)); dots[r].setAttribute("cy", y(v)); }
        });
        showTip(`<b>After task ${kk}</b><br>` + rowsAt.map(([r, v]) => `${sw(COLOR(r))}${REPO_NAME[r]} <span class="tt-v">${pct(v)}</span>`).join("<br>"), e.clientX, e.clientY);
      });
      hit.addEventListener("pointerleave", () => { hover.setAttribute("opacity", 0); hideTip(); });
      paintFocus();
    }
    function paintFocus() {
      if (!refs) return;
      REPOS.forEach((r) => {
        refs.paths[r].setAttribute("opacity", focus && focus !== r ? .18 : 1);
        refs.paths[r].setAttribute("stroke-width", focus === r ? 3 : 2);
      });
    }
    function setK(kk) {
      k = kk;
      if (!refs) return;
      const px = refs.x(Math.max(1, kk));
      refs.clip.setAttribute("width", px + 2);
      refs.cline.setAttribute("x1", px); refs.cline.setAttribute("x2", px);
      refs.ctext.setAttribute("x", px + 6);
      refs.ctext.textContent = `task ${Math.round(kk)}`;
    }
    function play() {
      if (reduceMotion) return;
      state = "playing";
      if (refs) refs.cursor.setAttribute("opacity", 1);
      const t0 = performance.now(), dur = 3600;
      const frame = (t) => {
        const p = Math.min(1, (t - t0) / dur);
        setK(1 + (KMAX - 1) * p);
        if (p < 1) requestAnimationFrame(frame);
        else { state = "done"; if (refs) refs.cursor.setAttribute("opacity", 0); }
      };
      requestAnimationFrame(frame);
    }
    if (state === "waiting") onceVisible(box, play, .4);
    $("#amort-replay").addEventListener("click", play);
  })();

  /* ---------------------------------------------------------------- ablation */
  (function ablation() {
    const ROWS = [["skills", "Micro-skills", "--s1"], ["pruning", "Tool pruning", "--s2"], ["guard", "Failure-loop guard", "--s3"], ["te", "Combined", "--m-te"]];
    $("#ablation").innerHTML = ["cc-sonnet", "cc-opus"].map((id) => {
      const a = D.ablation[id];
      return `<div class="abl"><h4>${settingName(id)}</h4><div class="abl-row abl-head"><span></span><span></span><span class="v">Δ Cost</span><span class="v">Pass@1</span></div>` +
        `<div class="abl-row"><span>Default</span><span></span><span class="v">—</span><span class="v">${a.default.pass.v.toFixed(1)}</span></div>` +
        ROWS.map(([k, label, c]) =>
        `<div class="abl-row${k === "te" ? " total" : ""}"><span>${label}</span><span class="bar"><i data-w="${(Math.abs(a[k].cost.v) / 35 * 100).toFixed(1)}" style="background:var(${c})"></i></span><span class="v">${pct(a[k].cost.v)}</span><span class="v">${a[k].pass.v.toFixed(1)}</span></div>`).join("") + `</div>`;
    }).join("");
    growBars($("#ablation"));
  })();

  /* ---------------------------------------------------------------- generalization */
  (function generalization() {
    const META = {
      "Web-Bench": { title: "Web-Bench", sub: "Sequential web development · 102 tasks in 5 projects · Pass@2" },
      CredData: { title: "CredData", sub: "Credential detection · 100 tasks · detection F1" },
      ReposVul: { title: "ReposVul", sub: "Vulnerability detection · 100 tasks · detection F1" },
    };
    const groups = [...new Set(D.transfer.map((r) => r.workload))];
    $("#gen").innerHTML = groups.map((w) => {
      const rows = D.transfer.filter((r) => r.workload === w);
      return `<article class="gcard reveal"><h3>${META[w].title}</h3><p class="sub">${META[w].sub}</p>${rows.map((r) =>
        `<div class="grow"><span>${r.agent}</span><span class="bar"><i data-w="${(Math.abs(r.cost.v) / 25 * 100).toFixed(1)}"></i></span><span class="v">${pct(r.cost.v)}</span></div>` +
        `<p class="grow-q">quality <b>${r.default.v.toFixed(1)}</b> → <b>${r.te.v.toFixed(1)}</b></p>`).join("")}</article>`;
    }).join("");
    growBars($("#gen"));
  })();

  /* ---------------------------------------------------------------- examples from the paper's appendix */
  // Trace lines: [kind, text]; kind is cmd, out, ok, bad, note, redirect, or stop.
  function traceHTML(t) {
    return `<div class="trace${t.te ? " te" : ""}"><header><b>${esc(t.title)}</b><span class="turns">${esc(t.turns)}</span></header><pre>${t.lines.map(([k, s]) => `<span class="ln ${k === "cmd" ? "" : k === "ok" || k === "bad" ? "out " + k : k}">${esc(s)}</span>`).join("")}</pre></div>`;
  }
  function play(container) {
    if (reduceMotion) return;
    $$(".trace", container).forEach((t) => {
      const lines = $$(".ln", t);
      t.classList.add("playing");
      lines.forEach((l) => l.classList.remove("shown"));
      lines.forEach((l, i) => setTimeout(() => l.classList.add("shown"), 250 + i * 330));
    });
  }

  const GROUPS = { skill: ["Micro-skill injection", "s1"], prune: ["Tool pruning", "s2"], loop: ["Failure-loop intervention", "s3"] };
  const EXAMPLES = [
    {
      id: "a", kind: "skill", repo: "sympy", setting: "Claude Code, Opus 4.8", short: "Opus 4.8", badge: ["on", "Injected on tasks 10–60"],
      summary: "Without help, the agent first tries pytest, which this sympy environment does not have, and then a runner that runs no tests, before it finds one that works. TokenEconomizer learns that sympy's own test runner works and tells the agent before each task.",
      skill: "Besides pytest, tests can be run through the native runner `python -c \"import sympy; sympy.test('sympy/.../test_x.py')\"` or `python -m sympy.utilities.runtests`.",
      det: [["scope", "ran_tests"], ["confirm", "sympy\\.utilities\\.runtests|sympy\\.test\\("], ["contradict", "–"], ["need", "sympy_test_runner (sympy\\.utilities\\.runtests|sympy\\.test\\( in a command)"]],
      span: "60 tasks",
      life: [["proposed", "after task 9, based on tasks 5 and 6"], ["activated", "right away: checking back over earlier tasks found confirmations on tasks 3, 5, and 6, which edited different files (matexpr.py, permutations.py, sparse.py), and it passed the need check (4 of 4 tasks)"], ["injected", "into tasks 10–60"], ["outcome", "still active at the end: confirmed on all 10 tasks that exercised it, never contradicted"]],
      result: "With the skill, the agent runs sympy's own test runner directly and finishes in 11 turns instead of 15.",
      tracesTitle: "Task 11 (sympy-13615), without and with the skill",
      traces: [
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
    },
    {
      id: "b", kind: "skill", repo: "sphinx", setting: "Claude Code, Sonnet 5", short: "Sonnet 5", badge: ["on", "Injected on tasks 7–44"],
      summary: "The skill tells the agent how issues in this repository are usually reproduced: build a minimal Sphinx project and run it. Tasks 1 and 3 confirmed it, but both edited a file named conf.py, so the controller waited for tasks that edited other files before injecting it.",
      skill: "The canonical way to reproduce an issue in this repo is to build a minimal Sphinx project under /tmp with a conf.py and run `python -m sphinx -b <builder> <srcdir> <outdir>`.",
      det: [["scope", "python -m sphinx -b"], ["confirm", "python -m sphinx -b \\S+ \\S+ \\S+"], ["contradict", "–"], ["need", "–"]],
      span: "44 tasks",
      life: [["proposed", "after task 4, based on tasks 1–3"], ["waiting", "tasks 1 and 3 confirmed it, but both edited a file named conf.py, so together they count as one of the 3 confirmations needed"], ["activated", "after task 6, once tasks 5 (inheritance_diagram.py) and 6 (other.py, toctree.py) confirmed it; it passed the need check (4 of 4 tasks)"], ["injected", "into tasks 7–44"], ["outcome", "still active at the end: confirmed on all 32 tasks that exercised it, never contradicted"]],
      result: "With the skill, the agent reproduces the issue with a minimal project and finishes in 10 turns instead of 11.",
      tracesTitle: "Task 15 (sphinx-7889), without and with the skill",
      traces: [
        { title: "Default", turns: "11 turns", lines: [
          ["note", "(7 tool calls: read and edit mock.py, check git log and the installed version)"],
          ["cmd", "$ python -c \"from sphinx.ext.autodoc.mock import _MockObject; ...; print(obj[T])\""],
          ["out", "_MockObject.~T"],
          ["note", "(1 tool call: a second inline check)"],
          ["cmd", "$ python -m pytest tests/test_ext_autodoc_mock.py -q 2>&1 | tail -20"],
        ] },
        { title: "TokenEconomizer", turns: "10 turns", te: true, lines: [
          ["note", "(5 tool calls: read mock.py, search git log, edit, run an inline check)"],
          ["cmd", "$ mkdir -p /tmp/genericmock/mymod; cat > /tmp/genericmock/conf.py <<'EOF' ... autodoc_mock_imports = ['missingdep'] ... EOF; cd /tmp/genericmock && python -m sphinx -b html . _build"],
          ["ok", "build succeeded, 1 warning."],
          ["cmd", "$ git stash && cd /tmp/genericmock && python -m sphinx -b html . _build ...; git stash pop"],
          ["note", "(2 tool calls: run tests/test_ext_autodoc_mock.py, clean up)"],
        ] },
      ],
    },
    {
      id: "c", kind: "skill", repo: "sympy", setting: "Claude Code, Sonnet 5", short: "Sonnet 5", badge: ["off", "Wrong, retired after one use"], stakes: true,
      summary: "A wrong fact gets caught. The skill tells the agent to run tests with pytest, but this environment has no pytest. Its early confirmations came only from the agent typing the pytest command, which its detector matched. The first task that received it hit the missing module, the controller counted that as a contradiction, and the skill was retired after one injection.",
      skill: "Run sympy tests with `python -m pytest sympy/<subpackage>/tests/test_<name>.py -q`; this is the canonical test invocation for this repo.",
      det: [["scope", "pytest_module_used (python -m pytest sympy/.*test_.*\\.py in a command)"], ["confirm", "python -m pytest sympy/.*test_.*\\.py"], ["contradict", "ImportError|ModuleNotFoundError|no tests ran|error: unrecognized"], ["need", "–"]],
      span: "60 tasks",
      life: [["proposed", "after task 4, based on tasks 2 and 4"], ["confirmed", "right away, on tasks 2, 3, and 4, which edited different files"], ["activated", "after task 5, once 4 tasks had exercised it, the minimum for the need check"], ["injected", "into task 6 only"], ["retired", "after task 6, whose ModuleNotFoundError contradicted it; one contradiction counts as λ = 5 confirmations, so its support fell below zero"], ["outcome", "over the whole stream, 51 tasks exercised it: 40 confirmed it and 11 contradicted it"]],
      tracesTitle: "Task 6 (sympy-13031), the only task that received the skill",
      traces: [
        { title: "TokenEconomizer", turns: "15 turns", te: true, lines: [
          ["note", "(11 tool calls: locate the stacking code, run reproductions, read git history)"],
          ["cmd", "$ python -m pytest sympy/matrices/tests/test_commonmatrix.py -q -k \"hstack or vstack\" 2>&1 | tail -20"],
          ["bad", "/opt/miniconda3/envs/testbed/bin/python: No module named pytest"],
          ["cmd", "$ source activate testbed 2>/dev/null; which python; python -c \"import pytest\" 2>&1; conda env list"],
          ["bad", "ModuleNotFoundError: No module named 'pytest'"],
          ["note", "(1 tool call: run the tests with bin/test)"],
        ] },
      ],
    },
    {
      id: "d", kind: "skill", repo: "sympy", setting: "Claude Code, Opus 4.8", short: "Opus 4.8", badge: ["held", "True but not needed"], stakes: true,
      summary: "A true fact that is not worth its tokens. It says no reinstall is needed after editing sympy, and that holds, but the agent never tries to reinstall anyway. Injecting it would only add tokens to every turn, so it is never injected.",
      skill: "The sympy package is imported from the in-tree source, so edits to .py files take effect immediately; no `pip install`/`setup.py develop` reinstall is required before testing.",
      det: [["scope", "ran_tests"], ["confirm", "python -m pytest\\s+sympy/|sympy\\.test\\("], ["contradict", "pip install|setup\\.py\\s+(develop|install)"], ["need", "reinstall_invoked (pip install|setup\\.py\\s+(develop|install) in a command)"]],
      span: "60 tasks",
      life: [["proposed", "after task 9, based on tasks 3 and 6"], ["confirmed", "right away, on tasks 3, 5, and 6, which edited different files"], ["held back", "on every task: none of the tasks that exercised it tried to reinstall, so its need rate stayed at 0, below ρ = 0.4"], ["outcome", "never injected: confirmed on 10 tasks, never contradicted, needed by none"]],
    },
    {
      id: "e", kind: "skill", repo: "sphinx", setting: "Claude Code, Sonnet 5", short: "Sonnet 5", badge: ["cand", "Not enough evidence"], stakes: true,
      summary: "Evidence from one file is not enough. The skill names the test file for one module. It was confirmed 7 times, but all of those tasks except one edited a file named python.py, so they say more about that module than about the repository. It never reached 3 confirmations from tasks that edited different files.",
      skill: "The canonical test file for sphinx/domains/python.py is tests/test_domain_py.py; Python-domain edits are verified with `python -m pytest tests/test_domain_py.py`.",
      det: [["scope", "domains/python\\.py|test_domain_py"], ["confirm", "test_domain_py\\.py"], ["contradict", "test_domain_py\\.py.{0,20}(FAILED|ERROR|not found)"], ["need", "–"]],
      span: "44 tasks",
      life: [["proposed", "after task 34, based on tasks 30 and 34"], ["confirmed on", "tasks 30, 33, 34, 38, 39, 40, and 43; every one except task 33 (docfields.py) edited a file named python.py"], ["outcome", "never injected: 7 confirmations, but only 2 count as coming from tasks with non-overlapping edits, short of the 3 required"]],
    },
    {
      id: "f", kind: "prune", repo: "django", setting: "Claude Code, Sonnet 5", short: "Claude Code", badge: ["s2", "19 of 23 tools masked"],
      intro: "Claude Code loads 23 tools on every turn. From task 2 of the Django stream on, 19 of them are masked: first because the LLM judge finds them irrelevant to the task, and by task 4 also because none was called in three tasks. Only Bash, Edit, Read, and Write stay loaded, so the first request of each task falls from about 42–43k to about 15–16k prompt tokens.",
      kept: ["Bash", "Edit", "Read", "Write"],
      masked: ["AskUserQuestion", "CronCreate", "CronDelete", "CronList", "EnterPlanMode", "EnterWorktree", "ExitPlanMode", "ExitWorktree", "NotebookEdit", "ScheduleWakeup", "Skill", "Task", "TaskCreate", "TaskGet", "TaskList", "TaskOutput", "TaskStop", "TaskUpdate", "Workflow"],
      tasks: [["django-10097", 42866, 42866, "No history yet, so all 23 tools are loaded"], ["django-10554", 16295, 43351, "Before the task, the LLM judge masks 19 tools it finds irrelevant"], ["django-10880", 15003, 42059, "The judge masks the same 19"], ["django-10914", 15299, 42355, "The same 19 are now also masked on evidence: none was called in the last 3 tasks"]],
    },
    {
      id: "g", kind: "prune", repo: "django", setting: "Copilot CLI, Sonnet 5", short: "Copilot CLI", badge: ["s2", "10 of 19 tools masked"],
      intro: "The same procedure on Copilot CLI, which loads 19 tools, masks 10 of them from task 2 on. The first request of each task falls from about 25–26k to about 10–11k prompt tokens.",
      kept: ["bash", "create", "edit", "glob", "grep", "list_bash", "read_bash", "stop_bash", "view"],
      masked: ["factories_manage", "fetch_copilot_cli_documentation", "list_agents", "read_agent", "run_factory", "session_store_sql", "skill", "sql", "task", "write_agent"],
      tasks: [["django-10097", 25765, 25760, "No history yet, so all 19 tools are loaded"], ["django-10554", 11347, 26249, "Before the task, the LLM judge masks 10 tools it finds irrelevant"], ["django-10880", 10066, 24969, "The judge masks the same 10"], ["django-10914", 10343, 25248, "The same 10 are now also masked on evidence: none was called in the last 3 tasks"]],
    },
    {
      id: "h", kind: "loop", repo: "sphinx", setting: "Claude Code, Opus 4.8", short: "Opus 4.8", badge: ["s3", "Redirect · 31 vs. 42 turns"], task: "sphinx-11445",
      intro: "The agent keeps editing the same file without running a test. After 18 turns, with 11 edits and the same failure three times, the LLM judge decides the agent is stuck and redirects it with a summary of what it has tried. The agent then runs the tests, they pass, and it finishes in 31 turns; default execution passes after 42.",
      strips: [
        { label: "Default", right: "42 turns · passes", n: 42, cells: () => "", caption: "18 edits to sphinx/util/rst.py and 3 test runs before the task passes" },
        { label: "TokenEconomizer", right: "31 turns · finishes", n: 31, cells: (i) => (i < 18 ? "loop" : "after") },
      ],
      legend: [["loop", "before the redirect"], ["after", "after the redirect"]],
      lines: [
        ["note", "turns 1–18: 11 edits to sphinx/util/rst.py, no test run, the same failure repeated 3 times"],
        ["redirect", "Redirect (trace judge: stuck, confidence 0.72)"],
        ["out", "Process check (automated): so far you've made 11 edits across 1 file(s) ... and run 0 verification(s) ... try a MATERIALLY DIFFERENT hypothesis: re-read the failing test's expectation ..."],
        ["cmd", "$ grep -rn \"prepend_prolog\\|rst_prolog\\|docinfo\" /testbed/tests/test_util_rst.py"],
        ["cmd", "$ python -c \"from sphinx.util.rst import prepend_prolog; ...\""],
        ["cmd", "$ python -m pytest tests/test_util_rst.py -q 2>&1 | tail -15"],
        ["ok", "7 passed in 0.65s"],
      ],
    },
    {
      id: "i", kind: "loop", repo: "xarray", setting: "Claude Code, Opus 4.8", short: "Opus 4.8", badge: ["s3", "Forced stop · 7 turns sooner"], task: "xarray-6798",
      intro: "A task that default execution also fails. The turn budget learned for this repository is 10.25 turns. Once the run is past 2.5 times the budget, with repeated edits, dense errors, and a repeated failure all present, the controller stops it. The task fails either way, but TokenEconomizer stops 7 turns sooner.",
      strips: [
        { label: "Default", right: "32 turns · fails", n: 32, cells: () => "", caption: "6 edits to xarray/core/coordinates.py and 3 test runs; the task still fails" },
        { label: "TokenEconomizer", right: "25 turns · fails", n: 25, cells: (i) => (i === 24 ? "mark" : i >= 10 ? "loop" : ""), budget: 10.25 },
      ],
      legend: [["loop", "past the budget <em>B</em><sub>i</sub>"], ["mark", "forced stop"]],
      lines: [
        ["note", "learned turn budget B_i = 10.25 turns; forced stop at 2.5 B_i"],
        ["note", "by then: 7 edits to xarray/core/coordinates.py, 14 error outputs, the same failure repeated 3 times"],
        ["stop", "Stop: past 2.5 B_i, and the strict stall rule fires"],
        ["note", "the task fails, as it does under default execution, 7 turns sooner"],
      ],
    },
  ];

  const REPLAY_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>';
  const tracesBlock = (title, traces) =>
    `<div class="ex-h ex-h-row"><span>${esc(title)}</span><button class="replay" type="button" data-replay>${REPLAY_ICON}Replay</button></div><div class="traces">${traces.map(traceHTML).join("")}</div>`;

  function skillHTML(x) {
    return `<p class="ex-intro">${esc(x.summary)}</p>` +
      `<div class="skillbox" style="margin-top:14px"><span class="tag">MICRO-SKILL${x.stakes ? " · HIGH-STAKES" : ""}</span>${esc(x.skill)}</div>` +
      (x.traces ? tracesBlock(x.tracesTitle, x.traces) + (x.result ? `<p class="ex-result">${esc(x.result)}</p>` : "") : "") +
      `<details class="ex-more"><summary>How the controller handled it, over the stream's ${x.span}</summary>` +
      `<ul class="timeline" style="margin-top:10px">${x.life.map(([k, v]) => `<li><span>${k}</span><span>${esc(v)}</span></li>`).join("")}</ul>` +
      `<p>The skill's detectors, as the proposer wrote them: <b>scope</b> says whether a task ran into the situation, <b>confirm</b> and <b>contradict</b> whether the trace agreed with the skill, and <b>need</b> whether the task needed it. A dash means none was given.</p>` +
      `<dl class="detectors">${x.det.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl></details>`;
  }

  function loopHTML(x) {
    const max = Math.max(...x.strips.map((s) => s.n));
    const strips = x.strips.map((s) => {
      let cells = "";
      for (let i = 0; i < max; i++) cells += `<i class="${i < s.n ? s.cells(i) : "ghost"}" style="--i:${i}"></i>`;
      const budget = s.budget ? `<span class="budget" style="left:calc(${s.budget / max * 100}% - 1px)"></span><span class="budget-label" style="left:calc(${s.budget / max * 100}% + 5px)">B<sub>i</sub> = ${s.budget}</span>` : "";
      return `<div class="turnstrip${s.budget ? " has-budget" : ""}"><div class="lab"><b>${s.label}</b><span>${s.right}</span></div><div class="cells-wrap"><div class="cells" style="grid-template-columns:repeat(${max},minmax(0,1fr))">${cells}</div>${budget}</div>${s.caption ? `<p class="caption">${esc(s.caption)}</p>` : ""}</div>`;
    }).join("");
    const legend = `<div class="mini-legend">${x.legend.map(([c, l]) => `<span><i class="lg-${c}"></i>${l}</span>`).join("")}<span><i class="lg-ghost"></i>turns saved</span></div>`;
    return `<p class="ex-intro">${esc(x.intro)}</p><h4 class="ex-h">Turns, one cell each</h4>` + strips + legend +
      tracesBlock(`What TokenEconomizer does (${x.task})`, [{ title: "TokenEconomizer", turns: x.strips[1].right.split(" · ")[0], te: true, lines: x.lines }]);
  }

  function pruneHTML(x) {
    return `<p class="ex-intro">${esc(x.intro)}</p>` +
      `<h4 class="ex-h">Tools loaded <span class="ex-h-note">solid: kept · struck through: masked</span></h4><div class="toolgrid"></div>` +
      `<h4 class="ex-h">Prompt tokens of each task's first request</h4><div class="taskbars"></div>` +
      `<div class="mini-legend"><span><i class="lg-def"></i>Default</span><span><i class="lg-te"></i>TokenEconomizer</span></div>`;
  }
  // Steps through the four tasks; returns a function that stops the timer.
  function mountPrune(root, x, autoplay) {
    const grid = $(".toolgrid", root), bars = $(".taskbars", root);
    let step = autoplay && !reduceMotion ? 0 : 3, timer = null;
    const stop = () => { clearInterval(timer); timer = null; };
    function render() {
      const all = [...x.kept.map((n) => [n, true]), ...x.masked.map((n) => [n, false])].sort((a, b) => a[0].localeCompare(b[0], "en", { sensitivity: "base" }));
      grid.innerHTML = all.map(([n, keep]) => `<span class="tool${keep ? " core" : ""}${!keep && step > 0 ? " masked" : ""}">${esc(n)}</span>`).join("");
      const max = Math.max(...x.tasks.map((t) => Math.max(t[1], t[2])));
      bars.innerHTML = x.tasks.map(([id, te, def, note], i) => {
        const shown = i <= step;
        return `<div class="taskbar${i === step ? " current" : ""}"><span class="tn">Task ${i + 1}<small>${id}</small></span>` +
          `<span class="bars" title="${esc(note)}"><i class="def" style="width:${def / max * 100}%"></i><i class="te" style="width:${shown ? te / max * 100 : 0}%"></i></span>` +
          `<span class="tv">${shown ? te.toLocaleString("en-US") : "·"}<small>(${def.toLocaleString("en-US")})</small></span></div>`;
      }).join("") + `<p class="caption" style="margin:6px 0 0"><b>Task ${step + 1}.</b> ${esc(x.tasks[step][3])}.</p>` +
        `<div class="chips" style="margin-top:10px" role="group" aria-label="Task">${x.tasks.map((t, i) => `<button type="button" class="chip" data-step="${i}" aria-pressed="${i === step}">Task ${i + 1}</button>`).join("")}</div>`;
      $$("[data-step]", bars).forEach((b) => b.addEventListener("click", () => { stop(); step = +b.dataset.step; render(); }));
    }
    render();
    if (autoplay && !reduceMotion) timer = setInterval(() => { step++; render(); if (step >= 3) stop(); }, 1300);
    return stop;
  }

  (function examples() {
    const list = $("#ex-list"), detail = $("#ex-detail");
    const items = [];
    let group = null, cleanup = () => {}, seen = false, currentStart = () => {};
    EXAMPLES.forEach((x, i) => {
      if (x.kind !== group) {
        group = x.kind;
        const g = document.createElement("p");
        g.className = "lc-group " + GROUPS[x.kind][1];
        g.setAttribute("role", "presentation");
        g.textContent = GROUPS[x.kind][0];
        list.append(g);
      }
      const b = document.createElement("button");
      b.type = "button"; b.className = "lc-item"; b.setAttribute("role", "tab"); b.id = "ex-" + x.id;
      b.setAttribute("aria-controls", "ex-detail");
      b.innerHTML = `<span class="t"><span>(${x.id}) ${x.repo}</span><span>${x.short}</span></span><span class="badge ${x.badge[0]}">${x.badge[1]}</span>`;
      b.addEventListener("click", () => show(i));
      b.addEventListener("keydown", (e) => {
        const k = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
        if (k) { e.preventDefault(); show((i + k + EXAMPLES.length) % EXAMPLES.length, true); }
      });
      items.push(b);
      list.append(b);
    });
    function show(i, focus) {
      const x = EXAMPLES[i];
      cleanup();
      items.forEach((b, j) => { b.setAttribute("aria-selected", String(i === j)); b.tabIndex = i === j ? 0 : -1; });
      if (focus) items[i].focus();
      detail.setAttribute("aria-labelledby", "ex-" + x.id);
      detail.className = "lc-detail " + GROUPS[x.kind][1];
      detail.innerHTML = `<div class="example-head"><h4>(${x.id}) ${x.repo} · ${x.setting}</h4><span class="badge ${x.badge[0]}" style="margin:0">${x.badge[1]}</span></div>` +
        (x.kind === "skill" ? skillHTML(x) : x.kind === "prune" ? pruneHTML(x) : loopHTML(x));
      const start = () => {
        if (x.kind === "prune") cleanup = mountPrune(detail, x, true);
        $$(".trace", detail).forEach((t) => !reduceMotion && t.classList.add("playing"));
        play(detail);
        if (!reduceMotion) $$(".turnstrip", detail).forEach((t) => restart(t, "fill"));
      };
      if (x.kind === "prune") cleanup = mountPrune(detail, x, false);
      const replay = $("[data-replay]", detail);
      if (replay) replay.addEventListener("click", () => {
        play(detail);
        if (!reduceMotion) $$(".turnstrip", detail).forEach((t) => restart(t, "fill"));
      });
      // The first example animates once it scrolls into view; later ones as soon as they are picked.
      currentStart = start;
      if (seen) start();
      else { seen = true; if (!reduceMotion) $$(".trace", detail).forEach((t) => t.classList.add("playing")); onceVisible(detail, () => currentStart()); }
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
