import fitz
import json
import re
import os
import sys

PDF_PATH = "wallach.pdf"
OUTPUT = "extracted.json"


def clean_text(text):
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r'[ \t]+', ' ', text)
    return text.strip()


def extract_pages(pdf_path):
    if not os.path.exists(pdf_path):
        print("ERROR: file not found")
        sys.exit(1)

    doc = fitz.open(pdf_path)
    pages = []
    total = len(doc)
    print("Total pages: " + str(total))

    for i, page in enumerate(doc):
        text = page.get_text("text")
        pages.append({"page": i + 1, "text": clean_text(text)})
        if i % 100 == 0:
            print("  -> " + str(i+1) + "/" + str(total))

    doc.close()
    return pages


def split_sections(pages):
    sections = []
    current = None
    heading = re.compile(r'^([A-Z][A-Za-z0-9\s\(\)\-/,:\']{3,90})$')

    for page in pages:
        paragraphs = page["text"].split("\n\n")
        for para in paragraphs:
            para = para.strip()
            if not para or len(para) < 5:
                continue

            first_line = para.split("\n")[0].strip()
            is_heading = (
                heading.match(first_line) and
                len(first_line) < 90 and
                not first_line.endswith('.') and
                not first_line.endswith(',')
            )

            if is_heading:
                if current and len(current["content"]) > 50:
                    sections.append(current)
                current = {
                    "title": first_line,
                    "page": page["page"],
                    "content": para
                }
            elif current:
                current["content"] += "\n\n" + para
            else:
                current = {
                    "title": "Page " + str(page["page"]),
                    "page": page["page"],
                    "content": para
                }

    if current and len(current["content"]) > 50:
        sections.append(current)

    return sections


if __name__ == "__main__":
    print("Starting extraction...")
    pages = extract_pages(PDF_PATH)
    print("Extracted " + str(len(pages)) + " pages")

    print("Splitting sections...")
    sections = split_sections(pages)
    print("Found " + str(len(sections)) + " sections")

    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump({"pages": pages, "sections": sections}, f, ensure_ascii=False)

    size_mb = os.path.getsize(OUTPUT) / 1024 / 1024
    print("Saved to " + OUTPUT + " (" + str(round(size_mb, 1)) + " MB)")
