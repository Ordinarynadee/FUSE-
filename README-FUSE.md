# FUSE Portfolio + Admin

A self-contained portfolio site with a backend to upload, manage, and delete your
work files (JPEG · PNG · GIF · WebP · MP4 · WebM · MOV). No installs, no dependencies —
pure Python 3.

## Run it

**Easiest:** double-click **`start-fuse.command`** in Finder. Your browser opens automatically.

**Or in Terminal:**
```bash
cd "/Users/narudee/Desktop/Claud Cowork/Claude CODE Project"
python3 fuse_server.py
```

Then open:
- **Portfolio** → http://localhost:8080
- **Admin**     → http://localhost:8080/admin

## Logging in

Default password: **`fuse-admin`**

Change it before sharing — run with your own password:
```bash
FUSE_ADMIN_PASSWORD="your-secret" python3 fuse_server.py
```
(You can also set a different port, e.g. `FUSE_PORT=9000`.)

## Managing work

In **/admin** you can:
- **Upload** — drag & drop (or browse) an image/video, set Client/Title, Type,
  Category, a short tag, and tile size, then *Upload work*.
- **Delete** — every item has a Delete button (removes the file from disk too).

Whatever you upload shows up live on the portfolio grid, filtered by category.
Until you upload anything, the grid shows the 10 sample "Credential 2026" tiles.

## Where things live

| Path | What |
|------|------|
| `index.html`, `css/`, `js/` | the portfolio site |
| `admin/` | the admin panel |
| `fuse_server.py` | the backend (API + file server) |
| `media/` | your uploaded files (created on first run) |
| `data/projects.json` | the list of works (created on first run) |

## Notes
- Max upload size is 200 MB per file (editable at the top of `fuse_server.py`).
- This is separate from the existing `server.py` (the questionnaire app on port 8000) —
  they don't interfere.
- To back up your portfolio, just copy the `media/` folder and `data/projects.json`.
