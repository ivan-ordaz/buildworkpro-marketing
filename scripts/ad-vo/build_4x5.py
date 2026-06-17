#!/usr/bin/env python3
"""
Renders a 4:5 (feed) ad crop: the app shown FULL-WIDTH inside the navy brand frame.
No follow-zoom needed — the whole width is visible, so the cursor is always in frame;
the motion comes from the app demo itself. The magenta tracking dot is painted out.

Usage: build_4x5.py <clip> <source.mp4> <path.json> [max_seconds]
  -> writes public/videos/<clip>-4x5.mp4 (SILENT; run generate.sh after for VO)
"""
import os, sys, json, subprocess
import numpy as np, cv2

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ASSETS = os.path.join(os.path.dirname(__file__), "assets")
clip, SRC = sys.argv[1], sys.argv[2]
MAX_DUR = float(sys.argv[4]) if len(sys.argv) > 4 else None
OUT = os.path.join(ROOT, "public", "videos", f"{clip}-4x5.mp4")

CW, CH = 1080, 1350
NAVY_BGR = (42, 23, 13)
APP_W = 1040                              # app width inside the frame (20px margins)
APP_H = round(APP_W * 900 / 1440)         # 650, preserve 1440x900 aspect
APP_Y = (CH - APP_H) // 2                 # vertically centred
APP_X = (CW - APP_W) // 2
FPS = 25
HOOK_Y = APP_Y + 60

base = cv2.imread(os.path.join(ASSETS, "frame_base_4x5.png"))
hook = cv2.imread(os.path.join(ASSETS, f"hook_{clip}.png"), cv2.IMREAD_UNCHANGED)

cap = cv2.VideoCapture(SRC)
max_frames = int(MAX_DUR * FPS) if MAX_DUR else None
ff = subprocess.Popen(
    ["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "bgr24",
     "-s", f"{CW}x{CH}", "-r", str(FPS), "-i", "-",
     "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-preset", "medium",
     "-movflags", "+faststart", OUT],
    stdin=subprocess.PIPE)

i = 0
while True:
    if max_frames and i >= max_frames: break
    ok, src = cap.read()
    if not ok: break
    # paint out the magenta dot
    b, g, r = src[:,:,0].astype(int), src[:,:,1].astype(int), src[:,:,2].astype(int)
    m = ((r > 150) & (b > 150) & (g < 120) & (r-g > 60) & (b-g > 60)).astype(np.uint8)
    if m.any():
        m = cv2.dilate(m, np.ones((3,3), np.uint8), 1)
        src[m > 0] = (255, 255, 255)

    app = cv2.resize(src, (APP_W, APP_H), interpolation=cv2.INTER_LANCZOS4)
    frame = base.copy()
    frame[APP_Y:APP_Y+APP_H, APP_X:APP_X+APP_W] = app

    t = i / FPS
    if t < 3.05 and hook is not None:
        a = 1.0 if t < 2.6 else max(0.0, 1 - (t-2.6)/0.4)
        hh, hw = hook.shape[:2]
        hx = (CW - hw)//2
        roi = frame[HOOK_Y:HOOK_Y+hh, hx:hx+hw]
        al = (hook[:,:,3:4].astype(float)/255.0) * a
        roi[:] = (al*hook[:,:,:3] + (1-al)*roi).astype(np.uint8)

    ff.stdin.write(frame.astype(np.uint8).tobytes())
    i += 1

cap.release(); ff.stdin.close(); ff.wait()
print(f"wrote {OUT}  ({i} frames)")
