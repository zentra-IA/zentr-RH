"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type Period =
  | "today"
  | "yesterday"
  | "7d"
  | "15d"
  | "30d"
  | "90d"
  | "1y";

type OverviewData = {
  success?: boolean;
  generatedAt?: string;
  overview?: Record<string, number | null | undefined>;
  events?: Array<Record<string, any>>;
  alerts?: Array<Record<string, any>>;
  productivity?: Array<Record<string, any>>;
};

type LiveData = {
  success?: boolean;
  globalAccess?: boolean;
  generatedAt?: string;
  summary?: {
    online?: number;
    active?: number;
    idle?: number;
    sessions?: number;
  };
  modules?: Record<string, number>;
  sessions?: Array<Record<string, any>>;
  companies?: Array<{
    id: string;
    name: string;
  }>;
};

type NavigationData = {
  success?: boolean;
  globalAccess?: boolean;
  generatedAt?: string;
  summary?: {
    activities?: number;
    pagesVisited?: number;
    exits?: number;
    totalSeconds?: number;
  };
  activities?: Array<Record<string, any>>;
  filters?: {
    modules?: string[];
    actions?: string[];
    users?: Array<Record<string, any>>;
    companies?: Array<Record<string, any>>;
  };
};

type AlertsData = {
  success?: boolean;
  globalAccess?: boolean;
  alerts?: Array<Record<string, any>>;
  summary?: {
    total?: number;
    critical?: number;
    high?: number;
    medium?: number;
    low?: number;
  };
};

type CommandEvent = Record<string, any> & {
  id?: string;
  action?: string;
  user_id?: string;
  userId?: string;
  module?: string;
  description?: string;
  metadata?: Record<string, any>;
  duration?: number;
};

type DashboardState = {
  overview: OverviewData | null;
  live: LiveData | null;
  navigation: NavigationData | null;
  alerts: AlertsData | null;
};

type OperationalMetric = {
  key: string;
  label: string;
  icon: string;
  value: number;
  detail: string;
  module?: string;
  tone?: "default" | "success" | "warning" | "danger";
};

const PERIODS: Array<{
  value: Period;
  label: string;
  overviewValue: string;
  navigationValue: string;
}> = [
  {
    value: "today",
    label: "Hoje",
    overviewValue: "7d",
    navigationValue: "24h",
  },
  {
    value: "yesterday",
    label: "Ontem",
    overviewValue: "7d",
    navigationValue: "24h",
  },
  {
    value: "7d",
    label: "7 dias",
    overviewValue: "7d",
    navigationValue: "7d",
  },
  {
    value: "15d",
    label: "15 dias",
    overviewValue: "15d",
    navigationValue: "15d",
  },
  {
    value: "30d",
    label: "30 dias",
    overviewValue: "30d",
    navigationValue: "30d",
  },
  {
    value: "90d",
    label: "90 dias",
    overviewValue: "90d",
    navigationValue: "90d",
  },
  {
    value: "1y",
    label: "1 ano",
    overviewValue: "1y",
    navigationValue: "90d",
  },
];

const ACTION_LABELS: Record<string, string> = {
  page_enter: "entrou em",
  page_leave: "saiu de",
  page_activity: "teve atividade em",
  command_center_tested: "testou o Centro de Comando",
  client_created: "criou o cliente",
  client_updated: "atualizou o cliente",
  client_deleted: "excluiu o cliente",
  company_contacts_insert: "criou o cliente",
  company_contacts_update: "atualizou o cliente",
  company_contacts_delete: "excluiu o cliente",
  job_created: "criou a vaga",
  job_updated: "atualizou a vaga",
  job_published: "publicou a vaga",
  job_paused: "pausou a vaga",
  job_closed: "encerrou a vaga",
  job_deleted: "excluiu a vaga",
  job_insert: "criou a vaga",
  job_update: "atualizou a vaga",
  job_delete: "excluiu a vaga",
  candidate_created: "cadastrou o candidato",
  candidate_updated: "atualizou o candidato",
  candidate_deleted: "excluiu o candidato",
  candidate_status_changed: "alterou o status do candidato",
  candidateprofile_insert: "cadastrou o candidato",
  candidateprofile_update: "atualizou o candidato",
  candidateprofile_delete: "excluiu o candidato",
  lead_created: "adicionou um candidato ao funil",
  lead_updated: "atualizou um candidato no funil",
  lead_stage_changed: "moveu um candidato no funil",
  lead_deleted: "removeu um candidato do funil",
  interview_scheduled: "marcou uma entrevista",
  interview_created: "marcou uma entrevista",
  interview_updated: "atualizou uma entrevista",
  interview_completed: "concluiu uma entrevista",
  interview_approved: "aprovou uma entrevista",
  interview_rejected: "reprovou uma entrevista",
  interview_canceled: "cancelou uma entrevista",
  interview_no_show: "registrou ausência em entrevista",
  interview_insert: "marcou uma entrevista",
  interview_update: "atualizou uma entrevista",
  hiring_started: "iniciou uma contratação",
  hiring_created: "criou uma contratação",
  hiring_updated: "atualizou uma contratação",
  hiring_completed: "concluiu uma contratação",
  hiring_canceled: "cancelou uma contratação",
  hiring_waiting_documents: "moveu contratação para documentos",
  hiringprocess_insert: "iniciou uma contratação",
  hiringprocess_update: "atualizou uma contratação",
  task_created: "criou a tarefa",
  task_updated: "atualizou a tarefa",
  task_started: "iniciou a tarefa",
  task_completed: "concluiu a tarefa",
  task_waiting: "colocou a tarefa em espera",
  task_reopened: "reabriu a tarefa",
  task_deleted: "excluiu a tarefa",
  candidate_presented: "enviou um candidato ao cliente",
  candidate_presentation_updated: "atualizou o envio de candidato",
  candidate_presentation_status_changed:
    "alterou o status do candidato enviado",
  message_sent: "enviou uma mensagem",
  whatsapp_sent: "enviou uma mensagem no WhatsApp",
  whatsapp_received: "recebeu uma resposta no WhatsApp",
  campaign_started: "iniciou um disparo",
  campaign_completed: "concluiu um disparo",
  document_uploaded: "enviou um documento",
  document_approved: "aprovou um documento",
  document_rejected: "reprovou um documento",
  user_login: "entrou no sistema",
  user_logout: "saiu do sistema",
};

const MODULE_LABELS: Record<string, string> = {
  clientes: "Clientes",
  vagas: "Vagas",
  candidatos: "Candidatos",
  recrutamento: "Recrutamento",
  entrevistas: "Entrevistas",
  contratacoes: "Contratações",
  tarefas: "Tarefas",
  mensagens: "Mensagens",
  whatsapp: "WhatsApp",
  disparos: "Disparos",
  campanhas: "Campanhas",
  documentos: "Documentos",
  apresentacoes: "Candidatos enviados",
  dashboard: "Dashboard",
  navigation: "Navegação",
  centro_de_comando: "Centro de Comando",
  sistema: "Sistema",
};

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function asNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalize(value: unknown): string {
  return String(value ?? "").toLowerCase().trim();
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function formatRelative(value?: string | null) {
  if (!value) return "sem horário";

  const timestamp = new Date(value).getTime();

  if (Number.isNaN(timestamp)) return "sem horário";

  const seconds = Math.max(
    0,
    Math.floor((Date.now() - timestamp) / 1000)
  );

  if (seconds < 10) return "agora";
  if (seconds < 60) return `há ${seconds}s`;
  if (seconds < 3600) return `há ${Math.floor(seconds / 60)}min`;
  if (seconds < 86400) return `há ${Math.floor(seconds / 3600)}h`;

  return `há ${Math.floor(seconds / 86400)}d`;
}

function formatDuration(seconds?: number | null) {
  const safeSeconds = Math.max(0, asNumber(seconds));

  if (safeSeconds < 60) return `${safeSeconds}s`;
  if (safeSeconds < 3600) {
    return `${Math.floor(safeSeconds / 60)}min`;
  }

  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);

  return `${hours}h ${minutes}min`;
}

function moduleLabel(value?: string | null) {
  const normalized = normalize(value);

  return (
    MODULE_LABELS[normalized] ||
    normalized.replaceAll("_", " ") ||
    "Sistema"
  );
}

function actionLabel(value?: string | null) {
  const normalized = normalize(value);

  return (
    ACTION_LABELS[normalized] ||
    normalized.replaceAll("_", " ") ||
    "executou uma ação"
  );
}

