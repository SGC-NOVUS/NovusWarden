<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api, type DiagnosticsConfig } from '../api/client.ts';

const loading = ref(true);
const diag = ref<DiagnosticsConfig | null>(null);
const error = ref<string | null>(null);

onMounted(async () => {
  try {
    diag.value = await api.getDiagnostics();
  } catch (err: any) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div>
    <div style="margin-bottom: 24px;">
      <h1 style="font-size: 24px; font-weight: 700; color: #f9fafb; margin: 0 0 6px 0;">
        System Diagnostics
      </h1>
      <p style="font-size: 14px; color: #9ca3af; margin: 0;">
        Inspect runtime environment, DNS resolution, and security header compliance.
      </p>
    </div>

    <div v-if="loading" style="padding: 40px; text-align: center; color: #9ca3af;">
      Gathering system diagnostics...
    </div>

    <div v-else-if="error" style="background-color: #450a0a; border: 1px solid #991b1b; color: #fca5a5; padding: 16px; border-radius: 8px;">
      {{ error }}
    </div>

    <div v-else style="display: grid; gap: 20px;">
      <!-- Server Environment -->
      <div style="background-color: #111827; border: 1px solid #1f2937; border-radius: 8px; padding: 24px;">
        <h2 style="font-size: 16px; font-weight: 600; color: #f9fafb; margin: 0 0 16px 0;">
          Runtime Metrics
        </h2>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
          <div>
            <div style="font-size: 12px; color: #9ca3af;">NovusWarden Build</div>
            <div style="font-size: 15px; font-weight: 600; color: #38bdf8; margin-top: 4px;">{{ diag?.version }}</div>
          </div>
          <div>
            <div style="font-size: 12px; color: #9ca3af;">Backend Database</div>
            <div style="font-size: 15px; font-weight: 600; color: #34d399; margin-top: 4px;">{{ diag?.db_type }}</div>
          </div>
          <div>
            <div style="font-size: 12px; color: #9ca3af;">Server Wall Clock</div>
            <div style="font-size: 14px; font-weight: 500; color: #cbd5e1; margin-top: 4px;">{{ diag?.server_time }}</div>
          </div>
        </div>
      </div>

      <!-- Quick Link to Deep Diagnostic Checks -->
      <div style="background-color: #111827; border: 1px solid #1f2937; border-radius: 8px; padding: 24px;">
        <h2 style="font-size: 16px; font-weight: 600; color: #f9fafb; margin: 0 0 8px 0;">
          Network & Security Headers Inspector
        </h2>
        <p style="font-size: 13px; color: #9ca3af; margin: 0 0 16px 0;">
          Run DNS queries, upstream NTP checks, and verify HTTPS/HSTS reverse proxy headers.
        </p>
        <a
          href="/admin/diagnostics"
          target="_blank"
          style="display: inline-block; background-color: #1f2937; color: #38bdf8; border: 1px solid #374151; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; text-decoration: none;"
        >
          Run Diagnostic Test Suite ↗
        </a>
      </div>
    </div>
  </div>
</template>

