<script setup lang="ts">
import { ref } from 'vue';

const message = ref<string | null>(null);

function handleBackup() {
  window.open('/admin/config/backup_db', '_blank');
}
</script>

<template>
  <div>
    <div style="margin-bottom: 24px;">
      <h1 style="font-size: 24px; font-weight: 700; color: #f9fafb; margin: 0 0 6px 0;">
        Environment & System Settings
      </h1>
      <p style="font-size: 14px; color: #9ca3af; margin: 0;">
        Runtime configuration values and administrative maintenance tools.
      </p>
    </div>

    <div style="display: grid; gap: 20px;">
      <!-- Database Maintenance -->
      <div style="background-color: #111827; border: 1px solid #1f2937; border-radius: 8px; padding: 24px;">
        <h2 style="font-size: 16px; font-weight: 600; color: #f9fafb; margin: 0 0 8px 0;">
          Database Maintenance
        </h2>
        <p style="font-size: 13px; color: #9ca3af; margin: 0 0 16px 0;">
          Download an on-demand snapshot of the active SQLite database (when applicable) or verify active connection pooling.
        </p>
        <button
          @click="handleBackup"
          style="background-color: #1f2937; color: #38bdf8; border: 1px solid #374151; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;"
        >
          Download Database Backup
        </button>
      </div>

      <!-- Full Settings Editor Link -->
      <div style="background-color: #111827; border: 1px solid #1f2937; border-radius: 8px; padding: 24px;">
        <h2 style="font-size: 16px; font-weight: 600; color: #f9fafb; margin: 0 0 8px 0;">
          Advanced Server Configuration
        </h2>
        <p style="font-size: 13px; color: #9ca3af; margin: 0 0 16px 0;">
          To review all 100+ fine-grained environment flags (SMTP, Push Notifications, WebSockets, Signups, KDF parameters), access the server configuration panel:
        </p>
        <a
          href="/admin/config"
          style="display: inline-block; background-color: #2563eb; color: white; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; text-decoration: none;"
        >
          Launch Detailed Config Editor ↗
        </a>
      </div>
    </div>
  </div>
</template>

