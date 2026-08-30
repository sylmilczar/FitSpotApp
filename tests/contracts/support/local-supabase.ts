import { execFileSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

interface LocalSupabaseStatus {
  API_URL: string;
  ANON_KEY: string;
  SERVICE_ROLE_KEY: string;
}

let cachedStatus: LocalSupabaseStatus | null = null;

function readLocalStatus(): LocalSupabaseStatus {
  const output = execFileSync("npx", ["supabase", "status", "-o", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const parsed: unknown = JSON.parse(output);

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("API_URL" in parsed) ||
    !("ANON_KEY" in parsed) ||
    !("SERVICE_ROLE_KEY" in parsed) ||
    typeof parsed.API_URL !== "string" ||
    typeof parsed.ANON_KEY !== "string" ||
    typeof parsed.SERVICE_ROLE_KEY !== "string"
  ) {
    throw new Error("Local Supabase status does not contain the required API keys");
  }

  return {
    API_URL: parsed.API_URL,
    ANON_KEY: parsed.ANON_KEY,
    SERVICE_ROLE_KEY: parsed.SERVICE_ROLE_KEY,
  };
}

export function getLocalStatus(): LocalSupabaseStatus {
  cachedStatus ??= readLocalStatus();
  return cachedStatus;
}

function createLocalClient(key: string): SupabaseClient {
  return createClient(getLocalStatus().API_URL, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  }) as SupabaseClient;
}

export interface ContractRpcResult {
  data: unknown;
  error: { message: string } | null;
}

function isContractRpcError(value: unknown): value is { message: string } {
  return typeof value === "object" && value !== null && "message" in value && typeof value.message === "string";
}

export async function callContractRpc(
  client: SupabaseClient,
  functionName: string,
  args: Record<string, unknown>,
): Promise<ContractRpcResult> {
  const response: unknown = await client.rpc(functionName, args);

  if (typeof response !== "object" || response === null || !("data" in response) || !("error" in response)) {
    throw new Error(`Unexpected ${functionName} RPC response`);
  }

  const error = response.error;
  if (error !== null && !isContractRpcError(error)) {
    throw new Error(`Unexpected ${functionName} RPC error`);
  }

  return {
    data: response.data,
    error: error === null ? null : { message: error.message },
  };
}

export function createAdminClient(): SupabaseClient {
  return createLocalClient(getLocalStatus().SERVICE_ROLE_KEY);
}

export function createAnonymousClient(): SupabaseClient {
  return createLocalClient(getLocalStatus().ANON_KEY);
}
