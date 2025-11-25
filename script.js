/* =========================
   State & helpers
   ========================= */
const KEY = "ma2089_seen";
const THEME_KEY = "ma2089_theme";
const BOOT_KEY = "ma2089_booted";
const fragments = ["fragment-1", "fragment-2", "fragment-3", "fragment-4"];

function getSeen() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch (e) {
    return {};
  }
}
function setSeen(id) {
  const s = getSeen();
  if (!s[id]) {
    s[id] = true;
    localStorage.setItem(KEY, JSON.stringify(s));
  }
  updateUI();
}
function countSeen() {
  const s = getSeen();
  return fragments.filter((f) => s[f]).length;
}
function resetProgress() {
  localStorage.removeItem(KEY);
  updateUI();
  show("hub");
}

/* =========================
   Navigation: show/hide sections
   ========================= */
function show(id) {
  document
    .querySelectorAll(".section")
    .forEach((sec) => sec.classList.remove("active"));
  const sec = document.getElementById(id);
  if (sec) sec.classList.add("active");

  if (fragments.includes(id)) setSeen(id);
  if (id === "finale") initFinale();

  history.replaceState(null, "", "#" + id);
  // non-animated immediate top jump (avoid smooth)
  window.scrollTo({ top: 0, behavior: "auto" });

  handleParallaxFor(id);
  handleHScrollFor(id);
}
function openFrag(id) {
  show(id);
}

/* =========================
   progression, badges, glitch control
   ========================= */
function updateUI() {
  const n = countSeen();
  const total = fragments.length;

  // progress bar
  const bar = document.getElementById("progressBar");
  if (bar) bar.style.width = (n / total) * 100 + "%";

  // badges
  fragments.forEach((id) => {
    const b = document.getElementById("badge-" + id);
    if (!b) return;
    const seen = !!getSeen()[id];
    b.textContent = seen ? "débloquée" : "verrouillée";
    b.className = "badge " + (seen ? "ok" : "lock");
  });

  // finale button
  const btn = document.getElementById("btnFinale");
  if (btn) {
    const ready = n >= total;
    btn.disabled = !ready;
    btn.textContent = ready
      ? "Débloquer la mémoire"
      : `Mémoire finale (bloquée ${n}/${total})`;
    if (ready) btn.classList.add("btn");
    else btn.classList.remove("btn");
  }

  // glitch intensity (1..0)
  const intensity = Math.max(0, Math.min(1, 1 - n / total));
  const speedMs = Math.round(200 + 1800 * (1 - intensity));
  document.documentElement.style.setProperty("--glitch", intensity.toFixed(2));
  document.documentElement.style.setProperty("--glitch-speed", speedMs + "ms");

  const fx = document.getElementById("glitchFx");
  if (fx) fx.style.opacity = intensity < 0.05 ? "0.05" : "";
}

/* =========================
   Finale handler
   ========================= */
let finaleInit = false;
function initFinale() {
  if (finaleInit) return;
  finaleInit = true;
  const folder = document.getElementById("folder");
  const black = document.getElementById("black");
  const br3 = document.getElementById("br3");
  const openBtn = document.getElementById("open");

  // show folder after short delay (simulate)
  folder.style.opacity = 1;

  if (openBtn) {
    openBtn.onclick = () => {
      black.style.opacity = 1;
      setTimeout(() => {
        br3.style.opacity = 1;
      }, 900);
    };
  }
}

/* =========================
   Theme switcher
   ========================= */
(function themeInit() {
  const btn = document.getElementById("themeBtn");
  if (!btn) return;
  const saved = localStorage.getItem(THEME_KEY) || "br";
  applyTheme(saved);
  btn.addEventListener("click", () => {
    const curr = document.documentElement.getAttribute("data-theme") || "br";
    applyTheme(curr === "br" ? "cp" : "br");
  });
  // test boot button
  const bt = document.getElementById("bootTestBtn");
  bt && bt.addEventListener("click", () => startBoot());
})();
function applyTheme(t) {
  document.documentElement.setAttribute("data-theme", t);
  localStorage.setItem(THEME_KEY, t);
  const btn = document.getElementById("themeBtn");
  if (btn) btn.textContent = "Palette: " + (t === "cp" ? "CP2077" : "BR2049");
}

