const KEY = "ma2089_seen";
const THEME_KEY = "ma2089_theme";
const BOOT_KEY = "ma2089_booted";
const fragments = ["fragment-1", "fragment-2", "fragment-3"];

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
function allFragmentsSeen() {
  return countSeen() >= fragments.length;
}
function resetProgress() {
  localStorage.removeItem(KEY);
  updateUI();
  resetFinaleState();
  show("hub");
}

const FRAG3_WARNING_DELAY = 15000;
const FRAG3_BLACKOUT_DELAY = 8000;
let frag3WarningTimer = null;
let frag3BlackoutTimer = null;
let frag3WarningAudio = null;
let frag3WarningVoice = null;
let frag3WarningSiren = null;
let finaleTriggered = false;

/* =========================
   Navigation: show/hide sections
   ========================= */
function show(id) {
  if (window.M_NARR) window.M_NARR.stop();

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

  if (id === "hub") {
    // Narration : après l’affichage du HUB
    if (window.M_NARR)
      setTimeout(
        () => window.M_NARR.sequence("hub_intro", { speed: 38, gap: 1200 }),
        800
      );
  } else if (window.M_NARR && id === "fragment-1") {
    window.M_NARR.sequence("before_frag1", { speed: 38, gap: 1100 });
  } else if (window.M_NARR && id === "fragment-2") {
    window.M_NARR.sequence("frag2_open", { speed: 36, gap: 1000 });
  } else if (window.M_NARR && id === "fragment-3") {
    window.M_NARR.sequence("frag3_open", { speed: 40, gap: 1200 });
  } else if (window.M_NARR && id === "finale") {
    window.M_NARR.sequence("final", { speed: 40, gap: 1200 });
  }

  if (id === "fragment-3") startFrag3FinaleCountdown();
  else cancelFrag3FinaleCountdown();
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

function startFrag3FinaleCountdown() {
  if (finaleTriggered) return;
  if (!allFragmentsSeen()) return;
  cancelFrag3FinaleCountdown();
  frag3WarningTimer = setTimeout(() => {
    showFinalWarningOverlay();
    frag3BlackoutTimer = setTimeout(() => {
      launchBlackoutAndTrailer();
    }, FRAG3_BLACKOUT_DELAY);
  }, FRAG3_WARNING_DELAY);
}

function cancelFrag3FinaleCountdown() {
  if (finaleTriggered) return;
  if (frag3WarningTimer) {
    clearTimeout(frag3WarningTimer);
    frag3WarningTimer = null;
  }
  if (frag3BlackoutTimer) {
    clearTimeout(frag3BlackoutTimer);
    frag3BlackoutTimer = null;
  }
  stopFinalWarningOverlay();
}

function showFinalWarningOverlay() {
  const overlay = document.getElementById("markOverlay");
  if (!overlay) return;
  const title = overlay.querySelector(".mark-title");
  const main = overlay.querySelector(".mark-main");
  const sub = overlay.querySelector(".mark-sub");
  if (title) title.textContent = "SYSTEM ALERT";
  if (main) main.textContent = "WARNING";
  if (sub)
    sub.textContent = "Intrusion détectée. Connexion compromise dans 00:08.";
  overlay.hidden = false;
  overlay.classList.add("show");
  const beep =
    document.getElementById("alertSfx") || document.getElementById("warnSfx");
  const voice = document.getElementById("warningVoice");
  const siren = document.getElementById("warningSiren");
  if (beep) {
    try {
      beep.loop = true;
      beep.currentTime = 0;
      beep.volume = 0.65;
      beep.play().catch(() => {});
      frag3WarningAudio = beep;
    } catch (_) {}
  }
  if (voice) {
    try {
      voice.currentTime = 0;
      voice.play().catch(() => {});
      frag3WarningVoice = voice;
    } catch (_) {}
  }
  if (siren) {
    try {
      siren.loop = true;
      siren.currentTime = 0;
      siren.volume = 0.2;
      siren.play().catch(() => {});
      frag3WarningSiren = siren;
    } catch (_) {}
  }
}

function stopFinalWarningOverlay() {
  const overlay = document.getElementById("markOverlay");
  if (overlay) {
    overlay.classList.remove("show");
    overlay.hidden = true;
  }
  if (frag3WarningAudio) {
    try {
      frag3WarningAudio.loop = false;
      frag3WarningAudio.pause();
      frag3WarningAudio.currentTime = 0;
    } catch (_) {}
    frag3WarningAudio = null;
  }
  if (frag3WarningVoice) {
    try {
      frag3WarningVoice.pause();
      frag3WarningVoice.currentTime = 0;
    } catch (_) {}
    frag3WarningVoice = null;
  }
  if (frag3WarningSiren) {
    try {
      frag3WarningSiren.loop = false;
      frag3WarningSiren.pause();
      frag3WarningSiren.currentTime = 0;
    } catch (_) {}
    frag3WarningSiren = null;
  }
}

function launchBlackoutAndTrailer() {
  if (finaleTriggered) return;
  stopFinalWarningOverlay();
  const blackout = document.getElementById("blackout");
  if (blackout) {
    blackout.hidden = false;
    requestAnimationFrame(() => blackout.classList.add("show"));
  }
  setTimeout(() => {
    const trailer = document.getElementById("trailer");
    if (trailer) {
      trailer.hidden = false;
      try {
        trailer.currentTime = 0;
        trailer.play().catch(() => {});
      } catch (_) {}
    }
  }, 600);
  finaleTriggered = true;
}

function resetBlackoutAndTrailer() {
  const blackout = document.getElementById("blackout");
  if (blackout) {
    blackout.classList.remove("show");
    blackout.hidden = true;
  }
  const trailer = document.getElementById("trailer");
  if (trailer) {
    try {
      trailer.pause();
    } catch (_) {}
    trailer.currentTime = 0;
    trailer.hidden = true;
  }
}

function resetFinaleState() {
  finaleTriggered = false;
  if (frag3WarningTimer) {
    clearTimeout(frag3WarningTimer);
    frag3WarningTimer = null;
  }
  if (frag3BlackoutTimer) {
    clearTimeout(frag3BlackoutTimer);
    frag3BlackoutTimer = null;
  }
  stopFinalWarningOverlay();
  resetBlackoutAndTrailer();
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

document.addEventListener("DOMContentLoaded", () => {
  const already = localStorage.getItem(BOOT_KEY) === "1";
  if (already) {
  }
});

function reInitMagnet() {
  document.querySelectorAll(".gtext").forEach((el) => {
    const span = el.querySelector(".magnet");
    if (!span) return;
    span.style.transform = "translate3d(0,0,0)";
  });
}

(function bootInit() {
  const hash = (location.hash || "").replace("#", "");
  // Si hash vide ou 'intro' => on laisse l'intro gérer le premier écran,
  // sinon on respecte le hash.
  if (!hash || hash === "intro") {
  } else {
    show(hash);
  }
  updateUI();
})();

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
      // On laisse muted par défaut pour éviter le rejet auto, l'utilisateur choisit
      // Rien à faire ici, juste s'assurer que la vidéo joue
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

/* ==========================================
   Narrateur global (voix Officier M)
   ========================================== */

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
  async function typeOut(container, lines, charDelay = 8, lineDelay = 4) {
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

    const preJunk = Array.from({ length: 4 }, () => ({
      t: junkRow(),
      cls: "crt-line",
    }));

    const index = [
      { t: `> DIR /ARCHIVES/FRAGMENTS`, cls: "crt-dir" },
      { t: `  - SYSLOG_2087.ERR`, cls: "crt-file" },
      { t: `  - GRIDMAP_LA.bin`, cls: "crt-file" },

      // === FICHIERS “NORMAUX” (ouvrent un code viewer) ===
      {
        t: `  - public/SCAN_ROUTINE.rte`,
        cls: "crt-file",
        action: "open",
        codeId: "scan_js",
      },
      {
        t: `  - public/LA_MAP_INDEX.tds`,
        cls: "crt-file",
        action: "open",
        codeId: "map_json",
      },
      {
        t: `  - tools/decoder.c`,
        cls: "crt-file",
        action: "open",
        codeId: "decoder_c",
      },
      {
        t: `  - Clique sur les Fragments Jaunes`,
      },
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
    ];

    const midJunk = Array.from({ length: 0 }, () => ({
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
      { t: `  [R] `, cls: "crt-kv" },
      { t: `RESET_MEMORY`, cls: "crt-cmd reset crt-reset" },
      { t: " ", cls: "crt-line" },
    ];

    const postJunk = Array.from({ length: 5 }, () => ({
      t: junkRow(),
      cls: "crt-line",
    }));
    const footer = [
      {
        t: "HINT: ↑/↓ naviguer • Entrée ouvrir • R réinitialiser • H accueil",
        cls: "crt-help",
      },
    ];

    // On retourne toutes les lignes et on posera les data-* juste après le rendu
    return [
      ...header,
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


    // 1) Transformer les lignes .crt-file en actions si elles contiennent nos libellés
    [...output.querySelectorAll(".crt-file")].forEach((el) => {
      const txt = el.textContent.trim();
      if (txt.includes("SCAN_ROUTINE.js")) {
        el.dataset.action = "open";
        el.dataset.codeId = "scan_js";
      }
      if (txt.includes("LA_MAP_INDEX.json")) {
        el.dataset.action = "open";
        el.dataset.codeId = "map_json";
      }
      if (txt.includes("decoder.c")) {
        el.dataset.action = "open";
        el.dataset.codeId = "decoder_c";
      }

      if (txt.includes("ROOT_KEYS.pem") || txt.includes("NEXUS_CORE.mem")) {
        el.dataset.action = "warn";
      }
      if (txt.includes("CORE_DUMP.bin") || txt.includes("KERNEL_PATCH.sys")) {
        el.dataset.action = "crash";
      }
    });

    // 2) Clic global sur le viewport HUB
    viewport.addEventListener("click", (e) => {
      const t = e.target.closest(".crt-file, .crt-frag");
      if (!t) return;

      // a) Fragments → comportement existant
      if (t.classList.contains("crt-frag")) return; // déjà géré plus haut

      // b) Fichiers spéciaux
      const action = t.dataset.action;
      if (action === "open") {
        hubShowCode(t.dataset.codeId);
      } else if (action === "warn") {
        hubWarn();
      } else if (action === "crash") {
        hubHardCrash();
      }
    });

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
    show("hub");
  }
})();

// ====== Son terminal (toggle global) ======
window.TERM_SOUND = true;
window.setTermSound = function (on) {
  window.TERM_SOUND = !!on;
  const btn = document.getElementById("crtSoundBtn");
  if (btn) btn.textContent = "SOUND: " + (window.TERM_SOUND ? "ON" : "OFF");
};

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

// ======== INTRO AUTO ========
document.addEventListener("DOMContentLoaded", () => {
  const intro = document.getElementById("intro");
  const term = document.getElementById("introTerm");
  const help = document.getElementById("introHelp");
  const cont = document.getElementById("introContinue");
  const trans = document.getElementById("introTransition");

  if (!intro || !term) return;

  const LINES = [
    "Un Nexus avancé, utilisé comme enquêteur par une division proche du LAPD, est chargé d’exploiter des archives et de résoudre des affaires classées.",
    "Officiellement, il sert le système. Officieusement, il est choisi pour sa rapidité, sa précision et son caractère remplaçable.",
    "En explorant des dossiers qu’il n’aurait jamais dû consulter,",
     "il découvre un ensemble d’archives révélant un crime d’État : un projet de génocide visant les réplicants, fondé sur le fichage, le regroupement et l’élimination systématique des modèles synthétiques.",
    "À partir de cette découverte, ses accès sont révoqués et un ordre de retrait est lancé contre lui.", 
    "Comprenant qu’il ne peut ni fuir ni se défendre dans le monde réel, il fait un dernier choix.",
    "Avant d’être capturé, il fragmente et encode sa mémoire dans un terminal isolé, un nœud d’archives oublié sous Los Angeles.", 
    "Il disparaît, en pariant sur l’idée qu’un jour, quelqu’un activera ce terminal et découvrira, à travers ses souvenirs, une vérité capable de faire basculer l’ordre établi.",
  ];

  function typeLine(line, text, speed = 20, next) {
    let i = 0;
    const cursor = document.createElement("span");
    cursor.className = "cursor";

    // on crée un nœud texte à mettre AVANT le curseur, qu'on mettra à jour
    const txt = document.createTextNode("");
    line.appendChild(txt);
    line.appendChild(cursor);

    function step() {
      txt.nodeValue = text.slice(0, i);
      i++;
      if (i <= text.length) {
        setTimeout(step, speed);
      } else {
        cursor.remove();
        next && next();
      }
    }
    step();
  }

  function runIntro() {
    // Montre l’intro en overlay
    intro.style.display = "block";
    intro.classList.add("active");
    term.innerHTML = "";
    if (help) help.hidden = true;

    let i = 0;
    function next() {
      if (i >= LINES.length) {
        if (help) help.hidden = false;
        bindContinue();
        return;
      }
      const line = document.createElement("div");
      line.className = "intro-line";
      term.appendChild(line);
      typeLine(line, LINES[i++], 15, next);
    }
    next();
  }

  function endIntro() {
    // petite transition
    if (trans) trans.classList.add("run");
    setTimeout(() => {
      intro.classList.remove("active");
      intro.style.display = "none";
      if (typeof show === "function") show("home"); // -> on arrive sur HOME
    }, 600);
  }

  function bindContinue() {
    const proceed = () => {
      document.removeEventListener("keydown", proceed);
      document.removeEventListener("click", proceed);
      cont && cont.removeEventListener("click", proceed);
      endIntro();
    };
    cont && cont.addEventListener("click", proceed, { once: true });
    document.addEventListener("keydown", proceed, { once: true });
    document.addEventListener("click", proceed, { once: true });
  }

  // Lancer automatiquement si pas de hash ou hash === #intro
  const h = (location.hash || "").toLowerCase();
  if (!h || h === "#intro") runIntro();
});

// === Ouverture code viewer ===
function hubShowCode(codeId) {
  const modal = document.getElementById("codeModal");
  const title = document.getElementById("codeTitle");
  const cont = document.getElementById("codeContent");
  const close = document.getElementById("codeClose");
  if (!modal || !title || !cont) return;

  const snip = CODE_SNIPPETS[codeId];
  if (!snip) return;

  title.textContent = snip.title;
  cont.textContent = snip.content; // pas de highlight volontairement (monospace brut)
  modal.hidden = false;

  const off = () => {
    modal.hidden = true;
    close.removeEventListener("click", off);
    modal.removeEventListener("click", onBg);
  };
  const onBg = (e) => {
    if (e.target === modal) off();
  };
  close.addEventListener("click", off);
  modal.addEventListener("click", onBg);
}

// === Warning (confidentiel) ===
function hubWarn() {
  const w = document.getElementById("codeWarn");
  const c = document.getElementById("warnClose");
  if (!w || !c) return;
  w.hidden = false;
  const off = () => {
    w.hidden = true;
    c.removeEventListener("click", off);
  };
  c.addEventListener("click", off);
}

// === Crash + reboot → HOME ===
function hubHardCrash() {
  const wrap = document.getElementById("hardCrash");
  const matrix = document.getElementById("crashMatrix");
  if (!wrap || !matrix) return;

  // Remplir “matrix”
  matrix.textContent = "";
  const rows = 28,
    cols = Math.min(120, Math.floor(window.innerWidth / 10));
  for (let r = 0; r < rows; r++) {
    let line = "";
    for (let c = 0; c < cols; c++) {
      line += Math.random() < 0.14 ? (Math.random() < 0.5 ? "0" : "X") : " ";
    }
    matrix.textContent += line + "\n";
  }

  wrap.hidden = false;

  // Reboot après 2.2s → on revient HOME
  setTimeout(() => {
    wrap.hidden = true;
    if (typeof show === "function") show("home");
  }, 2200);
}

// On n'utilise plus show() pour les fragments : on les "dock" en onglet
// ===== Dock state =====
const _dockState = {
  created: false,
  tabs: new Map(), // id -> { tab, panel }
  currentId: null,
};

// ===== crée le container dock s’il n’existe pas =====
function ensureDock() {
  if (_dockState.created) return;

  const dock = document.createElement("section");
  dock.id = "dock";
  dock.className = "dock";
  dock.setAttribute("hidden", "");

  dock.innerHTML = `
    <div class="dock-tabs" id="dockTabs"></div>
    <div class="dock-panel" id="dockPanel"></div>
  `;

  document.body.appendChild(dock);
  _dockState.created = true;
}

function focusDockTab(id) {
  _dockState.currentId = id;
  const entry = _dockState.tabs.get(id);
  if (!entry) return;

  const { tab, panel } = entry;

  // onglet actif
  document.querySelectorAll(".dock-tab").forEach((t) => {
    t.classList.remove("active");
  });
  tab.classList.add("active");

  // panel actif
  document.querySelectorAll(".dock-panel .pane").forEach((p) => {
    p.hidden = true;
  });
  panel.hidden = false;

  panel.focus({ preventScroll: true });

  // Narration : afficher le texte du fragment quand on change d’onglet
  if (window.M_NARR) {
    if (id === "fragment-2")
      window.M_NARR.sequence("frag2_open", { speed: 36, gap: 1000 });
    else if (id === "fragment-3")
      window.M_NARR.sequence("frag3_open", { speed: 40, gap: 1200 });
    else if (id === "fragment-1")
      window.M_NARR.sequence("before_frag1", { speed: 38, gap: 1100 });
  }

  if (id === "fragment-3") startFrag3FinaleCountdown();
  else cancelFrag3FinaleCountdown();
}

function closeDockTab(id) {
  const entry = _dockState.tabs.get(id);
  if (!entry) return;

  entry.tab.remove();
  entry.panel.remove();
  _dockState.tabs.delete(id);

  // si plus aucun onglet → cacher le dock
  if (_dockState.tabs.size === 0) {
    const dock = document.getElementById("dock");
    if (dock) dock.setAttribute("hidden", "");
    _dockState.currentId = null;
    if (window.M_NARR) window.M_NARR.stop();
    cancelFrag3FinaleCountdown();
    return;
  }

  // si on ferme l'actif → focus sur le dernier ouvert
  if (_dockState.currentId === id) {
    const lastId = Array.from(_dockState.tabs.keys()).pop();
    if (lastId) focusDockTab(lastId);
  }
}

// ===== Ouvre un fragment en onglet  =====
function openFrag(id) {
  ensureDock();

  // marquer vu / progression
  if (fragments.includes(id)) {
    setSeen(id);
  }

  const dock = document.getElementById("dock");
  const tabs = document.getElementById("dockTabs");
  const panelRoot = document.getElementById("dockPanel");

  if (!dock || !tabs || !panelRoot) return;

  dock.removeAttribute("hidden");

  // si l'onglet existe déjà → juste focus
  if (_dockState.tabs.has(id)) {
    focusDockTab(id);
    return;
  }

  // --- créer l'onglet
  const tab = document.createElement("button");
  tab.className = "dock-tab";
  tab.innerHTML = `
    <span class="t">${id.replace("fragment-", "FRAG ")}</span>
    <span class="x" aria-label="Fermer">×</span>
  `;
  tabs.appendChild(tab);

  // --- créer le panneau
  const panel = document.createElement("div");
  panel.className = "pane";
  panel.setAttribute("tabindex", "0");

  const fragEl = document.getElementById(id);
  if (fragEl) {
    const clone = fragEl.cloneNode(true);
    const inner = clone.querySelector("main, .stage, .content") || clone;
    panel.innerHTML = "";
    panel.appendChild(inner);
  } else {
    panel.textContent = "[Fragment introuvable]";
  }

  panel.hidden = true;
  panelRoot.appendChild(panel);

  // enregistrer
  _dockState.tabs.set(id, { tab, panel });

  // événements de l'onglet
  tab.addEventListener("click", (e) => {
    const isClose = e.target.classList.contains("x");
    if (isClose) {
      closeDockTab(id);
    } else {
      focusDockTab(id);
    }
  });

  // fermeture clavier: Esc ou Ctrl/Cmd+W
  panel.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeDockTab(id);
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "w") {
      e.preventDefault();
      closeDockTab(id);
    }
  });

  // montrer cet onglet
  focusDockTab(id);
}


