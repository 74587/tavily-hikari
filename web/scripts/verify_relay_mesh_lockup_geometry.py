#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import shutil
import subprocess
import tempfile
import xml.etree.ElementTree as ET

import numpy as np
from PIL import Image

from generate_relay_mesh_brand_assets import remove_background


WEB_ROOT = Path(__file__).resolve().parent.parent
REFERENCE_DIR = WEB_ROOT / "brand" / "relay-mesh" / "reference"
RASTER_SOURCE = REFERENCE_DIR / "approved-lockup-raster.png"
FULL_VECTOR = REFERENCE_DIR / "approved-lockup-vector-light.svg"
COMPACT_VECTOR = REFERENCE_DIR / "approved-lockup-compact-vector-light.svg"
SVG_NAMESPACE = "http://www.w3.org/2000/svg"
MINIMUM_EXACT_RATIO = 0.995
MINIMUM_FOREGROUND_DICE = 0.995


def validate_structure(vector_path: Path, *, compact: bool) -> None:
    source = vector_path.read_text(encoding="utf-8")
    forbidden = ("<image", "<text", "data:", "href=")
    if any(fragment in source for fragment in forbidden):
        raise RuntimeError(f"{vector_path.name} must contain paths and shapes only")

    root = ET.fromstring(source)
    ids = {element.get("id") for element in root.iter()}
    required = {"mark-artwork", "wordmark", "wordmark-tavily", "wordmark-hikari"}
    if not required.issubset(ids):
        raise RuntimeError(f"{vector_path.name} is missing a required vector group")
    if compact and "tagline" in ids:
        raise RuntimeError("compact lockup must not contain the small tagline")
    if not compact and "tagline" not in ids:
        raise RuntimeError("full lockup must contain the small tagline")
    minimum_paths = 2 if compact else 5
    if len(root.findall(f".//{{{SVG_NAMESPACE}}}path")) < minimum_paths:
        raise RuntimeError(f"{vector_path.name} does not contain enough path geometry")


def render_alpha(vector_path: Path, height: int) -> np.ndarray:
    renderer = shutil.which("rsvg-convert")
    if renderer is None:
        raise RuntimeError("rsvg-convert is required for lockup verification")
    with tempfile.TemporaryDirectory() as temp_dir:
        output_path = Path(temp_dir) / "rendered.png"
        subprocess.run(
            [
                renderer,
                "--width",
                "1000",
                "--height",
                str(height),
                str(vector_path),
                "--output",
                str(output_path),
            ],
            check=True,
        )
        return np.asarray(Image.open(output_path).convert("RGBA"))[:, :, 3] >= 128


def reference_alpha(height: int) -> np.ndarray:
    source = Image.open(RASTER_SOURCE).convert("RGBA")
    transparent = remove_background(source, fill_threshold=60, soft_threshold=84)
    return np.asarray(transparent)[:height, :, 3] >= 128


def approved_correction_mask(shape: tuple[int, int], *, compact: bool) -> np.ndarray:
    y, x = np.ogrid[: shape[0], : shape[1]]
    mask = np.zeros(shape, dtype=bool)
    for center_x, center_y in (
        (104.7825, 27.66),
        (191.2975, 81.66),
        (191.6, 182.54),
        (104.825, 233.69),
        (18.64125, 182.6),
        (18.6425, 81.62),
    ):
        mask |= (x - center_x) ** 2 + (y - center_y) ** 2 <= 23**2
    mask |= (x >= 122) & (x <= 177) & (y >= 34) & (y <= 74)
    if compact:
        mask |= (x >= 315) & (y >= 205)
    return mask


def verify(vector_path: Path, *, height: int, compact: bool) -> None:
    validate_structure(vector_path, compact=compact)
    legacy_expected = reference_alpha(height)
    actual = render_alpha(vector_path, height)
    expected = legacy_expected.copy()
    correction_mask = approved_correction_mask(expected.shape, compact=compact)
    expected[correction_mask] = actual[correction_mask]

    exact = expected == actual
    intersection = int(np.count_nonzero(expected & actual))
    foreground_dice = 2 * intersection / (int(expected.sum()) + int(actual.sum()))
    exact_ratio = float(np.mean(exact))
    legacy_exact_ratio = float(np.mean(legacy_expected == actual))
    print(f"{vector_path.name}.legacy_exact_ratio={legacy_exact_ratio * 100:.8f}%")
    print(f"{vector_path.name}.corrected_exact_ratio={exact_ratio * 100:.8f}%")
    print(f"{vector_path.name}.foreground_dice={foreground_dice * 100:.8f}%")
    if exact_ratio < MINIMUM_EXACT_RATIO:
        raise SystemExit(f"{vector_path.name} exact ratio is below 99.5%")
    if foreground_dice < MINIMUM_FOREGROUND_DICE:
        raise SystemExit(f"{vector_path.name} foreground Dice is below 99.5%")


def main() -> None:
    verify(FULL_VECTOR, height=310, compact=False)
    verify(COMPACT_VECTOR, height=260, compact=True)


if __name__ == "__main__":
    main()
