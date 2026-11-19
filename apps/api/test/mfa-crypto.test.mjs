import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../package.json', import.meta.url));
const { Secret } = require('otpauth');
const { MfaCrypto } = require('./dist/auth/mfa-crypto.js');
const { OwnerAuthReview } = require('./dist/auth/review.js');
test('RFC 6238 SHA1 vectors match six-digit TOTP and reject replay', () => {
  const crypto = new MfaCrypto();
  const secret = Secret.fromHex(
    Buffer.from('12345678901234567890').toString('hex'),
  );
  for (const [seconds, eight] of [
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
    [20000000000, '65353130'],
  ]) {
    const step = Math.floor(seconds / 30),
      token = eight.slice(-6);
    assert.equal(crypto.acceptedStep(secret, token, seconds * 1000, -1), step);
    assert.equal(
      crypto.acceptedStep(secret, token, seconds * 1000, step),
      null,
    );
    assert.equal(
      crypto.acceptedStep(secret, token, (seconds + 90) * 1000, -1),
      null,
    );
  }
});
test('AES-GCM uses independent nonces and binds the installation and user; wrong keys and corruption fail', () => {
  const crypto = new MfaCrypto(randomBytes(32)),
    secret = crypto.generate();
  const a = crypto.seal(secret, 'installation', 'owner'),
    b = crypto.seal(secret, 'installation', 'owner');
  assert.equal(secret.hex.length, 40);
  assert.notDeepEqual(a.nonce, b.nonce);
  assert.notDeepEqual(a.ciphertext, b.ciphertext);
  assert.equal(
    crypto.open(a.ciphertext, a.nonce, a.tag, 'installation', 'owner').hex,
    secret.hex,
  );
  for (const [c, installation, user] of [
    [crypto, 'other', 'owner'],
    [crypto, 'installation', 'other'],
    [new MfaCrypto(randomBytes(32)), 'installation', 'owner'],
  ])
    assert.throws(() =>
      c.open(a.ciphertext, a.nonce, a.tag, installation, user),
    );
  a.ciphertext[0] ^= 1;
  assert.throws(() =>
    crypto.open(a.ciphertext, a.nonce, a.tag, 'installation', 'owner'),
  );
});
test('review preparation rejects missing or malformed MFA keys before any password work', async () => {
  for (const key of [
    undefined,
    Buffer.alloc(0),
    Buffer.alloc(31),
    Buffer.alloc(33),
  ]) {
    const review = new OwnerAuthReview({}, 'https://panel.example.test', {
      mfaEncryptionKey: key,
    });
    await assert.rejects(review.prepare(), /32-byte MFA wrapping key/);
  }
});
