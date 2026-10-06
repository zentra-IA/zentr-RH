export type RhContractType =
  | "CLT"
  | "ESTAGIO_MEDIO_TECNICO"
  | "ESTAGIO_SUPERIOR";

export type DocumentOpening = {
  id: string;
  contract_type: RhContractType;
  position: string;
  quantity: number;
  department?: string | null;
  request_responsible?: string | null;
  direct_manager?: string | null;
  work_mode?: string | null;
  workplace_address?: string | null;
  work_schedule?: string | null;
  break_time?: string | null;
  remuneration?: number | null;
  transport_benefit?: string | null;
  meal_benefit?: string | null;
  life_insurance?: boolean | null;
  other_benefits?: string | null;
  education_required?: string | null;
  courses?: string | null;
  required_skills?: string | null;
  desired_skills?: string | null;
  soft_skills?: string | null;
  activities?: string[];
  sla_first_candidates?: string | null;
  sla_interviews?: string | null;
  sla_closing?: string | null;
  honorarium_text?: string | null;
  honorarium_amount?: number | null;
  honorarium_words?: string | null;
  payment_days?: number | null;
  suspension_days?: number | null;
  guarantee_days?: number | null;
  forum_city?: string | null;
  forum_state?: string | null;
  created_at?: Date | string;
};

export type DocumentClient = {
  company_name?: string | null;
  restaurant_name?: string | null;
  cnpj?: string | null;
  document?: string | null;
  responsible_name?: string | null;
  owner_name?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  cep?: string | null;
};

const CONTRACT_CLT = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE RECRUTAMENTO E SELEÇÃO (VAGAS CLT)

Pelo presente instrumento particular, de um lado:
CONTRATADA: MOTIVAR RH LTDA., pessoa jurídica de direito privado, inscrita no CNPJ/MF sob o nº [Inserir CNPJ], com sede na [Inserir Endereço Completo], neste ato representada na forma de seu contrato social.
CONTRATANTE: [RAZÃO SOCIAL DO CLIENTE], pessoa jurídica de direito privado, inscrita no CNPJ/MF sob o nº [CNPJ do Cliente], com sede na [Endereço Completo do Cliente], neste ato representada por seu representante legal infra-assinado.
As partes acima identificadas têm, entre si, justo e contratado o presente Contrato de Prestação de Serviços, que se regerá pelas cláusulas e condições a seguir:

CLÁUSULA PRIMEIRA — DO OBJETO E DA FORMALIZAÇÃO 
1.1. Objeto: O presente contrato tem por objeto a prestação de serviços especializados de Recrutamento e Seleção (Hunting) pela CONTRATADA em favor da CONTRATANTE, focado exclusivamente no preenchimento de vagas efetivas sob o regime da Consolidação das Leis do Trabalho (CLT). 
1.2. Ficha de Abertura de Vagas: A execução dos serviços para cada nova oportunidade será formalizada e iniciada exclusivamente por meio do preenchimento e aprovação de um documento anexo denominado "Ficha de Abertura de Vagas". Este documento funcionará como um aditivo a este contrato para cada processo, contendo o alinhamento de perfil, atividades, pacote de remuneração e prazos (SLA) exigidos pela CONTRATANTE. 
1.3. Exclusão de Serviços de Departamento Pessoal: Fica expressamente acordado que o escopo deste contrato se limita à atração, triagem, avaliação e encaminhamento de candidatos aprovados. Não estão inclusos serviços rotineiros de Departamento Pessoal (DP), tais como: recolhimento de documentos admissionais, agendamento de exames médicos (ASO), registros no e-Social, anotações na CTPS, gestão de benefícios ou elaboração de folha de pagamento.

CLÁUSULA SEGUNDA — DA EXECUÇÃO E DO CONTROLE DE CANDIDATOS 
2.1. Exclusividade e Proteção da Base: Todos os profissionais apresentados pela CONTRATADA à CONTRATANTE (via currículo, relatório, entrevista, etc.) passam a integrar a base sob controle da MOTIVAR RH por um período de 12 (doze) meses a contar da data da apresentação. 
2.2. Contratação Direta ou Tardia: Caso a CONTRATANTE, suas coligadas ou parceiras venham a contratar qualquer candidato apresentado pela CONTRATADA no prazo de 12 meses — ainda que para cargo, setor ou unidade diversa do processo original, ou sob outro regime de contratação (ex: PJ) —, a CONTRATANTE ficará obrigada a efetuar o pagamento integral dos honorários de recrutamento estabelecidos neste contrato.

