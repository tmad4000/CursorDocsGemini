export function stripSuggestionSpans(html: string): string {
    if (!html) return '';
    return html
        // Remove deletions entirely
        .replace(/<span class="suggestion-deletion">.*?<\/span>/g, '')
        // Unwrap insertions
        .replace(/<span class="suggestion-insertion">(.*?)<\/span>/g, '$1');
}

export function htmlToPlainText(html: string): string {
    if (typeof window === 'undefined') return '';
    const container = document.createElement('div');
    container.innerHTML = html;
    return (container.innerText || container.textContent || '').trim();
}

function normalizeWhitespace(text: string): string {
    return text.replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
}

export function htmlToMarkdown(html: string): string {
    if (typeof window === 'undefined') return '';
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const listDepthStack: Array<'ul' | 'ol'> = [];

    const nodeToMarkdown = (node: Node): string => {
        if (node.nodeType === Node.TEXT_NODE) {
            return (node.textContent ?? '');
        }

        if (node.nodeType !== Node.ELEMENT_NODE) return '';
        const el = node as HTMLElement;
        const tag = el.tagName.toLowerCase();

        const children = Array.from(el.childNodes).map(nodeToMarkdown).join('');

        switch (tag) {
            case 'h1':
                return `# ${children.trim()}\n\n`;
            case 'h2':
                return `## ${children.trim()}\n\n`;
            case 'h3':
                return `### ${children.trim()}\n\n`;
            case 'p':
                return `${children.trim()}\n\n`;
            case 'strong':
            case 'b':
                return `**${children}**`;
            case 'em':
            case 'i':
                return `_${children}_`;
            case 's':
            case 'strike':
            case 'del':
                return `~~${children}~~`;
            case 'code': {
                const codeText = el.textContent ?? '';
                if (el.parentElement?.tagName.toLowerCase() === 'pre') {
                    return codeText;
                }
                return `\`${codeText}\``;
            }
            case 'pre': {
                const codeText = el.textContent ?? '';
                return `\`\`\`\n${codeText.replace(/\n$/, '')}\n\`\`\`\n\n`;
            }
            case 'blockquote': {
                const text = children.trim().split('\n').map((line) => `> ${line}`).join('\n');
                return `${text}\n\n`;
            }
            case 'br':
                return '  \n';
            case 'a': {
                const href = el.getAttribute('href') ?? '';
                const label = children.trim() || href;
                return href ? `[${label}](${href})` : label;
            }
            case 'ul':
            case 'ol': {
                listDepthStack.push(tag as 'ul' | 'ol');
                const items = Array.from(el.children)
                    .filter((c) => c.tagName.toLowerCase() === 'li')
                    .map((li) => nodeToMarkdown(li).trim())
                    .filter(Boolean)
                    .map((content, idx) => {
                        const depth = listDepthStack.length - 1;
                        const indent = '  '.repeat(depth);
                        const marker = tag === 'ol' ? `${idx + 1}. ` : '- ';
                        return `${indent}${marker}${content}`;
                    })
                    .join('\n');
                listDepthStack.pop();
                return `${items}\n\n`;
            }
            case 'li':
                return children.trim();
            default:
                return children;
        }
    };

    const markdown = Array.from(doc.body.childNodes).map(nodeToMarkdown).join('');
    return normalizeWhitespace(markdown).trim() + '\n';
}

export function wrapHtmlForWord(bodyHtml: string): string {
    return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8" />
  <title>Document</title>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}
