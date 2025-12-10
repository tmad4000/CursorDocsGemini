import { diffWords } from 'diff';

export function computeDiff(oldText: string, newText: string): string {
    const diff = diffWords(oldText, newText);
    let html = '';

    diff.forEach((part) => {
        const value = part.value;
        if (part.added) {
            html += `<span class="suggestion-insertion">${value}</span>`;
        } else if (part.removed) {
            html += `<span class="suggestion-deletion">${value}</span>`;
        } else {
            html += value;
        }
    });

    return html;
}