CLÁUSULA TERCEIRA — DAS RESPONSABILIDADES TRABALHISTAS E ISENÇÃO DA CONTRATADA 
3.1. Vínculo Empregatício: O candidato aprovado será contratado diretamente pela CONTRATANTE, não existindo qualquer vínculo empregatício, societário ou de subordinação entre o profissional selecionado e a MOTIVAR RH. 
3.2. Obrigações Legais da CONTRATANTE: É de inteira, única e exclusiva responsabilidade da CONTRATANTE conduzir o processo de admissão legal do candidato aprovado, arcando com todos os custos de exames admissionais, recolhimento de documentação, assinatura do contrato de trabalho e registro na Carteira de Trabalho e Previdência Social (CTPS) antes do início das atividades. 
3.3. Isenção de Passivos: A MOTIVAR RH fica expressamente isenta de qualquer responsabilidade solidária ou subsidiária por eventuais reclamações trabalhistas, passivos, multas de fiscalização, acidentes de trabalho ou descumprimento de normas coletivas (Convenções de Sindicatos) que envolvam o profissional contratado pela CONTRATANTE.

CLÁUSULA QUARTA — DO CANCELAMENTO, SUSPENSÃO E TAXA DE DESISTÊNCIA 
4.1. Taxa de Desistência: O serviço de inteligência, atração e triagem é iniciado imediatamente após a aprovação da Ficha de Abertura. Caso a CONTRATANTE solicite o cancelamento da vaga, a suspenda por mais de 15 (quinze) dias corridos, ou decida não preenchê-la por motivos internos, mudança de diretriz ou reestruturação, incidirá uma multa compensatória no valor equivalente a 50% (cinquenta por cento) do valor total dos honorários contratados para a referida vaga. 
4.2. Atrasos Imotivados: O cancelamento de entrevistas já agendadas com os candidatos, sem aviso prévio mínimo de 24 (vinte e quatro) horas, prejudica a imagem da vaga e da assessoria, podendo acarretar o encerramento do processo seletivo a critério da contratada, com a devida cobrança da taxa prevista no item 4.1.



CLÁUSULA QUINTA — DA REMUNERAÇÃO E INADIMPLÊNCIA 
5.1. Honorários: Pelos serviços prestados, a CONTRATANTE pagará à CONTRATADA a quantia correspondente a [Percentual, ex: 100% do primeiro salário bruto CLT / ou Valor Fixo de R$ X.XXX,XX] por vaga fechada (candidato aprovado pelo cliente), conforme detalhado na Ficha de Abertura.
5.2. Condições de Pagamento: O pagamento será efetuado em até [ex: 5 (cinco)] dias úteis após a aprovação formal do candidato por parte da CONTRATANTE, mediante emissão da respectiva Nota Fiscal.
5.3. Penalidades por Inadimplemento: O atraso no pagamento sujeitará a CONTRATANTE ao pagamento de:
Multa de 2% (dois por cento) sobre o valor total em atraso;
Juros de mora de 1% (um por cento) ao mês, calculados pro rata die;
Correção monetária pelo índice IGPM/FGV acumulado no período;
Perda automática e irrevogável do direito à garantia de reposição (Cláusula Sexta).
5.4. Suspensão dos Serviços por Inadimplência: O atraso no pagamento superior a [ex: 10 (dez)] dias corridos acarretará a suspensão imediata de todos os processos seletivos em andamento. Fica expressamente bloqueado o envio de novos candidatos e a abertura de novas vagas até a regularização total das pendências financeiras.

CLÁUSULA SEXTA — DA GARANTIA DE REPOSIÇÃO
6.1. Prazo de Garantia: A CONTRATADA concede garantia de reposição do profissional pelo prazo de [ex: 45 ou 90] dias corridos, contados a partir da data de admissão e início efetivo das atividades. 
6.2. Condições Rigorosas para Acionamento: Se o profissional pedir demissão, não se adaptar ou for desligado por iniciativa da CONTRATANTE no período de garantia, a MOTIVAR RH fará um novo recrutamento (1 única vez) sem custo adicional de honorários, desde que, cumulativamente:
a) A CONTRATANTE esteja rigorosamente em dia com todos os pagamentos;
b) O desligamento seja formalmente comunicado à MOTIVAR RH em até 48 (quarenta e oito) horas úteis após o ocorrido;
c) O perfil da vaga, pacote de remuneração, horário e requisitos (descritos na Ficha de Abertura) não sofram nenhuma alteração. Qualquer mudança no perfil ou nas condições de trabalho anula a garantia e configura a abertura de uma nova vaga, sujeita a nova cobrança integral.


