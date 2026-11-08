"""NCL wordmark generator.

Constructs a Didone-style "NCL" from parameters on a 100-unit cap-height grid,
so the letterforms can be tuned by number instead of by hand. Writes an SVG that
inherits currentColor, plus a preview page for visual iteration.
"""
import math
import io
import os

CAP = 100.0

# --- parameters (tuned for a high-contrast, hairline-serifed Didone) ---
THICK = 14.5          # main stem
HAIR = 3.0            # slab serif thickness
OVER = 8.0            # serif overhang each side
N_W, C_W, L_W = 66.0, 67.0, 63.0
GAP_NC, GAP_CL = 17.0, 14.5

def sy(y):
    """font y (baseline 0, up positive) -> svg y (down positive)"""
    return CAP - y

def rect(x, y0, w, h):
    """rect from baseline y0 upward h"""
    return f'<rect x="{x:.2f}" y="{sy(y0 + h):.2f}" width="{w:.2f}" height="{h:.2f}"/>'

def poly(pts):
    p = " ".join(f"{x:.2f},{sy(y):.2f}" for x, y in pts)
    return f'<polygon points="{p}"/>'

def pol(x0, y0):
    return f'<polygon points="{x0:.2f},{sy(y0):.2f} {x0+THICK:.2f},{sy(y0):.2f} {x0+THICK:.2f},{sy(y0-HAIR*1.6):.2f} {x0:.2f},{sy(y0-HAIR*1.6):.2f}"/>'

# ---------------- N ----------------
def letter_N():
    out = []
    # left + right stems
    out.append(rect(0, 0, THICK, CAP))
    out.append(rect(N_W - THICK, 0, THICK, CAP))
    # diagonal, top-left to bottom-right, horizontal thickness THICK
    d = 16.0                      # diagonal carries more width than a stem, as Didone N does
    out.append(poly([(0, CAP), (N_W - d, 0), (N_W, 0), (d, CAP)]))
    # serifs: top-left, top-right, bottom-left, bottom-right
    for x in (0.0, N_W - THICK):
        out.append(rect(x - OVER, CAP - HAIR, THICK + 2 * OVER, HAIR))  # top slab
        out.append(rect(x - OVER, 0, THICK + 2 * OVER, HAIR))           # bottom slab
    return out

# ---------------- C ----------------
def letter_C(x0):
    cx, cy = C_W / 2.0, CAP / 2.0
    orx, ory = C_W / 2.0, CAP / 2.0
    irx, iry = orx - THICK + 0.5, ory - 10.5     # thick at the waist, tapering to the terminals
    a = math.radians(52.0)                        # terminal angle

    def pt(rx, ry, ang):
        return (x0 + cx + rx * math.cos(ang), CAP - (cy + ry * math.sin(ang)))

    o1, o2 = pt(orx, ory, a), pt(orx, ory, -a)
    i1, i2 = pt(irx, iry, a), pt(irx, iry, -a)
    d = (f'M{o1[0]:.2f},{o1[1]:.2f} '
         f'A{orx:.2f},{ory:.2f} 0 1 0 {o2[0]:.2f},{o2[1]:.2f} '
         f'L{i2[0]:.2f},{i2[1]:.2f} '
         f'A{irx:.2f},{iry:.2f} 0 1 1 {i1[0]:.2f},{i1[1]:.2f} Z')
    return [f'<path d="{d}"/>']

# ---------------- L ----------------
def letter_L(x0):
    foot = 6.0
    out = [rect(x0, 0, THICK, CAP),                     # stem
           rect(x0, 0, L_W, foot)]                      # thin foot
    # hairline serif rising from the end of the foot
    out.append(rect(x0 + L_W - 2.4, foot - 0.5, 2.4, 10.0))
    # top slab serif on the stem
    out.append(rect(x0 - OVER, CAP - HAIR, THICK + 2 * OVER, HAIR))
    # bottom-left slab
    out.append(rect(x0 - OVER, 0, THICK + 2 * OVER, HAIR))
    return out

def build():
    xn = 0.0
    xc = xn + N_W + GAP_NC
    xl = xc + C_W + GAP_CL
    total = xl + L_W
    body = letter_N() + letter_C(xc) + letter_L(xl)
    x0, w = -OVER, total + OVER
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0:.2f} 0 {w:.2f} {CAP:.0f}" '
           f'role="img" aria-label="NCL" fill="currentColor">'
           + "".join(body) + '</svg>')
    return svg, w

def preview(svg):
    rows = [
        ("120px", 120), ("56px", 56), ("30px", 30), ("22px", 22),
    ]
    items = "".join(
        f'<div class="row"><span class="lbl">{n}</span><span class="wm" style="--h:{h}px">{svg}</span></div>'
        for n, h in rows
    )
    return f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{{margin:0;background:#0a0908;color:#efe8db;font-family:system-ui;padding:40px}}
.row{{display:flex;align-items:center;gap:32px;margin-bottom:34px}}
.lbl{{width:70px;font:11px ui-monospace;letter-spacing:.2em;color:#8d8577}}
.wm{{display:block;height:var(--h);color:#e6ca94}}
.wm svg{{display:block;height:100%;width:auto}}
.alt{{background:#151210;padding:28px 40px;display:flex;gap:40px;align-items:center}}
.old{{height:56px;opacity:.55}}
</style></head><body>{items}
<div class="alt"><span class="lbl">on brass field</span><span class="wm" style="--h:56px">{svg}</span></div>
<div class="alt"><span class="lbl">old raster</span><img class="old" src="../assets/常规灯黑白图/logo B_副本.png"></div>
</body></html>"""

if __name__ == "__main__":
    svg, total = build()
    os.makedirs("home/media", exist_ok=True)
    io.open("home/media/ncl-wordmark.svg", "w", encoding="utf-8").write(svg)
    io.open("_work/logo-preview.html", "w", encoding="utf-8").write(preview(svg))
    print("width", total)
