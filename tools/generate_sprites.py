#!/usr/bin/env python3
"""
GIPFELBUCH — Pixel Sprite Generator
====================================
Generates a set of 5 high-fidelity pixel-art character sprites using
OpenAI's GPT Image 2 (gpt-image-1 model).

All sprites are derived from a shared TEMPLATE image to ensure consistent
art style, proportions, and pixel density across all characters.

Pipeline:
    1. idle_1  — Template + description → character-specific idle sprite
    2. idle_2  — idle_1 reference → subtle breathing variation
    3. walk_1  — idle_1 reference → left foot forward
    4. walk_2  — idle_1 reference → right foot forward
    5. portrait — idle_1 reference → shoulders-up portrait

Usage:
    python tools/generate_sprites.py \\
        --name "Greta" \\
        --description "Elderly woman, grey hair in a bun, purple shawl..." \\
        --api-key "sk-..." \\
        --output-dir sprites/greta

    # Custom template:
    python tools/generate_sprites.py \\
        --template sprites/template/idle_1.png \\
        ...
"""

import argparse
import base64
import os
import sys
import time
from pathlib import Path

try:
    import requests
except ImportError:
    print("ERROR: 'requests' package is required. Install with: pip install requests")
    sys.exit(1)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
OPENAI_API_URL = "https://api.openai.com/v1/images"
MODEL = "gpt-image-1"  # GPT Image 2

# Style instructions baked into every prompt.
# The template image defines the actual art style; these words reinforce it.
STYLE_PREFIX = (
    "Pixel art character sprite for a 2D side-scrolling game. "
    "Match the EXACT art style, pixel density, proportions, "
    "pose framing, and canvas layout of the reference image. "
    "Same chibi/SD body ratio (large head, short body). "
    "Same pixel size and outline thickness. "
    "Same shading approach (3-4 tonal steps per surface, black outline). "
    "Transparent background (alpha channel). "
    "Single character, centered on a transparent canvas. "
    "The character should occupy the same area of the canvas as the reference. "
    "IMPORTANT: Do NOT include any text, labels, names, watermarks, "
    "letters, words, captions, or signatures anywhere in the image. "
    "The image must contain ONLY the character sprite with zero text elements. "
)


# ---------------------------------------------------------------------------
# Sprite definitions
# ---------------------------------------------------------------------------
def get_sprite_prompts(description: str) -> list[dict]:
    """Return the ordered list of sprite generation tasks.

    All prompts intentionally omit the character name to prevent
    GPT Image from rendering it as text on the sprite.
    """

    desc = f"Character visual description: {description}. "

    return [
        {
            "id": "idle_1",
            "filename": "idle_1.png",
            "label": "Idle 1 (base — from template)",
            "reference": "template",  # uses the shared template image
            "prompt": (
                f"{STYLE_PREFIX}"
                f"Redraw the character in the reference image, REPLACING the "
                f"character's identity with the following new character while "
                f"keeping the EXACT same art style, pixel density, proportions, "
                f"pose, and canvas position. "
                f"{desc}"
                f"Keep the same idle standing pose (facing left, semi-profile, "
                f"relaxed posture, weight on both feet). "
                f"Only the character's appearance changes — clothes, hair, "
                f"body shape, accessories — everything else stays identical."
            ),
        },
        {
            "id": "idle_2",
            "filename": "idle_2.png",
            "label": "Idle 2 (breathing)",
            "reference": "idle_1",  # uses the generated idle_1
            "prompt": (
                f"{STYLE_PREFIX}"
                f"{desc}"
                "Recreate the reference image with a VERY SUBTLE breathing "
                "animation shift. This is the second frame of a 2-frame idle loop. "
                "Differences from reference: shoulders raised ~1-2 pixels, "
                "chest slightly expanded, maybe a tiny hair movement. "
                "Keep EVERYTHING else pixel-perfect identical — outfit, colors, "
                "proportions, face, shading, canvas position."
            ),
        },
        {
            "id": "walking_1",
            "filename": "walking_1.png",
            "label": "Walking 1 (left foot forward)",
            "reference": "idle_1",
            "prompt": (
                f"{STYLE_PREFIX}"
                f"{desc}"
                "Change the pose to a MID-STRIDE WALKING animation. "
                "Facing LEFT in three-quarter / semi-profile view. "
                "LEFT foot forward, RIGHT foot behind. "
                "Left arm swings back, right arm swings forward. "
                "Slight forward lean to convey momentum. "
                "Keep the EXACT same character design, outfit, colors, "
                "proportions, pixel style, and shading as the reference."
            ),
        },
        {
            "id": "walking_2",
            "filename": "walking_2.png",
            "label": "Walking 2 (right foot forward)",
            "reference": "idle_1",
            "prompt": (
                f"{STYLE_PREFIX}"
                f"{desc}"
                "Change the pose to a MID-STRIDE WALKING animation. "
                "Facing LEFT in three-quarter / semi-profile view. "
                "RIGHT foot forward, LEFT foot behind. "
                "Right arm swings back, left arm swings forward. "
                "Slight forward lean to convey momentum. "
                "This is the opposite phase from Walking 1. "
                "Keep the EXACT same character design, outfit, colors, "
                "proportions, pixel style, and shading as the reference."
            ),
        },
        {
            "id": "portrait",
            "filename": "portrait.png",
            "label": "Portrait (shoulders-up)",
            "reference": "idle_1",
            "prompt": (
                f"{STYLE_PREFIX}"
                f"{desc}"
                "PORTRAIT / BUST shot — head and shoulders only, "
                "cropped below the chest. "
                "Facing slightly left, semi-profile, calm/neutral expression. "
                "Neutral dark background (charcoal #2a2a3a). "
                "Larger, more detailed face — show eyes, eyebrows, mouth. "
                "Keep the EXACT same character design, colors, and pixel style "
                "as the reference. This is for a dialog box portrait."
            ),
        },
    ]


