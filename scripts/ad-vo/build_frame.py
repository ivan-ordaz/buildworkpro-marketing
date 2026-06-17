#!/usr/bin/env python3
"""
Builds the static brand assets for the 9:16 Meta ad crops:
  - frame_base.png : 1080x1920 solid-navy canvas with the logo + "$79/mo" top band
                     and "14-day free trial / buildworkpro.com" bottom band. The middle
                     stays plain navy (it gets covered by the zoomed app video).
  - hook_<clip>.png: per-clip rounded "hook" pill (opaque navy + amber border, white text)
                     that the video step overlays for the first 3s and fades out.

Layout constants are shared with build_9x16.sh (WINDOW_* must match).
Run: python3 scripts/ad-vo/build_frame.py
"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(os.path.dirname(__file__), "assets")
os.makedirs(OUT, exist_ok=True)

W, H = 1080, 1920
NAVY = (13, 23, 42)          # #0D172A — brand rail navy
WHITE = (255, 255, 255)
MUTED = (148, 163, 184)      # slate-400
AMBER = (245, 158, 11)       # #F59E0B — brand accent

# Window where the app video lives (MUST match build_9x16.sh)
WIN_X, WIN_Y, WIN_W, WIN_H = 20, 270, 1040, 1400

def font(paths, size):
    for p in paths:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    return ImageFont.load_default()

BOLD = ["/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/System/Library/Fonts/HelveticaNeue.ttc",
        "/Library/Fonts/Arial Bold.ttf"]
REG  = ["/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc"]

def center_text(d, cx, y, text, fnt, fill, anchor="mm"):
    d.text((cx, y), text, font=fnt, fill=fill, anchor=anchor)

def build_base():
    im = Image.new("RGB", (W, H), NAVY)
    d = ImageDraw.Draw(im)

    # --- top band: logo + price line ---
    logo = Image.open(os.path.join(ROOT, "public", "logo_white.png")).convert("RGBA")
    lw = 460
    lh = round(logo.height * lw / logo.width)
    logo = logo.resize((lw, lh), Image.LANCZOS)
    im.paste(logo, ((W - lw) // 2, 46), logo)
    center_text(d, W // 2, 215, "$79/mo flat — built for subs", font(BOLD, 44), WHITE)

    # --- bottom band: trial line + url ---
    center_text(d, W // 2, 1740, "14-day free trial  ·  no credit card", font(REG, 38), MUTED)
    center_text(d, W // 2, 1820, "buildworkpro.com", font(BOLD, 52), AMBER)

    im.save(os.path.join(OUT, "frame_base.png"))
    print("wrote frame_base.png", im.size)

def build_hook(clip, lines):
    # measure
    fnt = font(BOLD, 56)
    pad_x, pad_y, gap = 48, 34, 12
    tmp = Image.new("RGBA", (10, 10)); td = ImageDraw.Draw(tmp)
    widths, heights = [], []
    for ln in lines:
        b = td.textbbox((0, 0), ln, font=fnt)
        widths.append(b[2] - b[0]); heights.append(b[3] - b[1])
    tw = max(widths)
    th = sum(heights) + gap * (len(lines) - 1)
    pw, ph = tw + pad_x * 2, th + pad_y * 2
    pill = Image.new("RGBA", (pw, ph), (0, 0, 0, 0))
    pd = ImageDraw.Draw(pill)
    r = 30
    pd.rounded_rectangle([0, 0, pw - 1, ph - 1], radius=r, fill=(15, 27, 51, 255), outline=AMBER + (255,), width=4)
    y = pad_y
    for i, ln in enumerate(lines):
        b = td.textbbox((0, 0), ln, font=fnt)
        lw_ = b[2] - b[0]
        pd.text(((pw - lw_) // 2 - b[0], y - b[1]), ln, font=fnt, fill=WHITE)
        y += heights[i] + gap
    pill.save(os.path.join(OUT, f"hook_{clip}.png"))
    print(f"wrote hook_{clip}.png", pill.size)

def build_base_4x5():
    # 1080x1350 feed frame: same navy brand bands, app shown full-width in the middle.
    W2, H2 = 1080, 1350
    im = Image.new("RGB", (W2, H2), NAVY)
    d = ImageDraw.Draw(im)
    logo = Image.open(os.path.join(ROOT, "public", "logo_white.png")).convert("RGBA")
    lw = 400; lh = round(logo.height * lw / logo.width)
    logo = logo.resize((lw, lh), Image.LANCZOS)
    im.paste(logo, ((W2 - lw) // 2, 70), logo)
    center_text(d, W2 // 2, 235, "$79/mo flat — built for subs", font(BOLD, 40), WHITE)
    center_text(d, W2 // 2, 1175, "14-day free trial  ·  no credit card", font(REG, 34), MUTED)
    center_text(d, W2 // 2, 1250, "buildworkpro.com", font(BOLD, 46), AMBER)
    im.save(os.path.join(OUT, "frame_base_4x5.png"))
    print("wrote frame_base_4x5.png", im.size)

if __name__ == "__main__":
    build_base()
    build_base_4x5()
    build_hook("create-bid",  ["Paying thousands a year", "for Procore?"])
    build_hook("pay-app-demo", ["Still doing pay apps", "in Excel?"])
    build_hook("product-tour", ["Juggling 5 apps to", "run your jobs?"])
