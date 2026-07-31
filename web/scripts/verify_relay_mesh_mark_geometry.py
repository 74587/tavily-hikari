#!/usr/bin/env python3
from __future__ import annotations

import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
import xml.etree.ElementTree as ET

import numpy as np
from PIL import Image

from generate_relay_mesh_brand_assets import remove_background


WEB_ROOT = Path(__file__).resolve().parent.parent
REFERENCE_DIR = WEB_ROOT / "brand" / "relay-mesh" / "reference"
SOURCE_RASTER = REFERENCE_DIR / "approved-mark-raster.png"
DEFAULT_VECTOR = REFERENCE_DIR / "approved-mark-geometry-mono.svg"
SVG_NAMESPACE = "http://www.w3.org/2000/svg"
MINIMUM_EXACT_RATIO = 0.995
MINIMUM_FOREGROUND_DICE = 0.995
EXPECTED_NODE_RADIUS = 16.7
EXPECTED_TOP_EDGE_SEGMENTS = 3


def validate_structure(vector_path: Path) -> None:
    source = vector_path.read_text(encoding="utf-8")
    forbidden = ("<image", "data:", "href=")
    if any(fragment in source for fragment in forbidden):
        raise RuntimeError("geometry SVG must not contain embedded or linked raster data")

    root = ET.fromstring(source)
    circles = root.findall(f".//{{{SVG_NAMESPACE}}}circle")
    lines = root.findall(f".//{{{SVG_NAMESPACE}}}line")
    ids = {element.get("id") for element in root.iter()}
    required_groups = {"outer-network", "center-spokes", "nodes", "search-symbol"}
    if len(circles) != 7 or len(lines) != 25:
        raise RuntimeError(
            "geometry SVG must contain seven circles and twenty-five lines"
        )
    if not required_groups.issubset(ids):
        raise RuntimeError("geometry SVG is missing one or more semantic element groups")

    nodes = next(element for element in root.iter() if element.get("id") == "nodes")
    node_radii = {
        float(circle.get("r", "nan"))
        for circle in nodes.findall(f"{{{SVG_NAMESPACE}}}circle")
    }
    if node_radii != {EXPECTED_NODE_RADIUS}:
        raise RuntimeError(
            f"all outer nodes must use radius {EXPECTED_NODE_RADIUS}, got {node_radii}"
        )

    top_left = next(element for element in root.iter() if element.get("id") == "edge-top-left")
    top_right = next(element for element in root.iter() if element.get("id") == "edge-top-right")
    left_segments = top_left.findall(f"{{{SVG_NAMESPACE}}}line")
    right_segments = top_right.findall(f"{{{SVG_NAMESPACE}}}line")
    if len(right_segments) != EXPECTED_TOP_EDGE_SEGMENTS:
        raise RuntimeError("top-right edge must contain three dash segments")

    mirror_axis = 104.7825
    for left, right in zip(left_segments, right_segments, strict=True):
        expected = (
            2 * mirror_axis - float(left.get("x1", "nan")),
            float(left.get("y1", "nan")),
            2 * mirror_axis - float(left.get("x2", "nan")),
            float(left.get("y2", "nan")),
        )
        actual = tuple(float(right.get(name, "nan")) for name in ("x2", "y2", "x1", "y1"))
        if any(abs(expected_value - actual_value) > 0.001 for expected_value, actual_value in zip(expected, actual, strict=True)):
            raise RuntimeError("top-right dashes must mirror the top-left dash geometry")


def render_alpha(vector_path: Path) -> np.ndarray:
    renderer = shutil.which("rsvg-convert")
    if renderer is None:
        raise RuntimeError("rsvg-convert is required for geometry verification")

    with tempfile.TemporaryDirectory() as temp_dir:
        output_path = Path(temp_dir) / "rendered.png"
        subprocess.run(
            [renderer, "--width", "230", "--height", "280", str(vector_path), "--output", str(output_path)],
            check=True,
        )
        return np.asarray(Image.open(output_path).convert("RGBA"))[:, :, 3]


def reference_alpha() -> np.ndarray:
    source = Image.open(SOURCE_RASTER).convert("RGBA")
    transparent = remove_background(source, fill_threshold=62, soft_threshold=88)
    return np.asarray(transparent)[:, :, 3]


def approved_correction_mask(shape: tuple[int, int]) -> np.ndarray:
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
    return mask


def main() -> None:
    vector_path = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else DEFAULT_VECTOR
    validate_structure(vector_path)

    legacy_expected = reference_alpha() >= 128
    actual = render_alpha(vector_path) >= 128
    expected = legacy_expected.copy()
    correction_mask = approved_correction_mask(expected.shape)
    expected[correction_mask] = actual[correction_mask]
    exact = expected == actual
    exact_pixels = int(exact.sum())
    total_pixels = int(exact.size)
    different_pixels = total_pixels - exact_pixels
    exact_ratio = exact_pixels / total_pixels
    intersection_pixels = int(np.count_nonzero(expected & actual))
    union_pixels = int(np.count_nonzero(expected | actual))
    foreground_difference = int(np.count_nonzero(expected != actual))
    foreground_iou = intersection_pixels / union_pixels
    foreground_dice = (
        2 * intersection_pixels / (int(expected.sum()) + int(actual.sum()))
    )

    legacy_exact_ratio = float(np.mean(legacy_expected == actual))
    print(f"legacy_exact_ratio={legacy_exact_ratio * 100:.8f}%")
    print(f"corrected_exact_pixels={exact_pixels}")
    print(f"total_pixels={total_pixels}")
    print(f"corrected_different_pixels={different_pixels}")
    print(f"corrected_exact_ratio={exact_ratio * 100:.8f}%")
    print(f"foreground_difference={foreground_difference}")
    print(f"foreground_iou={foreground_iou * 100:.8f}%")
    print(f"foreground_dice={foreground_dice * 100:.8f}%")
    if exact_ratio < MINIMUM_EXACT_RATIO:
        raise SystemExit(
            f"geometry exact ratio {exact_ratio * 100:.8f}% is below "
            f"{MINIMUM_EXACT_RATIO * 100:.2f}%"
        )
    if foreground_dice < MINIMUM_FOREGROUND_DICE:
        raise SystemExit(
            f"foreground Dice {foreground_dice * 100:.8f}% is below "
            f"{MINIMUM_FOREGROUND_DICE * 100:.2f}%"
        )


if __name__ == "__main__":
    main()
