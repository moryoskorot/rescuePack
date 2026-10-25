"""Copy the Kenney GLB models used by the browser game from the downloaded packs."""

from pathlib import Path
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "assets"
PACKS = {
    "commercial": "kenney_city-kit-commercial_2.1.zip",
    "suburban": "kenney_city-kit-suburban_20.zip",
    "industrial": "kenney_city-kit-industrial_2.0.zip",
    "roads": "kenney_city-kit-roads.zip",
    "cars": "kenney_car-kit.zip",
}

for pack, filename in PACKS.items():
    with ZipFile(ROOT / filename) as archive:
        for member in archive.namelist():
            if member.startswith("Models/GLB format/") and (member.endswith(".glb") or member.endswith("Textures/colormap.png")):
                target = OUT / pack / member.removeprefix("Models/GLB format/")
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(archive.read(member))
        license_target = OUT / f"LICENSE-{pack}.txt"
        license_target.write_bytes(archive.read("License.txt"))

(OUT / "MENU.png").write_bytes((ROOT / "MENU.png").read_bytes())
print("Kenney GLB assets and menu art copied to public/assets")
