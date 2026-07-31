#!/usr/bin/env python3
from __future__ import annotations

from copy import deepcopy
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
MINIMUM_WORDMARK_OUTLINE_DICE = 0.995
TAGLINE_HEIGHT_RANGE = range(36, 40)
TAGLINE_WIDTH_RANGE = range(625, 636)
TAGLINE_WORDMARK_GAP_RANGE = range(20, 29)
TAGLINE_CENTER_RANGE = range(610, 621)
FULL_LOCKUP_HEIGHT = 310
WORDMARK_SHIFT_Y = -34
WORDMARK_TRANSLATE = "translate(0 -34)"
WORDMARK_SOURCE_TOP = 55
WORDMARK_SOURCE_BOTTOM = 205
WORDMARK_SOURCE_LEFT = 240
WORDMARK_SOURCE_RIGHT = 990

TAGLINE_LIGHT_STOPS = ((109, 40, 217), (3, 105, 161))
TAGLINE_DARK_STOPS = ((167, 139, 250), (56, 189, 248))
LIGHT_REFERENCE_BACKGROUND = (244, 241, 250)
DARK_REFERENCE_BACKGROUND = (23, 19, 29)


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
    tagline_groups = {"tagline-primary", "tagline-separator", "tagline-secondary"}
    if not compact and not tagline_groups.issubset(ids):
        raise RuntimeError("full lockup must preserve the approved three-part tagline structure")
    if not compact and "tagline-flow-gradient" not in ids:
        raise RuntimeError("full lockup must use one continuous tagline gradient")
    if not compact and any(gradient in ids for gradient in ("tagline-primary-gradient", "tagline-secondary-gradient")):
        raise RuntimeError("full lockup must not split the tagline into hard color segments")
    wordmark = next((element for element in root.iter() if element.get("id") == "wordmark"), None)
    if wordmark is None:
        raise RuntimeError(f"{vector_path.name} is missing the wordmark group")
    if compact and wordmark.get("transform") is not None:
        raise RuntimeError("compact lockup must preserve the original wordmark placement")
    if not compact and wordmark.get("transform") != WORDMARK_TRANSLATE:
        raise RuntimeError("full lockup must align the full wordmark with the two-line text block")
    minimum_paths = 2 if compact else 4
    path_count = len(root.findall(f".//{{{SVG_NAMESPACE}}}path"))
    circle_count = len(root.findall(f".//{{{SVG_NAMESPACE}}}circle"))
    if path_count < minimum_paths or (not compact and circle_count < 1):
        raise RuntimeError(f"{vector_path.name} does not contain enough outlined text and separator geometry")


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


def render_group_alpha(vector_path: Path, group_id: str, height: int) -> np.ndarray:
    root = ET.parse(vector_path).getroot()
    definitions = root.find(f"{{{SVG_NAMESPACE}}}defs")
    group = next((element for element in root.iter() if element.get("id") == group_id), None)
    if definitions is None or group is None:
        raise RuntimeError(f"{vector_path.name} is missing group {group_id}")

    isolated_root = ET.Element(root.tag, dict(root.attrib))
    isolated_root.append(deepcopy(definitions))
    isolated_root.append(deepcopy(group))
    with tempfile.TemporaryDirectory() as temp_dir:
        vector_path = Path(temp_dir) / f"{group_id}.svg"
        ET.ElementTree(isolated_root).write(vector_path, encoding="utf-8", xml_declaration=True)
        return render_alpha(vector_path, height)


def reference_alpha(height: int) -> np.ndarray:
    source = Image.open(RASTER_SOURCE).convert("RGBA")
    transparent = remove_background(source, fill_threshold=60, soft_threshold=84)
    alpha = np.asarray(transparent)[:, :, 3] >= 128
    if alpha.shape[0] >= height:
        return alpha[:height]
    return np.pad(alpha, ((0, height - alpha.shape[0]), (0, 0)))


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
        mask |= (x >= 210) & (y >= 205)
    return mask


def relative_luminance(rgb: tuple[int, int, int]) -> float:
    channels = []
    for value in rgb:
        channel = value / 255
        channels.append(channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4)
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]


def contrast_ratio(left: tuple[int, int, int], right: tuple[int, int, int]) -> float:
    lighter, darker = sorted((relative_luminance(left), relative_luminance(right)), reverse=True)
    return (lighter + 0.05) / (darker + 0.05)


def foreground_dice(expected: np.ndarray, actual: np.ndarray) -> float:
    total = int(expected.sum()) + int(actual.sum())
    if total == 0:
        return 1.0
    return 2 * int(np.count_nonzero(expected & actual)) / total


def verify_outline(label: str, expected: np.ndarray, actual: np.ndarray, *, minimum_dice: float) -> None:
    dice = foreground_dice(expected, actual)
    print(f"{label}.foreground_dice={dice * 100:.8f}%")
    if dice < minimum_dice:
        raise SystemExit(f"{label} foreground Dice is below {minimum_dice * 100:.1f}%")


