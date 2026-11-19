import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Secret, TOTP } from 'otpauth';

export class MfaCrypto {
  private readonly key?: Buffer;
  constructor(key?: Buffer) {
    this.key = key ? Buffer.from(key) : undefined;
  }
  assertReady(): void {
    if (this.key?.length !== 32)
      throw new Error('An explicit 32-byte MFA wrapping key is required.');
  }
  private aad(installation: string, user: string): Buffer {
    return Buffer.from(`cloudlane.totp.v1\0${installation}\0${user}`);
  }
  generate() {
    return Secret.fromHex(randomBytes(20).toString('hex'));
  }
  seal(secret: Secret, installation: string, user: string) {
    this.assertReady();
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key!, nonce);
    cipher.setAAD(this.aad(installation, user));
    const ciphertext = Buffer.concat([
      cipher.update(Buffer.from(secret.hex, 'hex')),
      cipher.final(),
    ]);
    return { ciphertext, nonce, tag: cipher.getAuthTag() };
  }
  open(
    ciphertext: Buffer,
    nonce: Buffer,
    tag: Buffer,
    installation: string,
    user: string,
  ): Secret {
    this.assertReady();
    const decipher = createDecipheriv('aes-256-gcm', this.key!, nonce);
    decipher.setAAD(this.aad(installation, user));
    decipher.setAuthTag(tag);
    const raw = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    try {
      return Secret.fromHex(raw.toString('hex'));
    } finally {
      raw.fill(0);
    }
  }
  uri(secret: Secret, label: string): string {
    return new TOTP({
      issuer: 'Cloudlane',
      label,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret,
    }).toString();
  }
  acceptedStep(
    secret: Secret,
    token: string,
    milliseconds: number,
    lastStep: string | number,
  ): number | null {
    const step = Math.floor(milliseconds / 30000);
    const delta = TOTP.validate({
      secret,
      token,
      timestamp: milliseconds,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      window: 1,
    });
    return delta !== null && step + delta > Number(lastStep)
      ? step + delta
      : null;
  }
}
