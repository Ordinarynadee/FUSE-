/* =========================================================
   FUSE — interactions
   ========================================================= */

/* ---- Sample projects (fallback when no backend / no uploads yet) ---- */
const SAMPLE_PROJECTS = [
  { client: "Mont Fleur", type: "AI Online Content", cat: "content", tag: "AI-integrated content", size: "span-8", c1: "#1b2a1a", c2: "#d4ff00" },
  { client: "Salz", type: "AI Integrated Content", cat: "content", tag: "AI-integrated content", size: "span-4", c1: "#2a1b2a", c2: "#a0ff6a" },
  { client: "Fruitales", type: "AI Integrated Branding", cat: "branding", tag: "Brand identity", size: "span-4", c1: "#2a2410", c2: "#ffd23f" },
  { client: "MAMA OK", type: "AI Packaging Design", cat: "packaging", tag: "3D packaging", size: "span-8", c1: "#2a1410", c2: "#ff6a3f" },
  { client: "Bangchak", type: "AI Integrated Key Visual", cat: "keyvisual", tag: "Digital design solutions", size: "span-6", c1: "#10202a", c2: "#3fd0ff" },
  { client: "MAMA Moo Daeng", type: "AI Integrated Key Visual", cat: "keyvisual", tag: "Digital design solutions", size: "span-6", c1: "#2a1018", c2: "#ff3f7a" },
  { client: "MAMA Fusion", type: "AI Integrated Key Visual", cat: "keyvisual", tag: "Digital design solutions", size: "span-6", c1: "#1a1a2a", c2: "#d4ff00" },
  { client: "MAMA Fusion", type: "AI Integrated Retouching", cat: "retouching", tag: "Visual craft", size: "span-6", c1: "#202a10", c2: "#c8ff3f" },
  { client: "Dutchmill High Protein", type: "AI Integrated Retouching", cat: "retouching", tag: "Pro AI retoucher", size: "span-8", c1: "#10222a", c2: "#7affd4" },
  { client: "In-house Production", type: "AI Integrated Production", cat: "content", tag: "28 projects · 60 videos", size: "span-4", c1: "#161616", c2: "#d4ff00" },
];

/* ---- Reveal-on-scroll observer (declared early to avoid TDZ) ---- */
const IO_SUPPORTED = "IntersectionObserver" in window;
let io = null;
function observeReveals() {
  if (!IO_SUPPORTED) {
    document.querySelectorAll(".reveal-up").forEach(el => el.classList.add("in"));
    return;
  }
  if (!io) {
    io = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });
  }
  document.querySelectorAll(".reveal-up:not(.in)").forEach(el => io.observe(el));
}

/* Failsafe: content must never stay invisible if the observer never fires
   (e.g. a broken/zero-height viewport). Reveal anything still hidden. */
window.addEventListener("load", () => {
  setTimeout(() => {
    document.querySelectorAll(".reveal-up:not(.in)").forEach(el => {
      const r = el.getBoundingClientRect();
      if (!window.innerHeight || r.top < window.innerHeight * 1.1) el.classList.add("in");
    });
  }, 1800);
});

/* ---- Render project grid ---- */
const grid = document.getElementById("grid");

function cardMedia(p, i) {
  // Real uploaded media takes priority; otherwise a branded gradient tile.
  if (p.media && p.mediaType === "video") {
    return `<video class="card__media" src="${p.media}" muted loop autoplay playsinline preload="metadata"></video>`;
  }
  if (p.media) {
    return `<img class="card__media" src="${p.media}" alt="${esc(p.client)}" loading="lazy" />`;
  }
  const c1 = p.c1 || "#161616", c2 = p.c2 || "#d4ff00";
  return `<div class="card__bg" style="background:
    radial-gradient(90% 90% at 85% 8%, ${c2}66, transparent 55%),
    radial-gradient(80% 80% at 10% 100%, ${c2}22, transparent 50%),
    linear-gradient(140deg, ${c1} 0%, #161616 60%, #0d0d0d 100%);"></div>
    <span class="card__ghost" aria-hidden="true" style="color:${c2}">${String(i + 1).padStart(2, "0")}</span>`;
}

function buildCards(list) {
  grid.innerHTML = list.map((p, i) => `
    <article class="card ${p.size || "span-6"} reveal-up" data-cat="${p.cat}" style="transition-delay:${(i % 4) * 60}ms">
      ${cardMedia(p, i)}
      <div class="card__noise"></div>
      <div class="card__arrow" aria-hidden="true">↗</div>
      <div class="card__overlay">
        <span class="card__cat">${esc(p.tag || "")}</span>
        <h3 class="card__title">${esc(p.client || "")}</h3>
        <span class="card__type">${esc(p.type || "")}</span>
      </div>
    </article>`).join("");
  observeReveals();
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* Load live projects from the backend; fall back to samples if unavailable
   (e.g. the page was opened as a bare file, or nothing's been uploaded yet). */
(async function initGrid() {
  let list = SAMPLE_PROJECTS;
  try {
    const res = await fetch("/api/projects", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length) list = data;
    }
  } catch (_) { /* no backend — use samples */ }
  buildCards(list);
})();

/* ---- Filters ---- */
const filters = document.getElementById("filters");
filters.addEventListener("click", (e) => {
  const btn = e.target.closest(".filter");
  if (!btn) return;
  filters.querySelectorAll(".filter").forEach(b => b.classList.remove("is-active"));
  btn.classList.add("is-active");
  const f = btn.dataset.filter;
  grid.querySelectorAll(".card").forEach(card => {
    const show = f === "all" || card.dataset.cat === f;
    card.classList.toggle("hide", !show);
  });
});

/* ---- Nav scroll state + progress bar ---- */
const nav = document.getElementById("nav");
const progress = document.getElementById("scrollProgress");
function onScroll() {
  nav.classList.toggle("scrolled", window.scrollY > 40);
  const h = document.documentElement.scrollHeight - window.innerHeight;
  progress.style.width = (window.scrollY / h) * 100 + "%";
}
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

/* ---- Mobile burger ---- */
const burger = document.getElementById("burger");
burger.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  burger.setAttribute("aria-expanded", open);
});
// close the mobile menu after tapping a link
document.querySelectorAll(".nav__links a").forEach((a) =>
  a.addEventListener("click", () => {
    nav.classList.remove("open");
    burger.setAttribute("aria-expanded", "false");
  })
);

/* ---- Kick off reveal observer for any remaining elements ---- */
observeReveals();

/* ---- Studio statements highlight as they enter ---- */
const stIO = new IntersectionObserver((entries) => {
  entries.forEach(en => en.target.classList.toggle("in", en.isIntersecting));
}, { threshold: 0.6 });
document.querySelectorAll(".studio__statements p").forEach(p => stIO.observe(p));

/* ---- Animate hero lines in on load ---- */
window.addEventListener("load", () => {
  document.querySelectorAll(".hero__title .line > *").forEach((el, i) => {
    el.animate(
      [{ transform: "translateY(110%)" }, { transform: "translateY(0)" }],
      { duration: 900, delay: 150 + i * 120, easing: "cubic-bezier(0.16,1,0.3,1)", fill: "both" }
    );
  });
});
