<script setup lang="ts">
import { ref } from 'vue';
import type { Finding } from '../types/scan';

defineProps<{ findings: Finding[] }>();
const opened = ref<string[]>([]);

function toggle(id: string) {
  opened.value = opened.value.includes(id)
    ? opened.value.filter(x => x !== id)
    : [...opened.value, id];
}
</script>

<template>
  <div v-if="!findings.length" class="empty">
    <strong>No portability findings identified</strong>
    <p>No high-probability risks were detected from the available public evidence sample. This does not establish that the store has no migration risks. Private apps, checkout rules, and database records must be verified directly.</p>
  </div>

  <article v-for="f in findings" :key="f.id" class="finding">
    <div class="finding-top">
      <span class="severity" :class="f.severity">{{ f.severity }} severity</span>
      <span class="confidence" :class="f.confidence">{{ f.confidence }} confidence</span>
      <span class="basis" :class="f.basis">{{ f.basis }}</span>
    </div>
    <h3>{{ f.title }}</h3>
    <p>{{ f.description }}</p>
    <p class="recommend"><strong>WooCommerce impact:</strong> {{ f.recommendedInvestigation }}</p>
    <button class="text-button" @click="toggle(f.id)">
      {{ opened.includes(f.id) ? 'Hide evidence' : `View evidence (${f.evidence.length})` }}
    </button>
    <ul v-if="opened.includes(f.id)" class="evidence">
      <li v-for="(e, i) in f.evidence" :key="i">
        <strong>{{ e.source }}</strong> ·
        <a v-if="e.locator.startsWith('http')" :href="e.locator" target="_blank" rel="noreferrer">{{ e.locator }}</a>
        <span v-else>{{ e.locator }}</span>
        <small v-if="e.excerpt">{{ e.excerpt }}</small>
        <small v-if="e.note" class="muted">{{ e.note }}</small>
      </li>
    </ul>
  </article>
</template>
