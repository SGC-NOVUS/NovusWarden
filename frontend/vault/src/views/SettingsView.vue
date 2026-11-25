<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.ts';
import { useVaultStore } from '../stores/vault.ts';
import { useThemeStore } from '../stores/theme.ts';
import { api, getDeviceIdentifier } from '../api/client.ts';
import {
  useI18n,
  LOCALE_OPTIONS,
  normalizeSupportedLocale,
  type SupportedLocale,
} from '@shared/i18n.ts';
import { deriveMasterKey, hashMasterPassword, KdfConfig } from '../crypto/kdf.ts';
import { encrypt, stretchMasterKey } from '../crypto/symmetric.ts';
import { encryptWithPublicKey } from '../crypto/asymmetric.ts';
import {
  Settings,
  ArrowLeft,
  User,
  Shield,
  Palette,
  Download,
  Upload,
  KeyRound,
  Check,
  AlertTriangle,
  Lock,
  Cpu,
  Trash2,
  RefreshCw,
  LogOut,
  Layers,
  Copy,
} from 'lucide-vue-next';

const router = useRouter();
const authStore = useAuthStore();
const vaultStore = useVaultStore();
const themeStore = useThemeStore();
const { locale, t, setLocale } = useI18n();

const activeTab = ref<'account' | 'security' | 'tools' | 'appearance'>('account');

// Toast Feedback
const toastMessage = ref<string | null>(null);
function showToast(msg: string) {
  toastMessage.value = msg;
  setTimeout(() => {
    toastMessage.value = null;
  }, 3500);
}

// 1. Account Profile
const fullName = ref(authStore.profile?.name || '');
const masterPasswordHint = ref('');
const preferredCulture = ref<SupportedLocale>(locale.value);
const isSavingProfile = ref(false);
const securityStamp = ref('s-' + Math.random().toString(36).substring(2, 10));
const fingerprintPhrase = ref('');
const pinInput = ref('');
const timeoutMinutes = ref(authStore.vaultTimeoutMinutes);
const pendingAuthRequests = ref<any[]>([]);
const deleteAccountPassword = ref('');
const isDeletingAccount = ref(false);

onMounted(async () => {
  fingerprintPhrase.value = await authStore.getFingerprintPhrase();
  if (authStore.token) {
    try {
      const p = await api.getAccountProfile(authStore.token);
      if (p) {
        fullName.value = p.name || '';
        if (p.securityStamp) securityStamp.value = p.securityStamp;
        const accLocale = normalizeSupportedLocale(p.culture);
        if (accLocale) {
          preferredCulture.value = accLocale;
        }
      }
      await loadTwoFactorStatus();
      pendingAuthRequests.value = await api.getPendingAuthRequests(authStore.token);
      emergencyTrusted.value = await api.getEmergencyTrusted(authStore.token);
      emergencyGranted.value = await api.getEmergencyGranted(authStore.token);
    } catch {
      // Ignored if offline
    }
  }
});

// Auth Request Approval / Denial
const respondingRequestId = ref<string | null>(null);
async function handleRespondAuthRequest(req: any, approved: boolean) {
  if (!authStore.token || !authStore.userKey) return;
  respondingRequestId.value = req.id;
  try {
    const encryptedKey = approved
      ? await encryptWithPublicKey(authStore.userKey, req.publicKey)
      : 'denied';
    await api.respondAuthRequest(authStore.token, req.id, {
      deviceIdentifier: getDeviceIdentifier(),
      key: encryptedKey,
      requestApproved: approved,
    });
    pendingAuthRequests.value = pendingAuthRequests.value.filter((r) => r.id !== req.id);
    showToast(approved ? 'Вход подтверждён для запросившего устройства' : 'Запрос входа отклонён');
  } catch (err: any) {
    showToast(err?.message || 'Ошибка обработки запроса входа');
  } finally {
    respondingRequestId.value = null;
  }
}

// Change Email Flow
const changeEmailNew = ref('');
const changeEmailPassword = ref('');
const changeEmailToken = ref('');
const changeEmailStep = ref<1 | 2>(1);
const isChangingEmail = ref(false);

async function handleRequestEmailChange() {
  if (!authStore.token || !changeEmailNew.value.trim() || !changeEmailPassword.value) {
    showToast('Укажите новый email и текущий мастер-пароль');
    return;
  }
  isChangingEmail.value = true;
  try {
    const hash = await computePasswordHashForVerification(changeEmailPassword.value);
    await api.requestEmailChangeToken(authStore.token, hash, changeEmailNew.value.trim().toLowerCase());
    changeEmailStep.value = 2;
    showToast('Код подтверждения отправлен на новый адрес электронной почты');
  } catch (err: any) {
    showToast(err?.message || 'Не удалось запросить смену email');
  } finally {
    isChangingEmail.value = false;
  }
}

async function handleConfirmEmailChange() {
  if (!authStore.token || !authStore.userKey || !changeEmailToken.value.trim()) {
    showToast('Введите код подтверждения из письма');
    return;
  }
  isChangingEmail.value = true;
  try {
    const nextEmail = changeEmailNew.value.trim().toLowerCase();
    const pre = await api.prelogin(authStore.savedEmail);
    const kdfCfg: KdfConfig = {
      kdfType: pre.Kdf ?? pre.kdf ?? 0,
      iterations: pre.KdfIterations ?? pre.kdfIterations ?? 600000,
      memory: pre.KdfMemory ?? pre.kdfMemory ?? undefined,
      parallelism: pre.KdfParallelism ?? pre.kdfParallelism ?? undefined,
    };
    const oldMk = await deriveMasterKey(changeEmailPassword.value, authStore.savedEmail, kdfCfg);
    const oldHash = await hashMasterPassword(oldMk, changeEmailPassword.value);
    const newMk = await deriveMasterKey(changeEmailPassword.value, nextEmail, kdfCfg);
    const newHash = await hashMasterPassword(newMk, changeEmailPassword.value);
    const newKeyStr = (await encrypt(authStore.userKey, await stretchMasterKey(newMk))).toString();

    await api.confirmEmailChange(authStore.token, {
      masterPasswordHash: oldHash,
      newMasterPasswordHash: newHash,
      newEmail: nextEmail,
      token: changeEmailToken.value.trim(),
      key: newKeyStr,
    });
    showToast('Email изменён. Выполните повторный вход с новым адресом.');
    authStore.logout();
    router.push('/login');
  } catch (err: any) {
    showToast(err?.message || 'Ошибка подтверждения смены email');
  } finally {
    isChangingEmail.value = false;
  }
}

// Emergency Access
const emergencyTrusted = ref<any[]>([]);
const emergencyGranted = ref<any[]>([]);
const emergencyInviteEmail = ref('');
const emergencyInviteType = ref<number>(0);
const emergencyWaitDays = ref<number>(7);
const isInvitingEmergency = ref(false);

