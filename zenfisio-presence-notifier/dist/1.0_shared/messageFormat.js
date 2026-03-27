import { STATUS_MESSAGE_PREFIX } from "./constants.js";
export const formatOutgoingMessage = (statusKind, patientName) => {
    const prefix = STATUS_MESSAGE_PREFIX[statusKind];
    return `*${prefix}:* *${patientName}*`;
};
