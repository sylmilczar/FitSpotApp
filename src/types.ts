export type BookingGuardrailCode = "CLASS_FULL" | "ALREADY_RESERVED" | "CLASS_STARTED";

export type AppRole = "client" | "manager" | "admin";

export interface BookingContractSuccess {
  ok: true;
}

export interface BookingContractFailure {
  ok: false;
  code: BookingGuardrailCode | "UNKNOWN";
  message: string;
}

export type BookingContractResult = BookingContractSuccess | BookingContractFailure;