function eventTimestamp(event: Record<string, any>) {
  return (
    event.occurred_at ||
    event.created_at ||
    event.detected_at ||
    event.last_seen_at ||
    null
  );
}

function eventUser(event: Record<string, any>) {
  return (
    event.user_name ||
    event.name ||
    event.actor_name ||
    event.metadata?.userName ||
    event.metadata?.user_name ||
    event.user_email ||
    "Automação do sistema"
  );
}

function eventEntity(event: Record<string, any>) {
  return (
    event.entity_name ||
    event.metadata?.entityName ||
    event.metadata?.entity_name ||
    event.metadata?.title ||
    event.metadata?.name ||
    event.metadata?.jobTitle ||
    event.metadata?.candidateName ||
    event.metadata?.clientName ||
    event.metadata?.taskTitle ||
    event.display_description ||
    event.description ||
    event.entity_id ||
    event.entity ||
    event.page ||
    event.route ||
    ""
  );
}

function eventModule(event: Record<string, any>) {
  return (
    event.module ||
    event.metadata?.module ||
    event.entity_type ||
    "sistema"
  );
}

function eventDescription(event: Record<string, any>) {
  const explicit =
    event.display_description ||
    event.description ||
    event.metadata?.description;

  if (explicit) return String(explicit);

  const action = actionLabel(event.action);
  const entity = eventEntity(event);

  return entity ? `${action} ${entity}` : action;
}

function getChangedFields(event: Record<string, any>) {
  const oldData =
    event.old_data &&
    typeof event.old_data === "object"
      ? event.old_data
      : null;

  const newData =
    event.new_data &&
    typeof event.new_data === "object"
      ? event.new_data
      : null;

  if (!oldData || !newData) return [];

  const ignored = new Set([
    "updated_at",
    "created_at",
    "updatedAt",
    "createdAt",
  ]);

  return Array.from(
    new Set([...Object.keys(oldData), ...Object.keys(newData)])
  )
    .filter((field) => !ignored.has(field))
    .filter(
      (field) =>
        JSON.stringify(oldData[field]) !==
        JSON.stringify(newData[field])
    )
    .slice(0, 6)
    .map((field) => ({
      field,
      before: oldData[field],
      after: newData[field],
    }));
}

function actionMatches(
  event: Record<string, any>,
  fragments: string[]
) {
  const action = normalize(event.action);
  const moduleName = normalize(eventModule(event));
  const description = normalize(eventDescription(event));

  return fragments.some(
    (fragment) =>
      action.includes(fragment) ||
      moduleName.includes(fragment) ||
      description.includes(fragment)
  );
}

function periodStart(period: Period) {
  const now = new Date();

  if (period === "today") {
    return new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    ).getTime();
  }

  if (period === "yesterday") {
    return new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 1
    ).getTime();
  }

  const days =
    period === "7d"
      ? 7
      : period === "15d"
      ? 15
      : period === "30d"
      ? 30
      : period === "90d"
      ? 90
      : 365;

  return Date.now() - days * 24 * 60 * 60 * 1000;
}

function periodEnd(period: Period) {
  if (period !== "yesterday") return Date.now();

  const now = new Date();

  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();
}

