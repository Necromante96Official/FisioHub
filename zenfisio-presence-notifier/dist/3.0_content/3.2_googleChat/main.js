import { notifyChatReady, registerDeliveryListener } from "./messaging.js";
const bootstrap = () => {
    if (bootstrap.hasRun) {
        return;
    }
    bootstrap.hasRun = true;
    registerDeliveryListener();
    notifyChatReady();
};
if (document.readyState === "complete" || document.readyState === "interactive") {
    bootstrap();
}
else {
    document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
}
