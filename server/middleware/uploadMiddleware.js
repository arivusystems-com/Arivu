const multer = require('multer');
const path = require('path');
const fileStorage = require('../services/fileStorageService');

const uploadsDir = path.join(__dirname, '../uploads');

const fileFilter = (req, file, cb) => {
  const resolvedMime = fileStorage.resolveUploadMimeType(file);
  if (fileStorage.isAllowedUploadMime(resolvedMime)) {
    file.mimetype = resolvedMime;
    cb(null, true);
    return;
  }

  cb(
    new Error(
      `File type ${file.mimetype || resolvedMime || 'unknown'} is not allowed. Allowed types: images, PDF, Word, Excel, PowerPoint, CSV, ZIP, video`
    ),
    false
  );
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

/** Learning media (VIDEO/DOCUMENT) — larger than general CRM uploads. */
const LEARNING_MAX_UPLOAD_BYTES = parseInt(
  process.env.LEARNING_MAX_FILE_SIZE || String(100 * 1024 * 1024),
  10
);

const learningUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: LEARNING_MAX_UPLOAD_BYTES,
  },
});

function wrapMulter(mw) {
  return (req, res, next) => {
    mw(req, res, (err) => {
      if (!err) return next();

      const message =
        err.message ||
        (err.code ? `Upload error (${err.code})` : 'Upload failed');

      const status = (err.name === 'MulterError' || err.message?.includes('not allowed')) ? 400 : 500;

      return res.status(status).json({
        success: false,
        message: 'File upload failed.',
        error: message
      });
    });
  };
}

exports.uploadSingle = (fieldName = 'file') => wrapMulter(upload.single(fieldName));

exports.uploadLearningSingle = (fieldName = 'file') =>
  wrapMulter(learningUpload.single(fieldName));

exports.LEARNING_MAX_UPLOAD_BYTES = LEARNING_MAX_UPLOAD_BYTES;

exports.uploadMultiple = (fieldName = 'files', maxCount = 10) =>
  wrapMulter(upload.array(fieldName, maxCount));

exports.uploadFields = (fields) => upload.fields(fields);

/** @deprecated Use fileStorage.persistMulterUpload(req, category) instead */
exports.getFileUrl = (req, filename) => {
  const orgId = req.user?.organizationId?.toString() || 'public';
  return `/api/uploads/${orgId}/${filename}`;
};

exports.getFilePath = (filename, orgId = null) => {
  const org = orgId || 'public';
  return path.join(uploadsDir, org, filename);
};

exports.uploadsDir = uploadsDir;

exports.persistMulterUpload = fileStorage.persistMulterUpload;
