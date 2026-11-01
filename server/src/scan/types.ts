import { z } from 'zod';

export const EvidenceSchema = z.object({
  source: z.enum(['http','html','json-ld','products-json','collections-json','sitemap','url-pattern','robots']),
  locator: z.string(),
  excerpt: z.string().max(200).optional(),
  note: z.string().optional()
});
export type Evidence = z.infer<typeof EvidenceSchema>;

export const FindingSchema = z.object({
  id: z.string(), category: z.enum(['products','variants','collections','structure','seo','apps','content','operations']),
  title: z.string(), description: z.string(),
  severity: z.enum(['info','low','medium','high']),
  confidence: z.enum(['low','medium','high']),
  basis: z.enum(['observed','inferred']),
  evidence: z.array(EvidenceSchema),
  recommendedInvestigation: z.string()
});
export type Finding = z.infer<typeof FindingSchema>;

export const ScanIssueSchema = z.object({
  code: z.string(), message: z.string(), url: z.string().optional(),
  stage: z.string(), recoverable: z.boolean()
});
export type ScanIssue = z.infer<typeof ScanIssueSchema>;

export const ProductSchema = z.object({
  handle: z.string(), title: z.string(), url: z.string(),
  priceRange: z.object({ min: z.number().nullable(), max: z.number().nullable(), currency: z.string().optional() }),
  variantCount: z.number().int().nonnegative(),
  options: z.array(z.object({ name: z.string(), valueCount: z.number().int().nonnegative() })),
  tags: z.array(z.string()).optional(), productType: z.string().optional(),
  available: z.boolean().nullable(), evidence: z.array(EvidenceSchema)
});
export type ProductRecord = z.infer<typeof ProductSchema>;

export const CollectionSchema = z.object({
  handle: z.string(), title: z.string().optional(), url: z.string(),
  productCount: z.number().int().nonnegative().optional(), evidence: z.array(EvidenceSchema)
});
export type CollectionRecord = z.infer<typeof CollectionSchema>;

export const ScanResultSchema = z.object({
  scanId: z.string(), status: z.enum(['completed','completed_with_warnings','failed']),
  requestedUrl: z.string(), finalUrl: z.string(),
  store: z.object({
    domain: z.string(), shopifyDetected: z.boolean(), detectionEvidence: z.array(EvidenceSchema),
    name: z.string().optional(), currency: z.string().optional(), country: z.string().optional(),
    theme: z.object({ name: z.string().optional(), id: z.string().optional(), evidence: z.array(EvidenceSchema) }).optional()
  }),
  startedAt: z.string(), finishedAt: z.string(), durationMs: z.number(),
  pagesInspected: z.array(z.object({ url: z.string(), status: z.number(), bytes: z.number(), stage: z.string(), attempts: z.number().int().nonnegative().optional(), retries: z.number().int().nonnegative().optional() })),
  discovery: z.object({
    products: z.object({ status: z.enum(['success','rate_limited','http_error','unavailable','invalid_response']), discoveredCount: z.number().int().nonnegative(), completeness: z.enum(['unknown','partial']), httpStatus: z.number().optional(), attempts: z.number().int().nonnegative(), retries: z.number().int().nonnegative(), note: z.string().optional() }),
    collections: z.object({ status: z.enum(['success','rate_limited','http_error','unavailable','invalid_response']), discoveredCount: z.number().int().nonnegative(), completeness: z.enum(['unknown','partial']), httpStatus: z.number().optional(), attempts: z.number().int().nonnegative(), retries: z.number().int().nonnegative(), note: z.string().optional() })
  }),
  products: z.array(ProductSchema), collections: z.array(CollectionSchema),
  variants: z.array(z.object({ productHandle: z.string(), id: z.union([z.string(),z.number()]).optional(), title: z.string(), sku: z.string().optional(), price: z.number().nullable().optional(), available: z.boolean().nullable().optional(), optionValues: z.record(z.string()) , evidence: z.array(EvidenceSchema) })),
  seo: z.array(z.object({ pageUrl: z.string(), title: z.string().optional(), titleLength: z.number().optional(), metaDescription: z.string().optional(), metaDescriptionLength: z.number().optional(), canonical: z.string().optional(), canonicalMatchesRequested: z.boolean().nullable(), h1Count: z.number().optional(), jsonLdTypes: z.array(z.string()), issues: z.array(z.string()), evidence: z.array(EvidenceSchema) })),
  technologies: z.array(z.object({ id: z.string(), label: z.string(), category: z.enum(['app','analytics','marketing','support','checkout','theme','cdn','other']), confidence: z.enum(['low','medium','high']), evidence: z.array(EvidenceSchema), disclaimer: z.string().optional() })),
  portabilityIndicators: z.array(z.object({ id: z.string(), label: z.string(), category: z.string(), detail: z.string(), severity: z.enum(['info','low','medium','high']), confidence: z.enum(['low','medium','high']), basis: z.enum(['observed','inferred']), evidence: z.array(EvidenceSchema) })),
  findings: z.array(FindingSchema), dataLimitations: z.array(z.string()),
  errors: z.array(ScanIssueSchema), warnings: z.array(ScanIssueSchema),
  summary: z.object({ productsFound: z.number(), collectionsFound: z.number(), variantsFound: z.number(), findingsBySeverity: z.record(z.number()), pagesInspected: z.number() })
});
export type ScanResult = z.infer<typeof ScanResultSchema>;

export const ScanRequestSchema = z.object({ url: z.string().url().max(2048) });
