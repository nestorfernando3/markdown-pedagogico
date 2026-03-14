#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path
import re
import sys

import fitz
import pdfplumber


def slugify(value: str) -> str:
    normalized = re.sub(r"[^A-Za-z0-9]+", "-", value).strip("-").lower()
    return normalized or "pdf"


def render_pages(pdf_path: Path, output_dir: Path) -> list[Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    document = fitz.open(pdf_path)
    generated: list[Path] = []

    try:
        for index, page in enumerate(document, 1):
            pixmap = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
            target = output_dir / f"page-{index}.png"
            pixmap.save(target)
            generated.append(target)
    finally:
        document.close()

    return generated


def extract_text(pdf_path: Path) -> tuple[int, list[str]]:
    snippets: list[str] = []
    total_chars = 0

    with pdfplumber.open(pdf_path) as document:
        for index, page in enumerate(document.pages, 1):
            text = page.extract_text() or ""
            total_chars += len(text)
            preview = text[:240].replace("\n", " | ")
            snippets.append(f"page {index}: chars={len(text)} :: {preview}")

    return total_chars, snippets


def main() -> int:
    parser = argparse.ArgumentParser(description="Extrae texto y renderiza páginas PNG para revisar PDFs exportados.")
    parser.add_argument("pdf_path", help="Ruta al archivo PDF a revisar.")
    parser.add_argument(
        "--output-dir",
        help="Carpeta para las páginas renderizadas. Por defecto usa tmp/pdfs/<slug-del-archivo>.",
    )
    args = parser.parse_args()

    pdf_path = Path(args.pdf_path).expanduser().resolve()
    if not pdf_path.is_file():
        print(f"No se encontró el PDF: {pdf_path}", file=sys.stderr)
        return 1

    output_dir = (
        Path(args.output_dir).expanduser().resolve()
        if args.output_dir
        else Path("tmp/pdfs").resolve() / slugify(pdf_path.stem)
    )

    total_chars, snippets = extract_text(pdf_path)
    rendered_pages = render_pages(pdf_path, output_dir)

    print(f"pdf: {pdf_path}")
    print(f"pages: {len(rendered_pages)}")
    print(f"text_chars: {total_chars}")
    print(f"renders: {output_dir}")
    for snippet in snippets:
        print(snippet)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
