import sys
import os
import glob
import subprocess
from PIL import Image
from pptx import Presentation
from pptx.util import Inches
import img2pdf

def remove_watermark_from_image(im_path: str):
    """
    Xóa watermark 'Gemini Notebook' ở góc dưới bên phải slide (footer).
    Dùng phương pháp clone màu nền theo cột dọc từ dòng tham chiếu ngay phía trên
    để đảm bảo gradient/màu nền tiệp tự nhiên 100%.
    """
    im = Image.open(im_path)
    w, h = im.size
    
    # Vùng chứa watermark: góc dưới bên phải
    x_start = int(w * 0.74)
    y_start = int(h * 0.925)
    ref_y = max(0, y_start - 3)
    
    pix = im.load()
    for x in range(x_start, w):
        src_color = pix[x, ref_y]
        for y in range(y_start, h):
            pix[x, y] = src_color
            
    im.save(im_path)

def convert_pdf_to_pptx(pdf_path: str, pptx_path: str, clean_pdf_path: str = None):
    temp_dir = os.path.join(os.path.dirname(pptx_path), "_temp_pdf_slides_" + os.path.basename(pdf_path))
    os.makedirs(temp_dir, exist_ok=True)
    try:
        # 1. Render PDF pages to PNG (150 DPI is crisp and fast for 16:9 slides)
        prefix = os.path.join(temp_dir, "slide")
        cmd = ["pdftoppm", "-png", "-r", "150", pdf_path, prefix]
        subprocess.run(cmd, check=True)

        # 2. Get sorted list of images
        def get_page_num(filename):
            base = os.path.basename(filename)
            num_part = base.replace("slide-", "").replace(".png", "")
            try:
                return int(num_part)
            except ValueError:
                return 0

        pattern = os.path.join(temp_dir, "slide-*.png")
        images = sorted(glob.glob(pattern), key=get_page_num)
        if not images:
            raise Exception("No slide images generated from PDF: " + pdf_path)

        # 3. Clean watermark from each slide image
        for img_path in images:
            remove_watermark_from_image(img_path)

        # 4. Create PPTX with 16:9 widescreen dimensions
        prs = Presentation()
        prs.slide_width = Inches(13.333)
        prs.slide_height = Inches(7.5)
        blank_slide_layout = prs.slide_layouts[6] # blank layout

        for img_path in images:
            slide = prs.slides.add_slide(blank_slide_layout)
            slide.shapes.add_picture(img_path, Inches(0), Inches(0), width=Inches(13.333), height=Inches(7.5))

        prs.save(pptx_path)
        print(f"Successfully converted {len(images)} slides to {pptx_path} (watermark removed)")

        # 5. If clean_pdf_path requested, create clean PDF using img2pdf
        if clean_pdf_path:
            with open(clean_pdf_path, "wb") as f:
                f.write(img2pdf.convert(images))
            print(f"Successfully created clean PDF without watermark: {clean_pdf_path}")

    finally:
        # Cleanup temp directory
        for f in glob.glob(os.path.join(temp_dir, "*")):
            try:
                os.remove(f)
            except Exception:
                pass
        try:
            os.rmdir(temp_dir)
        except Exception:
            pass

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python pdf_to_pptx.py <input.pdf> <output.pptx> [output_clean.pdf]")
        sys.exit(1)
    clean_pdf = sys.argv[3] if len(sys.argv) > 3 else None
    convert_pdf_to_pptx(sys.argv[1], sys.argv[2], clean_pdf)