/* =========================
   Parallax camera (fragments 2-4)
   ========================= */
let pActiveRoot = null,
  pRaf = null,
  pPointer = { x: 0, y: 0 },
  pTarget = { x: 0, y: 0 };
function handleParallaxFor(id) {
  const enable = ["fragment-2", "fragment-3", "fragment-4"].includes(id);
  if (!enable) {
    disableParallax();
    return;
  }
  pActiveRoot =
    document.querySelector("#" + id + " [data-parallax]") ||
    document.querySelector("#" + id + " main[data-parallax]") ||
    document.querySelector("#" + id + " .stage[data-parallax]") ||
    document.getElementById(id);
  if (!pActiveRoot) {
    disableParallax();
    return;
  }
  pPointer.x = pPointer.y = pTarget.x = pTarget.y = 0;
  window.addEventListener("mousemove", pOnMouseMove, { passive: true });
  setupGyro();
  pTick();
}
function pOnMouseMove(e) {
  const cx = window.innerWidth * 0.5,
    cy = window.innerHeight * 0.5;
  pTarget.x = (e.clientX - cx) / cx;
  pTarget.y = (e.clientY - cy) / cy;
}
function setupGyro() {
  const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  if (!isTouch) return;
  const handler = (ev) => {
    const beta = ev.beta || 0,
      gamma = ev.gamma || 0;
    pTarget.x = Math.max(-1, Math.min(1, gamma / 45));
    pTarget.y = Math.max(-1, Math.min(1, -beta / 45));
  };
  if (
    typeof DeviceOrientationEvent !== "undefined" &&
    typeof DeviceOrientationEvent.requestPermission === "function"
  ) {
    const ask = () => {
      DeviceOrientationEvent.requestPermission()
        .then((state) => {
          if (state === "granted") {
            window.addEventListener("deviceorientation", handler, {
              passive: true,
            });
          }
        })
        .catch(() => {});
    };
    window.addEventListener("click", ask, { once: true });
    window.addEventListener("touchstart", ask, { once: true });
  } else if (window.DeviceOrientationEvent) {
    window.addEventListener("deviceorientation", handler, { passive: true });
  }
}
function pTick() {
  if (!pActiveRoot) return;
  const ease = 0.08;
  pPointer.x += (pTarget.x - pPointer.x) * ease;
  pPointer.y += (pTarget.y - pPointer.y) * ease;
  const layers = pActiveRoot.querySelectorAll("[data-depth]");
  layers.forEach((el) => {
    const d = parseFloat(el.getAttribute("data-depth")) || 0;
    const amp = 20;
    const tx = -pPointer.x * d * amp;
    const ty = -pPointer.y * d * amp;
    el.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
  });
  pRaf = requestAnimationFrame(pTick);
}
function disableParallax() {
  cancelAnimationFrame(pRaf);
  pRaf = null;
  window.removeEventListener("mousemove", pOnMouseMove);
  if (pActiveRoot) {
    pActiveRoot
      .querySelectorAll("[data-depth]")
      .forEach((el) => (el.style.transform = "translate3d(0,0,0)"));
  }
  pActiveRoot = null;
}

/* =========================
   H-scroll layered scrollytelling (fragment 1)
   ========================= */
