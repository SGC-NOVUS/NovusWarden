<script setup lang="ts">
import { ref } from 'vue';
import { api } from './api/client.ts';

const navItems = [
  { name: 'Dashboard', path: '/' },
  { name: 'Users', path: '/users' },
  { name: 'Organizations', path: '/organizations' },
  { name: 'Settings', path: '/settings' },
  { name: 'Diagnostics', path: '/diagnostics' },
];

const loggingOut = ref(false);

async function handleLogout() {
  loggingOut.value = true;
  await api.logout();
}
</script>

<template>
  <div style="min-height: 100vh; display: flex; flex-direction: column; background-color: #0b0f19;">
    <!-- Top Bar Header -->
    <header style="background-color: #111827; border-bottom: 1px solid #1f2937; padding: 12px 24px; display: flex; align-items: center; justify-content: space-between;">
      <div style="display: flex; align-items: center; gap: 14px;">
        <img
          src="/vw_static/logo-gray.png"
          alt="NovusWarden"
          style="height: 32px; width: auto; object-fit: contain;"
        />
        <div style="display: flex; flex-direction: column;">
          <span style="font-size: 16px; font-weight: 700; color: #f9fafb; letter-spacing: -0.3px;">
            NovusWarden Control Plane
          </span>
          <span style="font-size: 11px; color: #9ca3af; font-weight: 500;">
            SGC-NOVUS Edition • Vue 3 Modern UI
          </span>
        </div>
      </div>

      <!-- Navigation Links -->
      <nav style="display: flex; gap: 8px;">
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
              backgroundColor: isActive ? '#1f2937' : 'transparent',
              color: isActive ? '#38bdf8' : '#9ca3af',
              border: isActive ? '1px solid #374151' : '1px solid transparent',
            }"
          >
            {{ item.name }}
          </a>
        </router-link>
      </nav>

      <!-- Logout Action -->
      <button
        @click="handleLogout"
        :disabled="loggingOut"
        style="background-color: #dc2626; color: white; border: none; padding: 7px 14px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;"
      >
        {{ loggingOut ? 'Exiting...' : 'Log out' }}
      </button>
    </header>

    <!-- Main Content -->
    <main style="flex: 1; padding: 24px 32px; max-width: 1400px; width: 100%; margin: 0 auto; box-sizing: border-box;">
      <router-view />
    </main>

    <!-- Footer -->
    <footer style="padding: 16px 24px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #1f2937;">
      NovusWarden Community Edition • Maintained by <strong>SGC-NOVUS (System Generations Core Novus)</strong> • AGPL-3.0
    </footer>
  </div>
</template>

