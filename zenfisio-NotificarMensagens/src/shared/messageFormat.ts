import { STATUS_MESSAGE_PREFIX } from "./constants.js";
import type { StatusKind } from "./types.js";

export const formatOutgoingMessage = (statusKind: StatusKind, patientName: string): string => {
  const prefix = STATUS_MESSAGE_PREFIX[statusKind];
  if (statusKind === "missed") {
    return `*${prefix}: ${patientName}*`;
  }

  return `*${prefix}:* *${patientName}*`;
};
