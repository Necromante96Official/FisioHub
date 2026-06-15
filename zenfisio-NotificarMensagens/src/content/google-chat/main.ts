import { notifyChatReady, registerDeliveryListener } from "./messaging.js";

const bootstrap = (): void => {
  if ((bootstrap as { hasRun?: boolean }).hasRun) {
    return;
  }

  (bootstrap as { hasRun?: boolean }).hasRun = true;
  registerDeliveryListener();
  notifyChatReady();
};

if (document.readyState === "complete" || document.readyState === "interactive") {
  bootstrap();
} else {
  document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
}
