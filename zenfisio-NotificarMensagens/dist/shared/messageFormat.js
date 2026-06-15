import { STATUS_MESSAGE_PREFIX } from "./constants.js";
export const formatOutgoingMessage = (statusKind, patientName) => {
    const prefix = STATUS_MESSAGE_PREFIX[statusKind];
    if (statusKind === "missed") {
        return `*${prefix}: ${patientName}*`;
    }
    return `*${prefix}:* *${patientName}*`;
};
