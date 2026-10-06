"use client";
import { NativeLink as Link, navigate } from "./native-link";
import { useState } from "react";
import {
  LayoutDashboard,
  BookOpen,
  History,
  ShieldCheck,
  ArrowUpRight,
  ArrowRight,
  MessageCircle,
  GraduationCap,
  LogOut,
  Menu,
  Sparkles,
  ChevronRight,
  Plus,
  CheckCircle2,
  Clock3,
  BarChart3,
} from "lucide-react";
import { Brand } from "./landing";
import {
  api,
  useResource,
  Loading,
  ErrorBox,
  Empty,
  Modal,
  date,
  type Dashboard,
} from "./client";
import { CourseView } from "./course-view";
import { ChatView, SummaryView } from "./dialog";
import { phaseLabels } from "../lib/contracts";
export function Workbench({
  role,
  path,
}: {
  role: "student" | "lecturer";
  path: string[];
}) {
  const current = path[0] || "dashboard";
  const detailRoute =
    (current === "courses" && !!path[1]) ||
    (current === "sessions" && !!path[1]);
  const d = useResource<Dashboard>(detailRoute ? "me" : "dashboard");
  const [menu, setMenu] = useState(false),
    [newCourse, setNewCourse] = useState(false),
    [error, setError] = useState("");
  const isLecturer = role === "lecturer";
  const homeHref = "/" + role;
  const coursesHref = homeHref + "/courses";
  async function switchRole() {
    try {
      const r = await api<{ redirect: string }>("demo", "POST", {
        role: isLecturer ? "STUDENT" : "LECTURER",
      });
      window.location.href = r.redirect;
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function logout() {
    try {
      await api("logout", "POST");
      navigate("/");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const wrong =
    d.data &&
    ((isLecturer && d.data.user.role === "STUDENT") ||
      (!isLecturer && d.data.user.role !== "STUDENT"));
  return (
    <div className="app-shell">
      <aside className={"sidebar " + (menu ? "mobile-open" : "")}>
        <Brand href={homeHref} />
        <span className="workspace-label">
          RUANG {isLecturer ? "DOSEN" : "BELAJAR"}
        </span>
        <Link
          href={homeHref}
          className={"side-link " + (current === "dashboard" ? "active" : "")}
          onClick={() => setMenu(false)}
        >
          <LayoutDashboard size={16} />
          Beranda
        </Link>
        <Link
          href={coursesHref}
          className={"side-link " + (current === "courses" ? "active" : "")}
          onClick={() => setMenu(false)}
        >
          <BookOpen size={16} />
          Kelas saya
        </Link>
        {!isLecturer && (
          <Link
            href="/student/history"
            className={"side-link " + (current === "history" ? "active" : "")}
            onClick={() => setMenu(false)}
          >
            <History size={16} />
            Riwayat belajar
          </Link>
        )}
        <hr />
        <span className="workspace-label">DEMO SOCRATIVA</span>
        <button className="side-link" onClick={switchRole}>
          <GraduationCap size={16} />
          {isLecturer ? "Coba jadi mahasiswa" : "Lihat ruang dosen"}
          <ArrowUpRight size={13} />
        </button>
        <div className="side-bottom">
          <div className="campus-card">
            <small>EKOSISTEM PEMBELAJARAN</small>
            <p>
              Universitas Demo
              <br />
              SOCRATIVA
            </p>
            <span className="tag">Ruang demo terisolasi</span>
          </div>
          <div className="side-profile">
            <span className="avatar">{isLecturer ? "DS" : "MH"}</span>
            <div>
              <strong>{d.data?.user.name || "Akun demo"}</strong>
              <small>{isLecturer ? "Dosen" : "Mahasiswa"}</small>
            </div>
            <button className="icon-btn" aria-label="Keluar" onClick={logout}>
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>
      {menu && (
        <button
          className="sidebar-scrim"
          aria-label="Tutup navigasi"
          onClick={() => setMenu(false)}
        />
      )}
      <div className="app-main">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-btn mobile-menu"
              aria-label="Buka navigasi"
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              <Menu size={19} />
            </button>
            <Link href={homeHref}>
              Ruang {isLecturer ? "dosen" : "belajar"}
            </Link>
            <ChevronRight size={12} />
            <Link href={current === "dashboard" ? homeHref : coursesHref}>
              {current === "dashboard"
                ? "Beranda"
                : current === "courses"
                  ? "Kelas saya"
                  : current === "sessions"
                    ? "Dialog Socratic"
                    : "Riwayat"}
            </Link>
          </div>
          <div className="topbar-right">
            <span className="private-pill">
              <ShieldCheck size={13} />
              Privat secara default
            </span>
            <span className="tag gray">DEMO</span>
          </div>
        </header>
        {error && <div className="notice error">{error}</div>}
        {d.loading && !d.data ? (
          <Loading />
        ) : d.error ? (
          <div className="page-content">
            <ErrorBox message={d.error} retry={d.reload} />
          </div>
        ) : wrong ? (
          <div className="page-content">
            <Empty title="Pilih peran yang sesuai">
              <p>
                Halaman ini tersedia untuk {isLecturer ? "dosen" : "mahasiswa"}.
              </p>
              <button className="btn primary" onClick={switchRole}>
                Beralih ke demo {isLecturer ? "dosen" : "mahasiswa"}
              </button>
            </Empty>
          </div>
        ) : d.data ? (
          <>
            {current === "sessions" && path[1] ? (
              path[2] === "summary" ? (
                <SummaryView id={path[1]} />
              ) : (
                <ChatView key={path[1]} id={path[1]} />
              )
            ) : current === "courses" && path[1] ? (
              <CourseView
                id={path[1]}
                isLecturer={isLecturer}
                initialTab={path[2]}
              />
            ) : current === "history" ? (
              <HistoryView data={d.data} />
            ) : (
              <div className="page-content">
                <div className="page-heading">
                  <div>
                    <span className="eyebrow">
                      {isLecturer
                        ? "RUANG UNTUK MEMBIMBING"
                        : "SETIAP PERTANYAAN, SATU LANGKAH MAJU"}
                    </span>
                    <h1>
                      {current === "courses"
                        ? "Kelas saya"
                        : isLecturer
                          ? "Selamat datang, Dosen."
                          : "Selamat datang, pemikir."}
                    </h1>
                    <p>
                      {isLecturer
                        ? "Kelola pembelajaran dan pahami kebutuhan kelasmu."
                        : "Luangkan waktu untuk bertanya. Beri ruang untuk memahami."}
                    </p>
                  </div>
                  {isLecturer && (
                    <button
                      className="btn primary small"
                      onClick={() => setNewCourse(true)}
                    >
                      <Plus size={15} />
                      Buat kelas
                    </button>
                  )}
                </div>
                {current !== "courses" && (
                  <>
                    {!isLecturer && d.data.activities[0] && (
                      <StartCard
                        activity={d.data.activities[0]}
                        aiActive={d.data.ai.configured}
                      />
                    )}
                    <div className="stats-grid">
                      <Stat
                        label="Kelas aktif"
                        value={d.data.courses.length}
                        icon={<BookOpen size={15} />}
                        note="Di ruang demo ini"
                      />
                      <Stat
                        label="Aktivitas belajar"
                        value={d.data.activities.length}
                        icon={<Sparkles size={15} />}
                        note="Aktivitas yang dipublikasikan"
                      />
                      {!isLecturer ? (
                        <>
                          <Stat
                            label="Sesi belajar"
                            value={d.data.sessions.length}
                            icon={<MessageCircle size={15} />}
                            note="Tersimpan di riwayatmu"
                          />
                          <Stat
                            label="Refleksi selesai"
                            value={
                              d.data.sessions.filter(
                                (s) => s.status === "COMPLETED",
                              ).length
                            }
                            icon={<CheckCircle2 size={15} />}
                            note="Dari sesi yang kamu tutup"
                          />
                        </>
                      ) : (
                        <>
                          <Stat
                            label="Kebijakan default"
                            value="Guided"
                            icon={<ShieldCheck size={15} />}
                            note="Bantuan bertahap"
                          />
                          <Stat
                            label="Data analitik"
                            value="Per kelas"
                            icon={<BarChart3 size={15} />}
                            note="Buka kelas untuk melihat agregat"
                          />
                        </>
                      )}
                    </div>
                  </>
                )}
                <div className="section-heading">
                  <h2>
                    {isLecturer
                      ? "Kelas yang kamu kelola"
                      : "Kelas untuk dijelajahi"}
                  </h2>
                  <span className="muted" style={{ fontSize: 10 }}>
                    {d.data.courses.length} kelas aktif
                  </span>
                </div>
                <div className="course-grid">
                  {d.data.courses.map((c) => (
                    <Link
                      className="course-card course-card-link"
                      key={c.id}
                      href={coursesHref + "/" + c.id}
                      aria-label={`${isLecturer ? "Kelola" : "Buka"} kelas ${c.title}`}
                    >
                      <div className="course-icon">
                        <BookOpen size={22} />
                      </div>
                      <span className="eyebrow">{c.code}</span>
                      <h3>{c.title}</h3>
                      <p>{c.description}</p>
                      <div className="card-footer">
                        <span>{c.semester}</span>
                        <span className="card-action">
                          {isLecturer ? "Kelola kelas" : "Buka kelas"}
                          <ArrowRight size={13} />
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
                {!d.data.courses.length && (
                  <Empty title="Belum ada kelas">
                    {isLecturer
                      ? "Buat kelas pertamamu untuk mulai menyiapkan aktivitas."
                      : "Kelas akan muncul setelah kamu terdaftar."}
                  </Empty>
                )}
                {current !== "courses" && !isLecturer && (
                  <>
                    <div className="section-heading">
                      <h2>Jejak belajar terakhir</h2>
                      <Link href="/student/history">
                        Semua riwayat <ArrowUpRight size={12} />
                      </Link>
                    </div>
                    <div className="panel">
                      {d.data.sessions.slice(0, 3).map((s) => (
                        <Link
                          key={s.id}
                          href={
                            "/student/sessions/" +
                            s.id +
                            (s.status === "COMPLETED" ? "/summary" : "")
                          }
                          className="session-row"
                        >
                          <span className="ai-avatar">
                            <MessageCircle size={17} />
                          </span>
                          <div>
                            <strong>{s.title}</strong>
                            <small>
                              {date(s.updatedAt)} ·{" "}
                              {phaseLabels[s.phase] || s.phase}
                            </small>
                          </div>
                          <ChevronRight size={15} />
                        </Link>
                      ))}
                      {!d.data.sessions.length && (
                        <Empty title="Perjalananmu dimulai dari satu pertanyaan.">
                          Mulai aktivitas pertama. Dialog dan refleksimu akan
                          tersimpan di sini.
                        </Empty>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        ) : null}
      </div>
      {newCourse && (
        <Modal title="Buat ruang kelas" onClose={() => setNewCourse(false)}>
          <CourseForm
            onDone={(id) => {
              setNewCourse(false);
              void d.reload();
              navigate("/lecturer/courses/" + id);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
export function Stat({
  label,
  value,
  note,
  icon,
}: {
  label: string;
  value: string | number;
  note: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="stat">
      <small>
        {label}
        {icon}
      </small>
      <strong>{value}</strong>
      <p>{note}</p>
    </div>
  );
}
function StartCard({
  activity,
  aiActive,
}: {
  activity: Dashboard["activities"][number];
  aiActive: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function start() {
    setBusy(true);
    try {
      const s = await api<{ id: string }>("sessions", "POST", {
        activityId: activity.id,
      });
      navigate("/student/sessions/" + s.id);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <div className="start-card">
      <div>
        <span className="eyebrow">
          <Sparkles size={13} />
          AKTIVITAS PILIHAN · GROWTH MINDSET
        </span>
        <h2>
          Dua kegagalan yang sama.
          <br />
          Dua cara memaknainya.
        </h2>
        <p>{activity.title} Telusuri bersama melalui dialog Socratic.</p>
        <button className="btn primary small" onClick={start} disabled={busy}>
          {busy ? "Menyiapkan sesi…" : "Mulai sesi belajar"}
          <ArrowRight size={15} />
        </button>
        <span style={{ fontSize: 10, marginLeft: 14, color: "#6f7d9c" }}>
          Belajar dengan ritmemu
        </span>
        {!aiActive && (
          <p style={{ fontSize: 10, marginBottom: 0 }}>
            Ruang belajar tersedia · Respons AI menunggu aktivasi layanan model.
          </p>
        )}
        {error && <div className="notice error">{error}</div>}
      </div>
      <div className="start-decoration">
        <div className="thought-circle">
          <MessageCircle size={50} strokeWidth={1} />
        </div>
      </div>
    </div>
  );
}
function CourseForm({ onDone }: { onDone: (id: string) => void }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const form = new FormData(e.currentTarget);
        try {
          const c = await api<{ id: string }>(
            "courses",
            "POST",
            Object.fromEntries(form),
          );
          onDone(c.id);
        } catch (e) {
          setError((e as Error).message);
          setBusy(false);
        }
      }}
    >
      <div className="field">
        <label htmlFor="title">Nama mata kuliah</label>
        <input
          id="title"
          name="title"
          required
          minLength={3}
          maxLength={150}
          placeholder="Contoh: Psikologi Pendidikan"
        />
      </div>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="code">Kode kelas</label>
          <input
            id="code"
            name="code"
            required
            minLength={2}
            maxLength={30}
            placeholder="PSI 204"
          />
        </div>
        <div className="field">
          <label htmlFor="semester">Semester</label>
          <input
            id="semester"
            name="semester"
            required
            minLength={2}
            maxLength={100}
            placeholder="Ganjil 2026/2027"
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor="description">Deskripsi</label>
        <textarea
          id="description"
          name="description"
          required
          minLength={5}
          maxLength={2000}
          placeholder="Apa yang akan dipelajari mahasiswa?"
        />
      </div>
      <p className="muted" style={{ fontSize: 11 }}>
        Akun mahasiswa demo otomatis menjadi anggota kelas ini.
      </p>
      {error && <div className="notice error">{error}</div>}
      <div className="modal-actions">
        <button className="btn primary" disabled={busy}>
          {busy ? "Menyimpan…" : "Buat kelas"}
        </button>
      </div>
    </form>
  );
}
function HistoryView({ data }: { data: Dashboard }) {
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState("ALL");
  const filtered = data.sessions.filter(
    (s) =>
      s.title.toLowerCase().includes(query.toLowerCase()) &&
      (status === "ALL" || status === s.status),
  );
  return (
    <div className="page-content">
      <div className="page-heading">
        <div>
          <span className="eyebrow">JEJAK PEMAHAMANMU</span>
          <h1>Riwayat belajar</h1>
          <p>Temukan kembali percakapan, alasan, dan refleksimu.</p>
        </div>
      </div>
      <div className="search-row">
        <input
          aria-label="Cari sesi"
          placeholder="Cari topik atau judul sesi…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="Status sesi"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="ALL">Semua status</option>
          <option value="ACTIVE">Sedang berjalan</option>
          <option value="COMPLETED">Selesai</option>
        </select>
      </div>
      <div className="panel">
        {filtered.map((s) => (
          <Link
            key={s.id}
            href={
              "/student/sessions/" +
              s.id +
              (s.status === "COMPLETED" ? "/summary" : "")
            }
            className="session-row"
          >
            <span className="ai-avatar">
              <Clock3 size={17} />
            </span>
            <div>
              <strong>{s.title}</strong>
              <small>
                {date(s.updatedAt)} · {phaseLabels[s.phase]} ·{" "}
                {s.status === "COMPLETED" ? "Selesai" : "Sedang berjalan"}
              </small>
            </div>
            <ChevronRight size={16} />
          </Link>
        ))}
        {!filtered.length && (
          <Empty title="Belum ada sesi yang cocok.">
            <Link className="text-btn" href="/student">
              Mulai dari aktivitas kelas <ArrowRight size={14} />
            </Link>
          </Empty>
        )}
      </div>
    </div>
  );
}
