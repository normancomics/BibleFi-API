import jwt from 'jsonwebtoken';
import { ethers } from 'ethers';

const JWT_SECRET = process.env.JWT_SECRET ?? 'biblefi-dev-secret-change-in-production';

/**
 * Express middleware: verify Bearer JWT token.
 */
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Bearer token required' });
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }
}

/**
 * Verify an ERC-8004 agent signature (EIP-191 personal_sign).
 * @param {{ message: string, signature: string, expectedAddress?: string }} params
 * @returns {{ valid: boolean, signer: string }}
 */
export function verifyERC8004Agent({ message, signature, expectedAddress }) {
  try {
    const signer = ethers.verifyMessage(message, signature);
    const valid = expectedAddress
      ? signer.toLowerCase() === expectedAddress.toLowerCase()
      : true;
    return { valid, signer };
  } catch (err) {
    return { valid: false, signer: null };
  }
}

/**
 * Verify an x402 payment header.
 * @param {string} paymentHeader - Raw X-Payment header value
 * @returns {{ valid: boolean, payer: string|null, amount: string|null }}
 */
export function verifyX402Payment(paymentHeader) {
  if (!paymentHeader) return { valid: false, payer: null, amount: null };

  try {
    // x402 payment header is base64-encoded JSON: { signature, payer, amount, token, nonce }
    const decoded = JSON.parse(Buffer.from(paymentHeader, 'base64').toString('utf8'));
    const { signature, payer, amount, token, nonce } = decoded;

    if (!signature || !payer || !amount) return { valid: false, payer: null, amount: null };

    // Reconstruct the signed message
    const message = `x402:${payer}:${amount}:${token ?? 'USDC'}:${nonce ?? ''}`;
    const recovered = ethers.verifyMessage(message, signature);

    const valid = recovered.toLowerCase() === payer.toLowerCase();
    return { valid, payer: recovered, amount };
  } catch {
    return { valid: false, payer: null, amount: null };
  }
}
