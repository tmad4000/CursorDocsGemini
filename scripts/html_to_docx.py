#!/usr/bin/env python3
"""
Convert HTML with track changes to Word DOCX with actual tracked changes.

This script parses HTML containing:
- <span class="suggestion-insertion">text</span> -> Word insertions
- <span class="suggestion-deletion">text</span> -> Word deletions

And produces a .docx file with proper Word track changes.

Usage:
    python html_to_docx.py --html "<p>Hello <span class='suggestion-insertion'>new</span> world</p>" --output output.docx
    python html_to_docx.py --input input.html --output output.docx
    cat input.html | python html_to_docx.py --output output.docx  # Read from stdin

Requirements:
    pip install python-docx beautifulsoup4 lxml
"""

import argparse
import sys
import re
from pathlib import Path
from io import BytesIO
from typing import Optional
from datetime import datetime, timezone

try:
    from docx import Document
    from docx.shared import Pt, Inches
    from docx.oxml.ns import qn
    from docx.oxml import OxmlElement
    from bs4 import BeautifulSoup, NavigableString, Tag
except ImportError as e:
    print(f"Missing dependency: {e}", file=sys.stderr)
    print("Install with: pip install python-docx beautifulsoup4 lxml", file=sys.stderr)
    sys.exit(1)

AUTHOR = "AI Docs Editor"


