export interface Evidence {
  source: string;
  locator: string;
  excerpt?: string;
  note?: string;
}
export interface Finding {
  id: string;
  category: string;
  title: string;
  description: string;
  severity: "info" | "low" | "medium" | "high";
  confidence: "low" | "medium" | "high";
  basis: "observed" | "inferred";
  evidence: Evidence[];
  recommendedInvestigation: string;
}
export interface DiscoveryOutcome {
  status:
    | "success"
    | "rate_limited"
    | "http_error"
    | "unavailable"
    | "invalid_response";
  discoveredCount: number;
  completeness: "unknown" | "partial";
  httpStatus?: number;
  attempts: number;
  retries: number;
  note?: string;
}
export interface ScanIssue {
  code: string;
  message: string;
  url?: string;
  stage: string;
  recoverable: boolean;
}
export interface ScanResult {
  scanId: string;
  status: "completed" | "completed_with_warnings" | "failed";
  requestedUrl: string;
  finalUrl: string;
  store: { domain: string; shopifyDetected: boolean; name?: string };
  discovery: { products: DiscoveryOutcome; collections: DiscoveryOutcome };
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  pagesInspected: Array<{
    url: string;
    status: number;
    bytes: number;
    stage: string;
  }>;
  products: Array<{
    handle: string;
    title: string;
    url: string;
    variantCount: number;
    priceRange: { min: number | null; max: number | null };
    evidence: Evidence[];
  }>;
  collections: Array<{ handle: string; title?: string; url: string }>;
  seo: Array<{
    pageUrl: string;
    title?: string;
    metaDescription?: string;
    issues: string[];
  }>;
  technologies: Array<{
    id: string;
    label: string;
    category: string;
    confidence: string;
    disclaimer?: string;
  }>;
  findings: Finding[];
  dataLimitations: string[];
  errors: ScanIssue[];
  warnings: ScanIssue[];
  summary: {
    productsFound: number;
    collectionsFound: number;
    variantsFound: number;
    findingsBySeverity: Record<string, number>;
    pagesInspected: number;
  };
}
