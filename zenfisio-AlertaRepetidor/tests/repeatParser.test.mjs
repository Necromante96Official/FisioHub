import assert from "node:assert/strict";
import test from "node:test";

import { cleanText, extractPatientName, extractTimeRangeStart, isRenewalDue, parseRepeatProgress } from "../dist/content/repeatParser.js";

test("parseia Repetido do detalhe", () => {
  assert.deepEqual(parseRepeatProgress("Paciente: Maria Repetido: 3 de 3"), {
    current: 3,
    total: 3,
    raw: "Repetido: 3 de 3"
  });
});

test("regra de renovacao aceita somente iguais de 1 ate 20", () => {
  assert.equal(isRenewalDue({ current: 1, total: 1, raw: "Repetido: 1 de 1" }), true);
  assert.equal(isRenewalDue({ current: 20, total: 20, raw: "Repetido: 20 de 20" }), true);
  assert.equal(isRenewalDue({ current: 9, total: 15, raw: "Repetido: 9 de 15" }), false);
  assert.equal(isRenewalDue({ current: 21, total: 21, raw: "Repetido: 21 de 21" }), false);
});

test("extrai horario e paciente de html do ZenFisio", () => {
  const html = `
    <div>Horário: 08:00 - 09:00</div>
    <div>Paciente: Maurício Stempniak de Lima</div>
    <div>Celular: +55</div>
    <div>Repetido: 3 de 3</div>
  `;

  assert.equal(extractTimeRangeStart(html), "08:00");
  assert.equal(extractPatientName(html), "Maurício Stempniak de Lima");
  assert.match(cleanText(html), /Repetido: 3 de 3/);
});
