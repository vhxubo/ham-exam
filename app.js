/* HAM Exam — 零依赖业余无线电刷题站 */
"use strict";

/* ================= 工具 ================= */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const LETTERS = ["A", "B", "C", "D"];
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function fmtTime(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const mm = String(m).padStart(2, "0"), ss = String(sec).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
function fmtDate(ts) {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2200);
}
function confirmDialog(title, body, okText = "确定") {
  return new Promise(resolve => {
    const mask = document.createElement("div");
    mask.className = "dialog-mask";
    mask.innerHTML = `<div class="dialog"><h3>${esc(title)}</h3><p>${esc(body)}</p>
      <div class="btn-row" style="justify-content:flex-end">
        <button class="btn ghost" data-r="0">取消</button>
        <button class="btn primary" data-r="1">${esc(okText)}</button>
      </div></div>`;
    mask.addEventListener("click", e => {
      const b = e.target.closest("[data-r]");
      if (b || e.target === mask) { mask.remove(); resolve(b ? b.dataset.r === "1" : false); }
    });
    document.body.appendChild(mask);
  });
}

/* ================= 存储（按题库隔离） ================= */
const GKEY = "hamex.global.v1";
const BKEY = id => `hamex.bank.${id}.v1`;
const global = (() => {
  try { return Object.assign({ bank: "a", theme: "auto" }, JSON.parse(localStorage.getItem(GKEY) || "{}")); }
  catch { return { bank: "a", theme: "auto" }; }
})();
const saveGlobal = () => localStorage.setItem(GKEY, JSON.stringify(global));

function stateDefaults() {
  return { qstats: {}, wrong: {}, exams: [], session: null, drill: null };
}
let S = stateDefaults();
function loadState() {
  try { S = Object.assign(stateDefaults(), JSON.parse(localStorage.getItem(BKEY(global.bank)) || "{}")); }
  catch { S = stateDefaults(); }
}
const saveState = () => localStorage.setItem(BKEY(global.bank), JSON.stringify(S));

/* ================= 题库加载 ================= */
const BANKS = window.BANKS = window.BANKS || {};
const BANK_LIST = ["a", "b", "c"];
const bankLoading = {};
function loadBank(id) {
  if (BANKS[id]) return Promise.resolve(BANKS[id]);
  if (!bankLoading[id]) {
    bankLoading[id] = new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = `banks/bank-${id}.js`;
      s.onload = () => (BANKS[id] ? res(BANKS[id]) : rej(new Error("题库格式异常")));
      s.onerror = () => { delete bankLoading[id]; rej(new Error("题库加载失败")); };
      document.head.appendChild(s);
    });
  }
  return bankLoading[id];
}
const bank = () => BANKS[global.bank];

function byId() {
  const b = bank();
  if (!b._map) {
    b._map = new Map(b.qs.map((q, i) => [q.i, i]));
    b._secIdx = {};
    b.qs.forEach((q, i) => (b._secIdx[q.p.slice(0, q.p.lastIndexOf("."))] ??= []).push(i));
  }
  return b;
}
const qIndex = qid => byId()._map.get(qid);

/* 统计辅助：题干记录 */
function recordAnswer(qid, correct) {
  const st = (S.qstats[qid] ??= { s: 0, c: 0, w: 0, l: 0 });
  st.s++; correct ? st.c++ : st.w++; st.l = Date.now();
  if (!correct) {
    S.wrong[qid] = { n: 0, ts: Date.now() };
  } else if (S.wrong[qid]) {
    S.wrong[qid].n++;
    if (S.wrong[qid].n >= 2) delete S.wrong[qid]; // 连对两次移出错题本
  }
  saveState();
}
function recordSeen(qid) {
  const st = (S.qstats[qid] ??= { s: 0, c: 0, w: 0, l: 0 });
  st.s++; st.l = Date.now();
  saveState();
}

