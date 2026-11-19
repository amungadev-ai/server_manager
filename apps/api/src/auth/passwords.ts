import { randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import { ApiException } from '../common/errors';

export const PASSWORD_OPTIONS = Object.freeze({
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
  hashLength: 32,
});
export class Passwords {
  private active = 0;
  private dummy?: Promise<string>;
  private async bounded<T>(operation: () => Promise<T>): Promise<T> {
    if (this.active >= 2) throw new ApiException(429, 'RATE_LIMITED');
    this.active++;
    try {
      return await operation();
    } finally {
      this.active--;
    }
  }
  hash(password: string): Promise<string> {
    return this.bounded(() => argon2.hash(password, PASSWORD_OPTIONS));
  }
  async prepare(): Promise<void> {
    this.dummy ??= this.hash(randomBytes(32).toString('base64url'));
    await this.dummy;
  }
  async verify(hash: string | null, password: string): Promise<boolean> {
    await this.prepare();
    // A corrupted/imported PHC string must not select unbounded native costs.
    const supported =
      hash !== null &&
      /^\$argon2id\$v=19\$m=19456,t=2,p=1\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{43}$/.test(
        hash,
      );
    const actual = supported ? hash : await this.dummy!;
    const valid = await this.bounded(async () => {
      try {
        return await argon2.verify(actual, password);
      } catch {
        await argon2.verify(await this.dummy!, password);
        return false;
      }
    });
    return supported && valid;
  }
}
