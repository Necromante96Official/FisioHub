import test from "node:test";
import assert from "node:assert/strict";

import { formatOutgoingMessage } from "../dist/shared/messageFormat.js";
import { extractPatientNameFromText, isLikelyValidPatientName, sanitizePatientName } from "../dist/shared/patientName.js";
import { containsTriggerStatusLabel, isKnownZenfisioStatusLabel, isTriggerStatusLabel } from "../dist/shared/statusOptions.js";
import { normalizeText, stripUnsafeTrailing, toDateKey } from "../dist/shared/text.js";

test("formatOutgoingMessage keeps the expected chat format", () => {
  assert.equal(formatOutgoingMessage("confirmed", "Ana Maria"), "*✅ Chegou:* *Ana Maria*");
  assert.equal(formatOutgoingMessage("cancelled", "Joao Silva"), "*❌ DESMARCAÇÃO:* *Joao Silva*");
  assert.equal(formatOutgoingMessage("missed", "Bruno Costa"), "*🛑 FALTOU: Bruno Costa*");
});

test("patient name helpers sanitize and reject unsafe candidates", () => {
  assert.equal(sanitizePatientName("Paciente: Ana Maria - Status"), "Ana Maria");
  assert.equal(isLikelyValidPatientName("Ana Maria"), true);
  assert.equal(isLikelyValidPatientName("Status"), false);
  assert.equal(extractPatientNameFromText('{"patientName":"Bruno Costa"}'), "Bruno Costa");
});

test("status helpers recognize ZenFisio trigger statuses", () => {
  assert.equal(isKnownZenfisioStatusLabel("Presença confirmada"), true);
  assert.equal(isTriggerStatusLabel("Não atendido (Sem cobrança)"), true);
  assert.equal(isTriggerStatusLabel("Faltou (com aviso prévio)"), true);
  assert.equal(isTriggerStatusLabel("Faltou (sem aviso prévio)"), true);
  assert.equal(containsTriggerStatusLabel("Status: Presença confirmada"), true);
  assert.equal(containsTriggerStatusLabel("Status: Faltou (com aviso prévio)"), true);
});

test("text helpers normalize values consistently", () => {
  assert.equal(normalizeText("  Presença   Confirmada  "), "presenca confirmada");
  assert.equal(stripUnsafeTrailing("Ana Maria!!!"), "Ana Maria");
  assert.equal(toDateKey(new Date(2026, 5, 11)), "2026-06-11");
});