CLÁUSULA SÉTIMA — LGPD E CONFIDENCIALIDADE 
7.1. Cumprimento da LGPD: Ambas as partes declaram cumprir as disposições da Lei Geral de Proteção de Dados (Lei nº 13.709/2018). A CONTRATANTE compromete-se a utilizar os dados e currículos dos candidatos exclusivamente para os fins de avaliação da vaga acordada, sendo expressamente vedado o armazenamento para uso futuro sem autorização ou o repasse a terceiros.

CLÁUSULA OITAVA — VIGÊNCIA, RESCISÃO E FORO 
8.1. Vigência: Este contrato entra em vigor na data de sua assinatura e vigorará pelo prazo de 12 (doze) meses, renovando-se automaticamente por iguais períodos, salvo manifestação em contrário. 
8.2. Rescisão Imotivada: Qualquer das partes poderá rescindir este contrato a qualquer tempo, mediante aviso prévio por escrito de 30 (trinta) dias, garantindo-se o pagamento integral dos honorários relativos aos processos já concluídos, em andamento, ou taxas de desistência aplicáveis.
 8.3. Foro: Para dirimir quaisquer controvérsias oriundas do presente contrato, as partes elegem o Foro da Comarca de [Inserir Cidade/UF].
E, por estarem assim justos e contratados, assinam o presente instrumento em 2 (duas) vias de igual teor.
[Cidade/UF], [Dia] de [Mês] de [Ano].

__________________________________________________________________
MOTIVAR RH LTDA. CONTRATADA

