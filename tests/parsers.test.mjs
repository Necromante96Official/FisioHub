import test from "node:test";
import assert from "node:assert/strict";

import {
    classifyAttendanceStatus,
    extractIsoDate,
    parseFieldEntriesFromLine,
    sanitizeProcedimentosValue,
    splitAppointmentBlocks
} from "../js/domain/appointment-parser.js";
import { parseProcedureEntries } from "../js/domain/procedure-parser.js";
import { buildWhatsappLink } from "../js/shared/phone.js";

test("splitAppointmentBlocks separates imported appointments by marker", () => {
    const blocks = splitAppointmentBlocks([
        "--- Agendamento 1",
        "Paciente: Ana",
        "Status: Atendido",
        "--- Agendamento 2",
        "Paciente: Bruno",
        "Status: Faltou"
    ]);

    assert.deepEqual(blocks, [
        ["Paciente: Ana", "Status: Atendido"],
        ["Paciente: Bruno", "Status: Faltou"]
    ]);
});

test("parseFieldEntriesFromLine extracts multiple fields from one line", () => {
    const entries = parseFieldEntriesFromLine("Horário: 08:00 Paciente: Ana Status: Presença confirmada");

    assert.deepEqual(entries, [
        ["Horário", "08:00"],
        ["Paciente", "Ana"],
        ["Status", "Presença confirmada"]
    ]);
});

test("date, status and procedure sanitizers keep normalized business meaning", () => {
    assert.equal(extractIsoDate("Data: 11/06/2026"), "2026-06-11");
    assert.equal(classifyAttendanceStatus("Presença confirmada"), "atendido");
    assert.equal(classifyAttendanceStatus("Não atendido"), "falta");
    assert.equal(sanitizeProcedimentosValue("RPG Observações: trazer exame"), "RPG");
});

test("parseProcedureEntries detects frequency and price", () => {
    const entries = parseProcedureEntries("Fisioterapia 2x / semana; Pilates 3x");

    assert.equal(entries.length, 2);
    assert.deepEqual(entries.map((entry) => [entry.baseName, entry.frequency, entry.value]), [
        ["Fisioterapia", 2, 20],
        ["Pilates", 3, 15]
    ]);
});

test("buildWhatsappLink normalizes Brazilian phone links", () => {
    assert.equal(buildWhatsappLink("(51) 99999-0000"), "https://wa.me/5551999990000");
    assert.equal(buildWhatsappLink("+55 51 99999-0000"), "https://wa.me/5551999990000");
    assert.equal(buildWhatsappLink(""), null);
});

