'use server';

/**
 * Generates an HMAC-SHA256 hash of the provided nonce using a secret key from the environment.
 * @param {Object} params - The parameters object.
 * @param {string} params.nonce - The nonce to be hashed.
 * @returns {string} The resulting HMAC hash in hexadecimal format.
 */
function hashNonceInternal({ nonce }: { nonce: string }): string {
  // Dynamic import of crypto to avoid bundling in edge runtime
  const crypto = require('crypto');
  const hmac = crypto.createHmac('sha256', process.env.HMAC_SECRET_KEY!);
  hmac.update(nonce);
  return hmac.digest('hex');
}

/**
 * Server-side function to generate HMAC hash
 * Used by auth provider (runs in Node.js runtime, not Edge)
 */
export async function hashNonce({ nonce }: { nonce: string }): Promise<string> {
  return hashNonceInternal({ nonce });
}

/**
 * Generates a new random nonce and its corresponding HMAC signature.
 * @async
 * @returns {Promise<{ nonce: string, signedNonce: string }>} An object containing the nonce and its signed (hashed) value.
 */
export async function getNewNonces() {
  const crypto = require('crypto');
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const signedNonce = hashNonceInternal({ nonce });
  return {
    nonce,
    signedNonce,
  };
}