__________________________________________________________________
[NOME DA EMPRESA CLIENTE] CONTRATANTE
`;
const CONTRACT_ESTAGIO_MEDIO = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE RECRUTAMENTO, SELEÇÃO E GESTÃO DE ESTÁGIO ENSINO MÉDIO E ENSINO MÉDIO TÉCNICO
Pelo presente instrumento particular, de um lado:
CONTRATADA: MOTIVAR RH LTDA., pessoa jurídica de direito privado, inscrita no CNPJ/MF sob o nº [Inserir CNPJ], com sede na [Inserir Endereço Completo], neste ato representada na forma de seu contrato social.
CONTRATANTE: [RAZÃO SOCIAL DO CLIENTE], pessoa jurídica de direito privado, inscrita no CNPJ/MF sob o nº [CNPJ do Cliente], com sede na [Endereço Completo do Cliente], neste ato representada por seu representante legal infra-assinado.
As partes acima identificadas têm, entre si, justo e contratado o presente Contrato de Prestação de Serviços, que se regerá pelas cláusulas e condições a seguir:

CLÁUSULA PRIMEIRA — DO OBJETO, DA FORMALIZAÇÃO E DOS PRAZOS 
1.1. Objeto: O presente contrato tem por objeto a prestação de serviços de Recrutamento, Seleção e Gestão Contratual pela CONTRATADA em favor da CONTRATANTE, focado exclusivamente no preenchimento de vagas de estágio para o Ensino Médio e Ensino Médio Técnico, envolvendo estudantes menores de idade. O serviço inclui também o fornecimento do Seguro contra Acidentes Pessoais para o estagiário aprovado. 
1.2. Ficha de Abertura de Vagas: A execução dos serviços para cada nova oportunidade será formalizada e iniciada exclusivamente por meio do preenchimento e aprovação de um documento anexo denominado "Ficha de Abertura de Vagas". Este documento funcionará como um aditivo a este contrato para cada processo, contendo o alinhamento de perfil, atividades e requisitos específicos exigidos pela CONTRATANTE. 
1.3. Prazos de Atendimento (SLA): Os prazos para recrutamento, seleção e envio de candidatos serão estipulados de forma rigorosa e exclusiva na respectiva "Ficha de Abertura de Vagas". A MOTIVAR RH não acatará nem se responsabilizará por exigências de urgência que reduzam os prazos acordados, visando resguardar a qualidade técnica do processo seletivo e o cumprimento dos trâmites legais.



CLÁUSULA SEGUNDA — DA FORMALIZAÇÃO DO ESTÁGIO E COLETA DE ASSINATURAS 
2.1. Exigência Legal (Menores de Idade): Por se tratar de contratação envolvendo menores de idade, as partes declaram ciência de que a validade do Termo de Compromisso de Estágio (TCE) e do Plano de Atividades exige, obrigatoriamente, a assinatura do estudante, da Instituição de Ensino, da empresa concedente e dos pais ou responsáveis legais do menor. 
2.2. Responsabilidade e Atrasos de Terceiros: A MOTIVAR RH assume a responsabilidade operacional por intermediar, cobrar e recolher as assinaturas por parte do candidato, responsáveis e Instituição de Ensino. Contudo, fica expressamente estabelecido que a MOTIVAR RH não poderá ser responsabilizada por atrasos na formalização decorrentes da morosidade das Instituições de Ensino ou da falta de agilidade dos candidatos e responsáveis legais. 
2.3. Origem do Candidato e Envio de Dados:
a) Processo Integral Motivar RH: Quando o processo for realizado integralmente pela MOTIVAR RH, esta utilizará os contatos já captados para conduzir os trâmites.
b) Candidato Indicado pelo Cliente: Caso a CONTRATANTE encaminhe um candidato para a gestão contratual, é de sua inteira responsabilidade enviar imediatamente os dados de contato do estudante e de seus responsáveis. 2.4. Ausência de Envio de Dados pelo Candidato: Caso o candidato aprovado (ou responsáveis) não envie a documentação ou assinaturas necessárias no prazo estipulado, a MOTIVAR RH emitirá uma notificação formal à CONTRATANTE. Persistindo a pendência, o processo de contratação daquele indivíduo será encerrado e será ativado o Protocolo de Reposição, isentando a assessoria de qualquer responsabilidade pela perda do candidato.

CLÁUSULA TERCEIRA — DAS DECLARAÇÕES, RESPONSABILIDADES E LEI DO ESTÁGIO 
3.1. Ciência e Orientação sobre a Legislação: A MOTIVAR RH compromete-se a orientar a CONTRATANTE acerca das normas da Lei nº 11.788/2008. Contudo, a execução prática (controle de carga horária máxima, recesso, etc.) permanece sob responsabilidade exclusiva da CONTRATANTE. 
3.2. Seguro Contra Acidentes Pessoais: A MOTIVAR RH será responsável por contratar e manter o Seguro contra Acidentes Pessoais em nome do estagiário. 
3.3. Início Ilegal e Isenção de Passivos: A CONTRATANTE reconhece sua exclusiva responsabilidade em assinar o TCE. É terminantemente proibido o início das atividades do estagiário antes da conclusão de todas as assinaturas. Caso a CONTRATANTE permita o início antecipado, a MOTIVAR RH ficará isenta de qualquer responsabilidade, não assumindo custos, multas, sanções ou passivos trabalhistas em caso de fiscalização.


CLÁUSULA QUARTA — DA EXECUÇÃO, CONTROLE DE CANDIDATOS E DESISTÊNCIA 
4.1. Exclusividade e Proteção da Base: Todos os estudantes apresentados pela CONTRATADA à CONTRATANTE passam a integrar a base sob controle da MOTIVAR RH por um período de 12 (doze) meses. 
4.2. Contratação Direta ou Tardia: Caso a CONTRATANTE venha a aprovar, contratar como estagiário ou efetivar (como Jovem Aprendiz ou CLT) qualquer estudante apresentado pela CONTRATADA no prazo de 12 meses — mesmo que para área diversa ou em data posterior ao processo seletivo —, ficará obrigada a efetuar o pagamento integral dos honorários. 
4.3. Taxa de Desistência/Cancelamento (Aborting Fee): Caso a CONTRATANTE solicite o cancelamento da vaga, a suspenda por mais de 15 (quinze) dias, ou decida não preenchê-la após o início das buscas ou apresentação de candidatos pela MOTIVAR RH, incidirá multa compensatória equivalente a 50% (cinquenta por cento) do valor dos honorários contratados para a respectiva vaga, visando cobrir os custos operacionais despendidos.

CLÁUSULA QUINTA — DA REMUNERAÇÃO, CONTROLE DE ATIVOS E INADIMPLÊNCIA 
5.1. Honorários e Inclusão do Seguro: A CONTRATANTE pagará à CONTRATADA o valor de R$ [Inserir Valor, ex: 800,00] ([Valor por extenso]) por cada vaga fechada. 
5.2. Controle de Ativos e Faturamento: A MOTIVAR RH emitirá cobrança baseada no relatório de estagiários ativos. É obrigação da CONTRATANTE notificar oficial e imediatamente a assessoria sobre qualquer desligamento. Na ausência de notificação, o faturamento seguirá o último relatório ativo, não havendo devolução ou estorno retroativo de valores faturados e cobrados. 
5.3. Condições de Pagamento: O pagamento será efetuado em até [ex: 5 (cinco)] dias úteis após a aprovação do estagiário e/ou envio da cobrança.
 5.4. Penalidades por Inadimplemento: O atraso sujeitará a CONTRATANTE a multa de 2%, juros de mora de 1% ao mês, correção monetária e perda do direito à garantia de reposição. 
5.5. Suspensão dos Serviços: O atraso no pagamento superior a [ex: 10 (dez)] dias corridos acarretará a suspensão de todos os serviços. Para evitar prejuízos operacionais abruptos, a MOTIVAR RH enviará uma notificação prévia 48 horas antes do bloqueio efetivo. A partir da suspensão, fica proibido o envio de candidatos e paralisada a gestão de novas assinaturas até a quitação dos débitos.


CLÁUSULA SEXTA — LGPD E CONFIDENCIALIDADE 
6.1. As partes atestam conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018). Os dados não poderão ser utilizados para outros fins.

CLÁUSULA SÉTIMA— VIGÊNCIA, RESCISÃO E FORO 
7.1. Vigência: Este contrato vigora por 12 (doze) meses a partir da assinatura. 
7.2. Rescisão: Poderá ser rescindido mediante aviso prévio de 30 (trinta) dias por escrito, com pagamento proporcional dos estagiários ativos e processos em andamento. 
7.3. Foro: Elege-se o Foro da Comarca de [Inserir Cidade/UF].
[Cidade/UF], [Dia] de [Mês] de [Ano].

__________________________________________________________________
MOTIVAR RH LTDA. CONTRATADA

__________________________________________________________________
[NOME DA EMPRESA CLIENTE] CONTRATANTE
`;
const CONTRACT_ESTAGIO_SUPERIOR = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE RECRUTAMENTO, SELEÇÃO E GESTÃO DE ESTÁGIO ENSINO SUPERIOR