let hCleanup = null;
function handleHScrollFor(id) {
  if (id === "fragment-1" && window.innerWidth > 640) {
    hCleanup && hCleanup();
    hCleanup = initLayeredHScroll("hscroll-frag1", "hlayers-frag1");
  } else {
    hCleanup && hCleanup();
    hCleanup = null;
  }
}
function initLayeredHScroll(sectionId, layersRootId) {
  const section = document.getElementById(sectionId);
  const root = document.getElementById(layersRootId);
  if (!section || !root) return;
  const layers = Array.from(root.querySelectorAll(".layer"));
  let secH = 0;
  let maxWidths = [];
  function measure() {
    const vh = window.innerHeight,
      vw = window.innerWidth;
    maxWidths = layers.map((l) => {
      const img = l.querySelector("img");
      const vid = l.querySelector("video");
      const h = Math.max(1, vh - 64);
      let natW = 0,
        natH = 0;
      if (img && img.naturalWidth) {
        natW = img.naturalWidth;
        natH = img.naturalHeight;
      }
      if (vid && (vid.videoWidth || vid.videoHeight)) {
        natW = vid.videoWidth || natW;
        natH = vid.videoHeight || natH;
      }
      const w = natH ? natW * (h / natH) : vw;
      return Math.max(0, w - vw);
    });
    const maxX = Math.max(...maxWidths, 0);
    secH = window.innerHeight + maxX;
    section.style.height = secH + "px";
  }
  function onScroll() {
    const rect = section.getBoundingClientRect();
    const start = rect.top;
    const end = rect.bottom - window.innerHeight;
    const total = end - start || 1;
    const prog = Math.min(1, Math.max(0, (0 - start) / total));
    layers.forEach((l, i) => {
      const depth = parseFloat(l.getAttribute("data-depthx")) || 0.5;
      const maxX = maxWidths[i] || 0;
      const tx = -maxX * prog * depth;
      l.style.transform = `translate3d(${tx}px,0,0)`;
    });
  }
  const onResize = () => {
    measure();
    onScroll();
  };
  measure();
  onScroll();
  window.addEventListener("resize", onResize);
  window.addEventListener("scroll", onScroll);
  return () => {
    window.removeEventListener("resize", onResize);
    window.removeEventListener("scroll", onScroll);
    section.style.height = "";
    layers.forEach((l) => (l.style.transform = ""));
  };
}

/* =========================
   Magnetic text (hover follow)
   ========================= */
(function initMagnet() {
  function attachMagnet(el) {
    const span = el.querySelector(".magnet");
    if (!span) return;
    const AMP_DESKTOP = 10;
    const AMP_MOBILE = 4;
    const amp = window.innerWidth < 600 ? AMP_MOBILE : AMP_DESKTOP;
    function onMove(e) {
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      span.style.transform = `translate3d(${x * amp}px, ${y * amp}px, 0)`;
    }
    function onLeave() {
      span.style.transform = "translate3d(0,0,0)";
    }
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
  }
  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".gtext").forEach(attachMagnet);
  });
})();

/* =========================
   Boot 
   ========================= */
let bootRan = false;
const bootLines = [
  "> INITIALIZING MEMORY ARCHIVE // 2089",
  "> Handshake: LAX_NODE_2049 ........ OK",
  "> Mounting neural clusters ........ OK",
  "> Checksum /integrity ............. 99.4%",
  "> Decrypting fragments [4] ........",
];
const bootEngines = [
  ["neural-mapper", "OK"],
  ["mem-cache", "OK"],
  ["dns/retrofit", "WAIT"],
  ["cold-storage", "OK"],
  ["audit-trail", "OK"],
  ["anonymizer", "OK"],
  ["rtc-link", "OK"],
];

function startBoot() {
  document
    .querySelectorAll(".section")
    .forEach((s) => s.classList.remove("active"));
  document.getElementById("boot").classList.add("active");
  window.scrollTo({ top: 0, behavior: "auto" });
  bootRan = true;
  // reset UI
  const term = document.getElementById("bootTerminal");
  term.innerHTML = "";
  document.getElementById("bootLog").textContent = "";
  document.getElementById("bootPct").textContent = "0";
  document.getElementById("bootGauge").style.width = "0%";
  document.getElementById("bootProgress").style.width = "0%";
  document.getElementById("bootPress").hidden = true;
  // bars
  const bars = document.getElementById("bootBars");
  bars.innerHTML = "";
  for (let i = 0; i < 48; i++) {
    const s = document.createElement("span");
    if (Math.random() > 0.4) s.classList.add("on");
    bars.appendChild(s);
  }
  // engines
  const ul = document.getElementById("bootList");
  ul.innerHTML = "";
  bootEngines.forEach(([name, status]) => {
    const li = document.createElement("li");
    const s = document.createElement("span");
    s.textContent = name;
    const v = document.createElement("span");
    v.textContent = status;
    v.className = status === "OK" ? "ok" : status === "WAIT" ? "wait" : "err";
    li.append(s, v);
    ul.appendChild(li);
  });

  bootRun();
}

