#!/usr/bin/env python3
import sys
"""
FUSE Portfolio — backend + admin + API (pure Python standard library).

Run:   python3 fuse_server.py
Then:  Portfolio  ->  http://localhost:8080
       Admin      ->  http://localhost:8080/admin   (password below)

Config via environment variables (optional):
   FUSE_PORT             default 8080
   FUSE_ADMIN_PASSWORD   default "fuse-admin"   <-- CHANGE THIS

This is independent of the existing questionnaire server.py (port 8000).
"""

import os
import re
import json
import cgi
import uuid
import time
import shutil
import secrets
import mimetypes
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, unquote

# ---------- paths & config ----------
BASE = os.path.dirname(os.path.abspath(__file__))
MEDIA_DIR = os.path.join(BASE, "media")
DATA_DIR = os.path.join(BASE, "data")
DATA_FILE = os.path.join(DATA_DIR, "projects.json")
DESIGN_FILE = os.path.join(DATA_DIR, "design.json")

PORT = int(os.environ.get("FUSE_PORT", "8080"))
PASSWORD = os.environ.get("FUSE_ADMIN_PASSWORD", "fuse-admin")

IMAGE_EXT = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"}
VIDEO_EXT = {".mp4", ".webm", ".mov", ".m4v"}
ALLOWED_EXT = IMAGE_EXT | VIDEO_EXT
MAX_BYTES = 200 * 1024 * 1024  # 200 MB

CATEGORIES = ["content", "branding", "keyvisual", "packaging", "retouching"]

os.makedirs(MEDIA_DIR, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)

# auth tokens — persisted to disk so a server restart doesn't log you out
TOKENS_FILE = os.path.join(DATA_DIR, "tokens.json")


def _load_tokens():
    try:
        with open(TOKENS_FILE, "r", encoding="utf-8") as f:
            return set(json.load(f))
    except Exception:
        return set()


def _save_tokens():
    try:
        with open(TOKENS_FILE, "w", encoding="utf-8") as f:
            json.dump(list(TOKENS), f)
    except Exception:
        pass


TOKENS = _load_tokens()


# ---------- data store ----------
def load_projects():
    if not os.path.exists(DATA_FILE):
        return []
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def save_projects(items):
    tmp = DATA_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(items, f, indent=2, ensure_ascii=False)
    os.replace(tmp, DATA_FILE)


def load_design():
    if not os.path.exists(DESIGN_FILE):
        return {}
    try:
        with open(DESIGN_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def save_design(obj):
    tmp = DESIGN_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2, ensure_ascii=False)
    os.replace(tmp, DESIGN_FILE)


def media_type_for(ext):
    if ext in IMAGE_EXT:
        return "image"
    if ext in VIDEO_EXT:
        return "video"
    return None


