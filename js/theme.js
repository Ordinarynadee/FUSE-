/* =========================================================
   FUSE — theme engine (shared by public site + admin)
   Loads saved design from /api/design and applies it live.
   Exposes window.FUSE_THEME for the admin customiser.
   ========================================================= */
(function () {
  // Curated Google Fonts. `w` = weight axis to request (empty = single-weight font).
  const HEADING_FONTS = [
    { name: "Unbounded", w: "400;700;800;900" },
    { name: "Anton", w: "" },
    { name: "Archivo Black", w: "" },
    { name: "Bebas Neue", w: "" },
    { name: "Oswald", w: "400;600;700" },
    { name: "Syne", w: "400;700;800" },
    { name: "Sora", w: "400;700;800" },
    { name: "Space Grotesk", w: "400;500;700" },
    { name: "Montserrat", w: "400;700;800" },
    { name: "Poppins", w: "400;600;800" },
    { name: "Rubik", w: "400;700;900" },
    { name: "Manrope", w: "400;700;800" },
    { name: "Outfit", w: "400;600;800" },
    { name: "Teko", w: "400;600;700" },
    { name: "Bricolage Grotesque", w: "400;700;800" },
    { name: "Plus Jakarta Sans", w: "400;700;800" },
    { name: "Inter", w: "400;600;800" },
  ];
  const BODY_FONTS = [
    { name: "Space Grotesk", w: "400;500;700" },
    { name: "Inter", w: "400;500;700" },
    { name: "Manrope", w: "400;500;700" },
    { name: "Sora", w: "400;600" },
    { name: "Poppins", w: "400;600" },
    { name: "Montserrat", w: "400;600" },
    { name: "Outfit", w: "400;600" },
    { name: "DM Sans", w: "400;500;700" },
    { name: "Work Sans", w: "400;500;700" },
    { name: "Rubik", w: "400;500;700" },
    { name: "Plus Jakarta Sans", w: "400;600" },
    { name: "Roboto Mono", w: "400;500;700" },
  ];

  const WEIGHTS = {};
  HEADING_FONTS.concat(BODY_FONTS).forEach((f) => { WEIGHTS[f.name] = f.w; });

  const loaded = new Set();
  function loadFont(name) {
    if (!name || loaded.has(name)) return;
    loaded.add(name);
    const w = WEIGHTS[name] != null ? WEIGHTS[name] : "400;700";
    const fam = name.trim().replace(/\s+/g, "+");
    const q = w ? fam + ":wght@" + w : fam;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=" + q + "&display=swap";
    document.head.appendChild(link);
  }

  function apply(d) {
    d = d || {};
    const r = document.documentElement.style;
    if (d.accent) { r.setProperty("--chartreuse", d.accent); r.setProperty("--chartreuse-dim", d.accent); }
    if (d.bg) r.setProperty("--black", d.bg);
    if (d.text) r.setProperty("--paper", d.text);
    if (d.typeScale) r.setProperty("--type-scale", String(d.typeScale));
    if (typeof d.radius === "number") r.setProperty("--card-radius", d.radius + "px");
    if (d.headingFont) { loadFont(d.headingFont); r.setProperty("--font-display", '"' + d.headingFont + '", "Unbounded", sans-serif'); }
    if (d.bodyFont) { loadFont(d.bodyFont); r.setProperty("--font-body", '"' + d.bodyFont + '", "Space Grotesk", system-ui, sans-serif'); }
  }

  async function load() {
    try {
      const res = await fetch("/api/design", { cache: "no-store" });
      if (res.ok) { const d = await res.json(); apply(d); return d; }
    } catch (_) { /* no backend */ }
    return {};
  }

  window.FUSE_THEME = { apply, load, loadFont, HEADING_FONTS, BODY_FONTS };

  // Auto-apply on the public portfolio (has #grid). The admin shell skips this.
  if (document.getElementById("grid")) load();
})();
