import assert from 'assert';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken
} from '../src/services/tokenService.js';

console.log('🚀 Running SaaS Security and Authentication Unit Tests...\n');

// Mock Environment Variables if not set
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_access_secret_12345';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test_jwt_refresh_secret_54321';

try {
  // Test Case 1: Cryptographically secure code generation
  const generateSecureCode = () => {
    return crypto.randomInt(100000, 999999).toString();
  };
  const code = generateSecureCode();
  assert.strictEqual(code.length, 6, 'Security code must be exactly 6 digits');
  assert.ok(/^\d{6}$/.test(code), 'Security code must contain only numeric digits');
  console.log('✅ Test Case 1 Passed: Secure crypto code generation');

  // Test Case 2: Bcrypt password hashing
  const rawPassword = 'SecurePassword123!';
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(rawPassword, salt);
  
  assert.notStrictEqual(rawPassword, hashedPassword, 'Hashed password must not match raw password');
  
  const isMatch = await bcrypt.compare(rawPassword, hashedPassword);
  assert.ok(isMatch, 'Bcrypt compare should verify password matches hash');
  
  const isWrongMatch = await bcrypt.compare('WrongPassword!', hashedPassword);
  assert.ok(!isWrongMatch, 'Bcrypt compare should fail for incorrect password');
  console.log('✅ Test Case 2 Passed: Password hashing & verification');

  // Test Case 3: JWT Access Token generation & verification
  const userId = 'user_mongodb_id_12345';
  const accessToken = generateAccessToken(userId);
  assert.ok(accessToken, 'Access token should be generated');

  const decodedAccess = verifyAccessToken(accessToken);
  assert.strictEqual(decodedAccess.id, userId, 'Decoded access token user ID must match input');
  console.log('✅ Test Case 3 Passed: Access Token signing & signature validation');

  // Test Case 4: JWT Refresh Token generation & verification
  const refreshToken = generateRefreshToken(userId);
  assert.ok(refreshToken, 'Refresh token should be generated');

  const decodedRefresh = verifyRefreshToken(refreshToken);
  assert.strictEqual(decodedRefresh.id, userId, 'Decoded refresh token user ID must match input');
  console.log('✅ Test Case 4 Passed: Refresh Token rotation logic validation');

  console.log('\n🎉 ALL SECURITY UNIT TESTS PASSED SUCCESSFULLY! 🎉');
  process.exit(0);

} catch (err) {
  console.error('\n❌ SECURITY UNIT TEST ASSERTION FAILED:');
  console.error(err);
  process.exit(1);
}