async function handleInviteEmergency() {
  if (!authStore.token || !emergencyInviteEmail.value.trim()) {
    showToast('Укажите email доверенного контакта');
    return;
  }
  isInvitingEmergency.value = true;
  try {
    await api.inviteEmergencyContact(authStore.token, {
      email: emergencyInviteEmail.value.trim().toLowerCase(),
      type: emergencyInviteType.value,
      waitTimeDays: emergencyWaitDays.value,
    });
    emergencyInviteEmail.value = '';
    emergencyTrusted.value = await api.getEmergencyTrusted(authStore.token);
    showToast('Приглашение экстренного контакта отправлено');
  } catch (err: any) {
    showToast(err?.message || 'Не удалось пригласить контакт');
  } finally {
    isInvitingEmergency.value = false;
  }
}

async function handleDeleteEmergency(id: string) {
  if (!authStore.token || !confirm('Удалить доверенный контакт?')) return;
  try {
    await api.deleteEmergencyContact(authStore.token, id);
    emergencyTrusted.value = await api.getEmergencyTrusted(authStore.token);
    showToast('Контакт удалён');
  } catch (err: any) {
    showToast(err?.message || 'Ошибка удаления контакта');
  }
}

// Email 2FA & Recovery Code & WebAuthn overview
const recoveryCode = ref('');
const email2faTarget = ref(authStore.savedEmail || '');
const email2faCode = ref('');
const email2faVerifToken = ref('');
const email2faChallengeSent = ref(false);
const webauthnKeyCount = ref<number | null>(null);

async function handleLoadRecoveryCode() {
  if (!authStore.token || !twoFaPassword.value) {
    showToast('Введите текущий мастер-пароль в блоке 2FA');
    return;
  }
  try {
    const hash = await computePasswordHashForVerification(twoFaPassword.value);
    const res = await api.getRecoveryCode(authStore.token, hash);
    recoveryCode.value = res.code || 'Не сгенерирован (сначала активируйте 2FA)';
  } catch (err: any) {
    showToast(err?.message || 'Ошибка получения кода восстановления');
  }
}

async function handleLoadEmail2faSetup() {
  if (!authStore.token || !twoFaPassword.value) {
    showToast('Введите текущий мастер-пароль в блоке 2FA');
    return;
  }
  try {
    const hash = await computePasswordHashForVerification(twoFaPassword.value);
    const res = await api.getEmail2fa(authStore.token, hash);
    email2faEnabled.value = !!res.email?.enabled;
    email2faTarget.value = res.email?.email || authStore.savedEmail;
    email2faVerifToken.value = res.userVerificationToken || '';
    const wa = await api.getWebAuthn2fa(authStore.token, hash).catch(() => null);
    webauthnKeyCount.value = Array.isArray(wa?.credentials) ? wa.credentials.length : null;
  } catch (err: any) {
    showToast(err?.message || 'Ошибка загрузки Email 2FA');
  }
}

async function handleSendEmail2faSetupCode() {
  if (!authStore.token || !email2faVerifToken.value || !email2faTarget.value.trim()) return;
  try {
    await api.sendEmail2faSetup(authStore.token, email2faTarget.value.trim(), email2faVerifToken.value);
    email2faChallengeSent.value = true;
    showToast('Код подтверждения отправлен на указанный email');
  } catch (err: any) {
    showToast(err?.message || 'Ошибка отправки письма');
  }
}

async function handleActivateEmail2fa() {
  if (!authStore.token || !email2faVerifToken.value || !email2faCode.value.trim()) return;
  try {
    await api.activateEmail2fa(authStore.token, email2faTarget.value.trim(), email2faCode.value.trim(), email2faVerifToken.value);
    email2faEnabled.value = true;
    email2faChallengeSent.value = false;
    email2faCode.value = '';
    email2faVerifToken.value = '';
    showToast('Email 2FA включена');
  } catch (err: any) {
    showToast(err?.message || 'Неверный код Email 2FA');
  }
}

async function handleDisableEmail2fa() {
  if (!authStore.token || !email2faVerifToken.value) return;
  try {
    await api.disableEmail2fa(authStore.token, email2faTarget.value, email2faVerifToken.value);
    email2faEnabled.value = false;
    email2faVerifToken.value = '';
    showToast('Email 2FA отключена');
  } catch (err: any) {
    showToast(err?.message || 'Ошибка отключения Email 2FA');
  }
}

async function handleSaveTimeout() {
  authStore.setVaultTimeout(timeoutMinutes.value);
  showToast('Таймаут автоблокировки обновлён');
}

async function handleSavePin() {
  try {
    await authStore.setPin(pinInput.value);
    pinInput.value = '';
    showToast('PIN-код сохранён для текущей сессии');
  } catch (err: any) {
    showToast(err?.message || 'Ошибка сохранения PIN');
  }
}

async function handleDeleteAccount() {
  if (!deleteAccountPassword.value) {
    showToast('Введите мастер-пароль для удаления аккаунта');
    return;
  }
  if (!confirm('УДАЛИТЬ АККАУНТ НАВСЕГДА? Все ваши данные будут уничтожены без возможности восстановления.')) return;
  isDeletingAccount.value = true;
  try {
    await authStore.deleteAccount(deleteAccountPassword.value);
    router.push('/login');
  } catch (err: any) {
    showToast(err?.message || 'Ошибка удаления аккаунта');
  } finally {
    isDeletingAccount.value = false;
  }
}

// 2FA Authenticator Management
const totp2faEnabled = ref(false);
const email2faEnabled = ref(false);
const twoFaPassword = ref('');
const twoFaSetupKey = ref('');
const twoFaVerificationToken = ref('');
const twoFaConfirmCode = ref('');
const twoFaLoading = ref(false);

