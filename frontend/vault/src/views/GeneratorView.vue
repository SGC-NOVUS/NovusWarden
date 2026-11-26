<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import {
  generatePassword,
  generatePassphrase,
  evaluatePasswordStrength,
  PasswordScore,
} from '../crypto/generator.ts';
import {
  Wand2,
  Copy,
  Check,
  RefreshCw,
  ArrowLeft,
  Shield,
  Key,
  User,
  History,
} from 'lucide-vue-next';

const props = withDefaults(
  defineProps<{
    modal?: boolean;
  }>(),
  { modal: false }
);

const router = useRouter();

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
    history.value = [generatedResult.value, ...history.value.filter((x) => x !== generatedResult.value)].slice(0, 12);
  }
}

const coloredChars = computed(() =>
  Array.from(generatedResult.value).map((ch) => {
    if (/[0-9]/.test(ch)) return { ch, cls: 'char-num' };
    if (/[^A-Za-z0-9]/.test(ch)) return { ch, cls: 'char-sym' };
    return { ch, cls: 'char-alpha' };
  })
);

const strength = computed<PasswordScore>(() => {
  return evaluatePasswordStrength(generatedResult.value);
});

function copyResult(text = generatedResult.value) {
  if (!text) return;
  navigator.clipboard.writeText(text);
  copied.value = true;
  setTimeout(() => {
    copied.value = false;
  }, 1800);
}

regenerate();
</script>

