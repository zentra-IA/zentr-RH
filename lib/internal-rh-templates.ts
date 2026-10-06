export type InternalWorkerType = "CLT" | "ESTAGIO";

export type InternalDocumentType =
  | "CONTRATO_TRABALHO"
  | "REGIMENTO_COLABORADOR"
  | "TCE"
  | "REGIMENTO_ESTAGIARIO";

export type InternalWorkerData = {
  id: string;
  worker_type: InternalWorkerType;
  full_name: string;
  cpf: string;
  rg?: string | null;
  ctps?: string | null;
  address?: string | null;

  job_title?: string | null;
  sector?: string | null;
  salary_amount?: number | null;
  salary_words?: string | null;
  weekly_hours?: number | null;

  monday_schedule?: string | null;
  tuesday_schedule?: string | null;
  wednesday_schedule?: string | null;
  thursday_schedule?: string | null;
  friday_schedule?: string | null;

  non_compete_territory?: string | null;

  course_name?: string | null;
  institution_name?: string | null;
  institution_cnpj?: string | null;
  institution_address?: string | null;
  semester?: string | null;

  guardian_name?: string | null;
  guardian_cpf?: string | null;

  internship_schedule?: string | null;
  stipend_amount?: number | null;
  stipend_words?: string | null;
  transport_amount?: number | null;
  transport_words?: string | null;
  meal_amount?: number | null;
  meal_words?: string | null;

  internship_start?: Date | string | null;
  internship_end?: Date | string | null;

  city?: string | null;
  state?: string | null;
};

