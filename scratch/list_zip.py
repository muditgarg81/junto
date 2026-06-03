import zipfile
import os

def extract_zip(zip_path, target_dir):
    print(f"Extracting {zip_path} to {target_dir}...")
    os.makedirs(target_dir, exist_ok=True)
    with zipfile.ZipFile(zip_path, 'r') as z:
        for member in z.infolist():
            filename = member.filename
            # Strip the leading directory 'stitch_tripmate_travel_companion/'
            parts = filename.split('/')
            if len(parts) > 1:
                # Reconstruct relative path from parts[1:]
                rel_path = os.path.join(*parts[1:])
                if not rel_path:
                    continue
                target_path = os.path.join(target_dir, rel_path)
                if member.is_dir():
                    os.makedirs(target_path, exist_ok=True)
                else:
                    os.makedirs(os.path.dirname(target_path), exist_ok=True)
                    with z.open(member) as source, open(target_path, 'wb') as target:
                        target.write(source.read())
    print("Extraction completed successfully.")

extract_zip(
    r"C:\Users\MUDIT GARG\Downloads\stitch_tripmate_travel_companion (1).zip",
    r"c:\claude\tripmanager\design-reference\stitch_tripmate_travel_companion__1_"
)
