import { createPublicClient, createWalletClient, encodeFunctionData, http, parseAbi } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const SUPERFLUID_HOST_ABI = parseAbi([
  'function callAgreement(address agreementClass, bytes calldata callData, bytes calldata userData) external',
  'function getAgreementClass(bytes32 agreementType) external view returns (address)',
]);

const CFA_ABI = parseAbi([
  'function createFlow(address token, address receiver, int96 flowRate, bytes calldata ctx) external returns (bytes memory newCtx)',
  'function updateFlow(address token, address receiver, int96 flowRate, bytes calldata ctx) external returns (bytes memory newCtx)',
  'function deleteFlow(address token, address sender, address receiver, bytes calldata ctx) external returns (bytes memory newCtx)',
  'function getFlow(address token, address sender, address receiver) external view returns (uint256 timestamp, int96 flowRate, uint256 deposit, uint256 owedDeposit)',
]);

const GDA_ABI = parseAbi([
  'function updateMemberUnits(address pool, address memberAddress, uint128 newUnits, bytes calldata ctx) external returns (bytes memory newCtx)',
  'function getUnits(address pool, address memberAddress) external view returns (uint128)',
]);

function getClients() {
  const privateKey = process.env.VIEM_PRIVATE_KEY;
  if (!privateKey) throw new Error('VIEM_PRIVATE_KEY not set');

  const account = privateKeyToAccount(
    privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`,
  );

  const publicClient = createPublicClient({
    chain: base,
    transport: http(process.env.BASE_RPC_URL ?? 'https://mainnet.base.org'),
  });

  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(process.env.BASE_RPC_URL ?? 'https://mainnet.base.org'),
  });

  return { account, publicClient, walletClient };
}

/**
 * Create a Superfluid CFA stream.
 * @param {{ receiver: string, flowRate: string, token: string }} params
 */
export async function createSuperfluidStream({ receiver, flowRate, token }) {
  const hostAddress = process.env.SUPERFLUID_HOST_ADDRESS;
  const cfaAddress = process.env.SUPERFLUID_CFA_ADDRESS;
  if (!hostAddress || !cfaAddress) {
    throw new Error('SUPERFLUID_HOST_ADDRESS or SUPERFLUID_CFA_ADDRESS not set');
  }

  const { account, walletClient, publicClient } = getClients();

  // Encode the createFlow call
  const callData = encodeFunctionData({
    abi: CFA_ABI,
    functionName: 'createFlow',
    args: [token, receiver, BigInt(flowRate), '0x'],
  });

  const hash = await walletClient.writeContract({
    address: hostAddress,
    abi: SUPERFLUID_HOST_ABI,
    functionName: 'callAgreement',
    args: [cfaAddress, callData, '0x'],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  return {
    txHash: hash,
    blockNumber: receipt.blockNumber.toString(),
    sender: account.address,
    receiver,
    flowRate,
    token,
    status: receipt.status,
  };
}

/**
 * Delete (stop) a Superfluid CFA stream.
 * @param {{ receiver: string, token: string }} params
 */
export async function deleteSuperfluidStream({ receiver, token }) {
  const hostAddress = process.env.SUPERFLUID_HOST_ADDRESS;
  const cfaAddress = process.env.SUPERFLUID_CFA_ADDRESS;
  if (!hostAddress || !cfaAddress) {
    throw new Error('SUPERFLUID_HOST_ADDRESS or SUPERFLUID_CFA_ADDRESS not set');
  }

  const { account, walletClient, publicClient } = getClients();

  const callData = encodeFunctionData({
    abi: CFA_ABI,
    functionName: 'deleteFlow',
    args: [token, account.address, receiver, '0x'],
  });

  const hash = await walletClient.writeContract({
    address: hostAddress,
    abi: SUPERFLUID_HOST_ABI,
    functionName: 'callAgreement',
    args: [cfaAddress, callData, '0x'],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  return { txHash: hash, status: receipt.status };
}

/**
 * Get flow details between sender and receiver.
 * @param {{ sender: string, receiver: string, token: string }} params
 */
export async function getFlow({ sender, receiver, token }) {
  const cfaAddress = process.env.SUPERFLUID_CFA_ADDRESS;
  if (!cfaAddress) throw new Error('SUPERFLUID_CFA_ADDRESS not set');

  const { publicClient } = getClients();
  const result = await publicClient.readContract({
    address: cfaAddress,
    abi: CFA_ABI,
    functionName: 'getFlow',
    args: [token, sender, receiver],
  });

  return {
    timestamp: result[0].toString(),
    flowRate: result[1].toString(),
    deposit: result[2].toString(),
    owedDeposit: result[3].toString(),
  };
}

/**
 * Update GDA pool member units for validator reward distribution.
 * @param {{ pool: string, member: string, units: bigint }} params
 */
export async function updatePoolMemberUnits({ pool, member, units }) {
  const gdaAddress = process.env.SUPERFLUID_GDA_ADDRESS;
  if (!gdaAddress) throw new Error('SUPERFLUID_GDA_ADDRESS not set');

  const { walletClient, publicClient } = getClients();

  const hash = await walletClient.writeContract({
    address: gdaAddress,
    abi: GDA_ABI,
    functionName: 'updateMemberUnits',
    args: [pool, member, units, '0x'],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  return { txHash: hash, status: receipt.status };
}

/**
 * Calculate validator rewards based on accuracy scores and update pool units.
 * @returns {Promise<object[]>}
 */
export async function calculateValidatorRewards() {
  const { supabase } = await import('./supabase.js');
  if (!supabase) throw new Error('Supabase not initialised');

  const { data: validators, error } = await supabase
    .from('validators')
    .select('*')
    .eq('active', true);

  if (error) throw error;
  if (!validators?.length) return [];

  const results = [];
  for (const validator of validators) {
    const accuracyScore = validator.accuracy_score ?? 0;
    // Units proportional to accuracy (0–100 → 0–10000 units)
    const units = BigInt(Math.round(accuracyScore * 100));

    try {
      const pool = process.env.SUPERFLUID_GDA_ADDRESS;
      if (pool) {
        await updatePoolMemberUnits({ pool, member: validator.address, units });
      }

      await supabase
        .from('validators')
        .update({ pool_units: units.toString(), last_reward_at: new Date().toISOString() })
        .eq('id', validator.id);

      results.push({ validator: validator.address, units: units.toString(), status: 'updated' });
    } catch (err) {
      results.push({ validator: validator.address, error: err.message, status: 'failed' });
    }
  }

  return results;
}
