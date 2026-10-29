'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');

function structuralTokens(source) {
  const tokens = [];
  let quote = null;
  let comment = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];

    if (comment) {
      if (char === '*' && next === '/') {
        comment = false;
        i += 1;
      }
      continue;
    }
    if (!quote && char === '/' && next === '*') {
      comment = true;
      i += 1;
      continue;
    }
    if (quote) {
      if (char === '\\') i += 1;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '{' || char === '}') tokens.push({ char, index: i });
  }

  assert.equal(comment, false, 'styles.css has an unterminated comment');
  assert.equal(quote, null, 'styles.css has an unterminated string');
  return tokens;
}

test('styles.css has balanced blocks', () => {
  let depth = 0;
  for (const token of structuralTokens(css)) {
    depth += token.char === '{' ? 1 : -1;
    assert.ok(depth >= 0, `unexpected closing brace at byte ${token.index}`);
  }
  assert.equal(depth, 0, 'styles.css has an unclosed block');
});

test('desktop workspace controls are not trapped in a phone media query', () => {
  const desktopSelectors = [
    '.workspace-help{',
    '.utility-modal{',
    '.inline-field{',
    '.surface-axis{',
    '.surface-row{',
  ];
  const tokens = structuralTokens(css);

  for (const selector of desktopSelectors) {
    const selectorIndex = css.indexOf(selector);
    assert.notEqual(selectorIndex, -1, `${selector} is missing`);

    const stack = [];
    for (const token of tokens) {
      if (token.index >= selectorIndex) break;
      if (token.char === '{') {
        const preludeStart = Math.max(css.lastIndexOf('}', token.index - 1), css.lastIndexOf('{', token.index - 1)) + 1;
        stack.push(css.slice(preludeStart, token.index).trim());
      } else {
        stack.pop();
      }
    }

    const phoneAncestor = stack.find((prelude) => /^@media\s*\([^)]*max-width\s*:\s*720px/i.test(prelude));
    assert.equal(phoneAncestor, undefined, `${selector} must remain available on desktop`);
  }
});
