// Cashfree Payouts v2 integration: beneficiary upsert + standard transfer.
// Falls back to mock if CASHFREE_CLIENT_ID / CASHFREE_CLIENT_SECRET are not set.
// Docs: https://docs.cashfree.com/reference/payouts-version2

import crypto from "node:crypto";

const CLIENT_ID = process.env["CASHFREE_CLIENT_ID"];
const CLIENT_SECRET = process.env["CASHFREE_CLIENT_SECRET"];
const ENV = (process.env["CASHFREE_ENV"] ?? "sandbox").toLowerCase();

export const isCashfreeLive = Boolean(CLIENT_ID && CLIENT_SECRET);
const BASE =
  ENV === "production" ? "https://api.cashfree.com/payout" : "https://sandbox.cashfree.com/payout";
const API_VERSION = "2024-01-01";

function authHeaders(): Record<string, string> {
  return {
    "x-client-id": CLIENT_ID ?? "",
    "x-client-secret": CLIENT_SECRET ?? "",
    "x-api-version": API_VERSION,
    "Content-Type": "application/json",
  };
}

export interface BeneficiaryInput {
  beneficiaryId: string;
  beneficiaryName: string;
  type: "UPI" | "BANK";
  identifier: string;
  ifsc?: string | null;
}

export async function upsertBeneficiary(b: BeneficiaryInput): Promise<void> {
  if (!isCashfreeLive) return;
  // Try to fetch — if 200, skip. Otherwise create.
  const get = await fetch(`${BASE}/beneficiary?beneficiary_id=${encodeURIComponent(b.beneficiaryId)}`, {
    headers: authHeaders(),
  });
  if (get.status === 200) return;

  const body: Record<string, unknown> = {
    beneficiary_id: b.beneficiaryId,
    beneficiary_name: b.beneficiaryName,
    beneficiary_instrument_details:
      b.type === "UPI"
        ? { vpa: b.identifier }
        : { bank_account_number: b.identifier, bank_ifsc: b.ifsc ?? "" },
    beneficiary_contact_details: {},
  };
  const res = await fetch(`${BASE}/beneficiary`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok && res.status !== 409) {
    const text = await res.text();
    throw new Error(`Cashfree beneficiary upsert failed: ${res.status} ${text}`);
  }
}

export interface TransferResult {
  gatewayRef: string;
  status: "PROCESSING" | "SUCCESS" | "FAILED";
  failureReason?: string;
}

export async function dispatchTransfer(opts: {
  transferId: string;
  beneficiaryId: string;
  amountPaise: bigint;
  remarks?: string;
  type: "UPI" | "BANK";
  identifier: string;
}): Promise<TransferResult> {
  if (!isCashfreeLive) {
    await new Promise((r) => setTimeout(r, 200));
    if (opts.identifier.toLowerCase().startsWith("fail")) {
      return {
        gatewayRef: `pout_mock_${crypto.randomBytes(6).toString("hex")}`,
        status: "FAILED",
        failureReason: "Beneficiary bank rejected the transfer",
      };
    }
    return {
      gatewayRef: `pout_mock_${crypto.randomBytes(6).toString("hex")}`,
      status: "SUCCESS",
    };
  }

  const amountInr = Number(opts.amountPaise) / 100;
  const body = {
    transfer_id: opts.transferId,
    transfer_amount: amountInr,
    transfer_currency: "INR",
    transfer_mode: opts.type === "UPI" ? "upi" : "imps",
    beneficiary_details: { beneficiary_id: opts.beneficiaryId },
    transfer_remarks: opts.remarks ?? "CoinWallet payout",
  };

  const res = await fetch(`${BASE}/transfers`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    return {
      gatewayRef: (data["transfer_id"] as string) ?? opts.transferId,
      status: "FAILED",
      failureReason:
        (data["message"] as string) ?? `Cashfree transfer failed: ${res.status}`,
    };
  }

  const status = String(data["status"] ?? "PROCESSING").toUpperCase();
  if (status === "SUCCESS" || status === "RECEIVED" || status === "COMPLETED") {
    return { gatewayRef: opts.transferId, status: "SUCCESS" };
  }
  if (status === "FAILED" || status === "REJECTED" || status === "REVERSED") {
    return {
      gatewayRef: opts.transferId,
      status: "FAILED",
      failureReason: (data["status_description"] as string) ?? "Transfer failed",
    };
  }
  return { gatewayRef: opts.transferId, status: "PROCESSING" };
}

export async function fetchTransferStatus(transferId: string): Promise<TransferResult | null> {
  if (!isCashfreeLive) return null;
  const res = await fetch(`${BASE}/transfers?transfer_id=${encodeURIComponent(transferId)}`, {
    headers: authHeaders(),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as Record<string, unknown>;
  const status = String(data["status"] ?? "PROCESSING").toUpperCase();
  if (status === "SUCCESS" || status === "COMPLETED") {
    return { gatewayRef: transferId, status: "SUCCESS" };
  }
  if (status === "FAILED" || status === "REJECTED" || status === "REVERSED") {
    return {
      gatewayRef: transferId,
      status: "FAILED",
      failureReason: (data["status_description"] as string) ?? "Transfer failed",
    };
  }
  return { gatewayRef: transferId, status: "PROCESSING" };
}
