import { createHash } from "node:crypto";
import { z } from "zod";
const relativeSourcePathSchema = z
    .string()
    .trim()
    .min(1)
    .max(1_000)
    .refine((value) => {
    const normalized = value.replaceAll("\\", "/");
    return (!normalized.startsWith("/") &&
        !/^[A-Za-z]:\//.test(normalized) &&
        !normalized.split("/").some((part) => part === "" || part === "." || part === ".."));
}, "Source paths must be relative and cannot contain traversal segments.");
export const sourceInfoSchema = z.object({
    name: z.string().trim().min(1).max(200),
    path: relativeSourcePathSchema,
    source_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    ingested_at: z.iso.datetime(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/i),
    rows: z.number().int().min(0),
    warnings: z.array(z.string().max(2_000)).max(10_000),
    metadata: z.record(z.string(), z.unknown()).optional(),
}).strict();
export const sourceManifestSchema = z.object({
    generated_at: z.iso.datetime(),
    sources: z.array(sourceInfoSchema).min(1).max(20),
    warnings: z.array(z.string().max(2_000)).max(10_000),
}).strict();
export function sourceSetDigest(sources) {
    const canonical = [...sources]
        .sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0))
        .map(({ name, path, source_date, ingested_at, sha256, rows }) => ({
        name,
        path,
        source_date,
        ingested_at,
        sha256,
        rows,
    }));
    return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}
