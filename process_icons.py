import os
from PIL import Image

src_image_path = r"C:\Users\HP\.gemini\antigravity\brain\1e11dfab-bb46-485b-a288-73cec8e443c3\khata_app_icon_logo_1789383995545.png"
res_dir = r"e:\C#\khata_extracted\android\app\src\main\res"

sizes = {
    'mipmap-mdpi': (48, 48),
    'mipmap-hdpi': (72, 72),
    'mipmap-xhdpi': (96, 96),
    'mipmap-xxhdpi': (144, 144),
    'mipmap-xxxhdpi': (192, 192)
}

print(f"Opening source image: {src_image_path}")
img = Image.open(src_image_path).convert("RGBA")

for folder, size in sizes.items():
    target_folder = os.path.join(res_dir, folder)
    os.makedirs(target_folder, exist_ok=True)
    resized = img.resize(size, Image.Resampling.LANCZOS)
    
    ic_path = os.path.join(target_folder, "ic_launcher.png")
    ic_round_path = os.path.join(target_folder, "ic_launcher_round.png")
    ic_fg_path = os.path.join(target_folder, "ic_launcher_foreground.png")
    
    resized.save(ic_path, "PNG")
    resized.save(ic_round_path, "PNG")
    resized.save(ic_fg_path, "PNG")
    print(f"✅ Saved {size} icons to {folder}")

print("🎉 All Android launcher icons regenerated successfully!")
