import { Injectable } from "@nestjs/common";
import { hash, verify, Algorithm } from "@node-rs/argon2";

/**
 * Argon2id with OWASP's recommended floor (19 MiB, 2 passes). Hashing is the
 * one place we deliberately spend CPU.
 */
const OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

@Injectable()
export class PasswordService {
  hash(plain: string): Promise<string> {
    return hash(plain, OPTIONS);
  }

  /**
   * Never throws on a malformed hash — a corrupt row should read as "wrong
   * password", not as a 500 that tells an attacker the account exists.
   */
  async verify(digest: string, plain: string): Promise<boolean> {
    try {
      return await verify(digest, plain, OPTIONS);
    } catch {
      return false;
    }
  }
}
