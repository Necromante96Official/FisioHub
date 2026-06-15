export const createEmptyAppointmentData = () => ({
  horario: "",
  fisioterapeuta: "",
  paciente: "",
  celular: "",
  convenio: "",
  status: "",
  procedimentos: "",
  valor: ""
});

export const cleanStatusText = (text) => {
  if (!text) return "";

  const lower = text.toLowerCase().trim();
  const statusList = [
    { pattern: /presen[cç]a\s*confirmada/i, output: "Presenca confirmada" },
    { pattern: /faltou\s*\(\s*com\s+aviso\s+pr[eé]vio\s*\)/i, output: "Faltou (com aviso previo)" },
    { pattern: /faltou\s*\(\s*sem\s+aviso\s+pr[eé]vio\s*\)/i, output: "Faltou (sem aviso previo)" },
    { pattern: /n[aã]o\s*atendido\s*\(\s*sem\s+cobran[cç]a\s*\)/i, output: "Nao atendido (Sem cobranca)" },
    { pattern: /n[aã]o\s*atendido/i, output: "Nao atendido" },
    { pattern: /em\s*atendimento/i, output: "Em atendimento" },
    { pattern: /pre[\-\s]?cadastro/i, output: "Pre-cadastro" },
    { pattern: /atendido/i, output: "Atendido" },
    { pattern: /cancelado/i, output: "Cancelado" },
    { pattern: /faltou/i, output: "Faltou" },
    { pattern: /agendado/i, output: "Agendado" },
    { pattern: /remarcar/i, output: "Remarcar" },
    { pattern: /aten[cç][aã]o/i, output: "Atencao" },
    { pattern: /aguardando/i, output: "Aguardando" },
    { pattern: /pendente/i, output: "Pendente" }
  ];

  let firstMatch = null;
  let firstPos = -1;

  for (const status of statusList) {
    const match = lower.match(status.pattern);
    if (match) {
      const pos = lower.indexOf(match[0]);
      if (firstPos === -1 || pos < firstPos) {
        firstPos = pos;
        firstMatch = status.output;
      }
    }
  }

  if (firstMatch) {
    return firstMatch;
  }

  const firstWord = text.trim().split(/\s+/)[0];
  if (firstWord && firstWord.length < 30) {
    return firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase();
  }

  return "";
};

export const cleanAppointmentData = (data) => {
  const cleaned = { ...data };
  for (const key of Object.keys(cleaned)) {
    if (typeof cleaned[key] === "string") {
      cleaned[key] = cleaned[key]
        .replace(/\s+/g, " ")
        .trim()
        .replace(/[×✕✖]$/g, "")
        .trim()
        .replace(/\s*(Paciente|Fisioterapeuta|Celular|Conv[êe]nio|Status|Procedimento|Repetido):.*/i, "")
        .trim();
    }
  }

  return cleaned;
};

export const extractAppointmentDataFromText = (text, status = "") => {
  const data = createEmptyAppointmentData();
  const content = text || "";

  const horarioMatch = content.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/);
  if (horarioMatch) data.horario = `${horarioMatch[1]} - ${horarioMatch[2]}`;

  const fisioMatch = content.match(/Fisioterapeuta[:\s]+([^\n]+?)(?=\s*Paciente|$)/i);
  if (fisioMatch) data.fisioterapeuta = fisioMatch[1].trim();

  const pacienteMatch = content.match(/Paciente[:\s]+([^\n]+?)(?=\s*Celular|\s*Telefone|$)/i);
  if (pacienteMatch) data.paciente = pacienteMatch[1].trim();

  const celularMatch = content.match(/(?:Celular|Telefone)[:\s]+([+\d\s().-]+)/i);
  if (celularMatch) data.celular = celularMatch[1].trim();

  const convenioMatch = content.match(/Conv[êe]nio[:\s]+([^\n]+?)(?=\s*Status|\s*N[uú]mero|$)/i);
  if (convenioMatch) {
    data.convenio = convenioMatch[1].trim().replace(/N[uú]mero\s*(do|da)?\s*$/i, "").trim();
  }

  const procMatch = content.match(/Procedimentos?[:\s]+([^\n]+?)(?=\s*Repetido|\s*\d{2}\/\d{2}\/\d{4}|\s*R\$|\s*Valor|$)/i)
    || content.match(/Procedimento[s]?[:\s]+(.+?)(?=\n|$)/i);
  if (procMatch) data.procedimentos = procMatch[1].trim();

  const valorMatch = content.match(/R\$\s*([\d.,]+)/);
  if (valorMatch) data.valor = `R$ ${valorMatch[1]}`;

  data.status = status || cleanStatusText(content);
  return cleanAppointmentData(data);
};

export const formatAppointmentData = (data) => {
  const lines = [];
  if (data.horario) lines.push(`Horario: ${data.horario}`);
  if (data.fisioterapeuta) lines.push(`Fisioterapeuta: ${data.fisioterapeuta}`);
  if (data.paciente) lines.push(`Paciente: ${data.paciente}`);
  if (data.celular) lines.push(`Celular: ${data.celular}`);
  if (data.convenio) lines.push(`Convenio: ${data.convenio}`);
  if (data.status) lines.push(`Status: ${data.status}`);
  if (data.procedimentos) lines.push(`Procedimentos: ${data.procedimentos}`);
  if (data.valor) lines.push(`Valor: ${data.valor}`);
  return lines.join("\n");
};

export const buildExportContent = (items, date = new Date()) => {
  let content = "============================================================\n";
  content += "ZENFISIO COLETOR DE DADOS\n";
  content += `Data: ${date.toLocaleString("pt-BR")}\n`;
  content += `Total: ${items.length} agendamentos\n`;
  content += "============================================================\n\n";

  items.forEach((item, index) => {
    content += `--- Agendamento ${index + 1} ---\n`;
    content += `Coletado em: ${new Date(item.timestamp).toLocaleString("pt-BR")}\n\n`;
    content += `${item.formatted}\n\n`;
    content += "------------------------------------------------------------\n\n";
  });

  return content;
};
