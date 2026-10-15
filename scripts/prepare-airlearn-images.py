"""Create local WebP previews and a searchable index from the internship archive."""

import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import re

from PIL import Image, ImageOps


def prepare_image(item):
    number, source, output = item
    asset_id = hashlib.sha256(source.name.encode()).hexdigest()[:12]
    name = re.sub(r"_[0-9a-f]{8}-[0-9a-f-]{27,}(?:_\d+)?$", "", source.stem)
    name = name.removeprefix("airlearn.content_").replace("_", " ").strip()
    category = ("Vector prompts" if "vector" in source.name.lower() else
                "Realism prompts" if any(word in source.name.lower() for word in
                                          ("realistic", "cinematic", "realism", "photo")) else
                "Other prompts")
    with Image.open(source) as original:
        image = ImageOps.exif_transpose(original).convert("RGB")
        width, height = image.size
        for folder, edge, quality in (("thumbs", 360, 76), ("visuals", 1280, 84)):
            preview = image.copy()
            preview.thumbnail((edge, edge), Image.Resampling.LANCZOS)
            preview.save(output / folder / f"{asset_id}.webp", quality=quality, method=4)
    return {"id": asset_id, "number": number, "name": name, "source": source.name,
            "category": category, "width": width, "height": height}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("--output", type=Path, default=Path("public/projects/airlearn/assets"))
    args = parser.parse_args()
    sources = sorted(p for p in args.source.iterdir()
                     if p.is_file() and p.suffix.lower() in {".png", ".webp", ".jpg", ".jpeg"}
                     and not p.name.startswith("."))
    if not sources:
        parser.error("The source folder contains no supported images.")
    for folder in ("thumbs", "visuals"):
        (args.output / folder).mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=6) as pool:
        images = list(pool.map(prepare_image, ((n, p, args.output)
                                             for n, p in enumerate(sources, 1))))
    assert len({image["id"] for image in images}) == len(images), "Duplicate archive IDs"
    manifest = {"count": len(images), "images": images}
    (args.output / "gallery.json").write_text(json.dumps(manifest, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"Prepared {len(images):,} images with thumbnails, larger previews, and source filenames.")


if __name__ == "__main__":
    main()
