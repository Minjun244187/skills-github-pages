import { BareMuxConnection } from "./baremux/index.js";

const cfg = self.__uv$config;
const base = new URL("./", location.href).pathname; // e.g. /repo/proxy/
const DEFAULT_WISP = "wss://wisp.mercurywork.shop/";

const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { return localStorage.getItem("ember:" + k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem("ember:" + k, v); } catch {} },
};

const QUICK = [
  ["youtube", "https://www.youtube.com", "▶"],
  ["github", "https://github.com", "G"],
  ["discord", "https://discord.com/app", "D"],
  ["x", "https://x.com", "X"],
  ["reddit", "https://www.reddit.com", "R"],
  ["instagram", "https://www.instagram.com", "I"],
  ["wikipedia", "https://en.wikipedia.org", "W"],
  ["spotify", "https://open.spotify.com", "S"],
];

/* ---------------- proxy setup ---------------- */
const status = (msg, err = false) => {
  const s = $("status");
  s.textContent = msg;
  s.classList.toggle("err", err);
};

let ready;
async function setupProxy() {
  if (!("serviceWorker" in navigator)) {
    throw new Error("This browser doesn't support service workers (try Chrome, Edge or Firefox, and not in private mode).");
  }
  if (location.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(location.hostname)) {
    throw new Error("The proxy must be served over HTTPS.");
  }
  const reg = await navigator.serviceWorker.register(base + "uv/sw.js", { scope: cfg.prefix });
  // serviceWorker.ready only resolves for pages inside the scope, so wait on the worker itself
  const sw = reg.installing || reg.waiting || reg.active;
  if (sw && sw.state !== "activated") {
    await new Promise((res) => {
      const check = () => sw.state === "activated" && res();
      sw.addEventListener("statechange", check);
      check();
    });
  }
  await applyTransport();
}

async function applyTransport() {
  const conn = new BareMuxConnection(base + "baremux/worker.js");
  const wisp = store.get("wisp", DEFAULT_WISP);
  await conn.setTransport(new URL(base + "epoxy/index.js", location.href).href, [{ wisp }]);
}

