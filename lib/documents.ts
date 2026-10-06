import { env } from "cloudflare:workers";
import { and, eq, asc, lt } from "drizzle-orm";
import { getDb } from "../db";
import * as t from "../db/schema";
import {
  ApiError,
  uid,
  now,
  courseAccess,
  rateLimit,
  type Actor,
} from "./security";
import { chunkText } from "./pedagogy";
import { embed } from "./ai";
const maxBytes = 5 * 1024 * 1024;
export async function uploadMaterial(
  user: Actor,
  courseId: string,
  req: Request,
) {
  await courseAccess(user, courseId, true);
  await rateLimit("upload:" + user.id, 10, 3600);
  if (Number(req.headers.get("content-length") || 0) > maxBytes + 20000)
    throw new ApiError(413, "Batas ukuran file 5 MB.");
  const form = await req.formData(),
    file = form.get("file");
  if (!(file instanceof File) || !file.size || file.size > maxBytes)
    throw new ApiError(400, "Pilih PDF atau TXT berukuran maksimal 5 MB.");
  const ext = file.name.split(".").pop()?.toLowerCase();
  const type =
    ext === "pdf" ? "application/pdf" : ext === "txt" ? "text/plain" : null;
  if (!type || (file.type && file.type !== type))
    throw new ApiError(400, "Format yang didukung: PDF dan TXT.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (
    type === "application/pdf" &&
    new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-"
  )
    throw new ApiError(400, "File bukan PDF valid.");
  if (type === "text/plain" && bytes.some((v) => v === 0))
    throw new ApiError(400, "File teks mengandung data biner.");
  if (!env.BUCKET)
    throw new ApiError(503, "Penyimpanan berkas belum tersedia.");
  const id = uid(),
    key = `${user.institutionId}/${courseId}/${id}`,
    db = getDb();
  await db.insert(t.materials).values({
    id,
    institutionId: user.institutionId,
    courseId,
    uploadedBy: user.id,
    title:
      file.name.replace(/[^\p{L}\p{N} ._()-]/gu, "").slice(0, 180) ||
      "Materi kelas",
    objectKey: key,
    mimeType: type,
    fileSize: file.size,
    status: "UPLOADING",
    visibility: "PRIVATE",
    createdAt: now(),
  });
  try {
    await env.BUCKET.put(key, bytes, { httpMetadata: { contentType: type } });
    await db
      .update(t.materials)
      .set({ status: "PROCESSING" })
      .where(eq(t.materials.id, id));
    await db.insert(t.auditLogs).values({
      id: uid(),
      institutionId: user.institutionId,
      actorUserId: user.id,
      action: "MATERIAL_UPLOADED",
      targetId: id,
      createdAt: now(),
    });
    return { id, status: "PROCESSING" };
  } catch {
    await db
      .update(t.materials)
      .set({
        status: "FAILED",
        error: "Unggah belum berhasil. Silakan unggah ulang.",
      })
      .where(eq(t.materials.id, id));
    throw new ApiError(502, "Unggah belum berhasil.");
  }
}
export async function materialDetail(user: Actor, id: string) {
  const db = getDb();
  const [material] = await db
    .select()
    .from(t.materials)
    .where(
      and(
        eq(t.materials.id, id),
        eq(t.materials.institutionId, user.institutionId),
      ),
    );
  if (!material) throw new ApiError(404, "Materi tidak ditemukan.");
  await courseAccess(user, material.courseId);
  if (
    user.role === "STUDENT" &&
    (material.status !== "READY" || material.visibility !== "COURSE")
  )
    throw new ApiError(404, "Materi tidak ditemukan.");
  const chunks = await db
    .select({
      id: t.materialChunks.id,
      content: t.materialChunks.content,
      page: t.materialChunks.page,
    })
    .from(t.materialChunks)
    .where(
      and(
        eq(t.materialChunks.materialId, id),
        eq(t.materialChunks.institutionId, user.institutionId),
      ),
    )
    .orderBy(asc(t.materialChunks.chunkIndex))
    .limit(100);
  return {
    material: {
      id: material.id,
      title: material.title,
      status: material.status,
      error: material.error,
      isDemo: material.isDemo,
      visibility: material.visibility,
    },
    chunks,
  };
}
export async function processMaterial(
  user: Actor,
  material: typeof t.materials.$inferSelect,
) {
  await courseAccess(user, material.courseId, true);
  if (material.status === "DISABLED")
    throw new ApiError(409, "Materi telah dinonaktifkan.");
  if (material.status === "READY") return { id: material.id, status: "READY" };
  if (!material.objectKey)
    throw new ApiError(400, "Materi demo tersedia sebagai contoh teks.");
  await rateLimit("process:" + user.id, 12, 3600);
  const db = getDb();
  const lease = Date.now(),
    leaseId = "document-lock:" + material.id;
  const acquired = await db
    .insert(t.rateLimits)
    .values({ id: leaseId, count: 1, windowStart: lease })
    .onConflictDoUpdate({
      target: t.rateLimits.id,
      set: { windowStart: lease },
      setWhere: lt(t.rateLimits.windowStart, lease - 180000),
    })
    .returning();
  if (!acquired.length)
    throw new ApiError(409, "Materi sedang diproses. Tunggu sebentar.");
  await db
    .update(t.materials)
    .set({ status: "PROCESSING", error: null })
    .where(eq(t.materials.id, material.id));
  try {
    const object = await env.BUCKET?.get(material.objectKey);
    if (!object)
      throw new ApiError(404, "File sumber tidak ditemukan. Unggah kembali.");
    const bytes = new Uint8Array(await object.arrayBuffer());
    let pages: { page: number | null; text: string }[] = [];
    if (material.mimeType === "text/plain")
      pages = [
        {
          page: null,
          text: new TextDecoder("utf-8", { fatal: true }).decode(bytes),
        },
      ];
    else {
      const { getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(bytes, {
        isEvalSupported: false,
        useSystemFonts: true,
        maxImageSize: 0,
      });
      try {
        if (pdf.numPages > 60)
          throw new ApiError(400, "Maksimal 60 halaman per dokumen demo.");
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const text = await page.getTextContent();
          pages.push({
            page: i,
            text: text.items
              .map((item) => ("str" in item ? item.str : ""))
              .join(" "),
          });
          page.cleanup();
        }
      } finally {
        await pdf.destroy();
      }
    }
    if (pages.reduce((n, p) => n + p.text.length, 0) > 200000)
      throw new ApiError(
        400,
        "Teks terlalu panjang. Pisahkan menjadi beberapa berkas.",
      );
    const chunks = pages.flatMap((p) =>
      chunkText(p.text).map((content) => ({ page: p.page, content })),
    );
    if (!chunks.length)
      throw new ApiError(
        400,
        "Tidak ada teks yang terbaca. PDF hasil scan membutuhkan OCR; unggah versi teks.",
      );
    if (chunks.length > 90)
      throw new ApiError(400, "Materi terlalu panjang untuk demo.");
    // Preserve extraction preview even when the embedding service is not configured.
    await db.batch([
      db
        .delete(t.materialChunks)
        .where(eq(t.materialChunks.materialId, material.id)),
      ...chunks.map((c, i) =>
        db.insert(t.materialChunks).values({
          id: uid(),
          materialId: material.id,
          institutionId: user.institutionId,
          courseId: material.courseId,
          chunkIndex: i,
          page: c.page,
          content: c.content,
          tokenCount: Math.ceil(c.content.length / 4),
          createdAt: now(),
        }),
      ),
    ] as Parameters<typeof db.batch>[0]);
    const embedded = await embed(chunks.map((c) => c.content));
    const rows = await db
      .select()
      .from(t.materialChunks)
      .where(eq(t.materialChunks.materialId, material.id))
      .orderBy(asc(t.materialChunks.chunkIndex));
    await db.batch([
      db
        .update(t.materials)
        .set({ status: "READY", error: null })
        .where(
          and(
            eq(t.materials.id, material.id),
            eq(t.materials.status, "PROCESSING"),
          ),
        ),
      ...rows.map((r, i) =>
        db
          .update(t.materialChunks)
          .set({
            embedding: embedded.vectors[i],
            embeddingModel: embedded.model,
          })
          .where(eq(t.materialChunks.id, r.id)),
      ),
    ]);
    return { id: material.id, status: "READY", chunks: chunks.length };
  } catch (e) {
    const error =
      e instanceof ApiError
        ? e.message
        : "Materi gagal diproses. Periksa format berkas dan coba lagi.";
    await db
      .update(t.materials)
      .set({ status: "FAILED", error })
      .where(eq(t.materials.id, material.id));
    return { id: material.id, status: "FAILED", error };
  } finally {
    await db
      .delete(t.rateLimits)
      .where(
        and(eq(t.rateLimits.id, leaseId), eq(t.rateLimits.windowStart, lease)),
      );
  }
}
