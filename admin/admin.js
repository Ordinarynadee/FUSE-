/* FUSE admin panel */
const $ = (s) => document.querySelector(s);
const KEY = "fuse_token";
let token = localStorage.getItem(KEY) || "";

const loginView = $("#loginView");
const dashView = $("#dashView");

/* ---------- auth ---------- */
function showDash() {
  loginView.hidden = true;
  dashView.hidden = false;
  loadList();
  loadDesign();
}
function showLogin() {
  dashView.hidden = true;
  loginView.hidden = false;
}

async function api(path, opts = {}) {
  opts.headers = opts.headers || {};
  if (token) opts.headers["Authorization"] = "Bearer " + token;
  const res = await fetch(path, opts);
  if (res.status === 401) {
    token = "";
    localStorage.removeItem(KEY);
    showLogin();
    throw new Error("Unauthorized");
  }
  return res;
}

$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("#loginErr").textContent = "";
  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: $("#password").value }),
    });
    const data = await res.json();
    if (res.ok && data.token) {
      token = data.token;
      localStorage.setItem(KEY, token);
      $("#password").value = "";
      showDash();
    } else {
      $("#loginErr").textContent = data.error || "Login failed";
    }
  } catch {
    $("#loginErr").textContent = "Cannot reach server. Is fuse_server.py running?";
  }
});

$("#logoutBtn").addEventListener("click", async () => {
  try { await api("/api/logout", { method: "POST" }); } catch {}
  token = "";
  localStorage.removeItem(KEY);
  showLogin();
});

/* ---------- file picker + drag/drop ---------- */
const fileInput = $("#file");
const drop = $("#drop");
const dropInner = $("#dropInner");
const dropPreview = $("#dropPreview");

function showPreview(file) {
  const url = URL.createObjectURL(file);
  const isVideo = file.type.startsWith("video");
  dropPreview.innerHTML = isVideo
    ? `<video src="${url}" muted autoplay loop playsinline></video><span class="drop__badge">${file.name}</span>`
    : `<img src="${url}" alt="" /><span class="drop__badge">${file.name}</span>`;
  dropPreview.hidden = false;
  dropInner.hidden = true;
}

fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) showPreview(fileInput.files[0]);
});
["dragover", "dragenter"].forEach((ev) =>
  drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); })
);
["dragleave", "drop"].forEach((ev) =>
  drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); })
);
drop.addEventListener("drop", (e) => {
  const f = e.dataTransfer.files[0];
  if (f) { fileInput.files = e.dataTransfer.files; showPreview(f); }
});

/* ---------- upload ---------- */
$("#uploadForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = $("#uploadMsg");
  const btn = $("#uploadBtn");
  if (!fileInput.files[0]) {
    msg.textContent = "Pick a file first."; msg.className = "msg err"; return;
  }
  const fd = new FormData();
  fd.append("file", fileInput.files[0]);
  fd.append("client", $("#client").value);
  fd.append("type", $("#type").value);
  fd.append("cat", $("#cat").value);
  fd.append("tag", $("#tag").value);
  fd.append("size", $("#size").value);

  btn.disabled = true; btn.textContent = "Uploading…";
  msg.textContent = ""; msg.className = "msg";
  try {
    const res = await api("/api/projects", { method: "POST", body: fd });
    const data = await res.json();
    if (res.ok) {
      msg.textContent = "✓ Uploaded “" + data.client + "”."; msg.className = "msg ok";
      e.target.reset();
      dropPreview.hidden = true; dropPreview.innerHTML = ""; dropInner.hidden = false;
      fileInput.value = "";
      loadList();
    } else {
      msg.textContent = data.error || "Upload failed"; msg.className = "msg err";
    }
  } catch (err) {
    msg.textContent = "Upload failed: " + err.message; msg.className = "msg err";
  } finally {
    btn.disabled = false; btn.textContent = "Upload work";
  }
});

/* ---------- list + delete ---------- */
const CAT_LABEL = { content: "Content", branding: "Branding", keyvisual: "Key Visual", packaging: "Packaging", retouching: "Retouching" };

async function loadList() {
  let items = [];
  try {
    const res = await api("/api/projects");
    items = await res.json();
  } catch { return; }

  $("#count").textContent = items.length;
  $("#empty").hidden = items.length > 0;

  $("#list").innerHTML = items.map((p) => {
    let media;
    if (p.media && p.mediaType === "video") {
      media = `<video src="${p.media}" muted loop autoplay playsinline></video>`;
    } else if (p.media) {
      media = `<img src="${p.media}" alt="${p.client}" loading="lazy" />`;
    } else {
      media = `<div class="item__placeholder">No media</div>`;
    }
    return `
      <article class="item">
        <div class="item__media">
          <span class="item__cat">${CAT_LABEL[p.cat] || p.cat}</span>
          ${media}
        </div>
        <div class="item__body">
          <div class="item__title">${escapeHtml(p.client)}</div>
          <div class="item__type">${escapeHtml(p.type || "")}</div>
          <button class="item__del" data-id="${p.id}">Delete</button>
        </div>
      </article>`;
  }).join("");

  $("#list").querySelectorAll(".item__del").forEach((b) =>
    b.addEventListener("click", () => removeItem(b.dataset.id, b))
  );
}

