'use strict';
const common = require('../common');
if (!common.hasCrypto)
  common.skip('missing crypto');

const assert = require('assert');
const crypto = require('crypto');

const constants = crypto.constants;

const fixtures = require('../common/fixtures');

// Test certificates
const certPem = fixtures.readKey('rsa_cert.crt');
const keyPem = fixtures.readKey('rsa_private.pem');
const rsaKeySize = 2048;
const rsaPubPem = fixtures.readKey('rsa_public.pem', 'ascii');
const rsaKeyPem = fixtures.readKey('rsa_private.pem', 'ascii');
const rsaKeyPemEncrypted = fixtures.readKey('rsa_private_encrypted.pem',
                                            'ascii');
const dsaPubPem = fixtures.readKey('dsa_public.pem', 'ascii');
const dsaKeyPem = fixtures.readKey('dsa_private.pem', 'ascii');
const dsaKeyPemEncrypted = fixtures.readKey('dsa_private_encrypted.pem',
                                            'ascii');
const rsaPkcs8KeyPem = fixtures.readKey('rsa_private_pkcs8.pem');
const dsaPkcs8KeyPem = fixtures.readKey('dsa_private_pkcs8.pem');

const decryptError = {
  message: 'error:06065064:digital envelope routines:EVP_DecryptFinal_ex:' +
    'bad decrypt',
  code: 'ERR_OSSL_EVP_BAD_DECRYPT',
  reason: 'bad decrypt',
  function: 'EVP_DecryptFinal_ex',
  library: 'digital envelope routines',
};

// Test RSA encryption/decryption
{
  const input = 'I AM THE WALRUS';
  const bufferToEncrypt = Buffer.from(input);
  const bufferPassword = Buffer.from('password');

  let encryptedBuffer = crypto.publicEncrypt(rsaPubPem, bufferToEncrypt);

  let decryptedBuffer = crypto.privateDecrypt(rsaKeyPem, encryptedBuffer);
  assert.strictEqual(decryptedBuffer.toString(), input);

  decryptedBuffer = crypto.privateDecrypt(rsaPkcs8KeyPem, encryptedBuffer);
  assert.strictEqual(decryptedBuffer.toString(), input);

  let decryptedBufferWithPassword = crypto.privateDecrypt({
    key: rsaKeyPemEncrypted,
    passphrase: 'password'
  }, encryptedBuffer);
  assert.strictEqual(decryptedBufferWithPassword.toString(), input);

  encryptedBuffer = crypto.publicEncrypt({
    key: rsaKeyPemEncrypted,
    passphrase: 'password'
  }, bufferToEncrypt);

  decryptedBufferWithPassword = crypto.privateDecrypt({
    key: rsaKeyPemEncrypted,
    passphrase: 'password'
  }, encryptedBuffer);
  assert.strictEqual(decryptedBufferWithPassword.toString(), input);

  encryptedBuffer = crypto.privateEncrypt({
    key: rsaKeyPemEncrypted,
    passphrase: bufferPassword
  }, bufferToEncrypt);

  decryptedBufferWithPassword = crypto.publicDecrypt({
    key: rsaKeyPemEncrypted,
    passphrase: bufferPassword
  }, encryptedBuffer);
  assert.strictEqual(decryptedBufferWithPassword.toString(), input);

  // Now with explicit RSA_PKCS1_PADDING.
  encryptedBuffer = crypto.privateEncrypt({
    padding: crypto.constants.RSA_PKCS1_PADDING,
    key: rsaKeyPemEncrypted,
    passphrase: bufferPassword
  }, bufferToEncrypt);

  decryptedBufferWithPassword = crypto.publicDecrypt({
    padding: crypto.constants.RSA_PKCS1_PADDING,
    key: rsaKeyPemEncrypted,
    passphrase: bufferPassword
  }, encryptedBuffer);
  assert.strictEqual(decryptedBufferWithPassword.toString(), input);

  // Omitting padding should be okay because RSA_PKCS1_PADDING is the default.
  decryptedBufferWithPassword = crypto.publicDecrypt({
    key: rsaKeyPemEncrypted,
    passphrase: bufferPassword
  }, encryptedBuffer);
  assert.strictEqual(decryptedBufferWithPassword.toString(), input);

  // Now with RSA_NO_PADDING. Plaintext needs to match key size.
  const plaintext = 'x'.repeat(rsaKeySize / 8);
  encryptedBuffer = crypto.privateEncrypt({
    padding: crypto.constants.RSA_NO_PADDING,
    key: rsaKeyPemEncrypted,
    passphrase: bufferPassword
  }, Buffer.from(plaintext));

  decryptedBufferWithPassword = crypto.publicDecrypt({
    padding: crypto.constants.RSA_NO_PADDING,
    key: rsaKeyPemEncrypted,
    passphrase: bufferPassword
  }, encryptedBuffer);
  assert.strictEqual(decryptedBufferWithPassword.toString(), plaintext);

  encryptedBuffer = crypto.publicEncrypt(certPem, bufferToEncrypt);

  decryptedBuffer = crypto.privateDecrypt(keyPem, encryptedBuffer);
  assert.strictEqual(decryptedBuffer.toString(), input);

  encryptedBuffer = crypto.publicEncrypt(keyPem, bufferToEncrypt);

  decryptedBuffer = crypto.privateDecrypt(keyPem, encryptedBuffer);
  assert.strictEqual(decryptedBuffer.toString(), input);

  encryptedBuffer = crypto.privateEncrypt(keyPem, bufferToEncrypt);

  decryptedBuffer = crypto.publicDecrypt(keyPem, encryptedBuffer);
  assert.strictEqual(decryptedBuffer.toString(), input);

  assert.throws(() => {
    crypto.privateDecrypt({
      key: rsaKeyPemEncrypted,
      passphrase: 'wrong'
    }, bufferToEncrypt);
  }, decryptError);

  assert.throws(() => {
    crypto.publicEncrypt({
      key: rsaKeyPemEncrypted,
      passphrase: 'wrong'
    }, encryptedBuffer);
  }, decryptError);

  encryptedBuffer = crypto.privateEncrypt({
    key: rsaKeyPemEncrypted,
    passphrase: Buffer.from('password')
  }, bufferToEncrypt);

  assert.throws(() => {
    crypto.publicDecrypt({
      key: rsaKeyPemEncrypted,
      passphrase: Buffer.from('wrong')
    }, encryptedBuffer);
  }, decryptError);
}

