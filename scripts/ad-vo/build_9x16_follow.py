#!/usr/bin/env python3
"""
Renders a 9:16 ad crop that OPENS on the full-width app then pushes in to fill the
navy brand frame, with the crop CENTER tracking the cursor (so the action never
drifts off the edge). The cursor path comes from the magenta tracking dot baked
into the re-captured demo (see marketing-capture CAPTURE_TRACK_DOT); that dot is
painted out here (recoloured to the arrow's white) so it never ships.

Usage: build_9x16_follow.py <clip> <source.mp4> <path.json> [max_seconds]
  -> writes public/videos/<clip>-9x16.mp4 (SILENT; run generate.sh after for VO)
  max_seconds (optional) trims the render to keep the clip tight (VO + short tail).

Window geometry must match build_frame.py.
"""
import os, sys, json, subprocess
import numpy as np, cv2

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ASSETS = os.path.join(os.path.dirname(__file__), "assets")
clip, SRC, PATH = sys.argv[1], sys.argv[2], sys.argv[3]
MAX_DUR = float(sys.argv[4]) if len(sys.argv) > 4 else None
OUT = os.path.join(ROOT, "public", "videos", f"{clip}-9x16.mp4")

CW, CH = 1080, 1920
NAVY_BGR = (42, 23, 13)                 # #0D172A
WIN_X, WIN_Y, WIN_W, WIN_H = 20, 270, 1040, 1400
FPS = 25
S_START = WIN_W / 1440.0                # fit source width into the window (~0.722)
S_END = 1.60                            # fill the window height (slightly over)
HOLD_S, RAMP_S = 0.6, 1.9               # hold full-width, then push in
HOOK_Y = 560
CAM_SIGMA = 7                           # camera glide smoothing (frames)

base = cv2.imread(os.path.join(ASSETS, "frame_base.png"))        # BGR 1080x1920
hook = cv2.imread(os.path.join(ASSETS, f"hook_{clip}.png"), cv2.IMREAD_UNCHANGED)  # BGRA

p = json.load(open(PATH))
px, py = np.array(p["x"]), np.array(p["y"])
def smooth(a, s):
    k = int(s*4) | 1; t = np.arange(k)-k//2; w = np.exp(-(t*t)/(2*s*s)); w /= w.sum()
    return np.convolve(np.pad(a, k//2, "edge"), w, "valid")
cam_x, cam_y = smooth(px, CAM_SIGMA), smooth(py, CAM_SIGMA)

cap = cv2.VideoCapture(SRC)
N = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
ff = subprocess.Popen(
    ["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "bgr24",
     "-s", f"{CW}x{CH}", "-r", str(FPS), "-i", "-",
     "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-preset", "medium",
     "-movflags", "+faststart", OUT],
    stdin=subprocess.PIPE)

def smoothstep(u): u = max(0.0, min(1.0, u)); return u*u*(3-2*u)

max_frames = int(MAX_DUR * FPS) if MAX_DUR else None
i = 0
while True:
    if max_frames and i >= max_frames: break
    ok, src = cap.read()
    if not ok: break
    # paint out the magenta dot -> white (arrow interior)
    b, g, r = src[:,:,0].astype(int), src[:,:,1].astype(int), src[:,:,2].astype(int)
    m = ((r > 150) & (b > 150) & (g < 120) & (r-g > 60) & (b-g > 60)).astype(np.uint8)
    if m.any():
        m = cv2.dilate(m, np.ones((3,3), np.uint8), 1)
        src[m > 0] = (255, 255, 255)

    t = i / FPS
    s = S_START + (S_END - S_START) * smoothstep((t - HOLD_S) / RAMP_S)
    # horizontal: follow cursor, clamped so the view stays inside the source
    halfw = WIN_W / (2*s)
    lo, hi = halfw, 1440 - halfw
    cx = (lo+hi)/2 if lo > hi else min(max(cam_x[min(i, len(cam_x)-1)], lo), hi)
    # vertical: follow only if zoomed past full-height fill; else lock to centre
    halfh = WIN_H / (2*s)
    lo2, hi2 = halfh, 900 - halfh
    cy = 450 if lo2 > hi2 else min(max(cam_y[min(i, len(cam_y)-1)], lo2), hi2)

    M = np.array([[s, 0, WIN_W/2 - s*cx], [0, s, WIN_H/2 - s*cy]], dtype=np.float32)
    win = cv2.warpAffine(src, M, (WIN_W, WIN_H), flags=cv2.INTER_LANCZOS4,
                         borderMode=cv2.BORDER_CONSTANT, borderValue=NAVY_BGR)
    frame = base.copy()
    frame[WIN_Y:WIN_Y+WIN_H, WIN_X:WIN_X+WIN_W] = win

    # hook pill for the first 3s, alpha fade 2.6->3.0
    if t < 3.05 and hook is not None:
        a = 1.0 if t < 2.6 else max(0.0, 1 - (t-2.6)/0.4)
        hh, hw = hook.shape[:2]
        hx = (CW - hw)//2
        roi = frame[HOOK_Y:HOOK_Y+hh, hx:hx+hw]
        al = (hook[:,:,3:4].astype(float)/255.0) * a
        roi[:] = (al*hook[:,:,:3] + (1-al)*roi).astype(np.uint8)

    ff.stdin.write(frame.astype(np.uint8).tobytes())
    i += 1

cap.release()
ff.stdin.close()
ff.wait()
print(f"wrote {OUT}  ({i} frames)")
