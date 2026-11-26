<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, authState, adminUrl } from './api/client.ts';
import { useI18n } from '@shared/i18n.ts';
import ConfirmDialog from '@shared/ConfirmDialog.vue';
import ToastHost from '@shared/ToastHost.vue';
import {
  LayoutDashboard,
  Users,
  Building2,
  CreditCard,
  SlidersHorizontal,
  Activity,
  BookOpen,
  ExternalLink,
  Globe,
  Sun,
  Moon,
  Monitor,
  LogOut,
  Menu,
  X,
  ShieldCheck,
} from 'lucide-vue-next';

const route = useRoute();
const router = useRouter();
const { t, locale, cycleLocale } = useI18n();

const isLoginPage = computed(
  () => route.path === '/login' || (authState.value.needsAuth && route.path !== '/docs')
);

const mobileNavOpen = ref(false);
const themeMode = ref<'system' | 'dark' | 'light'>(
  (localStorage.getItem('novus_theme') as any) || 'system'
);

const isLight = computed(() => {
  if (themeMode.value === 'light') return true;
  if (themeMode.value === 'dark') return false;
  return window.matchMedia && !window.matchMedia('(prefers-color-scheme: dark)').matches;
});

const bannerUrl = computed(() =>
  adminUrl(
    `/vw_static/${isLight.value ? 'novuswarden_banner_white_trans.webp' : 'novuswarden_banner_black_trans.webp'}`
  )
);

const themeIcon = computed(() => {
  if (themeMode.value === 'dark') return Moon;
  if (themeMode.value === 'light') return Sun;
  return Monitor;
});

const themeLabel = computed(() => {
  if (themeMode.value === 'dark') return t('theme.dark');
  if (themeMode.value === 'light') return t('theme.light');
  return t('theme.system');
});

function applyTheme(mode: 'system' | 'dark' | 'light') {
  const isDark =
    mode === 'dark' ||
    (mode === 'system' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', isDark);
  document.documentElement.classList.toggle('light', !isDark);
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
      if (themeMode.value === 'system') applyTheme('system');
    });
  }
});

const navItems = computed(() => [
  { name: t('nav.dashboard'), path: '/', icon: LayoutDashboard },
  { name: t('nav.users'), path: '/users', icon: Users },
  { name: t('nav.organizations'), path: '/organizations', icon: Building2 },
  { name: t('nav.subscriptions'), path: '/subscriptions', icon: CreditCard },
  { name: t('nav.serverSettings'), path: '/settings', icon: SlidersHorizontal },
  { name: t('nav.diagnostics'), path: '/diagnostics', icon: Activity },
  { name: t('nav.docs'), path: '/docs', icon: BookOpen },
]);

const currentPageTitle = computed(() => {
  const match = navItems.value.find((item) => item.path === route.path);
  return match?.name || 'Control Plane';
});

const loggingOut = ref(false);
async function handleLogout() {
  loggingOut.value = true;
  await api.logout();
  loggingOut.value = false;
  mobileNavOpen.value = false;
  await router.push('/login');
}
</script>