function typeTerminal(lines, onDone) {
  const term = document.getElementById("bootTerminal");
  let iLine = 0;
  function typeLine() {
    if (iLine >= lines.length) {
      onDone && onDone();
      return;
    }
    const text = lines[iLine++];
    let iChar = 0;
    const row = document.createElement("div");
    term.appendChild(row);
    function step() {
      row.textContent = text.slice(0, iChar++);
      if (iChar <= text.length) {
        setTimeout(step, 12 + Math.random() * 18);
      } else {
        setTimeout(typeLine, 180);
      }
    }
    step();
  }
  typeLine();
}

function bootRun() {
  typeTerminal(bootLines, () => {
    const log = document.getElementById("bootLog");
    const pct = document.getElementById("bootPct");
    const gauge = document.getElementById("bootGauge");
    const pbar = document.getElementById("bootProgress");
    const bars = Array.from(document.querySelectorAll("#bootBars span"));
    let p = 0;
    const timer = setInterval(() => {
      p = Math.min(100, (p + (Math.random() * 8 + 2)) | 0);
      pct.textContent = p;
      gauge.style.width = p + "%";
      pbar.style.width = p + "%";
      const count = Math.round((bars.length * p) / 100);
      for (let i = 0; i < count; i++) bars[i].classList.add("on");
      const msgs = [
        "… decrypting block " + (((Math.random() * 9000) | 0) + 1000),
        "… routing packets",
        "… rebuilding index",
        "… verifying signatures",
        "… clustering memories",
      ];
      if (Math.random() > 0.5) {
        log.textContent += msgs[(Math.random() * msgs.length) | 0] + "\n";
        log.scrollTop = log.scrollHeight;
      }
      if (p >= 100) {
        clearInterval(timer);
        setTimeout(() => {
          document.getElementById("bootPress").hidden = false;
          const finish = () => {
            document.removeEventListener("keydown", finish);
            document.removeEventListener("click", finish);
            localStorage.setItem(BOOT_KEY, "1");
            show("hub");
          };
          document.addEventListener("keydown", finish, { once: true });
          document.addEventListener("click", finish, { once: true });
        }, 600);
      }
    }, 120);
  });
}

/* =========================
   Boot bypass if already run
   ========================= */
document.addEventListener("DOMContentLoaded", () => {
  const already = localStorage.getItem(BOOT_KEY) === "1";
  if (already) {
    // keep home active; button still starts boot if you want to replay
  }
});

/* =========================
   Magnetic text re-init if new content
   ========================= */
function reInitMagnet() {
  document.querySelectorAll(".gtext").forEach((el) => {
    const span = el.querySelector(".magnet");
    if (!span) return;
    span.style.transform = "translate3d(0,0,0)";
  });
}

/* =========================
   Boot & UI init
   ========================= */
/* ===== INTRO: plein écran + transition propre vers HOME ===== */
const INTRO_LINES = [
  { t: "[SYSTEM] Initializing context brief…", cls: "sys" },
  {
    t: "Los Angeles, 2049. Les mégastructures étouffent le ciel. La pluie dissout les néons.",
    cls: "",
  },
  {
    t: "La frontière entre humains et <replicants> s’estompe. Mémoire = marchandise.",
    cls: "",
  },
  {
    t: "Vous êtes lié au projet <NEXUS_10>. Les fragments trouvés sont cryptés.",
    cls: "",
  },
  {
    t: "Votre objectif : <span class='hl'>réassembler la mémoire</span> en parcourant l’archive.",
    cls: "",
  },
  {
    t: "Rappel : certains souvenirs mentent mieux que la vérité.",
    cls: "warn",
  },
  { t: "Chargement du shell d’accès…", cls: "sys" },
];