Pelo presente instrumento particular, de um lado:
CONTRATADA: MOTIVAR RH LTDA., pessoa jurídica de direito privado, inscrita no CNPJ/MF sob o nº [Inserir CNPJ], com sede na [Inserir Endereço Completo], neste ato representada na forma de seu contrato social.
CONTRATANTE: [RAZÃO SOCIAL DO CLIENTE], pessoa jurídica de direito privado, inscrita no CNPJ/MF sob o nº [CNPJ do Cliente], com sede na [Endereço Completo do Cliente], neste ato representada por seu representante legal infra-assinado.
As partes acima identificadas têm, entre si, justo e contratado o presente Contrato de Prestação de Serviços, que se regerá pelas cláusulas e condições a seguir:


CLÁUSULA PRIMEIRA — DO OBJETO, DA FORMALIZAÇÃO E DOS PRAZOS

1.1. Objeto: O presente contrato tem por objeto a prestação de serviços de Recrutamento, Seleção e Gestão Contratual pela CONTRATADA em favor da CONTRATANTE, focado exclusivamente no preenchimento de vagas de estágio para o Ensino Superior (Graduação e Tecnólogo). O serviço inclui também o fornecimento do Seguro contra Acidentes Pessoais para o estagiário aprovado.

1.2. Ficha de Abertura de Vagas: A execução dos serviços para cada nova oportunidade será formalizada e iniciada exclusivamente por meio do preenchimento e aprovação de um documento anexo denominado "Ficha de Abertura de Vagas". Este documento funcionará como um aditivo a este contrato para cada processo, contendo o alinhamento de perfil, semestre, curso exigido, atividades e requisitos específicos.

1.3. Prazos de Atendimento (SLA): Os prazos para recrutamento, seleção e envio de candidatos serão estipulados de forma rigorosa e exclusiva na respectiva "Ficha de Abertura de Vagas". A MOTIVAR RH não acatará nem se responsabilizará por exigências de urgência que reduzam os prazos acordados, visando resguardar a qualidade técnica do processo seletivo e o cumprimento dos trâmites legais junto às Universidades.



CLÁUSULA SEGUNDA — DA FORMALIZAÇÃO DO ESTÁGIO E COLETA DE ASSINATURAS

