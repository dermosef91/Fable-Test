#!/usr/bin/env python3
"""
GIPFELBUCH — Pixel Sprite Generator
====================================
Generates a set of 5 high-fidelity pixel-art character sprites using
OpenAI's GPT Image 2 (gpt-image-1 model).

Usage:
    python tools/generate_sprites.py \
        --name "Lukas" \
        --description "Young male hiker, early 20s, messy brown hair, ..." \
        --api-key "sk-..." \
        --output-dir sprites/lukas

Outputs (all 128×128 px, transparent PNG):
    1. idle_1.png      — base idle, facing left, semi-profile
    2. idle_2.png      — subtle breathing variation of idle_1
    3. walking_1.png   — walking pose, left foot forward
    4. walking_2.png   — walking pose, right foot forward
    5. portrait.png    — square portrait, shoulders-up, neutral BG
"""

import argparse
import base64
import json
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

# Master style reference baked into every prompt so the model stays consistent.
STYLE_PREFIX = (
    "High-fidelity pixel art character sprite, 128×128 pixels, "
    "retro JRPG style similar to high-res GBA or DS era pixel art. "
    "Visible individual pixels with clean anti-aliasing on edges. "
    "Rich color palette with careful shading — not flat, uses 3-4 tonal steps per surface. "
    "Black pixel outline around the character. "
    "Fully transparent background (alpha channel). "
    "Single character, centered on a transparent canvas. "
    "The character should fill roughly 70-80% of the canvas height. "
    "IMPORTANT: Do NOT include any text, labels, names, watermarks, "
    "letters, words, captions, or signatures anywhere in the image. "
    "The image must contain ONLY the character sprite with zero text elements. "
)


# ---------------------------------------------------------------------------
# Sprite definitions — each one builds on the previous for consistency
# ---------------------------------------------------------------------------
def get_sprite_prompts(name: str, description: str) -> list[dict]:
    """Return the ordered list of sprite generation tasks."""

    # NOTE: We intentionally omit the character *name* from the prompt to
    # prevent GPT Image from rendering it as text on the sprite.
    base_desc = (
        f"Visual description: {description}. "
    )

    return [
        {
            "id": "idle_1",
            "filename": "idle_1.png",
            "label": "Idle 1 (base)",
            "prompt": (
                f"{STYLE_PREFIX}"
                f"{base_desc}"
                "Pose: standing idle, relaxed posture, facing to the LEFT in a three-quarter / semi-profile view. "
                "Weight evenly distributed on both feet. Arms resting naturally at sides. "
                "Subtle personality in the stance — slight slouch or confident lean. "
                "Lighting from above-left, casting small shadow on the ground plane. "
                "This is the base reference sprite — make it definitive."
            ),
            "uses_reference": False,
        },
        {
            "id": "idle_2",
            "filename": "idle_2.png",
            "label": "Idle 2 (breathing)",
            "prompt": (
                f"{STYLE_PREFIX}"
                f"{base_desc}"
                "Pose: standing idle EXACTLY like the reference image, but with a subtle breathing animation shift. "
                "Differences from reference: shoulders raised ~1-2 pixels, chest slightly expanded, "
                "head tilted 1 pixel, maybe a tiny hair strand shifted. "
                "Keep everything else — outfit colors, proportions, face, shading — pixel-perfect identical. "
                "This should look like the next frame in a 2-frame idle animation loop."
            ),
            "uses_reference": True,
        },
        {
            "id": "walking_1",
            "filename": "walking_1.png",
            "label": "Walking 1 (left foot forward)",
            "prompt": (
                f"{STYLE_PREFIX}"
                f"{base_desc}"
                "Pose: mid-stride walking animation, facing LEFT in three-quarter / semi-profile view. "
                "LEFT foot is forward, RIGHT foot is behind. "
                "Left arm swings back, right arm swings forward (natural opposing arm-leg motion). "
                "Slight forward lean to convey momentum. "
                "Keep the EXACT same character design, outfit, colors, and proportions as the reference image. "
                "Same pixel outline style, same shading approach. Only the pose changes."
            ),
            "uses_reference": True,
        },
        {
            "id": "walking_2",
            "filename": "walking_2.png",
            "label": "Walking 2 (right foot forward)",
            "prompt": (
                f"{STYLE_PREFIX}"
                f"{base_desc}"
                "Pose: mid-stride walking animation, facing LEFT in three-quarter / semi-profile view. "
                "RIGHT foot is forward, LEFT foot is behind. "
                "Right arm swings back, left arm swings forward (natural opposing arm-leg motion). "
                "Slight forward lean to convey momentum. "
                "This is the mirror-phase of the walking cycle — the opposite leg/arm from the reference. "
                "Keep the EXACT same character design, outfit, colors, and proportions as the reference image. "
                "Same pixel outline style, same shading approach. Only the pose changes."
            ),
            "uses_reference": True,
        },
        {
            "id": "portrait",
            "filename": "portrait.png",
            "label": "Portrait (shoulders-up)",
            "prompt": (
                f"{STYLE_PREFIX}"
                f"{base_desc}"
                "Framing: PORTRAIT / BUST shot — showing head and shoulders only, cropped below the chest. "
                "Facing slightly to the left, semi-profile, looking towards the viewer with a calm/neutral expression. "
                "Neutral single-color background (dark charcoal #2a2a3a or similar muted tone). "
                "Larger, more detailed rendering of the face — show eyes, eyebrows, mouth clearly. "
                "Keep the EXACT same character design, colors, and style as the reference sprite. "
                "This is for a character dialog box / menu portrait."
            ),
            "uses_reference": True,
        },
    ]


