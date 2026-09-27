import { Router } from 'express';
import multer from 'multer';
import { createDocumentTranslation, downloadDocument } from '../controllers/documentController.js';
const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1, fields: 2 },
  fileFilter: (_req, file, callback) => callback(
    /\.(docx|pdf)$/i.test(file.originalname) ? null : new Error('Chỉ hỗ trợ DOCX hoặc PDF.'),
    /\.(docx|pdf)$/i.test(file.originalname),
  ),
});
router.post('/', (req, res, next) => {
  upload.single('file')(req, res, error => {
    if (error) return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({
      success: false, message: error.code === 'LIMIT_FILE_SIZE' ? 'File vượt quá 20 MB.' : 'Upload không hợp lệ. Chọn một file DOCX/PDF tối đa 20 MB.',
    });
    next();
  });
}, createDocumentTranslation);
router.get('/:id/download', downloadDocument);
export default router;
