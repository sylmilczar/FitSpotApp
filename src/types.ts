export type BookingGuardrailCode = "CLASS_FULL" | "ALREADY_RESERVED" | "CLASS_STARTED";
export type ReservationActionResultCode = "RESERVED" | BookingGuardrailCode | "UNKNOWN";

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

export interface ClassListItem {
  id: string;
  name: string;
  description: string | null;
  capacity: number;
  startsAt: string;
  confirmedReservationsCount: number;
  availableSpots: number;
  isFull: boolean;
  isStarted: boolean;
}

export type ClassDetailsView = ClassListItem;

export interface UpcomingReservationItem {
  reservationId: string;
  classId: string;
  className: string;
  classDescription: string | null;
  startsAt: string;
  capacity: number;
  confirmedReservationsCount: number;
  availableSpots: number;
  status: "confirmed";
}