async function computePasswordHashForVerification(pwd: string): Promise<string> {
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

async function loadTwoFactorStatus() {
  if (!authStore.token) return;
  const res = await api.getTwoFactor(authStore.token);
  const list = Array.isArray(res?.data) ? res.data : [];
  totp2faEnabled.value = list.some((p: any) => p.type === 0 && p.enabled);
  email2faEnabled.value = list.some((p: any) => p.type === 1 && p.enabled);
}

async function handleLoadAuthenticatorSetup() {
  if (!authStore.token || !twoFaPassword.value) {
    showToast('Введите текущий мастер-пароль');
    return;
  }
  twoFaLoading.value = true;
  try {
    const hash = await computePasswordHashForVerification(twoFaPassword.value);
    const res = await api.getAuthenticator2fa(authStore.token, hash);
    twoFaSetupKey.value = res.authenticator?.key || '';
    twoFaVerificationToken.value = res.userVerificationToken || '';
    totp2faEnabled.value = !!res.authenticator?.enabled;
    twoFaPassword.value = '';
  } catch (err: any) {
    showToast(err?.message || 'Не удалось получить параметры 2FA');
  } finally {
    twoFaLoading.value = false;
  }
}

async function handleActivateAuthenticator() {
  if (!authStore.token || !twoFaSetupKey.value || !twoFaConfirmCode.value.trim()) {
    showToast('Введите 6-значный код из приложения-аутентификатора');
    return;
  }
  twoFaLoading.value = true;
  try {
    await api.activateAuthenticator2fa(authStore.token, {
      key: twoFaSetupKey.value,
      token: twoFaConfirmCode.value.trim(),
      userVerificationToken: twoFaVerificationToken.value,
    });
    totp2faEnabled.value = true;
    twoFaSetupKey.value = '';
    twoFaConfirmCode.value = '';
    twoFaVerificationToken.value = '';
    showToast('Двухфакторная аутентификация (TOTP) успешно включена!');
  } catch (err: any) {
    showToast(err?.message || 'Ошибка активации 2FA');
  } finally {
    twoFaLoading.value = false;
  }
}

async function handleDisableAuthenticator() {
  if (!authStore.token || !twoFaSetupKey.value || !twoFaVerificationToken.value) return;
  twoFaLoading.value = true;
  try {
    await api.disableAuthenticator2fa(authStore.token, {
      key: twoFaSetupKey.value,
      userVerificationToken: twoFaVerificationToken.value,
    });
    totp2faEnabled.value = false;
    twoFaSetupKey.value = '';
    twoFaVerificationToken.value = '';
    showToast('Приложение-аутентификатор (TOTP) отключено');
  } catch (err: any) {
    showToast(err?.message || 'Ошибка отключения 2FA');
  } finally {
    twoFaLoading.value = false;
  }
}

// Import Vault (JSON & CSV)
const isImporting = ref(false);
const importFileInput = ref<HTMLInputElement | null>(null);

async function handleImportFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  isImporting.value = true;
  try {
    const text = await file.text();
    const lowerName = file.name.toLowerCase();
    const isCsv = lowerName.endsWith('.csv') || (!text.trim().startsWith('{') && text.includes(','));
    const res = isCsv
      ? await vaultStore.importVaultCsv(text)
      : await vaultStore.importVaultJson(text);
    showToast(`Импортировано: ${res.importedCiphers} записей, ${res.importedFolders} папок`);
  } catch (err: any) {
    showToast(err?.message || 'Ошибка импорта файла');
  } finally {
    isImporting.value = false;
    input.value = '';
  }
}

async function handleSaveProfile() {
  if (!authStore.token) return;
  isSavingProfile.value = true;
  try {
    await api.updateProfile(authStore.token, {
      name: fullName.value.trim(),
      masterPasswordHint: masterPasswordHint.value.trim() || undefined,
      culture: preferredCulture.value,
    });
    setLocale(preferredCulture.value);
    if (authStore.profile) {
      authStore.profile.name = fullName.value.trim();
      authStore.profile.culture = preferredCulture.value;
    }
    showToast('Профиль успешно обновлён');
  } catch (err: any) {
    showToast(err?.message || 'Ошибка обновления профиля');
  } finally {
    isSavingProfile.value = false;
  }
}

// 2. Change Master Password
const currentPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const newHint = ref('');
const isChangingPassword = ref(false);

async function handleChangePassword() {
  if (!currentPassword.value) {
    showToast('Введите текущий мастер-пароль');
    return;
  }
  if (!newPassword.value || newPassword.value.length < 8) {
    showToast('Новый мастер-пароль должен быть не менее 8 символов');
    return;
  }
  if (newPassword.value !== confirmPassword.value) {
    showToast('Новый пароль и подтверждение не совпадают');
    return;
  }

  isChangingPassword.value = true;
  try {
    await authStore.changePassword(
      currentPassword.value,
      newPassword.value,
      newHint.value.trim() || undefined
    );
    currentPassword.value = '';
    newPassword.value = '';
    confirmPassword.value = '';
    newHint.value = '';
    showToast('Мастер-пароль успешно изменён! Все ключи перешифрованы.');
  } catch (err: any) {
    showToast(err?.message || 'Не удалось сменить мастер-пароль');
  } finally {
    isChangingPassword.value = false;
  }
}

// 3. KDF Parameters
const kdfType = ref<number>(1); // 0=PBKDF2, 1=Argon2id
const pbkdfIterations = ref<number>(600000);
const argonIterations = ref<number>(3);
const argonMemory = ref<number>(64);
const argonParallelism = ref<number>(4);
const kdfMasterPassword = ref('');
const isChangingKdf = ref(false);

async function handleChangeKdf() {
  if (!kdfMasterPassword.value) {
    showToast('Введите текущий мастер-пароль для подтверждения смены KDF');
    return;
  }
  isChangingKdf.value = true;
  try {
    if (kdfType.value === 1) {
      await authStore.changeKdf(
        kdfMasterPassword.value,
        1,
        argonIterations.value,
        argonMemory.value,
        argonParallelism.value
      );
    } else {
      await authStore.changeKdf(
        kdfMasterPassword.value,
        0,
        pbkdfIterations.value
      );
    }
    kdfMasterPassword.value = '';
    showToast('Параметры KDF успешно обновлены!');
  } catch (err: any) {
    showToast(err?.message || 'Ошибка обновления KDF');
  } finally {
    isChangingKdf.value = false;
  }
}

// 4. Deauthorize Sessions
const deauthPassword = ref('');
const isDeauthorizing = ref(false);
const showDeauthConfirm = ref(false);

async function handleDeauthorizeSessions() {
  if (!deauthPassword.value) {
    showToast('Введите мастер-пароль для сброса сессий');
    return;
  }
  isDeauthorizing.value = true;
  try {
    await authStore.deauthorizeSessions(deauthPassword.value);
    showDeauthConfirm.value = false;
    deauthPassword.value = '';
    showToast('Все другие активные сессии успешно сброшены');
  } catch (err: any) {
    showToast(err?.message || 'Ошибка сброса сессий');
  } finally {
    isDeauthorizing.value = false;
  }
}

// 5. Purge Vault (Danger Zone)
const purgePassword = ref('');
const isPurging = ref(false);
const showPurgeModal = ref(false);

async function handlePurgeVault() {
  if (!purgePassword.value) {
    showToast('Введите мастер-пароль для подтверждения очистки');
    return;
  }
  isPurging.value = true;
  try {
    await authStore.purgeVault(purgePassword.value);
    vaultStore.ciphers = [];
    vaultStore.folders = [];
    showPurgeModal.value = false;
    purgePassword.value = '';
    showToast('Хранилище полностью очищено');
  } catch (err: any) {
    showToast(err?.message || 'Ошибка очистки хранилища');
  } finally {
    isPurging.value = false;
  }
}

