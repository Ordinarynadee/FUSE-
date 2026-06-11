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

/* ---------- boot ---------- */
if (token) showDash(); else showLogin();
