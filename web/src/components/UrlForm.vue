<script setup lang="ts">
import {ref} from 'vue';
const props=defineProps<{loading:boolean}>();const emit=defineEmits<{submit:[url:string]}>();
const url=ref('');const error=ref('');
function submit(){error.value='';try{const parsed=new URL(url.value);if(!['http:','https:'].includes(parsed.protocol))throw new Error();emit('submit',parsed.toString());}catch{error.value='Enter a valid storefront URL beginning with https://';}}
</script>
<template><form class="url-form" @submit.prevent="submit"><label for="store-url">Shopify storefront URL</label><div class="input-row"><input id="store-url" v-model="url" type="url" placeholder="https://your-store.com" required :disabled="loading"><button :disabled="loading || !url.trim()">{{loading?'Scanning…':'Scan storefront'}}</button></div><p v-if="error" class="error">{{error}}</p><p class="hint">Public storefront scan only. No login, credentials or private store data are requested.</p></form></template>
