<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, authState, adminUrl } from './api/client.ts';
import { useI18n } from '@shared/i18n.ts';

const route = useRoute();
const router = useRouter();
const { t, locale, cycleLocale } = useI18n();

const isLoginPage = computed(() => route.path === '/login' || (authState.value.needsAuth && route.path !== '/docs'));

// Theme switcher: 'system' | 'dark' | 'light'
const themeMode = ref<'system' | 'dark' | 'light'>((localStorage.getItem('novus_theme') as any) || 'system');

const isLight = computed(() => {
  if (themeMode.value === 'light') return true;
  if (themeMode.value === 'dark') return false;
  return window.matchMedia && !window.matchMedia('(prefers-color-scheme: dark)').matches;
});

const bannerUrl = computed(() => adminUrl(`/vw_static/${isLight.value ? 'novuswarden_banner_white_trans.webp' : 'novuswarden_banner_black_trans.webp'}`));

function applyTheme(mode: 'system' | 'dark' | 'light') {
  const isDark = mode === 'dark' || (mode === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (isDark) {
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
  } else {
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
  }
}

function toggleTheme() {
  const modes: ('system' | 'dark' | 'light')[] = ['system', 'dark', 'light'];
  const next = modes[(modes.indexOf(themeMode.value) + 1) % modes.length];
  themeMode.value = next;
  localStorage.setItem('novus_theme', next);
  applyTheme(next);
}

onMounted(() => {
  applyTheme(themeMode.value);
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (themeMode.value === 'system') {
        applyTheme('system');
      }
    });
  }
});

const navItems = computed(() => [
  { name: t('nav.dashboard'), path: '/' },
  { name: t('nav.users'), path: '/users' },
  { name: t('nav.organizations'), path: '/organizations' },
  { name: t('nav.subscriptions'), path: '/subscriptions' },
  { name: t('nav.serverSettings'), path: '/settings' },
  { name: t('nav.diagnostics'), path: '/diagnostics' },
  { name: t('nav.docs'), path: '/docs' },
]);

const loggingOut = ref(false);

async function handleLogout() {
  loggingOut.value = true;
  await api.logout();
  loggingOut.value = false;
  await router.push('/login');
}
</script>