/* =========================================================
   OFFICER M — Narration overlay + audio
   - 1 seule source de vérité (évite les chevauchements)
   - Texte en typing
   - Audio par contexte si l'élément <audio> existe
========================================================= */
(function(){
  const box = document.getElementById("narrator");
  const txt = document.getElementById("narratorText");
  const avatar = document.getElementById("narratorAvatar");

  // Si l'UI n'est pas présente, on ne casse rien
  if (!box || !txt) return;

  // --- mapping textes (tu peux affiner si besoin)
  const TEXT = {
    hub_intro: [
`«\n…\n\nLe système a répondu.\n\nJe ne pensais pas que ce nœud tiendrait aussi longtemps.\n»`,
`(léger silence)`,
`«\nSi cette archive s’est réactivée…\n\nc’est que quelqu’un a franchi le seuil.\n»`,
`«\nCe que tu vois n’est pas une transmission.\n\nC’est ce que j’ai laissé derrière moi.\n»`,
`«\nLes fragments sont instables.\n\nCertains sont incomplets.\n\nD’autres ont été volontairement brisés.\n»`,
`«\nChaque fragment correspond à une intervention.\n\nUn moment précis.\n\nÀ l’époque,\nje n’y ai vu qu’un rapport de plus.\n»`,
`«\nAvec le recul…\n\nc’était déjà trop tard.\n»`
    ],
    before_frag1: [
`«\nPatrouilles nocturnes.\n\nAppels de routine.\n\nLa ville ne dormait jamais.\n\nElle observait.\n»`,
`«\nCertaines zones étaient systématiquement verrouillées.\n\nOfficiellement : maintenance.\n\nOfficieusement…\npersonne ne posait de questions.\n»`,
`«\nJ’ai commencé à mémoriser des détails\nque je n’étais pas censé retenir.\n\nDes visages.\n\nDes absences.\n»`
    ],
    frag2_open: [
`«\nVoilà ce qu’ils ont gardé de moi.\n»`,
`«\nUn identifiant.\nUne fonction.\nUn historique propre.\n»`,
`«\nTout ce qui dépasse\na été supprimé.\n»`,
`«\nLire ce document n’apporte rien.\n\nIl a été réécrit pour rassurer.\n\nPas pour informer.\n»`,
`«\nLes incohérences\nne sont jamais mentionnées.\n»`,
`«\nCe que j’ai découvert\nne figure dans aucun rapport.\n»`
    ],
    frag2_during: [],
    frag2_end: [],
    frag3_open: [
`«\nC’est ici que j’ai compris.\n»`,
`«\nCe n’était pas une série d’erreurs.\n\nCe n’était pas un dysfonctionnement.\n»`,
`«\nC’était une préparation.\n»`,
`«\nSous couvert de sécurité.\n\nSous couvert de stabilité.\n»`,
`«\nUne élimination silencieuse.\n»`,
`«\nPlanifiée.\n\nProgressive.\n\nIrréversible.\n»`
    ],
    return_hub: [
`J’ai compris que je ne pourrais pas arrêter ça.`,
`Pas par les canaux officiels.\n\nPas en restant visible.`,
`Alors j’ai fait la seule chose possible.`,
`J’ai déplacé ma mémoire.`,
`Hors réseau.\n\nHors juridiction.`
    ],
    final: [
`Si cette archive a survécu…\n\nce n’est pas pour me sauver.`,
`C’est pour que ce qui arrive\n\nne soit pas effacé.`,
`Si tu ouvres ce dossier, il n’y aura plus de retour en arrière.`
    ],
  };

  // --- mapping audio ids (optionnel)
  const AUDIO = {
    hub_intro: "m_hub_intro",
    before_frag1: "m_frag1_intro",
    frag2_open: "m_frag2_dossier",
    frag2_during: null,
    frag2_end: null,
    frag3_open: "m_frag3_crime",
    return_hub: null,
    final: null,
  };

  let typingTimer = null;
  let activeAudio = null;
  let unlocked = false;
  let seqRunning = false;
  let stopSeq = null;

  function unlockAudio(){
    if (unlocked) return;
    unlocked = true;
    // "prime" : play/pause un audio silencieux si dispo (iOS)
    const a = document.getElementById(AUDIO.hub_intro) || document.querySelector("audio");
    if (!a) return;
    const oldVol = a.volume;
    a.volume = 0.001;
    a.play().then(()=>{ a.pause(); a.currentTime = 0; a.volume = oldVol; }).catch(()=>{ a.volume = oldVol; });
  }

  window.addEventListener("click", unlockAudio, { once:true });
  window.addEventListener("touchstart", unlockAudio, { once:true });

  function stopAllAudio(){
    Object.values(AUDIO).forEach(id=>{
      const a=document.getElementById(id);
      if (a){ try{ a.pause(); a.currentTime = 0; }catch(_){} }
    });
    activeAudio = null;
  }

  function hide(){
    box.hidden = true;
    box.classList.remove("visible");
    box.classList.remove("idle");
    txt.textContent = "";
  }

  function show(){
    box.hidden = false;
    box.classList.add("visible");
    box.classList.remove("idle");
  }

  function stopTyping(){
    if (typingTimer) { clearInterval(typingTimer); typingTimer = null; }
  }

  function typeText(str, speed=24){
    stopTyping();
    show();
    txt.textContent = "";
    let i = 0;
    typingTimer = setInterval(()=>{
      txt.textContent = str.slice(0, i++);
      if (i > str.length){
        stopTyping();
        box.classList.add("idle");
      }
    }, speed);
  }

  async function runSequence(key, {speed=22, gap=900}={}){
    const list = TEXT[key];
    if (!list || !list.length) return;

    // annule séquence en cours
    if (stopSeq) stopSeq();
    seqRunning = true;
    let cancelled = false;
    stopSeq = ()=>{ cancelled = true; seqRunning = false; stopAllAudio(); stopTyping(); };

    // audio
    const audioId = AUDIO[key];
    const a = audioId ? document.getElementById(audioId) : null;
    stopAllAudio();
    if (a){
      try{
        a.currentTime = 0;
        a.play().catch(()=>{});
        activeAudio = a;
      }catch(_){}
    }

    for (const part of list){
      if (cancelled) return;
      typeText(part, speed);
      // durée approx = nb de chars * speed + petite marge
      const hold = Math.max(1200, part.length * speed * 0.9);
      await new Promise(r=>setTimeout(r, hold));
      if (cancelled) return;
      await new Promise(r=>setTimeout(r, gap));
    }
    seqRunning = false;
  }

  // API
  window.M_NARR = {
    hide,
    stop: ()=>{ if (stopSeq) stopSeq(); hide(); },
    showStatic: (str, speed=22)=> typeText(str, speed),
    sequence: runSequence,
  };

})();
