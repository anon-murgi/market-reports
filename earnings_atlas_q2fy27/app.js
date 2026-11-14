/* Q2 FY27 Earnings Atlas. Static front end over data/*.json built by
   price-predictor/scripts/earnings_atlas/build_atlas_data.py */
"use strict";

const S = { o: 1, f: 0, e: 0, metric: "pg", board: "clean", bucket: "All", bsec: "All" };
let META, CO, TREND, BYT, HIST, IND_TREND, REV;
let charts = [];

/* ------------------------------------------------------------------ utils */
const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const getj = (u) => fetch(u).then((r) => r.json());
const nn = (v) => v !== null && v !== undefined && !Number.isNaN(v);
const sgn = (v) => (v > 0 ? "+" : v < 0 ? "−" : "");
const pct = (v, d = 1) => (nn(v) ? sgn(v) + Math.abs(v).toFixed(d) + "%" : "–");
const pp = (v, d = 2) => (nn(v) ? sgn(v) + Math.abs(v).toFixed(d) + " pp" : "–");
const bps = (v) => (nn(v) ? sgn(Math.round(v)) + Math.abs(Math.round(v)).toLocaleString("en-IN") + " bps" : "–");
const inr = (v) => Math.round(Math.abs(v)).toLocaleString("en-IN");
const cr = (v) => (nn(v) ? (v < 0 ? "−" : "") + "₹" + inr(v) + " cr" : "–");
const dcr = (v) => (nn(v) ? sgn(v) + "₹" + inr(v) + " cr" : "–");
const mcap = (v) => (!nn(v) ? "–" : v >= 1e5 ? "₹" + (v / 1e5).toFixed(2) + " L cr" : "₹" + inr(v) + " cr");
const cls = (v) => (nn(v) ? (v > 0 ? "up" : v < 0 ? "dn" : "") : "");
const median = (a) => {
  const x = a.filter(nn).sort((p, q) => p - q);
  if (!x.length) return null;
  const m = x.length >> 1;
  return x.length % 2 ? x[m] : (x[m - 1] + x[m]) / 2;
};
const sum = (a) => a.reduce((s, v) => s + (nn(v) ? v : 0), 0);
const modeKey = () => `o${S.o}f${S.f}e${S.e}`;
const coLink = (c) => `<a href="#/company/${encodeURIComponent(c.t)}"><span class="tk">${esc(c.t)}</span></a>`;
const indLink = (ind) => `<a href="#/industry/${encodeURIComponent(ind)}">${esc(ind)}</a>`;

function universe(list = CO, o = S) {
  return list.filter((c) => c.has_y && (!o.o || !c.oneoff) && (!o.f || !c.fin) && (!o.e || c.sec !== "Energy"));
}

/* aggregate growth over companies with both periods present for each line */
function agg(list) {
  const out = { n: list.length };
  for (const [k, a, b, g] of [["sales", "s", "s_y", "sg"], ["op", "o", "o_y", "og"], ["pat", "p", "p_y", "pg"]]) {
    const pr = list.filter((c) => nn(c[a]) && nn(c[b]));
    const num = sum(pr.map((c) => c[a])), den = sum(pr.map((c) => c[b]));
    out[k] = den > 0 ? (num / den - 1) * 100 : null;
    out[k + "_med"] = median(pr.map((c) => c[g]));
    out[k + "_up"] = pr.length ? (pr.filter((c) => c[a] > c[b]).length / pr.length) * 100 : null;
    out[k + "_d"] = num - den;
    out[k + "_cur"] = num;
  }
  const nf = list.filter((c) => !c.fin && nn(c.s) && nn(c.o) && nn(c.s_y) && nn(c.o_y) && c.s > 0 && c.s_y > 0);
  const s = sum(nf.map((c) => c.s)), sy = sum(nf.map((c) => c.s_y));
  const o = sum(nf.map((c) => c.o)), oy = sum(nf.map((c) => c.o_y));
  out.opm = s ? (o / s) * 100 : null;
  out.opm_bps = s && sy ? (o / s - oy / sy) * 1e4 : null;
  out.mc = sum(list.map((c) => c.mc));
  return out;
}

function groupBy(list, key) {
  const m = new Map();
  for (const c of list) {
    const k = typeof key === "function" ? key(c) : c[key];
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(c);
  }
  return m;
}

/* diverging colour: red <- mid -> blue */
function hexToRgb(h) {
  h = h.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return "#" + A.map((x, i) => Math.round(x + (B[i] - x) * t).toString(16).padStart(2, "0")).join("");
}
function divColor(v, clamp) {
  if (!nn(v)) return css("--surface-2");
  const t = Math.min(Math.abs(v) / clamp, 1) ** 0.85;
  return mix(css("--mid"), v >= 0 ? css("--pos") : css("--neg"), t);
}
function inkOn(hex) {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 140 ? "#0b0b0b" : "#ffffff";
}

/* ------------------------------------------------------------------ charts */
function disposeCharts() {
  charts.forEach((c) => c.dispose());
  charts = [];
}
function mk(el, option) {
  if (!el) return null;
  const ch = echarts.init(el, null, { renderer: "svg" });
  const base = {
    textStyle: { fontFamily: "Inter, system-ui, sans-serif", color: css("--text-2") },
    animationDuration: 300,
    tooltip: {
      backgroundColor: css("--surface"), borderColor: css("--border"), borderWidth: 1,
      textStyle: { color: css("--text"), fontSize: 12 }, extraCssText: "border-radius:8px;box-shadow:none;",
    },
  };
  ch.setOption(Object.assign(base, option));
  charts.push(ch);
  return ch;
}
const axisStyle = () => ({
  axisLine: { lineStyle: { color: css("--border") } },
  axisTick: { show: false },
  axisLabel: { color: css("--text-3"), fontSize: 11 },
  splitLine: { lineStyle: { color: css("--border"), type: [2, 4] } },
});
window.addEventListener("resize", () => charts.forEach((c) => c.resize()));

/* ------------------------------------------------------------------ table */
function table(el, rows, cols, opt = {}) {
  const st = { k: opt.sort || null, asc: !!opt.asc, page: 0, size: opt.page || 0 };
  function draw() {
    let r = rows.slice();
    if (st.k) {
      const col = cols.find((c) => c.k === st.k);
      const val = col.v || ((x) => x[col.k]);
      r.sort((a, b) => {
        const A = val(a), B = val(b);
        if (!nn(A) && !nn(B)) return 0;
        if (!nn(A)) return 1;
        if (!nn(B)) return -1;
        return (A < B ? -1 : A > B ? 1 : 0) * (st.asc ? 1 : -1);
      });
    }
    const total = r.length;
    if (st.size) r = r.slice(st.page * st.size, (st.page + 1) * st.size);
    const head = cols.map((c) => `<th data-k="${c.k}" class="${c.num ? "num" : ""} ${st.k === c.k ? "sorted" + (st.asc ? " asc" : "") : ""}">${c.h}</th>`).join("");
    const body = r.map((x) => `<tr class="${x.t ? "click" : ""}" data-t="${esc(x.t || "")}">${cols.map((c) => `<td class="${c.num ? "num" : ""}">${c.f ? c.f(x) : esc(x[c.k])}</td>`).join("")}</tr>`).join("");
    const pages = st.size ? Math.ceil(total / st.size) : 1;
    el.innerHTML = `<div class="tbl-wrap ${opt.scroll ? "scroll-y" : ""}"><table class="t"><thead><tr>${head}</tr></thead><tbody>${body || `<tr><td colspan="${cols.length}" class="muted">No companies match.</td></tr>`}</tbody></table></div>` +
      (st.size && pages > 1 ? `<div class="pager">${total.toLocaleString("en-IN")} rows · page ${st.page + 1} of ${pages} <button data-p="-1">Prev</button><button data-p="1">Next</button></div>` : "");
    el.querySelectorAll("th").forEach((th) => th.addEventListener("click", () => {
      const k = th.dataset.k;
      if (st.k === k) st.asc = !st.asc; else { st.k = k; st.asc = false; }
      st.page = 0; draw();
    }));
    el.querySelectorAll("tr.click").forEach((tr) => tr.addEventListener("click", (ev) => {
      if (ev.target.closest("a")) return;
      location.hash = "#/company/" + encodeURIComponent(tr.dataset.t);
    }));
    el.querySelectorAll(".pager button").forEach((b) => b.addEventListener("click", () => {
      st.page = Math.max(0, Math.min(pages - 1, st.page + +b.dataset.p)); draw();
    }));
  }
  draw();
}

