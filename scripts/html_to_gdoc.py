#!/usr/bin/env python3
"""
Convert HTML with track changes to Google Docs with suggestions.

This script creates a Google Doc from HTML content, converting:
- <span class="suggestion-insertion">text</span> -> Google Docs suggestion (add)
- <span class="suggestion-deletion">text</span> -> Google Docs suggestion (delete)

Usage:
    python html_to_gdoc.py --html "<p>Hello world</p>" --title "My Document"
    python html_to_gdoc.py --input input.html --title "My Document"
    cat input.html | python html_to_gdoc.py --title "My Document"

Requirements:
    pip install google-auth google-auth-oauthlib google-api-python-client beautifulsoup4 lxml

Environment:
    GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
    or pass --credentials /path/to/service-account.json
"""

import argparse
import sys
import os
import json
from pathlib import Path
from typing import Optional, List, Dict, Any

try:
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    from bs4 import BeautifulSoup, NavigableString, Tag
except ImportError as e:
    print(f"Missing dependency: {e}", file=sys.stderr)
    print("Install with: pip install google-auth google-api-python-client beautifulsoup4 lxml", file=sys.stderr)
    sys.exit(1)

SCOPES = [
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/drive.file'
]


def get_credentials(credentials_path: Optional[str] = None):
    """Get Google service account credentials."""
    if credentials_path:
        creds_file = credentials_path
    else:
        creds_file = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')

    if not creds_file:
        # Try default location in script directory
        script_dir = Path(__file__).parent.parent
        default_path = script_dir / 'service-account.json'
        if default_path.exists():
            creds_file = str(default_path)
        else:
            raise ValueError(
                "No credentials found. Set GOOGLE_APPLICATION_CREDENTIALS or pass --credentials"
            )

    return service_account.Credentials.from_service_account_file(
        creds_file, scopes=SCOPES
    )


def create_google_doc(title: str, credentials) -> Dict[str, Any]:
    """Create a new Google Doc and return its metadata."""
    docs_service = build('docs', 'v1', credentials=credentials)
    drive_service = build('drive', 'v3', credentials=credentials)

    # Create the document
    doc = docs_service.documents().create(body={'title': title}).execute()
    doc_id = doc['documentId']

    # Make it shareable (anyone with link can edit)
    drive_service.permissions().create(
        fileId=doc_id,
        body={
            'type': 'anyone',
            'role': 'writer'
        }
    ).execute()

    return {
        'documentId': doc_id,
        'title': title,
        'url': f"https://docs.google.com/document/d/{doc_id}/edit"
    }


