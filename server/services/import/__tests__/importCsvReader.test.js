'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  countDataRows,
  readCsvPreview,
  iterateCsvRows,
  resolveImportRowsSource
} = require('../importCsvReader');

let dir;

function writeCsv(name, content) {
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, content);
  return filePath;
}

async function collect(iterable) {
  const out = [];
  for await (const item of iterable) out.push(item);
  return out;
}

function withTimeout(promise, ms = 2000) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
    })
  ]).finally(() => clearTimeout(timer));
}

before(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arivu-csv-'));
});

after(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('importCsvReader (csv-parse streaming)', () => {
  it('strips a UTF-8 BOM from the first header', async () => {
    const file = writeCsv('bom.csv', '\uFEFFName,Email\nAda,ada@example.com\n');
    const { headers, preview } = await readCsvPreview(file);
    assert.deepEqual(headers, ['Name', 'Email']);
    assert.deepEqual(preview, [{ Name: 'Ada', Email: 'ada@example.com' }]);
  });

  it('strips a BOM delivered as raw Buffer chunks (object storage streams)', async () => {
    const file = writeCsv('bom-buffer.csv', Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      Buffer.from('Name\nZoë\n', 'utf8')
    ]));
    const rows = await collect(iterateCsvRows(file));
    assert.deepEqual(rows[0].headers, ['Name']);
    assert.deepEqual(rows[0].row, { Name: 'Zoë' });
  });

  it('counts data rows excluding the header and empty lines', async () => {
    const file = writeCsv('count.csv', 'a,b\n1,2\n\n3,4\n\n');
    assert.equal(await countDataRows(file), 2);
  });

  it('handles quoted delimiters, escaped quotes, multiline cells and CRLF', async () => {
    const file = writeCsv('quoted.csv', 'Name,Notes\r\n"Doe, Jane","said ""hi""\r\nsecond line"\r\n');
    const [first] = await collect(iterateCsvRows(file));
    assert.deepEqual(first.row, { Name: 'Doe, Jane', Notes: 'said "hi"\r\nsecond line' });
  });

  it('tolerates ragged rows and preserves cell whitespace', async () => {
    const file = writeCsv('ragged.csv', ' Name , Email ,Phone\n Ada ,ada@example.com\nBob,bob@example.com,123,extra\n');
    const rows = await collect(iterateCsvRows(file));
    assert.deepEqual(rows[0].headers, ['Name', 'Email', 'Phone']);
    assert.deepEqual(rows[0].row, { Name: ' Ada ', Email: 'ada@example.com', Phone: '' });
    assert.deepEqual(rows[1].row, { Name: 'Bob', Email: 'bob@example.com', Phone: '123' });
  });

  it('returns row numbers and supports resuming with skipDataRows', async () => {
    const file = writeCsv('resume.csv', 'n\n1\n2\n3\n');
    const rows = await collect(iterateCsvRows(file, { skipDataRows: 2 }));
    assert.deepEqual(rows.map((r) => [r.dataRowIndex, r.rowNumber, r.row.n]), [[3, 4, '3']]);
  });

  it('stops reading after the preview limit', async () => {
    const lines = ['id'];
    for (let i = 0; i < 5000; i += 1) lines.push(String(i));
    const file = writeCsv('large.csv', `${lines.join('\n')}\n`);
    const { preview } = await readCsvPreview(file, 3);
    assert.deepEqual(preview.map((r) => r.id), ['0', '1', '2']);
  });

  it('returns empty headers for an empty file', async () => {
    const file = writeCsv('empty.csv', '');
    assert.deepEqual(await readCsvPreview(file), { headers: [], preview: [] });
    assert.equal(await countDataRows(file), 0);
  });

  it('surfaces parse errors for malformed quoting', async () => {
    const file = writeCsv('bad.csv', 'a,b\n"unterminated,1\n');
    await assert.rejects(withTimeout(countDataRows(file)), (error) => {
      assert.match(error.code || '', /^CSV_/);
      return true;
    });
  });

  it('surfaces source stream errors instead of hanging', async () => {
    await assert.rejects(
      withTimeout(countDataRows(path.join(dir, 'does-not-exist.csv'))),
      (error) => error.code === 'ENOENT'
    );
  });

  it('resolves inline csvData without staging', async () => {
    const source = await resolveImportRowsSource({ organizationId: 'org1', csvData: 'Name\nAda\n' });
    assert.equal(source.totalRows, 1);
    const rows = await collect(source.rows());
    assert.equal(rows[0].rowNumber, 2);
    assert.equal(rows[0].row.Name, 'Ada');
  });

  it('rejects when neither csvData nor stagingId is provided', async () => {
    await assert.rejects(resolveImportRowsSource({ organizationId: 'org1' }), (error) => error.statusCode === 400);
  });
});
