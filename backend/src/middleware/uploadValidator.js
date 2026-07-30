import fs from 'fs';
import AppError from '../utils/appError.js';
import logger from '../utils/logger.js';

export const validatePDFMagicBytes = (req, res, next) => {
  if (!req.file) {
    return next(new AppError('Please upload a PDF file.', 400));
  }

  const filePath = req.file.path;
  
  // Read first 4 bytes of the uploaded file
  fs.open(filePath, 'r', (err, fd) => {
    if (err) {
      logger.error('Error opening uploaded file for signature check:', err);
      // Clean up the file if possible
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return next(new AppError('Failed to validate uploaded file.', 500));
    }

    const buffer = Buffer.alloc(4);
    fs.read(fd, buffer, 0, 4, 0, (readErr, bytesRead) => {
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
        
        // Securely delete file immediately
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        
        return next(new AppError('Security check failed: File header does not match a valid PDF structure.', 400));
      }

      // If valid, pass control to next handler
      next();
    });
  });
};