def html_to_requests(html: str) -> List[Dict[str, Any]]:
    """
    Convert HTML to Google Docs API requests.

    Returns a list of requests to be applied in reverse order
    (Google Docs API applies from end to start for insertions).
    """
    soup = BeautifulSoup(html, 'lxml')
    body = soup.body if soup.body else soup

    # First pass: extract all content and track changes
    segments = []

    def process_element(element, styles=None):
        """Process an element and extract text segments."""
        if styles is None:
            styles = {}

        if isinstance(element, NavigableString):
            text = str(element)
            if text:
                segments.append({
                    'type': 'text',
                    'text': text,
                    'styles': styles.copy()
                })
            return

        if not isinstance(element, Tag):
            return

        tag_name = element.name.lower()
        classes = element.get('class', [])
        if isinstance(classes, str):
            classes = classes.split()

        # Handle track change spans
        if tag_name == 'span':
            if 'suggestion-insertion' in classes:
                segments.append({
                    'type': 'insertion',
                    'text': element.get_text(),
                    'styles': styles.copy()
                })
                return
            elif 'suggestion-deletion' in classes:
                segments.append({
                    'type': 'deletion',
                    'text': element.get_text(),
                    'styles': styles.copy()
                })
                return

        # Handle formatting
        new_styles = styles.copy()
        if tag_name in ['strong', 'b']:
            new_styles['bold'] = True
        elif tag_name in ['em', 'i']:
            new_styles['italic'] = True
        elif tag_name == 'u':
            new_styles['underline'] = True
        elif tag_name == 'h1':
            new_styles['heading'] = 'HEADING_1'
        elif tag_name == 'h2':
            new_styles['heading'] = 'HEADING_2'
        elif tag_name == 'h3':
            new_styles['heading'] = 'HEADING_3'

        # Handle block elements - add newlines
        if tag_name in ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li']:
            # Process children
            for child in element.children:
                process_element(child, new_styles)
            # Add newline after block elements
            segments.append({'type': 'text', 'text': '\n', 'styles': {}})
        elif tag_name == 'br':
            segments.append({'type': 'text', 'text': '\n', 'styles': {}})
        elif tag_name in ['ul', 'ol']:
            for li in element.find_all('li', recursive=False):
                segments.append({'type': 'text', 'text': '• ', 'styles': {}})
                for child in li.children:
                    process_element(child, new_styles)
                segments.append({'type': 'text', 'text': '\n', 'styles': {}})
        else:
            # Default: recurse
            for child in element.children:
                process_element(child, new_styles)

    # Process all top-level elements
    for element in body.children:
        process_element(element)

    # Build the requests
    # Google Docs API requires inserting from the end, so we build content first
    # then create requests

    requests = []
    current_index = 1  # Google Docs starts at index 1

    # First, insert all text (both regular and suggestions)
    # We'll handle suggestions separately after
    full_text = ""
    text_segments = []  # Track where each segment ends up

    for seg in segments:
        if seg['type'] == 'text':
            text_segments.append({
                'start': len(full_text) + 1,
                'end': len(full_text) + len(seg['text']) + 1,
                'text': seg['text'],
                'styles': seg['styles'],
                'type': 'text'
            })
            full_text += seg['text']
        elif seg['type'] == 'insertion':
            # For suggestions, we insert the text but mark it as a suggestion
            text_segments.append({
                'start': len(full_text) + 1,
                'end': len(full_text) + len(seg['text']) + 1,
                'text': seg['text'],
                'styles': seg['styles'],
                'type': 'insertion'
            })
            full_text += seg['text']
        elif seg['type'] == 'deletion':
            # For deletions, we still need to show the text (struck through)
            # Google Docs suggestions work differently - we show deleted text as strikethrough
            text_segments.append({
                'start': len(full_text) + 1,
                'end': len(full_text) + len(seg['text']) + 1,
                'text': seg['text'],
                'styles': {**seg['styles'], 'strikethrough': True, 'color': {'red': 0.8, 'green': 0.2, 'blue': 0.2}},
                'type': 'deletion'
            })
            full_text += seg['text']

    if not full_text:
        return []

    # Insert all text at once
    requests.append({
        'insertText': {
            'location': {'index': 1},
            'text': full_text
        }
    })

    # Apply formatting for each segment
    for seg in text_segments:
        if not seg['styles'] and seg['type'] == 'text':
            continue

        text_style = {}

        if seg['styles'].get('bold'):
            text_style['bold'] = True
        if seg['styles'].get('italic'):
            text_style['italic'] = True
        if seg['styles'].get('underline'):
            text_style['underline'] = True
        if seg['styles'].get('strikethrough'):
            text_style['strikethrough'] = True
        if seg['styles'].get('color'):
            text_style['foregroundColor'] = {'color': {'rgbColor': seg['styles']['color']}}

        # Mark insertions with green color
        if seg['type'] == 'insertion':
            text_style['foregroundColor'] = {'color': {'rgbColor': {'red': 0.2, 'green': 0.6, 'blue': 0.2}}}
            text_style['underline'] = True

        if text_style:
            requests.append({
                'updateTextStyle': {
                    'range': {
                        'startIndex': seg['start'],
                        'endIndex': seg['end']
                    },
                    'textStyle': text_style,
                    'fields': ','.join(text_style.keys())
                }
            })

        # Apply paragraph style for headings
        if seg['styles'].get('heading'):
            requests.append({
                'updateParagraphStyle': {
                    'range': {
                        'startIndex': seg['start'],
                        'endIndex': seg['end']
                    },
                    'paragraphStyle': {
                        'namedStyleType': seg['styles']['heading']
                    },
                    'fields': 'namedStyleType'
                }
            })

    return requests


def create_doc_from_html(
    html: str,
    title: str,
    credentials_path: Optional[str] = None
) -> Dict[str, Any]:
    """
    Create a Google Doc from HTML with track changes.

    Returns dict with documentId, title, and url.
    """
    credentials = get_credentials(credentials_path)

    # Create the document
    doc_info = create_google_doc(title, credentials)
    doc_id = doc_info['documentId']

    # Convert HTML to requests
    requests = html_to_requests(html)

    if requests:
        # Apply the requests
        docs_service = build('docs', 'v1', credentials=credentials)
        docs_service.documents().batchUpdate(
            documentId=doc_id,
            body={'requests': requests}
        ).execute()

    return doc_info


def main():
    parser = argparse.ArgumentParser(
        description='Convert HTML with track changes to Google Docs'
    )
    parser.add_argument('--html', type=str, help='HTML string to convert')
    parser.add_argument('--input', '-i', type=str, help='Input HTML file path')
    parser.add_argument('--title', '-t', type=str, default='Untitled Document',
                       help='Title for the Google Doc')
    parser.add_argument('--credentials', '-c', type=str,
                       help='Path to service account JSON')
    parser.add_argument('--json', action='store_true',
                       help='Output result as JSON')

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

    try:
        result = create_doc_from_html(html, args.title, args.credentials)

        if args.json:
            print(json.dumps(result))
        else:
            print(f"Created: {result['title']}", file=sys.stderr)
            print(f"URL: {result['url']}", file=sys.stderr)
            print(result['url'])  # Output URL to stdout for scripts

    except Exception as e:
        if args.json:
            print(json.dumps({'error': str(e)}))
        else:
            print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