const COL = {
  co: { k: "t", h: "Company", f: (c) => `${coLink(c)}<span class="nm">${esc(trim(c.nm, 26))}</span>`, v: (c) => c.t },
  ind: { k: "ind", h: "Industry", f: (c) => `<span class="sub">${esc(c.ind)}</span>` },
  mc: { k: "mc", h: "Mkt cap", num: true, f: (c) => mcap(c.mc) },
  s: { k: "s", h: "Revenue", num: true, f: (c) => cr(c.s) },
  p: { k: "p", h: "PAT", num: true, f: (c) => cr(c.p) },
  sg: { k: "sg", h: "Rev YoY", num: true, f: (c) => `<span class="${cls(c.sg)}">${pct(c.sg)}</span>` },
  og: { k: "og", h: "EBITDA YoY", num: true, f: (c) => `<span class="${cls(c.og)}">${pct(c.og)}</span>` },
  pg: { k: "pg", h: "PAT YoY", num: true, f: (c) => pgCell(c), v: (c) => pgSort(c) },
  pqg: { k: "pqg", h: "PAT QoQ", num: true, f: (c) => `<span class="${cls(c.pqg)}">${pct(c.pqg)}</span>` },
  mbps: { k: "mbps", h: "Margin Δ", num: true, f: (c) => (c.fin ? '<span class="muted">fin</span>' : `<span class="${cls(c.mbps)}">${bps(c.mbps)}</span>`) },
  dp: { k: "dp", h: "ΔPAT", num: true, f: (c) => `<span class="${cls(c.dp)}">${dcr(c.dp)}</span>` },
  r1x: { k: "r1x", h: "Result-day vs N500", num: true, f: (c) => `<span class="${cls(c.rx?.r1x)}">${pct(c.rx?.r1x)}</span>`, v: (c) => c.rx?.r1x },
  rsx: { k: "rsx", h: "Since result vs N500", num: true, f: (c) => `<span class="${cls(c.rx?.rsx)}">${pct(c.rx?.rsx)}</span>`, v: (c) => c.rx?.rsx },
  pe: { k: "pe", h: "P/E", num: true, f: (c) => (nn(c.pe) ? c.pe.toFixed(1) : "–") },
  fl: { k: "fl", h: "Flags", f: (c) => flagPills(c), v: (c) => (c.fl || []).length },
};
function trim(s, n) { s = String(s || ""); return s.length > n ? s.slice(0, n - 1) + "…" : s; }
function pgCell(c) {
  if (nn(c.p) && nn(c.p_y) && c.p_y > 0 && c.p <= 0) return '<span class="dn">Profit → loss</span>';
  if (nn(c.pg)) return `<span class="${cls(c.pg)}">${pct(c.pg)}</span>`;
  if (nn(c.p) && nn(c.p_y) && c.p_y <= 0 && c.p > 0) return '<span class="up">Loss → profit</span>';
  if (nn(c.p) && nn(c.p_y) && c.p_y <= 0) return '<span class="muted">Loss both</span>';
  return "–";
}
function pgSort(c) {
  if (nn(c.pg)) return c.pg;
  if (nn(c.p) && nn(c.p_y) && c.p_y <= 0 && c.p > 0) return 1e6;
  return null;
}
const FLAG_NAME = { oneoff: "Unusual quarter", l2p: "Loss → profit", p2l: "Profit → loss", oi: "Other-income heavy", tax: "Tax-rate drop", call: "Call-cited adjustment" };
const SHORT = { "Fast Moving Consumer Goods": "FMCG", "Consumer Discretionary": "Cons. Discretionary", "Information Technology": "IT" };
const shortName = (s) => SHORT[s] || s;
function flagPills(c) {
  return (c.fl || []).map((f) => `<span class="pill ${f[0]}">${FLAG_NAME[f[0]]}</span>`).join("");
}

/* ------------------------------------------------------------------ shared UI */
function toggles(onChange, opts = {}) {
  const wrap = document.createElement("div");
  wrap.className = "controls";
  const items = [["o", "Exclude unusual quarters"], ["f", "Exclude financials"], ["e", "Exclude oil & gas"]];
  wrap.innerHTML = `<span class="lbl">Universe</span>` + items.map(([k, l]) => `<button class="chip ${S[k] ? "on" : ""}" data-k="${k}"><span class="dot"></span>${l}</button>`).join("") +
    `<span class="lbl" style="margin-left:8px" id="univ-n"></span>`;
  wrap.querySelectorAll(".chip").forEach((b) => b.addEventListener("click", () => {
    S[b.dataset.k] = S[b.dataset.k] ? 0 : 1;
    b.classList.toggle("on");
    onChange();
  }));
  return wrap;
}
function setUnivCount(n) {
  const el = $("#univ-n");
  if (el) el.textContent = `${n.toLocaleString("en-IN")} companies with a matched year-ago quarter`;
}
function kpi(label, value, detail, color) {
  return `<div class="kpi"><div class="k">${color ? `<i style="background:${color}"></i>` : ""}${label}</div><div class="v">${value}</div><div class="d">${detail || ""}</div></div>`;
}

/* ------------------------------------------------------------------ view: pulse */
function viewPulse(main) {
  main.innerHTML = `
  <section class="hero">
    <div>
      <div class="kicker">Quarter ended 30 Sep 2026 · ${META.reporters.toLocaleString("en-IN")} of ${META.universe.toLocaleString("en-IN")} listed companies reported</div>
      <h1 id="headline"></h1>
      <p class="lede" id="lede"></p>
    </div>
    <div class="card" style="padding:14px 16px">
      <div class="muted" style="font-size:12px">Coverage</div>
      <div style="font-size:22px;font-weight:600">${META.mcap_cover.toFixed(1)}% of market cap</div>
      <div class="sub" style="font-size:12px">${META.matched.toLocaleString("en-IN")} companies have a comparable Sep-25 quarter on the same accounting basis. Fundamentals as of ${META.pnl_asof}; prices to ${META.px_asof}.</div>
    </div>
  </section>
  <div id="tg"></div>
  <div class="kpis" id="kpis"></div>
  <div id="callout"></div>
  <div class="section grid g2">
    <div class="card"><div class="card-h"><h2>Nine quarters of YoY growth</h2><div class="legend" id="tr-leg"></div></div>
      <div class="note">Aggregate YoY for each quarter, over companies reporting both that quarter and the year-ago one. Same universe switches apply.</div>
      <div class="chart" id="c-trend"></div></div>
    <div class="card"><div class="card-h"><h2>Who added the profit</h2><span class="muted" style="font-size:12px">ΔPAT YoY by sector, ₹ cr</span></div>
      <div class="note">Rupee change in net profit, Sep-26 vs Sep-25. Click a bar for the sector map.</div>
      <div class="chart" id="c-contrib"></div></div>
  </div>
  <div class="section grid g2">
    <div class="card"><div class="card-h"><h2>How PAT growth was spread</h2><span class="muted" style="font-size:12px">companies per bucket</span></div>
      <div class="note">Company count by PAT YoY band. Turnarounds have no growth rate, so they get their own bar.</div>
      <div class="chart" id="c-hist"></div></div>
    <div class="card"><div class="card-h"><h2>By company size</h2><span class="muted" style="font-size:12px">rank by market cap</span></div>
      <div class="note">Large = top 100, Mid = 101–250, Small = 251–1,000, Micro = the rest.</div>
      <div id="t-size"></div></div>
  </div>
  <div class="section grid g2">
    <div class="card"><div class="card-h"><h2>Biggest profit adders</h2></div><div id="t-add"></div></div>
    <div class="card"><div class="card-h"><h2>Biggest profit decliners</h2></div><div id="t-sub"></div></div>
  </div>`;
  $("#tg").appendChild(toggles(() => { disposeCharts(); drawPulse(); }));
  drawPulse();
}

