"use client";

import { useMemo, useState, type ReactNode } from "react";
import Image from "next/image";

type FormState = {
  name: string;
  cpf: string;
  birthDate: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  neighborhood: string;
  cep: string;
  education: string;
  course: string;
  courseStatus: string;
  lastRole: string;
  skills: string;
  languages: string;
  salaryExpectation: string;
  workModel: string;
  experience: string;
};

const initialForm: FormState = {
  name: "",
  cpf: "",
  birthDate: "",
  phone: "",
  email: "",
  city: "",
  state: "SP",
  neighborhood: "",
  cep: "",
  education: "",
  course: "",
  courseStatus: "",
  lastRole: "",
  skills: "",
  languages: "",
  salaryExpectation: "",
  workModel: "Presencial",
  experience: "",
};

function cleanDigits(value: string) {
  return value.replace(/\D/g, "");
}

function formatPhone(value: string) {
  const digits = cleanDigits(value).slice(0, 11);

  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatCpf(value: string) {
  const digits = cleanDigits(value).slice(0, 11);

  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

function formatCep(value: string) {
  const digits = cleanDigits(value).slice(0, 8);

  if (digits.length <= 5) return digits;

  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function StepBadge({ step, current }: { step: number; current: number }) {
  const active = step <= current;

  return (
    <div
      className={[
        "flex h-9 w-9 items-center justify-center rounded-full border text-sm font-black transition",
        active
          ? "border-blue-600 bg-blue-600 text-white shadow-lg shadow-blue-200"
          : "border-blue-100 bg-white text-blue-300",
      ].join(" ")}
    >
      {step}
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.3em] text-blue-600">
        Cadastro
      </p>
      <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950 md:text-3xl">
        {title}
      </h2>
      <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-slate-600">
        {label}
      </span>
      {children}
    </label>
  );
}

export default function CandidaturaMotivarPage() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(initialForm);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const progress = useMemo(() => Math.round((step / 3) * 100), [step]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validateStep() {
    setError("");

    if (step === 1) {
      if (!form.name.trim()) {
        setError("Informe seu nome completo.");
        return false;
      }

      if (cleanDigits(form.phone).length < 10) {
        setError("Informe um WhatsApp válido.");
        return false;
      }

      if (!form.email.includes("@")) {
        setError("Informe um e-mail válido.");
        return false;
      }

      if (!form.city.trim()) {
        setError("Informe sua cidade.");
        return false;
      }
    }

    if (step === 2) {
      if (!form.education) {
        setError("Selecione sua escolaridade.");
        return false;
      }

      if (!form.courseStatus) {
        setError("Selecione o status do curso.");
        return false;
      }
    }

    if (step === 3) {
  if (!form.lastRole.trim()) {
    setError("Informe seu último cargo ou cargo desejado.");
    return false;
  }

  const exp = form.experience.trim().toLowerCase();

  if (
    exp &&
    exp !== "primeiro emprego" &&
    exp !== "não tenho experiência" &&
    exp !== "nao tenho experiencia" &&
    exp.length < 20
  ) {
    setError(
      'Descreva um pouco mais sua experiência ou escreva "Primeiro emprego".'
    );
    return false;
  }
}
      if (step === 3) {
  if (!form.lastRole.trim()) {
    setError("Informe seu último cargo ou cargo desejado.");
    return false;
  }

  const exp = form.experience.trim().toLowerCase();

  if (
    exp &&
    exp !== "primeiro emprego" &&
    exp !== "não tenho experiência" &&
    exp !== "nao tenho experiencia" &&
    exp.length < 20
  ) {
    setError(
      'Descreva um pouco mais sua experiência ou escreva "Primeiro emprego".'
    );
    return false;
  }
}

return true;
}
  function next() {
    if (!validateStep()) return;

    setStep((s) => Math.min(3, s + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function back() {
    setError("");
    setStep((s) => Math.max(1, s - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit() {
    if (!validateStep()) return;

    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/public/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          phone: cleanDigits(form.phone),
          mobile: cleanDigits(form.phone),
          cpf: cleanDigits(form.cpf),
          cep: cleanDigits(form.cep),
          zipCode: cleanDigits(form.cep),
          origin: "site",
          source: "site",
          companySlug: "motivar",
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || "Não foi possível enviar sua candidatura.");
      }

      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao enviar candidatura.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-sky-100 px-4 py-8 text-slate-900">
        <section className="mx-auto flex min-h-[80vh] max-w-2xl items-center">
          <div className="w-full rounded-[2rem] border border-blue-100 bg-white p-8 text-center shadow-2xl shadow-blue-100">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-blue-600 text-4xl text-white">
              ✓
            </div>

            <p className="mb-2 text-xs font-black uppercase tracking-[0.35em] text-blue-600">
              Motivar RH
            </p>

            <h1 className="mb-4 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
              Candidatura enviada!
            </h1>

            <p className="mx-auto max-w-md text-base leading-relaxed text-slate-600">
              Recebemos suas informações. Se o seu perfil avançar, nossa equipe entrará em contato pelo WhatsApp ou e-mail informado.
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-sky-100 px-4 py-8 text-slate-900">
      <section className="mx-auto max-w-6xl">
        <div className="overflow-hidden rounded-[2rem] border border-blue-100 bg-white shadow-2xl shadow-blue-100/80">
          <div className="bg-gradient-to-r from-blue-800 via-blue-700 to-sky-500 px-5 py-8 text-white md:px-10 md:py-10">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white p-2 shadow-lg">
                  <Image
                    src="/logo.jpeg"
                    alt="Motivar RH"
                    width={180}
                    height={70}
                    priority
                    className="h-full w-full object-contain"
                  />
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.35em] text-blue-100">
                    Motivar RH
                  </p>

                  <h1 className="mt-1 text-3xl font-black tracking-tight md:text-5xl">
                    Trabalhe conosco
                  </h1>
                </div>
              </div>

              <div className="rounded-2xl bg-white/15 p-4 backdrop-blur">
                <p className="text-sm font-bold">Cadastro rápido pelo celular</p>
                <p className="mt-1 max-w-xs text-sm text-blue-50">
                  Preencha com atenção. Essas informações ajudam a conectar seu perfil às vagas certas.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-0 md:grid-cols-[1fr_320px]">
            <form
              className="p-5 md:p-10"
              onSubmit={(e) => {
                e.preventDefault();
                step === 3 ? submit() : next();
              }}
            >
              <div className="mb-8">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <StepBadge step={1} current={step} />
                    <StepBadge step={2} current={step} />
                    <StepBadge step={3} current={step} />
                  </div>

                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                    Passo {step} de 3
                  </span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-blue-50">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-600 to-sky-400 transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {error ? (
                <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                  {error}
                </div>
              ) : null}

              {step === 1 ? (
                <div className="space-y-5">
                  <SectionTitle
                    title="Dados pessoais"
                    subtitle="Informações básicas para contato."
                  />

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Nome completo *">
                      <input
                        className="input"
                        value={form.name}
                        onChange={(e) => update("name", e.target.value)}
                        placeholder="Ex: Maria Silva"
                        autoComplete="name"
                      />
                    </Field>

                    <Field label="CPF">
                      <input
                        className="input"
                        value={form.cpf}
                        onChange={(e) => update("cpf", formatCpf(e.target.value))}
                        placeholder="000.000.000-00"
                        inputMode="numeric"
                      />
                    </Field>

                    <Field label="Data de nascimento">
                      <input
                        className="input"
                        type="date"
                        value={form.birthDate}
                        onChange={(e) => update("birthDate", e.target.value)}
                      />
                    </Field>

                    <Field label="Telefone / WhatsApp *">
                      <input
                        className="input"
                        value={form.phone}
                        onChange={(e) => update("phone", formatPhone(e.target.value))}
                        placeholder="(11) 99999-9999"
                        inputMode="tel"
                        autoComplete="tel"
                      />
                    </Field>

                    <Field label="E-mail *">
                      <input
                        className="input"
                        type="email"
                        value={form.email}
                        onChange={(e) => update("email", e.target.value)}
                        placeholder="email@dominio.com"
                        autoComplete="email"
                      />
                    </Field>

                    <Field label="Cidade *">
                      <input
                        className="input"
                        value={form.city}
                        onChange={(e) => update("city", e.target.value)}
                        placeholder="São Paulo"
                        autoComplete="address-level2"
                      />
                    </Field>

                    <Field label="Estado">
                      <select
                        className="input"
                        value={form.state}
                        onChange={(e) => update("state", e.target.value)}
                      >
                        {[
                          "SP",
                          "RJ",
                          "MG",
                          "PR",
                          "SC",
                          "RS",
                          "BA",
                          "PE",
                          "CE",
                          "GO",
                          "DF",
                          "ES",
                          "Outro",
                        ].map((uf) => (
                          <option key={uf} value={uf}>
                            {uf}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Bairro">
                      <input
                        className="input"
                        value={form.neighborhood}
                        onChange={(e) => update("neighborhood", e.target.value)}
                        placeholder="Ex: Tatuapé"
                        autoComplete="address-level3"
                      />
                    </Field>

                    <Field label="CEP">
                      <input
                        className="input"
                        value={form.cep}
                        onChange={(e) => update("cep", formatCep(e.target.value))}
                        placeholder="00000-000"
                        inputMode="numeric"
                        autoComplete="postal-code"
                      />
                    </Field>
                  </div>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="space-y-5">
                  <SectionTitle
                    title="Formação"
                    subtitle="Conte sua escolaridade e cursos principais."
                  />

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Escolaridade *">
                      <select
                        className="input"
                        value={form.education}
                        onChange={(e) => update("education", e.target.value)}
                      >
                        <option value="">Selecione</option>
                        <option>Ensino fundamental</option>
                        <option>Ensino médio</option>
                        <option>Ensino técnico</option>
                        <option>Ensino superior</option>
                        <option>Pós-graduação</option>
                      </select>
                    </Field>

                    <Field label="Curso">
                      <input
                        className="input"
                        value={form.course}
                        onChange={(e) => update("course", e.target.value)}
                        placeholder="Ex: Administração, Enfermagem..."
                      />
                    </Field>

                    <Field label="Status do curso *">
                      <select
                        className="input"
                        value={form.courseStatus}
                        onChange={(e) => update("courseStatus", e.target.value)}
                      >
                        <option value="">Selecione</option>
                        <option>Cursando</option>
                        <option>Concluído</option>
                        <option>Trancado</option>
                        <option>Não se aplica</option>
                      </select>
                    </Field>

                    <Field label="Idiomas">
                      <input
                        className="input"
                        value={form.languages}
                        onChange={(e) => update("languages", e.target.value)}
                        placeholder="Ex: Inglês básico, Espanhol intermediário"
                      />
                    </Field>
                  </div>
                </div>
              ) : null}

              {step === 3 ? (
                <div className="space-y-5">
                  <SectionTitle
                    title="Experiência profissional"
                    subtitle="Ajude a equipe a entender seu perfil."
                  />

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Último cargo / cargo desejado *">
                      <input
                        className="input"
                        value={form.lastRole}
                        onChange={(e) => update("lastRole", e.target.value)}
                        placeholder="Ex: Auxiliar administrativo"
                      />
                    </Field>

                    <Field label="Habilidades">
                      <input
                        className="input"
                        value={form.skills}
                        onChange={(e) => update("skills", e.target.value)}
                        placeholder="Ex: atendimento, vendas, Excel"
                      />
                    </Field>

                    <Field label="Pretensão salarial">
                      <input
                        className="input"
                        value={form.salaryExpectation}
                        onChange={(e) => update("salaryExpectation", e.target.value)}
                        placeholder="Ex: 2000"
                        inputMode="decimal"
                      />
                    </Field>

                    <Field label="Modelo de trabalho">
                      <select
                        className="input"
                        value={form.workModel}
                        onChange={(e) => update("workModel", e.target.value)}
                      >
                        <option>Presencial</option>
                        <option>Híbrido</option>
                        <option>Remoto</option>
                        <option>Indiferente</option>
                      </select>
                    </Field>

                    <div className="md:col-span-2">
                      <Field label="Experiência profissional *">
                        <textarea
                          className="input min-h-[150px] resize-y py-4"
                          value={form.experience}
                          onChange={(e) => update("experience", e.target.value)}
                          placeholder="Ex.: Trabalhei 2 anos como vendedor. Se nunca trabalhou, escreva: 'Primeiro emprego' ou 'Não tenho experiência'."
                        />
                      </Field>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={back}
                  disabled={step === 1 || loading}
                  className="rounded-2xl border border-blue-100 px-6 py-4 text-sm font-black text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Voltar
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-2xl bg-gradient-to-r from-blue-700 to-sky-500 px-8 py-4 text-sm font-black text-white shadow-xl shadow-blue-200 transition hover:scale-[1.01] disabled:cursor-wait disabled:opacity-70"
                >
                  {loading ? "Enviando..." : step === 3 ? "Enviar candidatura" : "Continuar"}
                </button>
              </div>
            </form>

            <aside className="border-t border-blue-50 bg-blue-50/70 p-5 md:border-l md:border-t-0 md:p-8">
              <div className="sticky top-6 space-y-4">
                <div className="rounded-3xl bg-white p-6 shadow-lg shadow-blue-100">
                  <p className="text-xs font-black uppercase tracking-[0.25em] text-blue-600">
                    Dica
                  </p>

                  <h2 className="mt-2 text-2xl font-black text-slate-950">
                    Preencha com clareza
                  </h2>

                  <p className="mt-3 text-sm leading-relaxed text-slate-600">
                    Na experiência, conte seus cargos, atividades, tempo de experiência e região onde pode trabalhar.
                  </p>
                </div>

                <div className="rounded-3xl border border-blue-100 bg-white p-6">
                  <h3 className="font-black text-slate-950">Campos importantes</h3>

                  <ul className="mt-3 space-y-2 text-sm text-slate-600">
                    <li>• WhatsApp correto</li>
                    <li>• Cidade e estado</li>
                    <li>• Último cargo</li>
                    <li>• Experiência profissional</li>
                  </ul>
                </div>
              </div>
            </aside>
          </div>
        </div>

        <p className="mt-5 text-center text-xs text-slate-500">
          Seus dados serão usados apenas para processos seletivos da Motivar.
        </p>
      </section>

      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 1rem;
          border: 1px solid #bfdbfe;
          background: #ffffff;
          padding: 0.95rem 1rem;
          font-size: 0.95rem;
          color: #0f172a;
          outline: none;
          transition: 160ms ease;
        }

        .input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12);
        }

        .input::placeholder {
          color: #94a3b8;
        }
      `}</style>
    </main>
  );
}