function showIntro() {
  const intro = document.getElementById("intro");
  const term = document.getElementById("introTerm");
  const help = document.getElementById("introHelp");
  if (!intro || !term) return;

  // cache tout le reste du site
  document
    .querySelectorAll(".section")
    .forEach((s) => s.classList.remove("active"));
  intro.classList.add("active");

  term.innerHTML = "";
  help.hidden = true;

  let i = 0;
  function typeLine() {
    if (i >= INTRO_LINES.length) {
      help.hidden = false;
      bindIntroContinue();
      return;
    }
    const { t, cls } = INTRO_LINES[i++];
    const line = document.createElement("div");
    line.className = `intro-line ${cls || ""}`;
    term.appendChild(line);

    let j = 0;
    function step() {
      line.innerHTML = t.slice(0, j++) + `<span class="cursor"></span>`;
      if (j <= t.length) {
        setTimeout(step, 12 + Math.random() * 16);
      } else {
        line.innerHTML = t;
        setTimeout(typeLine, 150);
      }
    }
    step();
  }
  typeLine();
}

function bindIntroContinue() {
  const intro = document.getElementById("intro");
  const btn = document.getElementById("introContinue");
  const trans = document.getElementById("introTransition");
  const flash = trans.querySelector(".white-flash");

  const proceed = () => {
    document.removeEventListener("keydown", proceed);
    document.removeEventListener("click", proceed);
    btn && btn.removeEventListener("click", proceed);

    // Glitch intensif + fondu
    intro.classList.add("leaving");
    trans.classList.add("run");

    // petit bruit audio (facultatif)
    const audio = new Audio("sounds/glitch-burst.mp3");
    audio.volume = 0.25;
    audio.play().catch(() => {});

    // durée de la séquence = 1.2s environ
    setTimeout(() => {
      intro.classList.remove("active");
      trans.classList.remove("run");
      show("home");
    }, 1200);
  };

  btn && btn.addEventListener("click", proceed, { once: true });
  setTimeout(() => {
    document.addEventListener("keydown", proceed, { once: true });
    document.addEventListener("click", proceed, { once: true });
  }, 0);
}

/* ===== Initialisation : toujours afficher l’intro avant HOME ===== */
window.addEventListener("DOMContentLoaded", () => {
  showIntro(); // toujours au lancement
});

function flash() {
  const flash = document.createElement("div");
  flash.style.position = "fixed";
  flash.style.inset = "0";
  flash.style.background = "#00ffff33";
  flash.style.backdropFilter = "blur(10px)";
  flash.style.zIndex = "9999";
  flash.style.pointerEvents = "none";
  flash.style.opacity = "1";
  document.body.append(flash);
  setTimeout(() => (flash.style.transition = "opacity .5s ease"));
  setTimeout(() => (flash.style.opacity = "0"), 10);
  setTimeout(() => flash.remove(), 600);
}

window.addEventListener(
  "click",
  () => {
    const a = document.getElementById("ambience");
    a.muted = false;
    a.volume = 0.1;
  },
  { once: true }
);

const text = document.querySelectorAll(".overlay, .hoverlay");
text.forEach((el) => {
  el.style.opacity = "0";
  setTimeout(() => (el.style.transition = "opacity 1s ease"), 100);
  setTimeout(() => (el.style.opacity = "1"), 800);
});

// Déverrouillage audio sur 1er clic + toggle son
(function () {
  const vid = document.getElementById("homeVid");
  const btn = document.getElementById("homeSound");
  if (!vid || !btn) return;

  // iOS/Android : besoin d'un geste utilisateur pour activer le son
  const unlock = () => {
    if (vid.muted === true) {

      vid.play().catch(() => {
        /* silencieux */
      });
    }
    document.removeEventListener("click", unlock);
    document.removeEventListener("touchstart", unlock);
  };
  document.addEventListener("click", unlock, { once: true });
  document.addEventListener("touchstart", unlock, { once: true });

  // Toggle son
  btn.addEventListener("click", () => {
    // pour pouvoir démuter, la vidéo doit déjà être en lecture
    vid.play().catch(() => {});
    vid.muted = !vid.muted;
    btn.textContent = "Son : " + (vid.muted ? "OFF" : "ON");
    // volume très bas pour ambiance
    vid.volume = vid.muted ? 0 : 0.12;
  });

  // Si “économie de données” activée, on bascule sur l’image poster
  const conn =
    navigator.connection ||
    navigator.webkitConnection ||
    navigator.mozConnection;
  if (conn && conn.saveData) {
    vid.parentElement.classList.add("save-data");
    vid.removeAttribute("autoplay");
    vid.pause();
  }
})();

