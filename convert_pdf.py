import fitz
import sys
import os

pdf_path = sys.argv[1]
prefix = sys.argv[2]
out_dir = 'quiz_images'

doc = fitz.open(pdf_path)
for page_num in range(len(doc)):
    page = doc.load_page(page_num)
    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
    pix.save(os.path.join(out_dir, f"{prefix}_p{page_num+1}.png"))
print(f"Converted {len(doc)} pages.")