// 6. Export Vault
function exportVaultJson() {
  const exportData = {
    encrypted: false,
    folders: vaultStore.folders,
    items: vaultStore.ciphers,
    exportDate: new Date().toISOString(),
    generator: 'NovusWarden Web 2026.7.0',
    version: '2026.7.0',
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `novuswarden_vault_export_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Экспорт сохранён в файл JSON');
}

async function exportVaultEncryptedJson() {
  if (!authStore.userKey) {
    showToast('Хранилище заблокировано');
    return;
  }
  const key = authStore.userKey;
  const encOpt = async (val?: string | null) => (val ? (await encrypt(String(val), key)).toString() : null);

  const foldersOut = [];
  for (const f of vaultStore.folders) {
    foldersOut.push({ id: f.id, name: await encOpt(f.name) });
  }

  const itemsOut = [];
  for (const c of vaultStore.ciphers) {
    const entry: Record<string, any> = {
      id: c.id,
      organizationId: c.organizationId ?? null,
      folderId: c.folderId ?? null,
      type: c.type,
      reprompt: c.reprompt ?? 0,
      name: await encOpt(c.name || 'Без названия'),
      notes: await encOpt(c.notes),
      favorite: !!c.favorite,
    };
    if (c.login) {
      const uris = [];
      for (const u of c.login.uris || []) {
        uris.push({ uri: await encOpt(u.uri), match: u.match ?? null });
      }
      entry.login = {
        username: await encOpt(c.login.username),
        password: await encOpt(c.login.password),
        totp: await encOpt(c.login.totp),
        uris,
      };
    }
    itemsOut.push(entry);
  }

  const exportData = {
    encrypted: true,
    encKeyValidation_DO_NOT_EDIT: (await encrypt(crypto.randomUUID(), key)).toString(),
    folders: foldersOut,
    items: itemsOut,
    exportDate: new Date().toISOString(),
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `novuswarden_encrypted_export_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Зашифрованный экспорт (.json) создан');
}

function exportVaultCsv() {
  const headers = ['folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp'];
  const rows = vaultStore.ciphers.map((c) => {
    const fName = vaultStore.folders.find((f) => f.id === c.folderId)?.name || '';
    const uri = c.login?.uris?.[0]?.uri || '';
    const user = c.login?.username || '';
    const pass = c.login?.password || '';
    const totp = c.login?.totp || '';
    return [
      `"${fName.replace(/"/g, '""')}"`,
      c.favorite ? '1' : '0',
      c.type,
      `"${c.name.replace(/"/g, '""')}"`,
      `"${(c.notes || '').replace(/"/g, '""')}"`,
      '""',
      c.reprompt || 0,
      `"${uri.replace(/"/g, '""')}"`,
      `"${user.replace(/"/g, '""')}"`,
      `"${pass.replace(/"/g, '""')}"`,
      `"${totp.replace(/"/g, '""')}"`,
    ].join(',');
  });

  const csvContent = [headers, ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `novuswarden_vault_export_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Экспорт сохранён в CSV');
}
</script>

<template>
  <div class="settings-page">
    <div class="settings-container">
      <!-- Header -->
      <div class="settings-header">
        <button
          type="button"
          class="cyber-btn-secondary !p-2 !h-9 !w-9"
          @click="router.push('/vault')"
          title="Вернуться в хранилище"
        >
          <ArrowLeft class="w-4 h-4" />
        </button>
        <div>
          <h1 class="settings-page-title">
            <Settings class="w-5 h-5 text-sky-400" />
            <span>Настройки аккаунта и безопасности</span>
          </h1>
          <p class="settings-page-subtitle">
            Управление профилем, параметрами нулевого разглашения, KDF и экспортом данных
          </p>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="tabs-nav">
        <button
          type="button"
          class="tab-btn"
          :class="{ active: activeTab === 'account' }"
          @click="activeTab = 'account'"
        >
          <User class="w-4 h-4" />
          <span>Мой профиль</span>
        </button>

        <button
          type="button"
          class="tab-btn"
          :class="{ active: activeTab === 'security' }"
          @click="activeTab = 'security'"
        >
          <Shield class="w-4 h-4" />
          <span>Безопасность и KDF</span>
        </button>

        <button
          type="button"
          class="tab-btn"
          :class="{ active: activeTab === 'tools' }"
          @click="activeTab = 'tools'"
        >
          <Layers class="w-4 h-4" />
          <span>Хранилище и экспорт</span>
        </button>

        <button
          type="button"
          class="tab-btn"
          :class="{ active: activeTab === 'appearance' }"
          @click="activeTab = 'appearance'"
        >
          <Palette class="w-4 h-4" />
          <span>Внешний вид</span>
        </button>
      </div>

      <!-- TAB 1: ACCOUNT PROFILE -->
      <div v-if="activeTab === 'account'" class="tab-content">
        <div class="settings-card">
          <h2 class="card-title flex items-center gap-2">
            <User class="w-4 h-4 text-sky-400" />
            <span>Данные учетной записи</span>
          </h2>

          <div class="space-y-4">
            <div>
              <label class="field-label">Адрес электронной почты</label>
              <input
                type="text"
                :value="authStore.savedEmail"
                disabled
                class="cyber-input !opacity-70 !cursor-not-allowed"
              />
              <span class="field-hint">Используется как соль для вычисления мастер-ключа</span>
            </div>

            <div>
              <label class="field-label">Отображаемое имя</label>
              <input
                v-model="fullName"
                type="text"
                placeholder="Ваше имя или псевдоним"
                class="cyber-input"
              />
            </div>

            <div>
              <label class="field-label">Подсказка для мастер-пароля</label>
              <input
                v-model="masterPasswordHint"
                type="text"
                placeholder="Подсказка, если вы забудете пароль"
                class="cyber-input"
              />
            </div>

            <div>
              <label class="field-label">{{ t('settings.languageLabel') }}</label>
              <select v-model="preferredCulture" class="cyber-input">
                <option v-for="opt in LOCALE_OPTIONS" :key="opt.code" :value="opt.code">
                  {{ opt.label }}
                </option>
              </select>
              <span class="field-hint">{{ t('settings.languageHint') }}</span>
            </div>

            <div class="pt-2">
              <button
                type="button"
                class="cyber-btn-primary"
                :disabled="isSavingProfile"
                @click="handleSaveProfile"
              >
                <Check v-if="!isSavingProfile" class="w-4 h-4" />
                <RefreshCw v-else class="w-4 h-4 animate-spin" />
                <span>{{ isSavingProfile ? 'Сохранение...' : 'Сохранить изменения' }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Security Stamp & Session Control -->
        <div class="settings-card mt-6">
          <h2 class="card-title flex items-center gap-2">
            <KeyRound class="w-4 h-4 text-amber-400" />
            <span>Штамп безопасности и сессии</span>
          </h2>
          <p class="card-desc">
            Штамп безопасности изменяется при сбросе сессий или смене пароля. Все остальные устройства и браузерные расширения будут отключены.
          </p>

          <div class="flex items-center gap-3 p-3 rounded-lg bg-black/30 border border-slate-800 text-xs text-slate-300 font-mono">
            <span class="text-slate-500">Security Stamp:</span>
            <span class="text-sky-400 font-semibold truncate">{{ securityStamp }}</span>
          </div>

          <div v-if="fingerprintPhrase" class="flex items-center gap-3 p-3 rounded-lg bg-black/30 border border-slate-800 text-xs text-slate-300 font-mono mt-2">
            <span class="text-slate-500">Fingerprint Phrase:</span>
            <span class="text-emerald-400 font-semibold">{{ fingerprintPhrase }}</span>
          </div>

          <div class="mt-4">
            <button
              type="button"
              class="cyber-btn-danger"
              @click="showDeauthConfirm = true"
            >
              <LogOut class="w-4 h-4" />
              <span>Завершить все остальные сессии</span>
            </button>
          </div>
        </div>

        <!-- Change Email -->
        <div class="settings-card mt-6">
          <h2 class="card-title flex items-center gap-2">
            <User class="w-4 h-4 text-sky-400" />
            <span>Смена адреса электронной почты</span>
          </h2>
          <p class="card-desc">
            При смене email ваши криптоключи перешифровываются с новой солью (Zero-Knowledge). Текущий адрес: <strong class="text-slate-200">{{ authStore.savedEmail }}</strong>
          </p>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input v-model="changeEmailNew" type="email" placeholder="Новый email" class="cyber-input" :disabled="changeEmailStep === 2" />
            <input v-model="changeEmailPassword" type="password" placeholder="Текущий мастер-пароль" class="cyber-input" :disabled="changeEmailStep === 2" />
          </div>
          <div v-if="changeEmailStep === 2" class="mt-3">
            <input v-model="changeEmailToken" type="text" placeholder="Код подтверждения из письма" class="cyber-input" />
          </div>
          <div class="flex gap-2 mt-3">
            <button
              v-if="changeEmailStep === 1"
              type="button"
              class="cyber-btn-secondary"
              :disabled="isChangingEmail"
              @click="handleRequestEmailChange"
            >
              {{ isChangingEmail ? 'Отправка...' : 'Отправить код на новый email' }}
            </button>
            <template v-else>
              <button type="button" class="cyber-btn-primary" :disabled="isChangingEmail" @click="handleConfirmEmailChange">
                Подтвердить смену email
              </button>
              <button type="button" class="cyber-btn-secondary" @click="changeEmailStep = 1">Назад</button>
            </template>
          </div>
        </div>

        <!-- Emergency Access -->
        <div class="settings-card mt-6">
          <h2 class="card-title flex items-center gap-2">
            <Shield class="w-4 h-4 text-purple-400" />
            <span>Экстренный доступ (Emergency Access)</span>
          </h2>
          <p class="card-desc">
            Назначьте доверенные контакты, которые смогут запросить просмотр или перехват хранилища по истечении периода ожидания.
          </p>
          <div class="flex flex-wrap gap-2 mb-3">
            <input v-model="emergencyInviteEmail" type="email" placeholder="trusted@company.com" class="cyber-input flex-1 min-w-[200px]" />
            <select v-model.number="emergencyInviteType" class="cyber-input w-40">
              <option :value="0">Просмотр (View)</option>
              <option :value="1">Перехват (Takeover)</option>
            </select>
            <select v-model.number="emergencyWaitDays" class="cyber-input w-32">
              <option :value="1">1 день</option>
              <option :value="2">2 дня</option>
              <option :value="7">7 дней</option>
              <option :value="14">14 дней</option>
              <option :value="30">30 дней</option>
            </select>
            <button type="button" class="cyber-btn-primary" :disabled="isInvitingEmergency" @click="handleInviteEmergency">
              Пригласить
            </button>
          </div>
          <div v-if="emergencyTrusted.length" class="space-y-1.5 text-xs mb-2">
            <div class="text-slate-400 font-semibold">Доверенные контакты (кому я выдал доступ):</div>
            <div v-for="c in emergencyTrusted" :key="c.id" class="flex items-center justify-between p-2 rounded bg-black/25 border border-slate-800">
              <span>{{ c.email }} • {{ c.type === 1 ? 'Перехват' : 'Просмотр' }} • {{ c.waitTimeDays }} дн. (статус: {{ c.status }})</span>
              <button type="button" class="text-rose-400 hover:underline" @click="handleDeleteEmergency(c.id)">Удалить</button>
            </div>
          </div>
          <div v-if="emergencyGranted.length" class="space-y-1.5 text-xs">
            <div class="text-slate-400 font-semibold">Выданный мне доступ:</div>
            <div v-for="g in emergencyGranted" :key="g.id" class="p-2 rounded bg-black/25 border border-slate-800">
              {{ g.email }} • {{ g.type === 1 ? 'Перехват' : 'Просмотр' }} • {{ g.waitTimeDays }} дн. (статус: {{ g.status }})
            </div>
          </div>
        </div>

        <!-- Membership Level -->
        <div class="settings-card mt-6">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-xs text-slate-400">Уровень доступа:</div>
              <div class="text-sm font-bold text-emerald-400 flex items-center gap-1.5 mt-0.5">
                <Shield class="w-4 h-4" />
                <span>Novus Enterprise Premium (SGC-NOVUS)</span>
              </div>
            </div>
            <div class="px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              Активна
            </div>
          </div>
        </div>
      </div>

      <!-- TAB 2: SECURITY & KDF -->
      <div v-if="activeTab === 'security'" class="tab-content">
        <!-- Change Master Password -->
        <div class="settings-card">
          <h2 class="card-title flex items-center gap-2">
            <Lock class="w-4 h-4 text-sky-400" />
            <span>Смена мастер-пароля</span>
          </h2>
          <p class="card-desc">
            При смене пароля ваш закрытый ключ пользователя будет автоматически перешифрован в браузере с сохранением всех сохранённых записей.
          </p>

          <div class="space-y-4">
            <div>
              <label class="field-label">Текущий мастер-пароль</label>
              <input
                v-model="currentPassword"
                type="password"
                placeholder="Введите текущий пароль"
                class="cyber-input"
              />
            </div>

            <div>
              <label class="field-label">Новый мастер-пароль</label>
              <input
                v-model="newPassword"
                type="password"
                placeholder="Не менее 8 символов"
                class="cyber-input"
              />
            </div>

            <div>
              <label class="field-label">Подтвердите новый пароль</label>
              <input
                v-model="confirmPassword"
                type="password"
                placeholder="Повторите новый пароль"
                class="cyber-input"
              />
            </div>

            <div>
              <label class="field-label">Новая подсказка (необязательно)</label>
              <input
                v-model="newHint"
                type="text"
                placeholder="Подсказка для нового пароля"
                class="cyber-input"
              />
            </div>

            <div class="pt-2">
              <button
                type="button"
                class="cyber-btn-primary"
                :disabled="isChangingPassword"
                @click="handleChangePassword"
              >
                <RefreshCw v-if="isChangingPassword" class="w-4 h-4 animate-spin" />
                <span>{{ isChangingPassword ? 'Перешифрование ключей...' : 'Сохранить новый пароль' }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- KDF Algorithm Configuration -->
        <div class="settings-card mt-6">
          <h2 class="card-title flex items-center gap-2">
            <Cpu class="w-4 h-4 text-indigo-400" />
            <span>Алгоритм формирования ключа (KDF)</span>
          </h2>
          <p class="card-desc">
            Выберите криптографический алгоритм для защиты от перебора паролей на GPU и ASIC-ускорителях.
          </p>

          <div class="space-y-4">
            <div class="grid grid-cols-2 gap-3">
              <button
                type="button"
                class="kdf-select-card"
                :class="{ active: kdfType === 1 }"
                @click="kdfType = 1"
              >
                <div class="font-bold text-sm">Argon2id</div>
                <div class="text-[11px] text-slate-400 mt-1">
                  Современный стандарт, защищённый от атак по времени и памяти (рекомендуется)
                </div>
              </button>

              <button
                type="button"
                class="kdf-select-card"
                :class="{ active: kdfType === 0 }"
                @click="kdfType = 0"
              >
                <div class="font-bold text-sm">PBKDF2 SHA-256</div>
                <div class="text-[11px] text-slate-400 mt-1">
                  Классический стандарт совместимости Bitwarden
                </div>
              </button>
            </div>

            <!-- Argon2id Settings -->
            <div v-if="kdfType === 1" class="p-3.5 rounded-lg bg-black/20 border border-slate-800 space-y-3">
              <div class="grid grid-cols-3 gap-3">
                <div>
                  <label class="field-label">Итерации</label>
                  <input
                    v-model.number="argonIterations"
                    type="number"
                    min="2"
                    max="10"
                    class="cyber-input"
                  />
                </div>
                <div>
                  <label class="field-label">Память (МБ)</label>
                  <input
                    v-model.number="argonMemory"
                    type="number"
                    min="16"
                    max="1024"
                    class="cyber-input"
                  />
                </div>
                <div>
                  <label class="field-label">Параллелизм</label>
                  <input
                    v-model.number="argonParallelism"
                    type="number"
                    min="1"
                    max="16"
                    class="cyber-input"
                  />
                </div>
              </div>
            </div>

            <!-- PBKDF2 Settings -->
            <div v-if="kdfType === 0" class="p-3.5 rounded-lg bg-black/20 border border-slate-800">
              <label class="field-label">Раунды хеширования PBKDF2</label>
              <input
                v-model.number="pbkdfIterations"
                type="number"
                min="100000"
                max="2000000"
                step="50000"
                class="cyber-input"
              />
              <span class="field-hint">Рекомендуется не менее 600 000 раундов</span>
            </div>

            <div>
              <label class="field-label">Подтверждение мастер-паролем</label>
              <input
                v-model="kdfMasterPassword"
                type="password"
                placeholder="Введите мастер-пароль для смены KDF"
                class="cyber-input"
              />
            </div>

            <button
              type="button"
              class="cyber-btn-primary"
              :disabled="isChangingKdf"
              @click="handleChangeKdf"
            >
              <RefreshCw v-if="isChangingKdf" class="w-4 h-4 animate-spin" />
              <span>{{ isChangingKdf ? 'Пересчёт KDF...' : 'Применить алгоритм KDF' }}</span>
            </button>
          </div>
        </div>

        <!-- Auto-Lock & PIN -->
        <div class="settings-card mt-6">
          <h2 class="card-title flex items-center gap-2">
            <Lock class="w-4 h-4 text-amber-400" />
            <span>Автоблокировка и PIN-код</span>
          </h2>
          <div class="grid grid-cols-2 gap-4 mt-3">
            <div>
              <label class="field-label">Таймаут неактивности</label>
              <select v-model.number="timeoutMinutes" @change="handleSaveTimeout" class="cyber-input">
                <option :value="5">5 минут</option>
                <option :value="15">15 минут</option>
                <option :value="60">1 час</option>
                <option :value="0">Никогда</option>
              </select>
            </div>
            <div>
              <label class="field-label">Быстрая разблокировка PIN</label>
              <div class="flex gap-2">
                <input v-model="pinInput" type="password" placeholder="4+ цифр" class="cyber-input flex-1" />
                <button type="button" class="cyber-btn-secondary" @click="handleSavePin">Задать</button>
                <button v-if="authStore.hasPin" type="button" class="cyber-btn-danger" @click="authStore.clearPin(); showToast('PIN отключён')">Сброс</button>
              </div>
            </div>
          </div>
          <div v-if="pendingAuthRequests.length" class="mt-4 p-3 rounded-lg bg-sky-500/10 border border-sky-500/30 text-xs space-y-2">
            <div class="font-semibold text-sky-300">Ожидающие запросы входа с другого устройства: {{ pendingAuthRequests.length }}</div>
            <div
              v-for="req in pendingAuthRequests"
              :key="req.id"
              class="flex flex-wrap items-center justify-between gap-2 p-2 rounded bg-black/30 border border-slate-800"
            >
              <div class="text-slate-300">
                <div class="font-semibold">{{ req.requestDeviceType }} ({{ req.requestIpAddress }})</div>
                <div class="text-[11px] text-slate-400">{{ req.creationDate }}</div>
              </div>
              <div class="flex gap-1.5">
                <button
                  type="button"
                  class="px-2.5 py-1 rounded bg-emerald-600/80 hover:bg-emerald-500 text-white font-semibold"
                  :disabled="respondingRequestId === req.id"
                  @click="handleRespondAuthRequest(req, true)"
                >
                  Одобрить
                </button>
                <button
                  type="button"
                  class="px-2.5 py-1 rounded bg-rose-600/80 hover:bg-rose-500 text-white font-semibold"
                  :disabled="respondingRequestId === req.id"
                  @click="handleRespondAuthRequest(req, false)"
                >
                  Отклонить
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Two-Factor Authentication (TOTP) -->
        <div class="settings-card mt-6">
          <div class="flex items-center justify-between mb-2">
            <h2 class="card-title flex items-center gap-2 !mb-0">
              <Shield class="w-4 h-4 text-emerald-400" />
              <span>Двухфакторная аутентификация (TOTP)</span>
            </h2>
            <span
              class="text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
              :class="totp2faEnabled ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'"
            >
              {{ totp2faEnabled ? 'Включена' : 'Отключена' }}
            </span>
          </div>
          <p class="card-desc">
            Защитите вход одноразовыми кодами из приложения-аутентификатора (Google Authenticator, Aegis, Ente Auth).
            <span v-if="email2faEnabled" class="text-sky-400 block mt-1">Email 2FA также активен для вашего аккаунта.</span>
          </p>

          <div v-if="!twoFaSetupKey" class="space-y-3">
            <div>
              <label class="field-label">Подтверждение мастер-паролем</label>
              <input
                v-model="twoFaPassword"
                type="password"
                placeholder="Введите мастер-пароль для настройки 2FA"
                class="cyber-input"
              />
            </div>
            <button
              type="button"
              class="cyber-btn-primary"
              :disabled="twoFaLoading"
              @click="handleLoadAuthenticatorSetup"
            >
              <RefreshCw v-if="twoFaLoading" class="w-4 h-4 animate-spin" />
              <span>{{ totp2faEnabled ? 'Управление TOTP 2FA' : 'Настроить приложение-аутентификатор' }}</span>
            </button>
          </div>

          <div v-else class="space-y-4 p-4 rounded-lg bg-black/25 border border-slate-800">
            <div>
              <div class="field-label">Секретный ключ (Base32)</div>
              <div class="flex items-center gap-2">
                <code class="flex-1 text-xs font-mono text-sky-400 bg-black/40 p-2 rounded border border-slate-800 select-all">
                  {{ twoFaSetupKey }}
                </code>
              </div>
              <span class="field-hint">
                Добавьте ключ вручную или через URI: otpauth://totp/NovusWarden:{{ authStore.savedEmail }}?secret={{ twoFaSetupKey }}&amp;issuer=NovusWarden
              </span>
            </div>

            <template v-if="!totp2faEnabled">
              <div>
                <label class="field-label">Код подтверждения из приложения</label>
                <input
                  v-model="twoFaConfirmCode"
                  type="text"
                  placeholder="123456"
                  class="cyber-input"
                />
              </div>
              <div class="flex gap-2">
                <button type="button" class="cyber-btn-primary" :disabled="twoFaLoading" @click="handleActivateAuthenticator">
                  Активировать 2FA
                </button>
                <button type="button" class="cyber-btn-secondary" @click="twoFaSetupKey = ''">
                  Отмена
                </button>
              </div>
            </template>

            <template v-else>
              <div class="flex gap-2">
                <button type="button" class="cyber-btn-danger" :disabled="twoFaLoading" @click="handleDisableAuthenticator">
                  Отключить TOTP 2FA
                </button>
                <button type="button" class="cyber-btn-secondary" @click="twoFaSetupKey = ''">
                  Закрыть
                </button>
              </div>
            </template>
          </div>

          <!-- Email 2FA, WebAuthn & Recovery Code -->
          <div class="mt-5 pt-4 border-t border-slate-800 space-y-3">
            <div class="flex flex-wrap gap-2">
              <button type="button" class="cyber-btn-secondary text-xs" @click="handleLoadRecoveryCode">
                Показать код восстановления (Recovery Code)
              </button>
              <button type="button" class="cyber-btn-secondary text-xs" @click="handleLoadEmail2faSetup">
                Настроить Email 2FA / Проверить ключи FIDO2
              </button>
            </div>
            <div v-if="recoveryCode" class="p-3 rounded bg-amber-950/30 border border-amber-700/40 text-xs">
              <div class="text-amber-300 font-semibold mb-1">Код восстановления 2FA (сохраните в надёжном месте):</div>
              <code class="font-mono text-amber-200 select-all">{{ recoveryCode }}</code>
            </div>
            <div v-if="webauthnKeyCount !== null" class="text-xs text-slate-400">
              Привязанных аппаратных ключей WebAuthn / FIDO2: <strong class="text-slate-200">{{ webauthnKeyCount }}</strong>
            </div>
            <div v-if="email2faVerifToken" class="p-3 rounded bg-black/25 border border-slate-800 space-y-2 text-xs">
              <div class="font-semibold text-sky-300">Email 2FA ({{ email2faEnabled ? 'Включена' : 'Не активна' }})</div>
              <div class="flex flex-wrap gap-2">
                <input v-model="email2faTarget" type="email" class="cyber-input flex-1" placeholder="Email для кодов 2FA" :disabled="email2faEnabled" />
                <button v-if="!email2faEnabled" type="button" class="cyber-btn-secondary" @click="handleSendEmail2faSetupCode">
                  Отправить код
                </button>
                <button v-else type="button" class="cyber-btn-danger" @click="handleDisableEmail2fa">
                  Отключить Email 2FA
                </button>
              </div>
              <div v-if="email2faChallengeSent && !email2faEnabled" class="flex gap-2">
                <input v-model="email2faCode" type="text" class="cyber-input flex-1" placeholder="Код из письма" />
                <button type="button" class="cyber-btn-primary" @click="handleActivateEmail2fa">Подтвердить Email 2FA</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- TAB 3: TOOLS & VAULT -->
      <div v-if="activeTab === 'tools'" class="tab-content">
        <!-- Export Vault -->
        <div class="settings-card">
          <h2 class="card-title flex items-center gap-2">
            <Download class="w-4 h-4 text-sky-400" />
            <span>Экспорт данных хранилища</span>
          </h2>
          <p class="card-desc">
            Создайте резервную копию расшифрованных записей для локального архива или миграции.
          </p>

          <div class="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              class="cyber-btn-primary"
              @click="exportVaultJson"
            >
              <Download class="w-4 h-4" />
              <span>Экспорт в JSON</span>
            </button>

            <button
              type="button"
              class="cyber-btn-secondary"
              @click="exportVaultEncryptedJson"
            >
              <Lock class="w-4 h-4 text-emerald-400" />
              <span>Зашифрованный JSON</span>
            </button>

            <button
              type="button"
              class="cyber-btn-secondary"
              @click="exportVaultCsv"
            >
              <Download class="w-4 h-4" />
              <span>Экспорт в CSV</span>
            </button>
          </div>
        </div>

        <!-- Import Vault -->
        <div class="settings-card mt-6">
          <h2 class="card-title flex items-center gap-2">
            <Upload class="w-4 h-4 text-emerald-400" />
            <span>Импорт данных в хранилище (Bitwarden / NovusWarden JSON и CSV)</span>
          </h2>
          <p class="card-desc">
            Выберите незашифрованный JSON (`encrypted: false`) или CSV-экспорт (Bitwarden / браузер). Все записи и папки шифруются локально перед отправкой на сервер.
          </p>

          <input
            ref="importFileInput"
            type="file"
            accept=".json,.csv,application/json,text/csv"
            class="hidden"
            @change="handleImportFile"
          />
          <button
            type="button"
            class="cyber-btn-primary"
            :disabled="isImporting"
            @click="importFileInput?.click()"
          >
            <Upload class="w-4 h-4" />
            <span>{{ isImporting ? 'Шифрование и импорт...' : 'Выбрать JSON или CSV для импорта' }}</span>
          </button>
        </div>

        <!-- Danger Zone: Purge Vault -->
        <div class="settings-card mt-6 border-rose-900/40 bg-rose-950/10">
          <h2 class="card-title text-rose-400 flex items-center gap-2">
            <AlertTriangle class="w-4 h-4" />
            <span>Опасная зона: Полная очистка</span>
          </h2>
          <p class="card-desc text-slate-400">
            Безвозвратное удаление всех записей, папок, вложений и ключей из вашего персонального хранилища. Это действие невозможно отменить!
          </p>

          <button
            type="button"
            class="cyber-btn-danger mt-3"
            @click="showPurgeModal = true"
          >
            <Trash2 class="w-4 h-4" />
            <span>Очистить хранилище</span>
          </button>

          <div class="mt-5 pt-4 border-t border-rose-900/40 space-y-2">
            <div class="text-xs font-semibold text-rose-400">Полное удаление аккаунта</div>
            <div class="flex gap-2">
              <input v-model="deleteAccountPassword" type="password" placeholder="Мастер-пароль для удаления аккаунта" class="cyber-input flex-1" />
              <button type="button" class="cyber-btn-danger" :disabled="isDeletingAccount" @click="handleDeleteAccount">
                {{ isDeletingAccount ? 'Удаление...' : 'Удалить аккаунт' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- TAB 4: APPEARANCE -->
      <div v-if="activeTab === 'appearance'" class="tab-content">
        <div class="settings-card">
          <h2 class="card-title flex items-center gap-2">
            <Palette class="w-4 h-4 text-sky-400" />
            <span>Тема интерфейса</span>
          </h2>
          <p class="card-desc">
            Выберите визуальный режим оформления: адаптивный системный, высококонтрастный тёмный или чистый светлый.
          </p>

          <div class="grid grid-cols-3 gap-3 pt-2">
            <button
              type="button"
              class="theme-choice"
              :class="{ active: themeStore.mode === 'system' }"
              @click="themeStore.setMode('system')"
            >
              <span class="text-xl">🖥️</span>
              <span class="font-semibold">Системная</span>
              <span class="text-[10px] text-slate-500">Автовыбор ОС</span>
            </button>

            <button
              type="button"
              class="theme-choice"
              :class="{ active: themeStore.mode === 'dark' }"
              @click="themeStore.setMode('dark')"
            >
              <span class="text-xl">🌙</span>
              <span class="font-semibold">Тёмная</span>
              <span class="text-[10px] text-slate-500">Cyber Novus</span>
            </button>

            <button
              type="button"
              class="theme-choice"
              :class="{ active: themeStore.mode === 'light' }"
              @click="themeStore.setMode('light')"
            >
              <span class="text-xl">☀️</span>
              <span class="font-semibold">Светлая</span>
              <span class="text-[10px] text-slate-500">Clean White</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Confirm Deauthorize Modal -->
    <div v-if="showDeauthConfirm" class="modal-backdrop" @click.self="showDeauthConfirm = false">
      <div class="modal-card">
        <h3 class="modal-title">Завершить все остальные сессии?</h3>
        <p class="modal-desc">
          Введите ваш мастер-пароль. Штамп безопасности аккаунта будет сброшен, и все остальные устройства будут принудительно отключены.
        </p>
        <input
          v-model="deauthPassword"
          type="password"
          placeholder="Мастер-пароль"
          class="cyber-input mb-4"
          @keyup.enter="handleDeauthorizeSessions"
        />
        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="cyber-btn-secondary"
            @click="showDeauthConfirm = false"
          >
            Отмена
          </button>
          <button
            type="button"
            class="cyber-btn-danger"
            :disabled="isDeauthorizing"
            @click="handleDeauthorizeSessions"
          >
            {{ isDeauthorizing ? 'Сброс...' : 'Сбросить все сессии' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Confirm Purge Vault Modal -->
    <div v-if="showPurgeModal" class="modal-backdrop" @click.self="showPurgeModal = false">
      <div class="modal-card border-rose-600/40">
        <h3 class="modal-title text-rose-400 flex items-center gap-2">
          <AlertTriangle class="w-5 h-5" />
          <span>Подтвердите очистку хранилища</span>
        </h3>
        <p class="modal-desc">
          ВНИМАНИЕ! Все ваши записи (пароли, карты, заметки, SSH ключи) будут навсегда удалены без возможности восстановления. Введите мастер-пароль:
        </p>
        <input
          v-model="purgePassword"
          type="password"
          placeholder="Мастер-пароль"
          class="cyber-input mb-4"
          @keyup.enter="handlePurgeVault"
        />
        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="cyber-btn-secondary"
            @click="showPurgeModal = false"
          >
            Отмена
          </button>
          <button
            type="button"
            class="cyber-btn-danger"
            :disabled="isPurging"
            @click="handlePurgeVault"
          >
            {{ isPurging ? 'Удаление...' : 'Да, очистить всё' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Toast Notification Popup -->
    <transition name="toast-fade">
      <div v-if="toastMessage" class="toast-popup">
        <Check class="w-4 h-4 text-emerald-400" />
        <span>{{ toastMessage }}</span>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.settings-page {
  min-height: 100vh;
  background-color: var(--page-bg, #010811);
  background-image: var(--page-gradient);
  color: var(--text-primary, #f8fafc);
  display: flex;
  justify-content: center;
  padding: 30px 20px 60px 20px;
  overflow-y: auto;
}

.settings-container {
  width: 100%;
  max-width: 680px;
}

.settings-header {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 24px;
}

.settings-page-title {
  font-size: 19px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  letter-spacing: -0.02em;
}

.settings-page-subtitle {
  font-size: 12px;
  color: var(--text-secondary, #94a3b8);
  margin: 4px 0 0 0;
}

.tabs-nav {
  display: flex;
  gap: 6px;
  padding: 4px;
  background: rgba(3, 7, 18, 0.6);
  border: 1px solid rgba(56, 189, 248, 0.2);
  border-radius: 12px;
  margin-bottom: 24px;
  overflow-x: auto;
}

.tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: 38px;
  padding: 0 12px;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: var(--text-secondary, #94a3b8);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;
}

.tab-btn:hover {
  color: var(--text-primary, #f8fafc);
  background: rgba(255, 255, 255, 0.05);
}

.tab-btn.active {
  background: rgba(14, 165, 233, 0.16);
  color: #38bdf8;
  border: 1px solid rgba(56, 189, 248, 0.35);
  box-shadow: 0 2px 8px rgba(14, 165, 233, 0.15);
}

.settings-card {
  background: var(--card-bg, #0b1329);
  border: 1px solid var(--card-border, rgba(56, 189, 248, 0.22));
  border-radius: 14px;
  padding: 22px;
  box-shadow: var(--card-shadow);
}

.card-title {
  font-size: 14.5px;
  font-weight: 700;
  margin: 0 0 6px 0;
}

.card-desc {
  font-size: 12px;
  color: var(--text-secondary, #94a3b8);
  margin: 0 0 16px 0;
  line-height: 1.5;
}

.field-label {
  display: block;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--text-secondary, #94a3b8);
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.field-hint {
  display: block;
  font-size: 11px;
  color: var(--text-muted, #64748b);
  margin-top: 4px;
}

.kdf-select-card {
  padding: 14px;
  border-radius: 10px;
  background: rgba(3, 7, 18, 0.5);
  border: 1px solid #1e293b;
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease;
}

.kdf-select-card:hover {
  border-color: rgba(56, 189, 248, 0.4);
}

.kdf-select-card.active {
  border-color: #38bdf8;
  background: rgba(14, 165, 233, 0.12);
  box-shadow: 0 0 0 1px #38bdf8;
}

.theme-choice {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 14px 10px;
  border-radius: 10px;
  background: rgba(3, 7, 18, 0.5);
  border: 1px solid #1e293b;
  color: var(--text-secondary);
  font-size: 12.5px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.theme-choice:hover {
  border-color: rgba(56, 189, 248, 0.4);
}

.theme-choice.active {
  background: rgba(14, 165, 233, 0.14);
  border-color: #38bdf8;
  color: #38bdf8;
}

/* Modals */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-card {
  background: var(--card-bg, #0b1329);
  border: 1px solid var(--card-border, rgba(56, 189, 248, 0.3));
  border-radius: 14px;
  padding: 24px;
  width: 100%;
  max-width: 440px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.85);
}

.modal-title {
  font-size: 15px;
  font-weight: 700;
  margin: 0 0 8px 0;
}

.modal-desc {
  font-size: 12px;
  color: var(--text-secondary, #94a3b8);
  margin: 0 0 16px 0;
  line-height: 1.5;
}

/* Toast */
.toast-popup {
  position: fixed;
  bottom: 24px;
  right: 24px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: #0f172a;
  border: 1px solid #38bdf8;
  border-radius: 8px;
  font-size: 12.5px;
  font-weight: 600;
  color: #f8fafc;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.7);
  z-index: 2000;
}

.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: all 0.25s ease;
}

.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
