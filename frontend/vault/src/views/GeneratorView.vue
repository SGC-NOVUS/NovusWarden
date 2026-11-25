<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import {
  generatePassword,
  generatePassphrase,
  evaluatePasswordStrength,
  PasswordScore,
} from '../crypto/generator.ts';
import { useThemeStore } from '../stores/theme.ts';
import {
  Wand2,
  Copy,
  Check,
  RefreshCw,
  ArrowLeft,
  Sliders,
  Shield,
  Key,
  User,
} from 'lucide-vue-next';

const router = useRouter();
const themeStore = useThemeStore();

const mode = ref<'password' | 'passphrase' | 'username'>('password');
const length = ref(20);
const useUpper = ref(true);
const useLower = ref(true);
const useNumbers = ref(true);
const useSpecial = ref(true);
const avoidAmbiguous = ref(false);

const wordsCount = ref(4);
const separator = ref('-');
const capitalize = ref(true);
const includeNumber = ref(true);

const usernameType = ref<'plus' | 'catchall' | 'word'>('plus');
const baseEmail = ref(localStorage.getItem('novus_email') || 'user@example.com');
const catchallDomain = ref('example.com');
const history = ref<string[]>([]);

const generatedResult = ref('');
const copied = ref(false);

function generateUsername(): string {
  const randSuffix = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map((b) => b.toString(36).padStart(2, '0'))
    .join('')
    .slice(0, 6);
  if (usernameType.value === 'plus') {
    const [local, dom] = (baseEmail.value || 'user@example.com').split('@');
    return `${local || 'user'}+${randSuffix}@${dom || 'example.com'}`;
  }
  if (usernameType.value === 'catchall') {
    const word = generatePassphrase({ wordsCount: 2, separator: '.', capitalize: false, includeNumber: false });
    return `${word}.${randSuffix}@${catchallDomain.value || 'example.com'}`;
  }
  const w = generatePassphrase({ wordsCount: 1, separator: '', capitalize: false, includeNumber: true });
  return `${w}_${randSuffix}`;
}

function regenerate() {
  if (mode.value === 'password') {
    generatedResult.value = generatePassword({
      length: length.value,
      uppercase: useUpper.value,
      lowercase: useLower.value,
      numbers: useNumbers.value,
      special: useSpecial.value,
      avoidAmbiguous: avoidAmbiguous.value,
    });
  } else if (mode.value === 'passphrase') {
    generatedResult.value = generatePassphrase({
      wordsCount: wordsCount.value,
      separator: separator.value,
      capitalize: capitalize.value,
      includeNumber: includeNumber.value,
    });
  } else {
    generatedResult.value = generateUsername();
  }
  if (generatedResult.value) {
    history.value = [generatedResult.value, ...history.value.filter((x) => x !== generatedResult.value)].slice(0, 10);
  }
}

const strength = computed<PasswordScore>(() => {
  return evaluatePasswordStrength(generatedResult.value);
});

function copyResult() {
  if (!generatedResult.value) return;
  navigator.clipboard.writeText(generatedResult.value);
  copied.value = true;
  setTimeout(() => {
    copied.value = false;
  }, 2000);
}

// Initial generation
regenerate();
</script>