# ---------------------------------------------------------------------------
# OpenAI API helpers
# ---------------------------------------------------------------------------
def edit_image(
    prompt: str,
    reference_path: str,
    api_key: str,
    size: str = "1024x1024",
) -> bytes:
    """Edit/transform an image using a reference. Returns raw PNG bytes."""
    headers = {
        "Authorization": f"Bearer {api_key}",
    }

    with open(reference_path, "rb") as f:
        files = [
            ("image[]", ("reference.png", f, "image/png")),
        ]
        data = {
            "model": MODEL,
            "prompt": prompt,
            "n": 1,
            "size": size,
        }

        print(f"    → Calling images/edits (ref: {Path(reference_path).name}) …")
        resp = requests.post(
            f"{OPENAI_API_URL}/edits",
            headers=headers,
            data=data,
            files=files,
            timeout=180,
        )

    resp.raise_for_status()
    result = resp.json()
    b64 = result["data"][0]["b64_json"]
    return base64.b64decode(b64)


def ensure_transparency(img):
    """
    Post-process an image to guarantee transparent background.
    GPT Image sometimes returns RGB (no alpha) or RGBA with an opaque
    background of any color. This function samples the corner pixels to
    determine the background color, then flood-fills from all four corners
    to remove connected background regions — preserving interior pixels
    of similar color (e.g. white eyes, highlights).
    """
    from PIL import Image
    import numpy as np
    from collections import deque

    img = img.convert("RGBA")
    data = np.array(img)
    h, w = data.shape[:2]

    bg_mask = np.zeros((h, w), dtype=bool)

    # Flood-fill from each corner using that corner's color as reference
    for sy, sx in [(0, 0), (0, w - 1), (h - 1, 0), (h - 1, w - 1)]:
        ref = data[sy, sx, :3].astype(int)
        # Pixels within 30 RGB units of the corner color
        diff = np.abs(data[:, :, :3].astype(int) - ref)
        is_bg = (diff[:, :, 0] < 30) & (diff[:, :, 1] < 30) & (diff[:, :, 2] < 30)

        queue = deque()
        if is_bg[sy, sx] and not bg_mask[sy, sx]:
            bg_mask[sy, sx] = True
            queue.append((sy, sx))

        while queue:
            y, x = queue.popleft()
            for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                ny, nx = y + dy, x + dx
                if 0 <= ny < h and 0 <= nx < w and is_bg[ny, nx] and not bg_mask[ny, nx]:
                    bg_mask[ny, nx] = True
                    queue.append((ny, nx))

    removed = int(bg_mask.sum())
    total = h * w
    if removed > total * 0.05:  # only apply if >5% is background
        data[bg_mask, 3] = 0
        print(f"    ✓ Removed {removed} background pixels ({removed*100//total}%) → transparent")

    return Image.fromarray(data)


