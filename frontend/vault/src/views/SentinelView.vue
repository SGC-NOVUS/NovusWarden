<script setup lang="ts">
import { computed } from 'vue';
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
  Clock,
  Key,
  ExternalLink,
} from 'lucide-vue-next';

const router = useRouter();
const vaultStore = useVaultStore();

const loginItems = computed(() => {
  return vaultStore.ciphers.filter((c) => c.type === 1 && !c.deletedDate);
});

// 1. Weak Passwords
const weakItems = computed(() => {
  return loginItems.value.filter((item) => {
    const pwd = item.login?.password || '';
    if (!pwd) return false;
    const s = evaluatePasswordStrength(pwd);
    return s.score <= 1; // Very weak or weak
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

// Overall Vault Health Score (0 - 100)
const healthScore = computed(() => {
  if (loginItems.value.length === 0) return 100;
  const total = loginItems.value.length;
  const weakPenalty = (weakItems.value.length / total) * 45;
  const reusedPenalty = (reusedItemsCount.value / total) * 35;
  const missing2FaPenalty = (missing2FaItems.value.length / total) * 20;

  const score = Math.max(0, Math.round(100 - weakPenalty - reusedPenalty - missing2FaPenalty));
  return score;
});

const scoreColor = computed(() => {
  if (healthScore.value >= 80) return '#10b981';
  if (healthScore.value >= 50) return '#f59e0b';
  return '#ef4444';
});

function openItem(id: string) {
  vaultStore.selectedCipherId = id;
  router.push('/vault');
}
</script>

<template>
  <div class="sentinel-page">
    <div class="sentinel-container">
      <!-- Header -->
      <div class="flex items-center gap-3 mb-6">
        <button
          type="button"
          class="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition"
          @click="router.back()"
          title="Назад"
        >
          <ArrowLeft class="w-4 h-4" />
        </button>
        <div>
          <h1 class="text-xl font-bold flex items-center gap-2">
            <Sparkles class="w-5 h-5 text-amber-400" />
            <span>Novus Sentinel • Аудит безопасности</span>
          </h1>
          <p class="text-xs text-slate-400">
            Локальный Zero-Knowledge анализ надёжности и уязвимостей ваших учётных записей
          </p>
        </div>
      </div>

      <!-- Health Score Widget -->
      <div class="score-card mb-6">
        <div class="flex items-center gap-6">
          <div
            class="score-circle"
            :style="{ borderColor: scoreColor, color: scoreColor }"
          >
            {{ healthScore }}%
          </div>
          <div class="flex-1">
            <h2 class="text-base font-bold mb-1">
              {{
                healthScore >= 80
                  ? 'Отличный уровень защиты хранилища'
                  : healthScore >= 50
                  ? 'Требуется внимание к безопасности'
                  : 'Критический уровень уязвимости'
              }}
            </h2>
            <p class="text-xs text-slate-400 leading-relaxed">
              Аудит проверил {{ loginItems.length }} записей логинов.
              Устраните слабые и повторяющиеся пароли для предотвращения взлома методом подбора и credential stuffing.
            </p>
          </div>
        </div>
      </div>

      <!-- Overview Cards Grid -->
      <div class="grid grid-cols-3 gap-4 mb-6">
        <div class="stat-card">
          <div class="flex justify-between items-start mb-2">
            <span class="text-xs text-slate-400">Слабые пароли</span>
            <AlertTriangle class="w-4 h-4 text-rose-400" />
          </div>
          <div class="text-2xl font-bold text-rose-400">{{ weakItems.length }}</div>
        </div>

        <div class="stat-card">
          <div class="flex justify-between items-start mb-2">
            <span class="text-xs text-slate-400">Повторяющиеся</span>
            <Repeat class="w-4 h-4 text-amber-400" />
          </div>
          <div class="text-2xl font-bold text-amber-400">{{ reusedItemsCount }}</div>
        </div>

        <div class="stat-card">
          <div class="flex justify-between items-start mb-2">
            <span class="text-xs text-slate-400">Без 2FA (TOTP)</span>
            <ShieldAlert class="w-4 h-4 text-sky-400" />
          </div>
          <div class="text-2xl font-bold text-sky-400">{{ missing2FaItems.length }}</div>
        </div>
      </div>

      <!-- Section: Weak Passwords -->
      <div v-if="weakItems.length > 0" class="audit-section mb-6">
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
            <div class="flex items-center gap-3">
              <Key class="w-4 h-4 text-slate-400" />
              <div>
                <div class="text-xs font-semibold">{{ item.name }}</div>
                <div class="text-[11px] text-slate-400">{{ item.login?.username || '—' }}</div>
              </div>
            </div>
            <button type="button" class="btn-item-action">
              <span>Изменить</span>
              <ExternalLink class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <!-- Section: Reused Passwords -->
      <div v-if="reusedGroups.length > 0" class="audit-section mb-6">
        <h3 class="audit-section-title text-amber-400 flex items-center gap-2">
          <Repeat class="w-4 h-4" />
          <span>Повторно используемые пароли ({{ reusedGroups.length }} групп)</span>
        </h3>
        <div v-for="(group, idx) in reusedGroups" :key="idx" class="mb-3 last:mb-0">
          <div class="text-[11px] font-semibold text-slate-400 mb-1 px-1">
            Группа {{ idx + 1 }} • {{ group.length }} сервисов с одинаковым паролем:
          </div>
          <div class="audit-list">
            <div
              v-for="item in group"
              :key="item.id"
              class="audit-item"
              @click="openItem(item.id)"
            >
              <div class="flex items-center gap-3">
                <Key class="w-4 h-4 text-slate-400" />
                <div>
                  <div class="text-xs font-semibold">{{ item.name }}</div>
                  <div class="text-[11px] text-slate-400">{{ item.login?.username || '—' }}</div>
                </div>
              </div>
              <button type="button" class="btn-item-action">
                <span>Изменить</span>
                <ExternalLink class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sentinel-page {
  min-height: 100vh;
  background-color: var(--page-bg, #010811);
  color: var(--text-primary, #f8fafc);
  display: flex;
  justify-content: center;
  padding: 30px 20px;
}

.sentinel-container {
  width: 100%;
  max-width: 680px;
}

.score-card {
  background: var(--card-bg, #0b1329);
  border: 1px solid var(--card-border, rgba(56, 189, 248, 0.25));
  border-radius: 14px;
  padding: 20px;
}

.score-circle {
  width: 76px;
  height: 76px;
  border-radius: 50%;
  border: 4px solid;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 800;
  flex-shrink: 0;
}

.stat-card {
  background: var(--card-bg, #0b1329);
  border: 1px solid var(--card-border, rgba(56, 189, 248, 0.2));
  border-radius: 12px;
  padding: 14px;
}

.audit-section {
  background: var(--card-bg, #0b1329);
  border: 1px solid var(--card-border, rgba(56, 189, 248, 0.2));
  border-radius: 12px;
  padding: 16px;
}

.audit-section-title {
  font-size: 13px;
  font-weight: 700;
  margin: 0 0 12px 0;
}

.audit-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.audit-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(3, 7, 18, 0.6);
  border: 1px solid #1e293b;
  cursor: pointer;
  transition: all 0.15s ease;
}

.audit-item:hover {
  background: rgba(14, 165, 233, 0.1);
  border-color: rgba(56, 189, 248, 0.3);
}

.btn-item-action {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #38bdf8;
  background: transparent;
  border: none;
  cursor: pointer;
}
</style>

