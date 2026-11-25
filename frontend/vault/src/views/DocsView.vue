<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth.ts';
import { useThemeStore } from '../stores/theme.ts';
import { useI18n } from '@shared/i18n.ts';
import { DOCS_CONTENT, type DocsTabId } from '@shared/docsContent.ts';
import {
  BookOpen,
  ShieldCheck,
  Users,
  Building2,
  ServerCog,
  Sparkles,
  Globe,
  Sun,
  Moon,
  Monitor,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-vue-next';

const route = useRoute();
const authStore = useAuthStore();
const themeStore = useThemeStore();
const { locale, t, cycleLocale } = useI18n();

const initialTab = (route.query.tab as DocsTabId) || 'overview';
const validTabs: DocsTabId[] = ['overview', 'users', 'orgs', 'admin', 'security'];
const activeTab = ref<DocsTabId>(validTabs.includes(initialTab) ? initialTab : 'overview');

const bundle = computed(() => DOCS_CONTENT[locale.value] || DOCS_CONTENT.en);
const currentTab = computed(
  () => bundle.value.tabs.find((tab) => tab.id === activeTab.value) || bundle.value.tabs[0]
);

const themeIcon = computed(() => {
  if (themeStore.mode === 'dark') return Moon;
  if (themeStore.mode === 'light') return Sun;
  return Monitor;
});

const themeLabel = computed(() => {
  if (themeStore.mode === 'dark') return t('theme.dark');
  if (themeStore.mode === 'light') return t('theme.light');
  return t('theme.system');
});

const brandBannerSrc = computed(() =>
  themeStore.isDark
    ? '/vw_static/novuswarden_banner_black_trans.webp'
    : '/vw_static/novuswarden_banner_white_trans.webp'
);

function tabIcon(id: DocsTabId) {
  switch (id) {
    case 'users':
      return Users;
    case 'orgs':
      return Building2;
    case 'admin':
      return ServerCog;
    case 'security':
      return ShieldCheck;
    default:
      return Sparkles;
  }
}
</script>

<template>
  <div class="docs-page">
    <header class="docs-topbar">
      <div class="flex items-center gap-3">
        <img :src="brandBannerSrc" alt="NovusWarden" class="h-8 w-auto object-contain" />
        <span class="docs-pill-badge">
          <BookOpen class="w-3.5 h-3.5" />
          <span>{{ t('nav.docs') }}</span>
        </span>
      </div>

      <div class="flex items-center gap-2 flex-wrap">
        <button type="button" class="docs-pill" @click="cycleLocale" :title="t('lang.label')">
          <Globe class="w-3.5 h-3.5 text-sky-400" />
          <span>{{ locale.toUpperCase() }}</span>
        </button>

        <button type="button" class="docs-pill" @click="themeStore.cycleTheme" :title="themeLabel">
          <component :is="themeIcon" class="w-3.5 h-3.5 text-sky-400" />
          <span>{{ themeLabel }}</span>
        </button>

        <router-link
          v-if="authStore.isAuthenticated"
          to="/vault"
          class="docs-pill docs-pill-primary"
        >
          <ArrowLeft class="w-3.5 h-3.5" />
          <span>{{ bundle.backVault }}</span>
        </router-link>

        <template v-else>
          <router-link to="/login" class="docs-pill">
            <span>{{ bundle.backLogin }}</span>
          </router-link>
          <router-link to="/signup" class="docs-pill docs-pill-primary">
            <span>{{ bundle.goSignup }}</span>
          </router-link>
        </template>
      </div>
    </header>

    <main class="docs-container">
      <section class="docs-hero">
        <h1 class="docs-title">{{ bundle.heroTitle }}</h1>
        <p class="docs-subtitle">{{ bundle.heroSubtitle }}</p>

        <div class="docs-tabs" role="tablist">
          <button
            v-for="tab in bundle.tabs"
            :key="tab.id"
            type="button"
            role="tab"
            :aria-selected="activeTab === tab.id"
            class="docs-tab"
            :class="{ active: activeTab === tab.id }"
            @click="activeTab = tab.id"
          >
            <component :is="tabIcon(tab.id)" class="w-4 h-4 shrink-0" />
            <span>{{ tab.label }}</span>
          </button>
        </div>
      </section>

      <section v-if="currentTab" class="docs-content">
        <p class="docs-section-summary">{{ currentTab.summary }}</p>

        <div class="docs-grid">
          <article v-for="card in currentTab.cards" :key="card.title" class="docs-card">
            <div class="docs-card-header">
              <h2 class="docs-card-title">{{ card.title }}</h2>
              <span v-if="card.badge" class="docs-card-badge">{{ card.badge }}</span>
            </div>

            <p class="docs-card-body">{{ card.body }}</p>

            <ul class="docs-list">
              <li v-for="item in card.bullets" :key="item" class="docs-list-item">
                <CheckCircle2 class="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{{ item }}</span>
              </li>
            </ul>

            <pre v-if="card.code" class="docs-code"><code>{{ card.code }}</code></pre>
          </article>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.docs-page {
  min-height: 100vh;
  background: var(--bg-page);
  color: var(--text-primary);
  display: flex;
  flex-direction: column;
}

.docs-topbar {
  max-width: 1180px;
  width: 100%;
  margin: 0 auto;
  padding: 14px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  border-bottom: 1px solid var(--border-color);
}

.docs-pill-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #38bdf8;
  background: rgba(14, 165, 233, 0.12);
  border: 1px solid rgba(56, 189, 248, 0.3);
}

.docs-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  transition: all 0.2s ease;
}

.docs-pill:hover {
  border-color: #38bdf8;
}

.docs-pill-primary {
  background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
  border-color: transparent;
  color: #ffffff;
}

.docs-container {
  max-width: 1180px;
  width: 100%;
  margin: 0 auto;
  padding: 28px 20px 48px;
}

.docs-hero {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 24px;
}

.docs-title {
  margin: 0 0 8px 0;
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.docs-subtitle {
  margin: 0 0 18px 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.docs-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.docs-tab {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 14px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  background: var(--input-bg);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  transition: all 0.2s ease;
}

.docs-tab:hover {
  color: var(--text-primary);
  border-color: rgba(56, 189, 248, 0.5);
}

.docs-tab.active {
  background: rgba(14, 165, 233, 0.16);
  border-color: #0ea5e9;
  color: var(--text-primary);
}

.docs-section-summary {
  margin: 0 0 18px 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-secondary);
}

.docs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 18px;
}

.docs-card {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 14px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.docs-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.docs-card-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
}

.docs-card-badge {
  flex-shrink: 0;
  font-size: 10.5px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 6px;
  background: rgba(14, 165, 233, 0.14);
  color: #0284c7;
  border: 1px solid rgba(14, 165, 233, 0.3);
}

html.dark .docs-card-badge {
  color: #38bdf8;
}

.docs-card-body {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  color: var(--text-secondary);
}

.docs-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.docs-list-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 13px;
  line-height: 1.5;
}

.docs-code {
  margin: 4px 0 0 0;
  padding: 12px;
  border-radius: 8px;
  background: var(--input-bg);
  border: 1px solid var(--border-color);
  font-size: 12px;
  overflow-x: auto;
  color: #38bdf8;
}

html.light .docs-code {
  color: #0369a1;
}
</style>
