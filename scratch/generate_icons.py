import os
from PIL import Image, ImageOps

source_path = r"C:\Users\MUDIT GARG\.gemini\antigravity\brain\99a837cc-4f01-43d2-8518-50cc54479d44\junto_app_logo_1780487560843.png"
res_dir = r"c:\claude\tripmanager\android\app\src\main\res"

sizes = {
    "mdpi": {"legacy": 48, "foreground": 108},
    "hdpi": {"legacy": 72, "foreground": 162},
    "xhdpi": {"legacy": 96, "foreground": 216},
    "xxhdpi": {"legacy": 144, "foreground": 324},
    "xxxhdpi": {"legacy": 192, "foreground": 432}
}

img = Image.open(source_path)

for density, size_info in sizes.items():
    mipmap_path = os.path.join(res_dir, f"mipmap-{density}")
    os.makedirs(mipmap_path, exist_ok=True)
    
    # 1. Legacy Launcher Icon (ic_launcher.png & ic_launcher_round.png)
    legacy_size = size_info["legacy"]
    legacy_img = img.resize((legacy_size, legacy_size), Image.Resampling.LANCZOS)
    legacy_img.save(os.path.join(mipmap_path, "ic_launcher.png"), "PNG")
    legacy_img.save(os.path.join(mipmap_path, "ic_launcher_round.png"), "PNG")
    
    # 2. Adaptive Foreground Icon (ic_launcher_foreground.png)
    fg_size = size_info["foreground"]
    # The actual content should fit inside the central 66.6% of the 108dp canvas.
    content_size = int(fg_size * 0.65)
    resized_content = img.resize((content_size, content_size), Image.Resampling.LANCZOS)
    
    # Create empty transparent canvas
    fg_img = Image.new("RGBA", (fg_size, fg_size), (0, 0, 0, 0))
    # Paste centered
    offset = (fg_size - content_size) // 2
    fg_img.paste(resized_content, (offset, offset))
    fg_img.save(os.path.join(mipmap_path, "ic_launcher_foreground.png"), "PNG")

print("Android App Icons generated successfully!")