def expected_wordmark_alpha() -> np.ndarray:
    source = reference_alpha(FULL_LOCKUP_HEIGHT)
    expected = np.zeros_like(source)
    target_top = WORDMARK_SOURCE_TOP + WORDMARK_SHIFT_Y
    target_bottom = WORDMARK_SOURCE_BOTTOM + WORDMARK_SHIFT_Y
    expected[target_top:target_bottom, WORDMARK_SOURCE_LEFT:WORDMARK_SOURCE_RIGHT] = source[
        WORDMARK_SOURCE_TOP:WORDMARK_SOURCE_BOTTOM,
        WORDMARK_SOURCE_LEFT:WORDMARK_SOURCE_RIGHT,
    ]
    return expected


def verify_full_lockup_outline_contract() -> None:
    verify_outline(
        "full.wordmark",
        expected_wordmark_alpha(),
        render_group_alpha(FULL_VECTOR, "wordmark", FULL_LOCKUP_HEIGHT),
        minimum_dice=MINIMUM_WORDMARK_OUTLINE_DICE,
    )


def verify_tagline_contract() -> None:
    tagline = render_group_alpha(FULL_VECTOR, "tagline", FULL_LOCKUP_HEIGHT)
    wordmark = render_group_alpha(FULL_VECTOR, "wordmark", FULL_LOCKUP_HEIGHT)
    tagline_ys, tagline_xs = np.nonzero(tagline)
    wordmark_ys, wordmark_xs = np.nonzero(wordmark)
    if not len(tagline_xs) or not len(wordmark_xs):
        raise RuntimeError("full lockup does not render its two-line text block")
    height = int(tagline_ys.max() - tagline_ys.min() + 1)
    width = int(tagline_xs.max() - tagline_xs.min() + 1)
    gap = int(tagline_ys.min() - wordmark_ys.max() - 1)
    center = int(round((tagline_xs.min() + tagline_xs.max() + 1) / 2))
    print(f"tagline.outline_bbox={tagline_xs.min()},{tagline_ys.min()},{tagline_xs.max() + 1},{tagline_ys.max() + 1}")
    print(f"tagline.outline_height={height}")
    print(f"tagline.outline_width={width}")
    print(f"tagline.wordmark_gap={gap}")
    print(f"tagline.horizontal_center={center}")
    if height not in TAGLINE_HEIGHT_RANGE:
        raise RuntimeError("tagline outline height must remain between 36 and 39 SVG units")
    if width not in TAGLINE_WIDTH_RANGE:
        raise RuntimeError("tagline outline width must remain between 625 and 645 SVG units")
    if gap not in TAGLINE_WORDMARK_GAP_RANGE:
        raise RuntimeError("tagline must keep 20 to 28 SVG units below the wordmark")
    if center not in TAGLINE_CENTER_RANGE:
        raise RuntimeError("tagline must remain optically centered beneath the wordmark column")

    for theme, stops, background in (
        ("light", TAGLINE_LIGHT_STOPS, LIGHT_REFERENCE_BACKGROUND),
        ("dark", TAGLINE_DARK_STOPS, DARK_REFERENCE_BACKGROUND),
    ):
        for index, stop in enumerate(stops):
            ratio = contrast_ratio(stop, background)
            print(f"tagline.{theme}.stop_{index}.contrast={ratio:.4f}:1")
            if ratio < 4.5:
                raise RuntimeError(f"{theme} tagline gradient stop fails 4.5:1 contrast")


def verify(vector_path: Path, *, height: int, compact: bool) -> None:
    validate_structure(vector_path, compact=compact)
    legacy_expected = reference_alpha(height)
    actual = render_alpha(vector_path, height) if compact else render_group_alpha(vector_path, "mark-artwork", height)
    expected = legacy_expected.copy()
    if not compact:
        expected[:, WORDMARK_SOURCE_LEFT:] = False
    correction_mask = approved_correction_mask(expected.shape, compact=compact)
    expected[correction_mask] = actual[correction_mask]

    exact = expected == actual
    actual_dice = foreground_dice(expected, actual)
    exact_ratio = float(np.mean(exact))
    legacy_exact_ratio = float(np.mean(legacy_expected == actual))
    print(f"{vector_path.name}.legacy_exact_ratio={legacy_exact_ratio * 100:.8f}%")
    print(f"{vector_path.name}.corrected_exact_ratio={exact_ratio * 100:.8f}%")
    print(f"{vector_path.name}.foreground_dice={actual_dice * 100:.8f}%")
    if exact_ratio < MINIMUM_EXACT_RATIO:
        raise SystemExit(f"{vector_path.name} exact ratio is below 99.5%")
    if actual_dice < MINIMUM_FOREGROUND_DICE:
        raise SystemExit(f"{vector_path.name} foreground Dice is below 99.5%")


def main() -> None:
    verify(FULL_VECTOR, height=FULL_LOCKUP_HEIGHT, compact=False)
    verify(COMPACT_VECTOR, height=260, compact=True)
    verify_full_lockup_outline_contract()
    verify_tagline_contract()


if __name__ == "__main__":
    main()
