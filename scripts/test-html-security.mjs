import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
    url: 'http://localhost/',
    pretendToBeVisual: true,
});
Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    Node: dom.window.Node,
    MutationObserver: dom.window.MutationObserver,
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
dom.window.Element.prototype.getClientRects ??= () => [{ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }];
dom.window.Range.prototype.getClientRects ??= () => [{ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }];
dom.window.Range.prototype.getBoundingClientRect ??= () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 });

const React = await import('react');
const { createRoot } = await import('react-dom/client');
const { sanitizeRichHtml } = await import('../src/lib/sanitizeRichHtml.ts');
const server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL('..', import.meta.url)),
    plugins: [react()],
    resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: 'custom',
});

try {
    const { TextPostModal } = await server.ssrLoadModule('/src/components/shared/TextPostModal.tsx');
    const { RichTextEditor } = await server.ssrLoadModule('/src/components/editor/RichTextEditor.tsx');
    const root = createRoot(document.getElementById('app'));
    const payload = [
        '<p><strong>Keep bold</strong> and <em>italic</em></p><ul><li>Keep list</li></ul>',
        '<a href="https://example.com" target="_blank">Keep safe link</a>',
        '<script>alert(1)</script><img src=x onerror=alert(1)>',
        '<svg onload=alert(1)><a xlink:href="javascript:alert(2)">svg link</a></svg>',
        '<math><mtext><table><mglyph><style><!--</style><img title="--><img src=x onerror=alert(3)>">',
        '<a href="jav&#x61;script:alert(4)">encoded scheme</a>',
        '<a href="java&#x09;script:alert(5)">tab scheme</a>',
        '<iframe src="data:text/html,<script>alert(6)</script>"></iframe>',
    ].join('');

    await React.act(async () => root.render(React.createElement(TextPostModal, {
        isOpen: true,
        onClose() {},
        title: 'Security fixture',
        content: payload,
    })));

    const content = document.body.querySelector('.prose');
    assert.ok(content, 'real TextPostModal content rendered');
    assert.equal(content.querySelector('strong')?.textContent, 'Keep bold');
    assert.equal(content.querySelector('em')?.textContent, 'italic');
    assert.equal(content.querySelector('li')?.textContent, 'Keep list');
    assert.equal(content.querySelector('a[href="https://example.com"]')?.textContent, 'Keep safe link');
    const newTabLink = content.querySelector('a[href="https://example.com"]');
    assert.equal(newTabLink?.getAttribute('target'), '_blank', 'existing new-tab behavior is preserved');
    assert.ok(newTabLink.relList.contains('noopener'), 'new tab cannot access the opener');
    assert.ok(newTabLink.relList.contains('noreferrer'));
    assert.equal(content.querySelector('script, iframe'), null);
    assert.equal(content.querySelector('[onerror], [onload], [xlink\\:href]'), null);
    for (const link of content.querySelectorAll('a[href]')) {
        assert.match(link.getAttribute('href'), /^(https?:|mailto:|tel:)/i);
    }
    await React.act(async () => root.unmount());

    const sinkFiles = [
        'src/components/shared/TextPostModal.tsx',
        'src/components/shared/ContentCard.tsx',
        'src/pages/client/ClientDashboard.tsx',
        'src/pages/coach/CoachBoard.tsx',
        'src/components/shared/MediaViewer.tsx',
    ];
    for (const file of sinkFiles) {
        const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
        assert.match(source, /dangerouslySetInnerHTML=\{\{\s*__html:\s*sanitizeRichHtml\(/, `${file} uses sanitizer at its HTML sink`);
    }

    let editorValue = '<p><strong>Bold</strong> and <em>italic</em></p><ul><li>First</li></ul>';
    const changes = [];
    const editorRoot = createRoot(document.getElementById('app'));
    const renderEditor = () => React.createElement(RichTextEditor, {
        value: editorValue,
        onChange(html) { changes.push(html); },
    });
    await React.act(async () => editorRoot.render(renderEditor()));
    const editor = document.querySelector('.tiptap');
    assert.ok(editor, 'TipTap editor mounted');
    assert.equal(editor.querySelector('strong')?.textContent, 'Bold');
    assert.equal(editor.querySelector('em')?.textContent, 'italic');
    assert.equal(editor.querySelector('ul li')?.textContent, 'First');
    assert.deepEqual(changes, [], 'mount does not emit onChange');
    const initialChangeCount = changes.length;

    editorValue = '<p>Updated value</p><ol><li>Second</li></ol>';
    await React.act(async () => editorRoot.render(renderEditor()));
    assert.equal(editor.querySelector('p')?.textContent, 'Updated value');
    assert.equal(editor.querySelector('ol li')?.textContent, 'Second');
    assert.equal(changes.length, initialChangeCount, 'external value update does not emit onChange');

    const textNode = editor.querySelector('p')?.firstChild;
    assert.ok(textNode, 'editable text rendered');
    const beforeInput = changes.length;
    await React.act(async () => {
        textNode.textContent += '!';
        editor.dispatchEvent(new window.InputEvent('input', { inputType: 'insertText', data: '!', bubbles: true }));
        await new Promise(resolve => setTimeout(resolve, 0));
    });
    assert.ok(changes.length > beforeInput, 'text input emits onChange HTML');
    assert.match(changes.at(-1), /Updated value!/);
    assert.equal(document.querySelectorAll('button').length, 5, 'bold, list, and link toolbar controls rendered');
    const editorSource = await readFile(new URL('../src/components/editor/RichTextEditor.tsx', import.meta.url), 'utf8');
    assert.match(editorSource, /toggleBold\(\)\.run\(\)/);
    assert.match(editorSource, /toggleBulletList\(\)\.run\(\)/);

    await React.act(async () => editorRoot.unmount());

    const sanitized = new dom.window.DOMParser().parseFromString(sanitizeRichHtml(payload), 'text/html');
    assert.equal(sanitized.querySelector('script, iframe, [onerror], [onload]'), null);
    console.log('HTML security checks passed: rich text rendering/editing, sink coverage, attack corpus.');
} finally {
    await server.close();
    dom.window.close();
}
