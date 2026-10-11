// Stamps each shared file's address with a short hash of its content, so a visitor
// never gets a fresh page together with a stale cached style or script.
// Run `node stamp.mjs` after changing anything in docs/; the tests fail if it was skipped.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const docs = new URL('./docs/', import.meta.url);
export const PAGES = ['index.html', 'check/index.html'];
const ASSETS = ['style.css', 'calc.js', 'quiz.js'];

const hash = (name) => createHash('sha1').update(readFileSync(new URL(name, docs))).digest('hex').slice(0, 8);

export const readPage = (page) => readFileSync(new URL(page, docs), 'utf8');

export function stamped(html) {
  for (const name of ASSETS) {
    const address = new RegExp(`(href|src)="((?:\\.\\./)?)${name.replace('.', '\\.')}(?:\\?v=[0-9a-f]+)?"`, 'g');
    html = html.replace(address, `$1="$2${name}?v=${hash(name)}"`);
  }
  return html;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const page of PAGES) writeFileSync(new URL(page, docs), stamped(readPage(page)));
  console.log('stamped', PAGES.join(', '));
}