/* ---------------- url helpers ---------------- */
function toUrl(input) {
  input = input.trim();
  if (!input) return null;
  if (/^https?:\/\//i.test(input)) return input;
  if (/^[^\s]+\.[a-z]{2,}(:\d+)?(\/\S*)?$/i.test(input) || /^localhost(:\d+)?/.test(input)) return "https://" + input;
  return store.get("engine", "https://duckduckgo.com/?q=%s").replace("%s", encodeURIComponent(input));
}
const proxied = (url) => cfg.prefix + cfg.encodeUrl(url);
function realUrl(frame) {
  try {
    const href = frame.contentWindow.location.href;
    const i = href.indexOf(cfg.prefix);
    if (i === -1) return null;
    return cfg.decodeUrl(href.slice(i + cfg.prefix.length));
  } catch { return null; }
}

/* ---------------- tabs ---------------- */
const tabs = [];
let active = null;
let uid = 0;

function createTab(url) {
  const tab = { id: ++uid, url: null, title: "New Tab", frame: null, el: null };
  const el = document.createElement("div");
  el.className = "tab";
  el.innerHTML = `<span class="t"></span><button class="x" aria-label="Close tab">×</button>`;
  el.addEventListener("click", (e) => {
    if (e.target.closest(".x")) closeTab(tab); else selectTab(tab);
  });
  el.addEventListener("auxclick", (e) => { if (e.button === 1) closeTab(tab); });
  $("tabs").insertBefore(el, $("newtab"));
  tab.el = el;
  tabs.push(tab);
  selectTab(tab);
  renderTab(tab);
  if (url) navigate(url, tab);
  return tab;
}

function renderTab(tab) {
  tab.el.querySelector(".t").textContent = tab.title || tab.url || "New Tab";
  tab.el.title = tab.title || "";
}

function selectTab(tab) {
  active = tab;
  for (const t of tabs) {
    t.el.classList.toggle("active", t === tab);
    t.frame?.classList.toggle("active", t === tab);
  }
  $("home").classList.toggle("active", !tab.frame);
  $("url").value = tab.url || "";
  tab.el.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function closeTab(tab) {
  const i = tabs.indexOf(tab);
  tabs.splice(i, 1);
  tab.el.remove();
  tab.frame?.remove();
  if (!tabs.length) return createTab();
  if (active === tab) selectTab(tabs[Math.min(i, tabs.length - 1)]);
}

async function navigate(input, tab = active) {
  const url = toUrl(input);
  if (!url) return;
  try {
    await ready;
  } catch (e) {
    status(e.message, true);
    return;
  }
  if (!tab.frame) {
    const f = document.createElement("iframe");
    f.setAttribute("allow", "fullscreen; autoplay; clipboard-read; clipboard-write; encrypted-media; picture-in-picture");
    f.addEventListener("load", () => onFrameLoad(tab));
    $("view").appendChild(f);
    tab.frame = f;
  }
  tab.url = url;
  tab.title = url.replace(/^https?:\/\/(www\.)?/, "");
  renderTab(tab);
  loading(true);
  tab.frame.src = proxied(url);
  if (tab === active) selectTab(tab);
}

function onFrameLoad(tab) {
  if (tab === active) loading(false);
  const url = realUrl(tab.frame);
  if (url) tab.url = url;
  try {
    const doc = tab.frame.contentDocument;
    tab.title = doc?.title || tab.url;
    // open links that target new windows in a new ember tab
    tab.frame.contentWindow.open = (u) => {
      if (u) {
        const abs = new URL(u, tab.url).href;
        const decoded = abs.includes(cfg.prefix) ? cfg.decodeUrl(abs.split(cfg.prefix)[1]) : abs;
        createTab(decoded);
      }
      return null;
    };
  } catch {}
  renderTab(tab);
  if (tab === active && document.activeElement !== $("url")) $("url").value = tab.url || "";
}

// keep the url/title in sync for single-page sites (YouTube, Reddit…)
setInterval(() => {
  if (!active?.frame) return;
  const url = realUrl(active.frame);
  let title;
  try { title = active.frame.contentDocument?.title; } catch {}
  if (url && url !== active.url) {
    active.url = url;
    if (document.activeElement !== $("url")) $("url").value = url;
  }
  if (title && title !== active.title) { active.title = title; renderTab(active); }
}, 1000);

function loading(on) {
  const l = $("loading");
  if (on) { l.classList.remove("on"); void l.offsetWidth; l.classList.add("on"); }
  else { l.classList.remove("on"); }
}

/* ---------------- ui wiring ---------------- */
$("newtab").onclick = () => { createTab(); $("home-search").focus(); };
$("url").addEventListener("keydown", (e) => {
  if (e.key === "Enter") { navigate($("url").value); $("url").blur(); }
});
$("url").addEventListener("focus", () => $("url").select());
$("home-form").addEventListener("submit", (e) => {
  e.preventDefault();
  navigate($("home-search").value);
  $("home-search").value = "";
});
$("back").onclick = () => { try { active.frame?.contentWindow.history.back(); } catch {} };
$("fwd").onclick = () => { try { active.frame?.contentWindow.history.forward(); } catch {} };
$("reload").onclick = () => {
  if (!active.frame) return;
  loading(true);
  try { active.frame.contentWindow.location.reload(); } catch { active.frame.src = proxied(active.url); }
};
$("home-btn").onclick = () => {
  if (!active.frame) return;
  active.frame.remove();
  active.frame = null;
  active.url = null;
  active.title = "New Tab";
  renderTab(active);
  selectTab(active);
};
$("full").onclick = () => {
  const target = active.frame || document.documentElement;
  if (document.fullscreenElement) document.exitFullscreen();
  else (target.requestFullscreen || target.webkitRequestFullscreen)?.call(target);
};

for (const [name, url, icon] of QUICK) {
  const b = document.createElement("button");
  b.className = "q";
  b.innerHTML = `<span class="ic"></span><span></span>`;
  b.children[0].textContent = icon;
  b.children[1].textContent = name;
  b.onclick = () => navigate(url);
  $("quick").appendChild(b);
}

// settings
$("settings-btn").onclick = () => {
  $("s-wisp").value = store.get("wisp", DEFAULT_WISP);
  $("s-engine").value = store.get("engine", "https://duckduckgo.com/?q=%s");
  $("settings").showModal();
};
$("settings").addEventListener("close", async () => {
  if ($("settings").returnValue !== "save") return;
  let wisp = $("s-wisp").value.trim() || DEFAULT_WISP;
  if (!/^wss?:\/\//.test(wisp)) wisp = "wss://" + wisp;
  if (!wisp.endsWith("/")) wisp += "/";
  store.set("wisp", wisp);
  store.set("engine", $("s-engine").value);
  try { await applyTransport(); status("Settings saved."); }
  catch (e) { status("Couldn't switch server: " + e.message, true); }
});

/* ---------------- boot ---------------- */
createTab();
ready = setupProxy();
ready.then(
  () => status(""),
  (e) => status(e.message, true),
);
const q = new URLSearchParams(location.search).get("q");
if (q) navigate(q);
