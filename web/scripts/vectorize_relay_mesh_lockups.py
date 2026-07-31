#!/usr/bin/env python3
from __future__ import annotations

from copy import deepcopy
import hashlib
from pathlib import Path
import shutil
import subprocess
import tempfile
import xml.etree.ElementTree as ET

from PIL import Image

from generate_relay_mesh_brand_assets import remove_background


WEB_ROOT = Path(__file__).resolve().parent.parent
REFERENCE_DIR = WEB_ROOT / "brand" / "relay-mesh" / "reference"
RASTER_SOURCE = REFERENCE_DIR / "approved-lockup-raster.png"
MARK_SOURCE = REFERENCE_DIR / "approved-mark-vector-light.svg"
FULL_OUTPUT = REFERENCE_DIR / "approved-lockup-vector-light.svg"
COMPACT_OUTPUT = REFERENCE_DIR / "approved-lockup-compact-vector-light.svg"
# The static instance is committed alongside the reviewed SVG master as the
# provenance source for its permanently outlined tagline.
TAGLINE_FONT_SOURCE = REFERENCE_DIR / "fonts" / "RobotoCondensed-Regular.ttf"
WORDMARK_TRANSLATE_Y = -34
TAGLINE_PRIMARY_LEFT = 297
TAGLINE_SEPARATOR_CENTER_X = 530
TAGLINE_SEPARATOR_CENTER_Y = 209.5
TAGLINE_SEPARATOR_RADIUS = 4
TAGLINE_SECONDARY_LEFT = 547
TAGLINE_SECONDARY_RIGHT = 935
CANONICAL_TAGLINE_PATH_HASHES = {
    "tagline-primary": "d0fefc4c75401c4312292bdc4072dce7d21e06bf4587aa881cb1310c03b6c563",
    "tagline-secondary": "29dbbfd1413843796fb4455e92df1bded56ea434a86fc8ebca2083085ddd5b1a",
}
FULL_LOCKUP_HEIGHT = 310
SVG_NAMESPACE = "http://www.w3.org/2000/svg"

ET.register_namespace("", SVG_NAMESPACE)


def svg_tag(name: str) -> str:
    return f"{{{SVG_NAMESPACE}}}{name}"


def trace_region(alpha: Image.Image, box: tuple[int, int, int, int], group_id: str) -> ET.Element:
    potrace = shutil.which("potrace")
    if potrace is None:
        raise RuntimeError("potrace is required to rebuild the lockup vector masters")

    mask = Image.new("L", alpha.size, 255)
    region = alpha.crop(box).point(lambda value: 0 if value >= 128 else 255)
    mask.paste(region, box[:2])

    with tempfile.TemporaryDirectory() as temp_dir:
        bitmap_path = Path(temp_dir) / f"{group_id}.pbm"
        svg_path = Path(temp_dir) / f"{group_id}.svg"
        mask.convert("1").save(bitmap_path)
        subprocess.run(
            [
                potrace,
                str(bitmap_path),
                "--svg",
                "--flat",
                "--alphamax",
                "0",
                "--opttolerance",
                "0",
                "--turdsize",
                "0",
                "--output",
                str(svg_path),
            ],
            check=True,
        )
        traced_root = ET.parse(svg_path).getroot()

    traced_group = traced_root.find(svg_tag("g"))
    if traced_group is None:
        raise RuntimeError(f"potrace did not produce a group for {group_id}")
    traced_group.set("id", group_id)
    traced_group.attrib.pop("fill", None)
    traced_group.attrib.pop("stroke", None)
    return traced_group


def add_linear_gradient(
    defs: ET.Element,
    gradient_id: str,
    x1: str,
    x2: str,
    stops: tuple[tuple[str, str], ...],
) -> None:
    gradient = ET.SubElement(
        defs,
        svg_tag("linearGradient"),
        {
            "id": gradient_id,
            "x1": x1,
            "y1": "0",
            "x2": x2,
            "y2": "0",
            "gradientUnits": "userSpaceOnUse",
        },
    )
    for offset, color in stops:
        ET.SubElement(
            gradient,
            svg_tag("stop"),
            {"offset": offset, "stop-color": color},
        )


