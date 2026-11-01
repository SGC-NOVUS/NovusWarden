<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api, type DiagnosticsConfig } from '../api/client.ts';

const loading = ref(true);
const diag = ref<DiagnosticsConfig | null>(null);
const usersCount = ref<number | null>(null);

onMounted(async () => {
  try {
    const [diagRes, usersRes] = await Promise.all([
      api.getDiagnostics().catch(() => null),
      api.getUsers().catch(() => []),
    ]);
    diag.value = diagRes;
    usersCount.value = usersRes ? usersRes.length : 0;
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div>
    <div style="margin-bottom: 24px;">
      <h1 style="font-size: 24px; font-weight: 700; color: #f9fafb; margin: 0 0 6px 0;">
        System Overview
      </h1>
      <p style="font-size: 14px; color: #9ca3af; margin: 0;">
        Real-time telemetry, server configuration, and health monitoring for NovusWarden.
      </p>
    </div>

    <!-- Quick Stat Cards -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-bottom: 28px;">
      <div style="background-color: #111827; border: 1px solid #1f2937; border-radius: 8px; padding: 20px;">
        <div style="font-size: 12px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Active Vault Users</div>
        <div style="font-size: 32px; font-weight: 800; color: #38bdf8; margin-top: 8px;">
          {{ loading ? '...' : (usersCount ?? 0) }}
        </div>
      </div>

      <div style="background-color: #111827; border: 1px solid #1f2937; border-radius: 8px; padding: 20px;">
        <div style="font-size: 12px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Database Engine</div>
        <div style="font-size: 24px; font-weight: 700; color: #34d399; margin-top: 10px;">
          {{ diag?.db_type || 'PostgreSQL' }}
        </div>
      </div>

      <div style="background-color: #111827; border: 1px solid #1f2937; border-radius: 8px; padding: 20px;">
        <div style="font-size: 12px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Server Version</div>
        <div style="font-size: 24px; font-weight: 700; color: #a78bfa; margin-top: 10px;">
          {{ diag?.version || '0.0.1 (SGC-NOVUS)' }}
        </div>
      </div>
    </div>

    <!-- Action Shortcuts -->
    <div style="background-color: #111827; border: 1px solid #1f2937; border-radius: 8px; padding: 24px;">
      <h2 style="font-size: 16px; font-weight: 600; color: #f9fafb; margin: 0 0 16px 0;">
        Quick Management
      </h2>
      <div style="display: flex; gap: 12px; flex-wrap: wrap;">
        <router-link to="/users" style="background-color: #2563eb; color: white; padding: 10px 18px; border-radius: 6px; font-size: 13px; font-weight: 600; text-decoration: none;">
          Manage Users
        </router-link>
        <router-link to="/organizations" style="background-color: #1f2937; color: #e5e7eb; border: 1px solid #374151; padding: 10px 18px; border-radius: 6px; font-size: 13px; font-weight: 600; text-decoration: none;">
          View Organizations
        </router-link>
        <router-link to="/diagnostics" style="background-color: #1f2937; color: #e5e7eb; border: 1px solid #374151; padding: 10px 18px; border-radius: 6px; font-size: 13px; font-weight: 600; text-decoration: none;">
          Check Diagnostics
        </router-link>
      </div>
    </div>
  </div>
</template>