function drawPulse() {
  const U = universe();
  setUnivCount(U.length);
  const A = agg(U);
  const R = agg(universe(CO, { o: 0, f: S.f, e: S.e }));
  const X = agg(universe(CO, { o: 1, f: S.f, e: S.e }));

  const scope = [S.f ? "non-financial" : "", S.e ? "ex oil & gas" : ""].filter(Boolean).join(", ");
  $("#headline").innerHTML = `${scope ? "For " + scope + " companies, profits" : "Profits"} rose <span class="${cls(A.pat)}">${pct(A.pat)}</span> on ${pct(A.sales)} higher revenue`;
  const gap = (A.pat ?? 0) - (A.pat_med ?? 0);
  const breadthTxt = `${A.pat_up.toFixed(0)}% of companies grew PAT and the median company grew it ${pct(A.pat_med)}.`;
  const shape = Math.abs(gap) < 8 ? " The median sits close to the aggregate, so the gain was broad." :
    gap > 0 ? " The aggregate runs ahead of the median, so large companies carried the quarter." :
      " The median company did better than the aggregate, so a few large companies dragged the total.";
  $("#lede").textContent = breadthTxt + shape;

  const fmtMed = (v, up) => `median ${pct(v)} · ${nn(up) ? up.toFixed(0) : "–"}% grew`;
  $("#kpis").innerHTML =
    kpi("Revenue YoY", `<span class="${cls(A.sales)}">${pct(A.sales)}</span>`, fmtMed(A.sales_med, A.sales_up), css("--s1")) +
    kpi("EBITDA YoY", `<span class="${cls(A.op)}">${pct(A.op)}</span>`, fmtMed(A.op_med, A.op_up), css("--s2")) +
    kpi("PAT YoY", `<span class="${cls(A.pat)}">${pct(A.pat)}</span>`, fmtMed(A.pat_med, A.pat_up), css("--s3")) +
    kpi("EBITDA margin", nn(A.opm) ? A.opm.toFixed(1) + "%" : "–", `${bps(A.opm_bps)} YoY · non-financials`) +
    kpi("Profit pool", "₹" + (A.pat_cur / 1e5).toFixed(2) + " L cr", `${dcr(A.pat_d)} vs Sep-25`) +
    kpi("Companies", A.n.toLocaleString("en-IN"), `${mcap(A.mc)} market cap`);

  // one-off callout
  const oneoffs = CO.filter((c) => c.has_y && c.oneoff && (!S.f || !c.fin) && (!S.e || c.sec !== "Energy"));
  const top = oneoffs.slice().sort((a, b) => Math.abs(b.dp || 0) - Math.abs(a.dp || 0))[0];
  const topTxt = top ? ` The biggest is <a href="#/company/${encodeURIComponent(top.t)}"><b>${esc(top.t)}</b></a>: ${esc((top.fl.find((f) => f[0] === "oneoff") || [, ""])[1])}, a ${dcr(top.dp)} swing on its own.` : "";
  $("#callout").innerHTML = `<div class="callout"><b>Reported PAT growth is ${pct(R.pat)}. Taking out ${oneoffs.length} unusual quarters gives ${pct(X.pat)}.</b>${topTxt} <a href="#/quality">See every adjustment</a>. ${S.o ? "Unusual quarters are excluded now." : "Unusual quarters are included now."}</div>`;

  // trend
  const T = TREND.modes[modeKey()];
  const ser = [["Revenue", "sales", "--s1"], ["EBITDA", "op", "--s2"], ["PAT", "pat", "--s3"]];
  $("#tr-leg").innerHTML = ser.map(([n, , c]) => `<span><i style="background:${css(c)}"></i>${n}</span>`).join("");
  mk($("#c-trend"), {
    grid: { left: 44, right: 78, top: 16, bottom: 28 },
    tooltip: { trigger: "axis", valueFormatter: (v) => pct(v), axisPointer: { type: "line", lineStyle: { color: css("--text-3") } } },
    xAxis: { type: "category", data: TREND.quarters, ...axisStyle(), splitLine: { show: false } },
    yAxis: { type: "value", ...axisStyle(), axisLabel: { color: css("--text-3"), formatter: (v) => v + "%" } },
    series: ser.map(([n, k, c]) => ({
      name: n, type: "line", data: T.map((x) => (nn(x[k]) ? +x[k].toFixed(1) : null)), smooth: false, symbol: "circle", symbolSize: 7,
      lineStyle: { width: 2, color: css(c) }, itemStyle: { color: css(c), borderColor: css("--surface"), borderWidth: 2 },
      endLabel: { show: true, formatter: (p) => `${n} ${pct(p.value)}`, color: css("--text-2"), fontSize: 11 },
    })),
  });

  // contribution by sector
  const bySec = [...groupBy(U.filter((c) => nn(c.dp)), "sec")].map(([k, v]) => ({ k, d: sum(v.map((c) => c.dp)), a: agg(v) }))
    .sort((a, b) => a.d - b.d);
  const ch = mk($("#c-contrib"), {
    grid: { left: 140, right: 70, top: 8, bottom: 20 },
    tooltip: { trigger: "item", formatter: (p) => { const x = bySec[p.dataIndex]; return `<b>${esc(x.k)}</b><br>ΔPAT ${dcr(x.d)}<br>PAT YoY ${pct(x.a.pat)} · ${x.a.n} cos`; } },
    xAxis: { type: "value", ...axisStyle(), axisLabel: { color: css("--text-3"), formatter: (v) => (v / 1000).toFixed(0) + "k" } },
    yAxis: { type: "category", data: bySec.map((x) => shortName(x.k)), ...axisStyle(), splitLine: { show: false }, axisLabel: { color: css("--text-2"), fontSize: 12 } },
    series: [{
      type: "bar", barWidth: "62%", data: bySec.map((x) => ({ value: Math.round(x.d), itemStyle: { color: x.d >= 0 ? css("--pos") : css("--neg"), borderRadius: x.d >= 0 ? [0, 4, 4, 0] : [4, 0, 0, 4] } })),
      label: { show: true, position: "right", formatter: (p) => (p.value >= 0 ? "+" : "−") + inr(p.value), color: css("--text-2"), fontSize: 11 },
    }],
  });
  ch && ch.on("click", () => (location.hash = "#/sectors"));

  // histogram
  const bins = [["< −50%", -Infinity, -50], ["−50 to −25", -50, -25], ["−25 to 0", -25, 0], ["0 to 10", 0, 10], ["10 to 20", 10, 20], ["20 to 30", 20, 30], ["30 to 50", 30, 50], ["50 to 100", 50, 100], ["> 100%", 100, Infinity]];
  const hv = bins.map(([, lo, hi]) => U.filter((c) => nn(c.pg) && c.pg >= lo && c.pg < hi).length);
  const l2p = U.filter((c) => !nn(c.pg) && nn(c.p) && nn(c.p_y) && c.p_y <= 0 && c.p > 0).length;
  const labels = bins.map((b) => b[0]).concat(["Loss → profit"]);
  const vals = hv.concat([l2p]);
  mk($("#c-hist"), {
    grid: { left: 40, right: 12, top: 18, bottom: 40 },
    tooltip: { trigger: "item", formatter: (p) => `${p.name}: <b>${p.value}</b> companies` },
    xAxis: { type: "category", data: labels, ...axisStyle(), splitLine: { show: false }, axisLabel: { color: css("--text-3"), fontSize: 10, interval: 0, rotate: 30 } },
    yAxis: { type: "value", ...axisStyle() },
    series: [{
      type: "bar", barCategoryGap: "18%",
      data: vals.map((v, i) => ({ value: v, itemStyle: { color: i < 3 ? css("--neg") : css("--pos"), opacity: i === 9 ? 0.55 : 1, borderRadius: [4, 4, 0, 0] } })),
      label: { show: true, position: "top", color: css("--text-3"), fontSize: 10 },
    }],
  });

  // size table
  const order = ["Large", "Mid", "Small", "Micro"];
  const rows = order.map((b) => ({ b, ...agg(U.filter((c) => c.bk === b)) }));
  table($("#t-size"), rows, [
    { k: "b", h: "Bucket", f: (r) => `<b>${r.b}</b>` },
    { k: "n", h: "Cos", num: true },
    { k: "sales", h: "Rev YoY", num: true, f: (r) => `<span class="${cls(r.sales)}">${pct(r.sales)}</span>` },
    { k: "op", h: "EBITDA YoY", num: true, f: (r) => `<span class="${cls(r.op)}">${pct(r.op)}</span>` },
    { k: "pat", h: "PAT YoY", num: true, f: (r) => `<span class="${cls(r.pat)}">${pct(r.pat)}</span>` },
    { k: "pat_med", h: "Median PAT", num: true, f: (r) => pct(r.pat_med) },
    { k: "pat_up", h: "% grew PAT", num: true, f: (r) => (nn(r.pat_up) ? r.pat_up.toFixed(0) + "%" : "–") },
  ]);

  const withD = U.filter((c) => nn(c.dp));
  const cols = [COL.co, COL.p, COL.pg, COL.dp];
  table($("#t-add"), withD.slice().sort((a, b) => b.dp - a.dp).slice(0, 12), cols, { sort: "dp" });
  table($("#t-sub"), withD.slice().sort((a, b) => a.dp - b.dp).slice(0, 12), cols, { sort: "dp", asc: true });
}

/* ------------------------------------------------------------------ view: sectors */
const METRICS = {
  pg: { l: "PAT YoY", f: (a) => a.pat, fmt: pct, clamp: 50 },
  og: { l: "EBITDA YoY", f: (a) => a.op, fmt: pct, clamp: 40 },
  sg: { l: "Revenue YoY", f: (a) => a.sales, fmt: pct, clamp: 30 },
  mb: { l: "Margin change", f: (a) => a.opm_bps, fmt: bps, clamp: 300 },
  br: { l: "Share that grew PAT", f: (a) => (nn(a.pat_up) ? a.pat_up - 50 : null), fmt: (v) => (nn(v) ? (v + 50).toFixed(0) + "%" : "–"), clamp: 35 },
};

