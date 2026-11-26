<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useVaultStore } from '../stores/vault.ts';
import { evaluatePasswordStrength } from '../crypto/generator.ts';
import {
  Sparkles,
  ArrowLeft,
  AlertTriangle,
  Repeat,
  ShieldAlert,
  ShieldCheck,
  Globe,
  Key,
  ExternalLink,
} from 'lucide-vue-next';

const props = withDefaults(
  defineProps<{
    modal?: boolean;
  }>(),
  { modal: false }
);

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'select-item', id: string): void;
}>();

const router = useRouter();
const vaultStore = useVaultStore();

const activeFilter = ref<'all' | 'weak' | 'reused' | 'no2fa' | 'http'>('all');

const loginItems = computed(() => {
  return vaultStore.ciphers.filter((c) => c.type === 1 && !c.deletedDate);
});

// 1. Weak Passwords
const weakItems = computed(() => {
  return loginItems.value.filter((item) => {
    const pwd = item.login?.password || '';
    if (!pwd) return false;
    const s = evaluatePasswordStrength(pwd);
    return s.score <= 1;
  });
});

// 2. Reused Passwords
const reusedGroups = computed(() => {
  const pwdMap: Record<string, typeof loginItems.value> = {};
  for (const item of loginItems.value) {
    const pwd = item.login?.password;
    if (pwd) {
      if (!pwdMap[pwd]) pwdMap[pwd] = [];
      pwdMap[pwd].push(item);
    }
  }
  return Object.values(pwdMap).filter((group) => group.length > 1);
});

const reusedItemsCount = computed(() => {
  return reusedGroups.value.reduce((acc, g) => acc + g.length, 0);
});

// 3. Missing 2FA
const missing2FaItems = computed(() => {
  return loginItems.value.filter((item) => !item.login?.totp);
});

