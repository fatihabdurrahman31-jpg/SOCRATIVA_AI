"use client";
import { NativeLink as Link, navigate } from "./native-link";
import { useState, useRef } from "react";
import {
  BookOpen,
  Plus,
  ArrowRight,
  Target,
  FileText,
  Upload,
  RefreshCw,
  Eye,
  Trash2,
  ShieldCheck,
  Users,
  BarChart3,
  CheckCircle2,
  ArrowLeft,
  LayoutDashboard,
} from "lucide-react";
import {
  api,
  useResource,
  Loading,
  ErrorBox,
  Empty,
  Modal,
  Toast,
  type CourseDetail,
  type Material,
} from "./client";
import { policies } from "../lib/contracts";
export function CourseView({
  id,
  isLecturer,
  initialTab,
}: {
  id: string;
  isLecturer: boolean;
  initialTab?: string;
}) {
  const r = useResource<CourseDetail>("courses/" + id),
    [tab, setTab] = useState(
      initialTab === "materials"
        ? "Materi"
        : initialTab === "analytics"
          ? "Analitik"
          : "Overview",
    ),
    [create, setCreate] = useState(false),
    [preview, setPreview] = useState(""),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState("");
  async function start(activityId: string, mode: string) {
    setBusy(activityId);
    try {
      const s = await api<{ id: string }>("sessions", "POST", {
        activityId,
        mode,
      });
      navigate("/student/sessions/" + s.id);
    } catch (e) {
      setError((e as Error).message);
      setBusy("");
    }
  }
  if (r.loading && !r.data) return <Loading />;
  if (r.error || !r.data)
    return (
      <div className="page-content">
        <ErrorBox message={r.error} retry={r.reload} />
      </div>
    );
  const d = r.data;
  const roleRoot = isLecturer ? "/lecturer" : "/student";
  return (
    <div className="page-content">
      <nav className="course-back-nav" aria-label="Navigasi kelas">
        <Link href={roleRoot + "/courses"}>
          <ArrowLeft size={15} /> Kembali ke kelas saya
        </Link>
        <Link href={roleRoot}>
          <LayoutDashboard size={15} /> Beranda
        </Link>
      </nav>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {d.course.code} · {d.course.semester}
          </span>
          <h1>{d.course.title}</h1>
          <p>{d.course.description}</p>
        </div>
        <span className="tag green">Kelas aktif</span>
      </div>
      <div className="tabs">
        {(isLecturer
          ? [
              "Overview",
              "Materi",
              "Aktivitas",
              "Analitik",
              "Kebijakan AI",
              "Anggota",
            ]
          : ["Overview", "Materi", "Aktivitas"]
        ).map((t) => (
          <button
            className={t === tab ? "active" : ""}
            key={t}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {error && <ErrorBox message={error} retry={() => setError("")} />}
      {tab === "Overview" && (
        <div className="two-col">
          <div>
            <div className="panel">
              <span className="eyebrow">
                <Target size={13} />
                TUJUAN PEMBELAJARAN
              </span>
              <h2 style={{ fontSize: 22, margin: "14px 0 20px" }}>
                Belajar memahami,
                <br />
                bukan hanya mengingat.
              </h2>
              {(
                d.activities[0]?.objectives || [
                  "Tambahkan aktivitas untuk menetapkan tujuan pembelajaran.",
                ]
              ).map((o, i) => (
                <div key={i} className="objective">
                  <CheckCircle2 size={15} />
                  <span>{o}</span>
                </div>
              ))}
            </div>
            <div className="section-heading">
              <h2>Aktivitas belajar</h2>
              <button
                className="text-btn"
                onClick={() => setTab("Aktivitas")}
                style={{ fontSize: 11 }}
              >
                Lihat semua <ArrowRight size={13} />
              </button>
            </div>
            {d.activities.slice(0, 2).map((a) => (
              <article
                className="panel"
                key={a.id}
                style={{ marginBottom: 15 }}
              >
                <span className="tag">{a.policy}</span>
                <h3 style={{ fontSize: 17, margin: "15px 0" }}>{a.title}</h3>
                <p className="muted" style={{ fontSize: 12, marginBottom: 19 }}>
                  {a.scenario}
                </p>
                {!isLecturer ? (
                  <button
                    className="btn primary small"
                    onClick={() => start(a.id, a.mode)}
                    disabled={!!busy}
                  >
                    Mulai dialog <ArrowRight size={14} />
                  </button>
                ) : (
                  <span className="tag gray">
                    {a.status === "PUBLISHED"
                      ? "Dipublikasikan"
                      : a.status === "CLOSED"
                        ? "Ditutup"
                        : "Draft"}
                  </span>
                )}
              </article>
            ))}
            {!d.activities.length && (
              <Empty title="Belum ada aktivitas">
                {isLecturer ? (
                  <button className="btn small" onClick={() => setCreate(true)}>
                    Buat aktivitas pertama
                  </button>
                ) : (
                  "Aktivitas akan tersedia setelah dosen menerbitkannya."
                )}
              </Empty>
            )}
          </div>
          <aside>
            <div className="panel">
              <BookOpen size={21} color="#3157d5" />
              <h3 style={{ fontSize: 16, margin: "16px 0" }}>Materi kelas</h3>
              {d.materials
                .filter((m) => m.status === "READY")
                .map((m) => (
                  <button
                    className="material-row"
                    style={{ width: "100%", textAlign: "left" }}
                    key={m.id}
                    onClick={() => setPreview(m.id)}
                  >
                    <FileText size={17} />
                    <div>
                      <strong>{m.title}</strong>
                      <p>{m.isDemo ? "Materi demonstrasi" : "Bahan ajar"}</p>
                    </div>
                    <Eye size={14} />
                  </button>
                ))}
              {!d.materials.length && (
                <p className="muted" style={{ fontSize: 12 }}>
                  Materi belum tersedia.
                </p>
              )}
            </div>
            <div className="notice">
              <ShieldCheck size={19} />
              <strong style={{ display: "block", margin: "8px 0" }}>
                Ruang berpikir yang privat.
              </strong>
              Transkrip mahasiswa tidak dibuka kepada dosen. Analitik
              menampilkan pola agregat ketika jumlah peserta mencukupi.
            </div>
          </aside>
        </div>
      )}
      {tab === "Materi" && (
        <>
          <div className="section-heading">
            <h2>Perpustakaan kelas</h2>
            <span className="muted" style={{ fontSize: 11 }}>
              {d.materials.length} dokumen
            </span>
          </div>
          {isLecturer && (
            <UploadBox
              courseId={id}
              onDone={() => {
                void r.reload();
                setNotice(
                  "Materi tersimpan. Periksa status pemrosesan di daftar.",
                );
                setTimeout(() => setNotice(""), 4000);
              }}
            />
          )}
          <div className="panel" style={{ marginTop: 20 }}>
            {d.materials.map((m) => (
              <MaterialRow
                key={m.id}
                material={m}
                isLecturer={isLecturer}
                onPreview={() => setPreview(m.id)}
                onDone={r.reload}
              />
            ))}
            {!d.materials.length && (
              <Empty title="Belum ada materi kelas.">
                {isLecturer
                  ? "Unggah PDF atau TXT untuk membuat sumber belajar."
                  : "Materi akan tampil setelah dipublikasikan."}
              </Empty>
            )}
          </div>
        </>
      )}
      {tab === "Aktivitas" && (
        <>
          <div className="section-heading">
            <h2>Rangkaian aktivitas</h2>
            {isLecturer && (
              <button
                className="btn primary small"
                onClick={() => setCreate(true)}
              >
                <Plus size={14} />
                Buat aktivitas
              </button>
            )}
          </div>
          {d.activities.map((a) => (
            <article className="panel" key={a.id} style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span className="tag">{a.policy}</span>
                <span className="tag gray">
                  {a.mode === "ARGUMENT_REVIEW"
                    ? "Bedah argumen"
                    : "Belajar Socratic"}
                </span>
                <span className="tag gray">
                  {a.status === "PUBLISHED"
                    ? "Dipublikasikan"
                    : a.status === "CLOSED"
                      ? "Ditutup"
                      : "Draft"}
                </span>
              </div>
              <h3 style={{ fontSize: 20, margin: "16px 0 12px" }}>{a.title}</h3>
              <p className="muted" style={{ fontSize: 12, marginBottom: 15 }}>
                {a.scenario}
              </p>
              {a.objectives.map((o, i) => (
                <div className="objective" key={i}>
                  <Target size={13} />
                  {o}
                </div>
              ))}
              {!isLecturer ? (
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                    marginTop: 20,
                  }}
                >
                  <button
                    className="btn primary small"
                    disabled={!!busy}
                    onClick={() => start(a.id, "SOCRATIC_LEARNING")}
                  >
                    Belajar Socratic <ArrowRight size={13} />
                  </button>
                  <button
                    className="btn small"
                    disabled={!!busy}
                    onClick={() => start(a.id, "ARGUMENT_REVIEW")}
                  >
                    Bedah argumen
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 10, marginTop: 15 }}>
                  <button
                    className="btn small"
                    onClick={async () => {
                      try {
                        await api("activities/" + a.id, "PATCH", {
                          status:
                            a.status === "PUBLISHED" ? "CLOSED" : "PUBLISHED",
                        });
                        void r.reload();
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    {a.status === "PUBLISHED"
                      ? "Tutup aktivitas"
                      : "Publikasikan"}
                  </button>
                </div>
              )}
            </article>
          ))}
          {!d.activities.length && (
            <Empty title="Belum ada aktivitas.">
              Susun sebuah kasus untuk memulai dialog bermakna.
            </Empty>
          )}
        </>
      )}
      {tab === "Analitik" && isLecturer && (
        <AnalyticsView courseId={id} activities={d.activities} />
      )}
      {tab === "Kebijakan AI" && isLecturer && (
        <PolicyForm courseId={id} initial={d.course.policy} onDone={r.reload} />
      )}
      {tab === "Anggota" && isLecturer && (
        <div className="panel">
          <span className="eyebrow">
            <Users size={15} />
            ANGGOTA RUANG DEMO
          </span>
          {d.members.map((m, i) => (
            <div className="session-row" key={i}>
              <span className="avatar">
                {m.role === "STUDENT" ? "MH" : "DS"}
              </span>
              <div>
                <strong>{m.name}</strong>
                <small>{m.role === "STUDENT" ? "Mahasiswa" : "Dosen"}</small>
              </div>
            </div>
          ))}
          <p className="analytics-note">
            Keanggotaan di versi demo dibuat otomatis dan terisolasi per ruang.
          </p>
        </div>
      )}
      {create && (
        <Modal
          title="Rancang aktivitas belajar"
          onClose={() => setCreate(false)}
        >
          <ActivityForm
            course={d}
            onDone={() => {
              setCreate(false);
              setTab("Aktivitas");
              void r.reload();
            }}
          />
        </Modal>
      )}
      {preview && (
        <MaterialPreview id={preview} onClose={() => setPreview("")} />
      )}
      <Toast message={notice} />
    </div>
  );
}
function UploadBox({
  courseId,
  onDone,
}: {
  courseId: string;
  onDone: () => void;
}) {
  const input = useRef<HTMLInputElement>(null),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState(""),
    [error, setError] = useState("");
  async function upload(file: File) {
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      setStatus("Mengunggah materi…");
      const r = await api<{ id: string }>(
        "courses/" + courseId + "/materials",
        "POST",
        form,
      );
      setStatus("Mengekstrak teks dan membuat indeks…");
      const p = await api<{ status: string; error?: string }>(
        "materials/" + r.id + "/process",
        "POST",
      );
      if (p.status === "FAILED")
        setError(p.error || "Materi belum dapat diproses.");
      onDone();
    } catch (e) {
      setError((e as Error).message);
      onDone();
    } finally {
      setBusy(false);
      setStatus("");
      if (input.current) input.current.value = "";
    }
  }
  return (
    <div className="upload-box">
      <Upload size={25} />
      <h3>Tambahkan bahan ajar</h3>
      <p>PDF berbasis teks atau TXT · Maksimal 5 MB dan 60 halaman</p>
      <input
        type="file"
        ref={input}
        accept=".pdf,.txt"
        hidden
        aria-label="Pilih materi"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
        }}
      />
      <button
        className="btn small"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        {busy ? status : "Pilih dokumen"}
      </button>
      <p style={{ marginTop: 12, marginBottom: 0, fontSize: 10 }}>
        Dokumen baru bersifat privat. Tinjau hasil ekstraksi sebelum
        dipublikasikan.
      </p>
      {error && (
        <div className="notice warn" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
function MaterialRow({
  material: m,
  isLecturer,
  onPreview,
  onDone,
}: {
  material: Material;
  isLecturer: boolean;
  onPreview: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirm, setConfirm] = useState(false);
  async function mutate(action: string) {
    setBusy(true);
    setError("");
    try {
      if (action === "process")
        await api("materials/" + m.id + "/process", "POST");
      else if (action === "disable") await api("materials/" + m.id, "DELETE");
      else
        await api("materials/" + m.id, "PATCH", {
          visibility: m.visibility === "COURSE" ? "PRIVATE" : "COURSE",
        });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  }
  return (
    <div>
      <div className="material-row">
        <FileText size={21} />
        <div>
          <strong>{m.title}</strong>
          <p>
            {m.isDemo
              ? "Contoh teks demonstrasi"
              : Math.ceil(m.fileSize / 1024) + " KB"}{" "}
            · {m.visibility === "COURSE" ? "Terlihat oleh kelas" : "Privat"}
          </p>
          {m.error && <p style={{ color: "#a46325" }}>{m.error}</p>}
        </div>
        <span
          className={
            "tag " +
            (m.status === "READY"
              ? "green"
              : m.status === "FAILED"
                ? "amber"
                : "gray")
          }
        >
          {m.status === "READY"
            ? "Siap"
            : m.status === "FAILED"
              ? "Gagal"
              : m.status === "DISABLED"
                ? "Nonaktif"
                : "Diproses"}
        </span>
        <button
          className="icon-btn"
          title="Pratinjau materi"
          aria-label={"Pratinjau " + m.title}
          onClick={onPreview}
        >
          <Eye size={16} />
        </button>
        {isLecturer && m.status !== "DISABLED" && (
          <>
            {!m.isDemo && m.status !== "READY" && (
              <button
                className="icon-btn"
                aria-label="Proses ulang"
                disabled={busy}
                onClick={() => mutate("process")}
              >
                <RefreshCw size={15} />
              </button>
            )}
            {m.status === "READY" && (
              <button
                className="btn small"
                disabled={busy}
                onClick={() => mutate("publish")}
              >
                {m.visibility === "COURSE" ? "Jadikan privat" : "Publikasikan"}
              </button>
            )}
            <button
              className="icon-btn"
              aria-label="Nonaktifkan materi"
              disabled={busy}
              onClick={() => setConfirm(true)}
            >
              <Trash2 size={15} />
            </button>
          </>
        )}
      </div>
      {error && <div className="notice error">{error}</div>}
      {confirm && (
        <Modal title="Nonaktifkan materi?" onClose={() => setConfirm(false)}>
          <p>
            Materi tidak lagi digunakan untuk respons baru. Riwayat sumber yang
            sudah digunakan tetap disimpan.
          </p>
          <div className="modal-actions">
            <button className="btn" onClick={() => setConfirm(false)}>
              Batal
            </button>
            <button
              className="btn danger"
              disabled={busy}
              onClick={() => mutate("disable")}
            >
              Nonaktifkan
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
export function MaterialPreview({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const r = useResource<{
    material: { title: string; isDemo: boolean; status: string };
    chunks: { id: string; content: string; page: number | null }[];
  }>("materials/" + id);
  return (
    <Modal title={r.data?.material.title || "Materi kelas"} onClose={onClose}>
      {r.loading ? (
        <Loading />
      ) : r.error ? (
        <ErrorBox message={r.error} retry={r.reload} />
      ) : r.data ? (
        <>
          <span className="tag">Materi kelas</span>
          {r.data.material.isDemo && (
            <div className="notice">
              Bahan ajar demonstrasi SOCRATIVA. Bukan kutipan langsung atau
              artikel penelitian.
            </div>
          )}
          {r.data.chunks.map((c) => (
            <div key={c.id} style={{ marginTop: 20 }}>
              <small className="muted">
                {c.page
                  ? "Halaman " + c.page
                  : "Dokumen teks · tanpa nomor halaman"}
              </small>
              <p className="source-quote">{c.content}</p>
            </div>
          ))}
          {!r.data.chunks.length && (
            <Empty title="Teks belum tersedia.">
              Tunggu pemrosesan atau coba proses ulang dokumen.
            </Empty>
          )}
        </>
      ) : null}
    </Modal>
  );
}
function ActivityForm({
  course,
  onDone,
}: {
  course: CourseDetail;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const f = new FormData(e.currentTarget);
        try {
          await api("courses/" + course.course.id + "/activities", "POST", {
            title: f.get("title"),
            scenario: f.get("scenario"),
            objectives: String(f.get("objectives"))
              .split("\n")
              .filter((x) => x.trim()),
            mode: f.get("mode"),
            difficulty: f.get("difficulty"),
            policy: f.get("policy"),
            minPhases: Number(f.get("minPhases")),
            reflectionQuestions: String(f.get("reflection"))
              .split("\n")
              .filter(Boolean),
            status: f.get("status"),
            materialIds: f.getAll("materialIds"),
          });
          onDone();
        } catch (e) {
          setError((e as Error).message);
          setBusy(false);
        }
      }}
    >
      <div className="field">
        <label htmlFor="a-title">Judul aktivitas</label>
        <input
          id="a-title"
          name="title"
          required
          minLength={5}
          maxLength={200}
        />
      </div>
      <div className="field">
        <label htmlFor="scenario">Konteks atau kasus</label>
        <textarea
          id="scenario"
          name="scenario"
          rows={4}
          required
          minLength={20}
          maxLength={8000}
        />
      </div>
      <div className="field">
        <label htmlFor="objectives">Tujuan pembelajaran</label>
        <textarea
          id="objectives"
          name="objectives"
          required
          placeholder="Satu tujuan per baris"
        />
      </div>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="mode">Mode dialog</label>
          <select id="mode" name="mode">
            <option value="SOCRATIC_LEARNING">Belajar Socratic</option>
            <option value="ARGUMENT_REVIEW">Bedah argumen</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="difficulty">Tingkat kesulitan</label>
          <select id="difficulty" name="difficulty">
            <option value="BASIC">Dasar</option>
            <option value="INTERMEDIATE">Menengah</option>
            <option value="ADVANCED">Lanjut</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="policy">Kebijakan AI</label>
          <select id="policy" name="policy" defaultValue={course.course.policy}>
            {policies.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="minPhases">Minimum fase</label>
          <input
            id="minPhases"
            type="number"
            name="minPhases"
            defaultValue={3}
            min={3}
            max={8}
          />
        </div>
      </div>
      <div className="field">
        <label>Materi sumber</label>
        {course.materials
          .filter((m) => m.status === "READY" && m.visibility === "COURSE")
          .map((m) => (
            <label className="checkbox" key={m.id}>
              <input type="checkbox" name="materialIds" value={m.id} />
              {m.title}
            </label>
          ))}
        {!course.materials.some(
          (m) => m.status === "READY" && m.visibility === "COURSE",
        ) && (
          <small>
            Belum ada materi terpublikasi. Aktivitas tanpa materi akan memakai
            pengetahuan umum AI.
          </small>
        )}
      </div>
      <div className="field">
        <label htmlFor="reflection">Pertanyaan refleksi</label>
        <textarea
          id="reflection"
          name="reflection"
          defaultValue="Apa yang berubah dari pemahaman awalmu?"
        />
      </div>
      <div className="field">
        <label htmlFor="status">Status</label>
        <select id="status" name="status">
          <option value="DRAFT">Simpan draft</option>
          <option value="PUBLISHED">Publikasikan</option>
        </select>
      </div>
      {error && <div className="notice error">{error}</div>}
      <div className="modal-actions">
        <button className="btn primary" disabled={busy}>
          {busy ? "Menyimpan…" : "Simpan aktivitas"}
        </button>
      </div>
    </form>
  );
}
function PolicyForm({
  courseId,
  initial,
  onDone,
}: {
  courseId: string;
  initial: string;
  onDone: () => void;
}) {
  const [selected, setSelected] = useState(initial),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const descriptions = [
    "Pertanyaan dan petunjuk lebih dahulu; penjelasan langsung setelah satu upaya.",
    "Jawaban penuh setelah dua upaya atau kebuntuan berulang.",
    "Penjelasan langsung tersedia, diikuti pemeriksaan pemahaman.",
    "Membantu dekomposisi tugas, rubrik, dan feedback tanpa jawaban siap dikumpulkan.",
  ];
  return (
    <div className="panel">
      <h2 style={{ fontSize: 20, marginBottom: 12 }}>
        Atur cara AI membimbing.
      </h2>
      <p className="muted" style={{ fontSize: 12, marginBottom: 25 }}>
        Kebijakan ini menjadi default untuk aktivitas baru. Kebijakan aktivitas
        yang sudah berjalan tetap mengikuti pengaturannya sendiri.
      </p>
      {policies.map((p, i) => (
        <label className="policy-option" key={p}>
          <input
            type="radio"
            name="preset"
            checked={p === selected}
            onChange={() => setSelected(p)}
          />
          <span>
            <strong>{p}</strong>
            <small>{descriptions[i]}</small>
          </span>
        </label>
      ))}
      {notice && (
        <div className="notice" role="status">
          {notice}
        </div>
      )}
      <button
        className="btn primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await api("courses/" + courseId + "/policy", "PATCH", {
              policy: selected,
            });
            setNotice("Kebijakan default tersimpan.");
            onDone();
          } catch (e) {
            setNotice((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        Simpan kebijakan
      </button>
    </div>
  );
}
type Analytics = {
  active: number;
  total: number;
  complete: number;
  completionRate: number;
  suppressed: boolean;
  threshold: number;
  medianTurns: number | null;
  citationCoverage: number | null;
  usefulness: number | null;
  helpLevels: { level: number; count: number }[];
  concepts: { concept: string; count: number }[];
};
function AnalyticsView({
  courseId,
  activities,
}: {
  courseId: string;
  activities: CourseDetail["activities"];
}) {
  const [filter, setFilter] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const params = new URLSearchParams();
  if (filter) params.set("activityId", filter);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const r = useResource<Analytics>(
    "courses/" + courseId + "/analytics?" + params,
  );
  return (
    <>
      <div className="section-heading">
        <h2>Memahami proses belajar kelas</h2>
        <span className="tag gray">Data simulasi untuk demonstrasi</span>
      </div>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="filter-activity">Aktivitas</label>
          <select
            id="filter-activity"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">Semua aktivitas</option>
            {activities.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </select>
        </div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="from">Dari tanggal</label>
            <input
              id="from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="to">Sampai tanggal</label>
            <input
              id="to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </div>
      </div>
      {r.loading ? (
        <Loading />
      ) : r.error ? (
        <ErrorBox message={r.error} retry={r.reload} />
      ) : r.data ? (
        <>
          <div className="stats-grid">
            {[
              ["Mahasiswa aktif", r.data.active],
              ["Jumlah sesi", r.data.total],
              ["Penyelesaian", r.data.completionRate + "%"],
              ["Median giliran", r.data.medianTurns ?? "—"],
            ].map(([label, value]) => (
              <div className="stat" key={label}>
                <small>
                  {label}
                  <BarChart3 size={15} />
                </small>
                <strong>{value}</strong>
                <p>Dihitung dari data ruang ini</p>
              </div>
            ))}
          </div>
          {r.data.suppressed ? (
            <div className="panel">
              <ShieldCheck size={28} color="#3157d5" />
              <h3 style={{ fontSize: 18, margin: "17px 0 10px" }}>
                Privasi didahulukan.
              </h3>
              <p className="muted">
                Rincian konsep, miskonsepsi, dan bantuan ditampilkan setelah
                setidaknya {r.data.threshold} mahasiswa aktif dalam kelompok
                yang dipilih. Saat ini ada {r.data.active} mahasiswa aktif.
              </p>
              <p className="analytics-note">
                Tidak ada transkrip pribadi yang ditampilkan kepada dosen.
              </p>
            </div>
          ) : (
            <div className="two-col">
              <div className="panel">
                <h3>Konsep yang perlu ditinjau</h3>
                {r.data.concepts.map((c) => (
                  <div className="bar-row" key={c.concept}>
                    <span>{c.concept}</span>
                    <div className="bar-track">
                      <span
                        style={{
                          width:
                            Math.min(
                              100,
                              (c.count /
                                Math.max(
                                  ...r.data!.concepts.map((v) => v.count),
                                )) *
                                100,
                            ) + "%",
                        }}
                      />
                    </div>
                    <span>{c.count}</span>
                  </div>
                ))}
                {!r.data.concepts.length && (
                  <Empty title="Belum ada sinyal miskonsepsi." />
                )}
              </div>
              <div className="panel">
                <h3>Distribusi bantuan terakhir</h3>
                {r.data.helpLevels.map((h) => (
                  <div className="bar-row" key={h.level}>
                    <span>Level {h.level}</span>
                    <div className="bar-track">
                      <span
                        style={{
                          width:
                            Math.round(
                              (h.count / Math.max(1, r.data!.total)) * 100,
                            ) + "%",
                        }}
                      />
                    </div>
                    <span>{h.count}</span>
                  </div>
                ))}
                <p className="analytics-note">
                  Respons bersumber: {r.data.citationCoverage}% · Feedback
                  berguna:{" "}
                  {r.data.usefulness === null
                    ? "Belum ada"
                    : r.data.usefulness + "%"}
                </p>
              </div>
            </div>
          )}
          <p className="analytics-note">
            Angka berasal dari aktivitas demo yang tersimpan, bukan hasil
            penelitian atau penilaian kecerdasan.
          </p>
        </>
      ) : null}
    </>
  );
}