async function removeItem(id, btn) {
  if (!confirm("Delete this work permanently?")) return;
  btn.disabled = true; btn.textContent = "Deleting…";
  try {
    const res = await api("/api/projects/" + id, { method: "DELETE" });
    if (res.ok) loadList();
    else { btn.disabled = false; btn.textContent = "Delete"; }
  } catch {
    btn.disabled = false; btn.textContent = "Delete";
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---------- design / theme panel ---------- */
const DESIGN_DEFAULTS = {
  accent: "#d4ff00", bg: "#050505", text: "#f4f4ef",
  headingFont: "Unbounded", bodyFont: "Space Grotesk", typeScale: 1, radius: 14,
};

function fillFontSelect(sel, fonts, selected) {
  sel.innerHTML = fonts
    .map((f) => `<option value="${f.name}"${f.name === selected ? " selected" : ""}>${f.name}</option>`)
    .join("");
}

function currentDesign() {
  return {
    accent: $("#dAccent").value,
    bg: $("#dBg").value,
    text: $("#dText").value,
    headingFont: $("#dHeadingFont").value,
    bodyFont: $("#dBodyFont").value,
    typeScale: parseFloat($("#dScale").value),
    radius: parseInt($("#dRadius").value, 10),
  };
}

function setDesignControls(d) {
  d = Object.assign({}, DESIGN_DEFAULTS, d || {});
  $("#dAccent").value = d.accent; $("#dAccentHex").value = d.accent;
  $("#dBg").value = d.bg; $("#dBgHex").value = d.bg;
  $("#dText").value = d.text; $("#dTextHex").value = d.text;
  fillFontSelect($("#dHeadingFont"), FUSE_THEME.HEADING_FONTS, d.headingFont);
  fillFontSelect($("#dBodyFont"), FUSE_THEME.BODY_FONTS, d.bodyFont);
  $("#dScale").value = d.typeScale; $("#dScaleVal").textContent = Math.round(d.typeScale * 100) + "%";
  $("#dRadius").value = d.radius; $("#dRadiusVal").textContent = d.radius + "px";
}

function previewApply() {
  const d = currentDesign();
  $("#dScaleVal").textContent = Math.round(d.typeScale * 100) + "%";
  $("#dRadiusVal").textContent = d.radius + "px";
  $("#dAccentHex").value = d.accent; $("#dBgHex").value = d.bg; $("#dTextHex").value = d.text;
  try {
    const w = $("#dFrame").contentWindow;
    if (w && w.FUSE_THEME) w.FUSE_THEME.apply(d);
  } catch (_) { /* frame not ready */ }
}

// hex text boxes -> colour pickers
[["dAccentHex", "dAccent"], ["dBgHex", "dBg"], ["dTextHex", "dText"]].forEach(([hex, col]) => {
  $("#" + hex).addEventListener("input", () => {
    const v = $("#" + hex).value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(v)) { $("#" + col).value = v; previewApply(); }
  });
});
["dAccent", "dBg", "dText", "dHeadingFont", "dBodyFont", "dScale", "dRadius"].forEach((id) =>
  $("#" + id).addEventListener("input", previewApply)
);
$("#dFrame").addEventListener("load", previewApply);

$("#dSave").addEventListener("click", async () => {
  const msg = $("#dMsg"), btn = $("#dSave");
  btn.disabled = true; btn.textContent = "Saving…";
  try {
    const res = await api("/api/design", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(currentDesign()),
    });
    if (res.ok) { msg.textContent = "✓ Design saved — now live on your site."; msg.className = "msg ok"; }
    else { msg.textContent = "Save failed"; msg.className = "msg err"; }
  } catch (e) {
    msg.textContent = "Save failed: " + e.message; msg.className = "msg err";
  } finally {
    btn.disabled = false; btn.textContent = "Save design";
  }
});

$("#dReset").addEventListener("click", async () => {
  setDesignControls(DESIGN_DEFAULTS);
  try {
    await api("/api/design", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(DESIGN_DEFAULTS),
    });
  } catch (_) {}
  try { $("#dFrame").contentWindow.location.reload(); } catch (_) {}
  $("#dMsg").textContent = "Reset to default."; $("#dMsg").className = "msg ok";
});

async function loadDesign() {
  let d = {};
  try { const res = await api("/api/design"); d = await res.json(); } catch (_) {}
  setDesignControls(d);
  setTimeout(previewApply, 500);
}

/* ---------- boot ---------- */
if (token) showDash(); else showLogin();
