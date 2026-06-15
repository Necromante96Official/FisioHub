import assert from "node:assert/strict";
import test from "node:test";
import {
  buildExportContent,
  cleanStatusText,
  extractAppointmentDataFromText,
  formatAppointmentData
} from "../core/collector-core.mjs";

test("normaliza status conhecidos do ZenFisio", () => {
  assert.equal(cleanStatusText("Faltou (com aviso prévio)"), "Faltou (com aviso previo)");
  assert.equal(cleanStatusText("Faltou (sem aviso prévio)"), "Faltou (sem aviso previo)");
  assert.equal(cleanStatusText("Não atendido (Sem cobrança)"), "Nao atendido (Sem cobranca)");
  assert.equal(cleanStatusText("Presença confirmada"), "Presenca confirmada");
});

test("extrai campos principais de um texto de agendamento", () => {
  const data = extractAppointmentDataFromText(
    [
      "08:00 - 09:00",
      "Fisioterapeuta: Maria Silva",
      "Paciente: Joao Souza",
      "Celular: (51) 99999-0000",
      "Convênio: Particular",
      "Status: Atendido",
      "Procedimentos: Avaliacao fisioterapeutica",
      "Valor: R$ 120,00"
    ].join("\n")
  );

  assert.deepEqual(data, {
    horario: "08:00 - 09:00",
    fisioterapeuta: "Maria Silva",
    paciente: "Joao Souza",
    celular: "(51) 99999-0000",
    convenio: "Particular",
    status: "Atendido",
    procedimentos: "Avaliacao fisioterapeutica",
    valor: "R$ 120,00"
  });
});

test("formata dados coletados no layout de exportacao", () => {
  const formatted = formatAppointmentData({
    horario: "08:00 - 09:00",
    fisioterapeuta: "Maria Silva",
    paciente: "Joao Souza",
    celular: "",
    convenio: "Particular",
    status: "Atendido",
    procedimentos: "Avaliacao",
    valor: "R$ 120,00"
  });

  assert.match(formatted, /Horario: 08:00 - 09:00/);
  assert.match(formatted, /Paciente: Joao Souza/);
  assert.doesNotMatch(formatted, /Celular:/);
});

test("monta o conteudo TXT com total e itens", () => {
  const content = buildExportContent(
    [
      {
        timestamp: "2026-06-15T10:00:00.000Z",
        formatted: "Paciente: Joao Souza"
      }
    ],
    new Date("2026-06-15T12:00:00.000Z")
  );

  assert.match(content, /ZENFISIO COLETOR DE DADOS/);
  assert.match(content, /Total: 1 agendamentos/);
  assert.match(content, /--- Agendamento 1 ---/);
  assert.match(content, /Paciente: Joao Souza/);
});