/* ================= 主题 ================= */
const THEME_ICON = {
  auto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4 1.4-1.4"/></svg>',
  light: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4 1.4-1.4"/></svg>',
  dark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>',
};
function applyTheme() {
  const t = global.theme;
  const dark = t === "dark" || (t === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "" : "light";
  $("#themeBtn").innerHTML = THEME_ICON[t];
}
function cycleTheme() {
  global.theme = { auto: "light", light: "dark", dark: "auto" }[global.theme];
  saveGlobal(); applyTheme();
}

/* ================= 顶栏 ================= */
function renderBankSwitch() {
  const box = $("#bankSwitch");
  box.innerHTML = BANK_LIST.map(id =>
    `<button role="tab" data-bank="${id}" class="${id === global.bank ? "on" : ""}">${id.toUpperCase()}</button>`).join("");
  box.onclick = e => {
    const b = e.target.closest("[data-bank]");
    if (!b || b.dataset.bank === global.bank) return;
    global.bank = b.dataset.bank;
    saveGlobal(); loadState(); renderBankSwitch(); route();
  };
}
function setActiveTab(view) {
  $$("#nav a").forEach(a => a.classList.toggle("active", a.dataset.view === view));
}

/* ================= 题目渲染（选项打乱） ================= */
function questionCard(q, { mode, shuffleOpts = true }) {
  // 官方源数据单选答案恒为 A（正确项排在首位），练习时必须打乱选项。
  // 背题/查看保持原序：解析文本中的字母引用（"故D错"等）按原始顺序书写。
  const order = shuffleOpts ? shuffle([0, 1, 2, 3]) : [0, 1, 2, 3];
  const isMulti = q.a.length > 1;
  const card = document.createElement("div");
  card.className = "card";
  const sec = q.p.slice(0, q.p.lastIndexOf("."));
  const secName = bank().sections[sec] || sec;
  card.innerHTML = `
    <div class="q-head">
      <span class="chip green">${esc(q.j)}</span>
      <span class="chip">${esc(q.p)} ${esc(secName)}</span>
      ${isMulti ? '<span class="chip amber">多选</span>' : ""}
      ${mode === "exam" ? "" : ""}
    </div>
    <div class="q-text">${esc(q.q)}</div>
    ${q.g ? `<img class="q-img" src="${q.g.startsWith("data:") ? "" : "banks/"}${q.g}" alt="题目附图" loading="lazy">` : ""}
    <div class="opts"></div>
    <div class="drill-foot"></div>`;
  const optsEl = $(".opts", card);
  const footEl = $(".drill-foot", card);
  const keyMap = new Map(); // displayIdx -> originalIdx

  order.forEach((origIdx, dIdx) => keyMap.set(dIdx, origIdx));
  const correctD = order.map((o, d) => (q.a.includes(o) ? d : -1)).filter(i => i >= 0);

  order.forEach((origIdx, dIdx) => {
    const b = document.createElement("button");
    b.className = "opt";
    b.type = "button";
    b.dataset.d = dIdx;
    b.innerHTML = `<span class="key">${LETTERS[dIdx]}</span><span>${esc(q.o[origIdx])}</span>`;
    optsEl.appendChild(b);
  });

  function paint(pickSet, revealed) {
    $$(".opt", optsEl).forEach(b => {
      const d = +b.dataset.d;
      b.disabled = !!revealed;
      b.classList.toggle("picked", !revealed && pickSet.has(d));
      if (revealed) {
        b.classList.toggle("correct", correctD.includes(d));
        b.classList.toggle("wrong", pickSet.has(d) && !correctD.includes(d));
      } else b.classList.remove("correct", "wrong");
    });
  }
  // 原始下标 -> 展示字母
  const disp = origIdx => LETTERS[order.indexOf(origIdx)];
  // 把解析/助记里的原始选项字母重映射为当前展示字母。
  // 只处理独立的 A-D（前后非字母数字，排除 "A类/B类"、"GB8702"、"D-STAR"、"BPSK" 等）。
  const remap = text => String(text || "").replace(
    /(?<![A-Za-z0-9-])([A-D]{1,4})(?![A-Za-z0-9-]|\s*类)/g,
    run => run.split("").map(c => disp(c.charCodeAt(0) - 65)).join("")
  );
  return { card, optsEl, footEl, keyMap, correctD, isMulti, paint, disp, remap, shuffled: shuffleOpts };
}

/* ================= 路由 ================= */
const routes = [
  [/^#\/home$/, () => viewHome],
  [/^#\/chapters$/, () => viewChapters],
  [/^#\/wrong$/, () => viewWrong],
  [/^#\/exam$/, () => viewExam],
  [/^#\/stats$/, () => viewStats],
  [/^#\/search(?:\/(.*))?$/, m => () => viewSearch(decodeURIComponent(m[1] || ""))],
  [/^#\/q\/(.+)$/, m => () => viewQuestion(m[1])],
  [/^#\/drill\/(practice|recite)\/(.+)$/, m => () => viewDrill(m[1], m[2])],
];
let keyHandler = null;
let examTimer = null;

async function route() {
  const hash = location.hash || "#/home";
  if (keyHandler) { keyHandler = null; }
  if (examTimer) { clearInterval(examTimer); examTimer = null; }
  try { await loadBank(global.bank); } catch (e) {
    $("#view").innerHTML = `<div class="empty">题库加载失败：${esc(e.message)}，请刷新重试</div>`;
    return;
  }
  let view = null, name = "home";
  for (const [re, fn] of routes) {
    const m = hash.match(re);
    if (m) { view = fn(m); name = hash.slice(2, 12); break; }
  }
  if (!view) { location.hash = "#/home"; return; }
  const v = $("#view");
  v.scrollTop = 0;
  const tab = name.split("/")[0];
  setActiveTab(["home", "chapters", "wrong", "exam", "stats", "search"].includes(tab) ? tab : "");
  v.innerHTML = "";
  view();
  $("#footState").textContent = `${bank().label} · ${bank().qs.length} 题`;
}

/* ================= 范围解析 ================= */
function scopeIndexes(scope) {
  const b = byId();
  if (scope === "all") return b.qs.map((_, i) => i);
  if (scope === "wrong") return Object.keys(S.wrong).map(qIndex).filter(i => i != null);
  if (scope.startsWith("ch-")) {
    const ch = scope.slice(3);
    return b.qs.map((q, i) => (q.p.startsWith(ch + ".") ? i : -1)).filter(i => i >= 0);
  }
  if (scope.startsWith("sec-")) {
    const sec = scope.slice(4);
    return (b._secIdx[sec] || []).slice();
  }
  return [];
}
function scopeTitle(scope) {
  const b = bank();
  if (scope === "all") return "全部题目";
  if (scope === "wrong") return "错题重刷";
  if (scope.startsWith("ch-")) return `第 ${scope.slice(3)} 章 · ${b.chapters[scope.slice(3)] || ""}`;
  if (scope.startsWith("sec-")) {
    const sec = scope.slice(4);
    return `${sec} · ${b.sections[sec] || ""}`;
  }
  return scope;
}

/* ================= 首页 ================= */
function viewHome() {
  const v = $("#view");
  const b = bank();
  const qs = b.qs;
  const statVals = Object.values(S.qstats);
  const seen = statVals.length;
  const answered = statVals.reduce((n, s) => n + s.c + s.w, 0);
  const correct = statVals.reduce((n, s) => n + s.c, 0);
  const acc = answered ? Math.round((correct / answered) * 100) : 0;
  const wrongN = Object.keys(S.wrong).length;
  const lastExam = S.exams[0];

  const resume = S.drill && S.drill.pos < S.drill.order.length
    ? `<a class="btn" href="#/drill/${S.drill.mode}/${S.drill.scope}">继续上次：${esc(scopeTitle(S.drill.scope))}（${S.drill.pos + 1}/${S.drill.order.length}）</a>` : "";

  v.innerHTML = `
    <div class="hero">
      <h1>${esc(b.label)}操作证书刷题</h1>
      <p>题库 2025-10 版（CRAC）· 共 ${qs.length} 题 · 含官方知识点解析与助记</p>
    </div>
    <div class="card">
      <div class="kv">
        <div class="item"><span class="k">已练习</span><span class="v">${seen}<small> / ${qs.length} 题</small></span></div>
        <div class="item"><span class="k">正确率</span><span class="v">${answered ? acc + "%" : "—"}<small> ${answered ? `答过 ${answered} 次` : "开始第一题吧"}</small></span></div>
        <div class="item"><span class="k">错题本</span><span class="v">${wrongN}<small> 题</small></span></div>
        <div class="item"><span class="k">最近考试</span><span class="v">${lastExam ? `${lastExam.score}<small> / ${lastExam.total} ${lastExam.passed ? "✓ 合格" : "✗ 未过"}</small>` : "—"}</span></div>
      </div>
      <div class="meter"><i style="width:${Math.round((seen / qs.length) * 100)}%"></i></div>
    </div>
    <div class="mode-grid" style="margin-top:14px">
      <a class="mode-card" href="#/drill/practice/all">
        <span class="t"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h4l3-8 4 16 3-8h6"/></svg>顺序刷题</span>
        <span class="d">逐题作答、即时判分、错题自动进错题本</span>
      </a>
      <a class="mode-card" href="#/drill/practice/all?shuffle=1" data-shuffle>
        <span class="t"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>随机刷题</span>
        <span class="d">打乱顺序刷完全库</span>
      </a>
      <a class="mode-card" href="#/drill/recite/all">
        <span class="t"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>背题模式</span>
        <span class="d">直接显示答案与解析，快速过题</span>
      </a>
      <a class="mode-card" href="#/exam">
        <span class="t"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>模拟考试</span>
        <span class="d">${esc(b.cls)} 类规格：${b.rule.total} 题（单选 ${b.rule.singles} + 多选 ${b.rule.multiples}）· ${b.rule.minutes} 分钟 · ${b.rule.pass} 题合格</span>
      </a>
    </div>
    ${resume ? `<div class="card" style="margin-top:14px">${resume}</div>` : ""}
    ${wrongN ? `<a class="card row" href="#/wrong" style="margin-top:14px"><span class="grow"><span class="name">错题本有 ${wrongN} 题待消灭</span><span class="sub">答对两次自动移除</span></a></a>` : ""}`;
  $$("[data-shuffle]", v).forEach(a => a.onclick = e => {
    e.preventDefault();
    startDrill("practice", "all", true);
  });
}

/* ================= 刷题 / 背题 ================= */
function startDrill(mode, scope, random) {
  const idx = scopeIndexes(scope);
  if (!idx.length) { toast("该范围暂无题目"); return; }
  const order = random ? shuffle(idx) : idx;
  S.drill = { mode, scope, order, pos: 0, shuffle: !!random };
  saveState();
  location.hash = `#/drill/${mode}/${scope}`;
}

function viewDrill(mode, scope) {
  const v = $("#view");
  const b = bank();
  // 恢复或新建
  if (!S.drill || S.drill.mode !== mode || S.drill.scope !== scope) {
    const idx = scopeIndexes(scope);
    if (!idx.length) {
      v.innerHTML = `<div class="empty">该范围没有题目${scope === "wrong" ? "，错题本是空的 🎉" : ""}<div style="margin-top:14px"><a class="btn" href="#/home">回首页</a></div></div>`;
      return;
    }
    S.drill = { mode, scope, order: idx, pos: 0, shuffle: false };
    saveState();
  }
  const D = S.drill;
  if (D.pos >= D.order.length) {
    v.innerHTML = `<div class="empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="8" r="6"/><path d="M8.5 13 7 22l5-3 5 3-1.5-9"/></svg>
      ${mode === "recite" ? "过完了！" : "刷完了！"}共 ${D.order.length} 题
      <div class="btn-row" style="justify-content:center;margin-top:16px">
        <a class="btn" href="#/home">回首页</a>
        <button class="btn primary" id="againBtn">再来一轮</button>
      </div></div>`;
    $("#againBtn").onclick = () => startDrill(mode, scope, D.shuffle);
    return;
  }

  const qi = D.order[D.pos];
  const q = b.qs[qi];
  let pick = new Set();
  let done = false;

  v.innerHTML = `
    <div class="drill-bar">
      <a class="btn sm ghost" href="${scope === "wrong" ? "#/wrong" : scope === "all" ? "#/home" : "#/chapters"}">退出</a>
      <div class="meter"><i style="width:${Math.round((D.pos / D.order.length) * 100)}%"></i></div>
      <span class="pos">${D.pos + 1} / ${D.order.length}</span>
    </div>
    <div id="qbox"></div>`;

  const qc = questionCard(q, { mode, shuffleOpts: mode !== "recite" });
  $("#qbox").appendChild(qc.card);

  if (mode === "recite") {
    // 背题：直接揭示答案（空选择集 → 不标错误项，只高亮正确项）
    qc.paint(new Set(), true);
    $$(".opt", qc.optsEl).forEach(b2 => {
      const d = +b2.dataset.d;
      const orig = qc.keyMap.get(d);
      if (q.a.includes(orig)) b2.classList.add("correct");
    });
    const box = document.createElement("div");
    box.className = "explain";
    box.innerHTML = `<b>答案 ${q.a.map(i => LETTERS[i]).join("")}${q.a.length > 1 ? "（多选）" : ""}</b>${q.g ? "" : ""}
      ${q.e ? esc(q.e) : "（本题暂无解析）"}${q.m ? `<div class="mnemonic">${esc(q.m)}</div>` : ""}`;
    qc.card.insertBefore(box, qc.footEl);
    recordSeen(q.i);
    qc.footEl.innerHTML = `<span></span><button class="btn primary" id="nextBtn">下一题（Enter）</button>`;
    $("#nextBtn").onclick = next;
    keyHandler = e => { if (e.key === "Enter") next(); };
  } else {
    const submit = () => {
      if (done || !pick.size) return;
      done = true;
      const picked = [...pick].map(d => qc.keyMap.get(d)).sort();
      const correct = picked.length === q.a.length && picked.every((x, i) => x === q.a[i]);
      qc.paint(pick, true);
      recordAnswer(q.i, correct);
      const verdict = document.createElement("div");
      verdict.className = `verdict ${correct ? "ok" : "no"}`;
      verdict.textContent = correct ? "✓ 回答正确" : `✗ 答错了，正确答案 ${q.a.map(i => qc.disp(i)).join("")}`;
      qc.card.insertBefore(verdict, qc.footEl);
      const box = document.createElement("div");
      box.className = "explain";
      box.innerHTML = `<b>解析</b>${q.e ? esc(qc.remap(q.e)) : "（本题暂无解析）"}${q.m ? `<div class="mnemonic">${esc(qc.remap(q.m))}</div>` : ""}`;
      qc.card.insertBefore(box, qc.footEl);
      $("#confirmBtn")?.remove();
      const last = D.pos === D.order.length - 1;
      qc.footEl.innerHTML = `<button class="btn ghost" id="stopBtn">退出</button>
        <button class="btn primary" id="nextBtn">${last ? "完成" : "下一题（Enter）"}</button>`;
      $("#nextBtn").onclick = next;
      $("#stopBtn").onclick = () => (location.hash = "#/home");
      keyHandler = e => { if (e.key === "Enter") next(); };
    };
    const pickAt = d => {
      if (done) return;
      if (qc.isMulti) {
        pick.has(d) ? pick.delete(d) : pick.add(d);
        qc.paint(pick);
        $("#confirmBtn")?.toggleAttribute("disabled", !pick.size);
      } else {
        pick = new Set([d]);
        qc.paint(pick);
        submit();
      }
    };
    qc.optsEl.onclick = e => {
      const b2 = e.target.closest(".opt");
      if (b2) pickAt(+b2.dataset.d);
    };
    if (qc.isMulti) {
      qc.footEl.innerHTML = `<span class="chip amber">多选题：选齐后确认</span>
        <button class="btn primary" id="confirmBtn" disabled>确认（Enter）</button>`;
      $("#confirmBtn").onclick = submit;
      keyHandler = e => {
        const n = "1234".indexOf(e.key), l = "abcd".indexOf(e.key.toLowerCase());
        const d = n >= 0 ? n : l;
        if (d >= 0) pickAt(d);
        if (e.key === "Enter" && pick.size && !done) submit();
        else if (e.key === "Enter" && done) next();
      };
    } else {
      keyHandler = e => {
        const n = "1234".indexOf(e.key), l = "abcd".indexOf(e.key.toLowerCase());
        const d = n >= 0 ? n : l;
        if (d >= 0 && !done) pickAt(d);
        else if (e.key === "Enter" && done) next();
      };
    }
  }

  function next() {
    D.pos++;
    saveState();
    viewDrill(mode, scope);
    $("#view").scrollTop = 0;
  }
}

/* ================= 章节 ================= */
function sectionStat(sec) {
  const b = byId();
  const idx = b._secIdx[sec] || [];
  let seen = 0, c = 0, w = 0;
  idx.forEach(i => {
    const st = S.qstats[b.qs[i].i];
    if (st) { seen++; c += st.c; w += st.w; }
  });
  const answered = c + w;
  return { total: idx.length, seen, acc: answered ? Math.round((c / answered) * 100) : null };
}
function viewChapters() {
  const v = $("#view");
  const b = byId();
  const secs = [...new Set(b.qs.map(q => q.p.slice(0, q.p.lastIndexOf("."))))].sort();
  const byChapter = {};
  secs.forEach(s => (byChapter[s.split(".")[0]] ??= []).push(s));
  let html = `<h1 class="page-title">章节练习<small>${esc(bank().label)}</small></h1>`;
  Object.keys(b.chapters).sort().forEach(ch => {
    const list = byChapter[ch] || [];
    const total = list.reduce((n, s) => n + (b._secIdx[s] || []).length, 0);
    html += `<div class="chap-head">第 ${ch} 章 · ${esc(b.chapters[ch])}<span class="n">${total} 题</span></div><div class="list">`;
    list.forEach(sec => {
      const st = sectionStat(sec);
      html += `<a class="row" href="#/drill/practice/sec-${sec}">
        <div class="grow"><div class="name">${sec} ${esc(bank().sections[sec] || "")}</div>
        <div class="sub"><span>${st.total} 题</span><span>已练 ${st.seen}</span><span>${st.acc != null ? "正确率 " + st.acc + "%" : "未练习"}</span></div></div>
        <div class="mini-meter"><i style="width:${st.total ? Math.round((st.seen / st.total) * 100) : 0}%"></i></div>
        <span class="arrow">›</span></a>`;
    });
    html += `</div>`;
  });
  v.innerHTML = html;
}

/* ================= 错题本 ================= */
function viewWrong() {
  const v = $("#view");
  const b = bank();
  const ids = Object.keys(S.wrong).sort((x, y) => S.wrong[y].ts - S.wrong[x].ts);
  if (!ids.length) {
    v.innerHTML = `<div class="empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 6 9 17l-5-5"/></svg>
      错题本是空的，继续保持！<div style="margin-top:14px"><a class="btn" href="#/home">去刷题</a></div></div>`;
    return;
  }
  let html = `<h1 class="page-title">错题本<small>${ids.length} 题 · 答对两次自动移除</small></h1>
    <div class="btn-row" style="margin-bottom:14px">
      <a class="btn primary" href="#/drill/practice/wrong">重刷错题</a>
      <a class="btn" href="#/drill/recite/wrong">背诵错题</a>
    </div><div class="list">`;
  ids.forEach(qid => {
    const q = b.qs[qIndex(qid)];
    if (!q) return;
    html += `<a class="row" href="#/q/${qid}">
      <div class="grow"><div class="name">${esc(q.q.slice(0, 60))}${q.q.length > 60 ? "…" : ""}</div>
      <div class="sub"><span>${esc(q.j)}</span><span>${esc(q.p)}</span><span>连对 ${S.wrong[qid].n}/2 移除</span></div></div>
      <span class="arrow">›</span></a>`;
  });
  html += `</div>`;
  v.innerHTML = html;
}

/* ================= 单题查看 ================= */
function viewQuestion(qid) {
  const v = $("#view");
  const q = bank().qs[qIndex(qid)];
  if (!q) { v.innerHTML = `<div class="empty">题目不存在</div>`; return; }
  v.innerHTML = `<div class="btn-row" style="margin-bottom:12px"><a class="btn sm ghost" href="javascript:history.back()">‹ 返回</a></div><div id="qbox"></div>`;
  const qc = questionCard(q, { mode: "recite", shuffleOpts: false });
  $("#qbox").appendChild(qc.card);
  $$(".opt", qc.optsEl).forEach(b2 => {
    const orig = qc.keyMap.get(+b2.dataset.d);
    if (q.a.includes(orig)) b2.classList.add("correct");
  });
  const box = document.createElement("div");
  box.className = "explain";
  box.innerHTML = `<b>答案 ${q.a.map(i => LETTERS[i]).join("")}${q.a.length > 1 ? "（多选）" : ""}</b>
    ${q.e ? esc(q.e) : "（本题暂无解析）"}${q.m ? `<div class="mnemonic">${esc(q.m)}</div>` : ""}`;
  qc.card.appendChild(box);
}

/* ================= 模拟考试 ================= */
function drawExam(b) {
  const singles = shuffle(b.qs.map((q, i) => (q.a.length === 1 ? i : -1)).filter(i => i >= 0)).slice(0, b.rule.singles);
  const multis = shuffle(b.qs.map((q, i) => (q.a.length > 1 ? i : -1)).filter(i => i >= 0)).slice(0, b.rule.multiples);
  return [...singles, ...multis];
}
function viewExam() {
  const v = $("#view");
  const b = bank();

  // 有未完成会话：过期则判分，否则询问是否继续
  if (S.session) {
    if (Date.now() >= S.session.endsAt) { gradeExam(true); return; }
    v.innerHTML = `<h1 class="page-title">模拟考试<small>${esc(b.label)}</small></h1>
      <div class="card">
        <h2>有一场进行中的考试</h2>
        <p style="color:var(--ink-2);font-size:14px">剩余 ${fmtTime(S.session.endsAt - Date.now())}，已答 ${Object.keys(S.session.ans).length}/${S.session.qids.length} 题。考试计时不会暂停。</p>
        <div class="btn-row"><button class="btn primary" id="resumeBtn">继续作答</button>
        <button class="btn danger" id="discardBtn">放弃这场</button></div>
      </div>`;
    $("#resumeBtn").onclick = examRun;
    $("#discardBtn").onclick = async () => {
      if (await confirmDialog("放弃考试", "本场成绩将不计入历史，确定放弃？", "放弃")) { S.session = null; saveState(); viewExam(); }
    };
    return;
  }

  const rule = b.rule;
  v.innerHTML = `<h1 class="page-title">模拟考试<small>${esc(b.label)}</small></h1>
    <div class="card">
      <h2>${esc(b.cls)} 类考核规格</h2>
      <div class="rule-note">
        试卷共 <b>${rule.total}</b> 题：单选 <b>${rule.singles}</b> + 多选 <b>${rule.multiples}</b>；限时 <b>${rule.minutes}</b> 分钟；
        答对 <b>${rule.pass}</b> 题及以上合格。<br>多选题须与标准答案<b>完全一致</b>才得分，漏选错选均不得分。选项顺序已打乱。
      </div>
      <div class="btn-row"><button class="btn primary" id="startBtn">开始考试</button></div>
    </div>
    ${S.exams.length ? `<div class="card"><h2>最近成绩</h2><div class="list">${S.exams.slice(0, 5).map(e =>
      `<div class="row"><div class="grow"><div class="name">${fmtDate(e.ts)}</div><div class="sub">单选 ${e.singleOk}/${rule.singles} · 多选 ${e.multiOk}/${rule.multiples}</div></div>
       <span class="chip ${e.passed ? "green" : "red"}">${e.score} / ${e.total} ${e.passed ? "合格" : "未过"}</span></div>`).join("")}</div></div>` : ""}`;
  $("#startBtn").onclick = () => {
    S.session = {
      qids: drawExam(b).map(i => b.qs[i].i),
      ans: {},
      pos: 0,
      endsAt: Date.now() + rule.minutes * 60000,
    };
    saveState();
    examRun();
  };
}

function examRun() {
  const v = $("#view");
  const b = bank();
  const ss = S.session;
  const qids = ss.qids;

  let pos = Math.min(ss.pos || 0, qids.length - 1);
  const renderQ = () => {
    const q = b.qs[qIndex(qids[pos])];
    const saved = ss.ans[q.i] || null;
    const isMulti = q.a.length > 1;
    const qc = questionCard(q, { mode: "exam" });
    $$(".opt", qc.optsEl).forEach(btn => {
      const orig = qc.keyMap.get(+btn.dataset.d);
      if (saved && saved.includes(orig)) btn.classList.add("picked");
    });
    qc.optsEl.onclick = e => {
      const btn = e.target.closest(".opt");
      if (!btn) return;
      const orig = qc.keyMap.get(+btn.dataset.d);
      let cur = ss.ans[q.i] || [];
      if (isMulti) {
        cur = cur.includes(orig) ? cur.filter(x => x !== orig) : [...cur, orig];
      } else {
        cur = [orig];
      }
      ss.ans[q.i] = cur.sort();
      saveState();
      $$(".opt", qc.optsEl).forEach(b2 => b2.classList.toggle("picked", (ss.ans[q.i] || []).includes(qc.keyMap.get(+b2.dataset.d))));
      if (!isMulti && pos < qids.length - 1) setTimeout(() => { pos++; ss.pos = pos; saveState(); renderAll(); }, 160);
      else updateGrid();
    };
    qc.footEl.remove();
    v.innerHTML = "";
    v.append(topBar(), qc.card, navBar());
    $("#view").scrollTop = 0;
    updateGrid();
  };
  const topBar = () => {
    const el = document.createElement("div");
    el.className = "exam-top";
    el.innerHTML = `<a class="btn sm ghost" href="#/home">退出</a>
      <span class="chip plain">第 ${pos + 1} / ${qids.length} 题</span>
      ${b.qs[qIndex(qids[pos])].a.length > 1 ? '<span class="chip amber">多选</span>' : '<span class="chip">单选</span>'}
      <span style="flex:1"></span><span class="timer" id="timer"></span>`;
    return el;
  };
  const navBar = () => {
    const el = document.createElement("div");
    el.innerHTML = `<div class="exam-grid" id="grid"></div>
      <div class="exam-nav">
        <button class="btn" id="prevBtn">‹ 上一题</button>
        <button class="btn primary" id="submitBtn">交卷</button>
        <button class="btn" id="nextBtn">下一题 ›</button>
      </div>`;
    return el;
  };
  const updateGrid = () => {
    const g = $("#grid");
    if (!g) return;
    g.innerHTML = qids.map((qid, i) => {
      const done = ss.ans[qid] && ss.ans[qid].length;
      return `<button class="${done ? "done" : ""} ${i === pos ? "cur" : ""}" data-i="${i}">${i + 1}</button>`;
    }).join("");
    g.onclick = e => {
      const btn = e.target.closest("[data-i]");
      if (btn) { pos = +btn.dataset.i; ss.pos = pos; saveState(); renderQ(); }
    };
  };
  const renderAll = () => renderQ();

  $("#view").addEventListener("click", async e => {
    if (e.target.closest("#prevBtn") && pos > 0) { pos--; ss.pos = pos; saveState(); renderQ(); }
    if (e.target.closest("#nextBtn") && pos < qids.length - 1) { pos++; ss.pos = pos; saveState(); renderQ(); }
    if (e.target.closest("#submitBtn")) {
      const unanswered = qids.filter(qid => !ss.ans[qid] || !ss.ans[qid].length).length;
      const msg = unanswered ? `还有 ${unanswered} 题未作答，确定交卷？` : "确定交卷？";
      if (await confirmDialog("交卷", msg, "交卷")) gradeExam(false);
    }
  });

  const tick = () => {
    const t = $("#timer");
    if (!t) return;
    const left = ss.endsAt - Date.now();
    t.textContent = fmtTime(left);
    t.classList.toggle("low", left < 5 * 60000);
    if (left <= 0) { gradeExam(true); return; }
  };
  tick();
  examTimer = setInterval(tick, 1000);
  keyHandler = e => {
    if (e.key === "ArrowLeft" && pos > 0) { pos--; ss.pos = pos; saveState(); renderQ(); }
    if (e.key === "ArrowRight" && pos < qids.length - 1) { pos++; ss.pos = pos; saveState(); renderQ(); }
    const n = "1234".indexOf(e.key), l = "abcd".indexOf(e.key.toLowerCase());
    const d = n >= 0 ? n : l;
    if (d >= 0) {
      const btn = $$(".opt", v)[d];
      if (btn) btn.click();
    }
  };
  renderQ();
}

function gradeExam(auto) {
  const b = bank();
  const ss = S.session;
  clearInterval(examTimer); examTimer = null;
  let score = 0, singleOk = 0, multiOk = 0;
  const wrongQids = [], byChapter = {};
  ss.qids.forEach(qid => {
    const q = b.qs[qIndex(qid)];
    const ans = ss.ans[qid] || [];
    const hasAns = ans.length > 0;
    const ok = hasAns && ans.length === q.a.length && ans.every((x, i) => x === q.a[i]);
    const ch = q.p[0];
    byChapter[ch] ??= { ok: 0, n: 0 };
    byChapter[ch].n++;
    if (ok) {
      score++; byChapter[ch].ok++;
      q.a.length === 1 ? singleOk++ : multiOk++;
      const st = (S.qstats[qid] ??= { s: 0, c: 0, w: 0, l: 0 });
      st.s++; st.c++; st.l = Date.now();
      if (S.wrong[qid]) { S.wrong[qid].n++; if (S.wrong[qid].n >= 2) delete S.wrong[qid]; }
    } else if (hasAns || auto) {
      wrongQids.push(qid);
      if (hasAns) { // 空交卷未作答的题只计错题清单，不污染练习统计
        const st = (S.qstats[qid] ??= { s: 0, c: 0, w: 0, l: 0 });
        st.s++; st.w++; st.l = Date.now();
        S.wrong[qid] = { n: 0, ts: Date.now() };
      }
    }
  });
  const passed = score >= b.rule.pass;
  S.exams.unshift({ ts: Date.now(), score, total: ss.qids.length, passed, singleOk, multiOk, byChapter, wrongQids: wrongQids.slice(0, 60) });
  S.exams = S.exams.slice(0, 30);
  S.session = null;
  saveState();
  examReport({ score, passed, singleOk, multiOk, byChapter, wrongQids, auto });
}

function examReport(r) {
  const v = $("#view");
  const b = bank();
  const rule = b.rule;
  const pct = Math.round((r.score / rule.total) * 100);
  v.innerHTML = `
    <div class="card score-hero">
      <div class="big ${r.passed ? "ok" : "no"}">${r.score} / ${rule.total}</div>
      <div class="sub">${r.passed ? "🎉 恭喜，达到合格线" : `差 ${rule.pass - r.score} 题达到合格线（${rule.pass} 题）`} · 正确率 ${pct}%${r.auto ? " · 已到时自动交卷" : ""}</div>
      <div class="kv" style="justify-content:center;margin-top:14px">
        <div class="item"><span class="k">单选</span><span class="v">${r.singleOk}<small> / ${rule.singles}</small></span></div>
        <div class="item"><span class="k">多选</span><span class="v">${r.multiOk}<small> / ${rule.multiples}</small></span></div>
      </div>
    </div>
    <div class="card"><h2>分章得分</h2><div class="bar-rows">
      ${Object.keys(b.chapters).sort().filter(ch => r.byChapter[ch]).map(ch => {
        const c = r.byChapter[ch];
        return `<div class="bar-row"><span class="nm">第${ch}章 ${esc(b.chapters[ch])}</span><span class="pc">${c.ok}/${c.n}</span>
          <div class="meter"><i style="width:${Math.round((c.ok / c.n) * 100)}%;background:${c.ok / c.n >= .6 ? "var(--accent)" : "var(--red)"}"></i></div></div>`;
      }).join("")}
    </div></div>
    ${r.wrongQids.length ? `<div class="card"><h2>错题回顾（${r.wrongQids.length}）</h2><div class="list">
      ${r.wrongQids.map(qid => {
        const q = b.qs[qIndex(qid)];
        return `<a class="row" href="#/q/${qid}"><div class="grow"><div class="name">${esc(q.q.slice(0, 52))}${q.q.length > 52 ? "…" : ""}</div>
          <div class="sub"><span>${esc(q.j)}</span><span>${esc(q.p)}</span></div></div><span class="arrow">›</span></a>`;
      }).join("")}
      <div class="btn-row" style="margin-top:10px"><a class="btn primary" href="#/drill/practice/wrong">全部加入错题重刷</a></div>
    </div></div>` : ""}
    <div class="btn-row" style="margin-top:16px">
      <button class="btn" id="againExamBtn">再考一场</button>
      <a class="btn ghost" href="#/stats">看统计</a>
    </div>`;
  $("#againExamBtn").onclick = () => viewExam();
}

/* ================= 统计 ================= */
function viewStats() {
  const v = $("#view");
  const b = byId();
  const stVals = Object.values(S.qstats);
  const seen = stVals.length;
  const answered = stVals.reduce((n, s) => n + s.c + s.w, 0);
  const correct = stVals.reduce((n, s) => n + s.c, 0);
  const acc = answered ? Math.round((correct / answered) * 100) : 0;

  const chapters = Object.keys(b.chapters).sort().map(ch => {
    let c = 0, w = 0, total = 0, s = 0;
    b.qs.forEach(q => {
      if (!q.p.startsWith(ch + ".")) return;
      total++;
      const st = S.qstats[q.i];
      if (st) { s++; c += st.c; w += st.w; }
    });
    const an = c + w;
    return { ch, total, s, acc: an ? Math.round((c / an) * 100) : null };
  });

  v.innerHTML = `<h1 class="page-title">学习统计<small>${esc(bank().label)}</small></h1>
    <div class="card"><div class="kv">
      <div class="item"><span class="k">已覆盖</span><span class="v">${seen}<small> / ${b.qs.length} 题（${Math.round((seen / b.qs.length) * 100)}%）</small></span></div>
      <div class="item"><span class="k">累计答题</span><span class="v">${answered}</span></div>
      <div class="item"><span class="k">正确率</span><span class="v">${answered ? acc + "%" : "—"}</span></div>
      <div class="item"><span class="k">错题在册</span><span class="v">${Object.keys(S.wrong).length}</span></div>
    </div></div>
    <div class="card"><h2>分章正确率</h2><div class="bar-rows">
      ${chapters.map(c => `<div class="bar-row"><span class="nm">第${c.ch}章 ${esc(b.chapters[c.ch])}（练过 ${c.s}/${c.total}）</span><span class="pc">${c.acc != null ? c.acc + "%" : "—"}</span>
        <div class="meter"><i style="width:${c.acc ?? 0}%;background:${(c.acc ?? 0) >= 75 ? "var(--accent)" : (c.acc ?? 0) >= 50 ? "var(--amber)" : "var(--red)"}"></i></div></div>`).join("")}
    </div></div>
    <div class="card"><h2>考试历史</h2>
      ${S.exams.length ? `<div class="list">${S.exams.map((e, i) =>
        `<div class="row"><div class="grow"><div class="name">${fmtDate(e.ts)}</div>
          <div class="sub">单选 ${e.singleOk} · 多选 ${e.multiOk}</div></div>
          <span class="chip ${e.passed ? "green" : "red"}">${e.score}/${e.total} ${e.passed ? "合格" : "未过"}</span></div>`).join("")}</div>`
      : `<div class="empty">还没考过模拟考试</div>`}
    </div>
    <div class="card"><h2>数据备份</h2>
      <p style="color:var(--ink-2);font-size:13px;margin:0 0 12px">学习进度存在浏览器本地。换设备/清缓存前请导出备份。</p>
      <div class="btn-row">
        <button class="btn" id="exportBtn">导出全部进度</button>
        <button class="btn" id="importBtn">导入</button>
        <input type="file" id="importFile" accept="application/json" hidden>
        <button class="btn danger" id="resetBtn">清空当前题库进度</button>
      </div>
    </div>`;

  $("#exportBtn").onclick = () => {
    const out = { app: "ham-exam", version: 1, exportedAt: new Date().toISOString(), banks: {} };
    BANK_LIST.forEach(id => {
      try { out.banks[id] = JSON.parse(localStorage.getItem(BKEY(id)) || "null"); } catch { out.banks[id] = null; }
    });
    out.global = JSON.parse(localStorage.getItem(GKEY) || "null");
    const blob = new Blob([JSON.stringify(out)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ham-exam-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  $("#importBtn").onclick = () => $("#importFile").click();
  $("#importFile").onchange = async e => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (data.app !== "ham-exam" || !data.banks) throw new Error("格式不对");
      if (!(await confirmDialog("导入备份", "将覆盖所有题库的本地进度，确定？", "覆盖导入"))) return;
      Object.entries(data.banks).forEach(([id, st]) => st && localStorage.setItem(BKEY(id), JSON.stringify(st)));
      toast("导入完成");
      loadState(); route();
    } catch (err) { toast("导入失败：" + err.message); }
  };
  $("#resetBtn").onclick = async () => {
    if (await confirmDialog("清空进度", `将清空 ${esc(bank().label)}的练习记录、错题本与考试历史。`, "清空")) {
      localStorage.removeItem(BKEY(global.bank));
      loadState(); route();
      toast("已清空");
    }
  };
}

/* ================= 搜索 ================= */
function viewSearch(query) {
  const v = $("#view");
  const b = bank();
  const kw = query.trim().toLowerCase();
  const hits = kw ? b.qs.filter(q =>
    q.q.toLowerCase().includes(kw) || q.o.some(o => o.toLowerCase().includes(kw)) || q.j.toLowerCase().includes(kw)) : [];
  const mark = s => esc(s).replace(new RegExp(`(${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"), "<mark>$1</mark>");
  v.innerHTML = `<h1 class="page-title">搜索<small>${kw ? `${hits.length} 条结果` : "题干 / 选项 / 题号"}</small></h1>
    <div class="search-bar"><input type="search" id="searchInput" placeholder="搜索题目，如：驻波比 / LK0996 / 144" value="${esc(kw)}"></div>
    ${kw && !hits.length ? `<div class="empty">没有匹配的题目</div>` : ""}
    <div class="list">${hits.slice(0, 100).map(q => {
      const st = S.qstats[q.i];
      return `<a class="row" href="#/q/${q.i}">
        <div class="grow"><div class="name">${mark(q.q.slice(0, 80))}${q.q.length > 80 ? "…" : ""}</div>
        <div class="sub"><span>${esc(q.j)}</span><span>${esc(q.p)}</span>${q.a.length > 1 ? "<span>多选</span>" : ""}${st && st.w ? `<span>错过 ${st.w} 次</span>` : ""}</div></div>
        <span class="arrow">›</span></a>`;
    }).join("")}</div>
    ${hits.length > 100 ? `<div class="empty">仅显示前 100 条</div>` : ""}`;
  const input = $("#searchInput");
  input.focus();
  let deb;
  input.oninput = () => {
    clearTimeout(deb);
    deb = setTimeout(() => {
      const val = input.value.trim();
      history.replaceState(null, "", val ? `#/search/${encodeURIComponent(val)}` : "#/search/");
      viewSearch(val);
      $("#searchInput").focus();
    }, 300);
  };
}

/* ================= 启动 ================= */
document.addEventListener("keydown", e => {
  if (e.target.matches("input, textarea") || e.metaKey || e.ctrlKey || e.altKey) return;
  if (keyHandler) { keyHandler(e); if (["Enter", "1", "2", "3", "4"].includes(e.key)) e.preventDefault(); }
});
$("#themeBtn").onclick = cycleTheme;
window.addEventListener("hashchange", route);
applyTheme();
renderBankSwitch();
route();
// 首页搜索入口：Ctrl+K
document.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    location.hash = "#/search/";
    setTimeout(() => $("#searchInput")?.focus(), 60);
  }
});
// PWA Service Worker（http(s) 环境下生效）
if ("serviceWorker" in navigator && /^https?:/.test(location.protocol)) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
