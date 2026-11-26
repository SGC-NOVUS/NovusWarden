<script setup lang="ts">
import { onMounted } from 'vue';
import { useThemeStore } from './stores/theme.ts';

const themeStore = useThemeStore();

onMounted(() => {
  themeStore.applyTheme();
});
</script>

<template>
  <div class="novus-app-root">
    <router-view />
  </div>
</template>

<style>
/* Global CSS variables & Reset */
:root,
html.dark,
body.dark {
  --page-bg: #010811;
  --page-gradient: radial-gradient(ellipse at 50% 25%, #061329 0%, #020916 65%, #01050d 100%);
  --card-bg: rgba(10, 18, 35, 0.88);
  --card-border: rgba(56, 189, 248, 0.28);
  --text-primary: #f8fafc;
  --text-secondary: #94a3b8;
  --text-muted: #64748b;
  --input-bg: rgba(3, 7, 18, 0.85);
  --input-border: #334155;
}

html.light,
body.light {
  --page-bg: #f0f6fb;
  --page-gradient: radial-gradient(ellipse at 50% 25%, #ffffff 0%, #f1f6fb 60%, #e2ecf5 100%);
  --card-bg: rgba(255, 255, 255, 0.95);
  --card-border: rgba(2, 132, 199, 0.28);
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-muted: #64748b;
  --input-bg: #ffffff;
  --input-border: #cbd5e1;
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
  width: 100%;
  min-height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  background-color: var(--page-bg);
  background-image: var(--page-gradient);
  background-attachment: fixed;
  color: var(--text-primary);
  overflow-x: hidden;
  overflow-y: auto;
  user-select: none;
}

.novus-app-root {
  min-height: 100vh;
}

/* Custom Scrollbars */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.2);
  border-radius: 999px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(148, 163, 184, 0.4);
}
</style>