<template>
  <div class="cp-shell" :class="{ 'cp-login-mode': isLoginPage }">
    <!-- Login Minimal Header -->
    <header v-if="isLoginPage" class="cp-login-header">
      <router-link to="/" class="cp-brand">
        <img :src="bannerUrl" alt="NovusWarden Control Plane" class="cp-logo" />
        <span class="cp-badge">Control Plane</span>
      </router-link>
      <div class="cp-actions">
        <a :href="adminUrl('/')" target="_blank" class="cp-pill-link">
          <span>{{ t('nav.vault') }}</span>
          <ExternalLink class="w-3.5 h-3.5" />
        </a>
        <button type="button" class="cp-pill" @click="cycleLocale" :title="t('lang.label')">
          <Globe class="w-3.5 h-3.5 text-sky-400" />
          <span>{{ locale.toUpperCase() }}</span>
        </button>
        <button type="button" class="cp-pill" @click="toggleTheme" :title="themeLabel">
          <component :is="themeIcon" class="w-3.5 h-3.5 text-sky-400" />
          <span>{{ themeLabel }}</span>
        </button>
      </div>
    </header>

    <!-- Full Control Plane Workspace: Sidebar + Main -->
    <div v-if="!isLoginPage" class="cp-workspace">
      <!-- Mobile Drawer Backdrop -->
      <div
        v-if="mobileNavOpen"
        class="cp-mobile-backdrop"
        @click="mobileNavOpen = false"
      ></div>

      <!-- Left Navigation Sidebar -->
      <aside class="cp-sidebar" :class="{ open: mobileNavOpen }">
        <div class="cp-sidebar-head">
          <router-link to="/" class="cp-brand" @click="mobileNavOpen = false">
            <img :src="bannerUrl" alt="NovusWarden" class="cp-logo" />
          </router-link>
          <button type="button" class="cp-mobile-close" @click="mobileNavOpen = false">
            <X class="w-4 h-4" />
          </button>
        </div>

        <div class="cp-sidebar-pill">
          <ShieldCheck class="w-3.5 h-3.5 text-sky-400" />
          <span>Control Plane · Enterprise</span>
        </div>

        <nav class="cp-nav">
          <router-link
            v-for="item in navItems"
            :key="item.path"
            :to="item.path"
            custom
            v-slot="{ href, navigate, isActive }"
          >
            <a
              :href="href"
              class="cp-nav-item"
              :class="{ active: isActive }"
              @click="(e) => { navigate(e); mobileNavOpen = false; }"
            >
              <component :is="item.icon" class="w-4 h-4 shrink-0" />
              <span>{{ item.name }}</span>
            </a>
          </router-link>
        </nav>

        <div class="cp-sidebar-footer">
          <a :href="adminUrl('/')" target="_blank" class="cp-nav-item">
            <ExternalLink class="w-4 h-4 shrink-0 text-sky-400" />
            <span>{{ t('nav.vault') }}</span>
          </a>
          <button
            type="button"
            class="cp-logout-btn"
            :disabled="loggingOut"
            @click="handleLogout"
          >
            <LogOut class="w-4 h-4 shrink-0" />
            <span>{{ loggingOut ? '...' : t('nav.logout') }}</span>
          </button>
        </div>
      </aside>

      <!-- Main Column -->
      <div class="cp-main-col">
        <header class="cp-topbar">
          <div class="cp-topbar-left">
            <button
              type="button"
              class="cp-menu-btn"
              aria-label="Меню"
              @click="mobileNavOpen = true"
            >
              <Menu class="w-5 h-5" />
            </button>
            <span class="cp-page-title">{{ currentPageTitle }}</span>
          </div>

          <div class="cp-actions">
            <button type="button" class="cp-pill" @click="cycleLocale" :title="t('lang.label')">
              <Globe class="w-3.5 h-3.5 text-sky-400" />
              <span>{{ locale.toUpperCase() }}</span>
            </button>
            <button type="button" class="cp-pill" @click="toggleTheme" :title="themeLabel">
              <component :is="themeIcon" class="w-3.5 h-3.5 text-sky-400" />
              <span class="cp-pill-text">{{ themeLabel }}</span>
            </button>
          </div>
        </header>

        <main class="cp-content">
          <router-view />
        </main>

        <footer class="cp-footer">
          NovusWarden Control Plane • <strong>SGC-NOVUS</strong> (System Generations Core Novus) • AGPL-3.0
        </footer>
      </div>
    </div>

    <!-- Login View Center -->
    <template v-else>
      <main class="cp-login-main">
        <router-view />
      </main>
      <footer class="cp-footer">
        NovusWarden Control Plane • <strong>SGC-NOVUS</strong> • AGPL-3.0
      </footer>
    </template>

    <ConfirmDialog />
    <ToastHost />
  </div>
</template>

<style scoped>
.cp-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  color: var(--admin-text-main);
}

.cp-login-mode {
  height: 100vh;
  max-height: 100vh;
  overflow: hidden;
}

.cp-login-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  background: var(--admin-header-bg);
  border-bottom: 1px solid var(--admin-card-border);
  backdrop-filter: blur(14px);
}

