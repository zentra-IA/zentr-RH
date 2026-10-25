"use client";

import { useEffect, useMemo, useState } from "react";

function dateKey(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function scoreBadge(score: number) {
  if (score >= 85) return { text: "Forte aderência", bg: "#ecfdf5", color: "#047857" };
  if (score >= 70) return { text: "Aderência", bg: "#eff6ff", color: "#1d4ed8" };
  if (score >= 50) return { text: "Avaliar", bg: "#fffbeb", color: "#a16207" };
  return { text: "Baixa aderência", bg: "#fef2f2", color: "#b91c1c" };
}

export default function AiInterviewResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [jobId, setJobId] = useState("");
  const [job, setJob] = useState<any>(null);
  const [results, setResults] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [decision, setDecision] = useState("all");
  const [minScore, setMinScore] = useState("");
  const [maxScore, setMaxScore] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState("score_desc");

  useEffect(() => {
    params.then(({ id }) => {
      setJobId(id);
      load(id);
    });
  }, [params]);

  async function load(id = jobId) {
    if (!id) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/rh/jobs/${id}/ai-interview/results`, {
        cache: "no-store",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Erro ao carregar.");
      setJob(data.job);
      setResults(data.results || []);
      if (selected?.id) {
        setSelected((data.results || []).find((x: any) => x.id === selected.id) || null);
      }
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function decide(item: any, nextDecision: "approved" | "rejected" | "reset") {
    if (nextDecision !== "reset") {
      const verb = nextDecision === "approved" ? "aprovar e enviar ao cliente" : "reprovar no RH";
      if (!confirm(`Deseja ${verb} ${item.candidate_name || "este candidato"}?`)) return;
    }

    try {
      setSavingId(item.id);
      const res = await fetch(`/api/rh/jobs/${jobId}/ai-interview/decision`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: item.id,
          decision: nextDecision,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Erro ao salvar decisão.");

      if (nextDecision === "approved") {
        alert("Candidato aprovado pelo RH e adicionado à apresentação do cliente.");
      } else if (nextDecision === "rejected") {
        alert("Candidato marcado como reprovado pelo RH.");
      }

      await load();

      if (data.clientLink && nextDecision === "approved") {
        const open = confirm("Deseja abrir agora o link que será enviado ao cliente?");
        if (open) window.open(data.clientLink, "_blank", "noopener,noreferrer");
      }
    } catch (error: any) {
      alert(error.message);
    } finally {
      setSavingId("");
    }
  }

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = results.filter((item) => {
      const score = Number(item.overall_score ?? -1);
      const day = dateKey(item.completed_at || item.created_at);

      if (
        q &&
        ![
          item.candidate_name,
          item.candidate_phone,
          item.candidate_email,
          item.resume_data?.lastRole,
          item.resume_data?.city,
          item.resume_data?.state,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q)
      ) return false;

      if (status === "completed" && item.status !== "completed") return false;
      if (status === "progress" && item.status === "completed") return false;
      if (status === "strong" && score < 85) return false;
      if (status === "review" && (item.status !== "completed" || score >= 85)) return false;

      if (decision !== "all" && (item.rh_decision || "pending") !== decision) return false;
      if (minScore && score < Number(minScore)) return false;
      if (maxScore && score > Number(maxScore)) return false;
      if (dateFrom && day && day < dateFrom) return false;
      if (dateTo && day && day > dateTo) return false;

      return true;
    });

    rows = [...rows].sort((a, b) => {
      if (sort === "score_asc") return Number(a.overall_score || 0) - Number(b.overall_score || 0);
      if (sort === "date_desc") return new Date(b.completed_at || b.created_at).getTime() - new Date(a.completed_at || a.created_at).getTime();
      if (sort === "date_asc") return new Date(a.completed_at || a.created_at).getTime() - new Date(b.completed_at || b.created_at).getTime();
      return Number(b.overall_score || 0) - Number(a.overall_score || 0);
    });

    return rows;
  }, [results, search, status, decision, minScore, maxScore, dateFrom, dateTo, sort]);

  function clearFilters() {
    setSearch("");
    setStatus("all");
    setDecision("all");
    setMinScore("");
    setMaxScore("");
    setDateFrom("");
    setDateTo("");
    setSort("score_desc");
  }

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div>
          <a href="/crm/dashboard/jobs" style={styles.back}>← Voltar para vagas</a>
          <p style={styles.kicker}>Entrevista Inteligente por IA</p>
          <h1 style={styles.title}>{job?.title || "Resultados da entrevista"}</h1>
          <p style={styles.subtitle}>Filtre, revise e decida quem deve seguir para apresentação ao cliente.</p>
        </div>
        <button style={styles.primary} onClick={() => load()} disabled={loading}>
          {loading ? "Atualizando..." : "Atualizar"}
        </button>
      </section>

      <section style={styles.stats}>
        <Stat label="Participantes" value={results.length} />
        <Stat label="Concluídas" value={results.filter((x) => x.status === "completed").length} />
        <Stat label="≥ 85%" value={results.filter((x) => Number(x.overall_score || 0) >= 85).length} />
        <Stat label="Enviados ao cliente" value={results.filter((x) => x.rh_decision === "approved").length} />
        <Stat label="Reprovados RH" value={results.filter((x) => x.rh_decision === "rejected").length} />
      </section>

      <section style={styles.card}>
        <div style={styles.filterGrid}>
          <input style={styles.input} placeholder="Buscar candidato, telefone, e-mail, cargo..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <select style={styles.input} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">Todos os resultados</option>
            <option value="strong">Forte aderência ≥ 85%</option>
            <option value="completed">Concluídos</option>
            <option value="progress">Em andamento</option>
            <option value="review">Revisar</option>
          </select>
          <select style={styles.input} value={decision} onChange={(e) => setDecision(e.target.value)}>
            <option value="all">Todas as decisões RH</option>
            <option value="pending">Pendente RH</option>
            <option value="approved">Enviado ao cliente</option>
            <option value="rejected">Reprovado RH</option>
          </select>
          <select style={styles.input} value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="score_desc">Maior aderência primeiro</option>
            <option value="score_asc">Menor aderência primeiro</option>
            <option value="date_desc">Mais recentes</option>
            <option value="date_asc">Mais antigos</option>
          </select>
          <input style={styles.input} type="number" min="0" max="100" placeholder="Aderência mínima %" value={minScore} onChange={(e) => setMinScore(e.target.value)} />
          <input style={styles.input} type="number" min="0" max="100" placeholder="Aderência máxima %" value={maxScore} onChange={(e) => setMaxScore(e.target.value)} />
          <label style={styles.dateField}>De<input style={styles.input} type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></label>
          <label style={styles.dateField}>Até<input style={styles.input} type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></label>
        </div>
        <div style={styles.filterFooter}>
          <strong>{visible.length} candidato(s) encontrado(s)</strong>
          <button style={styles.secondary} onClick={clearFilters}>Limpar filtros</button>
        </div>
      </section>

      <section style={styles.card}>
        <div style={{ overflowX: "auto" }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Candidato</th>
                <th style={styles.th}>Data</th>
                <th style={styles.th}>Currículo</th>
                <th style={styles.th}>Entrevista</th>
                <th style={styles.th}>Geral</th>
                <th style={styles.th}>Situação RH</th>
                <th style={styles.th}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => {
                const score = Number(item.overall_score || 0);
                const b = scoreBadge(score);
                return (
                  <tr key={item.id}>
                    <td style={styles.td}>
                      <strong>{item.candidate_name || "Candidato"}</strong>
                      <div style={styles.muted}>{item.candidate_phone || item.candidate_email || ""}</div>
                      {item.resume_data?.lastRole && <div style={styles.muted}>{item.resume_data.lastRole}</div>}
                    </td>
                    <td style={styles.td}>{formatDate(item.completed_at || item.created_at)}</td>
                    <td style={styles.td}>{item.resume_score ?? "—"}{item.resume_score != null ? "%" : ""}</td>
                    <td style={styles.td}>{item.interview_score ?? "—"}{item.interview_score != null ? "%" : ""}</td>
                    <td style={styles.td}>
                      <strong>{item.overall_score ?? "—"}{item.overall_score != null ? "%" : ""}</strong>
                      {item.status === "completed" && <div><span style={{ ...styles.badge, background: b.bg, color: b.color }}>{b.text}</span></div>}
                    </td>
                    <td style={styles.td}>
                      {item.rh_decision === "approved" ? (
                        <span style={{ ...styles.badge, background: "#dcfce7", color: "#166534" }}>Enviado ao cliente</span>
                      ) : item.rh_decision === "rejected" ? (
                        <span style={{ ...styles.badge, background: "#fee2e2", color: "#991b1b" }}>Reprovado RH</span>
                      ) : (
                        <span style={{ ...styles.badge, background: "#f1f5f9", color: "#64748b" }}>Pendente RH</span>
                      )}
                    </td>
                    <td style={styles.td}>
                      <div style={styles.actions}>
                        <button style={styles.secondary} onClick={() => setSelected(item)}>Ver relatório</button>
                        {item.status === "completed" && item.rh_decision !== "approved" && (
                          <button style={styles.approve} disabled={savingId === item.id} onClick={() => decide(item, "approved")}>
                            ✓ Aprovar p/ cliente
                          </button>
                        )}
                        {item.status === "completed" && item.rh_decision !== "rejected" && (
                          <button style={styles.reject} disabled={savingId === item.id} onClick={() => decide(item, "rejected")}>
                            ✕ Reprovar
                          </button>
                        )}
                        {item.rh_decision && (
                          <button style={styles.linkButton} disabled={savingId === item.id} onClick={() => decide(item, "reset")}>
                            Desfazer decisão
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!visible.length && (
                <tr><td colSpan={7} style={{ ...styles.td, textAlign: "center", color: "#64748b" }}>Nenhum candidato encontrado com estes filtros.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selected && (
        <section style={styles.card}>
          <div style={styles.reportHeader}>
            <div>
              <p style={styles.kicker}>Relatório individual</p>
              <h2 style={{ margin: 0 }}>{selected.candidate_name}</h2>
            </div>
            <button style={styles.secondary} onClick={() => setSelected(null)}>Fechar</button>
          </div>

          <div style={styles.scoreGrid}>
            <Score label="Currículo" value={selected.resume_score} />
            <Score label="Entrevista" value={selected.interview_score} />
            <Score label="Aderência geral" value={selected.overall_score} />
          </div>

          <Report selected={selected} />

          {selected.status === "completed" && (
            <div style={styles.reportActions}>
              <button style={styles.approve} disabled={savingId === selected.id} onClick={() => decide(selected, "approved")}>
                ✓ Aprovar e enviar ao cliente
              </button>
              <button style={styles.reject} disabled={savingId === selected.id} onClick={() => decide(selected, "rejected")}>
                ✕ Reprovar no RH
              </button>
            </div>
          )}
        </section>
      )}
    </main>
  );
}

function Report({ selected }: { selected: any }) {
  const report = selected.ai_report || {};
  const dimensions = report.dimensions || {};
  const answers = Array.isArray(selected.answers) ? selected.answers : [];
  const resume = selected.resume_data || {};

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div>
        <h3>Perfil extraído do currículo</h3>
        <div style={styles.profileGrid}>
          <Mini label="Último cargo" value={resume.lastRole} />
          <Mini label="Cidade" value={[resume.city, resume.state].filter(Boolean).join(" / ")} />
          <Mini label="Formação" value={resume.education || resume.course} />
          <Mini label="E-mail" value={resume.email || selected.candidate_email} />
        </div>
      </div>

      <div>
        <h3>Resumo da IA</h3>
        <p style={styles.copy}>{report.summary || "Análise ainda não concluída."}</p>
      </div>

      <div style={styles.twoCols}>
        <div>
          <h3>Pontos fortes</h3>
          {(report.strengths || []).map((item: any, index: number) => (
            <div key={index} style={styles.note}>
              <strong>{item.title || "Ponto forte"}</strong>
              <div>{item.evidence || ""}</div>
            </div>
          ))}
        </div>
        <div>
          <h3>Pontos de atenção</h3>
          {(report.attentionPoints || []).map((item: any, index: number) => (
            <div key={index} style={styles.note}>
              <strong>{item.title || "Ponto de atenção"}</strong>
              <div>{item.evidence || ""}</div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3>Dimensões profissionais</h3>
        <div style={styles.dimensionGrid}>
          {Object.entries(dimensions).map(([key, value]) => (
            <div key={key} style={styles.dimension}>
              <span>{key.replaceAll("_", " ")}</span>
              <strong>{String(value)}%</strong>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3>Respostas da entrevista</h3>
        {answers.map((item: any, index: number) => (
          <div key={index} style={styles.qa}>
            <strong>{item.question}</strong>
            <div>{item.answer}</div>
          </div>
        ))}
      </div>

      {selected.audio_transcript && (
        <div><h3>Transcrição do áudio</h3><p style={styles.copy}>{selected.audio_transcript}</p></div>
      )}
      {selected.video_transcript && (
        <div><h3>Transcrição do vídeo</h3><p style={styles.copy}>{selected.video_transcript}</p></div>
      )}
    </div>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(d);
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div style={styles.stat}><span style={styles.muted}>{label}</span><strong style={{ fontSize: 24 }}>{value}</strong></div>;
}
function Score({ label, value }: { label: string; value: any }) {
  return <div style={styles.score}><span style={styles.muted}>{label}</span><strong style={{ fontSize: 28 }}>{value ?? "—"}{value != null ? "%" : ""}</strong></div>;
}
function Mini({ label, value }: { label: string; value: any }) {
  return <div style={styles.mini}><span style={styles.muted}>{label}</span><strong>{value || "—"}</strong></div>;
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#f6f8fb", padding: 24, color: "#0f172a" },
  hero: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 18 },
  back: { color: "#2563eb", textDecoration: "none", fontWeight: 800, fontSize: 13 },
  kicker: { margin: "8px 0 4px", color: "#2563eb", fontWeight: 900, fontSize: 12, letterSpacing: 1 },
  title: { margin: 0, fontSize: 30 },
  subtitle: { color: "#64748b", marginBottom: 0 },
  primary: { border: 0, borderRadius: 12, padding: "12px 18px", background: "#2563eb", color: "#fff", fontWeight: 900, cursor: "pointer" },
  secondary: { border: "1px solid #cbd5e1", borderRadius: 10, padding: "9px 12px", background: "#fff", color: "#334155", fontWeight: 800, cursor: "pointer" },
  approve: { border: 0, borderRadius: 10, padding: "9px 12px", background: "#16a34a", color: "#fff", fontWeight: 900, cursor: "pointer" },
  reject: { border: 0, borderRadius: 10, padding: "9px 12px", background: "#ef4444", color: "#fff", fontWeight: 900, cursor: "pointer" },
  linkButton: { border: 0, background: "transparent", color: "#64748b", textDecoration: "underline", cursor: "pointer", fontWeight: 700 },
  actions: { display: "flex", gap: 7, flexWrap: "wrap" },
  stats: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 12, marginBottom: 18 },
  stat: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16, display: "grid", gap: 6 },
  card: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 18, padding: 18, marginBottom: 18 },
  filterGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 },
  filterFooter: { display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center", marginTop: 12 },
  input: { width: "100%", boxSizing: "border-box", border: "1px solid #cbd5e1", borderRadius: 10, padding: "10px 11px", background: "#fff", color: "#0f172a" },
  dateField: { display: "grid", gap: 4, color: "#64748b", fontSize: 12, fontWeight: 800 },
  table: { width: "100%", borderCollapse: "collapse", minWidth: 1080 },
  th: { textAlign: "left", padding: 12, borderBottom: "1px solid #e2e8f0", color: "#64748b", fontSize: 12, textTransform: "uppercase" },
  td: { padding: 12, borderBottom: "1px solid #f1f5f9", verticalAlign: "top" },
  muted: { color: "#64748b", fontSize: 13 },
  badge: { display: "inline-block", borderRadius: 99, padding: "5px 8px", fontSize: 11, fontWeight: 900, marginTop: 5 },
  reportHeader: { display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" },
  scoreGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, margin: "18px 0" },
  score: { border: "1px solid #e2e8f0", borderRadius: 14, padding: 14, display: "grid", gap: 5 },
  profileGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 },
  mini: { background: "#f8fafc", borderRadius: 12, padding: 12, display: "grid", gap: 4 },
  copy: { color: "#475569", lineHeight: 1.7, whiteSpace: "pre-wrap" },
  twoCols: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 18 },
  note: { border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, marginBottom: 8, display: "grid", gap: 5, color: "#475569" },
  dimensionGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 8 },
  dimension: { border: "1px solid #e2e8f0", borderRadius: 10, padding: 11, display: "flex", justifyContent: "space-between", gap: 10, textTransform: "capitalize" },
  qa: { background: "#f8fafc", borderRadius: 12, padding: 14, marginBottom: 10, display: "grid", gap: 8, lineHeight: 1.55 },
  reportActions: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 20, borderTop: "1px solid #e2e8f0", paddingTop: 18 },
};