def build_lockup(
    mark_root: ET.Element,
    traced_groups: dict[str, ET.Element],
    *,
    include_tagline: bool,
) -> ET.Element:
    height = str(FULL_LOCKUP_HEIGHT) if include_tagline else "260"
    root = ET.Element(
        svg_tag("svg"),
        {
            "width": "1000",
            "height": height,
            "viewBox": f"0 0 1000 {height}",
            "color-interpolation": "sRGB",
        },
    )
    mark_defs = mark_root.find(svg_tag("defs"))
    mark_artwork = next(
        (element for element in mark_root.iter() if element.get("id") == "mark-artwork"),
        None,
    )
    if mark_defs is None or mark_artwork is None:
        raise RuntimeError("mark vector source is missing its definitions or artwork group")

    defs = deepcopy(mark_defs)
    add_linear_gradient(
        defs,
        "wordmark-tavily-gradient",
        "2520",
        "6150",
        (("0", "#191536"), ("1", "#12102D")),
    )
    add_linear_gradient(
        defs,
        "wordmark-hikari-gradient",
        "6510",
        "9790",
        (("0", "#7939E7"), ("0.48", "#426FF4"), ("1", "#0398EF")),
    )
    if include_tagline:
        add_linear_gradient(
            defs,
            "tagline-flow-gradient",
            str(TAGLINE_PRIMARY_LEFT * 10),
            str(TAGLINE_SECONDARY_RIGHT * 10),
            (("0", "#6D28D9"), ("1", "#0369A1")),
        )
    root.append(defs)
    root.append(deepcopy(mark_artwork))

    wordmark_attributes = {"id": "wordmark"}
    if include_tagline:
        wordmark_attributes["transform"] = f"translate(0 {WORDMARK_TRANSLATE_Y})"
    wordmark = ET.SubElement(root, svg_tag("g"), wordmark_attributes)
    tavily = deepcopy(traced_groups["wordmark-tavily"])
    tavily.set("fill", "url(#wordmark-tavily-gradient)")
    hikari = deepcopy(traced_groups["wordmark-hikari"])
    hikari.set("fill", "url(#wordmark-hikari-gradient)")
    wordmark.extend((tavily, hikari))

    if include_tagline:
        tagline = ET.SubElement(root, svg_tag("g"), {"id": "tagline"})
        primary = deepcopy(traced_groups["tagline-primary"])
        primary.set("fill", "url(#tagline-flow-gradient)")
        separator = ET.Element(
            svg_tag("g"),
            {
                "id": "tagline-separator",
                "transform": f"translate(0 {FULL_LOCKUP_HEIGHT}) scale(0.1 -0.1)",
                "fill": "url(#tagline-flow-gradient)",
            },
        )
        ET.SubElement(
            separator,
            svg_tag("circle"),
            {
                "cx": str(TAGLINE_SEPARATOR_CENTER_X * 10),
                "cy": str((FULL_LOCKUP_HEIGHT - TAGLINE_SEPARATOR_CENTER_Y) * 10),
                "r": str(TAGLINE_SEPARATOR_RADIUS * 10),
            },
        )
        secondary = deepcopy(traced_groups["tagline-secondary"])
        secondary.set("fill", "url(#tagline-flow-gradient)")
        tagline.extend((primary, separator, secondary))

    return root


def write_svg(root: ET.Element, path: Path) -> None:
    ET.indent(root, space="  ")
    ET.ElementTree(root).write(path, encoding="utf-8", xml_declaration=True)


def load_canonical_tagline_groups() -> dict[str, ET.Element]:
    if not TAGLINE_FONT_SOURCE.exists():
        raise RuntimeError(f"missing vendored tagline font source: {TAGLINE_FONT_SOURCE}")
    if not FULL_OUTPUT.exists():
        raise RuntimeError(f"missing canonical full lockup master: {FULL_OUTPUT}")

    source_root = ET.parse(FULL_OUTPUT).getroot()
    groups = {
        element.get("id"): deepcopy(element)
        for element in source_root.iter()
        if element.get("id") in {"tagline-primary", "tagline-secondary"}
    }
    expected_groups = {"tagline-primary", "tagline-secondary"}
    if set(groups) != expected_groups:
        raise RuntimeError("canonical full lockup master is missing its outlined tagline groups")
    for group_id, expected_hash in CANONICAL_TAGLINE_PATH_HASHES.items():
        paths = groups[group_id].findall(svg_tag("path"))
        if len(paths) != 1 or not paths[0].get("d"):
            raise RuntimeError(f"canonical full lockup master has an invalid {group_id} outline")
        actual_hash = hashlib.sha256(paths[0].get("d", "").encode("utf-8")).hexdigest()
        if actual_hash != expected_hash:
            raise RuntimeError(f"canonical full lockup master has drifted in {group_id}")
    return groups


def main() -> None:
    raster = Image.open(RASTER_SOURCE).convert("RGBA")
    alpha = remove_background(raster, fill_threshold=60, soft_threshold=84).getchannel("A")
    traced_groups = {
        "wordmark-tavily": trace_region(alpha, (240, 55, 630, 205), "wordmark-tavily"),
        "wordmark-hikari": trace_region(alpha, (640, 55, 990, 205), "wordmark-hikari"),
    }
    # The full SVG is the canonical vector master. Its reviewed tagline paths
    # are kept verbatim so host FreeType rasterization cannot mutate the logo.
    traced_groups.update(load_canonical_tagline_groups())
    mark_root = ET.parse(MARK_SOURCE).getroot()
    write_svg(build_lockup(mark_root, traced_groups, include_tagline=True), FULL_OUTPUT)
    write_svg(build_lockup(mark_root, traced_groups, include_tagline=False), COMPACT_OUTPUT)
    print(f"[brand] wrote {FULL_OUTPUT} and {COMPACT_OUTPUT}")


if __name__ == "__main__":
    main()
