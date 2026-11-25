<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from '@shared/i18n.ts';
import { DOCS_CONTENT, type DocsTabId } from '@shared/docsContent.ts';
import { authState } from '../api/client.ts';

const { locale } = useI18n();
const activeTab = ref<DocsTabId>('admin');

const bundle = computed(() => DOCS_CONTENT[locale.value] || DOCS_CONTENT.en);
const currentTab = computed(
  () => bundle.value.tabs.find((tab) => tab.id === activeTab.value) || bundle.value.tabs[0]
);
</script>

<template>
  <div style="display: flex; flex-direction: column; gap: 20px;">
    <div
      style="
        background: var(--admin-card-bg, #111827);
        border: 1px solid var(--admin-card-border, #1f2937);
        border-radius: 12px;
        padding: 22px;
      "
    >
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
        <div>
          <h1 style="margin: 0 0 6px 0; font-size: 22px; font-weight: 800; color: var(--admin-text-main, #f9fafb);">
            {{ bundle.heroTitle }}
          </h1>
          <p style="margin: 0; font-size: 13px; color: var(--admin-text-secondary, #9ca3af);">
            {{ bundle.heroSubtitle }}
          </p>
        </div>

        <router-link
          :to="authState.isAuthenticated ? '/' : '/login'"
          style="
            padding: 8px 14px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 600;
            text-decoration: none;
            background: var(--admin-btn-bg, #1f2937);
            border: 1px solid var(--admin-btn-border, #374151);
            color: var(--admin-btn-text, #f9fafb);
          "
        >
          {{ authState.isAuthenticated ? bundle.backAdmin : bundle.backLogin }}
        </router-link>
      </div>

      <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px;">
        <button
          v-for="tab in bundle.tabs"
          :key="tab.id"
          type="button"
          @click="activeTab = tab.id"
          :style="{
            padding: '8px 14px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            background: activeTab === tab.id ? 'rgba(14, 165, 233, 0.16)' : 'var(--admin-surface-bg, #1f2937)',
            border: activeTab === tab.id ? '1px solid #0ea5e9' : '1px solid var(--admin-btn-border, #374151)',
            color: activeTab === tab.id ? '#38bdf8' : 'var(--admin-text-subtle, #cbd5e1)',
          }"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <p v-if="currentTab" style="margin: 0; font-size: 14px; color: var(--admin-text-secondary, #9ca3af);">
      {{ currentTab.summary }}
    </p>

    <div
      v-if="currentTab"
      style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px;"
    >
      <div
        v-for="card in currentTab.cards"
        :key="card.title"
        style="
          background: var(--admin-card-bg, #111827);
          border: 1px solid var(--admin-card-border, #1f2937);
          border-radius: 12px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        "
      >
        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px;">
          <h2 style="margin: 0; font-size: 16px; font-weight: 700; color: var(--admin-text-main, #f9fafb);">
            {{ card.title }}
          </h2>
          <span
            v-if="card.badge"
            style="
              font-size: 11px;
              font-weight: 700;
              padding: 3px 8px;
              border-radius: 6px;
              background: rgba(14, 165, 233, 0.14);
              color: #38bdf8;
              border: 1px solid rgba(14, 165, 233, 0.3);
            "
          >
            {{ card.badge }}
          </span>
        </div>

        <p style="margin: 0; font-size: 13px; line-height: 1.55; color: var(--admin-text-secondary, #9ca3af);">
          {{ card.body }}
        </p>

        <ul style="margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: var(--admin-text-subtle, #d1d5db);">
          <li v-for="item in card.bullets" :key="item">{{ item }}</li>
        </ul>

        <pre
          v-if="card.code"
          style="
            margin: 6px 0 0 0;
            padding: 12px;
            border-radius: 8px;
            background: var(--admin-input-bg, #0b0f19);
            border: 1px solid var(--admin-input-border, #334155);
            font-size: 12px;
            color: #38bdf8;
            overflow-x: auto;
          "
        ><code>{{ card.code }}</code></pre>
      </div>
    </div>
  </div>
</template>
