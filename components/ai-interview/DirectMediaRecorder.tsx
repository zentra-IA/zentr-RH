"use client";

import { useEffect, useRef, useState } from "react";

type Kind = "audio" | "video";
type RecordingState = "idle" | "requesting" | "recording" | "preparing" | "ready";

type Props = {
  kind: Kind;
  disabled?: boolean;
  onSend: (file: File) => Promise<void>;
};

const MAX_FILE_BYTES = 25 * 1024 * 1024;

function preferredMime(kind: Kind): string | undefined {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return undefined;

  const candidates =
    kind === "audio"
      ? [
          "audio/webm;codecs=opus",
          "audio/mp4",
          "audio/webm",
          "audio/ogg;codecs=opus",
        ]
      : [
          "video/webm;codecs=vp8,opus",
          "video/webm;codecs=vp9,opus",
          "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
          "video/webm",
          "video/mp4",
        ];

  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

function extension(type: string, kind: Kind) {
  if (type.includes("mp4")) return "mp4";
  if (type.includes("ogg")) return "ogg";
  if (type.includes("webm")) return "webm";
  return kind === "video" ? "webm" : "webm";
}

function formatSeconds(total: number) {
  const minutes = Math.floor(total / 60);
  return `${String(minutes).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function cameraError(error: unknown, kind: Kind) {
  const name = (error as { name?: string })?.name || "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return `Permissão negada. Autorize o ${kind === "audio" ? "microfone" : "microfone e a câmera"} nas configurações do navegador.`;
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return `Não foi encontrado ${kind === "audio" ? "um microfone" : "câmera e/ou microfone"} neste dispositivo.`;
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "Outro aplicativo pode estar usando a câmera ou o microfone. Feche-o e tente novamente.";
  }
  if (name === "SecurityError" || name === "TypeError") {
    return "A gravação requer HTTPS ou localhost e permissão do navegador.";
  }
  return "Não foi possível iniciar a gravação. Tente novamente ou use um arquivo já gravado.";
}

export default function DirectMediaRecorder({ kind, disabled = false, onSend }: Props) {
  const [state, setState] = useState<RecordingState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [recordingSupported, setRecordingSupported] = useState(true);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewUrlRef = useRef("");
  const elapsedStartRef = useRef(0);
  const chunksRef = useRef<Blob[]>([]);
  const unmountedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isRecording = state === "recording";

  function releaseTracks() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  function releasePreview() {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = "";
    setPreviewUrl("");
  }

  function prepareFile(nextFile: File) {
    releasePreview();
    const url = URL.createObjectURL(nextFile);
    previewUrlRef.current = url;
    setFile(nextFile);
    setPreviewUrl(url);
    setState("ready");
  }

  useEffect(() => {
    unmountedRef.current = false;
    setRecordingSupported(
      Boolean(
        typeof window !== "undefined" &&
          window.isSecureContext &&
          navigator.mediaDevices?.getUserMedia &&
          typeof MediaRecorder !== "undefined"
      )
    );

    return () => {
      unmountedRef.current = true;
      const rec = recorderRef.current;
      if (rec && rec.state !== "inactive") {
        rec.ondataavailable = null;
        rec.onstop = null;
        rec.onerror = null;
        rec.stop();
      }
      recorderRef.current = null;
      releaseTracks();
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = "";
    };
  }, []);

  useEffect(() => {
    if (!isRecording) return;
    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - elapsedStartRef.current) / 1000));
    }, 250);
    return () => window.clearInterval(timer);
  }, [isRecording]);

  async function startRecording() {
    if (disabled || sending || state === "recording" || state === "requesting") return;

    setError("");
    setFile(null);
    releasePreview();
    setElapsed(0);

    if (
      !window.isSecureContext ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setError("Seu navegador não permite gravar nesta página. Abra no Chrome, Safari ou Edge por HTTPS/localhost, ou envie um arquivo.");
      return;
    }

    try {
      setState("requesting");

      const constraints: MediaStreamConstraints =
        kind === "audio"
          ? { audio: { echoCancellation: true, noiseSuppression: true } }
          : {
              audio: { echoCancellation: true, noiseSuppression: true },
              video: {
                facingMode: "user",
                width: { ideal: 640 },
                height: { ideal: 480 },
                frameRate: { ideal: 24 },
              },
            };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (unmountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      if (kind === "video" && videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.play().catch(() => undefined);
      }

      const mimeType = preferredMime(kind);
      const bitrateOptions =
        kind === "video"
          ? { videoBitsPerSecond: 450_000, audioBitsPerSecond: 64_000 }
          : { audioBitsPerSecond: 64_000 };

      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, {
          ...(mimeType ? { mimeType } : {}),
          ...bitrateOptions,
        });
      } catch {
        recorder = new MediaRecorder(stream);
      }

      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onerror = () => {
        releaseTracks();
        if (!unmountedRef.current) {
          setError("A gravação foi interrompida pelo navegador. Tente novamente.");
          setState("idle");
        }
      };

      recorder.onstop = () => {
        releaseTracks();
        if (unmountedRef.current) return;

        const outputType = recorder.mimeType || mimeType || (kind === "video" ? "video/webm" : "audio/webm");
        const blob = new Blob(chunksRef.current, { type: outputType });
        chunksRef.current = [];

        if (!blob.size) {
          setError("A gravação ficou vazia. Grave novamente.");
          setState("idle");
          return;
        }

        if (blob.size > MAX_FILE_BYTES) {
          setError("A gravação ultrapassou 25 MB, limite de transcrição. Faça uma gravação mais compacta ou envie um arquivo menor.");
          setState("idle");
          return;
        }

        const name = `${kind}-${Date.now()}.${extension(outputType, kind)}`;
        prepareFile(new File([blob], name, { type: outputType }));
      };

      elapsedStartRef.current = Date.now();
      recorder.start(1000);
      setState("recording");
    } catch (exception) {
      releaseTracks();
      setState("idle");
      setError(cameraError(exception, kind));
    }
  }

  function stopRecording() {
    const rec = recorderRef.current;
    if (!rec || rec.state === "inactive") return;
    setState("preparing");
    try {
      rec.stop();
    } catch {
      releaseTracks();
      setError("Não foi possível finalizar a gravação. Tente novamente.");
      setState("idle");
    }
  }

  function reset() {
    if (state === "recording") stopRecording();
    setFile(null);
    releasePreview();
    setError("");
    setElapsed(0);
    setState("idle");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function selectFile(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (!selected) return;
    setError("");

    if (selected.size > MAX_FILE_BYTES) {
      setError("O arquivo deve ter até 25 MB para ser transcrito.");
      return;
    }

    if (selected.size === 0) {
      setError("O arquivo está vazio.");
      return;
    }

    prepareFile(selected);
  }

  async function send() {
    if (!file || disabled || sending) return;
    try {
      setError("");
      setSending(true);
      await onSend(file);
    } catch (exception: any) {
      setError(exception?.message || "Não foi possível enviar. A gravação foi mantida; tente novamente.");
    } finally {
      if (!unmountedRef.current) setSending(false);
    }
  }

  const isAudio = kind === "audio";
  const disabledInteraction = disabled || sending;
  const uploading = disabled || sending;
  const label = isAudio ? "áudio" : "vídeo";

  return (
    <div style={styles.wrapper}>
      {kind === "video" && (
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{
            ...styles.camera,
            display: state === "requesting" || state === "recording" ? "block" : "none",
          }}
        />
      )}

      {(state === "recording" || state === "preparing") && (
        <div style={styles.recordingStatus} role="status">
          <span style={styles.dot}>●</span>
          {state === "preparing" ? "Preparando gravação..." : `Gravando ${label} • ${formatSeconds(elapsed)}`}
        </div>
      )}

      {!recordingSupported && (
        <div style={styles.note}>
          A gravação direta não está disponível neste navegador. Você pode abrir o link no Chrome, Safari ou Edge ou usar a opção de enviar arquivo.
        </div>
      )}

      {(state === "idle" || state === "ready") && (
        <div style={styles.buttons}>
          <button
            type="button"
            style={styles.primary}
            disabled={disabledInteraction || !recordingSupported}
            onClick={startRecording}
          >
            {state === "ready"
              ? `↻ Gravar outro ${label}`
              : isAudio
                ? "🎙️ Gravar áudio agora"
                : "📹 Gravar vídeo agora"}
          </button>
        </div>
      )}

      {state === "requesting" && (
        <p style={styles.note}>Permita o acesso ao {isAudio ? "microfone" : "microfone e à câmera"} na janela do navegador.</p>
      )}

      {state === "recording" && (
        <button type="button" style={styles.stop} onClick={stopRecording}>
          ■ Parar gravação
        </button>
      )}

      {state === "ready" && previewUrl && (
        <div style={styles.preview}>
          <strong style={styles.previewTitle}>Confira sua gravação</strong>
          {isAudio ? (
            <audio src={previewUrl} controls preload="metadata" style={{ width: "100%" }} />
          ) : (
            <video src={previewUrl} controls playsInline preload="metadata" style={styles.playback} />
          )}
          <span style={styles.note}>
            {file?.name} • {((file?.size || 0) / (1024 * 1024)).toFixed(1)} MB
          </span>
          <div style={styles.buttons}>
            <button type="button" disabled={disabledInteraction} onClick={reset} style={styles.secondary}>
              Refazer
            </button>
            <button type="button" disabled={uploading} onClick={send} style={styles.primary}>
              {uploading ? "Enviando e transcrevendo..." : `✓ Enviar ${label}`}
            </button>
          </div>
        </div>
      )}

      <div style={styles.fileAlternative}>
        <label htmlFor={`fallback-${kind}`} style={styles.alternativeLabel}>
          Ou envie um {label} que já está no dispositivo
        </label>
        <input
          id={`fallback-${kind}`}
          ref={fileInputRef}
          type="file"
          disabled={disabledInteraction || state === "recording" || state === "requesting" || state === "preparing"}
          accept={isAudio ? "audio/*,.webm,.mp4,.m4a,.mp3,.wav,.ogg" : "video/*,.webm,.mp4,.mov"}
          onChange={selectFile}
          style={styles.fileInput}
        />
      </div>

      {error && <div role="alert" style={styles.error}>{error}</div>}

      <p style={styles.disclaimer}>
        A gravação só será enviada após você tocar em “Enviar {label}”. A página pedirá permissão antes de usar {isAudio ? "o microfone" : "a câmera e o microfone"}.
      </p>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: { display: "grid", gap: 14 },
  buttons: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" },
  primary: { padding: "13px 18px", borderRadius: 12, border: 0, background: "#2563eb", color: "#fff", fontWeight: 800, cursor: "pointer" },
  secondary: { padding: "13px 18px", borderRadius: 12, border: "1px solid #cbd5e1", background: "#fff", color: "#334155", fontWeight: 800, cursor: "pointer" },
  stop: { width: "fit-content", padding: "13px 18px", borderRadius: 12, border: 0, background: "#dc2626", color: "#fff", cursor: "pointer", fontWeight: 800 },
  camera: { width: "100%", maxHeight: 420, aspectRatio: "4/3", objectFit: "cover", borderRadius: 16, background: "#0f172a", transform: "scaleX(-1)" },
  playback: { width: "100%", maxHeight: 380, borderRadius: 12, background: "#0f172a" },
  preview: { display: "grid", gap: 12, background: "#f8fafc", padding: 14, border: "1px solid #dbeafe", borderRadius: 14 },
  previewTitle: { color: "#0f172a" },
  recordingStatus: { display: "flex", gap: 8, fontWeight: 800, color: "#b91c1c", alignItems: "center" },
  dot: { color: "#ef4444", fontSize: 17 },
  fileAlternative: { display: "grid", gap: 7, borderTop: "1px solid #e2e8f0", paddingTop: 12 },
  alternativeLabel: { color: "#475569", fontSize: 13, fontWeight: 700 },
  fileInput: { maxWidth: "100%", fontSize: 13 },
  note: { margin: 0, color: "#64748b", lineHeight: 1.55, fontSize: 13 },
  disclaimer: { margin: 0, fontSize: 12, color: "#64748b", lineHeight: 1.6 },
  error: { border: "1px solid #fecaca", background: "#fef2f2", color: "#b91c1c", borderRadius: 12, padding: 12, fontSize: 13 },
};
