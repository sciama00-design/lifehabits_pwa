import DOMPurify from 'dompurify';

DOMPurify.addHook('afterSanitizeAttributes', (element) => {
    if (element.getAttribute('target')?.toLowerCase() === '_blank') {
        const rel = new Set((element.getAttribute('rel') || '').split(/\s+/)
            .filter(value => value && value.toLowerCase() !== 'opener'));
        rel.add('noopener');
        rel.add('noreferrer');
        element.setAttribute('rel', [...rel].join(' '));
    }
});

export function sanitizeRichHtml(html: string): string {
    return DOMPurify.sanitize(html, { ADD_ATTR: ['target'] });
}
