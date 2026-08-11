import { z } from "zod";
export const niceClassSchema = z.number().int().min(1).max(45);
export const niceClassesSchema = z.array(niceClassSchema).max(45);
export const limit50Schema = z.number().int().min(1).max(50);
export const limit500Schema = z.number().int().min(1).max(500);
export const offsetSchema = z.number().int().min(0).max(1_000_000);
export const querySchema = z.string().trim().max(500);
export const identifierSchema = z.string().trim().min(1).max(500);
export const shortTextSchema = z.string().trim().min(1).max(200);
export const termSchema = z.string().trim().min(1).max(2_000);
export const optionalShortTextSchema = z.string().trim().max(200);
export const shortTextListSchema = z.array(shortTextSchema).max(50);
export const termListSchema = z.array(termSchema).min(1).max(200);
export const filingLanguageSchema = z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.enum(["de", "fr", "it", "en"]));
export const applicantSchema = z.object({
    name: optionalShortTextSchema.optional(),
    domicile_country: optionalShortTextSchema.optional(),
    representative_in_ch: z.boolean().optional(),
});
export const signSchema = z.object({
    text: z.string().trim().max(500).optional(),
    type: optionalShortTextSchema.optional(),
    representation_provided: z.boolean().optional(),
    color_claim: z.string().trim().max(500).nullable().optional(),
});
export const goodsServicesEntrySchema = z.object({
    class_number: niceClassSchema,
    terms: termListSchema,
    language: filingLanguageSchema.optional(),
});
export const goodsServicesEntriesSchema = z.array(goodsServicesEntrySchema).max(45);
export const goodsServicesTextListSchema = z.array(termSchema).max(200);
export const territoriesSchema = z.array(shortTextSchema).max(50);
export const priorityClaimSchema = z.object({
    claimed: z.boolean().optional(),
    details: z.string().trim().max(1_000).optional(),
});
