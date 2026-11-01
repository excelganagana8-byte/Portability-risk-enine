<script setup lang="ts">
import { ref } from 'vue';
import UrlForm from './components/UrlForm.vue';
import ScanReport from './components/ScanReport.vue';
import { scanStore } from './api/client';
import type { ScanResult } from './types/scan';

const loading = ref(false);
const error = ref('');
const result = ref<ScanResult | null>(null);

async function run(url: string) {
  loading.value = true;
  error.value = '';
  result.value = null;
  try {
    result.value = await scanStore(url);
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Unexpected scan error';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="shell">
    <header>
      <div class="brand-mark">PRE</div>
      <div>
        <p class="eyebrow">PORTABILITY RISK ENGINE</p>
        <h1>Know what travels with your store.</h1>
        <p class="subhead">Evidence-based Shopify storefront assessment for a potential move to WooCommerce.</p>
      </div>
    </header>

    <section class="intro">
      <h2>Assess your storefront before you migrate.</h2>
      <p>PRE inspects publicly accessible storefront data and identifies technical signals that may affect portability. It does not move your store or access private merchant data.</p>
      <UrlForm :loading="loading" @submit="run" />
    </section>

    <div v-if="loading" class="loading">
      <span class="spinner"></span>
      <div>
        <strong>Inspecting storefront</strong>
        <p>Discovery, products, collections, SEO and public dependencies. This may take up to 90 seconds.</p>
      </div>
    </div>

    <div v-if="error" class="error-panel">{{ error }}</div>

    <ScanReport v-if="result" :result="result" />

    <footer class="site-footer">
      PRE V0.1.3.1 · Public evidence only · Findings are preliminary and require merchant-side verification
    </footer>
  </main>
</template>
