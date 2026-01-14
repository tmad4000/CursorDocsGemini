#!/usr/bin/env python3
"""
Convert HTML with track changes to Google Docs with suggestions.

This script creates a Google Doc from HTML content, converting:
- <span class="suggestion-insertion">text</span> -> Green underlined text (insertion)
- <span class="suggestion-deletion">text</span> -> Red strikethrough text (deletion)

Usage:
    python html_to_gdoc.py --html "<p>Hello world</p>" --title "My Document"
    python html_to_gdoc.py --input input.html --title "My Document"
    cat input.html | python html_to_gdoc.py --title "My Document"

Requirements:
    pip install google-auth google-auth-oauthlib google-api-python-client beautifulsoup4 lxml

First run will open browser for OAuth consent.
"""

import argparse
import sys
import os
import json
import pickle
from pathlib import Path
from typing import Optional, List, Dict, Any

try:
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from google.auth.transport.requests import Request
    from googleapiclient.discovery import build
    from bs4 import BeautifulSoup, NavigableString, Tag
except ImportError as e:
    print(f"Missing dependency: {e}", file=sys.stderr)
    print("Install with: pip install google-auth google-auth-oauthlib google-api-python-client beautifulsoup4 lxml", file=sys.stderr)
    sys.exit(1)

SCOPES = [
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/drive.file'
]

# Paths relative to script directory
SCRIPT_DIR = Path(__file__).parent.parent
TOKEN_FILE = SCRIPT_DIR / 'gdoc_token.pickle'
CLIENT_SECRET_GLOB = str(Path.home() / 'Downloads' / 'client_secret_*.json')


def get_credentials():
    """Get Google OAuth credentials, prompting for login if needed."""
    creds = None

    # Load existing token
    if TOKEN_FILE.exists():
        with open(TOKEN_FILE, 'rb') as token:
            creds = pickle.load(token)

    # Refresh or get new credentials
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            # Find client secret file
            import glob
            client_files = glob.glob(CLIENT_SECRET_GLOB)
            if not client_files:
                # Also check project root
                client_files = glob.glob(str(SCRIPT_DIR / 'client_secret_*.json'))

            if not client_files:
                raise FileNotFoundError(
                    f"No client_secret_*.json found in ~/Downloads or project root.\n"
                    "Download OAuth credentials from Google Cloud Console."
                )

            client_file = client_files[0]
            print(f"Using credentials: {client_file}", file=sys.stderr)

            flow = InstalledAppFlow.from_client_secrets_file(client_file, SCOPES)
            creds = flow.run_local_server(port=0)

        # Save token for next time
        with open(TOKEN_FILE, 'wb') as token:
            pickle.dump(creds, token)
        print(f"Token saved to {TOKEN_FILE}", file=sys.stderr)

    return creds


def create_google_doc(title: str, credentials) -> Dict[str, Any]:
    """Create a new Google Doc and return its metadata."""
    docs_service = build('docs', 'v1', credentials=credentials)

    # Create the document
    doc = docs_service.documents().create(body={'title': title}).execute()
    doc_id = doc['documentId']

    return {
        'documentId': doc_id,
        'title': title,
        'url': f"https://docs.google.com/document/d/{doc_id}/edit"
    }


def html_to_requests(html: str) -> List[Dict[str, Any]]:
    """
    Convert HTML to Google Docs API requests.
    """
    soup = BeautifulSoup(html, 'lxml')
    body = soup.body if soup.body else soup

    # Extract all content and track changes
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
            for child in element.children:
                process_element(child, new_styles)
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
            for child in element.children:
                process_element(child, new_styles)

    # Process all top-level elements
    for element in body.children:
        process_element(element)

    # Build requests
    requests = []
    text_segments = []
    full_text = ""

    for seg in segments:
        start_idx = len(full_text) + 1
        text = seg.get('text', '')
        end_idx = start_idx + len(text)

        text_segments.append({
            'start': start_idx,
            'end': end_idx,
            'text': text,
            'styles': seg.get('styles', {}),
            'type': seg['type']
        })
        full_text += text

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
        if seg['end'] <= seg['start']:
            continue

        text_style = {}
        fields = []

        if seg['styles'].get('bold'):
            text_style['bold'] = True
            fields.append('bold')
        if seg['styles'].get('italic'):
            text_style['italic'] = True
            fields.append('italic')
        if seg['styles'].get('underline'):
            text_style['underline'] = True
            fields.append('underline')

        # Mark insertions with green color + underline
        if seg['type'] == 'insertion':
            text_style['foregroundColor'] = {'color': {'rgbColor': {'red': 0.13, 'green': 0.55, 'blue': 0.13}}}
            text_style['underline'] = True
            fields.extend(['foregroundColor', 'underline'])

        # Mark deletions with red color + strikethrough
        if seg['type'] == 'deletion':
            text_style['foregroundColor'] = {'color': {'rgbColor': {'red': 0.8, 'green': 0.2, 'blue': 0.2}}}
            text_style['strikethrough'] = True
            fields.extend(['foregroundColor', 'strikethrough'])

        if text_style and fields:
            requests.append({
                'updateTextStyle': {
                    'range': {
                        'startIndex': seg['start'],
                        'endIndex': seg['end']
                    },
                    'textStyle': text_style,
                    'fields': ','.join(set(fields))
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


def create_doc_from_html(html: str, title: str) -> Dict[str, Any]:
    """
    Create a Google Doc from HTML with track changes visualization.
    Returns dict with documentId, title, and url.
    """
    credentials = get_credentials()

    # Create the document
    doc_info = create_google_doc(title, credentials)
    doc_id = doc_info['documentId']

    # Convert HTML to requests
    requests = html_to_requests(html)

    if requests:
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
        result = create_doc_from_html(html, args.title)

        if args.json:
            print(json.dumps(result))
        else:
            print(f"Created: {result['title']}", file=sys.stderr)
            print(f"URL: {result['url']}", file=sys.stderr)
            print(result['url'])

    except Exception as e:
        if args.json:
            print(json.dumps({'error': str(e)}))
        else:
            print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
