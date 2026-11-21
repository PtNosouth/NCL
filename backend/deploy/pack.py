"""Stamp the asset URLs and build the deploy zip.

    python backend\deploy\pack.py            # new stamp from the clock
    python backend\deploy\pack.py 20261111b  # explicit stamp

`?v=<stamp>` on every css/js makes the HTML reference a cache-safe URL, so a deploy is
visible immediately even though the files keep their names.
"""
import io
import os
import re
import sys
import time
import zipfile

ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "..", "home")
SKIP = {".git", "_work", "start.cmd"}
ASSETS = (
    "style.css", "footer.css", "collection.css", "achievements.css", "rise.css", "veil.css", "lang.css",
    "main.js", "intro.js", "i18n.js", "damping.js", "rise.js", "veil.js", "site.js", "collection.js", "achievements.js",
)
PAGES = ("index.html", "collection.html", "achievements.html")

stamp = sys.argv[1] if len(sys.argv) > 1 else time.strftime("%Y%m%d%H%M")

for page in PAGES:
    path = os.path.join(ROOT, page)
    h = io.open(path, encoding="utf-8").read()
    for a in ASSETS:
        h = re.sub(r'"%s(\?v=[0-9A-Za-z]*)?"' % re.escape(a), '"%s?v=%s"' % (a, stamp), h)
    io.open(path, "w", encoding="utf-8").write(h)
print("stamped pages with", stamp)

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ncl-site.zip")
if os.path.exists(out):
    os.remove(out)
n = 0
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    for base, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in SKIP]
        for f in files:
            if f in SKIP:
                continue
            p = os.path.join(base, f)
            arc = os.path.relpath(p, ROOT).replace("\\", "/")
            zi = zipfile.ZipInfo(arc, time.localtime(os.stat(p).st_mtime)[:6])
            zi.compress_type = zipfile.ZIP_DEFLATED
            zi.external_attr = 0o644 << 16
            z.writestr(zi, open(p, "rb").read())
            n += 1
print("zip:", n, "entries, %.1f MB" % (os.path.getsize(out) / 1048576))
