"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { LoaderCircle, X } from "lucide-react";
import type * as schema from "../db/schema";
export type Course = typeof schema.courses.$inferSelect;
export type Activity = typeof schema.activities.$inferSelect;
export type Session = typeof schema.sessions.$inferSelect;
export type Message = {
  id: string;
  role: string;
  content: string;
  requestKey: string;
  phase: string | null;
  helpLevel: number | null;
  feedback: number | null;
  createdAt: string;
};
export type Citation = {
  id: string;
  messageId: string;
  chunkId: string;
  title: string;
  page: number | null;
  quote: string;
};
export type User = typeof schema.users.$inferSelect;
export type Material = {
  id: string;
  title: string;
  status: string;
  error: string | null;
  mimeType: string;
  fileSize: number;
  isDemo: boolean;
  visibility: string;
};
export type Dashboard = {
  user: User;
  courses: Course[];
  activities: Activity[];
  sessions: Session[];
  ai: { configured: boolean; embeddingConfigured: boolean };
};
export type CourseDetail = {
  course: Course;
  materials: Material[];
  activities: Activity[];
  members: { name: string; role: string }[];
};
export type SessionDetail = {
  session: Session;
  activity: Activity;
  course: Course;
  messages: Message[];
  citations: Citation[];
  ai: { configured: boolean };
};
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const r = await fetch("/api/" + path, {
    method,
    headers:
      body instanceof FormData
        ? undefined
        : body
          ? { "Content-Type": "application/json" }
          : undefined,
    body:
      body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  const result = (await r.json()) as T & { error?: string };
  if (!r.ok)
    throw new Error(result.error || "Permintaan belum berhasil. Coba lagi.");
  return result;
}
export function useResource<T>(path: string) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const reload = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true);
    try {
      const value = await api<T>(path);
      if (current === generation.current) {
        setData(value);
        setError("");
      }
    } catch (e) {
      if (current === generation.current)
        setError(e instanceof Error ? e.message : "Permintaan gagal.");
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    let active = true;
    const counter = generation;
    void Promise.resolve().then(() => {
      if (active) void reload();
    });
    return () => {
      active = false;
      counter.current++;
    };
  }, [reload]);
  return { data, error, loading, reload, setData };
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={20} /> Menyiapkan ruang belajarmu…
    </div>
  );
}
export function ErrorBox({
  message,
  retry,
}: {
  message: string;
  retry: () => void;
}) {
  return (
    <div className="notice error" role="alert">
      {message}
      <div>
        <button className="text-btn" onClick={retry}>
          Coba lagi
        </button>{" "}
        · <a href="/login">Buka akun demo</a>
      </div>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialog.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="native-dialog"
      onCancel={onClose}
      aria-label={title}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="icon-btn" onClick={onClose} aria-label="Tutup">
          <X size={19} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function date(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}
export function Toast({ message }: { message: string }) {
  return message ? (
    <div className="toast" role="status">
      {message}
    </div>
  ) : null;
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children}
    </div>
  );
}