// 4. Unsecured HTTP Websites
const insecureHttpItems = computed(() => {
  return loginItems.value.filter((item) =>
    (item.login?.uris || []).some((u) => /^http:\/\//i.test(u.uri || ''))
  );
});

// Overall Vault Health Score (0 - 100)
const healthScore = computed(() => {
  if (loginItems.value.length === 0) return 100;
  const total = loginItems.value.length;
  const weakPenalty = (weakItems.value.length / total) * 40;
  const reusedPenalty = (reusedItemsCount.value / total) * 35;
  const missing2FaPenalty = (missing2FaItems.value.length / total) * 15;
  const httpPenalty = (insecureHttpItems.value.length / total) * 10;
  return Math.max(0, Math.round(100 - weakPenalty - reusedPenalty - missing2FaPenalty - httpPenalty));
});

const scoreColor = computed(() => {
  if (healthScore.value >= 80) return '#10b981';
  if (healthScore.value >= 50) return '#f59e0b';
  return '#ef4444';
});

const ringCircumference = 2 * Math.PI * 32;
const ringOffset = computed(() => ringCircumference * (1 - healthScore.value / 100));

function openItem(id: string) {
  vaultStore.selectedCipherId = id;
  if (props.modal) {
    emit('select-item', id);
    emit('close');
  } else {
    router.push('/vault');
  }
}
</script>

<template>
  <div :class="props.modal ? 'sentinel-modal-root' : 'sentinel-page'">
    <div :class="props.modal ? 'sentinel-modal-inner' : 'sentinel-container'">
      <!-- Standalone Header -->
      <div v-if="!props.modal" class="flex items-center gap-3 mb-5">
        <button
          type="button"
          class="cyber-btn-secondary !p-2 !h-9 !w-9"
          @click="router.push('/vault')"
          title="Назад"
        >
          <ArrowLeft class="w-4 h-4" />
        </button>
        <div>
          <h1 class="text-lg font-bold flex items-center gap-2 m-0">
            <Sparkles class="w-5 h-5 text-amber-400" />
            <span>Novus Sentinel • Аудит безопасности</span>
          </h1>
          <p class="text-xs text-slate-400 m-0 mt-0.5">
            Локальный Zero-Knowledge анализ надёжности и уязвимостей ваших учётных записей
          </p>
        </div>
      </div>

      <!-- Health Score Hero Widget -->
      <div class="score-card mb-4">
        <div class="flex flex-col sm:flex-row items-center gap-5">
          <div class="relative w-20 h-20 flex items-center justify-center shrink-0">
            <svg class="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(148,163,184,0.16)" stroke-width="6" />
              <circle
                cx="40"
                cy="40"
                r="32"
                fill="none"
                :stroke="scoreColor"
                stroke-width="6"
                stroke-linecap="round"
                :stroke-dasharray="ringCircumference"
                :stroke-dashoffset="ringOffset"
                style="transition: stroke-dashoffset 0.5s ease;"
              />
            </svg>
            <span class="absolute text-lg font-extrabold tabular-nums" :style="{ color: scoreColor }">
              {{ healthScore }}%
            </span>
          </div>

          <div class="flex-1 text-center sm:text-left">
            <h2 class="text-sm font-bold mb-1">
              {{
                healthScore >= 80
                  ? 'Высокий уровень защищённости хранилища'
                  : healthScore >= 50
                  ? 'Рекомендуется усилить пароли и 2FA'
                  : 'Обнаружены критические уязвимости паролей'
              }}
            </h2>
            <p class="text-xs text-slate-400 leading-relaxed m-0">
              Проверено <strong class="text-slate-200">{{ loginItems.length }}</strong> учётных записей локально в браузере (Zero-Knowledge). Нажмите на любую запись ниже, чтобы сразу открыть и обновить её в сейфе.
            </p>
          </div>
        </div>
      </div>

      <!-- Interactive KPI Filter Tiles -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
        <button
          type="button"
          class="stat-card"
          :class="{ active: activeFilter === 'weak' }"
          @click="activeFilter = activeFilter === 'weak' ? 'all' : 'weak'"
        >
          <div class="flex justify-between items-center mb-1">
            <span class="text-[11px] font-semibold text-slate-400">Слабые</span>
            <AlertTriangle class="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div class="text-xl font-extrabold text-rose-400 tabular-nums">{{ weakItems.length }}</div>
        </button>

        <button
          type="button"
          class="stat-card"
          :class="{ active: activeFilter === 'reused' }"
          @click="activeFilter = activeFilter === 'reused' ? 'all' : 'reused'"
        >
          <div class="flex justify-between items-center mb-1">
            <span class="text-[11px] font-semibold text-slate-400">Повторы</span>
            <Repeat class="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div class="text-xl font-extrabold text-amber-400 tabular-nums">{{ reusedItemsCount }}</div>
        </button>

        <button
          type="button"
          class="stat-card"
          :class="{ active: activeFilter === 'no2fa' }"
          @click="activeFilter = activeFilter === 'no2fa' ? 'all' : 'no2fa'"
        >
          <div class="flex justify-between items-center mb-1">
            <span class="text-[11px] font-semibold text-slate-400">Без TOTP</span>
            <ShieldAlert class="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div class="text-xl font-extrabold text-sky-400 tabular-nums">{{ missing2FaItems.length }}</div>
        </button>

        <button
          type="button"
          class="stat-card"
          :class="{ active: activeFilter === 'http' }"
          @click="activeFilter = activeFilter === 'http' ? 'all' : 'http'"
        >
          <div class="flex justify-between items-center mb-1">
            <span class="text-[11px] font-semibold text-slate-400">HTTP-сайты</span>
            <Globe class="w-3.5 h-3.5 text-orange-400" />
          </div>
          <div class="text-xl font-extrabold text-orange-400 tabular-nums">{{ insecureHttpItems.length }}</div>
        </button>
      </div>

      <!-- Empty Healthy State -->
      <div
        v-if="weakItems.length === 0 && reusedGroups.length === 0 && insecureHttpItems.length === 0 && activeFilter === 'all'"
        class="audit-section text-center py-8"
      >
        <ShieldCheck class="w-10 h-10 text-emerald-400 mx-auto mb-2" />
        <div class="text-sm font-bold">Критичных проблем не обнаружено</div>
        <div class="text-xs text-slate-400 mt-1">Все пароли уникальны и соответствуют требованиям стойкости.</div>
      </div>

      <!-- Section: Weak Passwords -->
      <div v-if="(activeFilter === 'all' || activeFilter === 'weak') && weakItems.length > 0" class="audit-section mb-4">
        <h3 class="audit-section-title text-rose-400 flex items-center gap-2">
          <AlertTriangle class="w-4 h-4" />
          <span>Слабые или короткие пароли ({{ weakItems.length }})</span>
        </h3>
        <div class="audit-list">
          <div
            v-for="item in weakItems"
            :key="item.id"
            class="audit-item"
            @click="openItem(item.id)"
          >
            <div class="flex items-center gap-2.5 min-w-0">
              <Key class="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <div class="min-w-0">
                <div class="text-xs font-semibold truncate">{{ item.name }}</div>
                <div class="text-[11px] text-slate-400 truncate">{{ item.login?.username || '—' }}</div>
              </div>
            </div>
            <span class="btn-item-action shrink-0">
              <span>Открыть</span>
              <ExternalLink class="w-3 h-3" />
            </span>
          </div>
        </div>
      </div>

      <!-- Section: Reused Passwords -->
      <div v-if="(activeFilter === 'all' || activeFilter === 'reused') && reusedGroups.length > 0" class="audit-section mb-4">
        <h3 class="audit-section-title text-amber-400 flex items-center gap-2">
          <Repeat class="w-4 h-4" />
          <span>Повторно используемые пароли ({{ reusedGroups.length }} групп)</span>
        </h3>
        <div v-for="(group, idx) in reusedGroups" :key="idx" class="mb-3 last:mb-0">
          <div class="text-[11px] font-semibold text-slate-400 mb-1.5 px-1">
            Группа {{ idx + 1 }} • {{ group.length }} сервисов с одинаковым паролем
          </div>
          <div class="audit-list">
            <div
              v-for="item in group"
              :key="item.id"
              class="audit-item"
              @click="openItem(item.id)"
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <Key class="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <div class="min-w-0">
                  <div class="text-xs font-semibold truncate">{{ item.name }}</div>
                  <div class="text-[11px] text-slate-400 truncate">{{ item.login?.username || '—' }}</div>
                </div>
              </div>
              <span class="btn-item-action shrink-0">
                <span>Открыть</span>
                <ExternalLink class="w-3 h-3" />
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Section: Insecure HTTP URLs -->
      <div v-if="(activeFilter === 'all' || activeFilter === 'http') && insecureHttpItems.length > 0" class="audit-section mb-4">
        <h3 class="audit-section-title text-orange-400 flex items-center gap-2">
          <Globe class="w-4 h-4" />
          <span>Незащищённые HTTP-адреса ({{ insecureHttpItems.length }})</span>
        </h3>
        <div class="audit-list">
          <div
            v-for="item in insecureHttpItems"
            :key="item.id"
            class="audit-item"
            @click="openItem(item.id)"
          >
            <div class="flex items-center gap-2.5 min-w-0">
              <Globe class="w-3.5 h-3.5 text-orange-400 shrink-0" />
              <div class="min-w-0">
                <div class="text-xs font-semibold truncate">{{ item.name }}</div>
                <div class="text-[11px] text-slate-400 truncate">{{ item.login?.uris?.[0]?.uri || 'http://' }}</div>
              </div>
            </div>
            <span class="btn-item-action shrink-0">
              <span>Открыть</span>
              <ExternalLink class="w-3 h-3" />
            </span>
          </div>
        </div>
      </div>

      <!-- Section: Missing 2FA (shown when specifically filtered) -->
      <div v-if="activeFilter === 'no2fa' && missing2FaItems.length > 0" class="audit-section">
        <h3 class="audit-section-title text-sky-400 flex items-center gap-2">
          <ShieldAlert class="w-4 h-4" />
          <span>Записи без настроенного TOTP ({{ missing2FaItems.length }})</span>
        </h3>
        <div class="audit-list">
          <div
            v-for="item in missing2FaItems.slice(0, 60)"
            :key="item.id"
            class="audit-item"
            @click="openItem(item.id)"
          >
            <div class="flex items-center gap-2.5 min-w-0">
              <Key class="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <div class="min-w-0">
                <div class="text-xs font-semibold truncate">{{ item.name }}</div>
                <div class="text-[11px] text-slate-400 truncate">{{ item.login?.username || '—' }}</div>
              </div>
            </div>
            <span class="btn-item-action shrink-0">
              <span>Открыть</span>
              <ExternalLink class="w-3 h-3" />
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sentinel-page {
  min-height: 100vh;
  background-color: var(--page-bg, #030712);
  background-image: var(--page-gradient);
  color: var(--text-primary, #f8fafc);
  display: flex;
  justify-content: center;
  padding: 28px 20px 60px 20px;
}

.sentinel-container {
  width: 100%;
  max-width: 760px;
}

.sentinel-modal-root {
  color: var(--text-primary, #f8fafc);
}

.sentinel-modal-inner {
  width: 100%;
}

.score-card,
.audit-section {
  background: var(--card-bg, rgba(13, 22, 41, 0.85));
  border: 1px solid var(--card-border, rgba(56, 189, 248, 0.22));
  border-radius: 14px;
  padding: 16px;
}

.stat-card {
  background: var(--card-bg, rgba(13, 22, 41, 0.85));
  border: 1px solid var(--card-border, rgba(56, 189, 248, 0.2));
  border-radius: 12px;
  padding: 12px 14px;
  text-align: left;
  cursor: pointer;
  transition: all 0.16s ease;
}

.stat-card:hover {
  border-color: rgba(56, 189, 248, 0.45);
  transform: translateY(-1px);
}

.stat-card.active {
  background: var(--active-bg, rgba(14, 165, 233, 0.14));
  border-color: #38bdf8;
  box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.4);
}

.audit-section-title {
  font-size: 13px;
  font-weight: 700;
  margin: 0 0 10px 0;
}

.audit-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.audit-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 9px;
  background: var(--input-bg, rgba(4, 9, 21, 0.65));
  border: 1px solid var(--input-border, rgba(30, 41, 59, 0.9));
  cursor: pointer;
  transition: all 0.15s ease;
}

.audit-item:hover {
  background: var(--active-bg, rgba(14, 165, 233, 0.1));
  border-color: var(--active-border, rgba(56, 189, 248, 0.35));
}

.btn-item-action {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  color: #38bdf8;
}

:global(html.light) .btn-item-action {
  color: #0284c7;
}
</style>