<template>
  <div class="gen-page">
    <div class="gen-container">
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
            <Wand2 class="w-5 h-5 text-sky-400" />
            <span>Генератор паролей Novus</span>
          </h1>
          <p class="text-xs text-slate-400">
            Криптографическая генерация высокой энтропии (CSPRNG)
          </p>
        </div>
      </div>

      <!-- Mode Switcher Tabs -->
      <div class="mode-tabs mb-4">
        <button
          type="button"
          class="tab-btn"
          :class="{ active: mode === 'password' }"
          @click="mode = 'password'; regenerate();"
        >
          <Key class="w-4 h-4" />
          <span>Случайный пароль</span>
        </button>
        <button
          type="button"
          class="tab-btn"
          :class="{ active: mode === 'passphrase' }"
          @click="mode = 'passphrase'; regenerate();"
        >
          <Shield class="w-4 h-4" />
          <span>Парольная фраза</span>
        </button>
        <button
          type="button"
          class="tab-btn"
          :class="{ active: mode === 'username' }"
          @click="mode = 'username'; regenerate();"
        >
          <User class="w-4 h-4" />
          <span>Имя / Алиас</span>
        </button>
      </div>

      <!-- Result Card -->
      <div class="result-card mb-6">
        <div class="result-display font-mono">
          {{ generatedResult }}
        </div>
        <div class="result-actions">
          <button
            type="button"
            class="action-btn"
            @click="regenerate"
            title="Сгенерировать заново"
          >
            <RefreshCw class="w-4 h-4" />
          </button>
          <button
            type="button"
            class="copy-btn"
            @click="copyResult"
          >
            <component :is="copied ? Check : Copy" class="w-4 h-4 text-white" />
            <span>{{ copied ? 'Скопировано!' : 'Копировать' }}</span>
          </button>
        </div>
      </div>

      <!-- Strength Meter -->
      <div class="strength-card mb-6">
        <div class="flex justify-between items-center text-xs mb-1">
          <span class="font-semibold text-slate-300">Надёжность пароля:</span>
          <span :style="{ color: strength.color }" class="font-bold">
            {{ strength.label }} ({{ strength.entropy }} бит)
          </span>
        </div>
        <div class="flex gap-1.5 h-2 rounded-full overflow-hidden bg-slate-800 mb-2">
          <div
            v-for="i in 5"
            :key="i"
            class="flex-1 transition-all"
            :style="{
              backgroundColor: i - 1 <= strength.score ? strength.color : 'transparent'
            }"
          ></div>
        </div>
        <div class="text-[11px] text-slate-400">
          Примерное время взлома перебором:
          <span class="text-slate-200 font-semibold">{{ strength.estimatedCrackTime }}</span>
        </div>
      </div>

      <!-- Controls: Password Mode -->
      <div v-if="mode === 'password'" class="controls-card">
        <div class="flex justify-between items-center mb-4">
          <span class="text-xs font-semibold text-slate-300">Длина пароля:</span>
          <span class="text-base font-bold text-sky-400">{{ length }} символов</span>
        </div>
        <input
          v-model.number="length"
          type="range"
          min="8"
          max="64"
          class="w-full accent-sky-500 mb-6 cursor-pointer"
          @input="regenerate"
        />

        <div class="grid grid-cols-2 gap-3 text-xs">
          <label class="toggle-opt">
            <input type="checkbox" v-model="useUpper" @change="regenerate" class="cyber-check" />
            <span>Заглавные буквы (A-Z)</span>
          </label>
          <label class="toggle-opt">
            <input type="checkbox" v-model="useLower" @change="regenerate" class="cyber-check" />
            <span>Строчные буквы (a-z)</span>
          </label>
          <label class="toggle-opt">
            <input type="checkbox" v-model="useNumbers" @change="regenerate" class="cyber-check" />
            <span>Цифры (0-9)</span>
          </label>
          <label class="toggle-opt">
            <input type="checkbox" v-model="useSpecial" @change="regenerate" class="cyber-check" />
            <span>Спецсимволы (!@#$%)</span>
          </label>
          <label class="toggle-opt col-span-2">
            <input type="checkbox" v-model="avoidAmbiguous" @change="regenerate" class="cyber-check" />
            <span>Исключить похожие символы (1, l, I, 0, O)</span>
          </label>
        </div>
      </div>

      <!-- Controls: Passphrase Mode -->
      <div v-else-if="mode === 'passphrase'" class="controls-card">
        <div class="flex justify-between items-center mb-4">
          <span class="text-xs font-semibold text-slate-300">Количество слов:</span>
          <span class="text-base font-bold text-sky-400">{{ wordsCount }} слова</span>
        </div>
        <input
          v-model.number="wordsCount"
          type="range"
          min="3"
          max="12"
          class="w-full accent-sky-500 mb-6 cursor-pointer"
          @input="regenerate"
        />

        <div class="grid grid-cols-2 gap-3 text-xs">
          <div class="flex flex-col gap-1">
            <span class="text-slate-400">Разделитель:</span>
            <input
              v-model="separator"
              type="text"
              maxlength="3"
              class="cyber-mini-input"
              @input="regenerate"
            />
          </div>
          <div class="flex flex-col gap-2 justify-center">
            <label class="toggle-opt">
              <input type="checkbox" v-model="capitalize" @change="regenerate" class="cyber-check" />
              <span>С заглавной буквы</span>
            </label>
            <label class="toggle-opt">
              <input type="checkbox" v-model="includeNumber" @change="regenerate" class="cyber-check" />
              <span>Добавить число</span>
            </label>
          </div>
        </div>
      </div>

      <!-- Controls: Username / Alias Mode -->
      <div v-else class="controls-card space-y-3 text-xs">
        <div class="grid grid-cols-3 gap-2">
          <button
            type="button"
            class="py-1.5 px-2 rounded border"
            :class="usernameType === 'plus' ? 'border-sky-500 bg-sky-500/15 text-sky-300' : 'border-slate-700 text-slate-400'"
            @click="usernameType = 'plus'; regenerate()"
          >Plus-адрес</button>
          <button
            type="button"
            class="py-1.5 px-2 rounded border"
            :class="usernameType === 'catchall' ? 'border-sky-500 bg-sky-500/15 text-sky-300' : 'border-slate-700 text-slate-400'"
            @click="usernameType = 'catchall'; regenerate()"
          >Catch-all</button>
          <button
            type="button"
            class="py-1.5 px-2 rounded border"
            :class="usernameType === 'word' ? 'border-sky-500 bg-sky-500/15 text-sky-300' : 'border-slate-700 text-slate-400'"
            @click="usernameType = 'word'; regenerate()"
          >Логин</button>
        </div>
        <div v-if="usernameType === 'plus'">
          <label class="block text-slate-400 mb-1">Базовый Email</label>
          <input v-model="baseEmail" type="email" class="cyber-mini-input w-full" @input="regenerate" />
        </div>
        <div v-else-if="usernameType === 'catchall'">
          <label class="block text-slate-400 mb-1">Домен Catch-All</label>
          <input v-model="catchallDomain" type="text" class="cyber-mini-input w-full" @input="regenerate" />
        </div>
      </div>

      <!-- Generation History -->
      <div v-if="history.length > 1" class="controls-card mt-4">
        <div class="text-xs font-semibold text-slate-400 mb-2">История генерации (последние {{ history.length }})</div>
        <div class="space-y-1.5 max-h-40 overflow-y-auto">
          <div
            v-for="h in history"
            :key="h"
            class="flex items-center justify-between gap-2 text-xs font-mono bg-black/30 px-2.5 py-1.5 rounded border border-slate-800/80"
          >
            <span class="truncate text-slate-300">{{ h }}</span>
            <button
              type="button"
              class="text-sky-400 hover:text-sky-300 shrink-0"
              @click="generatedResult = h; copyResult()"
            >Копировать</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gen-page {
  min-height: 100vh;
  background-color: var(--page-bg, #010811);
  color: var(--text-primary, #f8fafc);
  display: flex;
  justify-content: center;
  padding: 30px 20px;
}

.gen-container {
  width: 100%;
  max-width: 580px;
}

.mode-tabs {
  display: flex;
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(56, 189, 248, 0.2);
  border-radius: 10px;
  padding: 4px;
  gap: 4px;
}

.tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px;
  border-radius: 8px;
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tab-btn.active {
  background: rgba(14, 165, 233, 0.2);
  border: 1px solid rgba(56, 189, 248, 0.35);
  color: #38bdf8;
}

.result-card {
  background: var(--card-bg, #0b1329);
  border: 1px solid var(--card-border, rgba(56, 189, 248, 0.3));
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.result-display {
  font-size: 18px;
  color: #38bdf8;
  word-break: break-all;
  user-select: all;
  min-height: 48px;
  display: flex;
  align-items: center;
}

.result-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.action-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.08);
  border: none;
  border-radius: 8px;
  color: #cbd5e1;
  cursor: pointer;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #ffffff;
}

.copy-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 16px;
  height: 36px;
  background: #0284c7;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
}

.copy-btn:hover {
  background: #0369a1;
}

.strength-card,
.controls-card {
  background: var(--card-bg, #0b1329);
  border: 1px solid var(--card-border, rgba(56, 189, 248, 0.2));
  border-radius: 12px;
  padding: 16px;
}

.toggle-opt {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #cbd5e1;
  cursor: pointer;
}

.cyber-check {
  accent-color: #0284c7;
}

.cyber-mini-input {
  width: 80px;
  height: 32px;
  background: rgba(3, 7, 18, 0.8);
  border: 1px solid #334155;
  border-radius: 6px;
  color: #ffffff;
  padding: 0 8px;
  font-size: 13px;
  outline: none;
}
</style>