def resize_to_128(png_bytes: bytes, output_path: str, keep_fullres: bool = False):
    """
    Ensure transparent background, then downscale to 128×128 using
    nearest-neighbor to preserve pixel-art sharpness.
    """
    try:
        from PIL import Image
        import io

        img = Image.open(io.BytesIO(png_bytes))

        # Ensure transparent background
        img = ensure_transparency(img)

        if keep_fullres:
            fullres_path = output_path.replace(".png", "_fullres.png")
            img.save(fullres_path, "PNG")
            print(f"    ✓ Full-res: {fullres_path}")

        img_128 = img.resize((128, 128), Image.NEAREST)
        img_128.save(output_path, "PNG")
    except ImportError:
        print("    ⚠  Pillow not installed — saving at original resolution.")
        print("       Install with: pip install Pillow")
        with open(output_path, "wb") as f:
            f.write(png_bytes)


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------
def generate_character_sprites(
    name: str,
    description: str,
    api_key: str,
    output_dir: str,
    template_path: str,
    size: str = "1024x1024",
    keep_fullres: bool = False,
):
    """Generate all 5 sprites for a single character."""

    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)

    # Validate template exists
    if not Path(template_path).is_file():
        print(f"ERROR: Template not found: {template_path}")
        sys.exit(1)

    sprites = get_sprite_prompts(description)
    idle_1_path = str(out / "idle_1.png")

    # Map reference keys to file paths
    def ref_path(ref_key: str) -> str:
        if ref_key == "template":
            return template_path
        elif ref_key == "idle_1":
            return idle_1_path
        else:
            raise ValueError(f"Unknown reference key: {ref_key}")

    generated = []
    for i, sprite in enumerate(sprites):
        print(f"\n[{i+1}/5] Generating: {sprite['label']}")
        print(f"    Output: {out / sprite['filename']}")

        reference = ref_path(sprite["reference"])

        # For sprites 2-5, ensure idle_1 was generated successfully
        if sprite["reference"] == "idle_1" and "idle_1" not in generated:
            print("    ✗ Skipped — idle_1 (base) was not generated.")
            continue

        retries = 3
        for attempt in range(retries):
            try:
                raw_png = edit_image(sprite["prompt"], reference, api_key, size)

                final_path = str(out / sprite["filename"])
                resize_to_128(raw_png, final_path, keep_fullres=keep_fullres)
                print(f"    ✓ Saved: {final_path}")
                generated.append(sprite["id"])
                break

            except requests.exceptions.HTTPError as e:
                print(f"    ✗ API error (attempt {attempt+1}/{retries}): {e}")
                if hasattr(e, "response") and e.response is not None:
                    try:
                        print(f"      Detail: {e.response.json()}")
                    except Exception:
                        pass
                if attempt < retries - 1:
                    wait = 5 * (attempt + 1)
                    print(f"    Retrying in {wait}s …")
                    time.sleep(wait)
                else:
                    print(
                        f"    FAILED after {retries} attempts. "
                        f"Skipping {sprite['id']}."
                    )

            except Exception as e:
                print(f"    ✗ Unexpected error: {e}")
                if attempt < retries - 1:
                    time.sleep(3)
                else:
                    print(f"    FAILED. Skipping {sprite['id']}.")

        # Brief pause between API calls
        if i < len(sprites) - 1:
            time.sleep(2)

    print(f"\n{'='*60}")
    print(f"Done! {len(generated)}/5 sprites saved to: {out.resolve()}")
    if len(generated) < 5:
        missing = [s["id"] for s in sprites if s["id"] not in generated]
        print(f"Missing: {', '.join(missing)}")
    print(f"{'='*60}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        description="Generate pixel-art character sprites using GPT Image 2",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--name",
        "-n",
        required=True,
        help="Character name (for output labeling only — not sent to the model)",
    )
    parser.add_argument(
        "--description",
        "-d",
        required=True,
        help="Visual description of the character",
    )
    parser.add_argument(
        "--api-key",
        "-k",
        default=os.environ.get("OPENAI_API_KEY"),
        help="OpenAI API key (or set OPENAI_API_KEY env var)",
    )
    parser.add_argument(
        "--template",
        "-t",
        default="sprites/template/idle_1.png",
        help="Path to the template sprite image (default: sprites/template/idle_1.png)",
    )
    parser.add_argument(
        "--output-dir",
        "-o",
        default="sprites/character",
        help="Output directory for the sprite files (default: sprites/character)",
    )
    parser.add_argument(
        "--size",
        "-s",
        default="1024x1024",
        choices=["1024x1024", "512x512", "256x256"],
        help="Generation resolution before downscaling to 128×128",
    )
    parser.add_argument(
        "--keep-fullres",
        action="store_true",
        default=False,
        help="Also save the full-resolution version alongside 128×128",
    )

    args = parser.parse_args()

    if not args.api_key:
        print("ERROR: No API key provided. Use --api-key or set OPENAI_API_KEY.")
        sys.exit(1)

    print(f"╔{'═'*58}╗")
    print(f"║  GIPFELBUCH Sprite Generator                             ║")
    print(f"║  Model: {MODEL:<48} ║")
    print(f"╚{'═'*58}╝")
    print(f"\nCharacter: {args.name}")
    print(f"Template:  {args.template}")
    print(f"Output:    {args.output_dir}")
    print(f"Gen size:  {args.size} → 128×128")

    generate_character_sprites(
        name=args.name,
        description=args.description,
        api_key=args.api_key,
        output_dir=args.output_dir,
        template_path=args.template,
        size=args.size,
        keep_fullres=args.keep_fullres,
    )


if __name__ == "__main__":
    main()
