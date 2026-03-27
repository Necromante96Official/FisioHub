export type StatusKind = "confirmed" | "cancelled";

export type StatusEventPayload = {
  patientName: string;
  statusKind: StatusKind;
  source: "select-change" | "click-trigger";
};

export type HistoryEntry = {
  patientKey: string;
  patientName: string;
  dateKey: string;
  statusKind: StatusKind;
  lastSentIso: string;
};

export type MessageEnvelope<TType extends string, TPayload = undefined> =
  TPayload extends undefined
    ? { type: TType }
    : { type: TType; payload: TPayload };