2.1. Exigência Legal: As partes declaram ciência de que a validade do Termo de Compromisso de Estágio (TCE) e do Plano de Atividades exige, obrigatoriamente, a assinatura do estudante (e de seus representantes legais, exclusiva e unicamente se este for menor de idade), da Instituição de Ensino Superior (IES) e da empresa concedente.
2.2. Responsabilidade e Atrasos de Terceiros (Faculdades): A MOTIVAR RH assume a responsabilidade operacional por intermediar, cobrar e recolher as assinaturas por parte do candidato e da Instituição de Ensino Superior. Contudo, fica expressamente estabelecido que a MOTIVAR RH não poderá ser responsabilizada por atrasos na formalização decorrentes dos prazos internos, portais acadêmicos ou morosidade burocrática das Instituições de Ensino (Universidades e Faculdades), nem pela falta de agilidade do candidato no envio de seus dados.
2.3. Origem do Candidato e Envio de Dados:
a) Processo Integral Motivar RH: Quando o processo for realizado integralmente pela MOTIVAR RH, esta utilizará os contatos já captados para conduzir os trâmites.
b) Candidato Indicado pelo Cliente: Caso a CONTRATANTE encaminhe um candidato para a gestão contratual, é de sua inteira responsabilidade enviar imediatamente os dados de contato do estudante universitário.
2.4. Ausência de Envio de Dados pelo Candidato: Caso o candidato aprovado não envie a documentação ou assinaturas necessárias no prazo estipulado, a MOTIVAR RH emitirá uma notificação formal à CONTRATANTE. Persistindo a pendência, o processo de contratação daquele indivíduo será encerrado e será ativado o Protocolo de Reposição, isentando a assessoria de qualquer responsabilidade pela perda do candidato.



CLÁUSULA TERCEIRA — DAS DECLARAÇÕES, RESPONSABILIDADES E LEI DO ESTÁGIO
3.1. Ciência e Orientação sobre a Legislação: A MOTIVAR RH compromete-se a orientar a CONTRATANTE acerca das normas da Lei nº 11.788/2008. Contudo, a execução prática (controle de carga horária compatível com as aulas da faculdade, recesso, etc.) permanece sob responsabilidade exclusiva da CONTRATANTE.
3.2. Seguro Contra Acidentes Pessoais: A MOTIVAR RH será responsável por contratar e manter o Seguro contra Acidentes Pessoais em nome do estagiário.
3.3. Início Ilegal e Isenção de Passivos: A CONTRATANTE reconhece sua exclusiva responsabilidade em assinar o TCE. É terminantemente proibido o início das atividades do estagiário antes da conclusão de todas as assinaturas (incluindo a via deferida pela Universidade). Caso a CONTRATANTE permita o início antecipado, a MOTIVAR RH ficará isenta de qualquer responsabilidade, não assumindo custos, multas, sanções ou passivos trabalhistas em caso de fiscalização.



CLÁUSULA QUARTA — DA EXECUÇÃO, CONTROLE DE CANDIDATOS E DESISTÊNCIA
4.1. Exclusividade e Proteção da Base: Todos os estudantes apresentados pela CONTRATADA à CONTRATANTE passam a integrar a base sob controle da MOTIVAR RH por um período de 12 (doze) meses.
4.2. Contratação Direta ou Tardia: Caso a CONTRATANTE venha a aprovar, contratar como estagiário ou efetivar (como CLT ou PJ) qualquer estudante apresentado pela CONTRATADA no prazo de 12 meses — mesmo que para área diversa ou em data posterior ao processo seletivo —, ficará obrigada a efetuar o pagamento integral dos honorários.
4.3. Taxa de Desistência/Cancelamento: Caso a CONTRATANTE solicite o cancelamento da vaga, a suspenda por mais de 15 (quinze) dias, ou decida não preenchê-la após o início das buscas ou apresentação de candidatos pela MOTIVAR RH, incidirá multa compensatória equivalente a 50% (cinquenta por cento) do valor dos honorários contratados para a respectiva vaga, visando cobrir os custos operacionais despendidos.



CLÁUSULA QUINTA — DA REMUNERAÇÃO
5.1. Honorários e Inclusão do Seguro: A CONTRATANTE pagará à CONTRATADA o valor de R$ [Inserir Valor, ex: 800,00] ([Valor por extenso]) por cada vaga fechada.
5.2. Controle de Ativos e Faturamento: A MOTIVAR RH emitirá cobrança baseada no relatório de estagiários ativos. É obrigação da CONTRATANTE notificar oficial e imediatamente a assessoria sobre qualquer desligamento. Na ausência de notificação, o faturamento seguirá o último relatório ativo, não havendo devolução ou estorno retroativo de valores faturados e cobrados.
5.3. Condições de Pagamento: O pagamento será efetuado em até [ex: 5 (cinco)] dias úteis após a aprovação do estagiário e/ou envio da cobrança.
5.4. Penalidades por Inadimplemento: O atraso sujeitará a CONTRATANTE a multa de 2%, juros de mora de 1% ao mês, correção monetária e perda do direito à garantia de reposição.
5.5. Suspensão dos Serviços: O atraso no pagamento superior a [ex: 10 (dez)] dias corridos acarretará a suspensão de todos os serviços. Para evitar prejuízos operacionais abruptos, a MOTIVAR RH enviará uma notificação prévia 48 horas antes do bloqueio efetivo. A partir da suspensão, fica proibido o envio de candidatos e paralisada a gestão de novas assinaturas até a quitação dos débitos.