.cp-login-main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.cp-workspace {
  flex: 1;
  display: flex;
  min-height: 100vh;
}

.cp-sidebar {
  width: 248px;
  flex-shrink: 0;
  background: var(--admin-sidebar-bg);
  border-right: 1px solid var(--admin-card-border);
  display: flex;
  flex-direction: column;
  padding: 16px 12px;
  position: sticky;
  top: 0;
  height: 100vh;
  box-sizing: border-box;
  z-index: 60;
}

.cp-sidebar-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 6px 12px;
}

.cp-brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
}

.cp-logo {
  height: 30px;
  max-width: 170px;
  object-fit: contain;
  display: block;
}

.cp-badge {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 3px 8px;
  border-radius: 6px;
  color: var(--admin-accent);
  background: rgba(56, 189, 248, 0.12);
  border: 1px solid rgba(56, 189, 248, 0.25);
}

.cp-sidebar-pill {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 10px;
  margin: 0 4px 14px;
  border-radius: 9px;
  font-size: 11px;
  font-weight: 600;
  color: var(--admin-text-secondary);
  background: rgba(14, 165, 233, 0.08);
  border: 1px solid rgba(56, 189, 248, 0.2);
}

.cp-nav {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
}

.cp-nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  color: var(--admin-text-secondary);
  border: 1px solid transparent;
  transition: all 0.15s ease;
}

.cp-nav-item:hover {
  background: rgba(148, 163, 184, 0.1);
  color: var(--admin-text-main);
}

.cp-nav-item.active {
  background: rgba(14, 165, 233, 0.16);
  color: var(--admin-accent);
  border-color: rgba(56, 189, 248, 0.32);
}

.cp-sidebar-footer {
  border-top: 1px solid var(--admin-card-border);
  padding-top: 10px;
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cp-logout-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 12px;
  border-radius: 10px;
  border: 1px solid var(--admin-badge-red-border);
  background: var(--admin-badge-red-bg);
  color: var(--admin-badge-red-text);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.cp-logout-btn:hover:not(:disabled) {
  filter: brightness(1.06);
}

.cp-main-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.cp-topbar {
  position: sticky;
  top: 0;
  z-index: 40;
  height: 56px;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--admin-header-bg);
  border-bottom: 1px solid var(--admin-card-border);
  backdrop-filter: blur(14px);
}

.cp-topbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.cp-page-title {
  font-size: 14.5px;
  font-weight: 700;
  color: var(--admin-text-main);
}

.cp-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cp-pill,
.cp-pill-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 11px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  background: var(--admin-surface-bg);
  border: 1px solid var(--admin-card-border);
  color: var(--admin-text-main);
  transition: border-color 0.15s ease;
}

.cp-pill:hover,
.cp-pill-link:hover {
  border-color: var(--admin-accent);
}

.cp-content {
  flex: 1;
  width: 100%;
  max-width: 1360px;
  margin: 0 auto;
  padding: 24px 28px 64px;
  box-sizing: border-box;
}

.cp-footer {
  padding: 12px 24px;
  text-align: center;
  font-size: 11.5px;
  color: var(--admin-text-muted);
  border-top: 1px solid var(--admin-card-border);
}

.cp-menu-btn,
.cp-mobile-close {
  display: none;
  background: transparent;
  border: 1px solid var(--admin-card-border);
  border-radius: 8px;
  color: var(--admin-text-main);
  padding: 5px;
  cursor: pointer;
}

.cp-mobile-backdrop {
  display: none;
}

@media (max-width: 960px) {
  .cp-menu-btn,
  .cp-mobile-close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .cp-sidebar {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    transform: translateX(-105%);
    transition: transform 0.22s ease;
    box-shadow: 20px 0 50px rgba(0, 0, 0, 0.65);
  }

  .cp-sidebar.open {
    transform: translateX(0);
  }

  .cp-mobile-backdrop {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 55;
    background: rgba(2, 6, 23, 0.65);
    backdrop-filter: blur(4px);
  }

  .cp-content {
    padding: 18px 14px 64px;
  }

  .cp-pill-text {
    display: none;
  }
}
</style>