const CONTRACT_CLT = `CONTRATO INDIVIDUAL DE TRABALHO 
Pelo presente instrumento particular de contrato individual de trabalho, as partes abaixo qualificadas:

EMPREGADORA:
MOTIVAR RH LTDA., pessoa jurídica de direito privado, inscrita no CNPJ/MF sob o nº [Inserir CNPJ], com sede na [Inserir Endereço Completo], neste ato representada na forma de seu contrato social.

EMPREGADO(A):
[NOME COMPLETO DO COLABORADOR], inscrito(a) no CPF sob o nº [Inserir CPF], RG nº [Inserir RG], CTPS nº [Inserir Série/UF], residente e domiciliado(a) na [Endereço Completo].

As partes acima qualificadas resolvem, de comum acordo, celebrar o presente Contrato Individual de Trabalho, que se regerá pelas normas da Consolidação das Leis do Trabalho (CLT), legislação trabalhista complementar e pelas cláusulas e condições seguintes:


CLÁUSULA PRIMEIRA — DO CARGO E DAS FUNÇÕES
1.1. O(A) EMPREGADO(A) é contratado(a) para exercer o cargo de confiança de nível Sênior, integrando o setor de Integração de Estágio (Contratos) e Gestão Administrativo-Financeira, competindo-lhe a execução especializada, liderança técnica e o gerenciamento autônomo das seguintes atribuições:
Análise técnica avançada, emissão e validação de contratos, termos aditivos e rescisões contratuais;
Gestão estratégica de prazos, controle rigoroso de ativos e faturamento por cliente, com apuração de totais para repasse gerencial;
Condução e supervisão de processos de cobrança corporativa e atualização contínua de planilhas de controle financeiro e operacional;
Coordenação de processos de onboarding, trâmites complexos com instituições de ensino e suporte regulatório;
Consultoria jurídica e técnica avançada aos clientes quanto ao cumprimento da legislação aplicável, mitigando riscos de conformidade;
Uso obrigatório e governança de dados no sistema institucional vigente, garantindo a rastreabilidade e a mensuração de desempenho do setor;
Atividades correlatas de suporte administrativo avançado, relatórios gerenciais complexos e melhoria contínua de processos corporativos.


CLÁUSULA SEGUNDA — DA JORNADA DE TRABALHO
2.1. A jornada de trabalho semanal será de 44 (quarenta e quatro) horas semanais.
2.2. Os dias da semana e os horários de trabalho ficam expressamente pactuados da seguinte forma:
Segunda-feira (Home Office): Das às, com 1 (uma) hora de intervalo para descanso e alimentação.
Terça-feira (Presencial): Das às, com 1 (uma) hora de intervalo para descanso e alimentação, no escritório da EMPREGADORA.
Quarta-feira (Presencial): Das às, com 1 (uma) hora de intervalo para descanso e alimentação, no escritório da EMPREGADORA.
Quinta-feira (Presencial): Das às, com 1 (uma) hora de intervalo para descanso e alimentação, no escritório da EMPREGADORA.
Sexta-feira (Home Office): Das às, com 1 (uma) hora de intervalo para descanso e alimentação.
Nota: O(A) EMPREGADO(A) cumprirá o regime híbrido acima, devendo manter total disponibilidade, pontualidade e acesso ininterrupto ao sistema institucional vigente nos dias remotos.
2.3. Fica ressalvado o direito potestativo da EMPREGADORA de alterar o regime híbrido para o presencial ou ajustar os dias remotos diante de contingências operacionais, mediante comunicação prévia.


CLÁUSULA TERCEIRA — DA REMUNERAÇÃO
3.1. O(A) EMPREGADO(A) perceberá a remuneração mensal de R$ [Inserir Valor Sênior] ([Valor por extenso]), paga até o quinto dia útil do mês subsequente ao trabalhado, já computadas as DSRs (Descanso Semanal Remunerado).
3.2. Por se tratar de cargo de nível Sênior com atribuições de alta responsabilidade técnica, eventuais horas extraordinárias efetivamente laboradas mediante prévia autorização da EMPREGADORA serão devidamente remuneradas com os acréscimos legais da CLT ou compensadas via banco de horas, se aplicável.


CLÁUSULA QUARTA — REGIMENTO INTERNO
4.1. O(A) EMPREGADO(A) declara expressamente, de forma irrevogável e irretratável, que leu integralmente todas as normas e diretrizes contidas no Regimento Interno e Código de Conduta da Motivar RH antes da assinatura deste contrato, estando plenamente ciente, compreendendo o seu teor e concordando formalmente com todas as regras estabelecidas.
4.2. O Regimento Interno constitui documento anexo, parte integrante e inseparável deste Contrato Individual de Trabalho, sendo obrigação inegociável do(a) EMPREGADO(A) cumprir rigorosamente as diretrizes de postura profissional, o código de vestimenta (dress code), a proibição absoluta de termos inadequados, a obrigatoriedade de atendimento multicanal, o uso da linha e chip telefônico corporativo e o uso obrigatório do sistema institucional vigente para o registro integral das atividades diárias.
4.3. O descumprimento das normas operacionais, sistêmicas, comportamentais ou disciplinares previstas no Regimento Interno sujeitará o(a) EMPREGADO(A) às sanções previstas na CLT, englobando advertências, suspensões disciplinares e, em casos graves ou reincidentes, a rescisão contratual por Justa Causa (Art. 482 da CLT).


CLÁUSULA QUINTA — NÃO COMPETITIVIDADE
5.1. Sigilo e Proteção de Dados: O(A) EMPREGADO(A) obriga-se a manter absoluto sigilo sobre informações estratégicas, operacionais, financeiras, carteira de clientes e dados sensíveis da EMPREGADORA, cumprindo rigorosamente a Lei Geral de Proteção de Dados (LGPD, Lei nº 13.709/2018), tanto na vigência do contrato quanto após o seu término.
5.2. Não Competitividade pelo Máximo Legal: Dada a posição sênior e o acesso privilegiado a segredos comerciais, metodologias proprietárias e fluxos de mercado, o(a) EMPREGADO(A) obriga-se a não competir, direta ou indiretamente, com a EMPREGADORA pelo prazo máximo de 2 (dois) anos após a rescisão contratual, abrangendo o território de [Inserir Cidade/Região ou Estado].
5.3. Fica vedado ao(à) EMPREGADO(A) aliciar clientes ou colaboradores, ou utilizar métodos internos da EMPREGADORA em proveito próprio ou de terceiros.


CLÁUSULA SEXTA — DAS DISPOSIÇÕES GERAIS
6.1. Aplicam-se ao presente contrato todas as disposições da Consolidação das Leis do Trabalho (CLT) e da legislação trabalhista brasileira vigente.
E, por estarem justos e contratados, assinam o presente instrumento em 2 (duas) vias de igual teor e forma.

[Cidade/UF], [Dia] de [Mês] de [Ano].

_____________________________________________________________________
NOME DO COLABORADOR: CPF:


_____________________________________________________________________
MOTIVAR RH LTDA. Diretoria / Gestão

`;
const CONDUCT_CLT = `REGIMENTO INTERNO E CÓDIGO DE CONDUTA MOTIVAR RH – SETOR DE INTEGRAÇÃO DE ESTÁGIO
Este documento estabelece as diretrizes, normas e princípios que regem o comportamento e as atividades dos profissionais que integram o departamento de Integração de Estágio da MOTIVAR RH LTDA. Ao assinar este termo, o colaborador declara ciência e concordância com as regras aqui estipuladas, essenciais para a segurança jurídica, financeira e operacional do nosso trabalho.

1. NOSSA IDENTIDADE: VISÃO, MISSÃO E VALORES
Tudo o que fazemos na Motivar RH é guiado por nossos princípios fundamentais. O colaborador deve conhecer e aplicar estas diretrizes em sua rotina:
Missão: Conectar empresas aos melhores talentos do mercado com agilidade e transparência, garantindo segurança jurídica e excelência na gestão de contratos.
Visão: Ser referência em qualidade de atendimento e gestão de estagiários, proporcionando uma experiência segura e organizada para clientes e estudantes.
Valores: Ética e Transparência, Respeito Mútuo, Excelência e Padronização (seguindo rigorosamente os métodos da empresa) e Foco na Solução.

2. ESCOPO DE ATUAÇÃO E RESPONSABILIDADES DO SETOR
O profissional alocado no setor de Integração de Estágio atua como o pilar de controle contratual e financeiro da operação, sendo estritamente responsável pelas seguintes atribuições:
Emissão e Análise de Contratos Iniciais: Analisar, emitir e validar Termos de Compromisso de Estágio (TCE) e contratos firmados com clientes, estagiários e colaboradores.
Gestão de Renovações e Rescisões: Monitorar os prazos de vencimento dos estágios, providenciando tempestivamente os Termos Aditivos ou os Termos de Rescisão.
Controle de Ativos e Faturamento: Quantificar rigorosamente o número de candidatos ativos em cada cliente, repassando a totalidade das informações e valores diretamente para a diretoria.
Cobrança e Atualização de Planilhas: Realizar a cobrança mensal dos clientes de forma proativa através de e-mail, anexando e mantendo atualizada a planilha de controle de ativos.
Onboarding e Trâmites com Instituições: Entrar em contato com os estudantes e com as instituições de ensino para coleta e validação de dados.
Consultoria e Orientação ao Cliente: Orientar o cliente quanto à Lei do Estágio, proibindo expressamente que o estagiário inicie atividades sem todas as assinaturas contratuais.
Coleta e Formalização de Dados: Cobrar os dados para a emissão de contratos de candidatos já aprovados pelo cliente, formalizando o pedido por e-mail e cobrando agilidade via WhatsApp.
Atividades Correlatas: Tarefas de apoio que garantam o andamento do setor (ex: emissão de relatórios gerenciais extraídos do sistema de gestão vigente, conferência de legibilidade de RGs, atualização de cadastros, envio de comunicados em massa). A recusa injustificada destas tarefas configura insubordinação.

3. PROCESSOS INTERNOS, SISTEMAS E TREINAMENTOS
Para que a Motivar RH mantenha seu padrão de qualidade, é inegociável o cumprimento das diretrizes operacionais abaixo:
Uso Obrigatório do Sistema Institucional Vigente: O uso da plataforma oficial adotada pela empresa não é opcional, é a essência do trabalho. É obrigatório documentar e gerir todas as atividades diárias na plataforma. A alegação de "falta de tempo" para alimentar o sistema é inaceitável, visto que a documentação sistêmica é o que permite à diretoria medir o desempenho do setor, identificar gargalos e propor melhorias.
Adesão Rigorosa aos Processos: É terminantemente proibido que o colaborador crie seus próprios processos paralelos que burlem o padrão da empresa.
Melhoria Contínua: O colaborador deve sinalizar à diretoria caso identifique necessidades de melhorias sistêmicas que possam otimizar a operação.
Treinamentos: A empresa fornecerá treinamentos ordinariamente dentro do horário de trabalho. Capacitações realizadas fora da jornada, caso o colaborador deseje ou concorde, serão opcionais e a compensação ficará a critério do empregador mediante acordo prévio.

4. CONDUTA, POSTURA E COMUNICAÇÃO NO AMBIENTE CORPORATIVO
O ambiente de trabalho exige extremo profissionalismo e diplomacia:
Linguagem: É terminantemente proibido o uso de palavras de baixo calão (palavrões), gírias ofensivas ou expressões pejorativas.
Atendimento ao Cliente: É absolutamente proibido insultar, ofender, ironizar ou utilizar tom de voz inadequado com qualquer cliente ou candidato.
Obrigatoriedade de Atendimento: É proibido recusar-se a falar ou atender qualquer cliente por telefone, mensagem ou chamada de vídeo.
Disponibilidade: A Motivar RH fornecerá um número e chip de linha telefônica corporativa para uso exclusivo nas atividades da corporativas, incluindo a participação em grupos de trabalho e atendimento a clientes. É inadmissível sair de grupos de comunicação corporativa sem autorização prévia da diretoria.
Comunicação Multicanal: O colaborador deve estar apto e disponível para realizar ligações telefônicas, enviar e-mails e conduzir chamadas de vídeo.

5. CÓDIGO DE VESTIMENTA E MODELO HÍBRIDO
Código de Vestimenta (Dress Code): A imagem do setor reflete a seriedade da Motivar RH. O dress code diário é o Profissional / Business Casual.
Permitido: Camisas, blusas de tecido plano, calças sociais ou calças jeans escuras (sem rasgos), sapatos fechados ou tênis casuais em bom estado.
Expressamente Proibido: Blusas de alcinha, decotes profundos, calças rasgadas (destroyed), roupas de academia, leggings muito coladas, shorts, saias acima da linha do joelho, camisetas de times, roupas transparentes, chinelos e bonés.
Eventos e Visitas Corporativas: Em dias de visitas presenciais de clientes à empresa ou eventos corporativos, a formalidade deverá ser elevada (ex: uso de blazer, alfaiataria), conforme orientação prévia da gestão.
Modelo de Trabalho Híbrido: O regime estabelecido é híbrido, devendo o colaborador seguir a escala abaixo:
Dias Presenciais (Terça, Quarta e Quinta-feira): Comparecimento físico ao escritório da Motivar RH, cumprindo a jornada e o dress code.
Dias de Home Office (Segunda e Sexta-feira): Exige-se a mesma pontualidade, disponibilidade e foco do trabalho presencial. O colaborador deve estar logado no sistema oficial vigente, acessível e preparado para chamadas de vídeo com câmera aberta e vestimenta adequada.
Flexibilidade de Remanejamento: Havendo problemas de gestão, manutenção no escritório, necessidade operacional ou qualquer contingência, a Motivar RH reserva-se o direito de alterar a jornada para 100% Home Office (ou modificar os dias remotos) de forma temporária ou permanente, mediante comunicação prévia ao colaborador.

6. CLASSIFICAÇÃO DE FALTAS, PENALIDADES E IMPACTOS (CLT)
O descumprimento das regras deste Regimento constitui infração disciplinar, classificada e penalizada conforme a gravidade, nos moldes da Consolidação das Leis do Trabalho (CLT).
Impactos Financeiros e Trabalhistas:
Faltas Não Justificadas: Descontam o dia de trabalho e a remuneração do Descanso Semanal Remunerado (DSR) da semana. O acúmulo de faltas sem justificativa médica reduzirá proporcionalmente os dias de direito a férias anuais do colaborador (Art. 130 da CLT).
Suspensão: O colaborador perde o direito à remuneração dos dias em que estiver suspenso, bem como o respectivo DSR, impactando também o cálculo de férias e 13º salário se ultrapassar os limites legais (Art. 473 da CLT).
As infrações são classificadas da seguinte forma:
A) FALTAS LEVES Infrações que não causam dano direto à operação ou ao cliente, decorrentes de desatenção isolada.
Exemplos: Pequenos atrasos isolados no início da jornada; não cumprimento pontual do dress code (ex: uso de calça rasgada em um dia específico); erro de digitação interno sem impacto externo.
Penalidade: Advertência Verbal (registro de orientação para correção imediata).
B) FALTAS MÉDIAS Infrações que demonstram negligência com os processos da empresa ou reincidência em faltas leves.
Exemplos: Reincidência em desrespeito ao dress code; atrasos injustificados frequentes; uso de palavras de baixo calão no ambiente interno; atraso no envio da planilha de cobrança; desorganização recorrente de arquivos; ausência injustificada ao trabalho.
Penalidade: Advertência Escrita. A reincidência em falta média eleva a infração para o grau de Falta Grave.
C) FALTAS GRAVES Infrações que configuram insubordinação, indisciplina, mau procedimento ou quebra de confiança (Art. 482 da CLT), impactando diretamente o cliente, a equipe ou os resultados da Motivar RH.
Exemplos:
Recusar-se a utilizar o sistema oficial da empresa, omitir registros ou alegar "falta de tempo" para não documentar as atividades.
Criar processos paralelos ou recusar-se a seguir os fluxos operacionais determinados pela gestão.
Sair de grupos de comunicação corporativa (WhatsApp) sem autorização.
Recusar-se ou negligenciar o atendimento a qualquer cliente da agência.
Insultar, ironizar ou utilizar linguagem hostil com clientes, candidatos ou colegas.
Omitir ou adulterar o número de candidatos ativos repassado à diretoria/clientes.
Vazar dados sigilosos ou pessoais em violação à LGPD.
Penalidades: Suspensão Disciplinar (1 a 30 dias) e/ou Demissão por Justa Causa, aplicadas de forma imediata conforme o impacto da infração, sem necessidade de advertências prévias.



7. TERMO DE CONCORDÂNCIA E ASSINATURA
Declaro ter recebido, lido e compreendido integralmente o Regimento Interno e Código de Conduta – Integração de Estágio. Ao assinar este documento, comprometo-me a respeitar e cumprir todas as normas operacionais, comportamentais e sistêmicas aqui estabelecidas, ciente das classificações de faltas, seus impactos remuneratórios e nas férias, e das sanções disciplinares aplicáveis nos moldes da legislação vigente.
Este documento passa a ser parte integrante do meu contrato de trabalho.
[Cidade/UF], [Dia] de [Mês] de [Ano].


_____________________________________________________________________
NOME DO COLABORADOR: CPF:


_____________________________________________________________________
MOTIVAR RH LTDA. Diretoria / Gestão
`;
const TCE = `TERMO DE COMPROMISSO DE ESTÁGIO (TCE)
Pelo presente instrumento particular, as partes abaixo identificadas:
CONCEDENTE (EMPRESA): MOTIVAR RH LTDA., pessoa jurídica de direito privado, inscrita no CNPJ/MF sob o nº [Inserir CNPJ], com sede na [Inserir Endereço Completo], neste ato representada na forma de seu contrato social.
ESTAGIÁRIO(A): [NOME COMPLETO DO ESTAGIÁRIO], inscrito(a) no CPF sob o nº [Inserir CPF], RG nº [Inserir RG], residente e domiciliado(a) na [Endereço Completo], estudante regularmente matriculado(a) e frequentando o curso de [Nome do Curso, ex: Administração / Direito], na Instituição de Ensino [Nome da Faculdade/Universidade], no [Inserir Semestre/Ano] semestre.
(Interveniente / Responsável Legal, obrigatório se menor de idade): [Nome do Responsável Legal], inscrito(a) no CPF sob o nº [Inserir CPF]. (Nota: A assinatura do responsável legal é obrigatória e implica na ciência conjunta das normas, assumindo a corresponsabilidade legal por todas as obrigações e termos aqui estipulados).
INSTITUIÇÃO DE ENSINO: [Nome da Instituição de Ensino], inscrita no CNPJ sob o nº [Inserir CNPJ], com sede na [Endereço da Instituição].
As partes acima qualificadas, de comum acordo, celebram o presente Termo de Compromisso de Estágio (TCE), em conformidade com a Lei nº 11.788/2008 (Lei do Estágio), mediante as cláusulas e condições seguintes:

CLÁUSULA PRIMEIRA — DO OBJETIVO E CARÁTER EDUCATIVO 
1.1. O presente estágio tem caráter exclusivamente educativo, não gerando vínculo empregatício de qualquer natureza, integrando o itinerário formativo do educando e visando ao seu aprendizado prático e profissional no setor de Integração de Estágio (Contratos) da CONCEDENTE.
CLÁUSULA SEGUNDA — DAS ATIVIDADES DO ESTÁGIO 2.1. As atividades a serem desenvolvidas pelo(a) ESTAGIÁRIO(A) serão compatíveis com a sua formação acadêmica e abrangerão:
Auxílio na análise, emissão e validação de Termos de Compromisso de Estágio (TCE) e contratos;
Monitoramento de prazos de vigência contratual para emissão de Termos Aditivos e rescisões;
Auxílio na conferência e quantificação de estagiários ativos por cliente para fins de relatórios gerenciais e faturamento;
Participação nas rotinas de acompanhamento e suporte financeiro, envio de e-mails de cobrança e atualização de planilhas de controle de ativos;
Contato direto com estudantes e instituições de ensino para coleta e validação de dados de cadastro (onboarding);
Orientação básica aos clientes quanto às diretrizes da Lei do Estágio, respeitando o rigor de não permitir o início de atividades sem assinaturas válidas;
Atividades correlatas de suporte administrativo e documental, tais como emissão de relatórios gerenciais no sistema de gestão vigente, conferência básica de legibilidade de documentos, atualização de cadastros e envio de comunicados institucionais em massa.

CLÁUSULA TERCEIRA — DA JORNADA DE TRABALHO E HORÁRIO 
3.1. A jornada de atividades do(a) ESTAGIÁRIO(A) será de 6 (seis) horas diárias e 30 (trinta) horas semanais, respeitando a compatibilidade com o seu horário escolar. 3.2. O horário de estágio será exercido de [ex: segunda a sexta-feira, das 09:00 às 16:00, com 1 hora de intervalo para descanso e alimentação]. 
3.3. O regime de trabalho será Híbrido, estruturado em dias presenciais no escritório da Concedente e dias em home office, conforme alinhamento prévio e as regras estabelecidas no Regimento Interno da empresa.

CLÁUSULA QUARTA — DA BOLSA-AUXÍLIO E DOS BENEFÍCIOS 
4.1. Bolsa-Auxílio: A CONCEDENTE pagará ao(à) ESTAGIÁRIO(A) uma bolsa-auxílio mensal no valor de R$ [Inserir Valor, ex: 1.200,00] ([Valor por extenso]), proporcional aos dias efetivamente estagiados. 4.2. Auxílio-Transporte: Fica estipulado o pagamento de auxílio-transporte no valor de R$ [Inserir Valor, ex: 200,00] ([Valor por extenso]) ou fornecimento em vales, destinado exclusivamente ao custeio das despesas de deslocamento para o estágio. 4.3. Auxílio-Alimentação / Refeição: A CONCEDENTE concederá auxílio-alimentação/refeição no valor de R$ [Inserir Valor, ex: 300,00] ([Valor por extenso]). 4.4. Seguro de Acidentes Pessoais: A CONCEDENTE obriga-se a manter em favor do(a) ESTAGIÁRIO(A) Apólice de Seguro contra Acidentes Pessoais, em atendimento ao art. 9º, inciso IV, da Lei nº 11.788/2008.

CLÁUSULA QUINTA — DO RECESSO REMUNERADO 
5.1. O(A) ESTAGIÁRIO(A) fará jus a recesso remunerado de 30 (trinta) dias a cada ano de estágio na mesma empresa, a ser proporcionalizado nos períodos inferiores a 1 ano, preferencialmente coincidente com as férias escolares.

CLÁUSULA SEXTA — DO CÓDIGO DE CONDUTA, CLASSIFICAÇÃO DE DESVIOS E CIÊNCIA PRÉVIA 
6.1. O(A) ESTAGIÁRIO(A) e, quando aplicável, seu(sua) responsável legal, declaram expressamente, neste ato, que leem integralmente e compreendem todas as normas estipuladas no Regimento Interno e Código de Conduta da Motivar RH (Setor de Integração de Estágio) antes da assinatura deste Termo, concordando plenamente com o seu teor. 
6.2. O Regimento Interno e Código de Conduta constitui anexo inseparável deste TCE, sendo obrigação do(a) ESTAGIÁRIO(A) cumprir rigorosamente as regras de postura profissional, vestimenta (dress code), proibição de termos inadequados, obrigatoriedade de atendimento multicanal, uso do número e linha telefônica corporativa e o uso obrigatório do sistema institucional vigente para o registro das atividades diárias. 
6.3. O descumprimento das normas orientativas e disciplinares do Regimento Interno poderá acarretar a adoção de medidas pedagógicas formais ou a rescisão antecipada deste Termo de Compromisso de Estágio, conforme as diretrizes pedagógicas e a tipificação de desvios abaixo estabelecidas:
A) Desvios Leves (Orientação Pedagógica):
O que são: Desvios pontuais decorrentes de desatenção ou adaptação, sem prejuízo direto à operação ou ao atendimento.
Exemplos práticos: Chegar com alguns minutos de atraso de forma isolada; comparecer ao escritório em um dia presencial vestindo uma peça levemente fora do padrão (dress code); ou esquecer de preencher um campo secundário em um relatório do sistema, corrigindo-o logo em seguida mediante aviso.
Medida aplicada: Diálogo de alinhamento e orientação verbal pedagógica.
B) Desvios Médios (Advertência Educativa Formal):
O que são: Atitudes que demonstram negligência com as normas orientadas ou reincidência em desvios leves já conversados.
Exemplos práticos: Reincidir no descumprimento do dress code (ex: ir trabalhar repetidamente com roupas de academia ou shorts/saias acima do joelho, mesmo após orientação prévia); apresentar faltas ou atrasos frequentes e injustificados; ou demonstrar desorganização recorrente nos registros sistêmicos essenciais da integração.
Medida aplicada: Advertência educativa formal por escrito.
C) Infrações Graves / Gravíssimas (Causas de Rescisão Antecipada e Imediata do TCE):
O que são: Condutas que rompem de forma irretratável a confiança institucional, comprometem a segurança de dados, geram passivos operacionais gravíssimos ou violam preceitos fundamentais da ética profissional.
Exemplos práticos:
Recusar-se ativamente a utilizar o sistema oficial vigente da empresa ou omitir deliberadamente o registro das atividades contratuais sob a alegação de "falta de tempo".
Insubordinação direta às orientações e aos processos metodológicos determinados pela gestão, criando processos paralelos por conta própria.
Sair, remover-se ou abandonar os grupos de comunicação corporativa utilizando o número da linha telefônica corporativa fornecida pela empresa.
Recusar-se ou negligenciar o atendimento a clientes ou fluxos essenciais de contratos e cobranças.
Utilizar linguagem agressiva, hostil ou de baixo calão (palavrões/gírias ofensivas) com clientes, candidatos, colegas ou supervisores.
Omitir ou adulterar o número de candidatos ativos repassado à diretoria/clientes.
Vazar dados sigilosos ou pessoais, violando as diretrizes da LGPD.
Medida aplicada: Rescisão antecipada e imediata do Termo de Compromisso de Estágio (TCE), cessando o vínculo educativo de forma sumária.

CLÁUSULA SÉTIMA — DA CONFIDENCIALIDADE E DA NÃO COMPETITIVIDADE 
7.1. Sigilo e Proteção de Dados: O(A) ESTAGIÁRIO(A) compromete-se a manter absoluto sigilo sobre todas as informações estratégicas, operacionais, financeiras, cadastrais, de clientes e de candidatos da CONCEDENTE, bem como a cumprir integralmente as diretrizes da Lei Geral de Proteção de Dados (LGPD, Lei nº 13.709/2018), durante a vigência deste estágio e mesmo após o seu término. 
7.2. Da Não Competitividade pelo Máximo Legal: Considerando o acesso privilegiado a métodos, processos, planilhas de controle, carteira de clientes e segredos comerciais do setor de Integração de Estágio e Gestão de RH, o(a) ESTAGIÁRIO(A) obriga-se a não competir, direta ou indiretamente, com o objeto social e as atividades comerciais da CONCEDENTE. 
7.3. Prazo e Abrangência Territorial: A restrição de não competitividade descrita no item anterior vigorará pelo prazo máximo de 2 (dois) anos contados a partir da data de encerramento deste Termo de Compromisso de Estágio, incidindo sobre o território de [Inserir Cidade/Região ou Estado]. 
7.4. Vedações Específicas: Durante o prazo estipulado no item 7.3, fica expressamente proibido ao(à) ESTAGIÁRIO(A):
a) Aliciar, desviar ou tentar atrair clientes, parceiros, instituições de ensino ou colaboradores da CONCEDENTE para si ou para terceiros;
b) Utilizar-se de metodologias, modelos de documentos, planilhas ou dados estratégicos obtidos durante o estágio para benefício próprio ou de terceiros concorrentes. 
7.5. Penalidades por Descumprimento: O descumprimento da obrigação de não competitividade ou de confidencialidade ensejará a adoção das medidas judiciais cabíveis para a reparação integral dos prejuízos materiais e morais causados à CONCEDENTE, além da apuração de responsabilidade civil e criminal aplicáveis à espécie.
CLÁUSULA OITAVA — DA CORRESPONSABILIDADE DO RESPONSÁVEL LEGAL (MENOR DE IDADE) 
8.1. Sendo o(a) ESTAGIÁRIO(A) menor de idade, o(a) seu(sua) responsável legal qualificado(a) no preâmbulo deste instrumento assume, de forma solidária e irrevogável, a corresponsabilidade civil e legal pelo pleno cumprimento de todas as obrigações assumidas neste Termo e no Regimento Interno anexo, respondendo por eventuais danos causados à CONCEDENTE decorrentes de dolo, culpa, quebra de sigilo ou descumprimento das normas de não competitividade e confidencialidade.
CLÁUSULA NONA — DA VIGÊNCIA E RESCISÃO 
9.1. O presente termo vigorará pelo período de [Data de Início] a [Data de Término], podendo ser prorrogado mediante Termo Aditivo. 
9.2. O estágio poderá ser rescindido a qualquer tempo, por interesse de qualquer das partes, mediante notificação prévia por escrito com antecedência mínima de 30 (trinta) dias, ou de forma imediata em caso de trancamento de matrícula, conclusão do curso ou descumprimento de obrigações acadêmicas e do Código de Conduta.
E, por estarem justos e de acordo, assinam o presente instrumento em vias de igual teor e forma.[Cidade/UF], [Dia] de [Mês] de [Ano].

_________________________________________________________________________
NOME DO ESTAGIÁRIO: CPF:

_________________________________________________________________________
(Se menor de idade) NOME DO RESPONSÁVEL LEGAL: CPF:

_________________________________________________________________________
MOTIVAR RH LTDA. Diretoria / Supervisão de Estágio

_________________________________________________________________________
[NOME DA INSTITUIÇÃO DE ENSINO] INSTITUIÇÃO DE ENSINO

`;
const CONDUCT_INTERN = `REGIMENTO INTERNO E CÓDIGO DE CONDUTA – SETOR DE [INTEGRAÇÃO DE ESTÁGIO (ESTAGIÁRIOS) – MOTIVAR RH
Este documento estabelece as diretrizes, normas e princípios que regem a conduta, o desenvolvimento prático e o aprendizado dos estagiários alocados exclusivamente no departamento de Integração de Estágio (Contratos) da MOTIVAR RH LTDA.
Por se tratar de um ato educativo escolar supervisionado regulado pela Lei do Estágio (Lei nº 11.788/2008), este regimento é parte integrante e complementar do Termo de Compromisso de Estágio (TCE) firmado entre as partes, tendo como objetivo principal o aprendizado de competências profissionais, cidadania e ética corporativa.

1. NOSSA IDENTIDADE: VISÃO, MISSÃO E VALORES
O estagiário alocado na Motivar RH participará ativamente da rotina operacional integrando os seguintes princípios:
Missão: Conectar empresas aos melhores talentos do mercado com agilidade e transparência, proporcionando ao estagiário uma vivência prática, segura e alinhada à sua formação acadêmica.
Visão: Ser referência em qualidade de atendimento e gestão de estagiários, unindo rigor técnico na gestão de contratos e excelência no suporte pedagógico e educativo.
Valores: Ética e Transparência, Respeito Mútuo, Excelência Operacional e Foco na Solução.

2. ESCOPO DE ATUAÇÃO E O CARÁTER EDUCATIVO DAS TAREFAS
O estágio visa ao aprendizado prático das rotinas administrativas, contratuais e financeiras de RH. Sob supervisão direta, o estagiário será capacitado nas seguintes atribuições:
Emissão e Análise de Contratos Iniciais: Compreensão e auxílio na emissão e validação de Termos de Compromisso de Estágio (TCE).
Gestão de Renovações e Rescisões: Acompanhamento de prazos de vigência contratual para emissão de Termos Aditivos e rescisões.
Controle de Ativos e Faturamento: Auxílio na conferência e quantificação de estagiários ativos por cliente para fins de relatórios gerenciais e faturamento.
Cobrança e Atualização de Planilhas: Participação nas rotinas de acompanhamento e suporte financeiro por e-mail e planilhas de controle.
Onboarding e Trâmites com Instituições: Contato direto com estudantes e instituições de ensino para validação de dados de cadastro.
Orientação e Compliance: Estudo e aplicação prática das normas da Lei do Estágio, compreendendo a importância de barrar o início de atividades sem assinaturas válidas.
Atividades Correlatas de Aprendizado: Para a completa formação na área de contratos e suporte, fazem parte do escopo pedagógico tarefas correlatas como: emissão de relatórios gerenciais extraídos do sistema de gestão vigente, conferência básica de legibilidade de documentos, atualização de cadastros e envio de comunicados informativos institucionais. A execução destas tarefas garante o aprendizado integral da rotina do setor.

3. PROCESSOS INTERNOS, SISTEMAS E CAPACITAÇÃO
Uso Obrigatório do Sistema Institucional Vigente: O uso da plataforma oficial adotada pela empresa para documentar e gerir os processos é parte fundamental do estágio e da curva de aprendizado. O registro adequado das atividades no sistema é indispensável para a mensuração do progresso e o bom andamento da operação.
Adesão aos Procedimentos Padronizados: O estagiário deve seguir estritamente os fluxos metodológicos ensinados pela gestão, sendo vedada a criação de processos paralelos desalinhados com o padrão da agência.
Capacitações e Treinamentos: Os treinamentos técnicos e operacionais sobre sistemas e rotinas serão ministrados pela empresa obrigatoriamente dentro do horário de estágio, integrando a carga horária de aprendizado do estudante.

4. CONDUTA, POSTURA E COMUNICAÇÃO NO AMBIENTE CORPORATIVO
O ambiente de estágio exige cortesia, urbanidade e profissionalismo estrito:
Linguagem e Postura: É terminantemente proibido o uso de palavras de baixo calão (palavrões), gírias ofensivas ou expressões pejorativas em qualquer canal ou momento da jornada.
Atendimento e Relacionamento: É vedado insultar, ironizar ou tratar com aspereza clientes, candidatos ou colegas. O estagiário deve estar sempre acessível para atender ligações, mensagens corporativas e chamadas de vídeo.
Uso de Canais e Linha Telefônica Corporativa: A Motivar RH fornecerá um número e chip de linha telefônica corporativa para uso exclusivo nas atividades da agência, incluindo a participação em grupos de trabalho e atendimento a clientes. O estagiário é estritamente responsável pela gestão dessa linha durante a jornada. É inadmissível e considerado infração grave que o estagiário saia, remova-se ou abandone por conta própria os grupos de comunicação corporativa utilizando o número da empresa, sendo obrigatório manter o canal ativo e integrado aos fluxos da agência.

5. CÓDIGO DE VESTIMENTA E MODELO HÍBRIDO
Código de Vestimenta (Dress Code): O estagiário representa a imagem institucional da Motivar RH. O padrão exigido é o Profissional / Business Casual:
Permitido: Camisas, blusas de tecido plano, calças sociais ou jeans escuros sem rasgos, sapatos fechados ou tênis casuais sóbrios.
Expressamente Proibido: Blusas de alcinha, decotes profundos, calças rasgadas (destroyed), roupas de academia, leggings muito coladas, shorts, saias acima da linha do joelho, camisetas de times, roupas transparentes, chinelos e bonés.
Visitas e Eventos: Em ocasiões de reuniões presenciais com clientes ou eventos corporativos, a formalidade do vestuário deverá ser ajustada (ex: blazer ou alfaiataria), conforme orientação prévia.
Modelo de Trabalho Híbrido: O regime de estágio é híbrido, obedecendo à escala:
Dias Presenciais (Terça, Quarta e Quinta-feira): Comparecimento ao escritório da Motivar RH, cumprindo a jornada e o dress code.
Dias de Home Office (Segunda e Sexta-feira): Exige-se o mesmo compromisso e disponibilidade do presencial, com acesso obrigatório ao sistema vigente e participação em chamadas de vídeo com câmera aberta e vestimenta adequada. A empresa poderá alterar temporariamente o regime para adaptações operacionais mediante aviso prévio.
6. REGIME DE ORIENTAÇÃO EDUCATIVA E RESCISÃO DO ESTÁGIO
Em conformidade estrita com a Lei nº 11.788/2008 e com o Termo de Compromisso de Estágio (TCE), por não se tratar de vínculo empregatício celetista, não incidem sobre o estagiário penalidades trabalhistas punitivas (tais como suspensões disciplinares com prejuízo da bolsa-auxílio ou demissão por justa causa).
O acompanhamento da conduta tem caráter eminentemente pedagógico e orientativo, podendo o descumprimento das normas resultar em ausência injustificada com desconto proporcional na bolsa-auxílio referente aos dias não trabalhados, ou, em casos de reincidência e infrações graves que comprometam o caráter educativo do estágio, na rescisão antecipada do Termo de Compromisso de Estágio (TCE).
As desviações de conduta classificam-se para fins orientativos da seguinte forma:
A) Desvios Leves (Orientação Pedagógica)
O que é: Desvios pontuais decorrentes de desatenção ou adaptação, sem prejuízo direto à operação ou ao atendimento.
Exemplo Prático: Chegar com alguns minutos de atraso de forma isolada; comparecer ao escritório em um dia presencial vestindo uma calça jeans levemente fora do padrão (ex: com um pequeno detalhe desfiado) após aviso prévio verbal; ou esquecer de preencher um campo secundário em um relatório do sistema, corrigindo-o logo em seguida mediante aviso do supervisor.
Medida Aplicada: Diálogo de alinhamento e Orientação Verbal Pedagógica.
B) Desvios Médios (Advertência Educativa Formal)
O que é: Atitudes que demonstram negligência com as normas orientadas ou reincidência em desvios leves já conversados.
Exemplo Prático: Reincidir no descumprimento do dress code (ex: ir trabalhar repetidamente com roupas de academia ou shorts/saias acima do joelho, mesmo após orientação prévia); apresentar faltas ou atrasos frequentes e injustificados; ou demonstrar desorganização recorrente nos registros sistêmicos essenciais da integração (atrasando o fluxo de dados para a equipe).
Medida Aplicada: Advertência Educativa Formal por Escrito.

C) Infrações Graves (Causas de Rescisão Antecipada do TCE)
O que é: Condutas que rompem a confiança institucional, comprometem a segurança dos dados ou violam preceitos fundamentais da ética profissional e da Lei do Estágio.
Exemplo Prático:
Recusar-se ativamente a utilizar o sistema oficial vigente da empresa ou omitir deliberadamente o registro das atividades contratuais.
Insubordinação direta às orientações e aos processos metodológicos determinados pela gestão.
Sair, remover-se ou abandonar os grupos de comunicação corporativa utilizando o número da linha telefônica corporativa fornecida pela empresa.
Recusar-se ou negligenciar o atendimento a clientes ou fluxos essenciais de contratos e cobranças.
Utilizar linguagem agressiva, hostil ou de baixo calão com clientes, candidatos, colegas ou supervisores.
Omitir ou adulterar o número de candidatos ativos repassado à diretoria/clientes.
Vazar dados sigilosos ou pessoais, violando as diretrizes da LGPD.
Medida Aplicada: Rescisão Antecipada e Imediata do Termo de Compromisso de Estágio (TCE), cessando o vínculo educativo de forma sumária.

7. TERMO DE CIÊNCIA E CONCORDÂNCIA
Declaro ter recebido, lido e compreendido os termos deste Regimento Interno e Código de Conduta – Integração de Estágio, compreendendo perfeitamente o caráter educativo, as normas de convivência, a importância do uso dos sistemas institucionais e as diretrizes da Lei do Estágio aplicadas à minha formação profissional. Concordo que este documento complementa o meu Termo de Compromisso de Estágio (TCE).
[Cidade/UF], [Dia] de [Mês] de [Ano].


_________________________________________________________________________
NOME DO ESTAGIÁRIO: CPF:

_________________________________________________________________________
(Se menor de idade) NOME DO RESPONSÁVEL LEGAL: CPF:

_________________________________________________________________________
MOTIVAR RH LTDA. Diretoria / Supervisão de Estágio
`;

