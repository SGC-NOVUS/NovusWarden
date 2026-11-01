<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import { api, authState } from './api/client.ts';

const route = useRoute();
const logoUrl = ["/vw_static", "vaultwarden-icon.png"].join("/");

const isLoginPage = computed(() => route.path === '/login' || authState.value.needsAuth);

const navItems = [
  { name: 'Сводка', path: '/' },
  { name: 'Пользователи', path: '/users' },
  { name: 'Организации', path: '/organizations' },
  { name: 'Тарифы и подписки', path: '/subscriptions' },
  { name: 'Настройки сервера', path: '/settings' },
  { name: 'Диагностика', path: '/diagnostics' },
];

const loggingOut = ref(false);

async function handleLogout() {
  loggingOut.value = true;
  await api.logout();
  loggingOut.value = false;
}
</script>

<template>
  <div :style="isLoginPage ? 'height: 100vh; max-height: 100vh; overflow: hidden; display: flex; flex-direction: column; background-color: #0b0f19;' : 'min-height: 100vh; display: flex; flex-direction: column; background-color: #0b0f19;'">
    <!-- Top Bar Header (Matches prod Handlebars navbar exactly) -->
    <header style="background-color: #111827; border-bottom: 1px solid #1f2937; padding: 12px 24px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; flex-shrink: 0;">
      <div style="display: flex; align-items: center; gap: 14px;">
        <router-link to="/" style="display: flex; align-items: center; gap: 10px; text-decoration: none;">
          <img
            :src="logoUrl"
            alt="NovusWarden"
            style="height: 28px; width: auto; object-fit: contain;"
          />
          <span style="font-size: 17px; font-weight: 700; color: #f9fafb; letter-spacing: -0.3px;">
            NovusWarden Control Plane
          </span>
        </router-link>
        <span v-if="!isLoginPage" style="background-color: #1e3a8a; color: #93c5fd; font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 4px; font-family: monospace;">
          Vue 3 Modern
        </span>
      </div>

      <!-- Navigation Links (Only shown when authenticated) -->
      <nav v-if="!isLoginPage" style="display: flex; gap: 8px; flex-wrap: wrap;">
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
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              textDecoration: 'none',
              transition: 'all 0.15s ease',
              backgroundColor: isActive ? '#2563eb' : 'transparent',
              color: isActive ? '#ffffff' : '#9ca3af',
              border: isActive ? '1px solid #3b82f6' : '1px solid transparent',
            }"
          >
            {{ item.name }}
          </a>
        </router-link>
      </nav>

      <!-- Right Header Actions (Matches prod navbar) -->
      <div style="display: flex; align-items: center; gap: 14px;">
        <a
          href="/"
          target="_blank"
          style="color: #94a3b8; text-decoration: none; font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 4px; transition: color 0.15s ease;"
          title="Открыть веб-хранилище паролей Bitwarden Web Vault"
        >
          Веб-хранилище
        </a>

        <!-- Moon Icon (Theme switch placeholder, matches prod) -->
        <div
          style="display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 8px; color: #94a3b8; cursor: pointer; transition: background 0.15s;"
          title="Тёмная тема (Dark mode)"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.4 17.8A9 8.6 0 0 1 13 2a10.5 10 0 1 0 9 14.4 9.4 9 0 0 1-3.6 1.4"/>
          </svg>
        </div>

        <template v-if="!isLoginPage">
          <a
            href="/admin/legacy"
            style="background-color: #1f2937; color: #9ca3af; text-decoration: none; border: 1px solid #374151; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600;"
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
    <footer :style="isLoginPage ? 'padding: 10px 24px; text-align: center; font-size: 11px; color: #6b7280; border-top: 1px solid #1f2937; flex-shrink: 0;' : 'padding: 16px 24px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #1f2937;'">
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
  background: #0b0f19;
}
::-webkit-scrollbar-thumb {
  background: #1f2937;
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: #38bdf8;
}
* {
  scrollbar-width: thin;
  scrollbar-color: #1f2937 #0b0f19;
}
</style>
