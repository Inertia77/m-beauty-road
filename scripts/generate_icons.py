#!/usr/bin/env python3
"""Generate deterministic PWA icon variants from assets/icon-source.svg."""
from io import BytesIO
from pathlib import Path

import cairosvg
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "icon-source.svg"
ASSETS = ROOT / "assets"
BG = (241, 223, 214)


def render_svg(size: int) -> Image.Image:
    png = cairosvg.svg2png(url=str(SOURCE), output_width=size, output_height=size)
    rendered = Image.open(BytesIO(png)).convert("RGBA")
    flattened = Image.new("RGBA", (size, size), BG + (255,))
    flattened.alpha_composite(rendered)
    return flattened.convert("RGB")


def save_png(image: Image.Image, path: Path) -> None:
    image.save(path, "PNG", optimize=True)
    with Image.open(path) as check:
        check.load()
        if check.size != image.size:
            raise RuntimeError(f"unexpected icon size for {path}: {check.size}")


def main() -> None:
    master = render_svg(1024)
    icon_512 = master.resize((512, 512), Image.Resampling.LANCZOS)
    icon_192 = master.resize((192, 192), Image.Resampling.LANCZOS)
    apple_180 = master.resize((180, 180), Image.Resampling.LANCZOS)

    # Android adaptive masks can crop aggressively. Keep all identifying artwork
    # inside the central safe region instead of pretending a regular icon is maskable.
    maskable = Image.new("RGB", (512, 512), BG)
    safe = master.resize((384, 384), Image.Resampling.LANCZOS)
    maskable.paste(safe, ((512 - 384) // 2, (512 - 384) // 2))

    save_png(icon_192, ASSETS / "icon-192.png")
    save_png(icon_512, ASSETS / "icon-512.png")
    save_png(apple_180, ASSETS / "apple-touch-icon-180.png")
    save_png(maskable, ASSETS / "maskable-icon-512.png")

    print("Generated icon-192.png, icon-512.png, apple-touch-icon-180.png, maskable-icon-512.png")


if __name__ == "__main__":
    main()
