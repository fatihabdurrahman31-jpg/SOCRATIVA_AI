"use client";
import { NativeLink as Link } from "./native-link";
import { useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  BookOpen,
  ShieldCheck,
  MessageCircle,
  Lightbulb,
  Route,
  Sparkles,
  Check,
  GraduationCap,
} from "lucide-react";
export function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link className="brand" href={href}>
      <span className="brand-mark">
        <span />
        <span />
        <span />
      </span>
      <span>
        SOCRATIVA<span className="brand-dot">.</span>
      </span>
    </Link>
  );
}
export function Landing() {
  const [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  async function demo(role: string) {
    setBusy(role);
    setError("");
    try {
      const r = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const d = (await r.json()) as { error: string; redirect: string };
      if (!r.ok) throw new Error(d.error);
      window.location.href = d.redirect;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Belum dapat membuka demo.");
      setBusy("");
    }
  }
  return (
    <main className="landing">
      <nav className="landing-nav">
        <Brand />
        <div className="navlinks">
          <a href="#cara-kerja">Cara kerja</a>
          <a href="#ekosistem">Untuk kampus</a>
          <a href="#privasi">Privasi</a>
        </div>
        <button
          className="btn small"
          onClick={() => demo("LECTURER")}
          disabled={!!busy}
        >
          Ruang dosen <ArrowUpRight size={16} />
        </button>
      </nav>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <span className="blue-dot" /> RUANG BELAJAR, CARA BARU
          </span>
          <h1>
            Jawaban hanyalah
            <br />
            awal.
            <br />
            <span>Pemahaman</span>
            <br />
            yang berarti.
          </h1>
          <p>
            Temukan alasan di balik setiap jawaban. Belajar melalui dialog yang
            memandu, materi yang relevan, dan ruang untuk berpikir lebih dalam.
          </p>
          <div className="hero-actions">
            <button
              className="btn primary"
              onClick={() => demo("STUDENT")}
              disabled={!!busy}
            >
              {busy === "STUDENT"
                ? "Menyiapkan ruangmu…"
                : "Coba sebagai Mahasiswa"}
              <ArrowRight size={18} />
            </button>
            <button
              className="text-btn"
              onClick={() => demo("LECTURER")}
              disabled={!!busy}
            >
              Lihat Demo Dosen <ArrowUpRight size={17} />
            </button>
          </div>
          {error && (
            <div className="notice error" role="alert">
              {error}
              <a href="/signin-with-chatgpt?return_to=/" target="_top">
                Masuk dengan ChatGPT
              </a>
            </div>
          )}
          <div className="hero-notes">
            <span>
              <Check size={14} /> Ruang demo terisolasi
            </span>
            <span>
              <ShieldCheck size={14} /> Percakapan privat
            </span>
          </div>
        </div>
        <div
          className="hero-visual"
          aria-label="Ilustrasi percakapan; bukan respons AI langsung"
        >
          <div className="visual-top">
            <span className="mini-label">
              SEBUAH PERTANYAAN BISA MENGUBAH PERSPEKTIF.
            </span>
            <span className="orb">✳</span>
          </div>
          <div className="sample-dialog">
            <div className="dialog-head">
              <span className="ai-avatar">
                <Sparkles size={20} />
              </span>
              <div>
                <strong>Teman berpikirmu</strong>
                <small>Contoh alur · Belajar Socratic</small>
              </div>
              <span className="private-pill">
                <ShieldCheck size={12} /> Privat
              </span>
            </div>
            <div className="sample-user">
              “Kalau sudah berusaha keras, berarti sudah punya growth mindset?”
            </div>
            <div className="sample-ai">
              <span className="tiny-title">MARI KITA TELUSURI</span>
              <p>
                Bagaimana jika seseorang terus mengulang cara yang sama,
                meskipun belum berhasil?
              </p>
              <p className="muted">
                Menurutmu, apa yang perlu berubah selain besarnya usaha?
              </p>
            </div>
            <div className="sample-bottom">
              <span>
                <Lightbulb size={14} /> Telusuri alasan
              </span>
              <span>01 — 04</span>
            </div>
          </div>
          <div className="floating-note">
            <Route size={19} />
            <div>
              <strong>Dari “apa” menuju “mengapa”.</strong>
              <small>Bangun pemahamanmu sendiri.</small>
            </div>
          </div>
          <span className="visual-foot">DIALOG · ALASAN · REFLEKSI</span>
        </div>
      </section>
      <div className="principle-strip">
        <span>DIRANCANG UNTUK PROSES BELAJAR</span>
        <strong>
          <MessageCircle />
          Dialog yang adaptif
        </strong>
        <strong>
          <BookOpen />
          Berpijak pada materi
        </strong>
        <strong>
          <ShieldCheck />
          Privasi sejak awal
        </strong>
      </div>
      <section className="landing-section" id="cara-kerja">
        <div className="section-intro">
          <span className="eyebrow">BELAJAR YANG LEBIH BERMAKNA</span>
          <h2>
            Bukan sekadar tahu.
            <br />
            Sampai benar-benar paham.
          </h2>
          <p>
            Satu ruang untuk bertanya, menguji gagasan, dan menemukan hubungan
            yang sebelumnya belum terlihat.
          </p>
        </div>
        <div className="steps">
          <article>
            <span>01</span>
            <BookOpen />
            <h3>Mulai dari konteks.</h3>
            <p>
              Pilih kelas dan aktivitas. Tujuan belajar serta materi menjadi
              arah percakapanmu.
            </p>
          </article>
          <article>
            <span>02</span>
            <MessageCircle />
            <h3>Temukan alasanmu.</h3>
            <p>
              Jelaskan gagasan, temukan asumsi, dan uji argumen. Petunjuk
              tersedia saat kamu buntu.
            </p>
          </article>
          <article>
            <span>03</span>
            <Route />
            <h3>Bawa pemahaman baru.</h3>
            <p>
              Rangkai kesimpulan dan refleksi. Lihat kembali perjalanan
              penalaranmu kapan saja.
            </p>
          </article>
        </div>
      </section>
      <section className="ecosystem" id="ekosistem">
        <div>
          <span className="eyebrow">SATU EKOSISTEM AKADEMIK</span>
          <h2>
            Ruang untuk mahasiswa.
            <br />
            Wawasan untuk dosen.
          </h2>
          <p>
            Tujuan, sumber, dan kebijakan belajar tetap berada dalam konteks
            kelas.
          </p>
        </div>
        <div className="eco-cards">
          <article>
            <GraduationCap />
            <h3>Mahasiswa</h3>
            <p>
              Belajar dengan ritmemu. Simpan dialog, catatan, dan refleksi dalam
              ruang pribadi.
            </p>
          </article>
          <article>
            <BookOpen />
            <h3>Dosen & institusi</h3>
            <p>
              Kelola bahan ajar dan aktivitas. Amati kesulitan kelas melalui
              analitik agregat.
            </p>
          </article>
        </div>
      </section>
      <section className="privacy-band" id="privasi">
        <ShieldCheck size={30} />
        <div>
          <h3>Pemikiranmu layak mendapat ruang yang aman.</h3>
          <p>
            Transkrip privat secara default. Dosen melihat pola kelas, bukan
            percakapan pribadimu.
          </p>
        </div>
        <span>PRIVACY BY DEFAULT</span>
      </section>
      <footer>
        <Brand />
        <p>Ruang untuk bertanya. Keberanian untuk berpikir.</p>
        <span>SOCRATIVA · MVP 2026</span>
      </footer>
    </main>
  );
}
