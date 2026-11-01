<script setup lang="ts">
import { computed } from 'vue';
import type { ScanResult, DiscoveryOutcome } from '../types/scan';
import FindingsList from './FindingsList.vue';

const props = defineProps<{ result: ScanResult }>();

const isIncompleteDiscovery = computed(() => {
  const prod = props.result.discovery.products;
  const col = props.result.discovery.collections;
  return prod.completeness === 'partial' ||
    col.completeness === 'partial' ||
    prod.status !== 'success' ||
    col.status !== 'success';
});

function formatDiscoveryStatus(item: DiscoveryOutcome): string {
  if (item.httpStatus === 403) return 'Blocked (HTTP 403)';
  if (item.httpStatus === 404) return 'Endpoint Unavailable (HTTP 404)';
  if (item.httpStatus === 429) return 'Rate Limited (HTTP 429)';
  if (item.status === 'success' && item.discoveredCount === 0) return 'Empty Response (0 items)';
  if (item.status === 'success' && item.completeness === 'partial') return 'Partial Discovery';
  if (item.status === 'success') return 'Discovered';
  if (item.status === 'invalid_response') return 'Invalid Format';
  if (item.status === 'unavailable') return 'Unavailable';
  return item.status.replaceAll('_', ' ');
}

function statusBadgeClass(item: DiscoveryOutcome): string {
  if (item.httpStatus === 403) return 'blocked';
  if (item.httpStatus === 404) return 'unavailable';
  if (item.httpStatus === 429) return 'rate-limited';
  if (item.status === 'success' && item.completeness === 'partial') return 'partial';
  if (item.status === 'success') return 'success';
  return item.status;
}

const groupedIssues = computed(() => {
  const map = new Map<string, { key: string; code: string; message: string; count: number; urls: string[] }>();
  for (const issue of [...props.result.errors, ...props.result.warnings]) {
    const key = `${issue.code}|${issue.message}`;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      if (issue.url && !existing.urls.includes(issue.url)) existing.urls.push(issue.url);
    } else {
      map.set(key, { key, code: issue.code, message: issue.message, count: 1, urls: issue.url ? [issue.url] : [] });
    }
  }
  return [...map.values()];
});
</script>

<template>
  <section class="report">
    <div class="report-head">
      <div>
        <p class="eyebrow">SCAN REPORT</p>
        <h2>{{ result.store.name || result.store.domain }}</h2>
        <a :href="result.finalUrl" target="_blank" rel="noreferrer">{{ result.finalUrl }}</a>
      </div>
      <span class="status" :class="result.status">{{ result.status.replaceAll('_', ' ') }}</span>
    </div>

    <div class="stats">
      <div>
        <strong>{{ result.summary.productsFound }}</strong>
        <span>Products discovered (sample)</span>
      </div>
      <div>
        <strong>{{ result.summary.collectionsFound }}</strong>
        <span>Collections discovered (sample)</span>
      </div>
      <div>
        <strong>{{ result.summary.variantsFound }}</strong>
        <span>Variants captured (sample)</span>
      </div>
      <div>
        <strong>{{ result.summary.pagesInspected }}</strong>
        <span>Pages inspected</span>
      </div>
    </div>

    <div v-if="isIncompleteDiscovery" class="incomplete-banner">
      <strong>Partial discovery:</strong> Public catalogue endpoints were restricted or required sitemap/navigation fallback. Discovered counts represent verified public samples, not store-wide totals.
    </div>

    <div class="notice">
      This is a public storefront assessment, not an internal store audit. Private Shopify admin settings, apps, checkout customisations, orders, and customer records are not inspectable.
    </div>

    <div class="discovery-grid">
      <div
        v-for="item in [
          { label: 'Product discovery', data: result.discovery.products },
          { label: 'Collection discovery', data: result.discovery.collections }
        ]"
        :key="item.label"
        class="discovery-card"
      >
        <div class="discovery-card-header">
          <strong>{{ item.label }}</strong>
          <span class="discovery-status" :class="statusBadgeClass(item.data)">
            {{ formatDiscoveryStatus(item.data) }}
          </span>
        </div>
        <small class="muted">
          {{ item.data.discoveredCount }} discovered · {{ item.data.attempts }} attempt(s) · {{ item.data.retries }} retry(s)
        </small>
        <small>{{ item.data.note || 'Public sample only; store total is unverified.' }}</small>
      </div>
    </div>

    <h3>Portability findings</h3>
    <FindingsList :findings="result.findings" />

    <h3>Detected technologies</h3>
    <ul class="simple-list">
      <li v-for="t in result.technologies" :key="t.id">
        <strong>{{ t.label }}</strong>
        <span class="muted"> · {{ t.category }} · {{ t.confidence }} confidence</span>
        <small v-if="t.disclaimer">{{ t.disclaimer }}</small>
      </li>
      <li v-if="!result.technologies.length" class="muted">
        No recognizable public technology signatures were detected on the inspected storefront pages. This does not prove that no third-party technologies exist.
      </li>
    </ul>

    <h3>SEO observations</h3>
    <div v-for="s in result.seo" :key="s.pageUrl" class="seo-row">
      <strong>{{ s.title || 'Untitled page' }}</strong>
      <small><a :href="s.pageUrl" target="_blank" rel="noreferrer">{{ s.pageUrl }}</a></small>
      <span v-if="s.issues.length" class="muted">{{ s.issues.join(' · ') }}</span>
    </div>

    <h3>Data limitations</h3>
    <ul class="simple-list">
      <li v-for="(item, i) in result.dataLimitations" :key="i">{{ item }}</li>
    </ul>

    <div v-if="result.errors.length || result.warnings.length">
      <h3>Scan issues</h3>
      <div v-for="e in groupedIssues" :key="e.key" class="issue-row">
        <p class="muted">
          {{ e.code }}: {{ e.message }}
          <span v-if="e.count > 1"> · {{ e.count }} occurrences</span>
        </p>
        <div v-if="e.urls.length" class="issue-urls">
          <small v-for="(u, idx) in e.urls.slice(0, 5)" :key="idx" class="muted">
            <a :href="u" target="_blank" rel="noreferrer">{{ u }}</a>
          </small>
          <small v-if="e.urls.length > 5" class="muted">+ {{ e.urls.length - 5 }} more URL(s)</small>
        </div>
      </div>
    </div>

    <footer>Scan {{ result.scanId }} · {{ (result.durationMs / 1000).toFixed(1) }} seconds</footer>
  </section>
</template>