def create_tracked_insertion(run, author: str = AUTHOR):
    """Wrap a run in w:ins (tracked insertion) element."""
    # Create the w:ins element
    ins = OxmlElement('w:ins')
    ins.set(qn('w:id'), str(get_next_rev_id()))
    ins.set(qn('w:author'), author)
    ins.set(qn('w:date'), datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'))

    # Move the run inside the insertion element
    run_element = run._r
    parent = run_element.getparent()
    idx = list(parent).index(run_element)
    parent.remove(run_element)
    ins.append(run_element)
    parent.insert(idx, ins)


def create_tracked_deletion(paragraph, text: str, author: str = AUTHOR):
    """Add tracked deletion (w:del) element to paragraph."""
    # Create the w:del element
    del_elem = OxmlElement('w:del')
    del_elem.set(qn('w:id'), str(get_next_rev_id()))
    del_elem.set(qn('w:author'), author)
    del_elem.set(qn('w:date'), datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'))

    # Create run inside deletion
    r = OxmlElement('w:r')

    # Add deleted text element
    del_text = OxmlElement('w:delText')
    del_text.set(qn('xml:space'), 'preserve')
    del_text.text = text
    r.append(del_text)
    del_elem.append(r)

    paragraph._p.append(del_elem)


_rev_id_counter = 0


def get_next_rev_id() -> int:
    """Get next revision ID for track changes."""
    global _rev_id_counter
    _rev_id_counter += 1
    return _rev_id_counter


def enable_track_revisions(document):
    """Enable track revisions in document settings."""
    settings = document.settings
    # Access the settings XML element
    settings_element = settings.element

    # Check if trackRevisions already exists
    track_revisions = settings_element.find(qn('w:trackRevisions'))
    if track_revisions is None:
        track_revisions = OxmlElement('w:trackRevisions')
        settings_element.append(track_revisions)


def process_element(element, paragraph, document):
    """Process an HTML element and add it to the paragraph."""
    if isinstance(element, NavigableString):
        text = str(element)
        if text.strip() or text:
            run = paragraph.add_run(text)
        return

    if not isinstance(element, Tag):
        return

    tag_name = element.name.lower()
    classes = element.get('class', [])
    if isinstance(classes, str):
        classes = classes.split()

    # Handle track changes spans
    if tag_name == 'span':
        if 'suggestion-insertion' in classes:
            text = element.get_text()
            if text:
                run = paragraph.add_run(text)
                create_tracked_insertion(run)
            return
        elif 'suggestion-deletion' in classes:
            text = element.get_text()
            if text:
                create_tracked_deletion(paragraph, text)
            return

    # Handle formatting tags
    if tag_name == 'strong' or tag_name == 'b':
        for child in element.children:
            if isinstance(child, NavigableString):
                run = paragraph.add_run(str(child))
                run.bold = True
            else:
                process_element(child, paragraph, document)
        return

    if tag_name == 'em' or tag_name == 'i':
        for child in element.children:
            if isinstance(child, NavigableString):
                run = paragraph.add_run(str(child))
                run.italic = True
            else:
                process_element(child, paragraph, document)
        return

    if tag_name == 'u':
        for child in element.children:
            if isinstance(child, NavigableString):
                run = paragraph.add_run(str(child))
                run.underline = True
            else:
                process_element(child, paragraph, document)
        return

    # Handle headers
    if tag_name in ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']:
        # Recurse into children for this new paragraph
        for child in element.children:
            process_element(child, paragraph, document)
        return

    # Handle line breaks
    if tag_name == 'br':
        run = paragraph.add_run()
        run.add_break()
        return

    # Default: recurse into children
    for child in element.children:
        process_element(child, paragraph, document)


def html_to_docx(html: str, output_path: Optional[str] = None) -> bytes:
    """
    Convert HTML with track changes to DOCX.

    Args:
        html: HTML string with optional track change spans
        output_path: Optional path to save the document

    Returns:
        DOCX file as bytes
    """
    global _rev_id_counter
    _rev_id_counter = 0

    soup = BeautifulSoup(html, 'lxml')
    document = Document()

    # Enable track revisions
    enable_track_revisions(document)

    # Find all block-level elements
    body = soup.body if soup.body else soup

    for element in body.children:
        if isinstance(element, NavigableString):
            text = str(element).strip()
            if text:
                p = document.add_paragraph()
                p.add_run(text)
            continue

        if not isinstance(element, Tag):
            continue

        tag_name = element.name.lower()

        # Headers
        if tag_name == 'h1':
            p = document.add_heading(level=1)
            for child in element.children:
                process_element(child, p, document)
        elif tag_name == 'h2':
            p = document.add_heading(level=2)
            for child in element.children:
                process_element(child, p, document)
        elif tag_name == 'h3':
            p = document.add_heading(level=3)
            for child in element.children:
                process_element(child, p, document)
        elif tag_name in ['h4', 'h5', 'h6']:
            p = document.add_heading(level=4)
            for child in element.children:
                process_element(child, p, document)

        # Paragraphs
        elif tag_name == 'p':
            p = document.add_paragraph()
            for child in element.children:
                process_element(child, p, document)

        # Lists
        elif tag_name == 'ul':
            for li in element.find_all('li', recursive=False):
                p = document.add_paragraph(style='List Bullet')
                for child in li.children:
                    process_element(child, p, document)
        elif tag_name == 'ol':
            for li in element.find_all('li', recursive=False):
                p = document.add_paragraph(style='List Number')
                for child in li.children:
                    process_element(child, p, document)

        # Divs and other containers - recurse
        elif tag_name in ['div', 'section', 'article']:
            for child in element.children:
                if isinstance(child, Tag):
                    # Recursively process block elements
                    html_to_docx_element(child, document)
                elif isinstance(child, NavigableString):
                    text = str(child).strip()
                    if text:
                        p = document.add_paragraph()
                        p.add_run(text)

        # Default: treat as paragraph
        else:
            p = document.add_paragraph()
            for child in element.children:
                process_element(child, p, document)

    # Save to bytes
    buffer = BytesIO()
    document.save(buffer)
    buffer.seek(0)
    docx_bytes = buffer.read()

    if output_path:
        Path(output_path).write_bytes(docx_bytes)

    return docx_bytes


def html_to_docx_element(element, document):
    """Process a single block-level element."""
    tag_name = element.name.lower()

    if tag_name == 'h1':
        p = document.add_heading(level=1)
        for child in element.children:
            process_element(child, p, document)
    elif tag_name == 'h2':
        p = document.add_heading(level=2)
        for child in element.children:
            process_element(child, p, document)
    elif tag_name == 'h3':
        p = document.add_heading(level=3)
        for child in element.children:
            process_element(child, p, document)
    elif tag_name == 'p':
        p = document.add_paragraph()
        for child in element.children:
            process_element(child, p, document)
    elif tag_name == 'ul':
        for li in element.find_all('li', recursive=False):
            p = document.add_paragraph(style='List Bullet')
            for child in li.children:
                process_element(child, p, document)
    elif tag_name == 'ol':
        for li in element.find_all('li', recursive=False):
            p = document.add_paragraph(style='List Number')
            for child in li.children:
                process_element(child, p, document)
    else:
        p = document.add_paragraph()
        for child in element.children:
            process_element(child, p, document)


def main():
    parser = argparse.ArgumentParser(description='Convert HTML with track changes to Word DOCX')
    parser.add_argument('--html', type=str, help='HTML string to convert')
    parser.add_argument('--input', '-i', type=str, help='Input HTML file path')
    parser.add_argument('--output', '-o', type=str, required=True, help='Output DOCX file path')

    args = parser.parse_args()

    # Get HTML from args, file, or stdin
    if args.html:
        html = args.html
    elif args.input:
        html = Path(args.input).read_text()
    elif not sys.stdin.isatty():
        html = sys.stdin.read()
    else:
        parser.error('Must provide --html, --input, or pipe HTML via stdin')

    # Convert
    html_to_docx(html, args.output)
    print(f"Created: {args.output}", file=sys.stderr)


if __name__ == '__main__':
    main()
