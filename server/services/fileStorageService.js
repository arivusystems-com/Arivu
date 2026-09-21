/**
 * Unified file storage — all product uploads go to OCI Object Storage (S3-compatible API).
 */

const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const objectStorage = require('./objectStorageService');

const uploadsDir = path.join(__dirname, '../uploads');

const OCI_PREFIX = 'oci:';
const UPLOADS_KEY_PREFIX = 'uploads/';

const MAX_FILE_SIZE = parseInt(process.env.MAX_EVIDENCE_FILE_SIZE || '10485760', 10);
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/heic',
  'image/heif',
  'application/pdf',
  'application/x-pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'application/x-zip-compressed',
  'text/plain',
  'text/csv',
  'text/markdown',
  'application/json',
  'application/octet-stream',
  'video/mp4',
  'video/webm',
  'video/quicktime',
];

const EXTENSION_MIME_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.md': 'text/markdown',
  '.json': 'application/json',
  '.zip': 'application/zip',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
};

function resolveUploadMimeType(file) {
  const raw = String(file?.mimetype || '').trim().toLowerCase();
  if (raw && ALLOWED_MIME_TYPES.includes(raw)) {
    return raw;
  }

  const ext = path.extname(String(file?.originalname || '')).toLowerCase();
  const inferred = EXTENSION_MIME_TYPES[ext];
  if (inferred && ALLOWED_MIME_TYPES.includes(inferred)) {
    return inferred;
  }

  if (!raw || raw === 'application/octet-stream') {
    return 'application/octet-stream';
  }

  return raw;
}

function isAllowedUploadMime(mimeType) {
  return ALLOWED_MIME_TYPES.includes(String(mimeType || '').trim().toLowerCase());
}

function isOciStoragePath(storagePath) {
  return String(storagePath || '').startsWith(OCI_PREFIX);
}

function safeOrgId(orgId) {
  return String(orgId || 'public').replace(/[^a-zA-Z0-9_-]/g, '_');
}

function safeFileName(name) {
  return String(name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

function safeCategory(category) {
  return String(category || 'general').replace(/[^a-zA-Z0-9_-]/g, '_');
}

function normalizeObjectMetadata(metadata = {}) {
  const normalized = {};
  for (const [key, value] of Object.entries(metadata || {})) {
    if (value == null) continue;
    normalized[String(key)] = typeof value === 'string' ? value : String(value);
  }
  return normalized;
}

function buildObjectKey({ organizationId, category, fileName }) {
  const base = safeFileName(fileName);
  return `${UPLOADS_KEY_PREFIX}${safeOrgId(organizationId)}/${safeCategory(category)}/${Date.now()}-${uuidv4()}-${base}`;
}

function buildDownloadUrl(storagePath, { disposition = 'inline', fileName, contentType } = {}) {
  const q = new URLSearchParams({
    storagePath: String(storagePath),
    disposition: disposition === 'attachment' ? 'attachment' : 'inline'
  });
  if (fileName) q.set('fileName', String(fileName));
  if (contentType) q.set('contentType', String(contentType));
  return `/api/files/download?${q.toString()}`;
}

function parseStoragePath(storagePath) {
  let raw = String(storagePath || '').trim();
  if (!raw) return null;
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    try {
      const url = new URL(raw);
      raw = `${url.pathname}${url.search}`;
    } catch {
      return null;
    }
  }
  if (isOciStoragePath(raw)) {
    return { driver: 'oci', key: raw.slice(OCI_PREFIX.length) };
  }
  if (raw.startsWith('/api/files/download')) {
    try {
      const url = new URL(raw, 'http://local');
      const nested = url.searchParams.get('storagePath');
      if (nested) return parseStoragePath(nested);
    } catch {
      return null;
    }
  }
  if (raw.startsWith('/api/uploads/')) {
    const rel = raw.slice('/api/uploads/'.length);
    return { driver: 'local', relativePath: rel };
  }
  if (!raw.includes('://') && !raw.startsWith('/')) {
    return { driver: 'local', relativePath: raw };
  }
  return null;
}

function assertOrgAccessToKey(key, organizationId) {
  if (!organizationId) {
    const err = new Error('Organization context missing');
    err.statusCode = 403;
    throw err;
  }
  const safeOrg = safeOrgId(organizationId);
  const rawOrg = String(organizationId);
  const allowedPrefixes = [
    `${UPLOADS_KEY_PREFIX}${safeOrg}/`,
    `attachments/${safeOrg}/`,
    `${String(process.env.MAILROOM_ATTACHMENTS_PREFIX || 'mailroom').trim() || 'mailroom'}/${rawOrg}/`,
    `${String(process.env.MAILROOM_ATTACHMENTS_PREFIX || 'mailroom').trim() || 'mailroom'}/${safeOrg}/`
  ];
  if (!allowedPrefixes.some((prefix) => key.startsWith(prefix))) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
}

function resolveLegacyLocalPath(storagePath) {
  const parsed = parseStoragePath(storagePath);
  if (!parsed || parsed.driver !== 'local' || !parsed.relativePath) return null;
  const rel = parsed.relativePath.replace(/\\/g, '/');
  if (!rel || rel.includes('..')) return null;
  const filePath = path.join(uploadsDir, rel);
  const normalizedUploads = path.resolve(uploadsDir);
  const normalizedFile = path.resolve(filePath);
  if (!normalizedFile.startsWith(normalizedUploads + path.sep) && normalizedFile !== normalizedUploads) {
    return null;
  }
  if (!fs.existsSync(normalizedFile)) return null;
  return normalizedFile;
}

function validateFile(file, opts = {}) {
  if (!file) {
    throw new Error('File is required');
  }
  const maxSize = Number(opts.maxFileSize) > 0 ? Number(opts.maxFileSize) : MAX_FILE_SIZE;
  if (file.size > maxSize) {
    throw new Error(`File size exceeds maximum allowed size of ${maxSize} bytes`);
  }
  const mimeType = resolveUploadMimeType(file);
  if (!isAllowedUploadMime(mimeType)) {
    throw new Error(`File type ${mimeType || file.mimetype || 'unknown'} is not allowed`);
  }
  if (file && mimeType) {
    file.mimetype = mimeType;
  }
}

async function uploadBuffer({
  buffer,
  originalName,
  mimeType,
  organizationId,
  category = 'general',
  metadata = {}
}) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error('File buffer is required');
  }
  const key = buildObjectKey({ organizationId, category, fileName: originalName });
  await objectStorage.putBuffer({
    key,
    buffer,
    contentType: mimeType || 'application/octet-stream',
    metadata: normalizeObjectMetadata({
      originalname: safeFileName(originalName),
      ...metadata
    })
  });
  const storagePath = `${OCI_PREFIX}${key}`;
  return {
    storagePath,
    url: buildDownloadUrl(storagePath, {
      disposition: 'inline',
      fileName: originalName,
      contentType: mimeType
    }),
    downloadUrl: buildDownloadUrl(storagePath, {
      disposition: 'attachment',
      fileName: originalName,
      contentType: mimeType
    }),
    fileName: originalName,
    storedFileName: path.basename(key),
    fileSize: buffer.length,
    mimeType: mimeType || 'application/octet-stream',
    objectKey: key
  };
}