/* Tilt 3D subtil + glare qui suit la souris sur la carte home */
(function () {
  const card = document.getElementById("homeCard");
  if (!card) return;

  const maxTilt = 6; // degrés
  const ease = 0.12;
  let rx = 0,
    ry = 0,
    tx = 0,
    ty = 0; // rotation courante vs cible

  function onMove(e) {
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width; // 0..1
    const y = (e.clientY - r.top) / r.height; // 0..1
    tx = (0.5 - y) * maxTilt; // rotation X
    ty = (x - 0.5) * maxTilt; // rotation Y
    // glare
    card.style.setProperty("--gx", x * 100 + "%");
    card.style.setProperty("--gy", y * 100 + "%");
  }
  function onLeave() {
    tx = 0;
    ty = 0;
  }
  function tick() {
    rx += (tx - rx) * ease;
    ry += (ty - ry) * ease;
    card.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg)`;
    requestAnimationFrame(tick);
  }
  tick();

  card.addEventListener("mousemove", onMove);
  card.addEventListener("mouseleave", onLeave);
})();

/* =========================================================
   HUB TERMINAL — vivant + reset + réalisme
   ========================================================= */
(function () {
  let hubMounted = false;
  let focusIndex = 0;

  // utilitaires “ambiance”
  const hexChars = "0123456789abcdef";
  const symb = "{}[]()<>!?/\\|*#%$+=-_;:,.^~";
  const rand = (n, s) =>
    Array.from({ length: n }, () => s[(Math.random() * s.length) | 0]).join("");
  const hex = (n) =>
    Array.from({ length: n }, () => hexChars[(Math.random() * 16) | 0]).join(
      ""
    );
  const ts = () => {
    const d = new Date();
    const pad = (x) => String(x).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
      d.getDate()
    )} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };
  const ip = () =>
    `10.${(Math.random() * 255) | 0}.${(Math.random() * 255) | 0}.${
      (Math.random() * 255) | 0
    }`;
  const junkRow = () =>
    `0x${hex(5)}  ${rand(6, symb)}${rand(8, symb)}  0x${hex(5)}  ${rand(
      10,
      symb
    )}${rand(8, symb)}`;

  // moteur de frappe + bip
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  let audioCtx = null;
  function blip(freq = 240, dur = 0.02) {
    try {
      if (!audioCtx)
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = "square";
      o.frequency.value = freq;
      g.gain.value = 0.035;
      o.connect(g);
      g.connect(audioCtx.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
      o.stop(audioCtx.currentTime + dur + 0.005);
    } catch (_) {}
  }
  async function typeOut(container, lines, charDelay = 12, lineDelay = 22) {
    container.innerHTML = "";
    for (const L of lines) {
      const ln = document.createElement("div");
      ln.className = `line ${L.cls || "crt-line"} typing`;
      const span = document.createElement("span");
      const cursor = document.createElement("span");
      cursor.className = "cursor";
      ln.append(span, cursor);
      container.appendChild(ln);
      for (let c = 0; c <= L.t.length; c++) {
        span.textContent = L.t.slice(0, c);
        if (L.t.trim()) blip(220 + ((Math.random() * 200) | 0), 0.01);
        await wait(charDelay + ((Math.random() * 6) | 0));
      }
      ln.classList.remove("typing");
      if (L.after) L.after(ln); // hook après écriture (pour data-*)
      await wait(lineDelay);
    }
  }

  // construit des lignes réalistes + fragments + commandes
  function buildHubLines() {
    const seen = getSeen();
    const count = fragments.reduce((n, id) => n + (seen[id] ? 1 : 0), 0);
    const pct = Math.round((count / fragments.length) * 100);

    const header = [
      { t: `:: LADD COMPANY // MEM_ARCHIVE`, cls: "crt-comment" },
      {
        t: `:: NODE: LAX-2049   SESSION: ${ts()}   USER: GUEST   ACCESS: READ_ONLY`,
        cls: "crt-comment",
      },
      { t: `:: NET: ${ip()}   HASH:${hex(8)}-${hex(8)}`, cls: "crt-kv" },
      { t: " ", cls: "crt-line" },
    ];

    const preJunk = Array.from({ length: 3 }, () => ({
      t: junkRow(),
      cls: "crt-line",
    }));

    const index = [
      { t: `> DIR /ARCHIVES/FRAGMENTS`, cls: "crt-dir" },
      { t: `  - SYSLOG_2087.ERR`, cls: "crt-file" },
      { t: `  - GRIDMAP_LA.bin`, cls: "crt-file" },
    ];

    // fragments cliquables (jaunes si verrouillés, cyan si vus)
    const fragLine = (id, label) => ({
      t: `  - ${label}.DAT    [${seen[id] ? "OK" : "LOCKED"}]`,
      cls: `crt-frag ${seen[id] ? "unlocked" : ""}`,
      frag: id,
      after: (ln) => ln.setAttribute("data-frag", id),
    });

    const frags = [
      fragLine("fragment-1", "FRAGMENT_01"),
      fragLine("fragment-2", "FRAGMENT_02"),
      fragLine("fragment-3", "FRAGMENT_03"),
      fragLine("fragment-4", "FRAGMENT_04"),
    ];

    const midJunk = Array.from({ length: 4 }, () => ({
      t: junkRow(),
      cls: "crt-line",
    }));

    const status = [
      { t: `> STATUS`, cls: "crt-dir" },
      {
        t: `  MEM_RESTORED = ${count}/${fragments.length}  (${pct}%)`,
        cls: "crt-kv",
      },
      { t: `  POLICY = READ_ONLY`, cls: "crt-kv" },
      {
        t: `  WARN = ${pct < 100 ? "INCOMPLETE_MEMORY" : "NONE"}`,
        cls: pct < 100 ? "crt-warn" : "crt-ok",
      },
      { t: " ", cls: "crt-line" },
    ];

    const commands = [
      { t: `> COMMANDS`, cls: "crt-dir" },
      {
        t: `  [ENTER] OPEN_SELECTED  •  [↑/↓] NAV  •  [H] HOME`,
        cls: "crt-kv",
      },
      { t: `  [R] `, cls: "crt-kv" }, // la suite “RESET_MEMORY”
      { t: `RESET_MEMORY`, cls: "crt-cmd reset crt-reset" },
      { t: " ", cls: "crt-line" },
    ];

    const postJunk = Array.from({ length: 5 }, () => ({
      t: junkRow(),
      cls: "crt-line",
    }));
    const footer = [
      {
        t: "HINT: ↑/↓ pour naviguer • Entrée pour ouvrir • R pour réinitialiser • H pour accueil",
        cls: "crt-help",
      },
    ];

    return [
      ...header,
      ...preJunk,
      ...index,
      ...frags,
      ...midJunk,
      ...status,
      ...commands,
      ...postJunk,
      ...footer,
    ];
  }

  async function mountHub() {
    const wrap = document.querySelector("#hub .crt-wrap");
    const output = document.getElementById("crtOutput");
    const viewport = document.getElementById("crtViewport");
    if (!wrap || !output || !viewport) return;

    hubMounted = true;
    focusIndex = 0;

    const lines = buildHubLines();
    await typeOut(output, lines);

    // Post-processing: badges LOCK/OK
    const frags = [...output.querySelectorAll(".crt-frag")];
    frags.forEach((el, idx) => {
      const txt = el.textContent;
      el.innerHTML = txt.replace(
        /\[(LOCKED|OK)\]/,
        (_, m) =>
          `<span class="crt-badge ${m === "OK" ? "ok" : "lock"}">${m}</span>`
      );
      el.dataset.index = idx;
      el.addEventListener("click", () => {
        const id = el.dataset.frag;
        blip(el.classList.contains("unlocked") ? 540 : 160, 0.03);
        if (id) openFrag(id);
      });
    });

    // commande reset (bouton + raccourci)
    const resetBtn = output.querySelector(".crt-reset");
    if (resetBtn) {
      resetBtn.addEventListener("click", doReset);
    }

    function doReset() {
      blip(120, 0.06);
      const ok = confirm(
        "Réinitialiser la mémoire (progression des fragments) ?"
      );
      if (!ok) return;
      // reset progression
      resetProgress();
      // remonter & relancer l’index “propre”
      output.innerHTML = "";
      mountHub();
    }

    // focus visuel & nav clavier
    function setFocus(i) {
      frags.forEach((f) => f.classList.remove("focus"));
      frags[i]?.classList.add("focus");
    }
    setFocus(focusIndex);

    viewport.addEventListener("keydown", (e) => {
      if (!hubMounted) return;
      const k = e.key.toLowerCase();
      if (k === "arrowdown") {
        focusIndex = (focusIndex + 1) % frags.length;
        setFocus(focusIndex);
        blip(320, 0.02);
        e.preventDefault();
      } else if (k === "arrowup") {
        focusIndex = (focusIndex - 1 + frags.length) % frags.length;
        setFocus(focusIndex);
        blip(300, 0.02);
        e.preventDefault();
      } else if (k === "enter") {
        frags[focusIndex]?.click();
        e.preventDefault();
      } else if (k === "h") {
        show("home");
        e.preventDefault();
      } else if (k === "r") {
        doReset();
        e.preventDefault();
      }
    });
    viewport.focus({ preventScroll: true });

    // petits glitches réguliers
    startGlitches(wrap);
  }

  function startGlitches(wrap) {
    setInterval(() => {
      if (!hubMounted) return;
      wrap.classList.add("pulse");
      setTimeout(() => wrap.classList.remove("pulse"), 480);
    }, 2800 + ((Math.random() * 2200) | 0));

    setInterval(() => {
      if (!hubMounted) return;
      wrap.classList.add("glitchy");
      setTimeout(() => wrap.classList.remove("glitchy"), 140);
    }, 1600 + ((Math.random() * 1600) | 0));
  }

  // hook dans nav
  const _show = show;
  window.show = function (id) {
    _show(id);
    if (id === "hub") {
      const output = document.getElementById("crtOutput");
      if (output) output.innerHTML = "";
      mountHub();
    } else {
      hubMounted = false;
    }
  };

  if ((location.hash || "") === "#hub") {
    mountHub();
  }
})();

