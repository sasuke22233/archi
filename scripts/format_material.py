import re
from pathlib import Path
from pypdf import PdfReader

SOURCE = Path(r"C:\Users\Administrator\Downloads\Проектирование материал БПИ 310826 (2).pdf")
TARGET = Path("public/course-material.txt")

def format_page(text: str, number: int) -> str:
    text = text or ""
    text = re.sub(r"(?<=\w)-\s*\n\s*(?=\w)", "", text)
    text = re.sub(r"[📖📌✔•▪●◆★✓]", "", text)
    text = re.sub(r"(?m)^\s*\d+\s*$", "", text)
    text = text.replace("Р АЗДЕЛ", "РАЗДЕЛ").replace("С ОДЕРЖАНИЕ", "СОДЕРЖАНИЕ")
    text = re.sub(r"\s*\n\s*", " ", text)
    text = re.sub(r"\s{2,}", " ", text).strip()
    text = re.sub(r"(РАЗДЕЛ\s+\d+\.)", r"\n\n\1", text)
    text = re.sub(r"(?<!\w)(\d{1,3}\.\s+[А-ЯЁ])", r"\n\n\1", text)
    text = re.sub(r"([.!?])\s+(?=[А-ЯЁ][а-яё]{3,})", r"\1\n\n", text)
    return f"===PAGE {number}===\n{text}"

reader = PdfReader(SOURCE)
TARGET.parent.mkdir(exist_ok=True)
TARGET.write_text("\n\f\n".join(format_page(page.extract_text(), i + 1) for i, page in enumerate(reader.pages)), encoding="utf-8")
print(f"Saved {len(reader.pages)} formatted pages to {TARGET}")
