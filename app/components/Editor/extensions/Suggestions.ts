import { Mark, mergeAttributes } from '@tiptap/core';

export const Insertion = Mark.create({
    name: 'insertion',

    parseHTML() {
        return [
            {
                tag: 'span',
                getAttrs: (element) => {
                    if (typeof element === 'string') return false;
                    return element.classList.contains('suggestion-insertion') && null;
                },
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['span', mergeAttributes(HTMLAttributes, { class: 'suggestion-insertion' }), 0];
    },
});

export const Deletion = Mark.create({
    name: 'deletion',

    parseHTML() {
        return [
            {
                tag: 'span',
                getAttrs: (element) => {
                    if (typeof element === 'string') return false;
                    return element.classList.contains('suggestion-deletion') && null;
                },
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['span', mergeAttributes(HTMLAttributes, { class: 'suggestion-deletion' }), 0];
    },
});
