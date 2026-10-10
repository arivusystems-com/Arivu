const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const objectStorage = require('../objectStorageService');
const {
  IMPORT_BASE_DIR,
  IMPORT_MAX_FILE_BYTES,
  IMPORT_STAGING_TTL_MS,
} = require('./importConstants');

const OCI_PREFIX = 'oci:';
const LOCAL_PREFIX = 'local:';

function getStorageDriver() {
  const driver = String(process.env.IMPORT_STORAGE_DRIVER || 'local').trim().toLowerCase();
  if (driver === 'oci') return 'oci';
  return 'local';
}

function isOciConfigured() {
  return Boolean(
    String(process.env.STORAGE_ENDPOINT || '').trim()
    && String(process.env.STORAGE_BUCKET || '').trim()
  );
}

function useOciStorage() {
  return getStorageDriver() === 'oci' && isOciConfigured();
}

function safeOrgId(orgId) {
  return String(orgId || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
}

function buildOciStagingKey(organizationId, stagingId) {
  return `imports/staging/${safeOrgId(organizationId)}/${stagingId}.csv`;
}

function buildOciStagingMetaKey(organizationId, stagingId) {
  return `imports/staging/${safeOrgId(organizationId)}/${stagingId}.meta.json`;
}

function buildOciJobKey(organizationId, importHistoryId) {
  return `imports/jobs/${safeOrgId(organizationId)}/${importHistoryId}.csv`;
}

function toStorageRef(kind, value) {
  if (kind === 'oci') return `${OCI_PREFIX}${value}`;
  return `${LOCAL_PREFIX}${value}`;
}

function parseStorageRef(storageRef) {
  const raw = String(storageRef || '');
  if (raw.startsWith(OCI_PREFIX)) {
    return { driver: 'oci', key: raw.slice(OCI_PREFIX.length) };
  }
  if (raw.startsWith(LOCAL_PREFIX)) {
    return { driver: 'local', filePath: raw.slice(LOCAL_PREFIX.length) };
  }
  // Legacy absolute paths from earlier implementation
  if (raw.startsWith('/')) {
    return { driver: 'local', filePath: raw };
  }
  return { driver: 'local', filePath: path.join(IMPORT_BASE_DIR, raw) };
}

function stagingDir(orgId) {
  return path.join(IMPORT_BASE_DIR, 'staging', safeOrgId(orgId));
}

function importDir(orgId) {
  return path.join(IMPORT_BASE_DIR, 'jobs', safeOrgId(orgId));
}

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

function buildStagingMetaPath(stagingPath) {
  return `${stagingPath}.meta.json`;
}

async function writeStagingMeta(stagingMetaPath, meta) {
  await fsp.writeFile(stagingMetaPath, JSON.stringify(meta), 'utf8');
}

async function readStagingMeta(stagingMetaPath) {
  try {
    const raw = await fsp.readFile(stagingMetaPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeOciStagingMeta(key, meta) {
  await objectStorage.putBuffer({
    key,
    buffer: Buffer.from(JSON.stringify(meta)),
    contentType: 'application/json',
  });
}

async function readOciStagingMeta(key) {
  try {
    const buf = await objectStorage.getBuffer({ key });
    const raw = Buffer.isBuffer(buf) ? buf.toString('utf8') : String(buf || '');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function deleteOciQuietly(key) {
  if (!key) return;
  try {
    await objectStorage.deleteObject({ key });
  } catch {
    /* ignore */
  }
}

async function deleteFileQuietly(filePath) {
  try {
    await fsp.unlink(filePath);
  } catch {
    /* ignore */
  }
}

async function openImportReadStream(storageRef) {
  const parsed = parseStorageRef(storageRef);
  if (parsed.driver === 'oci') {
    const { stream } = await objectStorage.getObjectStream({ key: parsed.key });
    return stream;
  }
  return fs.createReadStream(parsed.filePath, { encoding: 'utf8' });
}

async function saveStagingUpload({ organizationId, buffer, originalName, importedBy }) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error('CSV buffer is required');
  }
  if (buffer.length > IMPORT_MAX_FILE_BYTES) {
    const err = new Error(`File exceeds maximum import size of ${IMPORT_MAX_FILE_BYTES} bytes`);
    err.code = 'IMPORT_FILE_TOO_LARGE';
    throw err;
  }

  const stagingId = uuidv4();
  const meta = {
    stagingId,
    organizationId: String(organizationId),
    importedBy: String(importedBy),
    fileName: originalName || 'import.csv',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + IMPORT_STAGING_TTL_MS).toISOString(),
    byteSize: buffer.length,
    storageDriver: useOciStorage() ? 'oci' : 'local',
  };

  if (useOciStorage()) {
    const key = buildOciStagingKey(organizationId, stagingId);
    await objectStorage.putBuffer({
      key,
      buffer,
      contentType: 'text/csv',
      metadata: { stagingId, organizationId: String(organizationId) },
    });
    meta.storageRef = toStorageRef('oci', key);
    meta.stagingMetaKey = buildOciStagingMetaKey(organizationId, stagingId);
    await writeOciStagingMeta(meta.stagingMetaKey, meta);
    return { stagingId, stagingPath: meta.storageRef, meta };
  }

  const dir = stagingDir(organizationId);
  await ensureDir(dir);
  const stagingPath = path.join(dir, `${stagingId}.csv`);
  await fsp.writeFile(stagingPath, buffer);
  meta.storageRef = toStorageRef('local', stagingPath);
  await writeStagingMeta(buildStagingMetaPath(stagingPath), meta);
  return { stagingId, stagingPath: meta.storageRef, meta };
}

async function getStagingFile({ organizationId, stagingId }) {
  const localPath = path.join(stagingDir(organizationId), `${stagingId}.csv`);
  const localMetaPath = buildStagingMetaPath(localPath);
  const ociMetaKey = buildOciStagingMetaKey(organizationId, stagingId);

  let meta = null;
  if (useOciStorage()) {
    meta = await readOciStagingMeta(ociMetaKey);
  }
  if (!meta) meta = await readStagingMeta(localMetaPath);
  if (!meta) {
    const err = new Error('Staged import file not found or expired');
    err.code = 'IMPORT_STAGING_NOT_FOUND';
    throw err;
  }
  if (meta.expiresAt && Date.now() > new Date(meta.expiresAt).getTime()) {
    await deleteImportArtifacts(meta.storageRef || localPath);
    await deleteFileQuietly(localMetaPath);
    await deleteOciQuietly(meta.stagingMetaKey || ociMetaKey);
    const err = new Error('Staged import file expired');
    err.code = 'IMPORT_STAGING_EXPIRED';
    throw err;
  }
  if (String(meta.organizationId) !== String(organizationId)) {
    const err = new Error('Staged import file not found');
    err.code = 'IMPORT_STAGING_NOT_FOUND';
    throw err;
  }

  return {
    stagingPath: meta.storageRef || toStorageRef('local', localPath),
    meta,
  };
}

async function promoteStagingToImport({ organizationId, stagingId, importHistoryId }) {
  const { stagingPath, meta } = await getStagingFile({ organizationId, stagingId });
  const parsed = parseStorageRef(stagingPath);

  if (parsed.driver === 'oci') {
    const destKey = buildOciJobKey(organizationId, importHistoryId);
    await objectStorage.copyObject({ fromKey: parsed.key, toKey: destKey });
    await objectStorage.deleteObject({ key: parsed.key });
    await deleteOciQuietly(meta.stagingMetaKey);
    if (meta.stagingMetaPath) await deleteFileQuietly(meta.stagingMetaPath);
    return {
      importPath: toStorageRef('oci', destKey),
      fileName: meta.fileName,
      byteSize: meta.byteSize,
    };
  }

  const dir = importDir(organizationId);
  await ensureDir(dir);
  const importPath = path.join(dir, `${importHistoryId}.csv`);
  await fsp.rename(parsed.filePath, importPath);
  await deleteFileQuietly(buildStagingMetaPath(parsed.filePath));
  return {
    importPath: toStorageRef('local', importPath),
    fileName: meta.fileName,
    byteSize: meta.byteSize,
  };
}

async function saveInlineCsvAsImportFile({ organizationId, importHistoryId, csvData }) {
  const buffer = Buffer.from(String(csvData || ''), 'utf8');
  if (buffer.length > IMPORT_MAX_FILE_BYTES) {
    const err = new Error(`Import payload exceeds maximum size of ${IMPORT_MAX_FILE_BYTES} bytes`);
    err.code = 'IMPORT_FILE_TOO_LARGE';
    throw err;
  }

  if (useOciStorage()) {
    const key = buildOciJobKey(organizationId, importHistoryId);
    await objectStorage.putBuffer({ key, buffer, contentType: 'text/csv' });
    return toStorageRef('oci', key);
  }

  const dir = importDir(organizationId);
  await ensureDir(dir);
  const importPath = path.join(dir, `${importHistoryId}.csv`);
  await fsp.writeFile(importPath, buffer);
  return toStorageRef('local', importPath);
}

async function deleteImportArtifacts(storageRef) {
  if (!storageRef) return;
  const parsed = parseStorageRef(storageRef);
  if (parsed.driver === 'oci') {
    try {
      await objectStorage.deleteObject({ key: parsed.key });
    } catch {
      /* ignore */
    }
    return;
  }
  await deleteFileQuietly(parsed.filePath);
}

module.exports = {
  openImportReadStream,
  parseStorageRef,
  saveStagingUpload,
  getStagingFile,
  promoteStagingToImport,
  saveInlineCsvAsImportFile,
  deleteImportArtifacts,
  useOciStorage,
};
