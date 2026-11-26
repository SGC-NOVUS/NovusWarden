<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAuthStore } from '../stores/auth.ts';
import { api } from '../api/client.ts';
import { deriveMasterKey, hashMasterPassword, KdfConfig } from '../crypto/kdf.ts';
import {
  parseWebauthnCreationOptions,
  buildWebauthnAttestationPayload,
  formatWebauthnError,
} from '../crypto/webauthn.ts';
import { useI18n } from '@shared/i18n.ts';
import { confirmDialog, notifyToast } from '@shared/dialogs.ts';
import { KeyRound, Plus, Trash2, ShieldCheck, Fingerprint, Lock } from 'lucide-vue-next';

interface WebAuthnKeyItem {
  id: number;
  name: string;
  migrated?: boolean;
}

const authStore = useAuthStore();
const { locale } = useI18n();

const masterPassword = ref('');
const unlocked = ref(false);
const loading = ref(false);
const registering = ref(false);
const keys = ref<WebAuthnKeyItem[]>([]);
const verificationToken = ref('');
const cachedPwdHash = ref('');
const newKeyName = ref('');

const nextKeyId = computed(() => {
  const used = new Set(keys.value.map((k) => k.id));
  for (let id = 1; id <= 50; id++) {
    if (!used.has(id)) return id;
  }
  return keys.value.length + 1;
});

async function computePasswordHash(pwd: string): Promise<string> {
  if (!authStore.savedEmail) throw new Error('Email не найден');
  const pre = await api.prelogin(authStore.savedEmail);
  const cfg: KdfConfig = {
    kdfType: pre.Kdf ?? pre.kdf ?? 0,
    iterations: pre.KdfIterations ?? pre.kdfIterations ?? 600000,
    memory: pre.KdfMemory ?? pre.kdfMemory ?? undefined,
    parallelism: pre.KdfParallelism ?? pre.kdfParallelism ?? undefined,
  };
  const mk = await deriveMasterKey(pwd, authStore.savedEmail, cfg);
  return await hashMasterPassword(mk, pwd);
}

async function refreshWithHash(hash: string) {
  if (!authStore.token) return;
  const res = await api.getWebAuthn2fa(authStore.token, hash);
  const list = res?.webAuthn?.keys || res?.keys || res?.credentials || [];
  keys.value = Array.isArray(list) ? list : [];
  verificationToken.value = res?.userVerificationToken || '';
  unlocked.value = true;
}

async function handleUnlock() {
  if (!masterPassword.value) {
    notifyToast('Введите мастер-пароль для управления ключами FIDO2', 'warning');
    return;
  }
  loading.value = true;
  try {
    const hash = await computePasswordHash(masterPassword.value);
    await refreshWithHash(hash);
    cachedPwdHash.value = hash;
    masterPassword.value = '';
  } catch (err: any) {
    notifyToast(err?.message || 'Неверный мастер-пароль или WebAuthn отключён на сервере', 'error');
  } finally {
    loading.value = false;
  }
}

async function handleRegisterKey() {
  if (!authStore.token || !verificationToken.value) return;
  if (typeof navigator === 'undefined' || !('credentials' in navigator)) {
    notifyToast('WebAuthn не поддерживается текущим браузером', 'error');
    return;
  }
  const label = newKeyName.value.trim() || `Ключ безопасности #${nextKeyId.value}`;
  registering.value = true;
  try {
    const challengeRes = await api.getWebAuthnChallenge(authStore.token, verificationToken.value);
    const rawOptions = challengeRes?.options || challengeRes;
    const publicKey = parseWebauthnCreationOptions(rawOptions);
    const created = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential | null;
    if (!created) throw new Error('Браузер не вернул новый ключ безопасности');

    const deviceResponse = buildWebauthnAttestationPayload(created);
    await api.activateWebAuthn2fa(authStore.token, {
      id: nextKeyId.value,
      name: label,
      deviceResponse,
      userVerificationToken: verificationToken.value,
    });

    newKeyName.value = '';
    if (cachedPwdHash.value) {
      await refreshWithHash(cachedPwdHash.value);
    }
    notifyToast(`Ключ безопасности «${label}» успешно привязан!`, 'success');
  } catch (err: any) {
    notifyToast(err?.name ? formatWebauthnError(err, locale.value) : err?.message || 'Ошибка регистрации ключа', 'error');
  } finally {
    registering.value = false;
  }
}

