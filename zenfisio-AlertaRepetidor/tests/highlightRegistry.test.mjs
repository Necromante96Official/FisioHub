import assert from "node:assert/strict";
import test from "node:test";

import { cardMatchesHighlight } from "../dist/content/highlightRegistry.js";

test("combina card por horario e tokens do paciente", () => {
  const entry = {
    time: "09:00",
    patientName: "Maria Silva Santos",
    label: "3/3"
  };

  assert.equal(
    cardMatchesHighlight("09:00 Maria Silva Santos Pilates", "09:00", entry),
    true
  );
  assert.equal(
    cardMatchesHighlight("09:00 Joao Pedro", "09:00", entry),
    false
  );
  assert.equal(
    cardMatchesHighlight("Maria Silva Santos", "10:00", entry),
    false
  );
});