<template>
  <div
    :style="{
      height: isLoginPage ? '100vh' : undefined,
      maxHeight: isLoginPage ? '100vh' : undefined,
      overflow: isLoginPage ? 'hidden' : undefined,
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: isLight ? '#f0f6fb' : '#010811',
      backgroundImage: isLight
        ? 'radial-gradient(ellipse at 50% 25%, #ffffff 0%, #f1f6fb 60%, #e2ecf5 100%)'
        : 'radial-gradient(ellipse at 50% 25%, #061329 0%, #020916 65%, #01050d 100%)',
      color: isLight ? '#0f172a' : '#f8fafc',
      transition: 'background-color 0.25s ease, color 0.25s ease'
    }"
  >
    <!-- Sticky Translucent Top Bar Header -->
    <header
      :style="{
        position: 'sticky',
        top: 0,
        zIndex: 60,
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        backgroundColor: isLight ? 'rgba(255, 255, 255, 0.92)' : 'rgba(8, 15, 30, 0.88)',
        borderBottom: isLight ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(56, 189, 248, 0.16)',
        boxShadow: isLight ? '0 2px 12px rgba(15, 23, 42, 0.05)' : '0 4px 24px rgba(0, 0, 0, 0.45)',
        padding: '10px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        flexShrink: 0
      }"
    >
      <div style="display: flex; align-items: center; gap: 12px;">
        <router-link to="/" style="display: flex; align-items: center; gap: 10px; text-decoration: none;">
          <img
            :src="bannerUrl"
            alt="NovusWarden Control Plane"
            style="height: 32px; max-width: 184px; object-fit: contain; display: block;"
          />
          <span
            :style="{
              fontSize: '10.5px',
              fontWeight: 700,
              letterSpacing: '0.7px',
              padding: '3px 8px',
              borderRadius: '6px',
              textTransform: 'uppercase',
              color: isLight ? '#0284c7' : '#38bdf8',
              background: isLight ? 'rgba(2, 132, 199, 0.08)' : 'rgba(56, 189, 248, 0.12)',
              border: isLight ? '1px solid rgba(2, 132, 199, 0.22)' : '1px solid rgba(56, 189, 248, 0.25)'
            }"
          >
            Control Plane
          </span>
        </router-link>
      </div>

      <!-- Segmented Navigation Bar -->
      <nav
        v-if="!isLoginPage"
        :style="{
          display: 'flex',
          gap: '4px',
          flexWrap: 'wrap',
          padding: '4px',
          borderRadius: '11px',
          backgroundColor: isLight ? '#f1f5f9' : 'rgba(15, 23, 42, 0.72)',
          border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(56, 189, 248, 0.16)'
        }"
      >
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          custom
          v-slot="{ href, navigate, isActive }"
        >
          <a
            :href="href"
            @click="navigate"
            :style="{
              padding: '6px 13px',
              borderRadius: '8px',
              fontSize: '12.5px',
              fontWeight: 600,
              textDecoration: 'none',
              transition: 'all 0.15s ease',
              backgroundColor: isActive
                ? (isLight ? '#0284c7' : 'rgba(14, 165, 233, 0.22)')
                : 'transparent',
              color: isActive
                ? (isLight ? '#ffffff' : '#38bdf8')
                : (isLight ? '#475569' : '#94a3b8'),
              border: isActive
                ? (isLight ? '1px solid #0284c7' : '1px solid rgba(56, 189, 248, 0.35)')
                : '1px solid transparent',
            }"
          >
            {{ item.name }}
          </a>
        </router-link>
      </nav>

      <!-- Right Header Actions (Matches prod navbar) -->
      <div style="display: flex; align-items: center; gap: 14px;">
        <a
          :href="adminUrl('/')"
          target="_blank"
          :style="{
            color: isLight ? '#475569' : '#94a3b8',
            textDecoration: 'none',
            fontSize: '13px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            transition: 'color 0.15s ease'
          }"
          title="Открыть веб-хранилище паролей Bitwarden Web Vault"
        >
          Веб-хранилище
        </a>

        <!-- Language Switcher Pill -->
        <button
          type="button"
          @click="cycleLocale"
          :style="{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '5px 10px',
            borderRadius: '999px',
            background: isLight ? '#f1f5f9' : 'rgba(31, 41, 55, 0.8)',
            border: isLight ? '1px solid #cbd5e1' : '1px solid #374151',
            color: isLight ? '#334155' : '#cbd5e1',
            cursor: 'pointer',
            fontSize: '11.5px',
            fontWeight: 700,
          }"
          :title="t('lang.label')"
        >
          🌐 {{ locale.toUpperCase() }}
        </button>

        <!-- Theme Switcher Pill (System by default, toggles System -> Dark -> Light) -->
        <button
          type="button"
          @click="toggleTheme"
          :style="{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 12px',
            borderRadius: '999px',
            background: isLight ? '#f1f5f9' : 'rgba(31, 41, 55, 0.8)',
            border: isLight ? '1px solid #cbd5e1' : '1px solid #374151',
            color: isLight ? '#334155' : '#cbd5e1',
            cursor: 'pointer',
            fontSize: '11.5px',
            fontWeight: 600,
            transition: 'all 0.2s ease'
          }"
          :title="'Тема: ' + (themeMode === 'system' ? 'Системная (по умолчанию)' : themeMode === 'dark' ? 'Тёмная' : 'Светлая') + ' • Нажмите для переключения'"
        >
          <span>{{ themeMode === 'system' ? '🖥️' : themeMode === 'dark' ? '🌙' : '☀️' }}</span>
          <span>{{ themeMode === 'system' ? 'Система' : themeMode === 'dark' ? 'Тёмная' : 'Светлая' }}</span>
        </button>

        <template v-if="!isLoginPage">
          <a
            :href="adminUrl('/admin/legacy')"
            :style="{
              backgroundColor: isLight ? '#f1f5f9' : '#1f2937',
              color: isLight ? '#475569' : '#9ca3af',
              textDecoration: 'none',
              border: isLight ? '1px solid #cbd5e1' : '1px solid #374151',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600
            }"
            title="Перейти в классический интерфейс администратора (Handlebars)"
          >
            Классическая админка ↗
          </a>
          <button
            @click="handleLogout"
            :disabled="loggingOut"
            style="background-color: #dc2626; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;"
          >
            {{ loggingOut ? 'Выход...' : 'Выйти' }}
          </button>
        </template>
      </div>
    </header>

    <!-- Main Content -->
    <main :style="isLoginPage ? 'flex: 1; display: flex; align-items: center; justify-content: center; padding: 0; box-sizing: border-box; overflow: hidden;' : 'flex: 1; padding: 24px 32px; max-width: 1400px; width: 100%; margin: 0 auto; box-sizing: border-box;'">
      <router-view />
    </main>

    <!-- Footer -->
    <footer
      :style="{
        padding: isLoginPage ? '10px 24px' : '16px 24px',
        textAlign: 'center',
        fontSize: isLoginPage ? '11px' : '12px',
        color: isLight ? '#64748b' : '#6b7280',
        borderTop: isLight ? '1px solid #e2e8f0' : '1px solid #1f2937',
        backgroundColor: isLight ? 'rgba(255, 255, 255, 0.7)' : 'rgba(10, 16, 29, 0.6)',
        flexShrink: 0
      }"
    >
      NovusWarden Community Edition • Разработано и поддерживается <strong>SGC-NOVUS (System Generations Core Novus)</strong> • AGPL-3.0
    </footer>
  </div>
</template>

<style>
/* Modern Cyber Scrollbar across Admin UI */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(100, 116, 139, 0.3);
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: #38bdf8;
}
* {
  scrollbar-width: thin;
  scrollbar-color: rgba(100, 116, 139, 0.3) transparent;
}
</style>
