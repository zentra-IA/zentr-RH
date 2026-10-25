"use client";

import { useEffect, useMemo, useState } from "react";
import DirectMediaRecorder from "@/components/ai-interview/DirectMediaRecorder";

type Question = {
  id?: string;
  prompt: string;
  purpose?: string;
  type?: string;
};

type Answer = {
  question: string;
  answer: string;
};

export default function AiInterviewPublicPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [interview, setInterview] = useState<any>(null);
  const [step, setStep] = useState(0);
  const [sessionToken, setSessionToken] = useState("");
  const [identity, setIdentity] = useState({
    name: "",
    email: "",
    phone: "",
    consent: false,
  });
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeData, setResumeData] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    params.then((value) => {
      setToken(value.token);
      fetch(`/api/public/ai-interview/${value.token}`, { cache: "no-store" })
        .then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || "Entrevista indisponível.");
          setInterview(data.interview);
        })
        .catch((error) => alert(error.message))
        .finally(() => setLoading(false));
    });
  }, [params]);

  const currentQuestion = questions[answers.length];

  const progress = useMemo(() => {
    if (finished) return 100;
    if (step === 0) return 5;
    if (step === 1) return 18;
    if (step === 2) return 30;
    if (step === 3 && questions.length) {
      return Math.min(70, 30 + Math.round((answers.length / questions.length) * 40));
    }
    if (step === 4) return 78;
    if (step === 5) return 90;
    return 8;
  }, [step, answers.length, questions.length, finished]);

  async function start() {
    if (!identity.name.trim() || !identity.phone.trim()) {
      alert("Informe seu nome e telefone.");
      return;
    }
    if (!identity.consent) {
      alert("Confirme o consentimento para continuar.");
      return;
    }

    try {
      setBusy(true);
      const res = await fetch(`/api/public/ai-interview/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(identity),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Erro ao iniciar.");
      setSessionToken(data.sessionToken);
      setStep(1);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function sendResume() {
    if (!resumeFile) {
      alert("Anexe seu currículo.");
      return;
    }

    try {
      setBusy(true);
      const fd = new FormData();
      fd.append("sessionToken", sessionToken);
      fd.append("file", resumeFile);

      const res = await fetch(`/api/public/ai-interview/${token}/resume`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Erro ao analisar currículo.");
      setResumeData(data.resume || {});
      setQuestions(Array.isArray(data.questions) ? data.questions : []);
      setStep(2);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setBusy(false);
    }
  }

  function nextQuestion() {
    if (!currentQuestion) {
      setStep(4);
      return;
    }

    if (!currentAnswer.trim()) {
      alert("Responda antes de continuar.");
      return;
    }

    const next = [
      ...answers,
      {
        question: currentQuestion.prompt,
        answer: currentAnswer.trim(),
      },
    ];

    setAnswers(next);
    setCurrentAnswer("");

    if (next.length >= questions.length) {
      setStep(4);
    }
  }

  async function sendMedia(kind: "audio" | "video", file: File) {
    try {
      setBusy(true);
      const fd = new FormData();
      fd.append("sessionToken", sessionToken);
      fd.append("kind", kind);
      fd.append("file", file);

      const res = await fetch(`/api/public/ai-interview/${token}/media`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Erro ao transcrever a gravação.");

      setStep(kind === "audio" ? 5 : 6);
    } finally {
      setBusy(false);
    }
  }

  async function finishInterview() {
    try {
      setBusy(true);
      const res = await fetch(`/api/public/ai-interview/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionToken,
          answers,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Erro ao finalizar.");
      setFinished(true);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <main style={styles.page}><section style={styles.card}>Carregando entrevista...</section></main>;
  }

  if (!interview) {
    return <main style={styles.page}><section style={styles.card}>Entrevista indisponível.</section></main>;
  }

  if (finished) {
    return (
      <main style={styles.page}>
        <section style={{ ...styles.card, textAlign: "center", maxWidth: 720 }}>
          <div style={{ fontSize: 58 }}>✅</div>
          <h1 style={styles.title}>Entrevista concluída</h1>
          <p style={styles.text}>
            Obrigado por participar. A equipe de RH receberá suas respostas e fará a avaliação da próxima etapa.
          </p>
          <p style={styles.small}>
            A IA é usada como apoio ao recrutador e não toma a decisão final de contratação.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <section style={styles.shell}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.title}>Entrevista online</h1>
            <p style={styles.small}>Responda com tranquilidade e acompanhe o progresso das etapas.</p>
          </div>
          <div style={styles.progressBox}>
            <span>{progress}%</span>
            <div style={styles.track}><div style={{ ...styles.bar, width: `${progress}%` }} /></div>
          </div>
        </header>

        {step === 0 && (
          <section style={styles.card}>
            <h2>Vamos começar</h2>
            <p style={styles.text}>
              Esta etapa substitui parte da primeira entrevista e ajuda o RH a conhecer melhor sua experiência profissional.
            </p>
            <div style={styles.grid}>
              <Field label="Nome completo">
                <input style={styles.input} value={identity.name} onChange={(e) => setIdentity({ ...identity, name: e.target.value })} />
              </Field>
              <Field label="WhatsApp">
                <input style={styles.input} value={identity.phone} onChange={(e) => setIdentity({ ...identity, phone: e.target.value })} />
              </Field>
              <Field label="E-mail">
                <input style={styles.input} type="email" value={identity.email} onChange={(e) => setIdentity({ ...identity, email: e.target.value })} />
              </Field>
            </div>
            <label style={styles.consent}>
              <input
                type="checkbox"
                checked={identity.consent}
                onChange={(e) => setIdentity({ ...identity, consent: e.target.checked })}
              />
              Autorizo o uso das informações enviadas para este processo seletivo.
            </label>
            <button style={styles.primary} disabled={busy} onClick={start}>
              {busy ? "Iniciando..." : "Começar entrevista"}
            </button>
          </section>
        )}

        {step === 1 && (
          <section style={styles.card}>
            <h2>1. Envie seu currículo</h2>
            <p style={styles.text}>
              A IA vai ler o currículo para personalizar as próximas perguntas. Envie PDF ou documento compatível.
            </p>
            <input
              style={styles.input}
              type="file"
              accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.webp,image/*"
              onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
            />
            <button style={styles.primary} disabled={busy} onClick={sendResume}>
              {busy ? "Analisando currículo..." : "Analisar currículo e continuar"}
            </button>
          </section>
        )}

        {step === 2 && (
          <section style={styles.card}>
            <h2>2. Conheça a vaga</h2>
            <p style={styles.text}>
              Antes das perguntas, assista à apresentação para entender o trabalho e decidir com informação real.
            </p>

            {interview.videoUrl ? (
              <div style={styles.videoBox}>
                <iframe
                  title="Apresentação da vaga"
                  src={interview.videoUrl}
                  style={{ width: "100%", height: "100%", border: 0 }}
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <div style={styles.infoBox}>Esta vaga não possui vídeo de apresentação cadastrado.</div>
            )}

            {resumeData?.lastRole && (
              <div style={styles.infoBox}>
                Currículo analisado. Último cargo identificado: <strong>{resumeData.lastRole}</strong>
              </div>
            )}

            <button style={styles.primary} onClick={() => setStep(3)}>
              Já conheci a vaga → Iniciar perguntas
            </button>
          </section>
        )}

        {step === 3 && (
          <section style={styles.card}>
            <div style={styles.counter}>Pergunta {Math.min(answers.length + 1, questions.length)} de {questions.length}</div>
            <h2 style={{ lineHeight: 1.35 }}>{currentQuestion?.prompt || "Perguntas concluídas"}</h2>
            <textarea
              style={{ ...styles.input, minHeight: 150 }}
              value={currentAnswer}
              onChange={(e) => setCurrentAnswer(e.target.value)}
              placeholder="Responda com suas palavras e exemplos reais."
            />
            <button style={styles.primary} onClick={nextQuestion}>
              {answers.length + 1 >= questions.length ? "Concluir perguntas" : "Próxima pergunta"}
            </button>
          </section>
        )}

        {step === 4 && (
          <section style={styles.card}>
            <h2>3. Áudio — valores profissionais</h2>
            <p style={styles.text}>
              Conte o que é importante para você no ambiente profissional, como mantém
              o compromisso com metas difíceis e como reage quando um resultado
              demora a aparecer.
            </p>
            <p style={styles.small}>
              Vamos avaliar somente o conteúdo profissional da resposta. Não são feitas
              inferências sobre saúde mental ou emoções pela voz.
            </p>
            <DirectMediaRecorder
              kind="audio"
              disabled={busy}
              onSend={(file) => sendMedia("audio", file)}
            />
          </section>
        )}

        {step === 5 && (
          <section style={styles.card}>
            <h2>4. Vídeo — apresentação profissional</h2>
            <p style={styles.text}>
              Apresente-se, conte sua experiência mais relevante para esta vaga e
              compartilhe uma meta, resultado ou desafio profissional importante.
            </p>
            <p style={styles.small}>
              A análise considera o que você disser, não sua aparência,
              expressões faciais ou linguagem corporal.
            </p>
            <DirectMediaRecorder
              kind="video"
              disabled={busy}
              onSend={(file) => sendMedia("video", file)}
            />
          </section>
        )}

        {step === 6 && (
          <section style={styles.card}>
            <h2>5. Finalizar</h2>
            <p style={styles.text}>
              Suas respostas serão organizadas em um relatório para a equipe de RH, junto do currículo e das transcrições.
            </p>
            <div style={styles.infoBox}>
              ✓ Currículo analisado<br />
              ✓ {answers.length} respostas profissionais<br />
              ✓ Áudio transcrito<br />
              ✓ Vídeo transcrito
            </div>
            <button style={styles.primary} disabled={busy} onClick={finishInterview}>
              {busy ? "Gerando análise..." : "Finalizar entrevista"}
            </button>
          </section>
        )}
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: "grid", gap: 7, fontWeight: 700, color: "#334155" }}>{label}{children}</label>;
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#f4f7fb", padding: "24px 14px", fontFamily: "Inter, Arial, sans-serif", color: "#0f172a" },
  shell: { maxWidth: 860, margin: "0 auto", display: "grid", gap: 18 },
  header: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 20, padding: 22, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 18, flexWrap: "wrap" },
  title: { margin: "5px 0", fontSize: 28 },
  text: { color: "#475569", lineHeight: 1.65 },
  small: { color: "#64748b", fontSize: 13, lineHeight: 1.5 },
  card: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 20, padding: 24, display: "grid", gap: 16 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 },
  input: { width: "100%", boxSizing: "border-box", border: "1px solid #cbd5e1", borderRadius: 12, padding: "12px 14px", fontSize: 15, background: "#fff" },
  primary: { border: 0, borderRadius: 12, padding: "13px 18px", fontWeight: 900, background: "#2563eb", color: "#fff", cursor: "pointer", width: "fit-content" },
  consent: { display: "flex", gap: 10, alignItems: "flex-start", color: "#475569", fontSize: 14 },
  progressBox: { minWidth: 180, display: "grid", gap: 6, fontWeight: 800, color: "#2563eb" },
  track: { height: 8, borderRadius: 99, background: "#e2e8f0", overflow: "hidden" },
  bar: { height: "100%", background: "#2563eb", borderRadius: 99, transition: "width .25s ease" },
  videoBox: { width: "100%", aspectRatio: "16/9", background: "#0f172a", borderRadius: 16, overflow: "hidden" },
  infoBox: { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 14, color: "#475569", lineHeight: 1.6 },
  counter: { fontSize: 13, color: "#2563eb", fontWeight: 900 },
};