async function handleDeleteKey(item: WebAuthnKeyItem) {
  if (!authStore.token || !verificationToken.value) return;
  const confirmed = await confirmDialog({
    title: 'Удалить ключ безопасности?',
    message: `Аппаратный ключ / Passkey «${item.name}» будет удалён из двухфакторной защиты аккаунта.`,
    confirmLabel: 'Удалить ключ',
    danger: true,
  });
  if (!confirmed) return;

  loading.value = true;
  try {
    await api.deleteWebAuthn2fa(authStore.token, item.id, verificationToken.value);
    if (cachedPwdHash.value) {
      await refreshWithHash(cachedPwdHash.value);
    } else {
      keys.value = keys.value.filter((k) => k.id !== item.id);
    }
    notifyToast(`Ключ «${item.name}» удалён`, 'success');
  } catch (err: any) {
    notifyToast(err?.message || 'Ошибка удаления ключа', 'error');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <section class="settings-card">
    <div class="flex items-center justify-between gap-2 mb-2">
      <h2 class="card-heading !mb-0">
        <Fingerprint class="w-4 h-4 text-sky-400" />
        <span>Ключи безопасности (FIDO2 / WebAuthn / Passkeys)</span>
      </h2>
      <span
        v-if="unlocked"
        class="text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
        :class="keys.length > 0 ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'"
      >
        {{ keys.length > 0 ? `Активно: ${keys.length}` : 'Не настроено' }}
      </span>
    </div>

    <p class="card-desc">
      Подключите аппаратный токен (YubiKey, SoloKey, Titan) или биометрический Passkey (Windows Hello, Touch ID, Android/iOS) для максимальной защиты от фишинга.
    </p>

    <div v-if="!unlocked" class="flex flex-col sm:flex-row gap-2">
      <input
        v-model="masterPassword"
        type="password"
        placeholder="Введите мастер-пароль для управления ключами FIDO2"
        class="cyber-input flex-1"
        @keyup.enter="handleUnlock"
      />
      <button type="button" class="cyber-btn-secondary shrink-0" :disabled="loading" @click="handleUnlock">
        <Lock class="w-3.5 h-3.5" />
        <span>{{ loading ? 'Проверка...' : 'Открыть ключи FIDO2' }}</span>
      </button>
    </div>

    <div v-else class="space-y-3">
      <!-- Existing keys list -->
      <div v-if="keys.length > 0" class="space-y-2">
        <div
          v-for="item in keys"
          :key="item.id"
          class="flex items-center justify-between gap-3 p-3 rounded-xl bg-black/25 border border-slate-800/80"
        >
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/25 flex items-center justify-center shrink-0">
              <KeyRound class="w-4 h-4 text-sky-400" />
            </div>
            <div class="min-w-0">
              <div class="text-xs font-semibold text-slate-100 truncate">{{ item.name }}</div>
              <div class="text-[11px] text-slate-400 flex items-center gap-2">
                <span>ID #{{ item.id }}</span>
                <span v-if="item.migrated" class="text-amber-400">• Мигрирован с U2F</span>
                <span v-else class="text-emerald-400 flex items-center gap-1">
                  <ShieldCheck class="w-3 h-3" /> FIDO2
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            class="cyber-btn-danger !h-8 !px-2.5 shrink-0"
            :disabled="loading"
            title="Удалить ключ"
            @click="handleDeleteKey(item)"
          >
            <Trash2 class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div v-else class="text-xs text-slate-400 p-3 rounded-xl bg-black/20 border border-dashed border-slate-700/80">
        Пока не привязано ни одного ключа FIDO2 / Passkey.
      </div>

      <!-- Add new key form -->
      <div class="flex flex-col sm:flex-row gap-2 pt-1">
        <input
          v-model="newKeyName"
          type="text"
          placeholder="Название ключа (напр. YubiKey 5C или Touch ID)"
          class="cyber-input flex-1"
          :disabled="registering"
          @keyup.enter="handleRegisterKey"
        />
        <button
          type="button"
          class="cyber-btn-primary shrink-0"
          :disabled="registering"
          @click="handleRegisterKey"
        >
          <Plus class="w-4 h-4" />
          <span>{{ registering ? 'Коснитесь ключа...' : 'Добавить ключ / Passkey' }}</span>
        </button>
      </div>
    </div>
  </section>
</template>