CLÁUSULA SEXTA — DA GARANTIA E DO PROTOCOLO DE REPOSIÇÃO 
6.1. Prazo de Garantia: A CONTRATADA concede garantia de reposição do estagiário pelo prazo exato de [ex: 30] dias corridos, contados a partir da data do início efetivo do estágio. 6.2. Condições Rigorosas para Acionamento: A reposição gratuita ocorrerá desde que:
a) O desligamento (ou desistência) ocorra dentro do prazo fixado no item 6.1, sendo formalmente comunicado à MOTIVAR RH no prazo máximo e improrrogável de 48 horas úteis;
b) O perfil da vaga e os requisitos permaneçam idênticos ao da "Ficha de Abertura de Vagas". Qualquer alteração no perfil, por menor que seja, configurará nova vaga e ensejará a cobrança de novos honorários.

CLÁUSULA SÉTIMA — LGPD E CONFIDENCIALIDADE 
7.1. As partes atestam conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018). Os dados não poderão ser utilizados para outros fins.

CLÁUSULA OITAVA — VIGÊNCIA, RESCISÃO E FORO 
8.1. Vigência: Este contrato vigora por 12 (doze) meses a partir da assinatura. 
8.2. Rescisão: Poderá ser rescindido mediante aviso prévio de 30 (trinta) dias por escrito, com pagamento proporcional dos estagiários ativos e processos em andamento. 
8.3. Foro: Elege-se o Foro da Comarca de [Inserir Cidade/UF].
[Cidade/UF], [Dia] de [Mês] de [Ano].

__________________________________________________________________
MOTIVAR RH LTDA. CONTRATADA

__________________________________________________________________
[NOME DA EMPRESA CLIENTE] CONTRATANTE

`;

function clientName(client: DocumentClient) {
  return client.company_name || client.restaurant_name || "CLIENTE";
}

function clientCnpj(client: DocumentClient) {
  return client.cnpj || client.document || "";
}

function clientAddress(client: DocumentClient) {
  return [
    client.address,
    client.city,
    client.state,
    client.cep ? `CEP ${client.cep}` : null,
  ]
    .filter(Boolean)
    .join(", ");
}

function contractTemplate(type: RhContractType) {
  if (type === "CLT") return CONTRACT_CLT;
  if (type === "ESTAGIO_SUPERIOR") return CONTRACT_ESTAGIO_SUPERIOR;
  return CONTRACT_ESTAGIO_MEDIO;
}

function locationAndDate(opening: DocumentOpening, client: DocumentClient) {
  const city = opening.forum_city || client.city || "";
  const state = opening.forum_state || client.state || "";
  const date = new Date();
  const formatted = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
  return `${[city, state].filter(Boolean).join("/")}, ${formatted}`;
}

export function buildContractText(
  opening: DocumentOpening,
  client: DocumentClient
) {
  const contractorCnpj = process.env.MOTIVAR_RH_CNPJ || "11.333.607/0001-00";
  const contractorAddress =
    process.env.MOTIVAR_RH_ADDRESS || "R. Sete de Abril, 296 - República, São Paulo - SP, 01044-000";

  const paymentDays = opening.payment_days || 5;
  const suspensionDays = opening.suspension_days || 10;
  const guaranteeDays =
    opening.guarantee_days ||
    (opening.contract_type === "CLT" ? 45 : 30);

  let text = contractTemplate(opening.contract_type);

  const replacements: Array<[string, string]> = [
    ["[Inserir CNPJ]", contractorCnpj],
    ["[Inserir Endereço Completo]", contractorAddress],
    ["[RAZÃO SOCIAL DO CLIENTE]", clientName(client)],
    ["[NOME DA EMPRESA CLIENTE]", clientName(client)],
    ["[CNPJ do Cliente]", clientCnpj(client)],
    ["[Endereço Completo do Cliente]", clientAddress(client)],
    ["[Inserir Cidade/UF]", [opening.forum_city, opening.forum_state].filter(Boolean).join("/") || [client.city, client.state].filter(Boolean).join("/")],
    ["[Cidade/UF], [Dia] de [Mês] de [Ano].", `${locationAndDate(opening, client)}.`],
    ["[ex: 5 (cinco)]", String(paymentDays)],
    ["[ex: 10 (dez)]", String(suspensionDays)],
    ["[ex: 45 ou 90]", String(guaranteeDays)],
    ["[ex: 30]", String(guaranteeDays)],
    ["[Inserir Valor, ex: 800,00]", opening.honorarium_amount != null
      ? Number(opening.honorarium_amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })
      : opening.honorarium_text || "[VALOR DOS HONORÁRIOS]"],
    ["[Valor por extenso]", opening.honorarium_words || "[VALOR POR EXTENSO]"],
    ["[Percentual, ex: 100% do primeiro salário bruto CLT / ou Valor Fixo de R$ X.XXX,XX]", opening.honorarium_text || "[HONORÁRIOS DA VAGA]"],
  ];

  for (const [from, to] of replacements) {
    text = text.split(from).join(to || "");
  }

  return text.trim();
}

function boolMark(value?: boolean | null) {
  return value ? "(X)" : "( )";
}

function contractTypeLabel(type: RhContractType) {
  if (type === "CLT") return "CLT";
  if (type === "ESTAGIO_SUPERIOR") return "Estágio Ensino Superior";
  return "Estágio Ensino Médio / Técnico";
}

export function buildOpeningSheetText(
  opening: DocumentOpening,
  client: DocumentClient
) {
  const benefits = [
    `Auxílio-Transporte: ${opening.transport_benefit || "-"}`,
    `Vale-Refeição/Alimentação: ${opening.meal_benefit || "-"}`,
    `${boolMark(opening.life_insurance)} Seguro de Vida`,
    `Outros: ${opening.other_benefits || "-"}`,
  ].join("\n");

  const activities = (opening.activities || [])
    .filter(Boolean)
    .map((item, index) => `${index + 1}. ${item}`)
    .join("\n");

  return `FICHA DE ABERTURA DE VAGA
