"use client";
import { NativeLink as Link, navigate } from "./native-link";
import { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  ArrowUp,
  Lightbulb,
  Swords,
  BookOpen,
  ShieldCheck,
  Check,
  ChevronLeft,
  FileText,
  ThumbsUp,
  ThumbsDown,
  Square,
  RefreshCw,
  ArrowRight,
  NotebookPen,
  Download,
  Trash2,
} from "lucide-react";
import {
  api,
  useResource,
  Loading,
  ErrorBox,
  Modal,
  Empty,
  Toast,
  type SessionDetail,
  type Citation,
} from "./client";
import { phaseLabels } from "../lib/contracts";
import { MaterialPreview } from "./course-view";
export function ChatView({ id }: { id: string }) {
  const r = useResource<SessionDetail>("sessions/" + id),
    [input, setInput] = useState(""),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState(""),
    [error, setError] = useState(""),
    [stream, setStream] = useState(""),
    [pending, setPending] = useState<{
      content: string;
      action: string | null;
      key: string;
    } | null>(null),
    [tab, setTab] = useState("dialog"),
    [citation, setCitation] = useState<Citation | null>(null),
    [direct, setDirect] = useState(false),
    [finish, setFinish] = useState(false),
    [reflection, setReflection] = useState(""),
    [note, setNote] = useState(""),
    [noteTouched, setNoteTouched] = useState(false),
    [toast, setToast] = useState(""),
    [finishing, setFinishing] = useState(false);
  const controller = useRef<AbortController | null>(null),
    bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (stream || busy)
      bottom.current?.scrollIntoView({ behavior: "auto", block: "nearest" });
  }, [stream, busy]);
  useEffect(() => () => controller.current?.abort(), []);
  async function send(
    content: string,
    action: string | null = null,
    retry?: typeof pending,
  ) {
    if (busy) return;
    const payload = retry || { content, action, key: crypto.randomUUID() };
    if (!payload.content && !payload.action) return;
    setBusy(true);
    setError("");
    setPending(payload);
    setStream("");
    setInput("");
    setStatus("Mencari materi kelas…");
    controller.current = new AbortController();
    try {
      const response = await fetch("/api/sessions/" + id + "/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.current.signal,
      });
      if (!response.ok) {
        const d = (await response.json()) as { error: string };
        throw new Error(d.error);
      }
      setStatus("Menyusun respons…");
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Respons belum tersedia. Coba lagi.");
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let n: number;
        while ((n = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, n);
          buffer = buffer.slice(n + 1);
          if (!line) continue;
          const part = JSON.parse(line) as { type: string; text?: string };
          if (part.type === "text") setStream((v) => v + (part.text || ""));
        }
      }
      setPending(null);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError")
        setError(
          "Tampilan respons dihentikan. Pesan yang sudah tersimpan tetap ada; muat ulang atau coba lagi.",
        );
      else setError((e as Error).message);
    } finally {
      await r.reload();
      setStream("");
      setBusy(false);
      setStatus("");
    }
  }
  async function feedback(mid: string, value: number) {
    try {
      await api("messages/" + mid + "/feedback", "PATCH", { feedback: value });
      await r.reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function saveNote() {
    try {
      await api("sessions/" + id, "PATCH", {
        note: noteTouched ? note : r.data?.session.note || "",
      });
      setToast("Catatan tersimpan.");
      setTimeout(() => setToast(""), 3000);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function complete() {
    setFinishing(true);
    try {
      await api("sessions/" + id + "/finish", "POST", { reflection });
      navigate("/student/sessions/" + id + "/summary");
    } catch (e) {
      setError((e as Error).message);
      setFinishing(false);
    }
  }
  if (r.loading && !r.data) return <Loading />;
  if (r.error || !r.data)
    return (
      <div className="page-content">
        <ErrorBox message={r.error} retry={r.reload} />
      </div>
    );
  const d = r.data,
    s = d.session;
  const unanswered = d.messages
    .filter(
      (m) =>
        m.role === "USER" &&
        !d.messages.some(
          (a) => a.role === "ASSISTANT" && a.requestKey === m.requestKey,
        ),
    )
    .at(-1);
  const retryPayload =
    pending ||
    (unanswered
      ? {
          content: unanswered.content,
          action: null,
          key: unanswered.requestKey,
        }
      : null);
  const phaseOrder = [
    "ORIENT",
    "ELICIT",
    "CLARIFY",
    "PROBE_REASONING",
    "CHALLENGE",
    "SYNTHESIZE",
    "CHECK",
    "REFLECT",
  ];
  return (
    <>
      <div className="chat-mobile-tabs">
        {[
          ["dialog", "Dialog"],
          ["material", "Materi & tujuan"],
          ["progress", "Progres & catatan"],
        ].map(([value, label]) => (
          <button
            className={tab === value ? "active" : ""}
            key={value}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className={"chat-layout show-" + tab}>
        <aside className="chat-left">
          <Link
            className="text-btn"
            style={{ fontSize: 10, color: "#71809b" }}
            href={"/student/courses/" + d.course.id}
          >
            <ChevronLeft size={12} />
            Kembali ke kelas
          </Link>
          <span className="eyebrow" style={{ marginTop: 25 }}>
            {d.course.code}
          </span>
          <h2 style={{ fontSize: 18, margin: "10px 0 22px" }}>
            {d.course.title}
          </h2>
          <span className="tag">
            {s.mode === "ARGUMENT_REVIEW"
              ? "Bedah argumen"
              : "Belajar Socratic"}
          </span>
          <h3>Tujuan sesi</h3>
          {d.activity.objectives.map((o, i) => (
            <div className="objective" key={i}>
              <span style={{ color: "#3157d5", fontSize: 10, marginTop: 2 }}>
                0{i + 1}
              </span>
              <span>{o}</span>
            </div>
          ))}
          <hr
            style={{
              border: 0,
              borderTop: "1px solid var(--line)",
              margin: "22px 0",
            }}
          />
          <h3>Kebijakan bantuan</h3>
          <p>{d.activity.policy}</p>
          <p style={{ marginTop: 8 }}>
            Kamu boleh meminta petunjuk atau penjelasan sesuai kebijakan
            aktivitas.
          </p>
          <div
            className="notice"
            style={{ fontSize: 10, padding: 12, marginTop: 25 }}
          >
            <ShieldCheck size={17} />
            <strong style={{ display: "block", margin: "7px 0" }}>
              Percakapan ini privat.
            </strong>
            Dosen melihat pola kelas secara agregat. Transkripmu tidak
            dibagikan.
          </div>
        </aside>
        <section className="chat-center">
          <header className="chat-header">
            <div>
              <h1>Ruang dialog</h1>
              <small>
                {d.ai.configured ? "AI terhubung" : "AI menunggu aktivasi"} ·{" "}
                {phaseLabels[s.phase]}
              </small>
            </div>
            {s.status === "COMPLETED" ? (
              <Link
                className="btn small"
                href={"/student/sessions/" + id + "/summary"}
              >
                Lihat refleksi <ArrowRight size={13} />
              </Link>
            ) : (
              <button
                className="btn small"
                onClick={() => setFinish(true)}
                disabled={busy}
              >
                Refleksi & akhiri
              </button>
            )}
          </header>
          <div className="chat-thread">
            <div className="scenario-card">
              <span className="eyebrow" style={{ fontSize: 8 }}>
                KASUS UNTUK DITELUSURI
              </span>
              <strong>{d.activity.title}</strong>
              <p>{d.activity.scenario}</p>
            </div>
            {!d.ai.configured && (
              <div className="notice warn" role="status">
                <strong>Respons AI belum aktif.</strong> Layanan model belum
                dihubungkan oleh pengelola. Kamu tetap dapat membaca kasus,
                menulis gagasan, dan menyimpan catatan. Tidak ada respons
                simulasi yang disamarkan sebagai AI.
              </div>
            )}
            {!d.messages.length && (
              <div className="message">
                <span className="ai-avatar">
                  <NotebookPen size={16} />
                </span>
                <div className="message-body">
                  <div className="message-author">PANDUAN AKTIVITAS</div>
                  <p className="message-text">
                    Mulai dari pemahamanmu sendiri. Apa perbedaan paling penting
                    yang kamu lihat pada respons Raka dan Nisa?
                  </p>
                  <small className="muted" style={{ fontSize: 9 }}>
                    Pertanyaan pembuka aktivitas, bukan respons model.
                  </small>
                </div>
              </div>
            )}
            {d.messages.map((m) => (
              <div
                key={m.id}
                className={
                  "message " + (m.role === "USER" ? "user" : "assistant")
                }
              >
                <span className={m.role === "USER" ? "avatar" : "ai-avatar"}>
                  {m.role === "USER" ? "MH" : <Sparkles size={15} />}
                </span>
                <div className="message-body">
                  <div className="message-author">
                    {m.role === "USER" ? "Kamu" : "SOCRATIVA"}
                    {m.phase && (
                      <span style={{ fontWeight: 400 }}>
                        {" "}
                        · {phaseLabels[m.phase]}
                      </span>
                    )}
                  </div>
                  <p className="message-text">{m.content}</p>
                  {m.role === "ASSISTANT" && (
                    <div className="message-tools">
                      {d.citations
                        .filter((c) => c.messageId === m.id)
                        .map((c) => (
                          <button
                            className="source-chip"
                            key={c.id}
                            onClick={() => setCitation(c)}
                          >
                            <FileText size={10} />
                            {c.title}
                            {c.page ? " · hlm. " + c.page : ""}
                          </button>
                        ))}
                      {!d.citations.some((c) => c.messageId === m.id) && (
                        <span className="tag gray">Pengetahuan umum AI</span>
                      )}
                      <button
                        className="icon-btn"
                        aria-label="Respons berguna"
                        aria-pressed={m.feedback === 1}
                        onClick={() => feedback(m.id, 1)}
                        style={{
                          color: m.feedback === 1 ? "#3157d5" : undefined,
                        }}
                      >
                        <ThumbsUp size={12} />
                      </button>
                      <button
                        className="icon-btn"
                        aria-label="Respons kurang berguna"
                        aria-pressed={m.feedback === -1}
                        onClick={() => feedback(m.id, -1)}
                        style={{
                          color: m.feedback === -1 ? "#c83b4d" : undefined,
                        }}
                      >
                        <ThumbsDown size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {busy && (
              <div className="message">
                <span className="ai-avatar">
                  <Sparkles size={15} />
                </span>
                <div className="message-body">
                  <div className="message-author" role="status">
                    {status}
                  </div>
                  <div className="message-text" aria-live="polite">
                    {stream || "Respons sedang disiapkan…"}
                  </div>
                </div>
              </div>
            )}
            {error && (
              <div className="notice error" role="alert">
                {error}
              </div>
            )}
            {!busy && retryPayload && (
              <div className="notice">
                <p>Pesan terakhir tersimpan, tetapi belum memiliki respons.</p>
                <button
                  className="text-btn"
                  style={{ fontSize: 11 }}
                  onClick={() =>
                    send(
                      retryPayload.content,
                      retryPayload.action,
                      retryPayload,
                    )
                  }
                >
                  <RefreshCw size={13} />
                  Coba respons lagi
                </button>
              </div>
            )}
            <div ref={bottom} />
          </div>
          {s.status === "ACTIVE" && (
            <div className="composer-wrap">
              <div className="quick-actions">
                <button
                  onClick={() => send("", "REQUEST_HINT")}
                  disabled={busy}
                >
                  <Lightbulb size={11} />
                  Saya butuh petunjuk
                </button>
                <button onClick={() => setDirect(true)} disabled={busy}>
                  <BookOpen size={11} />
                  Jelaskan langsung
                </button>
                <button onClick={() => send("", "CHALLENGE")} disabled={busy}>
                  <Swords size={11} />
                  Tantang argumen saya
                </button>
              </div>
              <form
                className="composer"
                onSubmit={(e) => {
                  e.preventDefault();
                  void send(input.trim());
                }}
              >
                <textarea
                  aria-label="Tulis pemikiranmu"
                  placeholder="Tulis pemikiranmu. Tidak perlu langsung sempurna…"
                  maxLength={8000}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={busy}
                  rows={2}
                />
                <div className="composer-bottom">
                  <small>
                    {input.length}/8.000 · Shift + Enter untuk baris baru
                  </small>
                  {busy ? (
                    <button
                      type="button"
                      aria-label="Hentikan respons"
                      onClick={() => controller.current?.abort()}
                    >
                      <Square size={14} />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={!input.trim()}
                      aria-label="Kirim pesan"
                    >
                      <ArrowUp size={17} />
                    </button>
                  )}
                </div>
              </form>
              <p className="composer-caption">
                AI dapat keliru. Periksa sumber dan diskusikan kembali dengan
                dosen.
              </p>
            </div>
          )}
        </section>
        <aside className="chat-right">
          <div>
            <span className="eyebrow" style={{ fontSize: 9 }}>
              PERJALANAN BERPIKIR
            </span>
            <h3 style={{ fontSize: 15 }}>Pelan-pelan, lebih dalam.</h3>
            {phaseOrder.map((p, i) => (
              <div
                className={
                  "phase-step " +
                  (s.phase === p
                    ? "current"
                    : s.visited.includes(p)
                      ? "done"
                      : "")
                }
                key={p}
              >
                <span>
                  {s.visited.includes(p) && s.phase !== p ? (
                    <Check size={10} />
                  ) : (
                    i + 1
                  )}
                </span>
                {phaseLabels[p]}
              </div>
            ))}
            {s.phase === "SCAFFOLD" && (
              <span className="tag">Fase saat ini: Petunjuk</span>
            )}
            <div className="tag gray" style={{ marginTop: 8 }}>
              Tingkat bantuan {s.helpLevel}/5
            </div>
            <hr />
            <h3>Peta penalaran</h3>
            {Object.values(s.reasoningMap).every((a) => !a.length) ? (
              <p className="muted" style={{ fontSize: 11 }}>
                Klaim, bukti, dan asumsi dari dialogmu akan tersusun di sini.
              </p>
            ) : (
              Object.entries(s.reasoningMap).map(([key, values]) => (
                <div className="map-group" key={key}>
                  <h4>
                    {
                      {
                        claims: "Klaim",
                        evidence: "Bukti",
                        assumptions: "Asumsi",
                        counterpoints: "Kontraargumen",
                      }[key]
                    }
                  </h4>
                  {values.map((v, i) => (
                    <p key={i}>{v}</p>
                  ))}
                </div>
              ))
            )}
          </div>
          <div>
            <hr />
            <h3>Catatan pribadi</h3>
            <textarea
              aria-label="Catatan pribadi"
              value={noteTouched ? note : s.note}
              maxLength={6000}
              onChange={(e) => {
                setNoteTouched(true);
                setNote(e.target.value);
              }}
              placeholder="Satu hal yang ingin kamu ingat…"
            />
            <button
              className="text-btn"
              style={{ fontSize: 10, color: "#3157d5" }}
              onClick={saveNote}
            >
              Simpan catatan <Check size={12} />
            </button>
          </div>
        </aside>
      </div>
      {citation && (
        <Modal title={citation.title} onClose={() => setCitation(null)}>
          <span className="tag">
            Materi kelas
            {citation.page ? " · Halaman " + citation.page : " · Dokumen teks"}
          </span>
          <p className="source-quote" style={{ marginTop: 20 }}>
            {citation.quote}
          </p>
          <p className="analytics-note">
            Cuplikan ini berasal dari materi yang digunakan pada respons
            tersebut.
          </p>
        </Modal>
      )}
      {direct && (
        <Modal
          title="Minta penjelasan langsung?"
          onClose={() => setDirect(false)}
        >
          <p>
            AI akan mengikuti kebijakan <strong>{d.activity.policy}</strong>.
            Penjelasan diberikan setelah upaya awal yang diperlukan, lalu
            diikuti pemeriksaan pemahaman.
          </p>
          <div className="modal-actions">
            <button className="btn" onClick={() => setDirect(false)}>
              Kembali berpikir
            </button>
            <button
              className="btn primary"
              onClick={() => {
                setDirect(false);
                void send("", "REQUEST_DIRECT");
              }}
            >
              Minta penjelasan
            </button>
          </div>
        </Modal>
      )}
      {finish && (
        <Modal
          title="Sebelum mengakhiri sesi…"
          onClose={() => setFinish(false)}
        >
          <p className="muted" style={{ marginBottom: 18, fontSize: 12 }}>
            Catat perubahan pemahamanmu. Menutup sesi menyimpan refleksi; ini
            bukan penilaian bahwa seluruh konsep sudah dikuasai.
          </p>
          {d.activity.reflectionQuestions.map((q, i) => (
            <p key={i} style={{ fontSize: 12, marginBottom: 10 }}>
              {q}
            </p>
          ))}
          <label htmlFor="reflection">Refleksimu</label>
          <textarea
            id="reflection"
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            rows={5}
            maxLength={5000}
            placeholder="Awalnya aku berpikir… Sekarang aku memahami…"
          />
          {error && <div className="notice error">{error}</div>}
          <div className="modal-actions">
            <button className="btn" onClick={() => setFinish(false)}>
              Lanjut belajar
            </button>
            <button
              className="btn primary"
              disabled={reflection.trim().length < 5 || finishing}
              onClick={complete}
            >
              {finishing ? "Menyimpan…" : "Simpan refleksi"}
            </button>
          </div>
        </Modal>
      )}
      <Toast message={toast} />
    </>
  );
}
export function SummaryView({ id }: { id: string }) {
  const r = useResource<SessionDetail>("sessions/" + id),
    [error, setError] = useState(""),
    [deleting, setDeleting] = useState(false),
    [busy, setBusy] = useState(false),
    [source, setSource] = useState("");
  if (r.loading && !r.data) return <Loading />;
  if (r.error || !r.data)
    return (
      <div className="page-content">
        <ErrorBox message={r.error} retry={r.reload} />
      </div>
    );
  const d = r.data,
    summary = d.session.summary;
  if (!summary)
    return (
      <div className="page-content">
        <Empty title="Refleksi belum disimpan.">
          <Link className="btn primary" href={"/student/sessions/" + id}>
            Kembali ke dialog
          </Link>
        </Empty>
      </div>
    );
  function download() {
    if (!summary) return;
    const content = [
      "# Refleksi SOCRATIVA",
      d!.session.title,
      "\n## Pemahaman awal",
      summary.initialUnderstanding,
      "\n## Refleksi pribadi",
      summary.reflection,
      "\n## Gagasan yang dibahas",
      ...summary.concepts.map((x) => "- " + x),
      "\n## Konsep untuk ditinjau",
      ...summary.misconceptions.map((x) => "- " + x),
      "\n## Langkah berikutnya",
      ...summary.nextSteps.map((x) => "- " + x),
      "\n## Sumber",
      ...summary.sources.map((x) => "- " + x),
    ].join("\n");
    const url = URL.createObjectURL(
      new Blob([content], { type: "text/markdown;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "Refleksi-SOCRATIVA.md";
    a.click();
    URL.revokeObjectURL(url);
  }
  async function again() {
    setBusy(true);
    try {
      const s = await api<{ id: string }>("sessions", "POST", {
        activityId: d!.activity.id,
        mode: d!.session.mode,
      });
      navigate("/student/sessions/" + s.id);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <div className="page-content" style={{ maxWidth: 980 }}>
      <Link
        className="text-btn"
        style={{ fontSize: 11 }}
        href="/student/history"
      >
        <ChevronLeft size={14} />
        Riwayat belajar
      </Link>
      <header className="summary-header">
        <span className="ai-avatar">
          <NotebookPen size={24} />
        </span>
        <span
          className="eyebrow"
          style={{ justifyContent: "center", marginBottom: 15 }}
        >
          SATU SESI, PERSPEKTIF BARU
        </span>
        <h1>Berhenti sejenak. Lihat yang berubah.</h1>
        <p>{d.session.title}</p>
      </header>
      <div className="panel">
        <span className="eyebrow">REFLEKSI PRIBADIMU</span>
        <p
          className="prose-copy"
          style={{ fontSize: 16, lineHeight: 1.9, marginTop: 17 }}
        >
          {summary.reflection}
        </p>
      </div>
      <div className="summary-grid">
        <section className="panel">
          <h3>Pemahaman awal</h3>
          <p className="muted prose-copy" style={{ fontSize: 12 }}>
            {summary.initialUnderstanding}
          </p>
        </section>
        <section className="panel">
          <h3>Gagasan yang dibahas</h3>
          {summary.concepts.length ? (
            <ul>
              {summary.concepts.map((v, i) => (
                <li key={i}>{v}</li>
              ))}
            </ul>
          ) : (
            <p className="muted" style={{ fontSize: 12 }}>
              Belum ada gagasan yang dipetakan oleh AI.
            </p>
          )}
        </section>
        <section className="panel">
          <h3>Konsep untuk ditinjau</h3>
          {summary.misconceptions.length ? (
            <ul>
              {summary.misconceptions.map((v, i) => (
                <li key={i}>{v}</li>
              ))}
            </ul>
          ) : (
            <p className="muted" style={{ fontSize: 12 }}>
              Belum ada sinyal miskonsepsi tersimpan. Ini bukan konfirmasi
              penguasaan materi.
            </p>
          )}
        </section>
        <section className="panel">
          <h3>Langkah berikutnya</h3>
          <ul>
            {summary.nextSteps.map((v, i) => (
              <li key={i}>{v}</li>
            ))}
          </ul>
        </section>
      </div>
      <div className="panel" style={{ marginTop: 20 }}>
        <h3>Peta penalaran</h3>
        <div className="summary-grid">
          {Object.entries(summary.reasoningMap).map(([key, values]) => (
            <div className="map-group" key={key}>
              <h4>
                {
                  {
                    claims: "Klaim",
                    evidence: "Bukti",
                    assumptions: "Asumsi",
                    counterpoints: "Kontraargumen",
                  }[key]
                }
              </h4>
              {values.length ? (
                values.map((v, i) => <p key={i}>{v}</p>)
              ) : (
                <p>Belum ada.</p>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="panel" style={{ marginTop: 20 }}>
        <h3>Sumber yang digunakan</h3>
        {summary.sources.length ? (
          <ul>
            {summary.sources.map((v, i) => (
              <li key={i} style={{ fontSize: 12, marginTop: 12 }}>
                {v}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
            Tidak ada citation materi pada sesi ini.
          </p>
        )}
        <p className="analytics-note">
          Ringkasan dirangkai dari data percakapan dan refleksimu. Bukan
          diagnosis atau penilaian akademik.
        </p>
      </div>
      {error && <div className="notice error">{error}</div>}
      <div
        style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 24 }}
      >
        <button className="btn primary" disabled={busy} onClick={again}>
          Mulai sesi lanjutan <ArrowRight size={15} />
        </button>
        <button className="btn" onClick={download}>
          <Download size={15} />
          Unduh ringkasan
        </button>
        <Link className="btn" href={"/student/sessions/" + id}>
          Lihat dialog
        </Link>
        <button
          className="icon-btn"
          onClick={() => setDeleting(true)}
          aria-label="Hapus sesi"
        >
          <Trash2 size={16} />
        </button>
      </div>
      {deleting && (
        <Modal title="Hapus dari riwayat?" onClose={() => setDeleting(false)}>
          <p>
            Sesi akan dihapus dari riwayat dan analitik aktif. Data mengikuti
            kebijakan retensi institusi.
          </p>
          <div className="modal-actions">
            <button className="btn" onClick={() => setDeleting(false)}>
              Batal
            </button>
            <button
              className="btn danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api("sessions/" + id, "DELETE");
                  navigate("/student/history");
                } catch (e) {
                  setError((e as Error).message);
                  setDeleting(false);
                  setBusy(false);
                }
              }}
            >
              Hapus sesi
            </button>
          </div>
        </Modal>
      )}
      {source && <MaterialPreview id={source} onClose={() => setSource("")} />}
    </div>
  );
}