function viewSectors(main) {
  main.innerHTML = `
  <section class="hero"><div>
    <div class="kicker">Sector map</div>
    <h1>Where the quarter was strong and where it was weak</h1>
    <p class="lede">Each tile is an industry, sized by the market cap of its reporters and coloured by the metric you pick. Click a tile to open its chapter.</p>
  </div></section>
  <div id="tg"></div>
  <div class="controls" id="mctl"><span class="lbl">Colour by</span>${Object.entries(METRICS).map(([k, m]) => `<button class="chip ${S.metric === k ? "on" : ""}" data-m="${k}">${m.l}</button>`).join("")}
    <span style="flex:1"></span><div class="ramp" id="ramp"></div></div>
  <div class="card"><div class="chart tall" id="c-tree"></div></div>
  <div class="section grid g2">
    <div class="card span2"><div class="card-h"><h2>Revenue growth vs margin change</h2><span class="muted" style="font-size:12px">non-financial industries with 5+ reporters · bubble = PAT pool</span></div>
      <div class="note">Top-right industries sold more and kept more of each rupee. Dashed lines mark the market aggregate.</div>
      <div class="chart tall" id="c-scatter"></div></div>
  </div>
  <div class="section card"><div class="card-h"><h2>All industries</h2><span class="muted" style="font-size:12px">click a column to sort</span></div><div id="t-ind"></div></div>`;
  $("#tg").appendChild(toggles(() => { disposeCharts(); drawSectors(); }));
  $("#mctl").querySelectorAll(".chip").forEach((b) => b.addEventListener("click", () => {
    S.metric = b.dataset.m;
    $("#mctl").querySelectorAll(".chip").forEach((x) => x.classList.toggle("on", x === b));
    disposeCharts(); drawSectors();
  }));
  drawSectors();
}

function industryRows(U) {
  return [...groupBy(U, "ind")].map(([ind, v]) => {
    const a = agg(v);
    return { ind, sec: v[0].sec, ...a, dp: sum(v.map((c) => c.dp)), fin: v[0].fin };
  });
}

function drawSectors() {
  const U = universe();
  setUnivCount(U.length);
  const M = METRICS[S.metric];
  const rows = industryRows(U);
  $("#ramp").innerHTML = `<span>${M.fmt(-M.clamp)}</span><span class="bar" style="background:linear-gradient(90deg,${css("--neg")},${css("--mid")},${css("--pos")})"></span><span>${S.metric === "br" ? "85%" : M.fmt(M.clamp)}</span>`;

  const secs = [...groupBy(rows, "sec")].map(([sec, inds]) => {
    const sa = agg(U.filter((c) => c.sec === sec));
    const sv = M.f(sa);
    return {
      name: sec, value: sum(inds.map((r) => r.mc)),
      itemStyle: { borderColor: css("--surface"), borderWidth: 3, gapWidth: 2 },
      upperLabelText: `${sec}  ${M.fmt(sv)}`,
      children: inds.filter((r) => r.mc > 0).map((r) => {
        const v = M.f(r);
        const col = divColor(v, M.clamp);
        return {
          name: r.ind, value: r.mc, ind: r.ind, metric: v, n: r.n, row: r,
          itemStyle: { color: col, borderColor: css("--surface"), borderWidth: 1 },
          label: { color: inkOn(col) },
        };
      }),
    };
  });
  const tree = mk($("#c-tree"), {
    tooltip: {
      formatter: (p) => {
        const d = p.data;
        if (!d.row) return `<b>${esc(d.name)}</b>`;
        const r = d.row;
        return `<b>${esc(r.ind)}</b> · ${esc(r.sec)}<br>${r.n} companies · ${mcap(r.mc)}<br>Revenue ${pct(r.sales)} · EBITDA ${pct(r.op)} · PAT ${pct(r.pat)}<br>Median PAT ${pct(r.pat_med)} · ${nn(r.pat_up) ? r.pat_up.toFixed(0) : "–"}% grew · margin ${r.fin ? "n/a" : bps(r.opm_bps)}`;
      },
    },
    series: [{
      type: "treemap", data: secs, roam: false, nodeClick: false, breadcrumb: { show: false },
      left: 0, right: 0, top: 0, bottom: 0, leafDepth: 2,
      upperLabel: { show: true, height: 22, color: css("--text"), fontWeight: 600, fontSize: 12, backgroundColor: css("--surface-2"),
        formatter: (p) => p.data.upperLabelText || p.name },
      label: { show: true, fontSize: 11, lineHeight: 14, overflow: "truncate", formatter: (p) => `${p.name}\n${M.fmt(p.data.metric)}` },
      levels: [
        { itemStyle: { borderWidth: 0, gapWidth: 3, borderColor: css("--surface") } },
        { itemStyle: { gapWidth: 1, borderColor: css("--surface"), color: css("--surface-2") }, upperLabel: { show: true } },
        { itemStyle: { gapWidth: 0 } },
      ],
    }],
  });
  tree && tree.on("click", (p) => { if (p.data && p.data.ind) location.hash = "#/industry/" + encodeURIComponent(p.data.ind); });

  // scatter
  const mkt = agg(U.filter((c) => !c.fin));
  const pts = rows.filter((r) => !r.fin && r.n >= 5 && nn(r.sales) && nn(r.opm_bps));
  const maxPool = Math.max(...pts.map((r) => Math.abs(r.pat_cur)));
  const topLabel = new Set(pts.slice().sort((a, b) => b.mc - a.mc).slice(0, 14).map((r) => r.ind));
  const sc = mk($("#c-scatter"), {
    grid: { left: 60, right: 30, top: 20, bottom: 44 },
    tooltip: { trigger: "item", formatter: (p) => { const r = p.data.r; return `<b>${esc(r.ind)}</b><br>Revenue ${pct(r.sales)} · margin ${bps(r.opm_bps)}<br>PAT ${pct(r.pat)} · pool ${cr(r.pat_cur)}<br>${r.n} companies`; } },
    xAxis: { type: "value", name: "Revenue YoY", nameLocation: "middle", nameGap: 28, ...axisStyle(), axisLabel: { color: css("--text-3"), formatter: (v) => v + "%" }, min: (v) => Math.floor(Math.max(v.min, -30) / 10) * 10, max: (v) => Math.ceil(Math.min(v.max, 80) / 10) * 10 },
    yAxis: { type: "value", name: "EBITDA margin change, bps", nameLocation: "middle", nameGap: 44, ...axisStyle(), min: (v) => Math.max(Math.floor(v.min / 200) * 200, -800), max: (v) => Math.min(Math.ceil(v.max / 200) * 200, 800) },
    series: [{
      type: "scatter",
      data: pts.map((r) => ({
        value: [+r.sales.toFixed(1), Math.round(r.opm_bps)], r,
        symbolSize: 8 + 34 * Math.sqrt(Math.abs(r.pat_cur) / maxPool),
        itemStyle: { color: r.opm_bps >= 0 ? css("--pos") : css("--neg"), opacity: 0.75, borderColor: css("--surface"), borderWidth: 2 },
        label: { show: topLabel.has(r.ind), formatter: r.ind, position: "right", color: css("--text-2"), fontSize: 11 },
      })),
      labelLayout: { hideOverlap: true },
      markLine: {
        silent: true, symbol: "none", lineStyle: { color: css("--text-3"), type: [4, 4], width: 1 }, label: { show: false },
        data: [{ xAxis: +mkt.sales.toFixed(1) }, { yAxis: 0 }],
      },
    }],
  });
  sc && sc.on("click", (p) => { if (p.data && p.data.r) location.hash = "#/industry/" + encodeURIComponent(p.data.r.ind); });

  table($("#t-ind"), rows.map((r) => ({ ...r })), [
    { k: "ind", h: "Industry", f: (r) => indLink(r.ind) },
    { k: "sec", h: "Sector", f: (r) => `<span class="sub">${esc(r.sec)}</span>` },
    { k: "n", h: "Cos", num: true },
    { k: "sales", h: "Rev YoY", num: true, f: (r) => `<span class="${cls(r.sales)}">${pct(r.sales)}</span>` },
    { k: "op", h: "EBITDA YoY", num: true, f: (r) => `<span class="${cls(r.op)}">${pct(r.op)}</span>` },
    { k: "pat", h: "PAT YoY", num: true, f: (r) => `<span class="${cls(r.pat)}">${pct(r.pat)}</span>` },
    { k: "pat_med", h: "Median PAT", num: true, f: (r) => pct(r.pat_med) },
    { k: "pat_up", h: "% grew", num: true, f: (r) => (nn(r.pat_up) ? r.pat_up.toFixed(0) + "%" : "–") },
    { k: "opm_bps", h: "Margin Δ", num: true, f: (r) => (r.fin ? '<span class="muted">fin</span>' : `<span class="${cls(r.opm_bps)}">${bps(r.opm_bps)}</span>`) },
    { k: "dp", h: "ΔPAT", num: true, f: (r) => `<span class="${cls(r.dp)}">${dcr(r.dp)}</span>` },
  ], { sort: "dp" });
}

