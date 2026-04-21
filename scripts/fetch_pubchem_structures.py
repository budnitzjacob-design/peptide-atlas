from io import BytesIO
import json
from pathlib import Path
import time
from urllib.parse import quote
from urllib.request import Request, urlopen
from datetime import UTC, datetime

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parent.parent
STATIC_DATA = ROOT / "static" / "data.js"
OUTPUT_DIR = ROOT / "public" / "structures"
MANIFEST_PATH = OUTPUT_DIR / "manifest.json"

MANUAL_QUERIES = {
    "orforglipron": ["LY3502970"],
    "vip": ["Vasoactive intestinal peptide"],
    "tesamorelin": ["Egrifta"],
    "thymosin-alpha-1": ["Thymalfasin"],
    "tb4-frag": ["Thymosin beta-4 fragment", "Ac-SDKP"],
}


def load_data():
    text = STATIC_DATA.read_text()
    prefix = "window.PEPTIDE_ATLAS_DATA = "
    return json.loads(text[len(prefix) : -2])


def request_bytes(url: str) -> bytes:
    last_error = None
    for attempt in range(3):
        req = Request(url, headers={"User-Agent": "Mozilla/5.0"})
        try:
            return urlopen(req, timeout=30).read()
        except Exception as exc:
            last_error = exc
            time.sleep(0.6 * (attempt + 1))
    raise last_error


def resolve_cid(candidates):
    for candidate in candidates:
        if not candidate:
            continue
        url = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/{quote(candidate)}/cids/TXT"
        try:
            txt = request_bytes(url).decode().strip()
        except Exception:
            continue
        if txt:
            return txt.split()[0], candidate
    return None, None


def process_png(raw: bytes) -> Image.Image:
    image = Image.open(BytesIO(raw)).convert("RGBA")
    processed = Image.new("RGBA", image.size, (255, 255, 255, 0))

    for x in range(image.width):
        for y in range(image.height):
            r, g, b, a = image.getpixel((x, y))
            if a == 0:
                continue

            alpha = max(0, 255 - min(r, g, b))
            if alpha < 10:
                continue

            if max(r, g, b) - min(r, g, b) < 18:
                processed.putpixel((x, y), (255, 255, 255, alpha))
            else:
                processed.putpixel((x, y), (r, g, b, alpha))

    alpha_channel = processed.getchannel("A")
    bbox = alpha_channel.getbbox()
    if bbox:
        processed = processed.crop(bbox)

    pad = 14
    canvas = Image.new("RGBA", (processed.width + pad * 2, processed.height + pad * 2), (255, 255, 255, 0))
    canvas.alpha_composite(processed, (pad, pad))
    return canvas


def main():
    data = load_data()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = {"generatedAt": None, "items": [], "missing": []}

    for peptide in data["peptides"]:
      peptide_id = peptide["id"]
      names = [
          *MANUAL_QUERIES.get(peptide_id, []),
          peptide["names"]["primary"],
          *peptide["names"]["aliases"],
          *peptide["names"]["tradeNames"],
      ]
      cid, query = resolve_cid(names)
      if not cid:
          manifest["missing"].append(peptide_id)
          continue

      png_url = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/{cid}/PNG?image_size=large"
      try:
          raw = request_bytes(png_url)
          processed = process_png(raw)
          out_path = OUTPUT_DIR / f"{peptide_id}.png"
          processed.save(out_path)
          manifest["items"].append(
              {
                  "id": peptide_id,
                  "cid": cid,
                  "query": query,
                  "sourceUrl": f"https://pubchem.ncbi.nlm.nih.gov/compound/{cid}",
                  "imageUrl": png_url,
              }
          )
      except Exception:
          manifest["missing"].append(peptide_id)

    manifest["generatedAt"] = datetime.now(UTC).isoformat()
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2))
    print(f"generated {len(manifest['items'])} structure images; missing {len(manifest['missing'])}")
    if manifest["missing"]:
        print("missing:", ", ".join(manifest["missing"]))


if __name__ == "__main__":
    main()
