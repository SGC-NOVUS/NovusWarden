// Adaptive System / Dark / Light Theme Store
// NovusWarden Enterprise Standard

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export type ThemeMode = 'system' | 'dark' | 'light';

export const useThemeStore = defineStore('theme', () => {
  const mode = ref<ThemeMode>(
    (localStorage.getItem('novus_theme') as ThemeMode) || 'system'
  );

  const systemIsDark = ref(
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  if (typeof window !== 'undefined' && window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      systemIsDark.value = e.matches;
      if (mode.value === 'system') {
        applyTheme();
      }
    });
  }

  const isDark = computed(() => {
    if (mode.value === 'system') {
      return systemIsDark.value;
    }
    return mode.value === 'dark';
  });

  function applyTheme() {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const body = document.body;

    if (isDark.value) {
      root.classList.remove('light', 'theme_light');
      root.classList.add('dark', 'theme_dark');
      root.setAttribute('data-theme', 'dark');
      if (body) {
        body.classList.remove('light', 'theme_light');
        body.classList.add('dark', 'theme_dark');
        body.setAttribute('data-theme', 'dark');
      }
    } else {
      root.classList.remove('dark', 'theme_dark');
      root.classList.add('light', 'theme_light');
      root.setAttribute('data-theme', 'light');
      if (body) {
        body.classList.remove('dark', 'theme_dark');
        body.classList.add('light', 'theme_light');
        body.setAttribute('data-theme', 'light');
      }
    }
  }

  function setMode(newMode: ThemeMode) {
    mode.value = newMode;
    localStorage.setItem('novus_theme', newMode);
    applyTheme();
  }

  function cycleTheme() {
    const modes: ThemeMode[] = ['system', 'dark', 'light'];
    const idx = modes.indexOf(mode.value);
    const next = modes[(idx + 1) % modes.length];
    setMode(next);
  }

  // Initial application
  applyTheme();

  return {
    mode,
    isDark,
    setMode,
    cycleTheme,
    applyTheme,
  };
});