/* ------------------------------------------------------------------ view: industry */
async function viewIndustry(main, ind) {
  if (!IND_TREND) IND_TREND = await getj("data/industry_trend.json");
  const all = CO.filter((c) => c.ind === ind);
  if (!all.length) { main.innerHTML = `<p>No industry called ${esc(ind)}.</p>`; return; }
  const sec = all[0].sec;
  main.innerHTML = `
  <div class="co-head"><div>
    <div class="crumbs"><a href="#/sectors">Sector map</a> / ${esc(sec)}</div>
    <h1>${esc(ind)}</h1>
    <p class="lede sub" id="ind-lede" style="max-width:70ch;margin:10px 0 0"></p>
  </div></div>
  <div id="tg"></div>
  <div class="kpis" id="kpis"></div>
  <div class="section grid g2">
    <div class="card"><div class="card-h"><h2>Nine-quarter YoY trend</h2><div class="legend" id="tr-leg"></div></div>
      <div class="note" id="tr-note"></div>
      <div class="chart" id="c-trend"></div></div>
    <div class="card"><div class="card-h"><h2>Who moved the industry's profit</h2><span class="muted" style="font-size:12px">ΔPAT, ₹ cr</span></div>
      <div class="note">Largest rupee changes in PAT. Click a bar to open the company.</div>
      <div class="chart" id="c-contrib"></div></div>
  </div>
  <div class="section card"><div class="card-h"><h2>Every reporter in ${esc(ind)}</h2><span class="muted" style="font-size:12px">${all.length} companies</span></div><div id="t-peers"></div></div>`;
  $("#tg").appendChild(toggles(() => { disposeCharts(); draw(); }));

  function draw() {
    const U = universe(all);
    setUnivCount(U.length);
    const A = agg(U);
    const top = U.filter((c) => nn(c.dp)).sort((a, b) => b.dp - a.dp)[0];
    const bot = U.filter((c) => nn(c.dp)).sort((a, b) => a.dp - b.dp)[0];
    $("#ind-lede").innerHTML = `${A.n} comparable companies. Aggregate PAT ${pct(A.pat)} against a median of ${pct(A.pat_med)}; ${nn(A.pat_up) ? A.pat_up.toFixed(0) : "–"}% grew profit.` +
      (top && top.dp > 0 ? ` ${coLink(top)} added the most (${dcr(top.dp)}).` : "") + (bot && bot.dp < 0 ? ` ${coLink(bot)} lost the most (${dcr(bot.dp)}).` : "");
    $("#kpis").innerHTML =
      kpi("Revenue YoY", `<span class="${cls(A.sales)}">${pct(A.sales)}</span>`, `median ${pct(A.sales_med)}`, css("--s1")) +
      kpi("EBITDA YoY", `<span class="${cls(A.op)}">${pct(A.op)}</span>`, `median ${pct(A.op_med)}`, css("--s2")) +
      kpi("PAT YoY", `<span class="${cls(A.pat)}">${pct(A.pat)}</span>`, `median ${pct(A.pat_med)}`, css("--s3")) +
      kpi("EBITDA margin", all[0].fin ? "n/a" : nn(A.opm) ? A.opm.toFixed(1) + "%" : "–", all[0].fin ? "financials: no margin" : bps(A.opm_bps) + " YoY") +
      kpi("Profit pool", cr(A.pat_cur), dcr(A.pat_d) + " YoY") +
      kpi("Grew PAT", nn(A.pat_up) ? A.pat_up.toFixed(0) + "%" : "–", `of ${A.n} companies`);

    const T = IND_TREND[ind] || [];
    const ser = [["Revenue", "sales", "--s1"], ["EBITDA", "op", "--s2"], ["PAT", "pat", "--s3"]];
    const CAP = 150;
    const vals = T.flatMap((x) => ser.map(([, k]) => x[k])).filter(nn);
    const capped = vals.some((v) => Math.abs(v) > CAP);
    $("#tr-leg").innerHTML = ser.map(([n, , c]) => `<span><i style="background:${css(c)}"></i>${n}</span>`).join("");
    $("#tr-note").textContent = "Industry aggregate, unusual quarters excluded, all reporters (the universe switches do not apply here)." + (capped ? ` Axis capped at ±${CAP}%; hover for the full values.` : "");
    mk($("#c-trend"), {
      grid: { left: 48, right: 78, top: 16, bottom: 28 },
      tooltip: { trigger: "axis", valueFormatter: (v) => pct(v) },
      xAxis: { type: "category", data: T.map((x) => x.q), ...axisStyle(), splitLine: { show: false } },
      yAxis: { type: "value", ...axisStyle(), min: capped ? (v) => Math.max(v.min, -CAP) : null, max: capped ? (v) => Math.min(v.max, CAP) : null, axisLabel: { color: css("--text-3"), formatter: (v) => v + "%" } },
      series: ser.map(([n, k, c]) => ({
        name: n, type: "line", data: T.map((x) => (nn(x[k]) ? +x[k].toFixed(1) : null)), symbol: "circle", symbolSize: 7,
        lineStyle: { width: 2, color: css(c) }, itemStyle: { color: css(c), borderColor: css("--surface"), borderWidth: 2 },
        endLabel: { show: true, formatter: (p) => `${n} ${pct(p.value)}`, color: css("--text-2"), fontSize: 11 },
      })),
    });

    const movers = U.filter((c) => nn(c.dp)).sort((a, b) => Math.abs(b.dp) - Math.abs(a.dp)).slice(0, 12).sort((a, b) => a.dp - b.dp);
    const ch = mk($("#c-contrib"), {
      grid: { left: 96, right: 70, top: 8, bottom: 20 },
      tooltip: { trigger: "item", formatter: (p) => { const c = movers[p.dataIndex]; return `<b>${esc(c.t)}</b> ${esc(c.nm)}<br>ΔPAT ${dcr(c.dp)} · PAT ${cr(c.p)}<br>PAT YoY ${pct(c.pg)}`; } },
      xAxis: { type: "value", ...axisStyle() },
      yAxis: { type: "category", data: movers.map((c) => c.t), ...axisStyle(), splitLine: { show: false }, axisLabel: { color: css("--text-2"), fontSize: 11 } },
      series: [{
        type: "bar", barWidth: "60%", data: movers.map((c) => ({ value: Math.round(c.dp), itemStyle: { color: c.dp >= 0 ? css("--pos") : css("--neg"), borderRadius: c.dp >= 0 ? [0, 4, 4, 0] : [4, 0, 0, 4] } })),
        label: { show: true, position: "right", formatter: (p) => (p.value >= 0 ? "+" : "−") + inr(p.value), color: css("--text-2"), fontSize: 11 },
      }],
    });
    ch && ch.on("click", (p) => (location.hash = "#/company/" + encodeURIComponent(movers[p.dataIndex].t)));
    table($("#t-peers"), all, [COL.co, COL.mc, COL.s, COL.sg, COL.og, COL.pg, COL.pqg, COL.mbps, COL.dp, COL.r1x, COL.fl], { sort: "mc" });
  }
  draw();
}