async function uploadMulterFile(file, context = {}) {
  if (!file?.buffer) {
    throw new Error('File buffer is required (use multer memory storage)');
  }
  validateFile(file, { maxFileSize: context.maxFileSize });
  return uploadBuffer({
    buffer: file.buffer,
    originalName: file.originalname,
    mimeType: file.mimetype,
    organizationId: context.organizationId,
    category: context.category || 'general',
    metadata: context.metadata
  });
}

async function persistMulterUpload(req, category = 'general', opts = {}) {
  if (!req.file) {
    throw new Error('No file uploaded');
  }
  return uploadMulterFile(req.file, {
    organizationId: req.user?.organizationId,
    category,
    maxFileSize: opts.maxFileSize,
  });
}

async function getObjectBuffer(storagePath) {
  const parsed = parseStoragePath(storagePath);
  if (!parsed) return null;
  if (parsed.driver === 'oci') {
    return objectStorage.getBuffer({ key: parsed.key });
  }
  const localPath = resolveLegacyLocalPath(storagePath);
  if (!localPath) return null;
  return fs.promises.readFile(localPath);
}

function assertDeletableProductUploadKey(key, organizationId) {
  assertOrgAccessToKey(key, organizationId);
  const safeOrg = safeOrgId(organizationId);
  if (!key.startsWith(`${UPLOADS_KEY_PREFIX}${safeOrg}/`)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
}

async function deleteStoredUpload({ storagePath, organizationId }) {
  const parsed = parseStoragePath(storagePath);
  if (!parsed) {
    const err = new Error('Invalid storage path');
    err.statusCode = 400;
    throw err;
  }

  if (parsed.driver === 'oci') {
    assertDeletableProductUploadKey(parsed.key, organizationId);
    await objectStorage.deleteObject({ key: parsed.key });
    return { deleted: true, driver: 'oci' };
  }

  const localPath = resolveLegacyLocalPath(storagePath);
  if (!localPath) {
    return { deleted: false, driver: 'local', reason: 'not_found' };
  }
  await fs.promises.unlink(localPath);
  return { deleted: true, driver: 'local' };
}

function resolveStoragePathFromClientRef(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (raw.startsWith(OCI_PREFIX)) return raw;
  const parsed = parseStoragePath(raw);
  if (parsed?.driver === 'oci') return `${OCI_PREFIX}${parsed.key}`;
  if (parsed?.driver === 'local' && parsed.relativePath) {
    return `/api/uploads/${parsed.relativePath}`;
  }
  return null;
}

module.exports = {
  OCI_PREFIX,
  UPLOADS_KEY_PREFIX,
  MAX_FILE_SIZE,
  ALLOWED_MIME_TYPES,
  resolveUploadMimeType,
  isAllowedUploadMime,
  isOciStoragePath,
  safeOrgId,
  safeFileName,
  buildObjectKey,
  buildDownloadUrl,
  parseStoragePath,
  assertOrgAccessToKey,
  resolveLegacyLocalPath,
  validateFile,
  uploadBuffer,
  uploadMulterFile,
  persistMulterUpload,
  getObjectBuffer,
  deleteStoredUpload,
  resolveStoragePathFromClientRef
};
