const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync('lib/publishing.js','utf8').replace('export function','function');
const publicationTime = new Function(`${source}; return publicationTime;`)();
const now = Date.parse('2026-09-14T10:00:00Z');
assert.equal(publicationTime('2026-09-15T20:00',now),'2026-09-15T14:30:00.000Z');
assert.equal(publicationTime('2026-10-01T00:00',now),'2026-09-30T18:30:00.000Z');
for (const invalid of ['', '2026-09-13T20:00','2026-09-14T15:30','2026-09-31T20:00','2026-09-15T25:00']) assert.throws(()=>publicationTime(invalid,now));
console.log('7 publishing time assertions passed');
