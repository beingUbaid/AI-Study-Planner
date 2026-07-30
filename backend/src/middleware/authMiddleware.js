import { verifyAccessToken } from '../services/tokenService.js';
import AppError from '../utils/appError.js';
import { catchAsync } from './errorMiddleware.js';

const authMiddleware = catchAsync(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : null;

  if (!token) {
    return next(new AppError('Authentication failed. No token provided.', 401));
  }

  try {
    const decoded = verifyAccessToken(token);
    req.user = decoded; // Contains user id (decoded.id)

    // Bind authenticated user ID to the AsyncLocalStorage request store
    const { requestStore } = await import('../utils/logger.js');
    const store = requestStore.getStore();
    if (store) {
      store.userId = decoded.id;
    }

    next();
  } catch {
    return next(new AppError('Authentication failed. Invalid or expired token.', 401));
  }
});

export default authMiddleware;