# FUSE-

Front-end and CMS work for **FUSE** — a creative AI production unit.

## Contents

- **`index.html` + `css/` + `js/`** — the FUSE AI Studio portfolio site (chartreuse-on-black, Unbounded type, chrome+sparkle logo).
- **`fuse-radar.html`** — **FUSE RADAR**, a single-file React + Tailwind prototype of a premium "creative opportunity radar" platform (trend dashboard, trend detail, FUSE Picks, opportunity translator, score system, report generator). Loads React/Tailwind from CDN — just open the file in a browser.
- **`admin/` + `fuse_server.py`** — a lightweight pure-Python CMS backend + admin panel for the portfolio.

See [`README-FUSE.md`](README-FUSE.md) for the portfolio details.

## Running locally

```bash
# Portfolio + admin (Python standard library only)
FUSE_ADMIN_PASSWORD="choose-a-strong-password" python3 fuse_server.py
```

> Set `FUSE_ADMIN_PASSWORD` before exposing the admin anywhere — the built-in default is for local development only.

`fuse-radar.html` needs no server; open it directly in a browser.