/* ------------------------------------------------------------------ view: company */
async function viewCompany(main, t) {
  const c = BYT[t];
  if (!c) { main.innerHTML = `<p>No Sep-26 result found for ${esc(t)}.</p>`; return; }
  if (!HIST) HIST = await getj("data/history.json");
  if (c.rv && !REV) REV = await getj("data/reviews.json");
  const h = HIST[t] || { q: [], s: [], o: [], p: [], m: [], oo: [] };
  const rv = c.rv ? REV[t] : null;
  const peers = CO.filter((x) => x.ind === c.ind).sort((a, b) => (b.mc || 0) - (a.mc || 0)).slice(0, 12);
  if (!peers.includes(c)) peers.push(c);

  const flags = (c.fl || []).map((f) => `<span class="flag ${f[0]}" title="${esc(f[1])}">${FLAG_NAME[f[0]]}: ${esc(f[1])}</span>`);
  if (c.cb) flags.unshift(`<span class="flag cb">Clean beat: revenue, EBITDA and PAT all up 15%+ with margin intact</span>`);
  if (c.hb) flags.push(`<span class="flag hb">Hollow beat: PAT growth leans on other income, tax or a weak EBITDA line</span>`);
  if (c.mx) flags.push(`<span class="flag mx">Margin expander: ${bps(c.mbps)}</span>`);
  if (!c.has_y) flags.push(`<span class="flag">No comparable Sep-25 quarter on the ${c.vw === "cons" ? "consolidated" : "standalone"} basis</span>`);

  const rx = c.rx;
  const rxTxt = rx ? `Results announced ${esc(rx.date)}. The next session closed <b class="${cls(rx.r1)}">${pct(rx.r1)}</b> (<span class="${cls(rx.r1x)}">${pct(rx.r1x)}</span> vs Nifty 500). Since then: <b class="${cls(rx.rs)}">${pct(rx.rs)}</b> (<span class="${cls(rx.rsx)}">${pct(rx.rsx)}</span> vs Nifty 500), prices to ${esc(rx.px_asof)}.` : "No dated result announcement or price series in the local lake.";

  const pos52 = nn(c.px) && nn(c.h52) && nn(c.l52) && c.h52 > c.l52 ? ((c.px - c.l52) / (c.h52 - c.l52)) * 100 : null;
  const shRows = c.sh ? [["Promoters", "promoters"], ["FII", "fii"], ["DII", "dii"], ["Public", "public"]].map(([l, k]) => `<dt>${l}</dt><dd>${nn(c.sh[k]) ? c.sh[k].toFixed(2) + "%" : "–"} <span class="${cls(c.sh[k + "_d"])}" style="font-size:12px">${pp(c.sh[k + "_d"])}</span></dd>`).join("") : "";
  const pctTxt = (k) => (c.rk && nn(c.rk[k]?.[0]) ? `#${c.rk[k][0]} of ${c.rk[k][1]}` : "");
  const vd = c.vd;

  main.innerHTML = `
  <div class="co-head"><div>
    <div class="crumbs"><a href="#/sectors">Sector map</a> / ${esc(c.sec)} / ${indLink(c.ind)}</div>
    <h1>${esc(c.nm)} <span class="muted" style="font:500 18px Inter">${esc(c.t)}</span></h1>
  </div>
  <div class="co-meta">
    <div>Market cap<b>${mcap(c.mc)}</b></div><div>Size<b>${c.bk}</b></div><div>P/E<b>${nn(c.pe) ? c.pe.toFixed(1) : "–"}</b></div>
    <div>P/B<b>${nn(c.pb) ? c.pb.toFixed(1) : "–"}</b></div><div>Basis<b>${c.vw === "cons" ? "Consolidated" : "Standalone"}</b></div>
  </div></div>
  <div class="kpis">
    ${kpi("Revenue", cr(c.s), `YoY <span class="${cls(c.sg)}">${pct(c.sg)}</span> · QoQ <span class="${cls(c.sqg)}">${pct(c.sqg)}</span>`, css("--s1"))}
    ${kpi("EBITDA", cr(c.o), `YoY <span class="${cls(c.og)}">${pct(c.og)}</span> · QoQ <span class="${cls(c.oqg)}">${pct(c.oqg)}</span>`, css("--s2"))}
    ${kpi("PAT", cr(c.p), `YoY ${pgCell(c)} · QoQ <span class="${cls(c.pqg)}">${pct(c.pqg)}</span>`, css("--s3"))}
    ${kpi(c.fin ? "Op. profit ÷ revenue" : "EBITDA margin", nn(c.m) ? c.m.toFixed(1) + "%" : "–", `${bps(c.mbps)} YoY`)}
    ${kpi("Other income", cr(c.oi), nn(c.ois) ? `${c.ois.toFixed(0)}% of PBT` : "")}
    ${kpi("Tax rate", nn(c.tx) ? c.tx.toFixed(0) + "%" : "–", nn(c.tx_y) ? `was ${c.tx_y.toFixed(0)}% a year ago` : "")}
  </div>
  <div class="flags">${flags.join("")}</div>
  <div class="section grid g4">
    <div class="card"><h3>Revenue, ₹ cr</h3><div class="chart mini" id="h-s"></div></div>
    <div class="card"><h3>EBITDA, ₹ cr</h3><div class="chart mini" id="h-o"></div></div>
    <div class="card"><h3>PAT, ₹ cr</h3><div class="chart mini" id="h-p"></div></div>
    <div class="card"><h3>${c.fin ? "Op. profit ÷ revenue" : "EBITDA margin"}, %</h3><div class="chart mini" id="h-m"></div></div>
  </div>
  <p class="muted" style="font-size:12px;margin:6px 2px 0">Last ${h.q.length} quarters, ${c.vw === "cons" ? "consolidated" : "standalone"}. Sep-26 and Sep-25 bars are solid for the YoY read; hatched-outline bars mark unusual PAT quarters.</p>
  <div class="section grid g3">
    <div class="card"><h2>Against its industry</h2><div class="note">Rank within ${esc(c.ind)} among Sep-26 reporters, #1 = fastest growth</div>
      <dl class="kv"><dt>Revenue growth</dt><dd>${pctTxt("sg") || "–"}</dd><dt>EBITDA growth</dt><dd>${pctTxt("og") || "–"}</dd><dt>PAT growth</dt><dd>${pctTxt("pg") || "–"}</dd>
      <dt>ΔPAT</dt><dd class="${cls(c.dp)}">${dcr(c.dp)}</dd><dt>ROE / ROCE</dt><dd>${nn(c.roe) ? c.roe.toFixed(1) : "–"}% / ${nn(c.roce) ? c.roce.toFixed(1) : "–"}%</dd></dl></div>
    <div class="card"><h2>Market reaction</h2><div class="note">Local price lake; prints can differ from NSE closes by up to ~1.7%</div>
      <p style="margin:0 0 10px;color:var(--text-2)">${rxTxt}</p>
      ${nn(pos52) ? `<div class="muted" style="font-size:12px">52-week range ₹${inr(c.l52)} to ₹${inr(c.h52)}, price ₹${c.px.toLocaleString("en-IN")}</div><div class="range"><i style="left:calc(${pos52.toFixed(1)}% - 1px)"></i></div>` : ""}</div>
    <div class="card"><h2>Shareholding</h2><div class="note">${c.sh ? `As of ${esc(c.sh.asof)}, change vs prior quarter` : "Not available"}</div><dl class="kv">${shRows}</dl></div>
  </div>
  ${rv ? reviewBlock(rv) : c.tr ? `<div class="section card"><h2>Earnings call</h2><p class="sub">Transcript filed on NSE for this quarter: <a href="${esc(c.tr)}" target="_blank" rel="noopener">open the PDF</a>. No structured read yet.</p></div>` : ""}
  ${vd ? `<div class="section card"><h2>Prior research flag</h2><div class="note">From the master verdict index dated ${esc(META.verdict_asof)}, deepdive as of ${esc(vd.dd_as_of || "–")}. Written before these results, so read it as the thesis these numbers test.</div>
    <dl class="kv" style="max-width:520px"><dt>Unified tag</dt><dd>${esc(vd.unified_tag || "–")} · ${esc(vd.unified_conviction || "–")}</dd><dt>Recommended cohort</dt><dd>${esc(vd.recommended_cohort || "–")}</dd><dt>Final call</dt><dd>${esc(vd.final_call || "–")}</dd><dt>Analyst fair value</dt><dd>${nn(vd.analyst_fv) ? "₹" + inr(vd.analyst_fv) : "–"}</dd></dl></div>` : ""}
  <div class="section card"><div class="card-h"><h2>Peers in ${esc(c.ind)}</h2><span class="muted" style="font-size:12px">largest by market cap</span></div><div id="t-peers"></div></div>`;

  const n = h.q.length;
  const strong = (i) => i === n - 1 || i === n - 5;
  function bars(el, arr, color, isPat) {
    mk(el, {
      grid: { left: 46, right: 18, top: 10, bottom: 22 },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (v) => cr(v) },
      xAxis: { type: "category", data: h.q, ...axisStyle(), splitLine: { show: false }, axisLabel: { color: css("--text-3"), fontSize: 10, interval: (i) => i === n - 1 || i === n - 5 || i === 0 } },
      yAxis: { type: "value", ...axisStyle(), axisLabel: { color: css("--text-3"), fontSize: 10, formatter: (v) => (Math.abs(v) >= 1000 ? (v / 1000).toFixed(0) + "k" : v) } },
      series: [{
        type: "bar", barCategoryGap: "22%",
        data: arr.map((v, i) => ({
          value: v,
          itemStyle: {
            color: isPat && h.oo[i] ? "transparent" : color,
            opacity: strong(i) ? 1 : 0.45,
            borderColor: isPat && h.oo[i] ? css("--flag-oneoff") : "transparent", borderWidth: isPat && h.oo[i] ? 2 : 0, borderType: "dashed",
            borderRadius: v >= 0 ? [3, 3, 0, 0] : [0, 0, 3, 3],
          },
        })),
      }],
    });
  }
  bars($("#h-s"), h.s, css("--s1"));
  bars($("#h-o"), h.o, css("--s2"));
  bars($("#h-p"), h.p, css("--s3"), true);
  mk($("#h-m"), {
    grid: { left: 36, right: 18, top: 10, bottom: 22 },
    tooltip: { trigger: "axis", valueFormatter: (v) => (nn(v) ? v + "%" : "–") },
    xAxis: { type: "category", data: h.q, ...axisStyle(), splitLine: { show: false }, axisLabel: { color: css("--text-3"), fontSize: 10, interval: (i) => i === n - 1 || i === n - 5 || i === 0 } },
    yAxis: { type: "value", scale: true, ...axisStyle(), axisLabel: { color: css("--text-3"), fontSize: 10 } },
    series: [{ type: "line", data: h.m, symbol: "circle", symbolSize: (v, p) => (strong(p.dataIndex) ? 8 : 0), lineStyle: { width: 2, color: css("--text-2") }, itemStyle: { color: css("--text"), borderColor: css("--surface"), borderWidth: 2 } }],
  });
  table($("#t-peers"), peers, [COL.co, COL.mc, COL.sg, COL.og, COL.pg, COL.mbps, COL.r1x, COL.pe], { sort: "mc" });
  $("#t-peers").querySelectorAll("tr").forEach((tr) => { if (tr.dataset.t === t) tr.style.fontWeight = 600; });
}

