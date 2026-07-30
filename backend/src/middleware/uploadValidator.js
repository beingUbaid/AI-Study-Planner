import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
import AppError from '../utils/appError.js';
import logger from '../utils/logger.js';

export const validatePDFMagicBytes = (req, res, next) => {
  if (!req.file) {
    return next(new AppError('Please upload a PDF file.', 400));
  }

  const filePath = req.file.path;
  
  // Read first 4 bytes of the uploaded file for signature checking
  fs.open(filePath, 'r', (err, fd) => {
    if (err) {
      logger.error('Error opening uploaded file for signature check:', err);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return next(new AppError('Failed to validate uploaded file.', 500));
    }

    const buffer = Buffer.alloc(4);
    fs.read(fd, buffer, 0, 4, 0, (readErr) => {
      fs.close(fd, (closeErr) => {
        if (closeErr) logger.warn('Failed to close file descriptor:', closeErr);
      });

      if (readErr) {
        logger.error('Error reading uploaded file bytes:', readErr);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        return next(new AppError('Failed to read file signature.', 500));
      }

      // Check if magic bytes match "%PDF"
      const magicBytes = buffer.toString('utf-8');
      if (magicBytes !== '%PDF') {
        logger.warn(`Security alert: PDF magic bytes validation failed. Found: ${magicBytes} (Hex: ${buffer.toString('hex')})`);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        return next(new AppError('Security check failed: File header does not match a valid PDF structure.', 400));
      }

      // Read file into buffer to verify page count using pdf-parse (max 15 pages)
      fs.readFile(filePath, async (readFullErr, dataBuffer) => {
        if (readFullErr) {
          logger.error('Error reading full file for page check:', readFullErr);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          return next(new AppError('Failed to read uploaded document.', 500));
        }

        try {
          const pdfData = await pdfParse(dataBuffer);
          const pageCount = pdfData.numpages;

          if (pageCount > 15) {
            logger.warn(`Syllabus upload rejected: PDF exceeds page limit. Pages: ${pageCount}, Max allowed: 15`);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            return next(new AppError('PDF exceeds the maximum allowed page count (15 pages).', 400));
          }

          next();
        } catch (parseErr) {
          logger.error('Error parsing PDF page count:', parseErr);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          return next(new AppError('Invalid or corrupted PDF file.', 400));
        }
      });
    });
  });
};