function money(value?: number | null) {
  if (value == null || !Number.isFinite(Number(value))) return "";
  return Number(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function datePtBr(value?: Date | string | null) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function cityDate(data: InternalWorkerData) {
  const place = [data.city, data.state].filter(Boolean).join("/");
  const formatted = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return `${place || "São Paulo/SP"}, ${formatted}`;
}

function replaceAll(text: string, replacements: Array<[string, string]>) {
  let output = text;
  for (const [from, to] of replacements) {
    output = output.split(from).join(to);
  }
  return output;
}

export function documentLabel(type: InternalDocumentType) {
  switch (type) {
    case "CONTRATO_TRABALHO":
      return "Contrato Individual de Trabalho";
    case "REGIMENTO_COLABORADOR":
      return "Regimento Interno e Código de Conduta";
    case "TCE":
      return "Termo de Compromisso de Estágio (TCE)";
    case "REGIMENTO_ESTAGIARIO":
      return "Regimento Interno e Código de Conduta — Estagiário";
  }
}

export function documentsForWorkerType(type: InternalWorkerType): InternalDocumentType[] {
  return type === "CLT"
    ? ["CONTRATO_TRABALHO", "REGIMENTO_COLABORADOR"]
    : ["TCE", "REGIMENTO_ESTAGIARIO"];
}

export function buildInternalDocument(
  type: InternalDocumentType,
  data: InternalWorkerData
) {
  const contractorCnpj =
    process.env.MOTIVAR_RH_CNPJ || "11.333.607/0001-00";

  const contractorAddress =
    process.env.MOTIVAR_RH_ADDRESS ||
    "R. Sete de Abril, 296 - República, São Paulo - SP, 01044-000";

  let text =
    type === "CONTRATO_TRABALHO"
      ? CONTRACT_CLT
      : type === "REGIMENTO_COLABORADOR"
      ? CONDUCT_CLT
      : type === "TCE"
      ? TCE
      : CONDUCT_INTERN;

  if (type === "TCE") {
    // Substituições contextuais para evitar trocar o CNPJ/CPF/valor errado,
    // pois o documento-fonte usa o mesmo placeholder em mais de uma parte.
    text = text.replace(
      "CONCEDENTE (EMPRESA): MOTIVAR RH LTDA., pessoa jurídica de direito privado, inscrita no CNPJ/MF sob o nº [Inserir CNPJ], com sede na [Inserir Endereço Completo]",
      `CONCEDENTE (EMPRESA): MOTIVAR RH LTDA., pessoa jurídica de direito privado, inscrita no CNPJ/MF sob o nº ${contractorCnpj}, com sede na ${contractorAddress}`
    );

    text = text.replace(
      "ESTAGIÁRIO(A): [NOME COMPLETO DO ESTAGIÁRIO], inscrito(a) no CPF sob o nº [Inserir CPF], RG nº [Inserir RG], residente e domiciliado(a) na [Endereço Completo]",
      `ESTAGIÁRIO(A): ${data.full_name || ""}, inscrito(a) no CPF sob o nº ${data.cpf || ""}, RG nº ${data.rg || ""}, residente e domiciliado(a) na ${data.address || ""}`
    );

    text = text.replace(
      "(Interveniente / Responsável Legal, obrigatório se menor de idade): [Nome do Responsável Legal], inscrito(a) no CPF sob o nº [Inserir CPF].",
      `(Interveniente / Responsável Legal, obrigatório se menor de idade): ${data.guardian_name || "Não aplicável"}, inscrito(a) no CPF sob o nº ${data.guardian_cpf || "Não aplicável"}.`
    );

    text = text.replace(
      "INSTITUIÇÃO DE ENSINO: [Nome da Instituição de Ensino], inscrita no CNPJ sob o nº [Inserir CNPJ], com sede na [Endereço da Instituição].",
      `INSTITUIÇÃO DE ENSINO: ${data.institution_name || ""}, inscrita no CNPJ sob o nº ${data.institution_cnpj || ""}, com sede na ${data.institution_address || ""}.`
    );

    text = text.replace(
      "[Nome do Curso, ex: Administração / Direito]",
      data.course_name || ""
    );
    text = text.replace(
      "[Nome da Faculdade/Universidade]",
      data.institution_name || ""
    );
    text = text.replace("[Inserir Semestre/Ano]", data.semester || "");
    text = text.replace(
      "[ex: segunda a sexta-feira, das 09:00 às 16:00, com 1 hora de intervalo para descanso e alimentação]",
      data.internship_schedule || ""
    );

    text = text.replace(
      "R$ [Inserir Valor, ex: 1.200,00] ([Valor por extenso])",
      `R$ ${money(data.stipend_amount)} (${data.stipend_words || ""})`
    );
    text = text.replace(
      "R$ [Inserir Valor, ex: 200,00] ([Valor por extenso])",
      `R$ ${money(data.transport_amount)} (${data.transport_words || ""})`
    );
    text = text.replace(
      "R$ [Inserir Valor, ex: 300,00] ([Valor por extenso])",
      `R$ ${money(data.meal_amount)} (${data.meal_words || ""})`
    );

    text = text.replace("[Data de Início]", datePtBr(data.internship_start));
    text = text.replace("[Data de Término]", datePtBr(data.internship_end));
    text = text.replace(
      "[Inserir Cidade/Região ou Estado]",
      data.non_compete_territory ||
        [data.city, data.state].filter(Boolean).join("/")
    );
    text = text.replace(
      "[NOME DA INSTITUIÇÃO DE ENSINO]",
      data.institution_name || ""
    );

    text = text.replace(
      "[Cidade/UF], [Dia] de [Mês] de [Ano].",
      `${cityDate(data)}.`
    );
    text = text.replace(
      "[Cidade/UF], [Dia] de [Mês] de [Ano]",
      cityDate(data)
    );

    text = text.replace(
      "NOME DO ESTAGIÁRIO: CPF:",
      `NOME DO ESTAGIÁRIO: ${data.full_name || ""}    CPF: ${data.cpf || ""}`
    );

    text = text.replace(
      "(Se menor de idade) NOME DO RESPONSÁVEL LEGAL: CPF:",
      `(Se menor de idade) NOME DO RESPONSÁVEL LEGAL: ${
        data.guardian_name || "Não aplicável"
      }    CPF: ${data.guardian_cpf || "Não aplicável"}`
    );

    return text.trim();
  }

  if (type === "REGIMENTO_ESTAGIARIO") {
    text = text.replace(
      "[Cidade/UF], [Dia] de [Mês] de [Ano].",
      `${cityDate(data)}.`
    );
    text = text.replace(
      "[Cidade/UF], [Dia] de [Mês] de [Ano]",
      cityDate(data)
    );
    text = text.replace(
      "NOME DO ESTAGIÁRIO: CPF:",
      `NOME DO ESTAGIÁRIO: ${data.full_name || ""}    CPF: ${data.cpf || ""}`
    );
    text = text.replace(
      "(Se menor de idade) NOME DO RESPONSÁVEL LEGAL: CPF:",
      `(Se menor de idade) NOME DO RESPONSÁVEL LEGAL: ${
        data.guardian_name || "Não aplicável"
      }    CPF: ${data.guardian_cpf || "Não aplicável"}`
    );
    return text.trim();
  }

  const general: Array<[string, string]> = [
    ["[Inserir CNPJ]", contractorCnpj],
    ["[Inserir Endereço Completo]", contractorAddress],
    ["[NOME COMPLETO DO COLABORADOR]", data.full_name || ""],
    ["[Inserir CPF]", data.cpf || ""],
    ["[Inserir RG]", data.rg || ""],
    ["[Inserir Série/UF]", data.ctps || ""],
    ["[Endereço Completo]", data.address || ""],
    ["[Inserir Valor Sênior]", money(data.salary_amount)],
    ["[Valor por extenso]", data.salary_words || ""],
    [
      "[Inserir Cidade/Região ou Estado]",
      data.non_compete_territory ||
        [data.city, data.state].filter(Boolean).join("/"),
    ],
    ["[Cidade/UF], [Dia] de [Mês] de [Ano].", `${cityDate(data)}.`],
    ["[Cidade/UF], [Dia] de [Mês] de [Ano]", cityDate(data)],
    ["NOME DO COLABORADOR: CPF:", `NOME DO COLABORADOR: ${data.full_name || ""}    CPF: ${data.cpf || ""}`],
  ];

  text = replaceAll(text, general);

  if (type === "CONTRATO_TRABALHO") {
    const schedules: Array<[string, string]> = [
      [
        "Segunda-feira (Home Office): Das às",
        `Segunda-feira (Home Office): ${data.monday_schedule || "Horário a definir"}`,
      ],
      [
        "Terça-feira (Presencial): Das às",
        `Terça-feira (Presencial): ${data.tuesday_schedule || "Horário a definir"}`,
      ],
      [
        "Quarta-feira (Presencial): Das às",
        `Quarta-feira (Presencial): ${data.wednesday_schedule || "Horário a definir"}`,
      ],
      [
        "Quinta-feira (Presencial): Das às",
        `Quinta-feira (Presencial): ${data.thursday_schedule || "Horário a definir"}`,
      ],
      [
        "Sexta-feira (Home Office): Das às",
        `Sexta-feira (Home Office): ${data.friday_schedule || "Horário a definir"}`,
      ],
    ];

    text = replaceAll(text, schedules);
  }

  return text.trim();
}

