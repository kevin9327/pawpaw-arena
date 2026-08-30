"""멍냥아레나 앱 아이콘·스토어 자산 생성.
브랜드 그린 배경 + 귀여운 고양이 얼굴(게임 캐릭터와 동일 톤). PIL만 사용.
"""
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), '..', 'app', 'src', 'main', 'res')
STORE = os.path.join(os.path.dirname(__file__), '..', '..', 'store_assets')
os.makedirs(STORE, exist_ok=True)

GREEN = (106, 168, 79)       # #6aa84f 브랜드
GREEN_D = (74, 107, 58)      # #4a6b3a
CAT = (184, 198, 232)        # 고양이 몸(파스텔 블루) — 게임과 동일
CAT_EAR = (143, 163, 212)    # 귀(진한 톤)
PINK = (231, 134, 166)
DARK = (34, 34, 34)
WHITE = (255, 255, 255)


def draw_cat(sz, bg=True, pad_frac=0.0):
    """정사각 아이콘 한 장 렌더. sz=픽셀. bg=배경 채움."""
    S = sz * 4  # 슈퍼샘플
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if bg:
        r = int(S * 0.22)
        d.rounded_rectangle([0, 0, S, S], radius=r, fill=GREEN)
    cx, cy = S / 2, S / 2 + S * 0.03
    R = S * (0.30 - pad_frac)
    # 귀 (몸 뒤 삼각형)
    for sgn in (-1, 1):
        ex = cx + sgn * R * 0.62
        ey = cy - R * 0.62
        d.polygon([
            (ex - R * 0.34, ey + R * 0.30),
            (ex + R * 0.40 * sgn, ey - R * 0.55),
            (ex + R * 0.34, ey + R * 0.30),
        ], fill=CAT_EAR)
        # 귀 안쪽 핑크
        d.polygon([
            (ex - R * 0.16, ey + R * 0.14),
            (ex + R * 0.20 * sgn, ey - R * 0.30),
            (ex + R * 0.16, ey + R * 0.14),
        ], fill=PINK)
    # 얼굴
    d.ellipse([cx - R, cy - R, cx + R, cy + R], fill=CAT)
    # 눈
    for sgn in (-1, 1):
        ex = cx + sgn * R * 0.40
        ey = cy - R * 0.05
        rr = R * 0.15
        d.ellipse([ex - rr, ey - rr * 1.25, ex + rr, ey + rr * 1.25], fill=DARK)
        d.ellipse([ex - rr * 0.35, ey - rr * 0.85, ex + rr * 0.25, ey - rr * 0.15], fill=WHITE)
    # 코
    d.polygon([
        (cx - R * 0.11, cy + R * 0.24),
        (cx + R * 0.11, cy + R * 0.24),
        (cx, cy + R * 0.38),
    ], fill=PINK)
    # 입 (w)
    d.line([(cx, cy + R * 0.38), (cx, cy + R * 0.50)], fill=DARK, width=max(2, int(S * 0.006)))
    d.arc([cx - R * 0.26, cy + R * 0.34, cx, cy + R * 0.62], 20, 160, fill=DARK, width=max(2, int(S * 0.006)))
    d.arc([cx, cy + R * 0.34, cx + R * 0.26, cy + R * 0.62], 20, 160, fill=DARK, width=max(2, int(S * 0.006)))
    # 수염
    wlen = R * 0.55
    for sgn in (-1, 1):
        bx = cx + sgn * R * 0.30
        for dy in (-R * 0.06, R * 0.06, R * 0.18):
            d.line([(bx, cy + R * 0.26 + dy),
                    (bx + sgn * wlen, cy + R * 0.20 + dy)],
                   fill=(120, 120, 120, 220), width=max(2, int(S * 0.004)))
    return img.resize((sz, sz), Image.LANCZOS)


# 1) PNG 런처 아이콘 (모든 밀도, pre-26 폴백 포함)
DENS = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
for name, px in DENS.items():
    folder = os.path.join(OUT, 'mipmap-' + name)
    os.makedirs(folder, exist_ok=True)
    icon = draw_cat(px, bg=True)
    icon.save(os.path.join(folder, 'ic_launcher.png'))
    # round: 원형 마스크
    rnd = draw_cat(px, bg=True)
    mask = Image.new('L', (px, px), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, px, px], fill=255)
    rnd.putalpha(mask)
    rnd.save(os.path.join(folder, 'ic_launcher_round.png'))
    print('wrote', folder)

# 2) 스토어 아이콘 512 (배경 있음)
draw_cat(512, bg=True).save(os.path.join(STORE, 'icon_512.png'))
# 3) 적응형 아이콘 foreground용 108dp @ xxxhdpi=432, 안전영역 고려해 여백
fg = Image.new('RGBA', (432, 432), (0, 0, 0, 0))
cat = draw_cat(432, bg=False, pad_frac=0.02)
fg.alpha_composite(cat)
adir = os.path.join(OUT, 'drawable')
os.makedirs(adir, exist_ok=True)
fg.save(os.path.join(adir, 'ic_launcher_fg.png'))
print('wrote store icon_512 + adaptive fg')

# 4) 피처 그래픽 1024x500
fw, fh = 1024, 500
feat = Image.new('RGBA', (fw, fh), GREEN)
fd = ImageDraw.Draw(feat)
# 은은한 격자
for x in range(0, fw, 64):
    fd.line([(x, 0), (x, fh)], fill=(255, 255, 255, 22), width=1)
for y in range(0, fh, 64):
    fd.line([(0, y), (fw, y)], fill=(255, 255, 255, 22), width=1)
# 왼쪽 고양이
c = draw_cat(360, bg=False)
feat.alpha_composite(c, (70, 70))
# 텍스트 대신 도형 로고감 — 제목은 스토어 필드로. 오른쪽에 발바닥 점 장식
for i, (px, py, pr) in enumerate([(560, 150, 30), (640, 120, 34), (720, 150, 30), (620, 210, 46)]):
    fd.ellipse([px - pr, py - pr, px + pr, py + pr], fill=(255, 255, 255, 210))
feat.convert('RGB').save(os.path.join(STORE, 'feature_graphic_1024x500.png'))
print('wrote feature graphic')
print('DONE')