function test_rsa(padding) {
  const size = (padding === 'RSA_NO_PADDING') ? rsaKeySize / 8 : 32;
  const input = Buffer.allocUnsafe(size);
  for (let i = 0; i < input.length; i++)
    input[i] = (i * 7 + 11) & 0xff;
  const bufferToEncrypt = Buffer.from(input);

  padding = constants[padding];

  const encryptedBuffer = crypto.publicEncrypt({
    key: rsaPubPem,
    padding: padding
  }, bufferToEncrypt);

  let decryptedBuffer = crypto.privateDecrypt({
    key: rsaKeyPem,
    padding: padding
  }, encryptedBuffer);
  assert.deepStrictEqual(decryptedBuffer, input);

  decryptedBuffer = crypto.privateDecrypt({
    key: rsaPkcs8KeyPem,
    padding: padding
  }, encryptedBuffer);
  assert.deepStrictEqual(decryptedBuffer, input);
}

test_rsa('RSA_NO_PADDING');
test_rsa('RSA_PKCS1_PADDING');
test_rsa('RSA_PKCS1_OAEP_PADDING');

// Test RSA key signing/verification
let rsaSign = crypto.createSign('SHA1');
let rsaVerify = crypto.createVerify('SHA1');
assert.ok(rsaSign);
assert.ok(rsaVerify);

const expectedSignature = fixtures.readKey(
  'rsa_public_sha1_signature_signedby_rsa_private_pkcs8.sha1',
  'hex'
);

rsaSign.update(rsaPubPem);
let rsaSignature = rsaSign.sign(rsaKeyPem, 'hex');
assert.strictEqual(rsaSignature, expectedSignature);

rsaVerify.update(rsaPubPem);
assert.strictEqual(rsaVerify.verify(rsaPubPem, rsaSignature, 'hex'), true);

// Test RSA PKCS#8 key signing/verification
rsaSign = crypto.createSign('SHA1');
rsaSign.update(rsaPubPem);
rsaSignature = rsaSign.sign(rsaPkcs8KeyPem, 'hex');
assert.strictEqual(rsaSignature, expectedSignature);

