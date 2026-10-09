#!/usr/bin/env python3
"""
Extracts the cursor path from a demo take recorded with CAPTURE_TRACK_DOT=1
(marketing-capture/lib/cursor.mjs puts a 5px pure-magenta dot inside the fake
cursor). Writes the path.json that build_9x16_follow.py and build_4x5.py read:

    {"x": [...], "y": [...], "found": <frames with a dot>, "frames": <total>}

One x/y per video frame, in source-video pixels (1440x900). The point is the
mouse position, where clicks land: the cursor element is translated to the
mouse point and the 5px dot sits at (7,6) inside it, so the dot's centroid
minus (9.5, 8.5) is the mouse point.

Frames where the dot can't be seen (it is under nothing — the cursor is always
on top — but H.264 can smear a 5px dot on busy frames) are filled by linear
interpolation between the nearest detected frames; leading/trailing gaps hold
the first/last detection. Fails if the dot is found in under half the frames,
which means the take wasn't recorded with CAPTURE_TRACK_DOT=1.

Usage: extract_path.py <source.mp4> <path.json>
"""
import sys, json
import numpy as np, cv2

SRC, OUT = sys.argv[1], sys.argv[2]
DOT_DX, DOT_DY = 9.5, 8.5


def dot_mask(frame):
    # Same test the renderers use to paint the dot out (BGR frame).
    b, g, r = (frame[:, :, i].astype(int) for i in range(3))
    return (r > 150) & (b > 150) & (g < 120) & (r - g > 60) & (b - g > 60)


cap = cv2.VideoCapture(SRC)
xs, ys = [], []
while True:
    ok, frame = cap.read()
    if not ok:
        break
    m = dot_mask(frame)
    n, labels, stats, cents = cv2.connectedComponentsWithStats(m.astype(np.uint8), 8)
    if n > 1:
        # Largest magenta blob is the dot (stray antialiased pixels are tiny).
        k = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
        cx, cy = cents[k]
        xs.append(cx - DOT_DX)
        ys.append(cy - DOT_DY)
    else:
        xs.append(np.nan)
        ys.append(np.nan)
cap.release()

x, y = np.array(xs, float), np.array(ys, float)
frames = len(x)
found = int(np.count_nonzero(~np.isnan(x)))
if frames == 0 or found < frames / 2:
    sys.exit(f"tracking dot found in {found}/{frames} frames — record with CAPTURE_TRACK_DOT=1")

idx = np.arange(frames)
ok = ~np.isnan(x)
# np.interp holds the end values flat outside the detected range.
x = np.interp(idx, idx[ok], x[ok])
y = np.interp(idx, idx[ok], y[ok])

with open(OUT, "w") as f:
    json.dump({"x": [round(v, 1) for v in x], "y": [round(v, 1) for v in y],
               "found": found, "frames": frames}, f)
print(f"wrote {OUT}: dot in {found}/{frames} frames")