# ---------------------------------------------------------------------------
# OpenAI API helpers
# ---------------------------------------------------------------------------
def generate_image(prompt: str, api_key: str, size: str = "1024x1024") -> bytes:
    """Generate an image from a text prompt. Returns raw PNG bytes."""
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": MODEL,
        "prompt": prompt,
        "n": 1,
        "size": size,
        "output_format": "png",
    }

    print(f"    → Calling images/generations …")
    resp = requests.post(
        f"{OPENAI_API_URL}/generations",
        headers=headers,
        json=payload,
        timeout=180,
    )
    resp.raise_for_status()
    data = resp.json()

    # The response contains base64-encoded image data
    b64 = data["data"][0]["b64_json"]
    return base64.b64decode(b64)


def edit_image(prompt: str, reference_path: str, api_key: str, size: str = "1024x1024") -> bytes:
    """Edit/vary an image using a reference. Returns raw PNG bytes."""
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

        print(f"    → Calling images/edits with reference …")
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


def resize_to_128(png_bytes: bytes, output_path: str, keep_fullres: bool = False):
    """
    Downscale the generated image to 128×128 using nearest-neighbor
    to preserve the pixel-art sharpness, then save.
    Optionally keeps the full-resolution version alongside.
    Falls back to saving at original resolution if Pillow is unavailable.
    """
    try:
        from PIL import Image
        import io

        img = Image.open(io.BytesIO(png_bytes))

        # Optionally save the full-resolution version
        if keep_fullres:
            fullres_path = output_path.replace(".png", "_fullres.png")
            img.save(fullres_path, "PNG")
            print(f"    ✓ Full-res: {fullres_path}")

        # Use NEAREST for crisp pixel art downscale
        img_128 = img.resize((128, 128), Image.NEAREST)
        img_128.save(output_path, "PNG")
    except ImportError:
        # Fallback: save at original resolution with a warning
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
    size: str = "1024x1024",
    keep_fullres: bool = False,
):
    """Generate all 5 sprites for a single character."""

    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)

    sprites = get_sprite_prompts(name, description)
    base_path = out / sprites[0]["filename"]

    generated = []
    for i, sprite in enumerate(sprites):
        print(f"\n[{i+1}/5] Generating: {sprite['label']}")
        print(f"    Output: {out / sprite['filename']}")

        retries = 3
        success = False
        for attempt in range(retries):
            try:
                if not sprite["uses_reference"]:
                    # First sprite: pure generation
                    raw_png = generate_image(sprite["prompt"], api_key, size)
                else:
                    # Subsequent sprites: use idle_1 as reference
                    raw_png = edit_image(sprite["prompt"], str(base_path), api_key, size)

                # Downscale to 128×128
                final_path = str(out / sprite['filename'])
                resize_to_128(raw_png, final_path, keep_fullres=keep_fullres)
                print(f"    ✓ Saved: {final_path}")
                generated.append(sprite['id'])
                success = True
                break

            except requests.exceptions.HTTPError as e:
                print(f"    ✗ API error (attempt {attempt+1}/{retries}): {e}")
                if hasattr(e, 'response') and e.response is not None:
                    try:
                        print(f"      Detail: {e.response.json()}")
                    except Exception:
                        pass
                if attempt < retries - 1:
                    wait = 5 * (attempt + 1)
                    print(f"    Retrying in {wait}s …")
                    time.sleep(wait)
                else:
                    print(f"    FAILED after {retries} attempts. Skipping {sprite['id']}.")

            except Exception as e:
                print(f"    ✗ Unexpected error: {e}")
                if attempt < retries - 1:
                    time.sleep(3)
                else:
                    print(f"    FAILED. Skipping {sprite['id']}.")

        # Brief pause between API calls to be polite
        if i < len(sprites) - 1:
            time.sleep(2)

    print(f"\n{'='*60}")
    print(f"Done! {len(generated)}/5 sprites saved to: {out.resolve()}")
    if len(generated) < 5:
        missing = [s['id'] for s in sprites if s['id'] not in generated]
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
        "--name", "-n",
        required=True,
        help="Character name (e.g. 'Lukas')",
    )
    parser.add_argument(
        "--description", "-d",
        required=True,
        help="Visual description of the character",
    )
    parser.add_argument(
        "--api-key", "-k",
        default=os.environ.get("OPENAI_API_KEY"),
        help="OpenAI API key (or set OPENAI_API_KEY env var)",
    )
    parser.add_argument(
        "--output-dir", "-o",
        default="sprites/character",
        help="Output directory for the sprite files (default: sprites/character)",
    )
    parser.add_argument(
        "--size", "-s",
        default="1024x1024",
        choices=["1024x1024", "512x512", "256x256"],
        help="Generation resolution before downscaling to 128×128 (default: 1024x1024)",
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
    print(f"Output:    {args.output_dir}")
    print(f"Gen size:  {args.size} → 128×128")

    generate_character_sprites(
        name=args.name,
        description=args.description,
        api_key=args.api_key,
        output_dir=args.output_dir,
        size=args.size,
        keep_fullres=args.keep_fullres,
    )


if __name__ == "__main__":
    main()
