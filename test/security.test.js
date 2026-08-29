const test = require('node:test');
const assert = require('node:assert/strict');
const { authPolicy, authorizeRequest, safeEqual } = require('../src/http/security');

test('core auth fails closed when required token is not configured', () => {
  const env = { SUPERVISOR_REQUIRE_AUTH: 'true' };
  assert.deepEqual(authPolicy(env), { required: true, configured: false, token: '' });
  assert.equal(authorizeRequest({ headers: {} }, env).code, 'CORE_AUTH_NOT_CONFIGURED');
});

test('core auth accepts exact configured token', () => {
  const env = { SUPERVISOR_REQUIRE_AUTH: 'true', SUPERVISOR_API_TOKEN: 'secret-123' };
  const result = authorizeRequest({ headers: { 'x-supervisor-token': 'secret-123' } }, env);
  assert.equal(result.ok, true);
});

test('safeEqual rejects empty and mismatched tokens', () => {
  assert.equal(safeEqual('', ''), false);
  assert.equal(safeEqual('abc', 'abd'), false);
});