const preJunk = Array.from({ length: 5 }, () => ({
  t: junkRow(),
  cls: "crt-line",
}));
const midJunk = Array.from({ length: 8 }, () => ({
  t: junkRow(),
  cls: "crt-line",
}));
const postJunk = Array.from({ length: 10 }, () => ({
  t: junkRow(),
  cls: "crt-line",
}));

// ====== Son terminal (toggle global) ======
window.TERM_SOUND = true;
window.setTermSound = function (on) {
  window.TERM_SOUND = !!on;
  const btn = document.getElementById("crtSoundBtn");
  if (btn) btn.textContent = "SOUND: " + (window.TERM_SOUND ? "ON" : "OFF");
};

function blip(freq = 240, dur = 0.02) {
  if (!window.TERM_SOUND) return; // <<— coupe le son si OFF
  try {
    if (!audioCtx)
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const o = audioCtx.createOscillator(),
      g = audioCtx.createGain();
    o.type = "square";
    o.frequency.value = freq;
    g.gain.value = 0.035;
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
    o.stop(audioCtx.currentTime + dur + 0.005);
  } catch (_) {}
}

function doReset() {
  blip(120, 0.06);
  const ok = confirm("Réinitialiser la mémoire (progression des fragments) ?");
  if (!ok) return;

  try {
    localStorage.removeItem(KEY);
  } catch (_) {}
  updateUI();

  output.innerHTML = "";
  mountHub();
}

const wrap = document.querySelector("#hub .crt-wrap");
const output = document.getElementById("crtOutput");
const viewport = document.getElementById("crtViewport");

// Bouton son
let sbtn = document.getElementById("crtSoundBtn");
if (!sbtn) {
  sbtn = document.createElement("button");
  sbtn.id = "crtSoundBtn";
  sbtn.type = "button";
  sbtn.className = "crt-sound-btn";
  sbtn.textContent = "SOUND: " + (window.TERM_SOUND ? "ON" : "OFF");
  wrap.appendChild(sbtn);
  sbtn.addEventListener("click", () => {
    setTermSound(!window.TERM_SOUND);
    blip(300, 0.03);
  });
} else if (k === "m") {
  setTermSound(!window.TERM_SOUND);
  blip(280, 0.02);
  e.preventDefault();
}