function reviewBlock(r) {
  const li = (a) => (a && a.length ? `<ul>${a.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "");
  const obs = (r.obs || []).map((o) => `<tr><td>${esc(o.m)}</td><td class="num">${nn(o.v) ? esc(o.v) : "–"} <span class="muted">${esc(o.u || "")}</span></td><td class="num">${nn(o.c) ? esc(o.c) : "–"}</td><td class="muted">${esc(o.cl || "")}</td><td class="num">${esc(o.pg ?? "")}</td></tr>`).join("");
  return `<div class="section card review"><div class="card-h"><h2>Earnings call read</h2><span class="muted" style="font-size:12px">call ${esc(r.call_date || "")} · <a href="${esc(r.url)}" target="_blank" rel="noopener">source PDF</a></span></div>
    <div class="grid g2" style="margin-top:8px">
      <div><h3>${esc(r.title)}</h3><p class="sub" style="margin:0">${esc(r.summary)}</p>
        <div class="lbl">Drivers</div>${li(r.drivers)}<div class="lbl">Risks</div>${li(r.risks)}</div>
      <div><div class="lbl" style="margin-top:0">Next quarter has to show</div>${li(r.next)}${r.guidance?.length ? `<div class="lbl">Guidance, as stated</div>${li(r.guidance)}` : ""}</div>
    </div>
    ${obs ? `<div class="lbl">Operating KPIs from the call</div><div class="tbl-wrap"><table class="t"><thead><tr><th>Metric</th><th class="num">Value</th><th class="num">Compare</th><th>Against</th><th class="num">Page</th></tr></thead><tbody>${obs}</tbody></table></div>` : ""}
    <p class="muted" style="font-size:12px;margin:10px 0 0">Management statements, attributed. Pulled from the morning atlas review set.</p></div>`;
}

/* ------------------------------------------------------------------ view: boards */
const BOARDS = {
  clean: { l: "Clean beats", d: "Revenue, EBITDA and PAT all up 15% or more, margin flat or better, year-ago PAT of ₹5 cr or more, and no other-income, tax, unusual-quarter or call-cited adjustment flag. Sorted by rupee PAT added.", f: (c) => c.cb, sort: "dp" },
  turn: { l: "Turnarounds", d: "Loss a year ago, profit this quarter. Sorted by the size of the swing.", f: (c) => (c.fl || []).some((x) => x[0] === "l2p"), sort: "dp" },
  margin: { l: "Margin expanders", d: "Non-financials whose EBITDA margin rose 200 bps or more on flat or higher revenue.", f: (c) => c.mx, sort: "mbps" },
  adders: { l: "Profit-pool adders", d: "Largest rupee additions to PAT. Unusual quarters follow the universe switch on the pulse page.", f: (c) => nn(c.dp) && c.dp > 0 && (!S.o || !c.oneoff), sort: "dp" },
  decliners: { l: "Profit-pool decliners", d: "Largest rupee falls in PAT.", f: (c) => nn(c.dp) && c.dp < 0 && (!S.o || !c.oneoff), sort: "dp", asc: true },
  hollow: { l: "Hollow beats", d: "PAT up 20%+ but carried by other income, a lower tax rate, an unusual quarter, or EBITDA growth under 5%. Sorted by rupee PAT added.", f: (c) => c.hb, sort: "dp" },
  best: { l: "Best reactions", d: "Next-session move after results, relative to the Nifty 500.", f: (c) => nn(c.rx?.r1x), sort: "r1x" },
  worst: { l: "Worst reactions", d: "Next-session move after results, relative to the Nifty 500.", f: (c) => nn(c.rx?.r1x), sort: "r1x", asc: true },
};

function viewBoards(main, which) {
  if (which && BOARDS[which]) S.board = which;
  const secs = [...new Set(CO.map((c) => c.sec))].sort();
  main.innerHTML = `
  <section class="hero"><div><div class="kicker">Leaderboards</div><h1>Pre-built lenses on 1,900+ results</h1>
  <p class="lede">Each board applies one rule to every reporter. Filter by size or sector, then click any row for the company page.</p></div></section>
  <div class="controls" id="bctl">${Object.entries(BOARDS).map(([k, b]) => `<button class="chip ${S.board === k ? "on" : ""}" data-b="${k}">${b.l}</button>`).join("")}</div>
  <div class="controls" id="fctl"><span class="lbl">Size</span>${["All", "Large", "Mid", "Small", "Micro"].map((b) => `<button class="chip ${S.bucket === b ? "on" : ""}" data-z="${b}">${b}</button>`).join("")}
    <span class="lbl" style="margin-left:10px">Sector</span><select class="sel" id="bsec"><option>All</option>${secs.map((s) => `<option ${S.bsec === s ? "selected" : ""}>${esc(s)}</option>`).join("")}</select></div>
  <div class="card"><div class="card-h"><h2 id="b-title"></h2><span class="muted" id="b-n" style="font-size:12px"></span></div><div class="note" id="b-desc"></div><div id="t-board"></div></div>`;
  $("#bctl").querySelectorAll(".chip").forEach((b) => b.addEventListener("click", () => { S.board = b.dataset.b; history.replaceState(null, "", "#/boards/" + S.board); $("#bctl").querySelectorAll(".chip").forEach((x) => x.classList.toggle("on", x === b)); draw(); }));
  $("#fctl").querySelectorAll(".chip").forEach((b) => b.addEventListener("click", () => { S.bucket = b.dataset.z; $("#fctl").querySelectorAll(".chip").forEach((x) => x.classList.toggle("on", x === b)); draw(); }));
  $("#bsec").addEventListener("change", (e) => { S.bsec = e.target.value; draw(); });
  function draw() {
    const B = BOARDS[S.board];
    const rows = CO.filter((c) => B.f(c) && (S.bucket === "All" || c.bk === S.bucket) && (S.bsec === "All" || c.sec === S.bsec));
    $("#b-title").textContent = B.l;
    $("#b-desc").textContent = B.d;
    $("#b-n").textContent = `${rows.length.toLocaleString("en-IN")} companies`;
    table($("#t-board"), rows, [COL.co, COL.ind, COL.mc, COL.sg, COL.og, COL.pg, COL.mbps, COL.dp, COL.r1x, COL.rsx, COL.fl], { sort: B.sort, asc: B.asc, page: 50 });
  }
  draw();
}

/* ------------------------------------------------------------------ view: quality */
function viewQuality(main) {
  const base = CO.filter((c) => c.has_y);
  const R = agg(base), X = agg(base.filter((c) => !c.oneoff));
  const oneoffs = base.filter((c) => c.oneoff).sort((a, b) => Math.abs(b.dp || 0) - Math.abs(a.dp || 0));
  const has = (c, k) => (c.fl || []).some((f) => f[0] === k);
  const reason = (c, k) => esc(((c.fl || []).find((f) => f[0] === k) || [, ""])[1]);
  const oi = base.filter((c) => has(c, "oi")).sort((a, b) => (b.oi || 0) - (a.oi || 0));
  const tax = base.filter((c) => has(c, "tax")).sort((a, b) => (b.dp || 0) - (a.dp || 0));
  const p2l = base.filter((c) => has(c, "p2l")).sort((a, b) => (a.dp || 0) - (b.dp || 0));
  main.innerHTML = `
  <section class="hero"><div><div class="kicker">Earnings quality</div><h1>Every adjustment behind the headline</h1>
  <p class="lede">Reported PAT for all ${R.n.toLocaleString("en-IN")} matched companies grew ${pct(R.pat)}. Removing ${oneoffs.length} unusual quarters takes it to ${pct(X.pat)}, a gap of ${(X.pat - R.pat).toFixed(1)} points. Rule: ${esc(META.oneoff_rule)}, checked for both Sep-26 and Sep-25.</p></div></section>
  <div class="kpis">
    ${kpi("Reported PAT YoY", pct(R.pat), `${dcr(R.pat_d)}`)}${kpi("Ex unusual quarters", pct(X.pat), `${dcr(X.pat_d)}`)}
    ${kpi("Unusual quarters", oneoffs.length, "excluded by default")}${kpi("Other-income heavy", oi.length, "OI above 40% of PBT")}
    ${kpi("Tax-rate drops", tax.length, "10+ pts lower, PAT up 15%+")}${kpi("Profit → loss", p2l.length, "profitable a year ago")}
  </div>
  <div class="section card"><div class="card-h"><h2>Unusual quarters</h2><span class="muted" style="font-size:12px">sorted by size of the PAT swing</span></div>
    <div class="note">These companies leave the aggregate when "Exclude unusual quarters" is on. Check the filing before reading any of them as a trend.</div><div id="t-oo"></div></div>
  <div class="section grid g2">
    <div class="card"><h2>Other-income heavy</h2><div class="note">Non-financials where other income is above 40% of PBT this quarter.</div><div id="t-oi"></div></div>
    <div class="card"><h2>Tax-rate drops</h2><div class="note">Tax rate fell 10+ points and PAT grew 15%+. Part of the growth is the tax line.</div><div id="t-tax"></div></div>
  </div>
  <div class="section card"><h2>Profit to loss</h2><div class="note">Profitable in Sep-25, loss-making in Sep-26.</div><div id="t-p2l"></div></div>`;
  const shareOfD = (c) => (R.pat_d ? (c.dp / Math.abs(R.pat_d)) * 100 : null);
  table($("#t-oo"), oneoffs, [COL.co, COL.ind, { k: "why", h: "Why flagged", f: (c) => `<span class="sub">${reason(c, "oneoff")}</span>` }, { k: "p_y", h: "PAT Sep-25", num: true, f: (c) => cr(c.p_y) }, COL.p, COL.dp,
    { k: "sh", h: "Share of market ΔPAT", num: true, f: (c) => pct(shareOfD(c), 1), v: (c) => Math.abs(c.dp || 0) }], { sort: "sh", scroll: true });
  const small = [COL.co, { k: "why", h: "Detail", f: (c) => `<span class="sub">${reason(c, "oi") || reason(c, "tax")}</span>` }, COL.pg, COL.og];
  table($("#t-oi"), oi, small, { sort: "pg", page: 15 });
  table($("#t-tax"), tax, small, { sort: "pg", page: 15 });
  table($("#t-p2l"), p2l, [COL.co, COL.ind, COL.mc, { k: "p_y", h: "PAT Sep-25", num: true, f: (c) => cr(c.p_y) }, COL.p, COL.dp, COL.sg, COL.og], { sort: "dp", asc: true, page: 25 });
}

/* ------------------------------------------------------------------ view: explorer */
function viewExplorer(main) {
  const secs = [...new Set(CO.map((c) => c.sec))].sort();
  main.innerHTML = `
  <section class="hero"><div><div class="kicker">All companies</div><h1>${CO.length.toLocaleString("en-IN")} Sep-26 results</h1>
  <p class="lede">Search, filter and sort every reporter. Export downloads the filtered rows as CSV.</p></div></section>
  <div class="controls">
    <input class="txt" id="xq" placeholder="Ticker or name">
    <select class="sel" id="xsec"><option value="">All sectors</option>${secs.map((s) => `<option>${esc(s)}</option>`).join("")}</select>
    <select class="sel" id="xind"><option value="">All industries</option></select>
    <select class="sel" id="xbk"><option value="">All sizes</option><option>Large</option><option>Mid</option><option>Small</option><option>Micro</option></select>
    <select class="sel" id="xfl"><option value="">Any flag</option><option value="cb">Clean beat</option><option value="hb">Hollow beat</option><option value="mx">Margin expander</option><option value="oneoff">Unusual quarter</option><option value="l2p">Loss → profit</option><option value="p2l">Profit → loss</option><option value="oi">Other-income heavy</option><option value="tax">Tax-rate drop</option><option value="call">Call-cited adjustment</option></select>
    <button class="chip" id="xcsv">Export CSV</button>
    <span class="lbl" id="xn"></span>
  </div>
  <div class="card"><div id="t-x"></div></div>`;
  let rows = CO;
  const fillInd = () => {
    const s = $("#xsec").value;
    const inds = [...new Set(CO.filter((c) => !s || c.sec === s).map((c) => c.ind))].sort();
    $("#xind").innerHTML = `<option value="">All industries</option>` + inds.map((i) => `<option>${esc(i)}</option>`).join("");
  };
  const draw = () => {
    const q = $("#xq").value.trim().toLowerCase(), s = $("#xsec").value, i = $("#xind").value, b = $("#xbk").value, f = $("#xfl").value;
    rows = CO.filter((c) => (!q || c.t.toLowerCase().includes(q) || c.nm.toLowerCase().includes(q)) && (!s || c.sec === s) && (!i || c.ind === i) && (!b || c.bk === b) &&
      (!f || (["cb", "hb", "mx"].includes(f) ? c[f] : (c.fl || []).some((x) => x[0] === f))));
    $("#xn").textContent = `${rows.length.toLocaleString("en-IN")} companies`;
    table($("#t-x"), rows, [COL.co, COL.ind, COL.mc, COL.s, COL.sg, COL.og, COL.pg, COL.pqg, COL.mbps, COL.dp, COL.r1x, COL.pe, COL.fl], { sort: "mc", page: 50 });
  };
  fillInd();
  $("#xsec").addEventListener("change", () => { fillInd(); draw(); });
  ["#xind", "#xbk", "#xfl"].forEach((id) => $(id).addEventListener("change", draw));
  $("#xq").addEventListener("input", draw);
  $("#xcsv").addEventListener("click", () => {
    const keys = ["t", "nm", "sec", "ind", "bk", "mc", "vw", "s", "s_y", "sg", "o", "o_y", "og", "p", "p_y", "pg", "pqg", "m", "m_y", "mbps", "dp", "oi", "tx", "pe", "pb"];
    const lines = [keys.concat(["reaction_vs_n500", "flags"]).join(",")].concat(rows.map((c) => keys.map((k) => csvCell(c[k])).concat([csvCell(c.rx?.r1x), csvCell((c.fl || []).map((f) => f[0]).join("|"))]).join(",")));
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "q2fy27_earnings_filtered.csv";
    a.click();
  });
  draw();
}
function csvCell(v) {
  if (!nn(v) || v === "") return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/* ------------------------------------------------------------------ search, theme, router */
function initSearch() {
  const inp = $("#gsearch"), res = $("#gsearch-res");
  let hits = [];
  inp.addEventListener("input", () => {
    const q = inp.value.trim().toLowerCase();
    if (!q) { res.hidden = true; return; }
    hits = CO.filter((c) => c.t.toLowerCase().startsWith(q)).concat(CO.filter((c) => !c.t.toLowerCase().startsWith(q) && c.nm.toLowerCase().includes(q)))
      .slice(0, 12);
    res.innerHTML = hits.map((c, i) => `<a href="#/company/${encodeURIComponent(c.t)}" class="${i === 0 ? "hl" : ""}"><span><b>${esc(c.t)}</b> <span class="muted">${esc(trim(c.nm, 28))}</span></span><span class="${cls(c.pg)}">${pct(c.pg)}</span></a>`).join("") || `<div class="muted" style="padding:8px">No match</div>`;
    res.hidden = false;
  });
  inp.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && hits[0]) { location.hash = "#/company/" + encodeURIComponent(hits[0].t); res.hidden = true; inp.value = ""; inp.blur(); }
    if (e.key === "Escape") { res.hidden = true; inp.blur(); }
  });
  res.addEventListener("click", () => { res.hidden = true; inp.value = ""; });
  document.addEventListener("click", (e) => { if (!e.target.closest(".top-tools")) res.hidden = true; });
}

function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem("atlas-theme"); } catch (e) { /* storage blocked */ }
  if (saved) document.documentElement.dataset.theme = saved;
  $("#theme").addEventListener("click", () => {
    const dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("atlas-theme", next); } catch (e) { /* ignore */ }
    route();
  });
}

async function route() {
  disposeCharts();
  const main = $("#main");
  const parts = location.hash.replace(/^#\/?/, "").split("/").map(decodeURIComponent);
  const v = parts[0] || "pulse";
  document.querySelectorAll("#tabs a").forEach((a) => a.classList.toggle("on", a.dataset.v === (v === "industry" ? "sectors" : v === "company" ? "" : v)));
  window.scrollTo(0, 0);
  if (v === "pulse" || v === "") viewPulse(main);
  else if (v === "sectors") viewSectors(main);
  else if (v === "industry") await viewIndustry(main, parts.slice(1).join("/"));
  else if (v === "company") await viewCompany(main, parts[1]);
  else if (v === "boards") viewBoards(main, parts[1]);
  else if (v === "quality") viewQuality(main);
  else if (v === "explorer") viewExplorer(main);
  else viewPulse(main);
}

function footer() {
  $("#foot").innerHTML = `
  <p><b>Sources.</b> Quarterly P&amp;L, snapshot, shareholding: local fundamentals lake, written ${esc(META.pnl_asof)}. Result timestamps: NSE board-meeting outcomes. Prices: local OHLCV lake to ${esc(META.px_asof)}, benchmark Nifty 500. Call reads: ${META.reviews} structured reviews from the morning atlas run. Research flags: master verdict index, ${esc(META.verdict_asof)}.</p>
  <p><b>Method.</b> YoY compares each company's Sep-26 quarter with its Sep-25 quarter on the same consolidated or standalone basis. Aggregates sum rupees across companies that have both periods for that line. EBITDA margin excludes financial services, whose revenue line is interest income. PAT is reported net profit. Unusual quarter: ${esc(META.oneoff_rule)}. Built ${esc(META.built)}.</p>
  <p>Descriptive analysis of reported results. Nothing here is a recommendation to buy or sell.</p>`;
}

(async function init() {
  initTheme();
  [META, CO, TREND] = await Promise.all([getj("data/meta.json"), getj("data/companies.json"), getj("data/trend.json")]);
  BYT = Object.fromEntries(CO.map((c) => [c.t, c]));
  footer();
  initSearch();
  window.addEventListener("hashchange", route);
  route();
})();
