#!/usr/bin/env python3
"""Generate the default Open Graph card for AutonomIA.

Output: site/assets/og-default.png  (1200 x 630, AutonomIA dark brand)

Re-run after editing copy or palette. The generated PNG is committed so
deploys do not need PIL on the runner.
"""
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "site" / "assets" / "og-default.png"

W, H = 1200, 630
BG = (11, 13, 18)
ACCENT = (99, 102, 241)
ACCENT_SOFT = (99, 102, 241, 90)
FG = (245, 246, 250)
MUTED = (154, 161, 178)

FONT_REGULAR = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
FONT_MONO = "/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf"


def radial_glow() -> Image.Image:
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    cx, cy = int(W * 0.18), int(H * 0.05)
    max_r = int(W * 0.7)
    draw = ImageDraw.Draw(glow)
    for r in range(max_r, 0, -8):
        alpha = int(95 * (1 - r / max_r) ** 2)
        if alpha <= 0:
            continue
        draw.ellipse(
            (cx - r, cy - r, cx + r, cy + r),
            fill=(ACCENT[0], ACCENT[1], ACCENT[2], alpha),
        )
    return glow.filter(ImageFilter.GaussianBlur(radius=24))


def draw_dot_grid(draw: ImageDraw.ImageDraw) -> None:
    spacing = 28
    for x in range(0, W, spacing):
        for y in range(0, H, spacing):
            draw.point((x, y), fill=(40, 44, 60))


def draw_brand(draw: ImageDraw.ImageDraw) -> None:
    pad = 64
    badge = ImageFont.truetype(FONT_BOLD, 30)
    draw.rectangle(
        (pad - 14, pad - 8, pad + 70, pad + 38),
        outline=ACCENT,
        width=2,
    )
    draw.text((pad, pad - 4), "IA", font=badge, fill=ACCENT)
    name = ImageFont.truetype(FONT_BOLD, 30)
    draw.text((pad + 92, pad - 4), "AutonomIA", font=name, fill=FG)


def wrap_text(text: str, font: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current: list[str] = []
    for word in words:
        candidate = " ".join(current + [word])
        bbox = font.getbbox(candidate)
        if bbox[2] - bbox[0] <= max_width or not current:
            current.append(word)
        else:
            lines.append(" ".join(current))
            current = [word]
    if current:
        lines.append(" ".join(current))
    return lines


def draw_headline(draw: ImageDraw.ImageDraw) -> None:
    pad = 64
    title_font = ImageFont.truetype(FONT_BOLD, 84)
    headline = "IA que entiende tu negocio."
    lines = wrap_text(headline, title_font, W - pad * 2)
    y = 220
    for line in lines:
        draw.text((pad, y), line, font=title_font, fill=FG)
        y += 96

    subtitle_font = ImageFont.truetype(FONT_REGULAR, 32)
    subtitle = (
        "Asesoramiento y automatizaciones gobernadas por agentes "
        "para empresas que quieren adoptar IA sin pelearse con la infraestructura."
    )
    sub_lines = wrap_text(subtitle, subtitle_font, W - pad * 2)
    y += 16
    for line in sub_lines[:3]:
        draw.text((pad, y), line, font=subtitle_font, fill=MUTED)
        y += 44


def draw_footer(draw: ImageDraw.ImageDraw) -> None:
    pad = 64
    foot_font = ImageFont.truetype(FONT_MONO, 22)
    url_font = ImageFont.truetype(FONT_BOLD, 26)
    draw.text((pad, H - pad - 30), "ia.itera.es", font=url_font, fill=ACCENT)
    tag = "Sitio gobernado por agentes · Itera"
    bbox = foot_font.getbbox(tag)
    tw = bbox[2] - bbox[0]
    draw.text((W - pad - tw, H - pad - 28), tag, font=foot_font, fill=MUTED)


def main() -> None:
    img = Image.new("RGB", (W, H), BG)
    grid_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw_dot_grid(ImageDraw.Draw(grid_layer))
    img.paste(grid_layer, (0, 0), grid_layer)

    glow = radial_glow()
    img.paste(glow, (0, 0), glow)

    draw = ImageDraw.Draw(img, "RGBA")
    draw_brand(draw)
    draw_headline(draw)
    draw_footer(draw)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT, format="PNG", optimize=True)
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