<template>
  <div :class="props.modal ? 'gen-modal-root' : 'gen-page'">
    <div :class="props.modal ? 'gen-modal-inner' : 'gen-container'">
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
            <Wand2 class="w-5 h-5 text-indigo-400" />
            <span>Генератор паролей Novus</span>
          </h1>
          <p class="text-xs text-slate-400 m-0 mt-0.5">
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
          <Key class="w-3.5 h-3.5" />
          <span>Пароль</span>
        </button>
        <button
          type="button"
          class="tab-btn"
          :class="{ active: mode === 'passphrase' }"
          @click="mode = 'passphrase'; regenerate();"
        >
          <Shield class="w-3.5 h-3.5" />
          <span>Парольная фраза</span>
        </button>
        <button
          type="button"
          class="tab-btn"
          :class="{ active: mode === 'username' }"
          @click="mode = 'username'; regenerate();"
        >
          <User class="w-3.5 h-3.5" />
          <span>Логин / Алиас</span>
        </button>
      </div>

      <!-- Generated Output Card -->
      <div class="result-card mb-4">
        <div
          class="result-display font-mono"
          title="Нажмите, чтобы скопировать"
          @click="copyResult()"
        >
          <span v-for="(item, idx) in coloredChars" :key="idx" :class="item.cls">{{ item.ch }}</span>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/70">
          <div class="flex items-center gap-2 text-xs">
            <span
              class="px-2 py-0.5 rounded-full text-[11px] font-bold"
              :style="{ color: strength.color, backgroundColor: `${strength.color}20`, border: `1px solid ${strength.color}45` }"
            >
              {{ strength.label }} · {{ strength.entropy }} бит
            </span>
            <span class="text-[11px] text-slate-400 hidden sm:inline">
              Взлом: <strong class="text-slate-200">{{ strength.estimatedCrackTime }}</strong>
            </span>
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              class="cyber-btn-secondary !h-8 !px-3"
              @click="regenerate"
              title="Сгенерировать заново"
            >
              <RefreshCw class="w-3.5 h-3.5" />
              <span>Обновить</span>
            </button>
            <button
              type="button"
              class="cyber-btn-primary !h-8 !px-3.5"
              @click="copyResult()"
            >
              <component :is="copied ? Check : Copy" class="w-3.5 h-3.5 text-white" />
              <span>{{ copied ? 'Скопировано' : 'Копировать' }}</span>
            </button>
          </div>
        </div>

        <div class="flex gap-1 h-1.5 rounded-full overflow-hidden bg-slate-800/80">
          <div
            v-for="i in 5"
            :key="i"
            class="flex-1 transition-all duration-300"
            :style="{
              backgroundColor: i - 1 <= strength.score ? strength.color : 'transparent'
            }"
          ></div>
        </div>
      </div>

      <!-- Controls: Password Mode -->
      <div v-if="mode === 'password'" class="controls-card">
        <div class="flex flex-wrap justify-between items-center gap-2 mb-3">
          <span class="text-xs font-semibold text-slate-300">Длина пароля</span>
          <div class="flex items-center gap-1.5">
            <button
              v-for="preset in [16, 20, 24, 32]"
              :key="preset"
              type="button"
              class="preset-pill"
              :class="{ active: length === preset }"
              @click="length = preset; regenerate()"
            >
              {{ preset }}
            </button>
            <span class="text-sm font-bold text-sky-400 ml-1 tabular-nums">{{ length }}</span>
          </div>
        </div>
        <input
          v-model.number="length"
          type="range"
          min="8"
          max="64"
          class="w-full accent-sky-500 mb-4 cursor-pointer"
          @input="regenerate"
        />

        <div class="grid grid-cols-2 gap-2.5 text-xs">
          <label class="toggle-opt">
            <input type="checkbox" v-model="useUpper" @change="regenerate" class="cyber-check" />
            <span>Заглавные (A–Z)</span>
          </label>
          <label class="toggle-opt">
            <input type="checkbox" v-model="useLower" @change="regenerate" class="cyber-check" />
            <span>Строчные (a–z)</span>
          </label>
          <label class="toggle-opt">
            <input type="checkbox" v-model="useNumbers" @change="regenerate" class="cyber-check" />
            <span>Цифры (0–9)</span>
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
        <div class="flex justify-between items-center mb-3">
          <span class="text-xs font-semibold text-slate-300">Количество слов</span>
          <span class="text-sm font-bold text-sky-400">{{ wordsCount }} слов</span>
        </div>
        <input
          v-model.number="wordsCount"
          type="range"
          min="3"
          max="12"
          class="w-full accent-sky-500 mb-4 cursor-pointer"
          @input="regenerate"
        />

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div class="flex flex-col gap-1">
            <span class="text-slate-400 font-semibold">Разделитель</span>
            <input
              v-model="separator"
              type="text"
              maxlength="3"
              class="cyber-input !h-9"
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
            class="preset-pill !h-9"
            :class="{ active: usernameType === 'plus' }"
            @click="usernameType = 'plus'; regenerate()"
          >Plus-адрес</button>
          <button
            type="button"
            class="preset-pill !h-9"
            :class="{ active: usernameType === 'catchall' }"
            @click="usernameType = 'catchall'; regenerate()"
          >Catch-all</button>
          <button
            type="button"
            class="preset-pill !h-9"
            :class="{ active: usernameType === 'word' }"
            @click="usernameType = 'word'; regenerate()"
          >Случайный логин</button>
        </div>
        <div v-if="usernameType === 'plus'">
          <label class="block text-slate-400 font-semibold mb-1">Базовый Email</label>
          <input v-model="baseEmail" type="email" class="cyber-input !h-9" @input="regenerate" />
        </div>
        <div v-else-if="usernameType === 'catchall'">
          <label class="block text-slate-400 font-semibold mb-1">Домен Catch-All</label>
          <input v-model="catchallDomain" type="text" class="cyber-input !h-9" @input="regenerate" />
        </div>
      </div>

      <!-- Generation History -->
      <div v-if="history.length > 1" class="controls-card mt-4">
        <div class="flex items-center justify-between text-xs font-semibold text-slate-400 mb-2">
          <span class="flex items-center gap-1.5">
            <History class="w-3.5 h-3.5 text-sky-400" />
            <span>История генерации ({{ history.length }})</span>
          </span>
        </div>
        <div class="space-y-1.5 max-h-36 overflow-y-auto pr-1">
          <div
            v-for="h in history"
            :key="h"
            class="flex items-center justify-between gap-2 text-xs font-mono bg-black/25 px-2.5 py-1.5 rounded-lg border border-slate-800/80"
          >
            <span class="truncate text-slate-300 select-all">{{ h }}</span>
            <button
              type="button"
              class="text-sky-400 hover:text-sky-300 shrink-0 font-sans font-semibold"
              @click="generatedResult = h; copyResult(h)"
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
  background-color: var(--page-bg, #030712);
  background-image: var(--page-gradient);
  color: var(--text-primary, #f8fafc);
  display: flex;
  justify-content: center;
  padding: 28px 20px 60px 20px;
}

.gen-container {
  width: 100%;
  max-width: 620px;
}

.gen-modal-root {
  color: var(--text-primary, #f8fafc);
}

.gen-modal-inner {
  width: 100%;
}

.mode-tabs {
  display: flex;
  background: var(--input-bg, rgba(4, 9, 21, 0.8));
  border: 1px solid var(--card-border, rgba(56, 189, 248, 0.2));
  border-radius: 12px;
  padding: 4px;
  gap: 4px;
}

.tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: 36px;
  border-radius: 8px;
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-secondary, #94a3b8);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.18s ease;
}

.tab-btn:hover {
  color: var(--text-primary, #f8fafc);
  background: var(--hover-bg, rgba(255, 255, 255, 0.05));
}

.tab-btn.active {
  background: var(--active-bg, rgba(14, 165, 233, 0.16));
  border-color: var(--active-border, rgba(56, 189, 248, 0.35));
  color: #38bdf8;
}

:global(html.light) .tab-btn.active {
  color: #0284c7;
}

.result-card,
.controls-card {
  background: var(--card-bg, rgba(13, 22, 41, 0.85));
  border: 1px solid var(--card-border, rgba(56, 189, 248, 0.22));
  border-radius: 14px;
  padding: 16px;
}

.result-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.result-display {
  font-size: 19px;
  line-height: 1.45;
  letter-spacing: 0.03em;
  word-break: break-all;
  user-select: all;
  cursor: pointer;
  min-height: 52px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--input-bg, rgba(4, 9, 21, 0.85));
  border: 1px solid var(--input-border, #334155);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
}

.char-alpha {
  color: var(--text-primary, #f8fafc);
}

.char-num {
  color: #38bdf8;
  font-weight: 700;
}

.char-sym {
  color: #f472b6;
  font-weight: 700;
}

:global(html.light) .char-num {
  color: #0284c7;
}

:global(html.light) .char-sym {
  color: #db2777;
}

.preset-pill {
  padding: 3px 9px;
  border-radius: 7px;
  font-size: 11.5px;
  font-weight: 600;
  border: 1px solid var(--input-border, #334155);
  background: var(--input-bg, rgba(4, 9, 21, 0.6));
  color: var(--text-secondary, #94a3b8);
  cursor: pointer;
  transition: all 0.15s ease;
}

.preset-pill.active,
.preset-pill:hover {
  border-color: #38bdf8;
  background: var(--active-bg, rgba(14, 165, 233, 0.14));
  color: #38bdf8;
}

:global(html.light) .preset-pill.active,
:global(html.light) .preset-pill:hover {
  color: #0284c7;
}

.toggle-opt {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 9px;
  background: var(--input-bg, rgba(4, 9, 21, 0.55));
  border: 1px solid var(--input-border, rgba(51, 65, 85, 0.7));
  color: var(--text-primary, #e2e8f0);
  cursor: pointer;
  transition: border-color 0.15s ease;
}

.toggle-opt:hover {
  border-color: rgba(56, 189, 248, 0.4);
}

.cyber-check {
  accent-color: #0284c7;
}
</style>
