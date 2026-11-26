<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useThemeStore } from '../stores/theme.ts';
import { Sparkles, CheckCircle2, ShieldCheck, ArrowLeft } from 'lucide-vue-next';

const route = useRoute();
const themeStore = useThemeStore();

const planId = computed(() => String(route.query.plan || 'pro'));
const period = computed(() => (String(route.query.period || 'monthly') === 'yearly' ? 'Годовая оплата' : 'Ежемесячная оплата'));
const customerEmail = computed(() => String(route.query.email || ''));

const planMeta = computed(() => {
  switch (planId.value.toLowerCase()) {
    case 'free':
      return { name: 'Free (Базовый)', features: ['Хранение паролей и заметок', 'Синхронизация устройств', '2FA (TOTP / Email / FIDO2)'] };
    case 'enterprise':
    case 'business':
      return { name: 'Enterprise Unlimited', features: ['Неограниченные организации и коллекции', 'Корпоративный SSO & Duo Security', 'Приоритетный аудит Novus Sentinel'] };
    default:
      return { name: 'Novus Pro', features: ['Расширенное хранилище вложений', 'Novus Sentinel аудит и отчёты', 'Приоритетная синхронизация и Send'] };
  }
});

const brandBannerSrc = computed(() =>
  themeStore.isDark
    ? '/vw_static/novuswarden_banner_black_trans.webp'
    : '/vw_static/novuswarden_banner_white_trans.webp'
);
</script>

<template>
  <div class="min-h-screen flex flex-col justify-between p-5 box-border">
    <header class="max-w-5xl w-full mx-auto flex justify-between items-center">
      <router-link to="/"><img :src="brandBannerSrc" alt="NovusWarden" class="h-9 object-contain" /></router-link>
      <router-link to="/vault" class="cyber-btn-secondary h-8! px-3! no-underline">
        <ArrowLeft class="w-3.5 h-3.5" />
        <span>В хранилище</span>
      </router-link>
    </header>

    <main class="flex-1 flex items-center justify-center py-8">
      <div class="checkout-card">
        <div class="emblem">
          <Sparkles class="w-7 h-7 text-sky-400" />
        </div>
        <span class="badge">
          <ShieldCheck class="w-3.5 h-3.5 text-emerald-400" />
          <span>{{ period }}</span>
        </span>
        <h1 class="text-xl font-bold m-0 mt-2 mb-1">Тариф {{ planMeta.name }}</h1>
        <p v-if="customerEmail" class="text-xs text-sky-400 m-0 mb-4">Аккаунт: {{ customerEmail }}</p>
        <p v-else class="text-xs text-slate-400 m-0 mb-4">Персональное предложение NovusWarden</p>

        <ul class="w-full text-left space-y-2 p-4 rounded-xl bg-black/25 border border-slate-800/80 mb-5 list-none m-0">
          <li v-for="feat in planMeta.features" :key="feat" class="flex items-center gap-2 text-xs text-slate-200">
            <CheckCircle2 class="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{{ feat }}</span>
          </li>
        </ul>

        <p class="text-[11.5px] text-slate-400 leading-relaxed m-0 mb-5">
          Для активации лицензии войдите в свой аккаунт NovusWarden или свяжитесь с администратором кластера SGC-NOVUS.
        </p>

        <router-link to="/login" class="cyber-btn-primary w-full h-10! no-underline">
          Продолжить войти в NovusWarden
        </router-link>
      </div>
    </main>

    <footer class="text-center text-[11px] text-slate-500">
      NovusWarden • System Generations Core Novus
    </footer>
  </div>
</template>

<style scoped>
.checkout-card {
  width: 100%;
  max-width: 440px;
  padding: 28px;
  border-radius: 18px;
  background: var(--card-bg);
  border: 1px solid var(--card-border-strong);
  box-shadow: var(--card-shadow);
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.emblem {
  width: 60px;
  height: 60px;
  border-radius: 16px;
  background: var(--input-bg);
  border: 1px solid rgba(56, 189, 248, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}
.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.28);
}
</style>
