import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const { window } = new JSDOM('');
globalThis.window = window;
const { sanitizeRichHtml } = await import('./sanitizeRichHtml.ts');

test('removes executable markup and unsafe URL schemes', () => {
    const clean = new window.DOMParser().parseFromString(sanitizeRichHtml(
        '<p onclick="alert(1)">Hi<script>alert(1)</script><img src="x" onerror="alert(1)">' +
        '<a href="javascript:alert(1)">bad link</a><svg onload="alert(1)"></svg></p>'
    ), 'text/html');

    assert.equal(clean.querySelector('script'), null);
    assert.equal(clean.querySelector('[onclick], [onerror], [onload]'), null);
    assert.equal(clean.querySelector('a')?.getAttribute('href'), null);
    assert.match(clean.body.textContent, /Hi/);
});

test('preserves supported rich text formatting, links, and images', () => {
    const clean = new window.DOMParser().parseFromString(sanitizeRichHtml(
        '<p><strong>Bold</strong> and <em>italic</em> <a href="https://example.com">link</a>' +
        '<img src="https://example.com/photo.jpg" alt="photo"></p><ul><li>item</li></ul>'
    ), 'text/html');

    assert.equal(clean.querySelector('strong')?.textContent, 'Bold');
    assert.equal(clean.querySelector('em')?.textContent, 'italic');
    assert.equal(clean.querySelector('a')?.getAttribute('href'), 'https://example.com');
    assert.equal(clean.querySelector('img')?.getAttribute('src'), 'https://example.com/photo.jpg');
    assert.equal(clean.querySelector('li')?.textContent, 'item');
});

test('preserves new-tab links while preventing opener access and executable URLs', () => {
    const clean = new window.DOMParser().parseFromString(sanitizeRichHtml(
        '<a href="https://example.com" target="_blank" rel="opener nofollow" onclick="alert(1)">New tab</a>' +
        '<a href="javascript:alert(2)" target="_BLANK">Unsafe</a>'
    ), 'text/html');
    const [link, unsafe] = clean.querySelectorAll('a');
    assert.equal(link.getAttribute('target'), '_blank');
    assert.equal(link.getAttribute('href'), 'https://example.com');
    assert.ok(link.relList.contains('nofollow'));
    assert.ok(link.relList.contains('noopener'));
    assert.ok(link.relList.contains('noreferrer'));
    assert.ok(!link.relList.contains('opener'));
    assert.equal(link.getAttribute('onclick'), null);
    assert.equal(unsafe.getAttribute('href'), null);
    assert.ok(unsafe.relList.contains('noopener'));
});