rsaVerify = crypto.createVerify('SHA1');
rsaVerify.update(rsaPubPem);
assert.strictEqual(rsaVerify.verify(rsaPubPem, rsaSignature, 'hex'), true);

// Test RSA key signing/verification with encrypted key
rsaSign = crypto.createSign('SHA1');
rsaSign.update(rsaPubPem);
const signOptions = { key: rsaKeyPemEncrypted, passphrase: 'password' };
rsaSignature = rsaSign.sign(signOptions, 'hex');
assert.strictEqual(rsaSignature, expectedSignature);

rsaVerify = crypto.createVerify('SHA1');
rsaVerify.update(rsaPubPem);
assert.strictEqual(rsaVerify.verify(rsaPubPem, rsaSignature, 'hex'), true);

rsaSign = crypto.createSign('SHA1');
rsaSign.update(rsaPubPem);
assert.throws(() => {
  const signOptions = { key: rsaKeyPemEncrypted, passphrase: 'wrong' };
  rsaSign.sign(signOptions, 'hex');
}, decryptError);

//
// Test RSA signing and verification
//
{
  const privateKey = fixtures.readKey('rsa_private_b.pem');
  const publicKey = fixtures.readKey('rsa_public_b.pem');

  const input = 'I AM THE WALRUS';

  const signature = fixtures.readKey(
    'I_AM_THE_WALRUS_sha256_signature_signedby_rsa_private_b.sha256',
    'hex'
  );

  const sign = crypto.createSign('SHA256');
  sign.update(input);

  const output = sign.sign(privateKey, 'hex');
  assert.strictEqual(output, signature);

  const verify = crypto.createVerify('SHA256');
  verify.update(input);

  assert.strictEqual(verify.verify(publicKey, signature, 'hex'), true);

  // Test the legacy signature algorithm name.
  const sign2 = crypto.createSign('RSA-SHA256');
  sign2.update(input);

  const output2 = sign2.sign(privateKey, 'hex');
  assert.strictEqual(output2, signature);

  const verify2 = crypto.createVerify('SHA256');
  verify2.update(input);

  assert.strictEqual(verify2.verify(publicKey, signature, 'hex'), true);
}


//
// Test DSA signing and verification
//
{
  const input = 'I AM THE WALRUS';

  // DSA signatures vary across runs so there is no static string to verify
  // against.
  const sign = crypto.createSign('SHA1');
  sign.update(input);
  const signature = sign.sign(dsaKeyPem, 'hex');

  const verify = crypto.createVerify('SHA1');
  verify.update(input);

  assert.strictEqual(verify.verify(dsaPubPem, signature, 'hex'), true);

  // Test the legacy 'DSS1' name.
  const sign2 = crypto.createSign('DSS1');
  sign2.update(input);
  const signature2 = sign2.sign(dsaKeyPem, 'hex');

  const verify2 = crypto.createVerify('DSS1');
  verify2.update(input);

  assert.strictEqual(verify2.verify(dsaPubPem, signature2, 'hex'), true);
}


//
// Test DSA signing and verification with PKCS#8 private key
//
{
  const input = 'I AM THE WALRUS';

  // DSA signatures vary across runs so there is no static string to verify
  // against.
  const sign = crypto.createSign('SHA1');
  sign.update(input);
  const signature = sign.sign(dsaPkcs8KeyPem, 'hex');

  const verify = crypto.createVerify('SHA1');
  verify.update(input);

  assert.strictEqual(verify.verify(dsaPubPem, signature, 'hex'), true);
}


//
// Test DSA signing and verification with encrypted key
//
const input = 'I AM THE WALRUS';

{
  const sign = crypto.createSign('SHA1');
  sign.update(input);
  assert.throws(() => {
    sign.sign({ key: dsaKeyPemEncrypted, passphrase: 'wrong' }, 'hex');
  }, decryptError);
}

{
  // DSA signatures vary across runs so there is no static string to verify
  // against.
  const sign = crypto.createSign('SHA1');
  sign.update(input);
  const signOptions = { key: dsaKeyPemEncrypted, passphrase: 'password' };
  const signature = sign.sign(signOptions, 'hex');

  const verify = crypto.createVerify('SHA1');
  verify.update(input);

  assert.strictEqual(verify.verify(dsaPubPem, signature, 'hex'), true);
}
