export type BookingGuardrailCode = "CLASS_FULL" | "ALREADY_RESERVED" | "CLASS_STARTED" | "CLASS_CANCELLED";
export type ReservationActionResultCode = "RESERVED" | BookingGuardrailCode | "UNKNOWN";

export type AppRole = "client" | "manager" | "admin";
export type ClassStatus = "scheduled" | "cancelled";

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
  status: ClassStatus;
}

export type ClassDetailsView = ClassListItem;

export interface UpcomingReservationItem {
  reservationId: string;
  classId: string;
  className: string;
  classDescription: string | null;
  startsAt: string;
  classStatus: ClassStatus;
  capacity: number;
  confirmedReservationsCount: number;
  availableSpots: number;
  status: "confirmed";
}

export interface CreateClassInput {
  name: string;
  description?: string;
  capacity: number;
  startsAt: string;
}

export type UpdateClassInput = CreateClassInput;

export interface ClassAttendeeItem {
  reservationId: string;
  userId: string;
  userEmail: string;
  status: "confirmed" | "cancelled";
  createdAt: string;
}

export type ClassMutationResult = { ok: true; classId?: string } | { ok: false; code: string; message: string };
