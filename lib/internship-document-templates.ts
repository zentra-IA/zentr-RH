export type InternshipDocumentType =
  | "tce"
  | "ra"
  | "adt"
  | "dtt"
  | "jornada"
  | "convenio";

export type InternshipContext = {
  hiring: any;
  candidate: any;
  job: any;
  opening: any;
  client: any;
  data: Record<string, any>;
};

function text(value: any, fallback = "") {
  const v = value === null || value === undefined ? "" : String(value).trim();
  return v || fallback;
}

function money(value: any) {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(String(value).replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n)) return text(value);
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseDate(value: any) {
  if (!value) return null;
  const raw = String(value).slice(0, 10);
  const [y, m, d] = raw.split("-").map(Number);
  if (y && m && d) return new Date(y, m - 1, d, 12, 0, 0);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isoDate(value: any) {
  const date = parseDate(value);
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatDate(value: any) {
  const date = parseDate(value);
  if (!date) return text(value);
  return date.toLocaleDateString("pt-BR");
}

export function formatLongDate(value: any) {
  const date = parseDate(value) || new Date();
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function addMonths(value: any, months: number) {
  const date = parseDate(value);
  if (!date) return null;
  const day = date.getDate();
  const result = new Date(date.getFullYear(), date.getMonth() + months, 1, 12, 0, 0);
  const last = new Date(result.getFullYear(), result.getMonth() + 1, 0, 12, 0, 0).getDate();
  result.setDate(Math.min(day, last));
  return result;
}

function minDate(a: Date, b: Date) {
  return a.getTime() <= b.getTime() ? a : b;
}

function internshipStart(ctx: InternshipContext) {
  return (
    ctx.data.internship_start ||
    ctx.hiring?.contract_start ||
    ctx.hiring?.start_date ||
    ctx.hiring?.startDate ||
    ""
  );
}

function internshipEnd(ctx: InternshipContext) {
  return (
    ctx.data.internship_end ||
    ctx.hiring?.contract_end ||
    ctx.hiring?.end_date ||
    ctx.hiring?.endDate ||
    ""
  );
}

function isHigherEducation(ctx: InternshipContext) {
  const subtype = text(ctx.data.internship_subtype).toLowerCase();
  const level = text(ctx.data.education_level).toLowerCase();
  return (
    subtype === "higher_education" ||
    level.includes("superior") ||
    level.includes("gradua")
  );
}

function cappedEnd(ctx: InternshipContext, rawEnd: any) {
  const end = parseDate(rawEnd);
  if (!end) return null;

  const finalYear =
    String(ctx.data.high_school_final_year || "").toLowerCase() === "true" ||
    ctx.data.high_school_final_year === true ||
    text(ctx.data.school_year).trim() === "3" ||
    text(ctx.data.school_year).toLowerCase().includes("3º") ||
    text(ctx.data.school_year).toLowerCase().includes("3°");

  if (!finalYear) return end;

  const graduationYear = Number(
    ctx.data.graduation_year ||
      parseDate(internshipStart(ctx))?.getFullYear() ||
      end.getFullYear()
  );

  if (!Number.isFinite(graduationYear)) return end;

  return minDate(end, new Date(graduationYear, 11, 31, 12, 0, 0));
}

export type RaPeriod = {
  number: number;
  start: string;
  end: string;
  label: string;
};

export function calculateRaPeriods(ctx: InternshipContext): RaPeriod[] {
  const periods: RaPeriod[] = [];

  const segments: Array<{ start: any; end: any }> = [
    { start: internshipStart(ctx), end: internshipEnd(ctx) },
  ];

  if (ctx.data.extension_start && ctx.data.extension_end) {
    segments.push({
      start: ctx.data.extension_start,
      end: ctx.data.extension_end,
    });
  }

  let number = 1;

  for (const segment of segments) {
    const start = parseDate(segment.start);
    const end = cappedEnd(ctx, segment.end);
    if (!start || !end || end.getTime() < start.getTime()) continue;

    const sixMonths = addMonths(start, 6);
    if (sixMonths && sixMonths.getTime() < end.getTime()) {
      periods.push({
        number,
        start: isoDate(start),
        end: isoDate(sixMonths),
        label: `${number}º RA`,
      });
      number += 1;

      periods.push({
        number,
        start: isoDate(sixMonths),
        end: isoDate(end),
        label: `${number}º RA`,
      });
      number += 1;
    } else {
      periods.push({
        number,
        start: isoDate(start),
        end: isoDate(end),
        label: `${number}º RA`,
      });
      number += 1;
    }
  }

  return periods;
}

function candidateName(ctx: InternshipContext) {
  return text(
    ctx.data.candidate_name ||
      ctx.hiring?.candidate_name ||
      ctx.candidate?.name ||
      `${text(ctx.candidate?.firstName)} ${text(ctx.candidate?.lastName)}`.trim(),
    "________________"
  );
}

function companyName(ctx: InternshipContext) {
  return text(
    ctx.data.company_name ||
      ctx.client?.company_name ||
      ctx.client?.restaurant_name ||
      ctx.hiring?.company_name,
    "________________"
  );
}

function companyCnpj(ctx: InternshipContext) {
  return text(
    ctx.data.company_cnpj || ctx.client?.cnpj || ctx.client?.document,
    "________________"
  );
}

function companyAddress(ctx: InternshipContext) {
  return [
    text(ctx.data.company_address || ctx.client?.address),
    text(ctx.data.company_city || ctx.client?.city),
    text(ctx.data.company_state || ctx.client?.state),
    ctx.data.company_zip || ctx.client?.cep
      ? `CEP ${text(ctx.data.company_zip || ctx.client?.cep)}`
      : "",
  ]
    .filter(Boolean)
    .join(", ");
}

function institutionBlock(ctx: InternshipContext) {
  return `INSTITUIÇÃO DE ENSINO
Instituição de ensino: ${text(ctx.data.institution_name, "________________")}
Endereço: ${text(ctx.data.institution_address, "________________")}
Complemento: ${text(ctx.data.institution_complement, "-")}
Bairro: ${text(ctx.data.institution_neighborhood, "________________")}
Cidade: ${text(ctx.data.institution_city, "________________")}
Estado: ${text(ctx.data.institution_state, "________________")}
CEP: ${text(ctx.data.institution_zip, "________________")}
Telefone: ${text(ctx.data.institution_phone, "________________")}
CNPJ: ${text(ctx.data.institution_cnpj, "________________")}
Neste ato representado por: ${text(ctx.data.institution_representative, "________________")}
Cargo: ${text(ctx.data.institution_representative_role, "________________")}`;
}

const AGENT_BLOCK = `AGENTE DE INTEGRAÇÃO
Razão Social: Motivar RH Eireli – ME
Grupo Motivar RH
Endereço: Rua Sete de Abril, Nº 296
Complemento: 12° andar, Sala 121
Bairro: República
Cidade: São Paulo
Estado: São Paulo
CEP: 01044-000
Telefone: (11) 99295-0022
E-mail: integracao@grupomotivarrh.com.br
CNPJ: 11.333.607/0001-00
Representante Legal: Cícera Angélica de Andrade Januário
E-mail: angelica@grupomotivarrh.com.br
Cargo: Diretora`;

function companyBlock(ctx: InternshipContext) {
  return `EMPRESA CONCEDENTE
Razão Social: ${companyName(ctx)}
Endereço: ${text(ctx.data.company_address || ctx.client?.address, "________________")}
Complemento: ${text(ctx.data.company_complement, "-")}
Bairro: ${text(ctx.data.company_neighborhood, "________________")}
Cidade: ${text(ctx.data.company_city || ctx.client?.city, "________________")}
Estado: ${text(ctx.data.company_state || ctx.client?.state, "________________")}
CEP: ${text(ctx.data.company_zip || ctx.client?.cep, "________________")}
Telefone: ${text(ctx.data.company_phone || ctx.client?.phone || ctx.client?.whatsapp, "________________")}
CNPJ: ${companyCnpj(ctx)}
Representante: ${text(ctx.data.company_representative || ctx.client?.responsible_name || ctx.client?.owner_name, "________________")}
Cargo: ${text(ctx.data.company_representative_role, "________________")}
E-mail: ${text(ctx.data.company_email || ctx.client?.email, "________________")}`;
}

function candidateBlock(ctx: InternshipContext) {
  const c = ctx.candidate || {};
  return `ESTAGIÁRIO
Nome: ${candidateName(ctx)}
Data de Nascimento: ${formatDate(ctx.data.candidate_birth_date || c.birthDate)}
CPF: ${text(ctx.data.candidate_cpf || c.cpf, "________________")}
RG: ${text(ctx.data.rg_number || ctx.data.candidate_rg || c.rg, "________________")}
Endereço: ${text(ctx.data.candidate_address || c.address, "________________")}
Complemento: ${text(ctx.data.candidate_complement, "-")}
Bairro: ${text(ctx.data.candidate_neighborhood || c.neighborhood, "________________")}
Cidade: ${text(ctx.data.candidate_city || c.city, "________________")}
Estado: ${text(ctx.data.candidate_state || c.state, "________________")}
CEP: ${text(ctx.data.candidate_zip || c.zipCode, "________________")}
E-mail: ${text(ctx.data.candidate_email || ctx.hiring?.candidate_email || c.email, "________________")}
Celular: ${text(ctx.data.candidate_phone || ctx.hiring?.candidate_phone || c.mobile || c.phone, "________________")}
Campus: ${text(ctx.data.campus, "-")}
RA: ${text(ctx.data.enrollment_number, "________________")}
Regularmente matriculado (a) no: ${text(ctx.data.semester || ctx.data.school_year, "________________")}
Período / Horário: ${text(ctx.data.study_period, "________________")}
Curso: ${text(ctx.data.course_name || c.course, "________________")}
Nível: ${text(ctx.data.education_level || c.education, "________________")}`;
}

function guardianBlock(ctx: InternshipContext) {
  if (isHigherEducation(ctx)) return "";
  return `RESPONSÁVEL PELO ESTAGIÁRIO
Nome: ${text(ctx.data.guardian_name, "________________")}
CPF: ${text(ctx.data.guardian_cpf, "________________")}
RG: ${text(ctx.data.guardian_rg, "________________")}
Celular: ${text(ctx.data.guardian_phone, "________________")}
Parentesco: ${text(ctx.data.guardian_relationship, "________________")}`;
}

export function buildTceText(ctx: InternshipContext) {
  const start = internshipStart(ctx);
  const end = cappedEnd(ctx, internshipEnd(ctx));
  const number = text(ctx.data.contract_number, "________");
  const year = parseDate(start)?.getFullYear() || new Date().getFullYear();
  const guardian = guardianBlock(ctx);
  const salary = money(ctx.data.scholarship_amount || ctx.hiring?.salary || ctx.opening?.remuneration);
  const help = money(ctx.data.cost_allowance);
  const scholarshipLine = help
    ? `uma Bolsa Estágio no valor de R$ ${salary || "________"} mais Ajuda de Custo no valor de R$ ${help} por mês.`
    : `uma Bolsa Estágio no valor de R$ ${salary || "________"} por mês.`;

  const insuranceCompany = text(
    ctx.data.insurance_company,
    "PORTO SEGURO CIA DE SEGUROS GERAIS"
  );
  const insurancePolicy = text(
    ctx.data.insurance_policy,
    "61.0862.98.000"
  );

  const guardianSignature = isHigherEducation(ctx)
    ? ""
    : `
______________________________
RESPONSÁVEL (QUANDO MENOR)
`;

  return `TERMO DE COMPROMISSO DE ESTÁGIO
NÚMERO ${number}
${year}

Instrumento jurídico de Termo de Compromisso de Estágio e Convênio de Concessão de Estágio, previsto na lei 11.788 de 25 de Setembro de 2008 que regulamenta e disciplina a contratação de estagiários.

As partes a seguir qualificadas:

${institutionBlock(ctx)}

${AGENT_BLOCK}

${companyBlock(ctx)}

${candidateBlock(ctx)}

${guardian ? `\n${guardian}\n` : ""}
Celebram entre si o presente Convênio de Concessão de Estágio e o Termo de Compromisso de Estágio convencionando as cláusulas e condições a seguir:

RESUMO

a) Período de vigência desse instrumento:
De ${formatDate(start)} a ${formatDate(end)}, podendo ser rescindido unilateralmente por qualquer uma das partes, a qualquer momento sem ônus, multas ou aviso prévio, mediante formalização do respectivo termo de rescisão.

b) Jornada:
${text(ctx.data.work_schedule || ctx.opening?.work_schedule, "________________")}${ctx.data.break_time || ctx.opening?.break_time ? `, com ${text(ctx.data.break_time || ctx.opening?.break_time)} de intervalo` : ""}${ctx.data.weekly_hours ? ` (não ultrapassando ${text(ctx.data.weekly_hours)} horas semanais)` : ""}.

c) O estagiário realizara as atividades de acordo com o regulamento da EMPRESA CONCEDENTE e o projeto pedagógico do curso para o estágio que são:
${text(ctx.data.activities || (ctx.opening?.activities || []).join("; "), "________________")}

Supervisor(a) de estágio: ${text(ctx.data.supervisor_name, "________________")}
Cargo: ${text(ctx.data.supervisor_role, "________________")}
Formação: ${text(ctx.data.supervisor_education, "________________")}
E-mail: ${text(ctx.data.supervisor_email, "________________")}

d) Valor da Bolsa Estágio + Ajuda de Custo (não se aplica a bolsa de estágio ou ao benefício da ajuda de custo nenhum desconto previsto na CLT).
No período de estágio o ESTAGIÁRIO receberá diretamente da EMPRESA CONCEDENTE, ${scholarshipLine}

CLÁUSULAS

Cláusula 1ª - O presente Termo de Compromisso de Estágio estabelece as condições básicas para consecução do estágio previsto nos artigos 1, 2, 3 e 4 da Lei nº. 11.788 de 25 de setembro de 2008 visando o exercício prático de competências próprias da atividade profissional e à contextualização curricular, com objetivo do desenvolvimento do educando para a vida cidadã e para o trabalho, proporcionadas pela aprendizagem social, profissional e cultural no ambiente de trabalho.
Cláusula 2ª - O estágio pode ser obrigatório ou não obrigatório, conforme determinação das diretrizes circulares, modalidade e área de ensino e do projeto pedagógico do curso.
Cláusula 3ª - O estágio, tanto o obrigatório quanto o não obrigatório, não cria vínculo empregatício de qualquer natureza, observadas as disposições previstas no Artigo 3 da Legislação do Estágio.
Cláusula 4ª - A INSTITUIÇÃO DE ENSINO comunicará a EMPRESA CONCEDENTE do estágio, através do aluno, as datas de realização de avaliações escolares ou acadêmicas.
Cláusula 5ª - Se a INSTITUIÇÃO DE ENSINO adotar verificações de aprendizagem periódicas ou finais, no período de estágio do Estudante, a carga horária do estágio, nestas datas, poderá ser reduzida à metade para assegurar o bom desempenho do Estudante no curso.
Cláusula 6ª - Caberá à EMPRESA CONCEDENTE do estágio a apresentação periódica, em prazo não superior a seis meses, do Relatório das Atividades do Estagiário, na conclusão do estágio ou, se for o caso, na rescisão antecipada do Termo de Compromisso de Estágio.
Cláusula 7ª - O horário do estágio não deverá, em hipótese alguma, prejudicar a frequência do ESTAGIÁRIO às aulas e provas do curso no qual está matriculado.
Cláusula 8ª - A assiduidade do ESTAGIÁRIO será demonstrada pela marcação de entrada e saída em cartão de ponto ou qualquer outra modalidade de controle adotada pela EMPRESA.
Cláusula 9ª - Em decorrência do presente Termo de Compromisso de Estágio celebra-se neste ato, entre a EMPRESA CONCEDENTE e a INSTITUIÇÃO DE ENSINO, o Convênio de Concessão de Estágio, previsto no Artigo 8 da Legislação do Estágio.
Cláusula 10ª - O estágio como ato educativo escolar supervisionado, deverá ter acompanhamento efetivo pelo professor orientador da INSTITUIÇÃO DE ENSINO e pelo supervisor da EMPRESA CONCEDENTE, comprovado por vistos nos relatórios referidos na Cláusula 6ª deste instrumento.
Cláusula 11ª - O descumprimento das obrigações previstas na Legislação do Estágio caracteriza vínculo de emprego do Educando com a EMPRESA CONCEDENTE do estágio para todos os fins da legislação trabalhista e previdenciária.
Cláusula 12ª - No período da vigência do presente Termo de Compromisso do Estágio o ESTAGIÁRIO terá cobertura de Seguro de Acidentes Pessoais da seguradora: ${insuranceCompany}, proporcionada pela APOLICE COLETIVA N° ${insurancePolicy} ou outra equivalente, sob a responsabilidade do GRUPO MOTIVAR RH. A Proposta de Adesão Individual devidamente aceita pelo Segurado, e/ou o respectivo Certificado Individual de Seguro de Acidentes Pessoais, são partes integrantes e obrigatórias desse documento. As suas ausências descaracterizam o regime de contratação e sujeitam a EMPRESA CONCEDENTE ao disposto na Cláusula 11ª do presente instrumento.
Cláusula 13ª – As atividades descritas no Resumo poderão ser alteradas com o progresso do estágio e do currículo escolar objetivando, sempre, a compatibilização e a complementação do curso.
Cláusula 14ª – O valor da Bolsa Estágio descrito no Resumo poderá variar em decorrência do exposto na Cláusula 5ª deste instrumento ou se ocorrer, por parte do ESTAGIÁRIO independente do motivo, o não cumprimento das obrigações acordadas no presente Termo de Compromisso de Estágio.
Cláusula 15ª – O valor da Bolsa Estágio está sujeito à retenção de imposto de renda, conforme tabela em vigor definida pela Secretaria da Receita Federal.
Cláusula 16ª - A concessão da Bolsa Estágio, bem como o Auxílio Transporte, é compulsória nos casos de estágios não obrigatórios.
Cláusula 17ª - A importância referente à Bolsa Estágio, por não ter natureza salarial, não estará sujeita a qualquer desconto trabalhista, previdenciário ou mesmo vinculado ao FGTS, exceção feita ao desconto correspondente ao imposto de renda consoante da cláusula 15ª.
Cláusula 18ª - É assegurado ao ESTAGIÁRIO, sempre que o estágio tenha duração superior ou igual a 1 (um) ano, que seja disponibilizado um período de recesso de 30 (trinta) dias ou proporcional ao período estagiado, a ser gozado preferencialmente durante suas férias escolares. O período de recesso poderá ser gozado ou indenizado pela EMPRESA CONCEDENTE.
Cláusula 19ª - Caberá ao estagiário à obrigação de informar a EMPRESA CONCEDENTE quaisquer alterações ocorridas no transcurso da sua atividade escolar, tais como interrupções de frequência de aulas, mudanças de cursos ou transferência de instituição de Ensino.
Cláusula 20ª - É de responsabilidade do ESTAGIÁRIO preservar o sigilo e a confidencialidade das informações que tiver acesso no decorrer do seu estágio junto a EMPRESA CONCEDENTE.
Cláusula 21ª - Serão motivos de rescisão automática do presente instrumento jurídico O abandono ou interrupção do curso pelo Aluno. Trancamento da matrícula ou trancamento do curso. O não cumprimento de qualquer uma das cláusulas prevista nesse instrumento jurídico.
Cláusula 22ª - Aplica-se ao ESTAGIÁRIO a Legislação relacionada à saúde e segurança do trabalho, sendo a EMPRESA CONCEDENTE responsável por sua implementação e acompanhamento.
Cláusula 23ª - O presente instrumento poderá ser renovado na forma da Lei e denunciado a qualquer tempo mediante comunicação escrita, pela INSTITUIÇÃO DE ENSINO, pela EMPRESA CONCEDENTE ou pelo ESTAGIÁRIO.

As partes por estarem de acordo quanto ao cumprimento dos termos mutuamente firmados, assinam o presente em 4 (quatro) vias de igual teor e conteúdo.

São Paulo, ${formatLongDate(ctx.data.document_date || start)}.

______________________________
EMPRESA CONCEDENTE

______________________________
INSTITUIÇÃO DE ENSINO

______________________________
ESTAGIÁRIO(A)
${guardianSignature}
______________________________
AGENTE DE INTEGRAÇÃO`;
}

export function buildRaText(ctx: InternshipContext, period: RaPeriod) {
  const activities = text(
    ctx.data.activities || (ctx.opening?.activities || []).join("; "),
    "________________"
  );
  const ordinal = period.number === 1 ? "1º" : `${period.number}º`;

  return `${ordinal} RELATÓRIO DE ACOMPANHAMENTO DE ESTÁGIO

Este RELATÓRIO DE ACOMPANHAMENTO DE ESTÁGIO é parte integrante do TERMO DE COMPROMISSO DE ESTÁGIO e tem por objetivo acompanhar, supervisionar e avaliar o andamento do estágio conforme Lei 11.788/08 Capítulo III da parte Concedente artigo 9-VII e Capítulo II da instituição de Ensino Artigo 7-IV.

${institutionBlock(ctx)}

${AGENT_BLOCK}

${companyBlock(ctx)}

${candidateBlock(ctx)}

DADOS DO ESTÁGIO
Supervisor de Estágio: ${text(ctx.data.supervisor_name, "________________")}
Cargo: ${text(ctx.data.supervisor_role, "________________")}
Formação: ${text(ctx.data.supervisor_education, "________________")}
E-mail: ${text(ctx.data.supervisor_email, "________________")}
Período do Estágio: ${formatDate(internshipStart(ctx))} à ${formatDate(cappedEnd(ctx, internshipEnd(ctx)))}
Período do Relatório: ${formatDate(period.start)} a ${formatDate(period.end)}
Carga Horária: ${text(ctx.data.weekly_hours, "________________")} horas semanais
Horário do Estágio: ${text(ctx.data.work_schedule || ctx.opening?.work_schedule, "________________")}${ctx.data.break_time || ctx.opening?.break_time ? `, com ${text(ctx.data.break_time || ctx.opening?.break_time)} de intervalo.` : "."}
Curso: ${text(ctx.data.course_name || ctx.candidate?.course, "________________")}
Nível: ${text(ctx.data.education_level || ctx.candidate?.education, "________________")}
Tipo de Estágio: [ ] Obrigatório   [ ] Não Obrigatório

1. ATIVIDADES DESENVOLVIDAS
Preenchimento de responsabilidade do aluno(a).

Durante o período de estágio, foram desenvolvidas atividades que proporcionaram a aplicação prática dos conhecimentos adquiridos ao longo do curso, contribuindo para o desenvolvimento profissional da estudante.

${activities
  .split(/\n|;/)
  .map((item: string) => item.trim())
  .filter(Boolean)
  .map((item: string) => `- ${item}`)
  .join("\n")}

Outras atividades desenvolvidas pelo aluno:
________________________________________________________________________________
________________________________________________________________________________
________________________________________________________________________________

ASSINATURA DO(A) ALUNO(A)
Nome: ${candidateName(ctx)}
Assinatura: _________________________________________________________________

2. AVALIAÇÃO DO AMBIENTE DA EMPRESA
Preenchimento de responsabilidade do aluno.

Aspecto avaliado: Excelente | Bom | Regular | Insatisfatório
Ambiente físico de trabalho: [ ] [ ] [ ] [ ]
Relacionamento com a equipe: [ ] [ ] [ ] [ ]
Relacionamento com o supervisor: [ ] [ ] [ ] [ ]
Organização do ambiente: [ ] [ ] [ ] [ ]
Orientação recebida durante o estágio: [ ] [ ] [ ] [ ]
Compatibilidade das atividades com o curso: [ ] [ ] [ ] [ ]
Oportunidade de aprendizagem: [ ] [ ] [ ] [ ]
Condições para realização das atividades: [ ] [ ] [ ] [ ]

Considerações do aluno sobre o ambiente de estágio:
________________________________________________________________________________
________________________________________________________________________________
________________________________________________________________________________

ASSINATURA DO(A) ALUNO(A)
Nome: ${candidateName(ctx)}
Assinatura: _________________________________________________________________

3. AVALIAÇÃO DO DESEMPENHO DO ESTAGIÁRIO
Preenchimento de responsabilidade da empresa concedente.

Aspecto avaliado: Excelente | Bom | Regular | Insatisfatório
Assiduidade: [ ] [ ] [ ] [ ]
Pontualidade: [ ] [ ] [ ] [ ]
Responsabilidade: [ ] [ ] [ ] [ ]
Comprometimento: [ ] [ ] [ ] [ ]
Organização: [ ] [ ] [ ] [ ]
Relacionamento interpessoal: [ ] [ ] [ ] [ ]
Comunicação: [ ] [ ] [ ] [ ]
Iniciativa: [ ] [ ] [ ] [ ]
Capacidade de aprendizagem: [ ] [ ] [ ] [ ]
Execução das atividades: [ ] [ ] [ ] [ ]
Aplicação dos conhecimentos: [ ] [ ] [ ] [ ]

Considerações do supervisor sobre o desempenho do estagiário:
________________________________________________________________________________
________________________________________________________________________________
________________________________________________________________________________

ASSINATURA DO(A) SUPERVISOR(A)
Supervisor de Estágio: ${text(ctx.data.supervisor_name, "________________")}
Cargo: ${text(ctx.data.supervisor_role, "________________")}
Assinatura: _________________________________________________________________

Declaram as partes que as informações constantes neste RELATÓRIO DE ACOMPANHAMENTO DE ESTÁGIO correspondem às atividades e condições efetivamente desenvolvidas durante o período de estágio.

São Paulo, ${formatLongDate(period.end)}.

________________________
ESTAGIÁRIO(A)

________________________
SUPERVISOR DE ESTÁGIO

________________________
EMPRESA CONCEDENTE

________________________
INSTITUIÇÃO DE ENSINO

________________________
AGENTE DE INTEGRAÇÃO`;
}

export function buildAdtText(ctx: InternshipContext) {
  const originalStart = internshipStart(ctx);
  const originalEnd = internshipEnd(ctx);
  const extensionStart = ctx.data.extension_start || "";
  const extensionEnd = cappedEnd(ctx, ctx.data.extension_end || "");

  return `Aditivo ao Instrumento Jurídico de Termo de Compromisso de Estágio

Pelo presente Aditivo ao Instrumento Jurídico de Termo de Compromisso de Estágio, as partes a seguir qualificadas:

${institutionBlock(ctx)}

${AGENT_BLOCK}

${companyBlock(ctx)}

${candidateBlock(ctx)}

Sendo as partes devidamente qualificadas no ADITIVO AO INSTRUMENTO JURÍDICO DE TERMO DE COMPROMISSO DE ESTÁGIO, resolvem, de comum acordo, PRORROGAR o contrato de estágio a partir desta data, permanecendo inalteradas as demais cláusulas e condições anteriormente estabelecidas, salvo aquelas expressamente modificadas por este aditivo até ${formatDate(extensionStart)} a ${formatDate(extensionEnd)}.

A empresa declara, ainda, que a vigência do presente contrato de estágio Nº ${text(ctx.data.contract_number, "________")}, teve início em ${formatDate(originalStart)} a ${formatDate(originalEnd)}.

São Paulo, ${formatLongDate(ctx.data.document_date || extensionStart || new Date())}.

_____________________________
EMPRESA CONCEDENTE

_____________________________
INSTITUIÇÃO DE ENSINO

_____________________________
COORDENADOR DE CURSO

_____________________________
ESTAGIÁRIO(A)

_____________________________
AGENTE DE INTEGRAÇÃO`;
}

export function buildDttText(ctx: InternshipContext) {
  const terminationDate = ctx.data.termination_date || new Date();
  const activities = text(
    ctx.data.activities || (ctx.opening?.activities || []).join("; "),
    "________________"
  );
  const guardianSignature = isHigherEducation(ctx)
    ? ""
    : `
_______________________________
RESPONSÁVEL (QUANDO MENOR)`;

  return `RESCISÃO DE ACORDO DE COOPERAÇÃO E TERMO DE COMPROMISSO DE ESTÁGIO

Tem esta finalidade de comunicar a V.Sa. Que estamos finalizando o ACORDO DE COOPERAÇÃO E TERMO DE COMPROMISSO DE ESTÁGIO no dia ${formatDate(terminationDate)}, por solicitação ${text(ctx.data.termination_requested_by, "empresa concedente")}, o mesmo sendo firmado dia ${formatDate(internshipStart(ctx))} com o estudante ${candidateName(ctx)}, qual exercia as seguintes atividades:
${activities}

Por ser verdade, firmamos o presente em 04 (quatro) vias de igual teor e um só efeito.

Empresa concedente: ${companyName(ctx)}
Agente de Integração: Motivar RH Eireli – ME

São Paulo, ${formatLongDate(terminationDate)}

_______________________________
EMPRESA CONCEDENTE

_______________________________
AGENTE DE INTEGRAÇÃO

_______________________________
ESTAGIÁRIO(A)
${guardianSignature}`;
}

export function buildJourneyDeclarationText(ctx: InternshipContext) {
  return `DECLARAÇÃO DE JORNADA DE ESTÁGIO

DECLARAMOS, para os devidos fins, que o(a) aluno(a) ${candidateName(ctx)}, inscrito(a) no CPF sob o nº ${text(ctx.data.candidate_cpf || ctx.candidate?.cpf, "________________")}, encontra-se atualmente realizando estágio na empresa concedente ${companyName(ctx)}, por intermédio do Agente de Integração MOTIVAR RH EIRELI - ME.

O(A) estagiário(a) iniciou suas atividades em ${formatDate(internshipStart(ctx))}, cumprindo jornada de estágio:
${text(ctx.data.work_schedule || ctx.opening?.work_schedule, "________________")}${ctx.data.break_time || ctx.opening?.break_time ? `, com ${text(ctx.data.break_time || ctx.opening?.break_time)} de intervalo.` : "."}

E por ser verdade, firmamos o presente.

São Paulo, ${formatLongDate(ctx.data.document_date || new Date())}.

________________________________
AGENTE DE INTEGRAÇÃO`;
}

export function buildAgreementText(ctx: InternshipContext) {
  return `ACORDO DE COOPERAÇÃO PARA CONCESSÃO DE ESTÁGIO

Instrumento jurídico previsto no artigo 5º da Lei nº 11.788, de 25 de setembro de 2008.

A ${text(ctx.data.institution_name, "INSTITUIÇÃO DE ENSINO")}, inscrita no CNPJ sob o nº ${text(ctx.data.institution_cnpj, "________________")}, com sede na ${text(ctx.data.institution_address, "________________")}, ${text(ctx.data.institution_city, "________________")}/${text(ctx.data.institution_state, "__")}, CEP ${text(ctx.data.institution_zip, "________________")}, neste ato representada por seu representante legal, doravante denominada simplesmente INSTITUIÇÃO DE ENSINO, e a MOTIVAR RH EIRELI – ME, também denominada Grupo Motivar RH, inscrita no CNPJ sob o nº 11.333.607/0001-00, com sede na Rua Sete de Abril, nº 296, 12º andar, sala 121, Bairro República, São Paulo/SP, CEP 01044-000, neste ato representada por sua Diretora, Cícera Angélica de Andrade Januário, resolvem celebrar o presente ACORDO DE COOPERAÇÃO PARA CONCESSÃO DE ESTÁGIO, nos termos do artigo 5º da Lei nº 11.788/2008, mediante as cláusulas e condições a seguir estabelecidas.

CLÁUSULA 1ª – O presente Acordo de Cooperação de Estágio tem por objetivo desenvolver ações conjuntas para programar programas de estágio de estudantes, de caráter compulsório ou facultativo, cumprido durante o curso e apto a proporcionar ao estudante treinamento prático em sua formação específica ou ensino médio regular, em reais situações do cotidiano, em conformidade com a Lei nº 11.788/2008.

CLÁUSULA 2ª – A AGENTE DE INTEGRAÇÃO fica autorizada a prestar serviços para as empresas e instituições de ensino, auxiliando no processo de aperfeiçoamento do estágio em todos os procedimentos a que se refere o § 1º do Art. 5º da Lei nº 11.788/2008.

CLÁUSULA 3ª – A AGENTE DE INTEGRAÇÃO se incumbirá de:
a) Manter acordo de cooperação de estágio com instituições de ensino, dos quais constem as condições requeridas para caracterizar e definir os estágios de seus alunos;
b) Buscar, junto às Empresas Concedentes, a identificação de seus programas e oportunidades de estágio;
c) Ajustar as exigências e condições de estágio fixadas pela INSTITUIÇÃO DE ENSINO às disponibilidades de trabalho oferecidas pelas Empresas Concedentes, que devem ser compatíveis com a profissão à qual o curso se destina;
d) Selecionar os interessados na realização do estágio, encaminhando-os às Empresas Concedentes;
e) Preparar todos os documentos exigidos para os estágios, especialmente:
Termo de Compromisso de Estágio entre a Empresa Concedente e o Estudante, com interveniência das Instituições de Ensino, em atenção ao disposto no inciso I do Art. 7º da Lei nº 11.788/2008;
Contratação de seguro contra acidentes pessoais em benefício dos estagiários, nos termos do Art. 5º, inciso IV, da Lei nº 11.788/2008;
f) Acompanhar o desenvolvimento do estágio perante a Empresa Concedente, transmitindo à INSTITUIÇÃO DE ENSINO as informações cabíveis;
g) Comunicar à Empresa Concedente eventuais irregularidades ocorridas na vida escolar do estagiário;
h) Cadastrar os estudantes em nossos bancos de dados, de acesso restrito à AGENTE DE INTEGRAÇÃO;
i) Elaborar, em 4 (quatro) vias, o plano de atividades do estagiário, de acordo com as 4 (quatro) partes envolvidas, que será incorporado ao Termo de Compromisso de Estágio por meio de aditivos, à medida que for avaliado, progressivamente, o desempenho do estudante.

CLÁUSULA 4ª – As ações da AGENTE DE INTEGRAÇÃO previstas neste Acordo de Cooperação não implicarão em quaisquer ônus para a INSTITUIÇÃO DE ENSINO, nem para seus alunos que vierem a se beneficiar de tais ações.

CLÁUSULA 5ª – Caberá à INSTITUIÇÃO DE ENSINO:
a) Proporcionar condições que facilitem e agilizem a inclusão de seus estudantes no cadastro de candidatos da AGENTE DE INTEGRAÇÃO;
b) Divulgar, junto aos seus estudantes, as oportunidades de estágio captadas pela AGENTE DE INTEGRAÇÃO;
c) Assinar os Termos de Compromisso de Estágio que vierem a ser celebrados entre Estudantes e Empresas Concedentes, somente para os cursos com estágio não obrigatório, quando solicitado;
d) Confirmar a situação escolar dos estagiários, quando solicitado;
e) Indicar professor orientador, da área a ser desenvolvida no estágio, como responsável pelo acompanhamento e avaliação das atividades do estagiário;
f) Exigir do educando a apresentação periódica, em prazo não superior a 6 (seis) meses, de relatórios das atividades;
g) Elaborar normas complementares e instrumentos de avaliação dos estágios de seus educandos;
h) Comunicar à Empresa Concedente, no início do período letivo, as datas de realização das avaliações escolares ou acadêmicas.

CLÁUSULA 6ª – O presente Acordo de Cooperação de Estágio terá vigência por prazo indeterminado, podendo ser denunciado por uma das partes, mediante comunicado por escrito, com antecedência mínima de 30 (trinta) dias.

As partes elegem o Foro Central da Comarca da Capital de São Paulo para solução de dúvidas ou litígios porventura decorrentes deste contrato, com expressa renúncia de qualquer outro, por mais privilegiado que seja.

E, por estarem assim concordes, assinam o presente Acordo de Cooperação de Estágio em 2 (duas) vias de igual teor.

São Paulo, ${formatLongDate(ctx.data.document_date || new Date())}.

_______________________________________
${text(ctx.data.institution_name, "INSTITUIÇÃO DE ENSINO")}
Representante Legal

_______________________________________
MOTIVAR RH EIRELI – ME
Cícera Angélica Andrade Januário
Diretora`;
}

export function buildClientInternshipServiceContractText(
  client: any,
  data: Record<string, any>
) {
  const clientName = text(
    data.client_name || client?.company_name || client?.restaurant_name,
    "______________"
  );
  const clientCnpj = text(
    data.client_cnpj || client?.cnpj || client?.document,
    "___________"
  );
  const clientAddress =
    text(data.client_address) ||
    [
      text(client?.address),
      text(client?.city),
      text(client?.state),
      client?.cep ? `CEP ${client.cep}` : "",
    ].filter(Boolean).join(", ") ||
    "__________";
  const fee = money(data.honorarium_amount) || "_____";
  const paymentDay = text(data.payment_day, "____");
  const contractDate = data.contract_date || new Date();

  return `CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE RECRUTAMENTO, SELEÇÃO E GESTÃO DE ESTÁGIO ENSINO MÉDIO, ENSINO TÉCNICO E ENSINO SUPERIOR

Pelo presente instrumento particular, de um lado:

CONTRATADA
MOTIVAR RH LTDA., pessoa jurídica de direito privado, inscrita no CNPJ/MF sob o nº 11.333.607/0001-00, com sede no endereço Rua Conselheiro Crispiniano, nº 69, 12º Andar, Conj. 121 b, Bairro República, São Paulo – SP, CEP 01037-000, neste ato representada na forma de seu contrato social.

CONTRATANTE
${clientName}, pessoa jurídica de direito privado, inscrita no CNPJ/MF sob o nº ${clientCnpj}, com sede na ${clientAddress}, neste ato representada por seu representante legal infra-assinado.

As partes acima identificadas têm, entre si, justo e contratado o presente Contrato de Prestação de Serviços, que se regerá pelas cláusulas e condições a seguir:

CLÁUSULA 1° — DO OBJETO, DA FORMALIZAÇÃO E DOS PRAZOS

i. Objeto: O presente contrato tem por objeto a prestação de serviços de Recrutamento, Seleção e Gestão Contratual pela CONTRATADA em favor da CONTRATANTE, focado exclusivamente no preenchimento de vagas de estágio para estudantes do Ensino Médio, Ensino Técnico e Ensino Superior (Graduação e Tecnólogo). O serviço inclui também o fornecimento do Seguro contra Acidentes Pessoais para o estagiário aprovado.

ii. Ficha de Abertura de Vagas: A execução dos serviços para cada nova oportunidade será formalizada e iniciada exclusivamente por meio do preenchimento e aprovação de um documento anexo denominado "Ficha de Abertura de Vagas". Este documento funcionará como um aditivo a este contrato para cada processo, contendo o alinhamento de perfil, semestre, curso exigido, atividades e requisitos específicos.

iii. Prazos de Atendimento (SLA): Os prazos para recrutamento, seleção e envio de candidatos serão estipulados de forma rigorosa e exclusiva na respectiva "Ficha de Abertura de Vagas". A MOTIVAR RH não acatará nem se responsabilizará por exigências de urgência que reduzam os prazos acordados, visando resguardar a qualidade técnica do processo seletivo e o cumprimento dos trâmites legais junto às Universidades.

CLÁUSULA 2° — DA FORMALIZAÇÃO DO ESTÁGIO E COLETA DE ASSINATURAS

i. Exigência Legal: As partes declaram ciência de que a validade do Termo de Compromisso de Estágio (TCE) e do Plano de Atividades exige, obrigatoriamente, a assinatura do(a) estudante e, exclusivamente no caso de menor de idade, de seus representantes legais, da Instituição de Ensino Superior (IES) ou da instituição de ensino responsável pela assinatura, bem como da empresa concedente.

ii. Responsabilidade e Atrasos de Terceiros: A MOTIVAR RH assume a responsabilidade operacional de intermediar, solicitar e recolher as assinaturas do candidato e da Instituição de Ensino, por meio do sistema próprio disponibilizado pela Instituição de Ensino, quando houver acesso para empresas e agentes de integração. Caso a Instituição de Ensino não disponibilize esse acesso, será de responsabilidade do(a) estagiário(a) providenciar o recolhimento da assinatura da Instituição de Ensino Superior, garantindo a formalização do Termo de Compromisso de Estágio. Contudo, fica expressamente estabelecido que a MOTIVAR RH não poderá ser responsabilizada por atrasos na formalização decorrentes dos prazos internos, portais acadêmicos ou morosidade burocrática das Instituições de Ensino (Universidades, Faculdades e Instituições de Ensino), nem pela falta de agilidade do candidato no envio de seus dados.

iii. Origem do Candidato e Envio de Dados:
a) Processo Integral Motivar RH: Quando o processo for realizado integralmente pela MOTIVAR RH, esta utilizará os contatos já captados para conduzir os trâmites.
b) Candidato Indicado pelo Cliente: Caso a CONTRATANTE encaminhe um candidato para a gestão contratual, é de sua inteira responsabilidade enviar imediatamente os dados de contato do estudante.

iv. Ausência de Envio de Dados pelo Candidato: Caso o candidato aprovado não envie a documentação ou assinaturas necessárias no prazo estipulado, a MOTIVAR RH emitirá uma notificação formal à CONTRATANTE. Persistindo a pendência, o processo de contratação daquele indivíduo será encerrado e será ativado o Protocolo de Reposição, isentando a assessoria de qualquer responsabilidade pela perda do candidato.

CLÁUSULA 3° — DAS DECLARAÇÕES, RESPONSABILIDADES E LEI DO ESTÁGIO

i. Ciência e Orientação sobre a Legislação: A MOTIVAR RH compromete-se a orientar a CONTRATANTE acerca das normas da Lei nº 11.788/2008. Contudo, a execução prática (controle de carga horária compatível com as aulas da Universidades, Faculdades e Instituições de Ensino, recesso etc.) permanece sob responsabilidade exclusiva da CONTRATANTE.

ii. Seguro Contra Acidentes Pessoais: A MOTIVAR RH será responsável por contratar e manter o Seguro contra Acidentes Pessoais em nome do estagiário.

iii. Início legal e Isenção de Passivos: A CONTRATANTE reconhece sua exclusiva responsabilidade em assinar o TCE. É terminantemente proibido o início das atividades do estagiário antes da conclusão de todas as assinaturas (incluindo a via deferida pelas Universidades, Faculdades e Instituições de Ensino). Caso a CONTRATANTE permita o início antecipado, a MOTIVAR RH ficará isenta de qualquer responsabilidade, não assumindo custos, multas, sanções ou passivos trabalhistas em caso de fiscalização.

CLÁUSULA 4° — DA EXECUÇÃO, CONTROLE DE CANDIDATOS E DESISTÊNCIA

i. Exclusividade e Proteção da Base: Todos os estudantes apresentados pela CONTRATADA à CONTRATANTE passam a integrar a base sob controle da MOTIVAR RH por um período de 12 (doze) meses.

ii. Contratação Direta ou Tardia: Caso a CONTRATANTE venha a aprovar, contratar como estagiário ou efetivar (como CLT ou PJ) qualquer estudante apresentado pela CONTRATADA no prazo de 12 meses — mesmo que para área diversa ou em data posterior ao processo seletivo —, ficará obrigada a efetuar o pagamento integral dos honorários.

iii. Taxa de Desistência/Cancelamento: Caso a CONTRATANTE solicite o cancelamento da vaga, a suspenda por mais de 15 (quinze) dias, ou decida não a preencher após o início das buscas ou apresentação de candidatos pela MOTIVAR RH, incidirá multa compensatória equivalente a 50% (cinquenta por cento) do valor dos honorários contratados para a respectiva vaga, visando cobrir os custos operacionais despendidos.

CLÁUSULA 5° — DA REMUNERAÇÃO

i. Honorários e Inclusão do Seguro: A CONTRATANTE pagará à CONTRATADA o valor de R$ ${fee} por estagiário(a) ativo(a).

ii. Controle de Ativos e Faturamento: A MOTIVAR RH emitirá cobrança baseada no relatório de estagiários ativos. É obrigação da CONTRATANTE notificar oficial e imediatamente a assessoria sobre qualquer desligamento. Na ausência de notificação, o faturamento seguirá o último relatório ativo, não havendo devolução ou estorno retroativo de valores faturados e cobrados.

iii. Condições de Pagamento: O pagamento será efetuado no dia ${paymentDay} de cada mês, após a aprovação do estagiário e/ou o envio da cobrança.

iv. Penalidades por Inadimplemento: O atraso sujeitará a CONTRATANTE a multa de 2%, juros de mora de 1% ao mês, correção monetária e perda do direito à garantia de reposição.

v. Suspensão dos Serviços: O atraso no pagamento superior a 10 (dez) dias corridos carretará a suspensão de todos os serviços. Para evitar prejuízos operacionais abruptos, a MOTIVAR RH enviará uma notificação prévia 48 horas antes do bloqueio efetivo. A partir da suspensão, fica proibido o envio de candidatos e paralisada a gestão de novas assinaturas até a quitação dos débitos.

CLÁUSULA 6° — DA GARANTIA E DO PROTOCOLO DE REPOSIÇÃO

i. Prazo de Garantia: A CONTRATADA concede garantia de reposição do estagiário pelo prazo exato de 30 dias corridos, contados a partir da data do início efetivo do estágio.

ii. Condições Rigorosas para Acionamento: A reposição gratuita ocorrerá desde que:
a) O desligamento (ou desistência) ocorra dentro do prazo fixado no item i, sendo formalmente comunicado à MOTIVAR RH no prazo máximo e improrrogável de 48 horas úteis;
b) O perfil da vaga e os requisitos permaneçam idênticos ao da "Ficha de Abertura de Vagas". Qualquer alteração no perfil, por menor que seja, configurará nova vaga e ensejará a cobrança de novos honorários.

CLÁUSULA 7° — LGPD E CONFIDENCIALIDADE

i. As partes atestam conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018). Os dados não poderão ser utilizados para outros fins.

CLÁUSULA 8° — VIGÊNCIA, RESCISÃO E FORO

i. Vigência: Este contrato vigora por 12 (doze) meses a partir da assinatura.

ii. Rescisão: Poderá ser rescindido mediante aviso prévio de 30 (trinta) dias por escrito, com pagamento proporcional dos estagiários ativos e processos em andamento.

iii. Foro: Elege-se o Foro da Comarca de São Paulo, SP.

São Paulo, ${formatLongDate(contractDate)}.

____________________________
MOTIVAR RH LTDA.
CONTRATADA

____________________________
${clientName}
CONTRATANTE`;
}
