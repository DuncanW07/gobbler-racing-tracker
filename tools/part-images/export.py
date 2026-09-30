# PNG renders -> small white WebP files with transparency (brightness = opacity),
# so the site can tint them by status with a CSS mask.
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter

root = Path(__file__).resolve().parents[2]
src, dst, S = root / "tools/part-images/png", root / "public/parts", 320
fade = Image.new("L", (S, S), 0)
ImageDraw.Draw(fade).ellipse((6, 6, S - 6, S - 6), fill=255)
fade = fade.filter(ImageFilter.GaussianBlur(18))  # soft round edge, no square halo
for png in sorted(src.glob("*.png")):
    im = Image.open(png).convert("L").resize((S, S), Image.LANCZOS)
    a = ImageChops.multiply(im.point(lambda v: 0 if v < 26 else min(255, int((v - 26) * 1.45))), fade)
    out = Image.new("RGBA", (S, S), (255, 255, 255, 0))
    out.putalpha(a)
    out.save(dst / f"{png.stem}.webp", "WEBP", quality=82, method=6)
    print("exported", png.stem)
