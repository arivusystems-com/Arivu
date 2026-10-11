const { pipeline } = require('stream');
const { parse } = require('csv-parse');
const { parseCSV } = require('./importCsvParser');
const { openImportReadStream, parseStorageRef } = require('./importStorageDriver');
const { getStagingFile } = require('./importCsvStorage');

async function createCsvParserStream(storageRef) {
  const stream = await openImportReadStream(storageRef);
  const parser = parse({
    bom: true,
    columns: false,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: false,
  });
  // pipeline() forwards source errors to the parser's async iterator and destroys the
  // source when a consumer stops early; errors surface through iteration.
  pipeline(stream, parser, () => {});
  return parser;
}

async function countDataRows(storageRef) {
  const parser = await createCsvParserStream(storageRef);
  let dataRows = 0;
  let sawHeader = false;

  for await (const _record of parser) {
    if (!sawHeader) {
      sawHeader = true;
      continue;
    }
    dataRows += 1;
  }
  return dataRows;
}

async function readCsvPreview(storageRef, limit = 5) {
  const parser = await createCsvParserStream(storageRef);
  let headers = null;
  const preview = [];

  for await (const record of parser) {
    if (!headers) {
      headers = record.map((cell) => String(cell || '').trim());
      continue;
    }
    const row = {};
    headers.forEach((header, index) => {
      row[header] = record[index] != null ? String(record[index]) : '';
    });
    preview.push(row);
    if (preview.length >= limit) break;
  }

  return { headers: headers || [], preview };
}

function rowFromRecord(record, headers) {
  const row = {};
  headers.forEach((header, index) => {
    row[header] = record[index] != null ? String(record[index]) : '';
  });
  return row;
}

async function* iterateCsvRows(storageRef, { skipDataRows = 0 } = {}) {
  const parser = await createCsvParserStream(storageRef);
  let headers = null;
  let dataRowIndex = 0;

  for await (const record of parser) {
    if (!headers) {
      headers = record.map((cell) => String(cell || '').trim());
      continue;
    }

    dataRowIndex += 1;
    if (dataRowIndex <= skipDataRows) continue;

    yield {
      dataRowIndex,
      rowNumber: dataRowIndex + 1,
      row: rowFromRecord(record, headers),
      headers,
    };
  }
}

async function resolveImportRowsSource({ organizationId, csvData, stagingId }) {
  if (stagingId) {
    const { stagingPath } = await getStagingFile({ organizationId, stagingId });
    const totalRows = await countDataRows(stagingPath);
    return {
      storageRef: stagingPath,
      totalRows,
      async *rows() {
        yield* iterateCsvRows(stagingPath);
      },
    };
  }

  if (csvData) {
    const { rows } = parseCSV(csvData);
    return {
      storageRef: null,
      totalRows: rows.length,
      async *rows() {
        for (const [index, row] of rows.entries()) {
          yield {
            dataRowIndex: index + 1,
            rowNumber: index + 2,
            row,
            headers: null,
          };
        }
      },
    };
  }

  const error = new Error('CSV data or stagingId is required');
  error.statusCode = 400;
  throw error;
}

async function resolveStorageRefFromPath(maybeRef) {
  if (!maybeRef) return null;
  parseStorageRef(maybeRef);
  return maybeRef;
}

module.exports = {
  countDataRows,
  readCsvPreview,
  iterateCsvRows,
  resolveImportRowsSource,
  resolveStorageRefFromPath,
};