# ---------- request handler ----------
class Handler(BaseHTTPRequestHandler):
    server_version = "FUSE/1.0"

    # ---- small helpers ----
    def _send(self, code, body=b"", ctype="application/octet-stream", extra=None):
        if isinstance(body, str):
            body = body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        if extra:
            for k, v in extra.items():
                self.send_header(k, v)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _json(self, code, obj):
        self._send(code, json.dumps(obj, ensure_ascii=False), "application/json; charset=utf-8")

    def _authed(self):
        auth = self.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            return auth[7:] in TOKENS
        return False

    def _require_auth(self):
        if not self._authed():
            self._json(401, {"error": "Unauthorized. Please log in."})
            return False
        return True

    # ---- static files ----
    def _serve_static(self, rel_path):
        if rel_path in ("", "/"):
            rel_path = "index.html"
        elif rel_path in ("admin", "admin/"):
            rel_path = "admin/index.html"

        rel_path = rel_path.lstrip("/")
        full = os.path.normpath(os.path.join(BASE, rel_path))
        if not full.startswith(BASE):
            return self._send(403, "Forbidden", "text/plain")
        if os.path.isdir(full):
            full = os.path.join(full, "index.html")
        if not os.path.isfile(full):
            return self._send(404, "Not found", "text/plain")
        self._serve_file(full)

    def _serve_file(self, full):
        ctype, _ = mimetypes.guess_type(full)
        ctype = ctype or "application/octet-stream"
        size = os.path.getsize(full)
        rng = self.headers.get("Range")

        # Range support (needed for smooth <video> seeking/streaming)
        if rng:
            m = re.match(r"bytes=(\d*)-(\d*)", rng)
            if m:
                start = int(m.group(1)) if m.group(1) else 0
                end = int(m.group(2)) if m.group(2) else size - 1
                end = min(end, size - 1)
                length = end - start + 1
                self.send_response(206)
                self.send_header("Content-Type", ctype)
                self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
                self.send_header("Accept-Ranges", "bytes")
                self.send_header("Content-Length", str(length))
                self.send_header("Cache-Control", "no-cache")
                self.end_headers()
                with open(full, "rb") as f:
                    f.seek(start)
                    remaining = length
                    while remaining > 0:
                        chunk = f.read(min(64 * 1024, remaining))
                        if not chunk:
                            break
                        self.wfile.write(chunk)
                        remaining -= len(chunk)
                return

        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(size))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        if self.command != "HEAD":
            with open(full, "rb") as f:
                shutil.copyfileobj(f, self.wfile)

    # ---- HTTP verbs ----
    def do_OPTIONS(self):
        self._send(204, b"")

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        path = unquote(urlparse(self.path).path)

        if path == "/api/projects":
            return self._json(200, load_projects())
        if path == "/api/design":
            return self._json(200, load_design())
        if path == "/api/health":
            return self._json(200, {"ok": True, "count": len(load_projects())})

        if path.startswith("/media/"):
            name = os.path.basename(path)
            full = os.path.join(MEDIA_DIR, name)
            if os.path.isfile(full):
                return self._serve_file(full)
            return self._send(404, "Not found", "text/plain")

        return self._serve_static(path)

    def do_POST(self):
        path = unquote(urlparse(self.path).path)

        if path == "/api/login":
            return self._handle_login()
        if path == "/api/logout":
            auth = self.headers.get("Authorization", "")
            if auth.startswith("Bearer "):
                TOKENS.discard(auth[7:])
                _save_tokens()
            return self._json(200, {"ok": True})
        if path == "/api/projects":
            return self._handle_upload()

        return self._json(404, {"error": "Unknown endpoint"})

    def do_PUT(self):
        path = unquote(urlparse(self.path).path)
        if path == "/api/design":
            return self._handle_design_save()
        m = re.match(r"^/api/projects/([\w-]+)$", path)
        if m:
            return self._handle_update(m.group(1))
        return self._json(404, {"error": "Unknown endpoint"})

    def do_DELETE(self):
        path = unquote(urlparse(self.path).path)
        m = re.match(r"^/api/projects/([\w-]+)$", path)
        if m:
            return self._handle_delete(m.group(1))
        return self._json(404, {"error": "Unknown endpoint"})

    # ---- API actions ----
    def _read_json_body(self):
        length = int(self.headers.get("Content-Length", 0) or 0)
        if length <= 0:
            return {}
        try:
            return json.loads(self.rfile.read(length).decode("utf-8"))
        except Exception:
            return {}

    def _handle_login(self):
        data = self._read_json_body()
        if data.get("password") == PASSWORD:
            token = secrets.token_hex(24)
            TOKENS.add(token)
            _save_tokens()
            return self._json(200, {"token": token})
        return self._json(401, {"error": "Wrong password"})

    def _handle_upload(self):
        if not self._require_auth():
            return

        length = int(self.headers.get("Content-Length", 0) or 0)
        if length > MAX_BYTES:
            return self._json(413, {"error": "File too large (200 MB max)"})

        ctype = self.headers.get("Content-Type", "")
        if "multipart/form-data" not in ctype:
            return self._json(400, {"error": "Expected multipart/form-data"})

        form = cgi.FieldStorage(
            fp=self.rfile,
            headers=self.headers,
            environ={"REQUEST_METHOD": "POST", "CONTENT_TYPE": ctype},
        )

        fileitem = form["file"] if "file" in form else None
        if fileitem is None or not getattr(fileitem, "filename", ""):
            return self._json(400, {"error": "No file uploaded"})

        ext = os.path.splitext(fileitem.filename)[1].lower()
        if ext not in ALLOWED_EXT:
            return self._json(
                400,
                {"error": f"Unsupported type '{ext}'. Allowed: {', '.join(sorted(ALLOWED_EXT))}"},
            )

        raw = fileitem.file.read()
        if len(raw) > MAX_BYTES:
            return self._json(413, {"error": "File too large (200 MB max)"})

        fname = f"{uuid.uuid4().hex}{ext}"
        with open(os.path.join(MEDIA_DIR, fname), "wb") as out:
            out.write(raw)

        def field(name, default=""):
            v = form.getvalue(name, default)
            return v.strip() if isinstance(v, str) else default

        cat = field("cat", "content")
        if cat not in CATEGORIES:
            cat = "content"
        size = field("size", "span-6")
        if size not in ("span-4", "span-6", "span-8"):
            size = "span-6"

        record = {
            "id": uuid.uuid4().hex[:12],
            "client": field("client", "Untitled"),
            "type": field("type", "AI Integrated Project"),
            "cat": cat,
            "tag": field("tag", "AI-integrated work"),
            "size": size,
            "media": f"/media/{fname}",
            "mediaType": media_type_for(ext),
            "c1": field("c1", "#161616"),
            "c2": field("c2", "#d4ff00"),
            "createdAt": int(time.time()),
        }

        items = load_projects()
        items.insert(0, record)
        save_projects(items)
        return self._json(201, record)

    def _handle_update(self, pid):
        if not self._require_auth():
            return
        data = self._read_json_body()
        items = load_projects()
        for it in items:
            if it["id"] == pid:
                for key in ("client", "type", "cat", "tag", "size"):
                    if key in data and isinstance(data[key], str):
                        it[key] = data[key].strip()
                save_projects(items)
                return self._json(200, it)
        return self._json(404, {"error": "Project not found"})

    def _handle_design_save(self):
        if not self._require_auth():
            return
        data = self._read_json_body()
        clean = {}

        def hexcolor(v):
            return bool(isinstance(v, str) and re.match(r"^#[0-9a-fA-F]{3,8}$", v))

        if hexcolor(data.get("accent")):
            clean["accent"] = data["accent"]
        if hexcolor(data.get("bg")):
            clean["bg"] = data["bg"]
        if hexcolor(data.get("text")):
            clean["text"] = data["text"]
        for key in ("headingFont", "bodyFont"):
            v = data.get(key)
            if isinstance(v, str) and 0 < len(v) <= 60 and re.match(r"^[\w '\-]+$", v):
                clean[key] = v.strip()
        try:
            ts = float(data.get("typeScale", 1))
            clean["typeScale"] = max(0.7, min(1.5, round(ts, 3)))
        except (TypeError, ValueError):
            pass
        if "radius" in data:
            try:
                clean["radius"] = max(0, min(40, int(data["radius"])))
            except (TypeError, ValueError):
                pass

        save_design(clean)
        return self._json(200, clean)

    def _handle_delete(self, pid):
        if not self._require_auth():
            return
        items = load_projects()
        kept, removed = [], None
        for it in items:
            if it["id"] == pid:
                removed = it
            else:
                kept.append(it)
        if removed is None:
            return self._json(404, {"error": "Project not found"})
        if removed.get("media"):
            fpath = os.path.join(MEDIA_DIR, os.path.basename(removed["media"]))
            if os.path.isfile(fpath):
                try:
                    os.remove(fpath)
                except OSError:
                    pass
        save_projects(kept)
        return self._json(200, {"ok": True, "deleted": pid})

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


def main():
    httpd = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print("=" * 54)
    print("  FUSE Portfolio backend is running")
    print(f"  Portfolio : http://localhost:{PORT}")
    print(f"  Admin     : http://localhost:{PORT}/admin")
    print(f"  Password  : {PASSWORD}")
    print("  (set FUSE_ADMIN_PASSWORD to change it)")
    print("  Press Ctrl+C to stop")
    print("=" * 54)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
