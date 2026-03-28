import { Router } from 'express';
import { verifyX402Payment } from '../lib/auth.js';

const router = Router();

const SETTLEMENT_ADDRESS = process.env.SETTLEMENT_ADDRESS ?? '0x7bEda57074AA917FF0993fb329E16C2c188baF08';
const PAYMENT_AMOUNT = process.env.X402_PAYMENT_AMOUNT ?? '0.15';
const PAYMENT_TOKEN = 'USDC';
const FLOW_RATE = process.env.X402_FLOW_RATE ?? '1929012345679'; // ~$5/month in wei/sec

/**
 * POST /x402
 * Implements HTTP 402 Payment Required protocol.
 *
 * If X-Payment header is present and valid → process and return 200.
 * Otherwise → return 402 with payment details.
 */
router.post('/', async (req, res) => {
  const paymentHeader = req.headers['x-payment'];

  // No payment header → return 402 with payment requirements
  if (!paymentHeader) {
    return res.status(402).json({
      protocol: 'x402',
      status: 'payment_required',
      message: 'Payment Required — include X-Payment header with signed payment proof',
      payment: {
        amount: PAYMENT_AMOUNT,
        currency: PAYMENT_TOKEN,
        network: 'base',
        chainId: 8453,
        settlement: SETTLEMENT_ADDRESS,
        accepts: ['USDC', 'USDCx', 'ETH'],
        flowRate: FLOW_RATE,
        flowRateHuman: `${(Number(FLOW_RATE) * 2592000 / 1e6).toFixed(2)} USDC/month`,
      },
      instructions: {
        format: 'base64(JSON({ signature, payer, amount, token, nonce }))',
        signMessage: `x402:{payer}:{amount}:{token}:{nonce}`,
        header: 'X-Payment: <base64-encoded-payment-proof>',
      },
      timestamp: new Date().toISOString(),
    });
  }

  // Payment header present → verify
  const { valid, payer, amount } = verifyX402Payment(paymentHeader);

  if (!valid) {
    return res.status(402).json({
      protocol: 'x402',
      status: 'payment_invalid',
      message: 'Payment signature could not be verified',
      timestamp: new Date().toISOString(),
    });
  }

  // Payment verified → return success
  return res.json({
    protocol: 'x402',
    status: 'paid',
    payer,
    amount,
    settlement: SETTLEMENT_ADDRESS,
    flowRate: FLOW_RATE,
    network: 'base',
    chainId: 8453,
    timestamp: new Date().toISOString(),
  });
});

export default router;
