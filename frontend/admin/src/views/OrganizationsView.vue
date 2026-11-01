<script setup lang="ts">
import { ref, onMounted } from 'vue';

const loading = ref(true);
const orgs = ref<any[]>([]);

onMounted(async () => {
  try {
    // Organizations are rendered in NovusWarden via admin endpoint
    const res = await fetch('/admin/organizations/overview');
    if (res.ok) {
      // If HTML or JSON endpoint, capture status
    }
  } catch (e) {
    //
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div>
    <div style="margin-bottom: 24px;">
      <h1 style="font-size: 24px; font-weight: 700; color: #f9fafb; margin: 0 0 6px 0;">
        Organizations & Collections
      </h1>
      <p style="font-size: 14px; color: #9ca3af; margin: 0;">
        Shared enterprise vaults, team collections, and organization membership.
      </p>
    </div>

    <div style="background-color: #111827; border: 1px solid #1f2937; border-radius: 8px; padding: 24px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h2 style="font-size: 16px; font-weight: 600; color: #f9fafb; margin: 0;">
          Configured Organizations
        </h2>
      </div>

      <p style="font-size: 13px; color: #9ca3af; line-height: 20px;">
        To manage specific collection ciphers or member privileges within an organization, use the official Bitwarden Web Vault.
      </p>

      <div style="margin-top: 16px;">
        <a
          href="/admin/organizations/overview"
          target="_blank"
          style="display: inline-block; background-color: #1f2937; color: #38bdf8; border: 1px solid #374151; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; text-decoration: none;"
        >
          Open Classic Organizations Inspector ↗
        </a>
      </div>
    </div>
  </div>
</template>