MOTIVAR RH — Recrutamento e Seleção

Este documento é parte integrante do Contrato de Prestação de Serviços firmado entre a MOTIVAR RH e a CONTRATANTE. As informações abaixo guiarão todo o processo seletivo e definirão os critérios para a Garantia de Reposição.

1. DADOS DO CLIENTE E DA VAGA
Empresa (Contratante): ${clientName(client)}
Responsável pela Solicitação: ${opening.request_responsible || client.responsible_name || client.owner_name || "-"}
Cargo/Posição: ${opening.position}
Tipo de Contratação: ${contractTypeLabel(opening.contract_type)}
Quantidade de Vagas: ${opening.quantity}
Área/Departamento: ${opening.department || "-"}
Gestor Direto do Candidato: ${opening.direct_manager || "-"}

2. CONDIÇÕES DE TRABALHO E REMUNERAÇÃO
Modelo de Trabalho: ${opening.work_mode || "-"}
Local de Trabalho: ${opening.workplace_address || clientAddress(client) || "-"}
Horário de Trabalho: ${opening.work_schedule || "-"}
Intervalo: ${opening.break_time || "-"}
Remuneração / Bolsa-Auxílio: ${opening.remuneration != null ? `R$ ${Number(opening.remuneration).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "-"}
Benefícios Oferecidos:
${benefits}

3. PERFIL DO CANDIDATO
Escolaridade Exigida: ${opening.education_required || "-"}
Cursos/Formação: ${opening.courses || "-"}
Conhecimentos Técnicos (Hard Skills):
Obrigatórios: ${opening.required_skills || "-"}
Desejáveis: ${opening.desired_skills || "-"}
Perfil Comportamental (Soft Skills): ${opening.soft_skills || "-"}

4. ATIVIDADES E RESPONSABILIDADES
${activities || "-"}

5. SLA E PRAZOS DO PROCESSO
Prazo para envio dos primeiros currículos/candidatos triados: ${opening.sla_first_candidates || "-"}
Prazo estimado para agendamento de entrevistas pelo cliente: ${opening.sla_interviews || "-"}
Prazo estimado para fechamento da vaga: ${opening.sla_closing || "-"}

6. TERMO DE VALIDAÇÃO
Declaro que as informações preenchidas acima estão corretas e refletem a real necessidade da vaga. Estou ciente de que a Garantia de Reposição (Replacement) estipulada em contrato só será válida caso o estagiário/profissional seja desligado e a vaga substituta mantenha exatamente o mesmo perfil, atividades e condições descritos nesta Ficha de Abertura. Qualquer alteração nestes requisitos configurará a abertura de uma nova vaga, sujeita a novos honorários.

${locationAndDate(opening, client)}.

__________________________________________________________________
MOTIVAR RH LTDA. CONTRATADA

__________________________________________________________________
${clientName(client)} CONTRATANTE`;
}