export default function CommandCenterPage() {
  const [period, setPeriod] = useState<Period>("today");
  const [selectedModule, setSelectedModule] = useState("all");
  const [selectedUser, setSelectedUser] = useState("all");
  const [search, setSearch] = useState("");
  const [state, setState] = useState<DashboardState>({
    overview: null,
    live: null,
    navigation: null,
    alerts: null,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [selectedEvent, setSelectedEvent] =
    useState<Record<string, any> | null>(null);

  const periodConfig =
    PERIODS.find((item) => item.value === period) || PERIODS[0];

  const load = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);

      setErrors([]);

      const endpoints = {
        overview: `/api/command-center/overview?period=${encodeURIComponent(
          periodConfig.overviewValue
        )}`,
        live: "/api/command-center/live",
        navigation: `/api/command-center/navigation?period=${encodeURIComponent(
          periodConfig.navigationValue
        )}&limit=1000`,
        alerts: "/api/command-center/alerts?status=open",
      };

      const results = await Promise.allSettled(
        Object.entries(endpoints).map(async ([key, endpoint]) => {
          const response = await fetch(endpoint, {
            credentials: "include",
            cache: "no-store",
          });

          const payload = await response.json().catch(() => ({}));

          if (!response.ok) {
            throw new Error(
              `${key}: ${payload.error || `HTTP ${response.status}`}`
            );
          }

          return [key, payload] as const;
        })
      );

      const nextState: DashboardState = {
        overview: null,
        live: null,
        navigation: null,
        alerts: null,
      };
      const nextErrors: string[] = [];

      for (const result of results) {
        if (result.status === "fulfilled") {
          const [key, payload] = result.value;
          (nextState as any)[key] = payload;
        } else {
          nextErrors.push(result.reason?.message || "Erro desconhecido");
        }
      }

      setState(nextState);
      setErrors(nextErrors);
      setLoading(false);
      setRefreshing(false);
    },
    [
      periodConfig.navigationValue,
      periodConfig.overviewValue,
    ]
  );

  useEffect(() => {
    void load();

    const intervalId = window.setInterval(() => {
      void load(true);
    }, 30_000);

    return () => window.clearInterval(intervalId);
  }, [load]);

  const overviewEvents: CommandEvent[] =
    asArray<Record<string, any>>(
      state.overview?.events
    ).map(
      (event): CommandEvent => ({
        ...event,
      })
    );

  const navigationActivities: CommandEvent[] =
    asArray<Record<string, any>>(
      state.navigation?.activities
    ).map(
      (activity): CommandEvent => ({
        ...activity,
      })
    );

  const allEvents = useMemo<CommandEvent[]>(() => {
    const normalizedNavigation: CommandEvent[] =
      navigationActivities.map(
        (activity): CommandEvent => ({
          ...activity,
          module:
            activity.module ||
            activity.metadata?.module ||
            "navigation",
          description:
            activity.description ||
            (activity.action === "page_enter"
              ? `Entrou em ${
                  activity.page ||
                  activity.route
                }`
              : activity.action === "page_leave"
              ? `Saiu de ${
                  activity.page ||
                  activity.route
                }`
              : `Atividade em ${
                  activity.page ||
                  activity.route
                }`),
        })
      );

    const merged: CommandEvent[] = [
      ...overviewEvents,
      ...normalizedNavigation,
    ];

    const seen = new Set<string>();

    return merged
      .filter((event: CommandEvent) => {
        const key =
          event.id ||
          [
            event.action,
            event.user_id,
            eventTimestamp(event),
            eventEntity(event),
          ].join(":");

        if (seen.has(key)) return false;

        seen.add(key);
        return true;
      })
      .filter((event: CommandEvent) => {
        const timestamp = eventTimestamp(event);

        if (!timestamp) return true;

        const time = new Date(timestamp).getTime();

        if (Number.isNaN(time)) return true;

        return (
          time >= periodStart(period) &&
          time <= periodEnd(period)
        );
      })
      .sort(
        (a: CommandEvent, b: CommandEvent) =>
          new Date(eventTimestamp(b) || 0).getTime() -
          new Date(eventTimestamp(a) || 0).getTime()
      );
  }, [navigationActivities, overviewEvents, period]);

  const users = useMemo(() => {
    const entries = new Map<string, string>();

    for (const event of allEvents) {
      const id =
        event.user_id ||
        event.userId ||
        eventUser(event);

      entries.set(String(id), eventUser(event));
    }

    for (const session of asArray(state.live?.sessions)) {
      const id =
        session.user_id ||
        session.userId ||
        session.user_name;

      entries.set(
        String(id),
        session.user_name ||
          session.name ||
          session.user_email ||
          "Usuário"
      );
    }

    return Array.from(entries.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) =>
        a.name.localeCompare(b.name, "pt-BR")
      );
  }, [allEvents, state.live?.sessions]);

  const modules = useMemo(() => {
    return Array.from(
      new Set(
        allEvents
          .map((event) => normalize(eventModule(event)))
          .filter(Boolean)
      )
    ).sort();
  }, [allEvents]);

  const filteredEvents = useMemo(() => {
    const normalizedSearch = normalize(search);

    return allEvents.filter((event) => {
      const moduleName = normalize(eventModule(event));
      const userId = String(
        event.user_id ||
          event.userId ||
          eventUser(event)
      );

      if (
        selectedModule !== "all" &&
        moduleName !== selectedModule
      ) {
        return false;
      }

      if (
        selectedUser !== "all" &&
        userId !== selectedUser
      ) {
        return false;
      }

      if (!normalizedSearch) return true;

      const searchable = [
        eventUser(event),
        eventDescription(event),
        eventEntity(event),
        eventModule(event),
        event.action,
        event.metadata?.jobTitle,
        event.metadata?.candidateName,
        event.metadata?.clientName,
        event.metadata?.phone,
        event.metadata?.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(normalizedSearch);
    });
  }, [
    allEvents,
    search,
    selectedModule,
    selectedUser,
  ]);

  const counts = useMemo(() => {
    const count = (fragments: string[]) =>
      allEvents.filter((event) =>
        actionMatches(event, fragments)
      ).length;

    return {
      clientsCreated: count([
        "client_created",
        "company_contacts_insert",
        "criou o cliente",
      ]),
      clientsUpdated: count([
        "client_updated",
        "company_contacts_update",
      ]),
      jobsCreated: count([
        "job_created",
        "job_insert",
        "criou a vaga",
      ]),
      jobsPublished: count([
        "job_published",
        "publicou a vaga",
      ]),
      candidatesCreated: count([
        "candidate_created",
        "candidateprofile_insert",
        "lead_created",
        "cadastrou o candidato",
      ]),
      candidateMoves: count([
        "candidate_status_changed",
        "lead_stage_changed",
        "moveu",
      ]),
      interviews: count([
        "interview_scheduled",
        "interview_created",
        "interview_insert",
        "marcou uma entrevista",
      ]),
      interviewsCompleted: count([
        "interview_completed",
        "interview_approved",
        "interview_rejected",
      ]),
      presentations: count([
        "candidate_presented",
        "presentation",
      ]),
      hirings: count([
        "hiring_started",
        "hiring_created",
        "hiringprocess_insert",
      ]),
      hiringsCompleted: count([
        "hiring_completed",
        "contratado",
      ]),
      tasksCreated: count([
        "task_created",
        "criou a tarefa",
      ]),
      tasksCompleted: count([
        "task_completed",
        "concluiu a tarefa",
      ]),
      messages: count([
        "message_sent",
        "whatsapp_sent",
        "mensagem",
      ]),
      responses: count([
        "whatsapp_received",
        "response",
        "resposta",
      ]),
      campaigns: count([
        "campaign_started",
        "campaign_completed",
        "disparo",
      ]),
      documents: count([
        "document_uploaded",
        "document_approved",
        "document_rejected",
      ]),
      deletions: count([
        "_deleted",
        "_delete",
        "excluiu",
        "removeu",
      ]),
      navigation: count(["page_enter"]),
    };
  }, [allEvents]);

  const operationalMetrics = useMemo<OperationalMetric[]>(
    () => [
      {
        key: "online",
        icon: "🟢",
        label: "Usuários online agora",
        value: asNumber(state.live?.summary?.online),
        detail: `${asNumber(
          state.live?.summary?.active
        )} ativos · ${asNumber(
          state.live?.summary?.idle
        )} ociosos`,
        tone: "success",
      },
      {
        key: "clients",
        icon: "🏢",
        label: "Clientes criados",
        value: counts.clientsCreated,
        detail: `${counts.clientsUpdated} atualizações`,
        module: "clientes",
      },
      {
        key: "jobs",
        icon: "💼",
        label: "Vagas criadas",
        value: counts.jobsCreated,
        detail: `${counts.jobsPublished} publicadas`,
        module: "vagas",
      },
      {
        key: "candidates",
        icon: "👤",
        label: "Novos candidatos",
        value: counts.candidatesCreated,
        detail: `${counts.candidateMoves} movimentações`,
        module: "candidatos",
      },
      {
        key: "interviews",
        icon: "📅",
        label: "Entrevistas marcadas",
        value: counts.interviews,
        detail: `${counts.interviewsCompleted} finalizadas`,
        module: "entrevistas",
      },
      {
        key: "presentations",
        icon: "📤",
        label: "Candidatos enviados",
        value: counts.presentations,
        detail: "Apresentações aos clientes",
        module: "apresentacoes",
      },
      {
        key: "hirings",
        icon: "✅",
        label: "Contratações movimentadas",
        value: counts.hirings,
        detail: `${counts.hiringsCompleted} concluídas`,
        module: "contratacoes",
      },
      {
        key: "tasks",
        icon: "📋",
        label: "Tarefas criadas",
        value: counts.tasksCreated,
        detail: `${counts.tasksCompleted} concluídas`,
        module: "tarefas",
      },
      {
        key: "messages",
        icon: "💬",
        label: "Mensagens enviadas",
        value: counts.messages,
        detail: `${counts.responses} respostas`,
        module: "mensagens",
      },
      {
        key: "campaigns",
        icon: "📣",
        label: "Disparos e campanhas",
        value: counts.campaigns,
        detail: "Ações registradas",
        module: "disparos",
      },
      {
        key: "documents",
        icon: "📄",
        label: "Documentos movimentados",
        value: counts.documents,
        detail: "Envios e avaliações",
        module: "documentos",
      },
      {
        key: "critical",
        icon: "🚨",
        label: "Alertas abertos",
        value: asNumber(
          state.alerts?.summary?.total ??
            state.overview?.overview?.openAlerts
        ),
        detail: `${asNumber(
          state.alerts?.summary?.critical
        )} críticos · ${counts.deletions} exclusões`,
        tone:
          asNumber(state.alerts?.summary?.total) > 0
            ? "danger"
            : "success",
      },
    ],
    [counts, state]
  );

  const userPerformance = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        actions: number;
        clients: number;
        jobs: number;
        candidates: number;
        interviews: number;
        hirings: number;
        tasks: number;
        messages: number;
        lastActivity: string | null;
        currentPage: string | null;
        online: boolean;
        idleSeconds: number;
      }
    >();

    for (const event of allEvents) {
      const id = String(
        event.user_id ||
          event.userId ||
          eventUser(event)
      );

      const current =
        map.get(id) || {
          id,
          name: eventUser(event),
          actions: 0,
          clients: 0,
          jobs: 0,
          candidates: 0,
          interviews: 0,
          hirings: 0,
          tasks: 0,
          messages: 0,
          lastActivity: null,
          currentPage: null,
          online: false,
          idleSeconds: 0,
        };

      current.actions += 1;

      if (actionMatches(event, ["client", "clientes"])) {
        current.clients += 1;
      }

      if (actionMatches(event, ["job", "vaga"])) {
        current.jobs += 1;
      }

      if (
        actionMatches(event, [
          "candidate",
          "candidato",
          "lead_",
        ])
      ) {
        current.candidates += 1;
      }

      if (
        actionMatches(event, [
          "interview",
          "entrevista",
        ])
      ) {
        current.interviews += 1;
      }

      if (
        actionMatches(event, [
          "hiring",
          "contratacao",
          "contratação",
        ])
      ) {
        current.hirings += 1;
      }

      if (actionMatches(event, ["task", "tarefa"])) {
        current.tasks += 1;
      }

      if (
        actionMatches(event, [
          "message",
          "mensagem",
          "whatsapp",
        ])
      ) {
        current.messages += 1;
      }

      const timestamp = eventTimestamp(event);

      if (
        timestamp &&
        (!current.lastActivity ||
          new Date(timestamp).getTime() >
            new Date(current.lastActivity).getTime())
      ) {
        current.lastActivity = timestamp;
      }

      map.set(id, current);
    }

    for (const session of asArray(state.live?.sessions)) {
      const id = String(
        session.user_id ||
          session.userId ||
          session.user_name
      );

      const current =
        map.get(id) || {
          id,
          name:
            session.user_name ||
            session.name ||
            session.user_email ||
            "Usuário",
          actions: 0,
          clients: 0,
          jobs: 0,
          candidates: 0,
          interviews: 0,
          hirings: 0,
          tasks: 0,
          messages: 0,
          lastActivity: null,
          currentPage: null,
          online: false,
          idleSeconds: 0,
        };

      current.online = Boolean(session.online);
      current.currentPage =
        session.current_page ||
        session.current_route ||
        null;
      current.idleSeconds = asNumber(
        session.idle_seconds
      );

      if (session.last_activity) {
        current.lastActivity = session.last_activity;
      }

      map.set(id, current);
    }

    return Array.from(map.values()).sort(
      (a, b) => b.actions - a.actions
    );
  }, [allEvents, state.live?.sessions]);

  const moduleSummary = useMemo(() => {
    const map = new Map<
      string,
      {
        module: string;
        total: number;
        users: Set<string>;
        lastEvent: Record<string, any> | null;
      }
    >();

    for (const event of allEvents) {
      const moduleName = normalize(eventModule(event));
      const current =
        map.get(moduleName) || {
          module: moduleName,
          total: 0,
          users: new Set<string>(),
          lastEvent: null,
        };

      current.total += 1;
      current.users.add(eventUser(event));

      if (
        !current.lastEvent ||
        new Date(eventTimestamp(event) || 0).getTime() >
          new Date(
            eventTimestamp(current.lastEvent) || 0
          ).getTime()
      ) {
        current.lastEvent = event;
      }

      map.set(moduleName, current);
    }

    return Array.from(map.values()).sort(
      (a, b) => b.total - a.total
    );
  }, [allEvents]);

  const diagnostics = useMemo(() => {
    const items: Array<{
      tone: "info" | "warning" | "danger" | "success";
      title: string;
      description: string;
      action: string;
    }> = [];

    const inactiveUsers = userPerformance.filter(
      (user) =>
        !user.online &&
        user.lastActivity &&
        Date.now() -
          new Date(user.lastActivity).getTime() >
          4 * 60 * 60 * 1000
    );

    if (inactiveUsers.length > 0) {
      items.push({
        tone: "warning",
        title: `${inactiveUsers.length} usuário(s) sem atividade recente`,
        description: `${inactiveUsers
          .slice(0, 3)
          .map((user) => user.name)
          .join(", ")} não apresentam movimentação nas últimas horas.`,
        action: "Verificar distribuição de demandas e rotina de trabalho.",
      });
    }

    const idleUsers = userPerformance.filter(
      (user) => user.online && user.idleSeconds >= 300
    );

    if (idleUsers.length > 0) {
      items.push({
        tone: "warning",
        title: `${idleUsers.length} usuário(s) online e ocioso(s)`,
        description: `${idleUsers
          .slice(0, 3)
          .map(
            (user) =>
              `${user.name} (${formatDuration(
                user.idleSeconds
              )})`
          )
          .join(", ")}.`,
        action:
          "Confirmar se estão em entrevista, reunião ou aguardando demanda.",
      });
    }

    if (
      counts.jobsCreated > 0 &&
      counts.candidatesCreated === 0
    ) {
      items.push({
        tone: "danger",
        title: "Vagas criadas sem entrada de candidatos",
        description: `${counts.jobsCreated} vaga(s) foram criadas no período, mas nenhum novo candidato foi registrado.`,
        action:
          "Revisar divulgação, descrição da vaga e fontes de recrutamento.",
      });
    }

    if (
      counts.interviews > 0 &&
      counts.interviewsCompleted === 0
    ) {
      items.push({
        tone: "warning",
        title: "Entrevistas sem resultado registrado",
        description: `${counts.interviews} entrevista(s) foram marcadas e nenhuma conclusão foi identificada no período.`,
        action:
          "Solicitar feedback aos responsáveis e atualizar os resultados.",
      });
    }

    if (
      counts.tasksCreated >
      counts.tasksCompleted + 5
    ) {
      items.push({
        tone: "warning",
        title: "Acúmulo de tarefas em aberto",
        description: `${counts.tasksCreated} tarefas criadas contra ${counts.tasksCompleted} concluídas.`,
        action:
          "Revisar prioridades, responsáveis e prazos das tarefas.",
      });
    }

    if (
      counts.messages > 0 &&
      counts.responses === 0
    ) {
      items.push({
        tone: "warning",
        title: "Mensagens sem respostas registradas",
        description: `${counts.messages} mensagem(ns) enviadas sem resposta identificada.`,
        action:
          "Verificar conexões, campanhas e tempo médio de retorno.",
      });
    }

    if (
      asNumber(state.alerts?.summary?.critical) > 0
    ) {
      items.push({
        tone: "danger",
        title: `${asNumber(
          state.alerts?.summary?.critical
        )} alerta(s) crítico(s)`,
        description:
          "Existem processos que exigem ação administrativa imediata.",
        action:
          "Abrir Alertas e Gargalos e atribuir responsáveis.",
      });
    }

    const busiestUser = userPerformance[0];

    if (busiestUser && busiestUser.actions > 0) {
      items.push({
        tone: "info",
        title: `${busiestUser.name} concentra mais ações no período`,
        description: `${busiestUser.actions} movimentações registradas entre clientes, vagas, candidatos e demais módulos.`,
        action:
          "Validar se a carga está equilibrada entre os colaboradores.",
      });
    }

    if (items.length === 0) {
      items.push({
        tone: "success",
        title: "Operação sem anomalias relevantes",
        description:
          "Os dados disponíveis não indicam gargalos críticos neste momento.",
        action:
          "Continue acompanhando a timeline e os alertas automáticos.",
      });
    }

    return items.slice(0, 6);
  }, [
    counts,
    state.alerts?.summary?.critical,
    userPerformance,
  ]);

  const lastGeneratedAt =
    state.overview?.generatedAt ||
    state.navigation?.generatedAt ||
    state.live?.generatedAt ||
    new Date().toISOString();

  return (
    <main className="command-page">
      <header className="command-header">
        <div>
          <p className="eyebrow">
            Zentra RH · Supervisão operacional completa
          </p>

          <h1>Centro de Comando</h1>

          <p className="subtitle">
            Pessoas, clientes, vagas, candidatos, entrevistas,
            contratações, tarefas, mensagens e riscos em uma única
            visão.
          </p>
        </div>

        <div className="header-actions">
          <select
            value={period}
            onChange={(event) =>
              setPeriod(event.target.value as Period)
            }
            aria-label="Período"
          >
            {PERIODS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={loading || refreshing}
            onClick={() => void load(true)}
          >
            {loading || refreshing
              ? "Atualizando..."
              : "Atualizar operação"}
          </button>
        </div>
      </header>

      <nav className="command-shortcuts">
        <Link href="/crm/dashboard/command-center/bi">
          <span>📊</span>
          BI e indicadores
        </Link>

        <Link href="/crm/dashboard/command-center/live">
          <span>👥</span>
          Usuários online
        </Link>

        <Link href="/crm/dashboard/command-center/navigation">
          <span>🧭</span>
          Auditoria de navegação
        </Link>

        <Link href="/crm/dashboard/command-center/alerts">
          <span>🚨</span>
          Alertas e gargalos
        </Link>

        <Link href="/crm/dashboard/command-center/test-event">
          <span>🧪</span>
          Diagnóstico técnico
        </Link>
      </nav>

      {errors.length > 0 && (
        <section className="error-banner">
          <strong>
            Parte dos dados não pôde ser carregada.
          </strong>

          <span>{errors.join(" · ")}</span>
        </section>
      )}

      <section className="filter-bar">
        <label className="search-field">
          <span>Buscar em toda a operação</span>

          <input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Usuário, cliente, vaga, candidato, tarefa, ação..."
          />
        </label>

        <label>
          <span>Usuário</span>

          <select
            value={selectedUser}
            onChange={(event) =>
              setSelectedUser(event.target.value)
            }
          >
            <option value="all">
              Todos os usuários
            </option>

            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Módulo</span>

          <select
            value={selectedModule}
            onChange={(event) =>
              setSelectedModule(event.target.value)
            }
          >
            <option value="all">
              Todos os módulos
            </option>

            {modules.map((moduleName) => (
              <option
                key={moduleName}
                value={moduleName}
              >
                {moduleLabel(moduleName)}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="clear-button"
          onClick={() => {
            setSearch("");
            setSelectedUser("all");
            setSelectedModule("all");
          }}
        >
          Limpar filtros
        </button>
      </section>

      <section className="metrics-grid">
        {operationalMetrics.map((metric) => (
          <button
            type="button"
            className={`metric-card ${metric.tone || ""}`}
            key={metric.key}
            onClick={() => {
              if (metric.module) {
                setSelectedModule(metric.module);
              }

              document
                .getElementById("operation-feed")
                ?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
            }}
          >
            <span className="metric-icon">
              {metric.icon}
            </span>

            <strong>{metric.value}</strong>
            <span className="metric-label">
              {metric.label}
            </span>
            <small>{metric.detail}</small>
          </button>
        ))}
      </section>

      <section className="command-layout">
        <div className="main-column">
          <article className="panel live-panel">
            <div className="panel-header">
              <div>
                <span>Agora</span>
                <h2>Quem está fazendo o quê</h2>
              </div>

              <Link href="/crm/dashboard/command-center/live">
                Abrir monitor completo →
              </Link>
            </div>

            <div className="live-users-grid">
              {asArray(state.live?.sessions)
                .slice(0, 8)
                .map((session) => {
                  const idleSeconds = asNumber(
                    session.idle_seconds
                  );

                  const isIdle =
                    session.online && idleSeconds >= 60;

                  return (
                    <button
                      type="button"
                      className="live-user-card"
                      key={session.id}
                      onClick={() => {
                        const id = String(
                          session.user_id ||
                            session.user_name
                        );

                        setSelectedUser(id);

                        document
                          .getElementById("operation-feed")
                          ?.scrollIntoView({
                            behavior: "smooth",
                          });
                      }}
                    >
                      <div className="live-user-top">
                        <span
                          className={`presence ${
                            session.online
                              ? isIdle
                                ? "idle"
                                : "online"
                              : "offline"
                          }`}
                        />

                        <div>
                          <strong>
                            {session.user_name ||
                              session.name ||
                              "Usuário"}
                          </strong>

                          <small>
                            {session.user_role ||
                              session.user_email ||
                              "Colaborador"}
                          </small>
                        </div>
                      </div>

                      <div className="current-action">
                        <span>Tela atual</span>

                        <strong>
                          {session.current_page ||
                            moduleLabel(
                              session.current_module
                            )}
                        </strong>

                        <small>
                          {session.current_route ||
                            "Rota não identificada"}
                        </small>
                      </div>

                      <div className="live-user-footer">
                        <span>
                          {session.online
                            ? isIdle
                              ? `Ocioso ${formatDuration(
                                  idleSeconds
                                )}`
                              : "Ativo agora"
                            : "Offline"}
                        </span>

                        <span>
                          {formatRelative(
                            session.last_activity
                          )}
                        </span>
                      </div>
                    </button>
                  );
                })}

              {!loading &&
                asArray(state.live?.sessions).length ===
                  0 && (
                  <EmptyState
                    icon="👥"
                    title="Nenhuma sessão encontrada"
                    text="O heartbeat já está ativo. Os usuários aparecerão conforme acessarem o sistema."
                  />
                )}
            </div>
          </article>

          <article
            className="panel operation-feed"
            id="operation-feed"
          >
            <div className="panel-header">
              <div>
                <span>Operação ao vivo</span>

                <h2>
                  Tudo o que acontece no sistema
                </h2>
              </div>

              <strong className="event-count">
                {filteredEvents.length} eventos
              </strong>
            </div>

            <div className="feed-list">
              {filteredEvents.slice(0, 80).map((event) => {
                const changes = getChangedFields(event);

                return (
                  <button
                    type="button"
                    className="feed-event"
                    key={
                      event.id ||
                      `${event.action}-${eventTimestamp(
                        event
                      )}-${eventUser(event)}`
                    }
                    onClick={() => setSelectedEvent(event)}
                  >
                    <div className="feed-time">
                      <strong>
                        {new Intl.DateTimeFormat("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(
                          new Date(
                            eventTimestamp(event) ||
                              Date.now()
                          )
                        )}
                      </strong>

                      <span>
                        {formatRelative(
                          eventTimestamp(event)
                        )}
                      </span>
                    </div>

                    <div
                      className={`module-icon ${normalize(
                        eventModule(event)
                      )}`}
                    >
                      {getModuleIcon(eventModule(event))}
                    </div>

                    <div className="feed-content">
                      <div className="feed-main">
                        <strong>{eventUser(event)}</strong>
                        <span>
                          {eventDescription(event)}
                        </span>
                      </div>

                      <div className="feed-meta">
                        <span>
                          {moduleLabel(eventModule(event))}
                        </span>

                        {eventEntity(event) && (
                          <span>{eventEntity(event)}</span>
                        )}

                        {event.metadata?.status && (
                          <span>
                            Status: {event.metadata.status}
                          </span>
                        )}

                        {event.metadata?.resultsFound != null && (
                          <span>
                            {event.metadata.resultsFound} resultados
                          </span>
                        )}

                        {event.duration > 0 && (
                          <span>
                            {formatDuration(event.duration)} na tela
                          </span>
                        )}

                        {changes.length > 0 && (
                          <span className="changed-badge">
                            {changes.length} campo(s) alterado(s)
                          </span>
                        )}
                      </div>
                    </div>

                    <span className="feed-arrow">›</span>
                  </button>
                );
              })}

              {!loading &&
                filteredEvents.length === 0 && (
                  <EmptyState
                    icon="🛰️"
                    title="Nenhum evento para os filtros"
                    text="Altere o período ou remova os filtros para visualizar a operação."
                  />
                )}
            </div>
          </article>

          <article className="panel user-table-panel">
            <div className="panel-header">
              <div>
                <span>Equipe</span>
                <h2>Atividade por usuário</h2>
              </div>

              <small>
                Clique em um usuário para filtrar a timeline
              </small>
            </div>

            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Usuário</th>
                    <th>Status</th>
                    <th>Ações</th>
                    <th>Clientes</th>
                    <th>Vagas</th>
                    <th>Candidatos</th>
                    <th>Entrevistas</th>
                    <th>Contratações</th>
                    <th>Tarefas</th>
                    <th>Mensagens</th>
                    <th>Última atividade</th>
                  </tr>
                </thead>

                <tbody>
                  {userPerformance.map((user) => (
                    <tr
                      key={user.id}
                      onClick={() => {
                        setSelectedUser(user.id);

                        document
                          .getElementById("operation-feed")
                          ?.scrollIntoView({
                            behavior: "smooth",
                          });
                      }}
                    >
                      <td>
                        <div className="user-cell">
                          <span
                            className={`presence ${
                              user.online
                                ? user.idleSeconds >= 60
                                  ? "idle"
                                  : "online"
                                : "offline"
                            }`}
                          />

                          <div>
                            <strong>{user.name}</strong>

                            <small>
                              {user.currentPage ||
                                "Sem tela ativa"}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <StatusBadge
                          online={user.online}
                          idleSeconds={user.idleSeconds}
                        />
                      </td>
                      <td>{user.actions}</td>
                      <td>{user.clients}</td>
                      <td>{user.jobs}</td>
                      <td>{user.candidates}</td>
                      <td>{user.interviews}</td>
                      <td>{user.hirings}</td>
                      <td>{user.tasks}</td>
                      <td>{user.messages}</td>
                      <td>
                        {formatRelative(user.lastActivity)}
                      </td>
                    </tr>
                  ))}

                  {!loading &&
                    userPerformance.length === 0 && (
                      <tr>
                        <td colSpan={11}>
                          <EmptyState
                            icon="📊"
                            title="Sem dados de usuários"
                            text="As ações aparecerão conforme o sistema for utilizado."
                          />
                        </td>
                      </tr>
                    )}
                </tbody>
              </table>
            </div>
          </article>
        </div>

        <aside className="side-column">
          <article className="panel ai-panel">
            <div className="panel-header">
              <div>
                <span>Diagnóstico inteligente</span>
                <h2>O que exige atenção</h2>
              </div>

              <span className="ai-badge">IA</span>
            </div>

            <div className="diagnostics-list">
              {diagnostics.map((item, index) => (
                <div
                  className={`diagnostic ${item.tone}`}
                  key={`${item.title}-${index}`}
                >
                  <div className="diagnostic-top">
                    <span>{diagnosticIcon(item.tone)}</span>
                    <strong>{item.title}</strong>
                  </div>

                  <p>{item.description}</p>

                  <small>{item.action}</small>
                </div>
              ))}
            </div>
          </article>

          <article className="panel alerts-panel">
            <div className="panel-header">
              <div>
                <span>Prioridades</span>
                <h2>Alertas operacionais</h2>
              </div>

              <Link href="/crm/dashboard/command-center/alerts">
                Ver todos →
              </Link>
            </div>

            <div className="alerts-list">
              {asArray(state.alerts?.alerts)
                .slice(0, 8)
                .map((alert) => (
                  <div
                    className={`alert-item ${
                      alert.severity || "low"
                    }`}
                    key={alert.id}
                  >
                    <div className="alert-top">
                      <span>
                        {String(
                          alert.severity || "low"
                        ).toUpperCase()}
                      </span>

                      <time>
                        {formatRelative(
                          alert.detected_at
                        )}
                      </time>
                    </div>

                    <strong>{alert.title}</strong>

                    <p>
                      {alert.description ||
                        "Requer análise administrativa."}
                    </p>

                    {alert.responsible_name && (
                      <small>
                        Responsável:{" "}
                        {alert.responsible_name}
                      </small>
                    )}

                    {alert.recommended_action && (
                      <small>
                        Próxima ação:{" "}
                        {alert.recommended_action}
                      </small>
                    )}
                  </div>
                ))}

              {!loading &&
                asArray(state.alerts?.alerts).length ===
                  0 && (
                  <EmptyState
                    icon="🟢"
                    title="Operação sem alertas"
                    text="Nenhum alerta aberto neste momento."
                  />
                )}
            </div>
          </article>

          <article className="panel modules-panel">
            <div className="panel-header">
              <div>
                <span>Mapa operacional</span>
                <h2>Movimentação por módulo</h2>
              </div>
            </div>

            <div className="modules-list">
              {moduleSummary.slice(0, 12).map((item) => {
                const max =
                  moduleSummary[0]?.total || 1;

                return (
                  <button
                    type="button"
                    className="module-row"
                    key={item.module}
                    onClick={() => {
                      setSelectedModule(item.module);

                      document
                        .getElementById("operation-feed")
                        ?.scrollIntoView({
                          behavior: "smooth",
                        });
                    }}
                  >
                    <div className="module-row-top">
                      <div>
                        <span>
                          {getModuleIcon(item.module)}
                        </span>

                        <strong>
                          {moduleLabel(item.module)}
                        </strong>
                      </div>

                      <span>{item.total}</span>
                    </div>

                    <div className="module-progress">
                      <span
                        style={{
                          width: `${Math.max(
                            4,
                            (item.total / max) * 100
                          )}%`,
                        }}
                      />
                    </div>

                    <small>
                      {item.users.size} usuário(s) ·{" "}
                      {item.lastEvent
                        ? formatRelative(
                            eventTimestamp(item.lastEvent)
                          )
                        : "sem atividade"}
                    </small>
                  </button>
                );
              })}

              {!loading &&
                moduleSummary.length === 0 && (
                  <EmptyState
                    icon="🗺️"
                    title="Mapa operacional vazio"
                    text="A movimentação aparecerá conforme os módulos forem utilizados."
                  />
                )}
            </div>
          </article>
        </aside>
      </section>

      <footer className="command-footer">
        <span>
          Última leitura: {formatDate(lastGeneratedAt)}
        </span>

        <span>
          Atualização automática a cada 30 segundos
        </span>
      </footer>

      {selectedEvent && (
        <EventDrawer
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}

      <style jsx>{`
        .command-page {
          min-height: 100vh;
          padding: 28px;
          color: #e2e8f0;
          background:
            radial-gradient(
              circle at 8% 0%,
              rgba(37, 99, 235, 0.2),
              transparent 28%
            ),
            radial-gradient(
              circle at 100% 0%,
              rgba(8, 145, 178, 0.14),
              transparent 24%
            ),
            #07101f;
        }

        .command-header {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 24px;
          max-width: 1800px;
          margin: 0 auto 18px;
        }

        .eyebrow {
          margin: 0 0 8px;
          color: #67e8f9;
          font-size: 11px;
          font-weight: 950;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }

        h1 {
          margin: 0;
          color: white;
          font-size: clamp(34px, 5vw, 58px);
          line-height: 1;
          font-weight: 950;
        }

        .subtitle {
          max-width: 900px;
          margin: 12px 0 0;
          color: #94a3b8;
          line-height: 1.6;
        }

        .header-actions {
          display: flex;
          gap: 10px;
        }

        .header-actions select,
        .header-actions button {
          min-height: 44px;
          border: 1px solid
            rgba(148, 163, 184, 0.2);
          border-radius: 13px;
          padding: 0 14px;
          color: #e2e8f0;
          background: rgba(15, 23, 42, 0.88);
          font-weight: 850;
        }

        .header-actions button {
          border: 0;
          color: white;
          background: linear-gradient(
            135deg,
            #2563eb,
            #0891b2
          );
          cursor: pointer;
        }

        .command-shortcuts {
          display: flex;
          flex-wrap: wrap;
          gap: 9px;
          max-width: 1800px;
          margin: 0 auto 16px;
        }

        .command-shortcuts a {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          min-height: 39px;
          border: 1px solid
            rgba(148, 163, 184, 0.16);
          border-radius: 999px;
          padding: 0 13px;
          color: #cbd5e1;
          background: rgba(15, 23, 42, 0.75);
          font-size: 12px;
          font-weight: 850;
          text-decoration: none;
        }

        .command-shortcuts a:hover {
          border-color: rgba(34, 211, 238, 0.35);
          color: white;
        }

        .error-banner {
          display: grid;
          gap: 4px;
          max-width: 1800px;
          margin: 0 auto 14px;
          padding: 13px 15px;
          border: 1px solid
            rgba(248, 113, 113, 0.35);
          border-radius: 14px;
          color: #fecaca;
          background: rgba(127, 29, 29, 0.28);
        }

        .error-banner span {
          font-size: 12px;
        }

        .filter-bar {
          display: flex;
          align-items: end;
          gap: 10px;
          max-width: 1800px;
          margin: 0 auto 16px;
          padding: 14px;
          border: 1px solid
            rgba(148, 163, 184, 0.14);
          border-radius: 18px;
          background: rgba(15, 23, 42, 0.76);
        }

        .filter-bar label {
          display: grid;
          gap: 6px;
          min-width: 170px;
        }

        .filter-bar .search-field {
          flex: 1;
        }

        .filter-bar label > span {
          color: #64748b;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .filter-bar input,
        .filter-bar select,
        .clear-button {
          width: 100%;
          min-height: 40px;
          border: 1px solid
            rgba(148, 163, 184, 0.2);
          border-radius: 11px;
          padding: 0 12px;
          color: #e2e8f0;
          background: #111c30;
          outline: none;
        }

        .clear-button {
          width: auto;
          cursor: pointer;
          font-weight: 800;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns:
            repeat(6, minmax(0, 1fr));
          gap: 10px;
          max-width: 1800px;
          margin: 0 auto 16px;
        }

        .metric-card {
          display: grid;
          min-width: 0;
          padding: 15px;
          border: 1px solid
            rgba(148, 163, 184, 0.14);
          border-radius: 18px;
          text-align: left;
          color: inherit;
          background: rgba(15, 23, 42, 0.78);
          box-shadow: 0 18px 45px
            rgba(0, 0, 0, 0.12);
          cursor: pointer;
        }

        .metric-card:hover {
          transform: translateY(-1px);
          border-color: rgba(34, 211, 238, 0.3);
        }

        .metric-card.success {
          border-color: rgba(34, 197, 94, 0.24);
        }

        .metric-card.warning {
          border-color: rgba(245, 158, 11, 0.3);
        }

        .metric-card.danger {
          border-color: rgba(248, 113, 113, 0.32);
          background: rgba(127, 29, 29, 0.18);
        }

        .metric-icon {
          font-size: 20px;
        }

        .metric-card > strong {
          margin-top: 10px;
          color: white;
          font-size: 28px;
          line-height: 1;
        }

        .metric-label {
          margin-top: 6px;
          color: #cbd5e1;
          font-size: 11px;
          font-weight: 900;
        }

        .metric-card small {
          overflow: hidden;
          margin-top: 5px;
          color: #64748b;
          font-size: 10px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .command-layout {
          display: grid;
          grid-template-columns:
            minmax(0, 1fr) 390px;
          align-items: start;
          gap: 14px;
          max-width: 1800px;
          margin: 0 auto;
        }

        .main-column,
        .side-column {
          display: grid;
          gap: 14px;
          min-width: 0;
        }

        .panel {
          overflow: hidden;
          border: 1px solid
            rgba(148, 163, 184, 0.14);
          border-radius: 20px;
          background: rgba(15, 23, 42, 0.78);
          box-shadow: 0 20px 55px
            rgba(0, 0, 0, 0.12);
        }

        .panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 16px 18px;
          border-bottom: 1px solid
            rgba(148, 163, 184, 0.1);
        }

        .panel-header > div > span {
          color: #67e8f9;
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .panel-header h2 {
          margin: 4px 0 0;
          color: white;
          font-size: 17px;
        }

        .panel-header a {
          color: #7dd3fc;
          font-size: 11px;
          font-weight: 850;
          text-decoration: none;
        }

        .panel-header small {
          color: #64748b;
          font-size: 10px;
        }

        .live-users-grid {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(0, 1fr));
          gap: 10px;
          padding: 12px;
        }

        .live-user-card {
          display: grid;
          gap: 12px;
          min-width: 0;
          padding: 13px;
          border: 1px solid
            rgba(148, 163, 184, 0.12);
          border-radius: 15px;
          color: inherit;
          text-align: left;
          background: rgba(7, 16, 31, 0.72);
          cursor: pointer;
        }

        .live-user-card:hover {
          border-color: rgba(34, 211, 238, 0.28);
        }

        .live-user-top {
          display: flex;
          align-items: center;
          gap: 9px;
          min-width: 0;
        }

        .presence {
          width: 9px;
          height: 9px;
          flex: 0 0 9px;
          border-radius: 999px;
        }

        .presence.online {
          background: #22c55e;
          box-shadow: 0 0 0 5px
            rgba(34, 197, 94, 0.08);
        }

        .presence.idle {
          background: #f59e0b;
          box-shadow: 0 0 0 5px
            rgba(245, 158, 11, 0.08);
        }

        .presence.offline {
          background: #64748b;
        }

        .live-user-top > div {
          min-width: 0;
        }

        .live-user-top strong,
        .live-user-top small {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .live-user-top strong {
          color: white;
          font-size: 12px;
        }

        .live-user-top small {
          margin-top: 2px;
          color: #64748b;
          font-size: 9px;
        }

        .current-action {
          display: grid;
          gap: 3px;
          padding: 10px;
          border-radius: 11px;
          background: rgba(8, 145, 178, 0.06);
        }

        .current-action span {
          color: #67e8f9;
          font-size: 8px;
          font-weight: 950;
          text-transform: uppercase;
        }

        .current-action strong {
          overflow: hidden;
          color: #e2e8f0;
          font-size: 11px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .current-action small {
          overflow: hidden;
          color: #475569;
          font-size: 8px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .live-user-footer {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          color: #64748b;
          font-size: 9px;
        }

        .event-count {
          border-radius: 999px;
          padding: 5px 9px;
          color: #bae6fd;
          background: rgba(3, 105, 161, 0.25);
          font-size: 10px;
        }

        .feed-list {
          display: grid;
          max-height: 760px;
          overflow-y: auto;
        }

        .feed-event {
          display: grid;
          grid-template-columns:
            58px 34px minmax(0, 1fr) 14px;
          align-items: start;
          gap: 11px;
          padding: 13px 16px;
          border: 0;
          border-bottom: 1px solid
            rgba(148, 163, 184, 0.08);
          color: inherit;
          text-align: left;
          background: transparent;
          cursor: pointer;
        }

        .feed-event:hover {
          background: rgba(30, 41, 59, 0.46);
        }

        .feed-time {
          display: grid;
          gap: 3px;
        }

        .feed-time strong {
          color: #cbd5e1;
          font-size: 11px;
        }

        .feed-time span {
          color: #475569;
          font-size: 8px;
        }

        .module-icon {
          display: grid;
          place-items: center;
          width: 32px;
          height: 32px;
          border-radius: 10px;
          background: rgba(51, 65, 85, 0.5);
          font-size: 15px;
        }

        .feed-content {
          min-width: 0;
        }

        .feed-main {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
          line-height: 1.4;
        }

        .feed-main strong {
          color: white;
          font-size: 11px;
        }

        .feed-main span {
          color: #cbd5e1;
          font-size: 11px;
        }

        .feed-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
          margin-top: 7px;
        }

        .feed-meta span {
          max-width: 280px;
          overflow: hidden;
          border: 1px solid
            rgba(148, 163, 184, 0.1);
          border-radius: 999px;
          padding: 3px 6px;
          color: #64748b;
          background: rgba(30, 41, 59, 0.46);
          font-size: 8px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .feed-meta .changed-badge {
          color: #fef08a;
          background: rgba(161, 98, 7, 0.16);
        }

        .feed-arrow {
          color: #475569;
          font-size: 19px;
        }

        .table-scroll {
          overflow-x: auto;
        }

        table {
          width: 100%;
          min-width: 1120px;
          border-collapse: collapse;
        }

        th,
        td {
          padding: 11px 12px;
          border-bottom: 1px solid
            rgba(148, 163, 184, 0.08);
          text-align: left;
          font-size: 10px;
        }

        th {
          color: #64748b;
          font-size: 8px;
          font-weight: 950;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        tbody tr {
          cursor: pointer;
        }

        tbody tr:hover {
          background: rgba(30, 41, 59, 0.4);
        }

        td {
          color: #cbd5e1;
        }

        .user-cell {
          display: flex;
          align-items: center;
          gap: 9px;
          min-width: 160px;
        }

        .user-cell strong,
        .user-cell small {
          display: block;
        }

        .user-cell strong {
          color: white;
          font-size: 10px;
        }

        .user-cell small {
          max-width: 160px;
          overflow: hidden;
          margin-top: 2px;
          color: #475569;
          font-size: 8px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .ai-badge {
          border-radius: 999px;
          padding: 5px 8px;
          color: #ddd6fe;
          background: rgba(109, 40, 217, 0.26);
          font-size: 9px;
          font-weight: 950;
        }

        .diagnostics-list,
        .alerts-list,
        .modules-list {
          display: grid;
          gap: 9px;
          padding: 12px;
        }

        .diagnostic {
          display: grid;
          gap: 7px;
          padding: 12px;
          border: 1px solid
            rgba(148, 163, 184, 0.1);
          border-left-width: 3px;
          border-radius: 13px;
          background: rgba(7, 16, 31, 0.68);
        }

        .diagnostic.info {
          border-left-color: #38bdf8;
        }

        .diagnostic.warning {
          border-left-color: #f59e0b;
        }

        .diagnostic.danger {
          border-left-color: #fb7185;
        }

        .diagnostic.success {
          border-left-color: #22c55e;
        }

        .diagnostic-top {
          display: flex;
          align-items: start;
          gap: 7px;
        }

        .diagnostic-top strong {
          color: white;
          font-size: 10px;
          line-height: 1.4;
        }

        .diagnostic p {
          margin: 0;
          color: #94a3b8;
          font-size: 9px;
          line-height: 1.5;
        }

        .diagnostic small {
          color: #67e8f9;
          font-size: 8px;
          line-height: 1.45;
        }

        .alert-item {
          display: grid;
          gap: 6px;
          padding: 11px;
          border: 1px solid
            rgba(148, 163, 184, 0.1);
          border-left: 3px solid #38bdf8;
          border-radius: 12px;
          background: rgba(7, 16, 31, 0.68);
        }

        .alert-item.critical {
          border-left-color: #fb7185;
        }

        .alert-item.high {
          border-left-color: #fb923c;
        }

        .alert-item.medium {
          border-left-color: #facc15;
        }

        .alert-top {
          display: flex;
          justify-content: space-between;
          gap: 8px;
        }

        .alert-top span {
          color: #fca5a5;
          font-size: 7px;
          font-weight: 950;
          letter-spacing: 0.08em;
        }

        .alert-top time {
          color: #475569;
          font-size: 8px;
        }

        .alert-item > strong {
          color: white;
          font-size: 10px;
        }

        .alert-item p,
        .alert-item small {
          margin: 0;
          color: #94a3b8;
          font-size: 8px;
          line-height: 1.45;
        }

        .module-row {
          display: grid;
          gap: 7px;
          padding: 10px;
          border: 1px solid
            rgba(148, 163, 184, 0.1);
          border-radius: 12px;
          color: inherit;
          text-align: left;
          background: rgba(7, 16, 31, 0.6);
          cursor: pointer;
        }

        .module-row-top {
          display: flex;
          justify-content: space-between;
          gap: 8px;
        }

        .module-row-top > div {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .module-row-top strong {
          color: #cbd5e1;
          font-size: 9px;
        }

        .module-row-top > span {
          color: #67e8f9;
          font-size: 9px;
          font-weight: 900;
        }

        .module-progress {
          overflow: hidden;
          height: 4px;
          border-radius: 999px;
          background: rgba(51, 65, 85, 0.7);
        }

        .module-progress span {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(
            90deg,
            #2563eb,
            #22d3ee
          );
        }

        .module-row small {
          color: #475569;
          font-size: 8px;
        }

        .command-footer {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          max-width: 1800px;
          margin: 14px auto 0;
          color: #475569;
          font-size: 9px;
        }

        @media (max-width: 1500px) {
          .metrics-grid {
            grid-template-columns:
              repeat(4, minmax(0, 1fr));
          }

          .live-users-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 1180px) {
          .command-layout {
            grid-template-columns: 1fr;
          }

          .side-column {
            grid-template-columns:
              repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 900px) {
          .command-page {
            padding: 20px 14px 90px;
          }

          .command-header {
            align-items: stretch;
            flex-direction: column;
          }

          .header-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
          }

          .filter-bar {
            align-items: stretch;
            flex-direction: column;
          }

          .filter-bar label,
          .clear-button {
            width: 100%;
          }

          .metrics-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .side-column {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 600px) {
          .metrics-grid,
          .live-users-grid {
            grid-template-columns: 1fr;
          }

          .feed-event {
            grid-template-columns:
              46px 30px minmax(0, 1fr);
          }

          .feed-arrow {
            display: none;
          }

          .command-footer {
            flex-direction: column;
          }
        }
      `}</style>
    </main>
  );
}

function StatusBadge({
  online,
  idleSeconds,
}: {
  online: boolean;
  idleSeconds: number;
}) {
  const idle = online && idleSeconds >= 60;
  const label = online
    ? idle
      ? "Ocioso"
      : "Online"
    : "Offline";

  return (
    <span
      style={{
        display: "inline-flex",
        borderRadius: 999,
        padding: "4px 7px",
        color: online
          ? idle
            ? "#fde68a"
            : "#bbf7d0"
          : "#cbd5e1",
        background: online
          ? idle
            ? "rgba(146,64,14,.34)"
            : "rgba(22,101,52,.34)"
          : "rgba(51,65,85,.5)",
        fontSize: 8,
        fontWeight: 900,
        textTransform: "uppercase",
      }}
    >
      {label}
    </span>
  );
}

function EmptyState({
  icon,
  title,
  text,
}: {
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <div
      style={{
        display: "grid",
        gap: 6,
        padding: 28,
        textAlign: "center",
      }}
    >
      <span style={{ fontSize: 26 }}>{icon}</span>
      <strong style={{ color: "#e2e8f0", fontSize: 12 }}>
        {title}
      </strong>
      <span
        style={{
          color: "#64748b",
          fontSize: 9,
          lineHeight: 1.5,
        }}
      >
        {text}
      </span>
    </div>
  );
}

function EventDrawer({
  event,
  onClose,
}: {
  event: Record<string, any>;
  onClose: () => void;
}) {
  const changes = getChangedFields(event);

  return (
    <div
      className="drawer-overlay"
      role="presentation"
      onMouseDown={onClose}
    >
      <aside
        className="event-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Detalhes do evento"
        onMouseDown={(eventObject) =>
          eventObject.stopPropagation()
        }
      >
        <header>
          <div>
            <span>Auditoria detalhada</span>
            <h2>{eventDescription(event)}</h2>
          </div>

          <button type="button" onClick={onClose}>
            ×
          </button>
        </header>

        <section className="drawer-summary">
          <Detail
            label="Usuário"
            value={eventUser(event)}
          />
          <Detail
            label="Data e hora"
            value={formatDate(eventTimestamp(event))}
          />
          <Detail
            label="Módulo"
            value={moduleLabel(eventModule(event))}
          />
          <Detail
            label="Ação"
            value={actionLabel(event.action)}
          />
          <Detail
            label="Entidade"
            value={eventEntity(event) || "Não identificada"}
          />
          <Detail
            label="Tipo"
            value={
              event.entity_type ||
              event.entity ||
              "Não identificado"
            }
          />
          <Detail
            label="Rota"
            value={
              event.route ||
              event.metadata?.route ||
              "Não registrada"
            }
          />
          <Detail
            label="Origem"
            value={
              event.source ||
              event.metadata?.source ||
              "Sistema"
            }
          />
        </section>

        {changes.length > 0 && (
          <section className="changes-section">
            <h3>Campos alterados</h3>

            <div className="changes-list">
              {changes.map((change) => (
                <div
                  className="change-row"
                  key={change.field}
                >
                  <strong>{change.field}</strong>

                  <div>
                    <span>Antes</span>
                    <code>
                      {formatValue(change.before)}
                    </code>
                  </div>

                  <div>
                    <span>Depois</span>
                    <code>
                      {formatValue(change.after)}
                    </code>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="metadata-section">
          <h3>Metadados</h3>

          <pre>
            {JSON.stringify(
              {
                metadata: event.metadata || {},
                old_data: event.old_data || null,
                new_data: event.new_data || null,
              },
              null,
              2
            )}
          </pre>
        </section>
      </aside>

      <style jsx>{`
        .drawer-overlay {
          position: fixed;
          z-index: 9999;
          inset: 0;
          display: flex;
          justify-content: flex-end;
          background: rgba(2, 6, 23, 0.72);
          backdrop-filter: blur(4px);
        }

        .event-drawer {
          width: min(620px, 100%);
          height: 100%;
          overflow-y: auto;
          color: #e2e8f0;
          background: #0b1424;
          box-shadow: -30px 0 80px
            rgba(0, 0, 0, 0.42);
        }

        header {
          display: flex;
          align-items: start;
          justify-content: space-between;
          gap: 16px;
          padding: 22px;
          border-bottom: 1px solid
            rgba(148, 163, 184, 0.14);
        }

        header span {
          color: #67e8f9;
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        h2 {
          margin: 7px 0 0;
          color: white;
          font-size: 20px;
          line-height: 1.35;
        }

        header button {
          display: grid;
          width: 36px;
          height: 36px;
          flex: 0 0 36px;
          place-items: center;
          border: 1px solid
            rgba(148, 163, 184, 0.18);
          border-radius: 11px;
          color: #cbd5e1;
          background: rgba(30, 41, 59, 0.7);
          font-size: 22px;
          cursor: pointer;
        }

        .drawer-summary {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 10px;
          padding: 18px;
        }

        .changes-section,
        .metadata-section {
          padding: 18px;
          border-top: 1px solid
            rgba(148, 163, 184, 0.12);
        }

        h3 {
          margin: 0 0 12px;
          color: white;
          font-size: 13px;
        }

        .changes-list {
          display: grid;
          gap: 10px;
        }

        .change-row {
          display: grid;
          gap: 9px;
          padding: 12px;
          border: 1px solid
            rgba(148, 163, 184, 0.12);
          border-radius: 13px;
          background: rgba(15, 23, 42, 0.64);
        }

        .change-row > strong {
          color: #67e8f9;
          font-size: 10px;
        }

        .change-row > div {
          display: grid;
          gap: 4px;
        }

        .change-row span {
          color: #64748b;
          font-size: 8px;
          font-weight: 900;
          text-transform: uppercase;
        }

        code {
          overflow-wrap: anywhere;
          padding: 8px;
          border-radius: 8px;
          color: #cbd5e1;
          background: rgba(7, 16, 31, 0.75);
          font-size: 9px;
          white-space: pre-wrap;
        }

        pre {
          overflow: auto;
          max-height: 500px;
          margin: 0;
          padding: 13px;
          border-radius: 12px;
          color: #94a3b8;
          background: #07101f;
          font-size: 9px;
          line-height: 1.5;
          white-space: pre-wrap;
        }

        @media (max-width: 600px) {
          .drawer-summary {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        display: "grid",
        gap: 4,
        minWidth: 0,
        padding: 11,
        border: "1px solid rgba(148,163,184,.11)",
        borderRadius: 12,
        background: "rgba(15,23,42,.62)",
      }}
    >
      <span
        style={{
          color: "#64748b",
          fontSize: 8,
          fontWeight: 900,
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>

      <strong
        style={{
          overflowWrap: "anywhere",
          color: "#e2e8f0",
          fontSize: 10,
        }}
      >
        {value}
      </strong>
    </div>
  );
}

function formatValue(value: unknown) {
  if (value == null) return "vazio";

  if (typeof value === "string") return value;

  return JSON.stringify(value, null, 2);
}

function getModuleIcon(value?: string | null) {
  const moduleName = normalize(value);

  if (moduleName.includes("cliente")) return "🏢";
  if (moduleName.includes("vaga")) return "💼";
  if (
    moduleName.includes("candidato") ||
    moduleName.includes("recrutamento")
  ) {
    return "👤";
  }
  if (moduleName.includes("entrevista")) return "📅";
  if (moduleName.includes("contrat")) return "✅";
  if (moduleName.includes("tarefa")) return "📋";
  if (
    moduleName.includes("mensagem") ||
    moduleName.includes("whatsapp")
  ) {
    return "💬";
  }
  if (
    moduleName.includes("disparo") ||
    moduleName.includes("campanha")
  ) {
    return "📣";
  }
  if (moduleName.includes("document")) return "📄";
  if (moduleName.includes("navega")) return "🧭";
  if (moduleName.includes("sistema")) return "⚙️";

  return "⚡";
}

function diagnosticIcon(
  tone: "info" | "warning" | "danger" | "success"
) {
  if (tone === "danger") return "🔴";
  if (tone === "warning") return "🟠";
  if (tone === "success") return "🟢";

  return "🔵";
}
