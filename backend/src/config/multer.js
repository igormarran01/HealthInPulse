const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

const ALLOWED_EXAM_TYPES  = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_EXAM_SIZE   = 10 * 1024 * 1024; // 10 MB
const MAX_AVATAR_SIZE =  2 * 1024 * 1024; //  2 MB

const storage = (dest) =>
  multer.diskStorage({
    destination: path.join(__dirname, '..', 'uploads', dest),
    filename: (_req, file, cb) => {
      const hash = crypto.randomBytes(16).toString('hex');
      const ext  = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${hash}${ext}`);
    },
  });

const fileFilter = (allowed) => (_req, file, cb) => {
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error(`Tipo de arquivo não permitido: ${file.mimetype}`), false);
};

const examUpload = multer({
  storage: storage('exams'),
  limits: { fileSize: MAX_EXAM_SIZE },
  fileFilter: fileFilter(ALLOWED_EXAM_TYPES),
});

const avatarUpload = multer({
  storage: storage('avatars'),
  limits: { fileSize: MAX_AVATAR_SIZE },
  fileFilter: fileFilter(ALLOWED_IMAGE_TYPES),
});

module.exports = { examUpload, avatarUpload };
