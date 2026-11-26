<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.ts';
import { useVaultStore, DecryptedCipher, DecryptedFolder } from '../stores/vault.ts';
import { useThemeStore } from '../stores/theme.ts';
import { generateTotp, TotpResult, parseTotpSecret } from '../crypto/totp.ts';
import { generatePassword } from '../crypto/generator.ts';
import { generateRsaSshKey } from '../crypto/ssh.ts';
import { notificationsClient } from '../services/notifications.ts';
import { useI18n } from '@shared/i18n.ts';
import ToolModalShell from '../components/ToolModalShell.vue';
import SettingsView from './SettingsView.vue';
import GeneratorView from './GeneratorView.vue';
import SentinelView from './SentinelView.vue';
import SendView from './SendView.vue';
import {
  Key,
  Shield,
  Building2,
  Globe,
  FileText,
  CreditCard,
  User,
  Star,
  Trash2,
  Folder,
  FolderPlus,
  Plus,
  Search,
  RefreshCw,
  Lock,
  LogOut,
  Copy,
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  Wand2,
  RotateCcw,
  Sun,
  Moon,
  Monitor,
  Sparkles,
  Settings,
  Send,
  Sliders,
  ChevronDown,
  Clock,
  Terminal,
  KeyRound,
  Download,
  Edit2,
  Paperclip,
  Upload,
  History,
  Archive,
  Share2,
  Landmark,
  BookOpen,
} from 'lucide-vue-next';

const router = useRouter();
const authStore = useAuthStore();
const vaultStore = useVaultStore();
const themeStore = useThemeStore();
const { t, locale: uiLocale, cycleLocale } = useI18n();

// UI States
const isEditing = ref(false);
const editForm = ref<Partial<DecryptedCipher>>({});
const showPassword = ref(false);
const showCardCode = ref(false);
const showCardNumber = ref(false);
const showSshPrivateKey = ref(false);
const showDetailSshPrivate = ref(false);
const showHistory = ref(false);
const showHiddenFields = ref<Record<number, boolean>>({});
const toastMessage = ref<string | null>(null);

// Bulk selection
const selectedIds = ref<string[]>([]);
const bulkMoveFolderId = ref<string | null>(null);

// Master password reprompt modal
const repromptAction = ref<(() => void) | null>(null);
const repromptPassword = ref('');
const repromptError = ref('');
const repromptVerifying = ref(false);

// Attachment upload
const attachmentInputRef = ref<HTMLInputElement | null>(null);
const uploadingAttachment = ref(false);

// Dropdowns & Modals & Refs
const searchInputRef = ref<HTMLInputElement | null>(null);
const showNewItemMenu = ref(false);
const showProfileMenu = ref(false);
const showFolderModal = ref(false);
const editingFolderId = ref<string | null>(null);
const newFolderName = ref('');

// Share / Collections modal
const showShareModal = ref(false);
const shareOrgId = ref('');
const shareCollectionIds = ref<string[]>([]);
const isSharingCipher = ref(false);

const nestedFolders = computed(() => {
  return [...vaultStore.folders]
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    .map((f) => {
      const parts = f.name.split('/').filter(Boolean);
      const depth = Math.max(0, parts.length - 1);
      const displayName = parts.length > 0 ? parts[parts.length - 1] : f.name;
      return { ...f, depth, displayName };
    });
});

function openShareModal() {
  if (!vaultStore.selectedCipher) return;
  const current = vaultStore.selectedCipher;
  shareOrgId.value = current.organizationId || authStore.organizations[0]?.id || '';
  shareCollectionIds.value = [...(current.collectionIds || [])];
  showShareModal.value = true;
}

const availableOrgCollections = computed(() => {
  if (!shareOrgId.value) return vaultStore.collections;
  return vaultStore.collections.filter((c) => c.organizationId === shareOrgId.value);
});

async function handleConfirmShare() {
  if (!vaultStore.selectedCipher) return;
  isSharingCipher.value = true;
  try {
    if (vaultStore.selectedCipher.organizationId) {
      await vaultStore.updateCipherCollections(vaultStore.selectedCipher.id, shareCollectionIds.value);
      showToast('Коллекции записи обновлены');
    } else {
      if (!shareOrgId.value) {
        showToast('Выберите организацию');
        return;
      }
      await vaultStore.shareCipherToOrg(vaultStore.selectedCipher.id, shareOrgId.value, shareCollectionIds.value);
      showToast('Запись перенесена в организацию');
    }
    showShareModal.value = false;
  } catch (err: any) {
    showToast(err?.message || 'Не удалось обновить организацию/коллекции');
  } finally {
    isSharingCipher.value = false;
  }
}

async function handleToggleArchive() {
  if (!vaultStore.selectedCipher) return;
  try {
    if (vaultStore.selectedCipher.archivedDate) {
      await vaultStore.unarchiveCipher(vaultStore.selectedCipher.id);
      showToast('Запись возвращена из архива');
    } else {
      await vaultStore.archiveCipher(vaultStore.selectedCipher.id);
      showToast('Запись перемещена в архив');
    }
  } catch (err: any) {
    showToast(err?.message || 'Ошибка изменения статуса архива');
  }
}

// TOTP Live State
const liveTotp = ref<TotpResult | null>(null);
let totpTimer: any = null;

// Copy Toast Helper
let toastTimeout: any = null;
function showToast(msg: string) {
  toastMessage.value = msg;
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toastMessage.value = null;
  }, 2800);
}

function copyToClipboard(text?: string | null, label = 'Текст', requireRepromptCheck = false) {
  if (!text) return;
  const doCopy = () => {
    navigator.clipboard.writeText(text);
    showToast(`${label} скопирован в буфер обмена`);
  };
  if (requireRepromptCheck && vaultStore.selectedCipher?.reprompt === 1) {
    runWithReprompt(doCopy);
  } else {
    doCopy();
  }
}

function runWithReprompt(action: () => void) {
  if (vaultStore.selectedCipher?.reprompt === 1) {
    repromptPassword.value = '';
    repromptError.value = '';
    repromptAction.value = action;
  } else {
    action();
  }
}

async function confirmReprompt() {
  if (!repromptPassword.value) {
    repromptError.value = 'Введите мастер-пароль';
    return;
  }
  repromptVerifying.value = true;
  repromptError.value = '';
  try {
    const ok = await authStore.verifyMasterPassword(repromptPassword.value);
    if (!ok) {
      repromptError.value = 'Неверный мастер-пароль';
      return;
    }
    const fn = repromptAction.value;
    repromptAction.value = null;
    repromptPassword.value = '';
    if (fn) fn();
  } catch (err: any) {
    repromptError.value = err?.message || 'Ошибка проверки пароля';
  } finally {
    repromptVerifying.value = false;
  }
}

function toggleSelectId(id: string) {
  if (selectedIds.value.includes(id)) {
    selectedIds.value = selectedIds.value.filter((x) => x !== id);
  } else {
    selectedIds.value = [...selectedIds.value, id];
  }
}

async function handleBulkDelete(permanent = false) {
  if (selectedIds.value.length === 0) return;
  const msg = permanent
    ? `Удалить навсегда выбранные (${selectedIds.value.length}) записи?`
    : `Переместить выбранные (${selectedIds.value.length}) записи в корзину?`;
  if (!confirm(msg)) return;
  await vaultStore.bulkDelete(selectedIds.value, permanent);
  selectedIds.value = [];
  showToast(permanent ? 'Выбранные записи удалены навсегда' : 'Записи перемещены в корзину');
}

async function handleBulkRestore() {
  if (selectedIds.value.length === 0) return;
  await vaultStore.bulkRestore(selectedIds.value);
  selectedIds.value = [];
  showToast('Записи восстановлены из корзины');
}

async function handleBulkMove() {
  if (selectedIds.value.length === 0) return;
  await vaultStore.bulkMoveFolder(selectedIds.value, bulkMoveFolderId.value);
  selectedIds.value = [];
  showToast('Записи перемещены в папку');
}

async function handleEmptyTrash() {
  if (!confirm('Очистить всю корзину безвозвратно?')) return;
  await vaultStore.emptyTrash();
  selectedIds.value = [];
  showToast('Корзина очищена');
}

async function handleAttachmentUpload(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file || !vaultStore.selectedCipher) return;
  uploadingAttachment.value = true;
  try {
    await vaultStore.uploadAttachment(vaultStore.selectedCipher.id, file);
    showToast(`Вложение «${file.name}» зашифровано и загружено`);
  } catch (err: any) {
    showToast(err?.message || 'Ошибка загрузки вложения');
  } finally {
    uploadingAttachment.value = false;
    input.value = '';
  }
}

async function handleAttachmentDownload(att: any) {
  if (!vaultStore.selectedCipher) return;
  try {
    await vaultStore.downloadAttachment(vaultStore.selectedCipher, att);
  } catch (err: any) {
    showToast(err?.message || 'Ошибка скачивания вложения');
  }
}

async function handleAttachmentDelete(attId: string) {
  if (!vaultStore.selectedCipher || !confirm('Удалить вложение?')) return;
  try {
    await vaultStore.deleteAttachment(vaultStore.selectedCipher.id, attId);
    showToast('Вложение удалено');
  } catch (err: any) {
    showToast(err?.message || 'Ошибка удаления вложения');
  }
}

// Brand Assets
const brandBannerSrc = computed(() => {
  return themeStore.isDark
    ? '/vw_static/novuswarden_banner_black_trans.webp'
    : '/vw_static/novuswarden_banner_white_trans.webp';
});

const openStorageSrc = computed(() => {
  return themeStore.isDark
    ? '/vw_static/novuswarden_storage_open_black_crisp.webp'
    : '/vw_static/novuswarden_storage_open_white_crisp.webp';
});

const themeIcon = computed(() => {
  if (themeStore.mode === 'dark') return Moon;
  if (themeStore.mode === 'light') return Sun;
  return Monitor;
});

const themeLabel = computed(() => {
  if (themeStore.mode === 'dark') return 'Тёмная';
  if (themeStore.mode === 'light') return 'Светлая';
  return 'Система';
});

const userInitials = computed(() => {
  const email = authStore.savedEmail || 'User';
  const name = authStore.profile?.name || email;
  return name.slice(0, 2).toUpperCase();
});

// Selection & Edit Handling
function selectCipher(id: string) {
  isEditing.value = false;
  showPassword.value = false;
  showCardCode.value = false;
  showCardNumber.value = false;
  showDetailSshPrivate.value = false;
  showHistory.value = false;
  showHiddenFields.value = {};
  vaultStore.selectedCipherId = id;
}

function startCreate(type: number = 1) {
  vaultStore.selectedCipherId = null;
  isEditing.value = true;
  showNewItemMenu.value = false;
  showPassword.value = false;
  showSshPrivateKey.value = false;

  editForm.value = {
    type,
    name: '',
    notes: '',
    favorite: false,
    reprompt: 0,
    folderId: vaultStore.selectedFilter.folderId || null,
    fields: [],
    login: type === 1 ? { username: '', password: '', totp: '', uris: [{ uri: '', match: null }] } : undefined,
    card: type === 3 ? { cardholderName: '', brand: '', number: '', expMonth: '', expYear: '', code: '' } : undefined,
    identity: type === 4 ? { firstName: '', lastName: '', email: '', phone: '', company: '' } : undefined,
    sshKey: type === 5 ? { privateKey: '', publicKey: '', keyFingerprint: '' } : undefined,
    bankAccount: type === 6 ? { bankName: '', nameOnAccount: '', accountType: '', accountNumber: '', iban: '', swiftCode: '', routingNumber: '' } : undefined,
    driversLicense: type === 7 ? { firstName: '', lastName: '', licenseNumber: '', issuingCountry: '', issuingState: '', expirationDate: '' } : undefined,
    passport: type === 8 ? { surname: '', givenName: '', passportNumber: '', issuingCountry: '', nationality: '', expirationDate: '' } : undefined,
  };
}

// Auto-populate type-specific fields if user switches type dropdown while editing
watch(
  () => editForm.value.type,
  (newType) => {
    if (!isEditing.value || !newType) return;
    if (newType === 1 && !editForm.value.login) {
      editForm.value.login = { username: '', password: '', totp: '', uris: [{ uri: '' }] };
    } else if (newType === 3 && !editForm.value.card) {
      editForm.value.card = { cardholderName: '', brand: '', number: '', expMonth: '', expYear: '', code: '' };
    } else if (newType === 4 && !editForm.value.identity) {
      editForm.value.identity = { firstName: '', lastName: '', email: '', phone: '', company: '' };
    } else if (newType === 5 && !editForm.value.sshKey) {
      editForm.value.sshKey = { privateKey: '', publicKey: '', keyFingerprint: '' };
    } else if (newType === 6 && !editForm.value.bankAccount) {
      editForm.value.bankAccount = { bankName: '', nameOnAccount: '', accountType: '', accountNumber: '', iban: '', swiftCode: '' };
    } else if (newType === 7 && !editForm.value.driversLicense) {
      editForm.value.driversLicense = { firstName: '', lastName: '', licenseNumber: '', issuingCountry: '', issuingState: '', expirationDate: '' };
    } else if (newType === 8 && !editForm.value.passport) {
      editForm.value.passport = { surname: '', givenName: '', passportNumber: '', issuingCountry: '', nationality: '', expirationDate: '' };
    }
  }
);

function startEdit() {
  if (!vaultStore.selectedCipher) return;
  const openEdit = () => {
    const current = vaultStore.selectedCipher!;
    editForm.value = JSON.parse(JSON.stringify(current));
    if (!editForm.value.fields) editForm.value.fields = [];
    if (editForm.value.type === 1 && editForm.value.login && (!editForm.value.login.uris || editForm.value.login.uris.length === 0)) {
      editForm.value.login.uris = [{ uri: '', match: null }];
    } else if (editForm.value.type === 5 && !editForm.value.sshKey) {
      editForm.value.sshKey = { privateKey: '', publicKey: '', keyFingerprint: '' };
    }
    isEditing.value = true;
  };
  runWithReprompt(openEdit);
}

function cancelEdit() {
  isEditing.value = false;
  if (!vaultStore.selectedCipherId && vaultStore.filteredCiphers.length > 0) {
    vaultStore.selectedCipherId = vaultStore.filteredCiphers[0].id;
  }
}

async function handleSave() {
  if (!editForm.value.name?.trim()) {
    showToast('Укажите название записи');
    return;
  }
  try {
    const saved = await vaultStore.saveCipher(editForm.value);
    isEditing.value = false;
    showToast('Запись сохранена');
  } catch (err: any) {
    showToast(err?.message || 'Ошибка сохранения');
  }
}

async function handleDelete(permanent = false) {
  if (!vaultStore.selectedCipher) return;
  const id = vaultStore.selectedCipher.id;
  try {
    if (permanent) {
      await vaultStore.permanentDeleteCipher(id);
      showToast('Запись окончательно удалена');
    } else {
      await vaultStore.deleteCipher(id);
      showToast('Запись перемещена в корзину');
    }
  } catch (err: any) {
    showToast(err?.message || 'Ошибка удаления');
  }
}

async function handleRestore() {
  if (!vaultStore.selectedCipher) return;
  try {
    await vaultStore.restoreCipher(vaultStore.selectedCipher.id);
    showToast('Запись восстановлена');
  } catch (err: any) {
    showToast(err?.message || 'Ошибка восстановления');
  }
}

async function handleToggleFavorite(id: string) {
  try {
    await vaultStore.toggleFavorite(id);
  } catch (err: any) {
    showToast(err?.message || 'Не удалось обновить избранное');
  }
}

// Folders Management
function openCreateFolderModal() {
  editingFolderId.value = null;
  newFolderName.value = '';
  showFolderModal.value = true;
}

function openRenameFolder(folder: DecryptedFolder) {
  editingFolderId.value = folder.id;
  newFolderName.value = folder.name;
  showFolderModal.value = true;
}

async function handleCreateOrUpdateFolder() {
  const name = newFolderName.value.trim();
  if (!name) return;
  try {
    if (editingFolderId.value) {
      await vaultStore.renameFolder(editingFolderId.value, name);
      showToast('Папка переименована');
    } else {
      await vaultStore.createFolder(name);
      showToast('Папка создана');
    }
    showFolderModal.value = false;
    newFolderName.value = '';
    editingFolderId.value = null;
  } catch (err: any) {
    showToast(err?.message || 'Ошибка сохранения папки');
  }
}

async function handleDeleteFolder(id: string) {
  if (!confirm('Удалить эту папку? Записи в папке сохранятся в хранилище.')) return;
  try {
    await vaultStore.deleteFolder(id);
    if (vaultStore.selectedFilter.type === 'folder' && vaultStore.selectedFilter.folderId === id) {
      vaultStore.selectedFilter = { type: 'all' };
    }
    showToast('Папка удалена');
  } catch (err: any) {
    showToast(err?.message || 'Ошибка удаления папки');
  }
}

// Password Generator Fill
function fillGeneratedPassword() {
  const pwd = generatePassword({ length: 20, uppercase: true, lowercase: true, numbers: true, special: true });
  if (editForm.value.login) {
    editForm.value.login.password = pwd;
    showToast('Сгенерирован надежный мастер-пароль');
  }
}

// Client-Side SSH Key Generator Action
async function generateSshKeyAction() {
  try {
    const email = authStore.savedEmail || 'novuswarden';
    const pair = await generateRsaSshKey(2048, email);
    if (!editForm.value.sshKey) {
      editForm.value.sshKey = {};
    }
    editForm.value.sshKey.privateKey = pair.privateKey;
    editForm.value.sshKey.publicKey = pair.publicKey;
    editForm.value.sshKey.keyFingerprint = pair.fingerprint;
    showSshPrivateKey.value = true;
    showToast('Сгенерирован SSH ключ RSA-2048 и отпечаток SHA-256');
  } catch (err: any) {
    showToast('Ошибка генерации ключа: ' + err.message);
  }
}

// Update Live TOTP
async function updateTotp() {
  const cipher = vaultStore.selectedCipher;
  if (!cipher || cipher.type !== 1 || !cipher.login?.totp) {
    liveTotp.value = null;
    return;
  }
  try {
    const parsed = parseTotpSecret(cipher.login.totp);
    liveTotp.value = await generateTotp({
      secret: parsed.secret,
      digits: parsed.digits,
      period: parsed.period,
      algorithm: parsed.algorithm,
    });
  } catch {
    liveTotp.value = null;
  }
}

watch(
  () => vaultStore.selectedCipher?.login?.totp,
  () => {
    updateTotp();
  }
);

function handleGlobalKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    searchInputRef.value?.focus();
  } else if (e.key === 'Escape') {
    showNewItemMenu.value = false;
    showProfileMenu.value = false;
  }
}

onMounted(async () => {
  window.addEventListener('keydown', handleGlobalKeydown);
  window.addEventListener('mousemove', authStore.resetIdleTimer, { passive: true });
  window.addEventListener('keydown', authStore.resetIdleTimer, { passive: true });
  await vaultStore.sync();
  if (authStore.token) {
    notificationsClient.connect(authStore.token, {
      onSync: () => {
        vaultStore.sync().catch(() => {});
      },
      onLogOut: () => {
        authStore.logout();
        router.push('/login');
      },
      onAuthRequest: () => {
        showToast('Новый запрос входа с другого устройства (см. Настройки → Безопасность)');
      },
    });
  }
  updateTotp();
  totpTimer = setInterval(updateTotp, 1000);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown);
  window.removeEventListener('mousemove', authStore.resetIdleTimer);
  window.removeEventListener('keydown', authStore.resetIdleTimer);
  notificationsClient.disconnect();
  if (totpTimer) clearInterval(totpTimer);
});

function handleLock() {
  authStore.lock();
  router.push('/login');
}

function handleLogout() {
  authStore.logout();
  router.push('/login');
}

// Tool Workspace Modals (Settings, Generator, Sentinel Audit, Novus Send)
type ToolModalName = 'settings' | 'generator' | 'sentinel' | 'send';
type SettingsTabName = 'account' | 'security' | 'tools' | 'appearance';
const activeToolModal = ref<ToolModalName | null>(null);
const settingsInitialTab = ref<SettingsTabName>('account');

function openToolModal(tool: ToolModalName, tab: SettingsTabName = 'account') {
  showProfileMenu.value = false;
  showNewItemMenu.value = false;
  if (tool === 'settings') {
    settingsInitialTab.value = tab;
  }
  activeToolModal.value = tool;
}

function goToSettings(tab: SettingsTabName = 'account') {
  openToolModal('settings', tab);
}
</script>

<template>
  <div class="vault-app">
    <!-- Top Header -->
    <header class="app-header">
      <div class="header-left">
        <img :src="brandBannerSrc" alt="NovusWarden" class="header-logo" />
      </div>

      <!-- Global Vault Search -->
      <div class="header-search">
        <Search class="search-icon" />
        <input
          ref="searchInputRef"
          v-model="vaultStore.searchQuery"
          type="text"
          placeholder="Поиск по хранилищу (Ctrl + K)..."
          class="search-input"
        />
      </div>

      <!-- Header Actions -->
      <div class="header-actions">
        <!-- New Item Dropdown -->
        <div class="relative">
          <button
            type="button"
            class="cyber-btn-primary !h-8 !px-3"
            @click="showNewItemMenu = !showNewItemMenu"
          >
            <Plus class="w-4 h-4" />
            <span>Новый элемент</span>
            <ChevronDown class="w-3.5 h-3.5 opacity-80" />
          </button>

          <div v-if="showNewItemMenu" class="dropdown-popover right-0">
            <button type="button" class="dropdown-item" @click="startCreate(1)">
              <Key class="w-4 h-4 text-emerald-400" />
              <span>Логин и пароль</span>
            </button>
            <button type="button" class="dropdown-item" @click="startCreate(3)">
              <CreditCard class="w-4 h-4 text-indigo-400" />
              <span>Банковская карта</span>
            </button>
            <button type="button" class="dropdown-item" @click="startCreate(2)">
              <FileText class="w-4 h-4 text-teal-400" />
              <span>Защищённая заметка</span>
            </button>
            <button type="button" class="dropdown-item" @click="startCreate(4)">
              <User class="w-4 h-4 text-purple-400" />
              <span>Личные данные</span>
            </button>
            <button type="button" class="dropdown-item" @click="startCreate(5)">
              <Terminal class="w-4 h-4 text-amber-400" />
              <span>Ключ SSH</span>
            </button>
            <button type="button" class="dropdown-item" @click="startCreate(6)">
              <Landmark class="w-4 h-4 text-cyan-400" />
              <span>Банковский счёт</span>
            </button>
            <button type="button" class="dropdown-item" @click="startCreate(7)">
              <CreditCard class="w-4 h-4 text-lime-400" />
              <span>Водит. удостоверение</span>
            </button>
            <button type="button" class="dropdown-item" @click="startCreate(8)">
              <FileText class="w-4 h-4 text-sky-400" />
              <span>Паспорт</span>
            </button>
          </div>
        </div>

        <!-- Sync Button -->
        <button
          type="button"
          class="header-icon-btn"
          :class="{ 'animate-spin': vaultStore.isLoading }"
          @click="vaultStore.sync"
          title="Синхронизировать хранилище"
        >
          <RefreshCw class="w-4 h-4" />
        </button>

        <!-- Language Toggle Pill -->
        <button
          type="button"
          class="theme-pill"
          @click="cycleLocale"
          :title="t('lang.label')"
        >
          <Globe class="w-3.5 h-3.5 text-sky-400" />
          <span>{{ uiLocale.toUpperCase() }}</span>
        </button>

        <!-- Theme Toggle Pill -->
        <button
          type="button"
          class="theme-pill"
          @click="themeStore.cycleTheme"
          :title="`Тема: ${themeLabel}`"
        >
          <component :is="themeIcon" class="w-3.5 h-3.5 text-sky-400" />
          <span>{{ themeLabel }}</span>
        </button>

        <!-- Profile Menu Dropdown -->
        <div class="relative">
          <button
            type="button"
            class="profile-pill"
            @click="showProfileMenu = !showProfileMenu"
            title="Профиль и настройки"
          >
            <div class="avatar-circle">
              {{ userInitials }}
            </div>
            <span class="profile-pill-email">{{ authStore.savedEmail || 'Аккаунт' }}</span>
            <ChevronDown class="w-3 h-3 text-slate-400" />
          </button>

          <div v-if="showProfileMenu" class="dropdown-popover right-0 w-64">
            <div class="p-3 border-b border-slate-800/80 bg-black/20">
              <div class="text-xs font-semibold text-slate-200 truncate">{{ authStore.savedEmail }}</div>
              <div class="text-[10.5px] text-emerald-400 flex items-center gap-1 mt-0.5 font-medium">
                <Shield class="w-3 h-3" />
                <span>Novus Enterprise Premium</span>
              </div>
            </div>

            <div class="py-1">
              <button
                type="button"
                class="dropdown-item"
                @click="goToSettings('account')"
              >
                <User class="w-4 h-4 text-sky-400" />
                <span>Мой профиль</span>
              </button>

              <button
                type="button"
                class="dropdown-item"
                @click="goToSettings('security')"
              >
                <Lock class="w-4 h-4 text-indigo-400" />
                <span>Безопасность и KDF</span>
              </button>

              <button
                type="button"
                class="dropdown-item"
                @click="goToSettings('tools')"
              >
                <Download class="w-4 h-4 text-emerald-400" />
                <span>Экспорт хранилища</span>
              </button>
            </div>

            <div class="border-t border-slate-800/80 py-1">
              <button
                type="button"
                class="dropdown-item text-amber-400 hover:text-amber-300"
                @click="handleLock"
              >
                <Lock class="w-4 h-4" />
                <span>Заблокировать хранилище</span>
              </button>

              <button
                type="button"
                class="dropdown-item text-rose-400 hover:text-rose-300"
                @click="handleLogout"
              >
                <LogOut class="w-4 h-4" />
                <span>Выйти</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>

    <!-- Main Workspace (3 Columns) -->
    <div class="workspace-body">
      <!-- 1. Left Sidebar: Categories & Folders -->
      <aside class="sidebar-nav">
        <!-- Top App Navigation -->
        <div class="nav-section">
          <button
            class="nav-item"
            :class="{ active: vaultStore.selectedFilter.type === 'all' }"
            @click="vaultStore.selectedFilter = { type: 'all' }"
          >
            <Shield class="w-4 h-4 text-sky-400" />
            <span class="flex-1 text-left font-semibold">Все хранилища</span>
            <span class="badge">{{ vaultStore.counts.total }}</span>
          </button>

          <router-link to="/organizations" class="nav-item">
            <Building2 class="w-4 h-4 text-sky-400" />
            <span class="flex-1 text-left">{{ t('vault.organizations') }}</span>
          </router-link>

          <button
            type="button"
            class="nav-item"
            :class="{ active: activeToolModal === 'send' }"
            @click="openToolModal('send')"
          >
            <Send class="w-4 h-4 text-teal-400" />
            <span class="flex-1 text-left">Novus Send</span>
            <span v-if="vaultStore.sends.length > 0" class="badge">{{ vaultStore.sends.length }}</span>
          </button>

          <button
            type="button"
            class="nav-item"
            :class="{ active: activeToolModal === 'generator' }"
            @click="openToolModal('generator')"
          >
            <Wand2 class="w-4 h-4 text-indigo-400" />
            <span class="flex-1 text-left">Генератор паролей</span>
          </button>

          <button
            type="button"
            class="nav-item"
            :class="{ active: activeToolModal === 'sentinel' }"
            @click="openToolModal('sentinel')"
          >
            <Sparkles class="w-4 h-4 text-amber-400" />
            <span class="flex-1 text-left">Novus Sentinel (Аудит)</span>
          </button>

          <button
            type="button"
            class="nav-item"
            :class="{ active: activeToolModal === 'settings' }"
            @click="openToolModal('settings', 'account')"
          >
            <Settings class="w-4 h-4 text-sky-400" />
            <span class="flex-1 text-left">{{ t('nav.settings') }}</span>
          </button>

          <router-link to="/docs" class="nav-item">
            <BookOpen class="w-4 h-4 text-sky-400" />
            <span class="flex-1 text-left">{{ t('nav.docs') }}</span>
          </router-link>
        </div>

        <div class="divider"></div>

        <!-- Filters Section -->
        <div class="nav-section">
          <div class="nav-section-title">Фильтры</div>

          <button
            class="nav-item"
            :class="{ active: vaultStore.selectedFilter.type === 'favorites' }"
            @click="vaultStore.selectedFilter = { type: 'favorites' }"
          >
            <Star class="w-4 h-4 text-amber-400" />
            <span class="flex-1 text-left">Избранное</span>
            <span class="badge">{{ vaultStore.counts.favorites }}</span>
          </button>
        </div>

        <!-- Types Section -->
        <div class="nav-section">
          <div class="nav-section-title">Типы записей</div>

          <button
            class="nav-item"
            :class="{ active: vaultStore.selectedFilter.type === 'login' }"
            @click="vaultStore.selectedFilter = { type: 'login' }"
          >
            <Key class="w-4 h-4 text-emerald-400" />
            <span class="flex-1 text-left">Логины</span>
            <span class="badge">{{ vaultStore.counts.logins }}</span>
          </button>

          <button
            class="nav-item"
            :class="{ active: vaultStore.selectedFilter.type === 'card' }"
            @click="vaultStore.selectedFilter = { type: 'card' }"
          >
            <CreditCard class="w-4 h-4 text-indigo-400" />
            <span class="flex-1 text-left">Банковские карты</span>
            <span class="badge">{{ vaultStore.counts.cards }}</span>
          </button>

          <button
            class="nav-item"
            :class="{ active: vaultStore.selectedFilter.type === 'note' }"
            @click="vaultStore.selectedFilter = { type: 'note' }"
          >
            <FileText class="w-4 h-4 text-teal-400" />
            <span class="flex-1 text-left">Защищённые заметки</span>
            <span class="badge">{{ vaultStore.counts.notes }}</span>
          </button>

          <button
            class="nav-item"
            :class="{ active: vaultStore.selectedFilter.type === 'identity' }"
            @click="vaultStore.selectedFilter = { type: 'identity' }"
          >
            <User class="w-4 h-4 text-purple-400" />
            <span class="flex-1 text-left">Личные данные</span>
            <span class="badge">{{ vaultStore.counts.identities }}</span>
          </button>

          <button
            class="nav-item"
            :class="{ active: vaultStore.selectedFilter.type === 'sshKey' }"
            @click="vaultStore.selectedFilter = { type: 'sshKey' }"
          >
            <Terminal class="w-4 h-4 text-amber-400" />
            <span class="flex-1 text-left">Ключи SSH</span>
            <span class="badge">{{ vaultStore.counts.sshKeys }}</span>
          </button>

          <button
            v-if="vaultStore.counts.bankAccounts > 0"
            class="nav-item"
            :class="{ active: vaultStore.selectedFilter.type === 'bankAccount' }"
            @click="vaultStore.selectedFilter = { type: 'bankAccount' }"
          >
            <Landmark class="w-4 h-4 text-cyan-400" />
            <span class="flex-1 text-left">Банк. счета</span>
            <span class="badge">{{ vaultStore.counts.bankAccounts }}</span>
          </button>

          <button
            v-if="vaultStore.counts.driversLicenses > 0"
            class="nav-item"
            :class="{ active: vaultStore.selectedFilter.type === 'driversLicense' }"
            @click="vaultStore.selectedFilter = { type: 'driversLicense' }"
          >
            <CreditCard class="w-4 h-4 text-lime-400" />
            <span class="flex-1 text-left">Водит. права</span>
            <span class="badge">{{ vaultStore.counts.driversLicenses }}</span>
          </button>

          <button
            v-if="vaultStore.counts.passports > 0"
            class="nav-item"
            :class="{ active: vaultStore.selectedFilter.type === 'passport' }"
            @click="vaultStore.selectedFilter = { type: 'passport' }"
          >
            <FileText class="w-4 h-4 text-sky-400" />
            <span class="flex-1 text-left">Паспорта</span>
            <span class="badge">{{ vaultStore.counts.passports }}</span>
          </button>
        </div>

        <div class="divider"></div>

        <!-- Folders Section -->
        <div class="nav-section">
          <div class="flex justify-between items-center mb-1 px-2">
            <span class="nav-section-title !mb-0 !p-0">Папки</span>
            <button
              type="button"
              class="folder-add-btn"
              @click="openCreateFolderModal"
              title="Создать папку"
            >
              <FolderPlus class="w-3.5 h-3.5" />
            </button>
          </div>

          <div v-if="vaultStore.folders.length === 0" class="text-xs text-slate-500 py-1 px-3">
            Нет созданных папок
          </div>

          <div
            v-for="folder in nestedFolders"
            :key="folder.id"
            class="folder-row group"
            :class="{
              active: vaultStore.selectedFilter.type === 'folder' && vaultStore.selectedFilter.folderId === folder.id
            }"
            :style="{ paddingLeft: `${folder.depth * 12}px` }"
          >
            <button
              class="flex-1 flex items-center gap-2 text-left truncate text-xs font-medium py-1.5 px-2 rounded-lg"
              @click="vaultStore.selectedFilter = { type: 'folder', folderId: folder.id }"
              :title="folder.name"
            >
              <Folder class="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span class="truncate">{{ folder.displayName }}</span>
            </button>

            <div class="folder-actions opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 pr-1">
              <button
                type="button"
                class="p-1 text-slate-400 hover:text-sky-400 rounded"
                @click.stop="openRenameFolder(folder)"
                title="Переименовать"
              >
                <Edit2 class="w-3 h-3" />
              </button>
              <button
                type="button"
                class="p-1 text-slate-400 hover:text-rose-400 rounded"
                @click.stop="handleDeleteFolder(folder.id)"
                title="Удалить папку"
              >
                <Trash2 class="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        <!-- Collections Section (if any) -->
        <div v-if="vaultStore.collections.length > 0" class="nav-section">
          <div class="nav-section-title">Коллекции</div>
          <button
            v-for="col in vaultStore.collections"
            :key="col.id"
            class="nav-item"
            :class="{ active: vaultStore.selectedFilter.type === 'collection' && vaultStore.selectedFilter.collectionId === col.id }"
            @click="vaultStore.selectedFilter = { type: 'collection', collectionId: col.id }"
          >
            <Folder class="w-4 h-4 text-sky-400" />
            <span class="flex-1 text-left truncate">{{ col.name }}</span>
          </button>
        </div>

        <!-- Archive & Trash at bottom -->
        <div class="nav-section mt-auto pt-2 border-t border-slate-800/60">
          <button
            class="nav-item"
            :class="{ active: vaultStore.selectedFilter.type === 'archive' }"
            @click="vaultStore.selectedFilter = { type: 'archive' }"
          >
            <Archive class="w-4 h-4 text-amber-400" />
            <span class="flex-1 text-left">Архив</span>
            <span class="badge">{{ vaultStore.counts.archived }}</span>
          </button>
          <button
            class="nav-item"
            :class="{ active: vaultStore.selectedFilter.type === 'trash' }"
            @click="vaultStore.selectedFilter = { type: 'trash' }"
          >
            <Trash2 class="w-4 h-4 text-rose-400" />
            <span class="flex-1 text-left">Корзина</span>
            <span class="badge">{{ vaultStore.counts.trash }}</span>
          </button>
        </div>
      </aside>

      <!-- 2. Middle Column: Ciphers List -->
      <section class="items-list-pane">
        <div class="pane-header">
          <div class="font-bold text-sm">
            {{
              vaultStore.selectedFilter.type === 'trash'
                ? 'Корзина'
                : vaultStore.selectedFilter.type === 'archive'
                ? 'Архив'
                : vaultStore.selectedFilter.type === 'favorites'
                ? 'Избранное'
                : vaultStore.selectedFilter.type === 'login'
                ? 'Логины'
                : vaultStore.selectedFilter.type === 'card'
                ? 'Банковские карты'
                : vaultStore.selectedFilter.type === 'note'
                ? 'Заметки'
                : vaultStore.selectedFilter.type === 'identity'
                ? 'Личные данные'
                : vaultStore.selectedFilter.type === 'sshKey'
                ? 'Ключи SSH'
                : vaultStore.selectedFilter.type === 'bankAccount'
                ? 'Банковские счета'
                : vaultStore.selectedFilter.type === 'driversLicense'
                ? 'Водительские удостоверения'
                : vaultStore.selectedFilter.type === 'passport'
                ? 'Паспорта'
                : vaultStore.selectedFilter.type === 'collection'
                ? 'Коллекция'
                : 'Все элементы'
            }}
          </div>
          <div class="flex items-center gap-2">
            <button
              v-if="vaultStore.selectedFilter.type === 'trash' && vaultStore.filteredCiphers.length > 0"
              type="button"
              class="text-[11px] px-2 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/30 hover:bg-rose-500/25"
              @click="handleEmptyTrash"
            >
              Очистить
            </button>
            <span class="text-xs text-slate-400">{{ vaultStore.filteredCiphers.length }}</span>
          </div>
        </div>

        <!-- Bulk Action Bar -->
        <div
          v-if="selectedIds.length > 0"
          class="px-3 py-2 bg-sky-950/60 border-b border-sky-500/30 flex items-center justify-between gap-2 text-[11px]"
        >
          <span class="font-semibold text-sky-300">Выбрано: {{ selectedIds.length }}</span>
          <div class="flex items-center gap-1.5">
            <template v-if="vaultStore.selectedFilter.type === 'trash'">
              <button type="button" class="px-2 py-0.5 rounded bg-emerald-600/30 text-emerald-300" @click="handleBulkRestore">Восст.</button>
              <button type="button" class="px-2 py-0.5 rounded bg-rose-600/30 text-rose-300" @click="handleBulkDelete(true)">Удалить</button>
            </template>
            <template v-else>
              <select v-model="bulkMoveFolderId" class="bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-[11px]" @change="handleBulkMove">
                <option :value="null">В папку...</option>
                <option v-for="f in vaultStore.folders" :key="f.id" :value="f.id">{{ f.name }}</option>
              </select>
              <button type="button" class="px-2 py-0.5 rounded bg-rose-600/30 text-rose-300" @click="handleBulkDelete(false)">В корзину</button>
            </template>
            <button type="button" class="text-slate-400 hover:text-white" @click="selectedIds = []">✕</button>
          </div>
        </div>

        <div class="items-scroll">
          <div
            v-if="vaultStore.filteredCiphers.length === 0"
            class="empty-state"
          >
            <div class="empty-icon-wrap">
              <Shield class="w-8 h-8 text-sky-400/50" />
            </div>
            <p class="empty-title">Записей не найдено</p>
            <p class="empty-desc">
              Создайте первую запись с помощью кнопки «Новый элемент»
            </p>
          </div>

          <div
            v-for="item in vaultStore.filteredCiphers"
            :key="item.id"
            class="item-card"
            :class="{ active: vaultStore.selectedCipherId === item.id }"
            @click="selectCipher(item.id)"
          >
            <input
              type="checkbox"
              :checked="selectedIds.includes(item.id)"
              @click.stop="toggleSelectId(item.id)"
              class="mr-1 accent-sky-500 cursor-pointer shrink-0"
              title="Выбрать элемент"
            />
            <!-- Type Icon -->
            <div class="item-icon-box">
              <Key v-if="item.type === 1" class="w-4 h-4 text-emerald-400" />
              <FileText v-else-if="item.type === 2" class="w-4 h-4 text-teal-400" />
              <CreditCard v-else-if="item.type === 3" class="w-4 h-4 text-indigo-400" />
              <User v-else-if="item.type === 4" class="w-4 h-4 text-purple-400" />
              <Terminal v-else-if="item.type === 5" class="w-4 h-4 text-amber-400" />
              <Shield v-else class="w-4 h-4 text-sky-400" />
            </div>

            <!-- Item Main Info -->
            <div class="item-info">
              <div class="item-name truncate">{{ item.name || 'Без названия' }}</div>
              <div class="item-sub truncate">
                <span v-if="item.login?.username">{{ item.login.username }}</span>
                <span v-else-if="item.card?.cardholderName">{{ item.card.cardholderName }}</span>
                <span v-else-if="item.identity?.email">{{ item.identity.email }}</span>
                <span v-else-if="item.type === 5" class="font-mono text-[10.5px]">
                  {{ item.sshKey?.keyFingerprint || 'Ключ SSH' }}
                </span>
                <span v-else-if="item.type === 2">Защищённая заметка</span>
                <span v-else>—</span>
              </div>
            </div>

            <!-- Quick Hover Copy Actions for Logins -->
            <div
              v-if="item.type === 1 && !item.deletedDate"
              class="quick-copy-actions"
              @click.stop
            >
              <button
                v-if="item.login?.username"
                type="button"
                class="quick-copy-btn"
                title="Копировать логин"
                @click="copyToClipboard(item.login.username, 'Логин')"
              >
                <User class="w-3.5 h-3.5" />
              </button>
              <button
                v-if="item.login?.password"
                type="button"
                class="quick-copy-btn"
                title="Копировать пароль"
                @click="copyToClipboard(item.login.password, 'Пароль', item.reprompt === 1)"
              >
                <Key class="w-3.5 h-3.5" />
              </button>
            </div>

            <!-- Star Favorite -->
            <button
              v-if="!item.deletedDate"
              type="button"
              class="star-btn"
              :class="{ active: item.favorite }"
              @click.stop="handleToggleFavorite(item.id)"
              title="Избранное"
            >
              <Star class="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      <!-- 3. Right Column: Cipher Detail / Edit Pane -->
      <section class="detail-pane">
        <!-- 3A. Edit Form Mode -->
        <div v-if="isEditing" class="edit-container">
          <div class="detail-header">
            <h2 class="text-base font-bold">
              {{ editForm.id ? 'Редактировать запись' : 'Новая запись' }}
            </h2>
            <div class="flex gap-2">
              <button
                type="button"
                class="cyber-btn-secondary !h-8 !px-3"
                @click="cancelEdit"
              >
                Отмена
              </button>
              <button
                type="button"
                class="cyber-btn-primary !h-8 !px-4"
                @click="handleSave"
              >
                Сохранить
              </button>
            </div>
          </div>

          <div class="detail-scroll">
            <div class="field-box">
              <label class="detail-label">Тип записи</label>
              <select v-model="editForm.type" class="cyber-select">
                <option :value="1">Логин и пароль</option>
                <option :value="2">Защищённая заметка</option>
                <option :value="3">Банковская карта</option>
                <option :value="4">Личные данные</option>
                <option :value="5">Ключ SSH</option>
                <option :value="6">Банковский счёт</option>
                <option :value="7">Водительское удостоверение</option>
                <option :value="8">Паспорт</option>
              </select>
            </div>

            <div class="field-box">
              <label class="detail-label">Название *</label>
              <input
                v-model="editForm.name"
                type="text"
                placeholder="например: Google Workspace, GitHub"
                class="cyber-input"
              />
            </div>

            <div class="field-box">
              <label class="detail-label">Папка</label>
              <select v-model="editForm.folderId" class="cyber-select">
                <option :value="null">Без папки</option>
                <option
                  v-for="folder in vaultStore.folders"
                  :key="folder.id"
                  :value="folder.id"
                >
                  {{ folder.name }}
                </option>
              </select>
            </div>

            <!-- Login Specific Fields -->
            <template v-if="editForm.type === 1 && editForm.login">
              <div class="field-box">
                <label class="detail-label">Имя пользователя / Email</label>
                <input
                  v-model="editForm.login.username"
                  type="text"
                  placeholder="name@company.com"
                  class="cyber-input"
                />
              </div>

              <div class="field-box">
                <div class="flex justify-between items-center mb-1">
                  <label class="detail-label !mb-0">Пароль</label>
                  <button
                    type="button"
                    class="btn-generate"
                    @click="fillGeneratedPassword"
                  >
                    <Wand2 class="w-3.5 h-3.5" />
                    <span>Сгенерировать</span>
                  </button>
                </div>
                <div class="cyber-input-wrapper">
                  <input
                    v-model="editForm.login.password"
                    :type="showPassword ? 'text' : 'password'"
                    placeholder="Мастер-пароль или сгенерированный ключ"
                    class="cyber-input !pr-10"
                  />
                  <button
                    type="button"
                    class="password-toggle-btn"
                    @click="showPassword = !showPassword"
                    title="Показать / скрыть пароль"
                  >
                    <component :is="showPassword ? EyeOff : Eye" class="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div class="field-box">
                <label class="detail-label">Ключ двухфакторной аутентификации (TOTP)</label>
                <input
                  v-model="editForm.login.totp"
                  type="text"
                  placeholder="Секретный ключ base32 или otpauth://..."
                  class="cyber-input"
                />
              </div>

              <div class="field-box">
                <div class="flex justify-between items-center mb-1">
                  <label class="detail-label !mb-0">Адреса сайта (URI)</label>
                  <button
                    type="button"
                    class="btn-generate"
                    @click="editForm.login.uris = [...(editForm.login.uris || []), { uri: '' }]"
                  >
                    <Plus class="w-3.5 h-3.5" />
                    <span>Добавить URI</span>
                  </button>
                </div>
                <div
                  v-for="(uriEntry, idx) in (editForm.login.uris || [])"
                  :key="idx"
                  class="flex items-center gap-2 mb-2"
                >
                  <input
                    v-model="uriEntry.uri"
                    type="url"
                    placeholder="https://accounts.google.com"
                    class="cyber-input flex-1"
                  />
                  <select
                    v-model="uriEntry.match"
                    class="cyber-select !w-28 text-[11px]"
                    title="Правило совпадения URI"
                  >
                    <option :value="null">По умолч.</option>
                    <option :value="0">Домен</option>
                    <option :value="1">Хост</option>
                    <option :value="2">Начинается</option>
                    <option :value="3">Точное</option>
                    <option :value="4">RegEx</option>
                    <option :value="5">Никогда</option>
                  </select>
                  <button
                    v-if="(editForm.login.uris?.length || 0) > 1"
                    type="button"
                    class="p-2 text-rose-400 hover:text-rose-300"
                    @click="editForm.login.uris!.splice(idx, 1)"
                    title="Удалить URI"
                  >
                    <Trash2 class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </template>

            <!-- Card Specific Fields -->
            <template v-if="editForm.type === 3 && editForm.card">
              <div class="grid grid-cols-2 gap-2">
                <div class="field-box">
                  <label class="detail-label">Владелец карты</label>
                  <input
                    v-model="editForm.card.cardholderName"
                    type="text"
                    placeholder="IVAN IVANOV"
                    class="cyber-input"
                  />
                </div>
                <div class="field-box">
                  <label class="detail-label">Платёжная система / Бренд</label>
                  <input
                    v-model="editForm.card.brand"
                    type="text"
                    placeholder="Visa / Mastercard"
                    class="cyber-input"
                  />
                </div>
              </div>
              <div class="field-box">
                <label class="detail-label">Номер карты</label>
                <input
                  v-model="editForm.card.number"
                  type="text"
                  placeholder="4000 1234 5678 9010"
                  class="cyber-input"
                />
              </div>
              <div class="grid grid-cols-3 gap-2">
                <div class="field-box">
                  <label class="detail-label">Месяц</label>
                  <input v-model="editForm.card.expMonth" placeholder="12" class="cyber-input" />
                </div>
                <div class="field-box">
                  <label class="detail-label">Год</label>
                  <input v-model="editForm.card.expYear" placeholder="2028" class="cyber-input" />
                </div>
                <div class="field-box">
                  <label class="detail-label">CVV / CVC</label>
                  <input v-model="editForm.card.code" placeholder="123" class="cyber-input" />
                </div>
              </div>
            </template>

            <!-- Identity Specific Fields -->
            <template v-if="editForm.type === 4 && editForm.identity">
              <div class="grid grid-cols-3 gap-2">
                <div class="field-box">
                  <label class="detail-label">Обращение</label>
                  <input v-model="editForm.identity.title" placeholder="Г-н / Ms" class="cyber-input" />
                </div>
                <div class="field-box">
                  <label class="detail-label">Имя</label>
                  <input v-model="editForm.identity.firstName" placeholder="Иван" class="cyber-input" />
                </div>
                <div class="field-box">
                  <label class="detail-label">Фамилия</label>
                  <input v-model="editForm.identity.lastName" placeholder="Иванов" class="cyber-input" />
                </div>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div class="field-box">
                  <label class="detail-label">Отчество</label>
                  <input v-model="editForm.identity.middleName" placeholder="Иванович" class="cyber-input" />
                </div>
                <div class="field-box">
                  <label class="detail-label">Имя пользователя</label>
                  <input v-model="editForm.identity.username" placeholder="ivanov" class="cyber-input" />
                </div>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div class="field-box">
                  <label class="detail-label">Email</label>
                  <input v-model="editForm.identity.email" placeholder="ivan@example.com" class="cyber-input" />
                </div>
                <div class="field-box">
                  <label class="detail-label">Телефон</label>
                  <input v-model="editForm.identity.phone" placeholder="+7 999 000-00-00" class="cyber-input" />
                </div>
              </div>
              <div class="field-box">
                <label class="detail-label">Компания</label>
                <input v-model="editForm.identity.company" placeholder="SGC-NOVUS" class="cyber-input" />
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div class="field-box">
                  <label class="detail-label">Адрес (строка 1)</label>
                  <input v-model="editForm.identity.address1" placeholder="ул. Примерная, д. 1" class="cyber-input" />
                </div>
                <div class="field-box">
                  <label class="detail-label">Адрес (строка 2)</label>
                  <input v-model="editForm.identity.address2" placeholder="офис 42" class="cyber-input" />
                </div>
              </div>
              <div class="grid grid-cols-3 gap-2">
                <div class="field-box">
                  <label class="detail-label">Город</label>
                  <input v-model="editForm.identity.city" placeholder="Киев" class="cyber-input" />
                </div>
                <div class="field-box">
                  <label class="detail-label">Индекс</label>
                  <input v-model="editForm.identity.postalCode" placeholder="01001" class="cyber-input" />
                </div>
                <div class="field-box">
                  <label class="detail-label">Страна</label>
                  <input v-model="editForm.identity.country" placeholder="UA" class="cyber-input" />
                </div>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div class="field-box">
                  <label class="detail-label">Паспорт / ID</label>
                  <input v-model="editForm.identity.passportNumber" placeholder="Номер документа" class="cyber-input" />
                </div>
                <div class="field-box">
                  <label class="detail-label">Вод. удостоверение</label>
                  <input v-model="editForm.identity.licenseNumber" placeholder="Номер прав" class="cyber-input" />
                </div>
              </div>
            </template>

            <!-- SSH Key Specific Fields -->
            <template v-if="editForm.type === 5 && editForm.sshKey">
              <div class="field-box">
                <div class="flex items-center justify-between mb-1.5">
                  <label class="detail-label !mb-0">Приватный ключ SSH</label>
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      class="btn-generate"
                      @click="generateSshKeyAction"
                    >
                      <Sparkles class="w-3.5 h-3.5" />
                      <span>Сгенерировать RSA-2048</span>
                    </button>
                    <button
                      type="button"
                      class="text-xs text-slate-400 hover:text-sky-400 flex items-center gap-1"
                      @click="showSshPrivateKey = !showSshPrivateKey"
                    >
                      <component :is="showSshPrivateKey ? EyeOff : Eye" class="w-3.5 h-3.5" />
                      <span>{{ showSshPrivateKey ? 'Скрыть' : 'Показать' }}</span>
                    </button>
                  </div>
                </div>
                <textarea
                  v-model="editForm.sshKey.privateKey"
                  rows="5"
                  placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;..."
                  class="cyber-textarea font-mono text-xs"
                  :style="showSshPrivateKey ? '' : '-webkit-text-security: disc;'"
                ></textarea>
              </div>

              <div class="field-box">
                <label class="detail-label">Публичный ключ SSH</label>
                <textarea
                  v-model="editForm.sshKey.publicKey"
                  rows="3"
                  placeholder="ssh-rsa AAAAB3NzaC1yc2E... user@novuswarden"
                  class="cyber-textarea font-mono text-xs"
                ></textarea>
              </div>

              <div class="field-box">
                <label class="detail-label">Отпечаток ключа (Fingerprint)</label>
                <input
                  v-model="editForm.sshKey.keyFingerprint"
                  type="text"
                  placeholder="SHA256:4y+7W79i..."
                  class="cyber-input font-mono text-xs"
                />
              </div>
            </template>

            <!-- Bank Account Specific Fields (Type 6) -->
            <template v-if="editForm.type === 6 && editForm.bankAccount">
              <div class="grid grid-cols-2 gap-2">
                <div class="field-box">
                  <label class="detail-label">Банк</label>
                  <input v-model="editForm.bankAccount.bankName" type="text" class="cyber-input" />
                </div>
                <div class="field-box">
                  <label class="detail-label">Владелец счёта</label>
                  <input v-model="editForm.bankAccount.nameOnAccount" type="text" class="cyber-input" />
                </div>
                <div class="field-box">
                  <label class="detail-label">Номер счёта</label>
                  <input v-model="editForm.bankAccount.accountNumber" type="text" class="cyber-input font-mono" />
                </div>
                <div class="field-box">
                  <label class="detail-label">IBAN</label>
                  <input v-model="editForm.bankAccount.iban" type="text" class="cyber-input font-mono" />
                </div>
                <div class="field-box">
                  <label class="detail-label">SWIFT / BIC</label>
                  <input v-model="editForm.bankAccount.swiftCode" type="text" class="cyber-input font-mono" />
                </div>
                <div class="field-box">
                  <label class="detail-label">Routing / Branch</label>
                  <input v-model="editForm.bankAccount.routingNumber" type="text" class="cyber-input font-mono" />
                </div>
              </div>
            </template>

            <!-- Driver's License Specific Fields (Type 7) -->
            <template v-if="editForm.type === 7 && editForm.driversLicense">
              <div class="grid grid-cols-2 gap-2">
                <div class="field-box">
                  <label class="detail-label">Имя</label>
                  <input v-model="editForm.driversLicense.firstName" type="text" class="cyber-input" />
                </div>
                <div class="field-box">
                  <label class="detail-label">Фамилия</label>
                  <input v-model="editForm.driversLicense.lastName" type="text" class="cyber-input" />
                </div>
                <div class="field-box">
                  <label class="detail-label">Номер удостоверения</label>
                  <input v-model="editForm.driversLicense.licenseNumber" type="text" class="cyber-input font-mono" />
                </div>
                <div class="field-box">
                  <label class="detail-label">Категория</label>
                  <input v-model="editForm.driversLicense.licenseClass" type="text" class="cyber-input" />
                </div>
                <div class="field-box">
                  <label class="detail-label">Страна выдачи</label>
                  <input v-model="editForm.driversLicense.issuingCountry" type="text" class="cyber-input" />
                </div>
                <div class="field-box">
                  <label class="detail-label">Срок действия</label>
                  <input v-model="editForm.driversLicense.expirationDate" type="text" class="cyber-input" />
                </div>
              </div>
            </template>

            <!-- Passport Specific Fields (Type 8) -->
            <template v-if="editForm.type === 8 && editForm.passport">
              <div class="grid grid-cols-2 gap-2">
                <div class="field-box">
                  <label class="detail-label">Фамилия</label>
                  <input v-model="editForm.passport.surname" type="text" class="cyber-input" />
                </div>
                <div class="field-box">
                  <label class="detail-label">Имя</label>
                  <input v-model="editForm.passport.givenName" type="text" class="cyber-input" />
                </div>
                <div class="field-box">
                  <label class="detail-label">Номер паспорта</label>
                  <input v-model="editForm.passport.passportNumber" type="text" class="cyber-input font-mono" />
                </div>
                <div class="field-box">
                  <label class="detail-label">Гражданство</label>
                  <input v-model="editForm.passport.nationality" type="text" class="cyber-input" />
                </div>
                <div class="field-box">
                  <label class="detail-label">Страна выдачи</label>
                  <input v-model="editForm.passport.issuingCountry" type="text" class="cyber-input" />
                </div>
                <div class="field-box">
                  <label class="detail-label">Срок действия</label>
                  <input v-model="editForm.passport.expirationDate" type="text" class="cyber-input" />
                </div>
              </div>
            </template>

            <!-- Notes -->
            <div class="field-box">
              <label class="detail-label">Заметки</label>
              <textarea
                v-model="editForm.notes"
                rows="4"
                placeholder="Секретные комментарии, ключи восстановления..."
                class="cyber-textarea"
              ></textarea>
            </div>

            <!-- Custom Fields -->
            <div class="field-box">
              <div class="flex justify-between items-center mb-1.5">
                <label class="detail-label !mb-0">Настраиваемые поля</label>
                <button
                  type="button"
                  class="btn-generate"
                  @click="editForm.fields = [...(editForm.fields || []), { name: '', value: '', type: 0 }]"
                >
                  <Plus class="w-3.5 h-3.5" />
                  <span>Добавить поле</span>
                </button>
              </div>
              <div
                v-for="(cf, idx) in (editForm.fields || [])"
                :key="idx"
                class="grid grid-cols-12 gap-1.5 mb-2 items-center"
              >
                <select v-model.number="cf.type" class="cyber-select col-span-3 text-[11px]">
                  <option :value="0">Текст</option>
                  <option :value="1">Скрытое</option>
                  <option :value="2">Да/Нет</option>
                </select>
                <input v-model="cf.name" placeholder="Название" class="cyber-input col-span-4" />
                <input
                  v-if="cf.type !== 2"
                  v-model="cf.value"
                  :type="cf.type === 1 ? 'password' : 'text'"
                  placeholder="Значение"
                  class="cyber-input col-span-4"
                />
                <select v-else v-model="cf.value" class="cyber-select col-span-4">
                  <option value="true">Да (true)</option>
                  <option value="false">Нет (false)</option>
                </select>
                <button type="button" class="text-rose-400 col-span-1 flex justify-center" @click="editForm.fields!.splice(idx, 1)">
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <!-- Reprompt Option -->
            <div class="field-box">
              <label class="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  :checked="editForm.reprompt === 1"
                  @change="editForm.reprompt = ($event.target as HTMLInputElement).checked ? 1 : 0"
                />
                <span>Запрашивать мастер-пароль повторно (Master Password Reprompt)</span>
              </label>
            </div>
          </div>
        </div>

        <!-- 3B. View Detail Mode -->
        <div v-else-if="vaultStore.selectedCipher" class="view-container">
          <div class="detail-header">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-400/30 flex items-center justify-center">
                <Key v-if="vaultStore.selectedCipher.type === 1" class="w-5 h-5 text-emerald-400" />
                <FileText v-else-if="vaultStore.selectedCipher.type === 2" class="w-5 h-5 text-teal-400" />
                <CreditCard v-else-if="vaultStore.selectedCipher.type === 3" class="w-5 h-5 text-indigo-400" />
                <User v-else-if="vaultStore.selectedCipher.type === 4" class="w-5 h-5 text-purple-400" />
                <Terminal v-else-if="vaultStore.selectedCipher.type === 5" class="w-5 h-5 text-amber-400" />
                <Landmark v-else-if="vaultStore.selectedCipher.type === 6" class="w-5 h-5 text-cyan-400" />
                <CreditCard v-else-if="vaultStore.selectedCipher.type === 7" class="w-5 h-5 text-lime-400" />
                <FileText v-else-if="vaultStore.selectedCipher.type === 8" class="w-5 h-5 text-sky-400" />
                <Shield v-else class="w-5 h-5 text-sky-400" />
              </div>
              <div>
                <h2 class="text-base font-bold leading-tight">
                  {{ vaultStore.selectedCipher.name }}
                </h2>
                <div class="text-xs text-slate-400">
                  Обновлено: {{ vaultStore.selectedCipher.revisionDate ? new Date(vaultStore.selectedCipher.revisionDate).toLocaleDateString('ru-RU') : '—' }}
                </div>
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="flex items-center gap-2">
              <template v-if="!vaultStore.selectedCipher.deletedDate">
                <button
                  type="button"
                  class="cyber-btn-secondary !h-8 !px-3"
                  @click="startEdit"
                >
                  <Edit2 class="w-3.5 h-3.5" />
                  <span>Изменить</span>
                </button>
                <button
                  v-if="authStore.organizations.length > 0 || vaultStore.selectedCipher.organizationId"
                  type="button"
                  class="cyber-btn-secondary !h-8 !w-8 !p-0 text-sky-400 hover:text-sky-300"
                  @click="openShareModal"
                  :title="vaultStore.selectedCipher.organizationId ? 'Управление коллекциями' : 'Перенести в организацию'"
                >
                  <Share2 class="w-4 h-4" />
                </button>
                <button
                  type="button"
                  class="cyber-btn-secondary !h-8 !w-8 !p-0 text-amber-400 hover:text-amber-300"
                  @click="handleToggleArchive"
                  :title="vaultStore.selectedCipher.archivedDate ? 'Вернуть из архива' : 'Архивировать'"
                >
                  <Archive class="w-4 h-4" />
                </button>
                <button
                  type="button"
                  class="cyber-btn-secondary !h-8 !w-8 !p-0 text-rose-400 hover:text-rose-300"
                  @click="handleDelete(false)"
                  title="Переместить в корзину"
                >
                  <Trash2 class="w-4 h-4" />
                </button>
              </template>
              <template v-else>
                <button
                  type="button"
                  class="cyber-btn-primary !h-8 !px-3"
                  @click="handleRestore"
                >
                  Восстановить
                </button>
                <button
                  type="button"
                  class="cyber-btn-danger !h-8 !px-3"
                  @click="handleDelete(true)"
                >
                  Удалить навсегда
                </button>
              </template>
            </div>
          </div>

          <!-- Detail Fields -->
          <div class="detail-scroll">
            <!-- Login Info -->
            <template v-if="vaultStore.selectedCipher.type === 1 && vaultStore.selectedCipher.login">
              <!-- Username -->
              <div v-if="vaultStore.selectedCipher.login.username" class="data-row">
                <div class="data-label">Имя пользователя / Email</div>
                <div class="data-val-group">
                  <span class="data-value">{{ vaultStore.selectedCipher.login.username }}</span>
                  <button
                    type="button"
                    class="btn-copy"
                    @click="copyToClipboard(vaultStore.selectedCipher.login.username, 'Логин')"
                  >
                    <Copy class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <!-- Password -->
              <div v-if="vaultStore.selectedCipher.login.password" class="data-row">
                <div class="data-label">Пароль</div>
                <div class="data-val-group">
                  <span class="data-value font-mono">
                    {{ showPassword ? vaultStore.selectedCipher.login.password : '••••••••••••••••' }}
                  </span>
                    <button
                      type="button"
                      class="btn-copy"
                      @click="runWithReprompt(() => { showPassword = !showPassword })"
                      title="Показать / скрыть"
                    >
                      <component :is="showPassword ? EyeOff : Eye" class="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      class="btn-copy"
                      @click="copyToClipboard(vaultStore.selectedCipher.login.password, 'Пароль', true)"
                    >
                      <Copy class="w-3.5 h-3.5" />
                    </button>
                </div>
              </div>

              <!-- Live TOTP Code Badge -->
              <div v-if="liveTotp" class="totp-card">
                <div class="flex justify-between items-center mb-1">
                  <div class="text-xs font-semibold text-sky-400 flex items-center gap-1.5">
                    <Clock class="w-3.5 h-3.5" />
                    <span>Одноразовый код (TOTP)</span>
                  </div>
                  <div class="totp-timer-badge">
                    {{ liveTotp.secondsRemaining }}с
                  </div>
                </div>

                <div class="flex items-center justify-between">
                  <div class="totp-digits">
                    {{ liveTotp.code.slice(0, 3) }} {{ liveTotp.code.slice(3) }}
                  </div>
                  <button
                    type="button"
                    class="cyber-btn-primary !h-7 !px-2.5 text-xs"
                    @click="copyToClipboard(liveTotp.code, 'TOTP код')"
                  >
                    <Copy class="w-3.5 h-3.5" />
                    <span>Копировать</span>
                  </button>
                </div>

                <!-- Circular Progress Bar -->
                <div class="totp-progress-track">
                  <div
                    class="totp-progress-fill"
                    :style="{ width: `${liveTotp.progressPercent}%` }"
                  ></div>
                </div>
              </div>

              <!-- Website URIs -->
              <div
                v-if="vaultStore.selectedCipher.login.uris && vaultStore.selectedCipher.login.uris.length > 0"
                class="data-row"
              >
                <div class="data-label">Веб-сайт</div>
                <div
                  v-for="(u, idx) in vaultStore.selectedCipher.login.uris"
                  :key="idx"
                  class="data-val-group"
                >
                  <a
                    :href="u.uri"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="data-link truncate"
                  >
                    {{ u.uri }}
                  </a>
                  <a
                    :href="u.uri"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="btn-copy"
                    title="Перейти на сайт"
                  >
                    <ExternalLink class="w-3.5 h-3.5 text-sky-400" />
                  </a>
                </div>
              </div>
            </template>

            <!-- SSH Key Info (Type 5) -->
            <template v-if="vaultStore.selectedCipher.type === 5 && vaultStore.selectedCipher.sshKey">
              <!-- Fingerprint -->
              <div v-if="vaultStore.selectedCipher.sshKey.keyFingerprint" class="data-row">
                <div class="data-label">Отпечаток ключа (SHA-256 Fingerprint)</div>
                <div class="data-val-group">
                  <span class="data-value font-mono text-xs text-sky-400">
                    {{ vaultStore.selectedCipher.sshKey.keyFingerprint }}
                  </span>
                  <button
                    type="button"
                    class="btn-copy"
                    @click="copyToClipboard(vaultStore.selectedCipher.sshKey.keyFingerprint, 'Отпечаток ключа')"
                  >
                    <Copy class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <!-- Public Key -->
              <div v-if="vaultStore.selectedCipher.sshKey.publicKey" class="data-row">
                <div class="flex items-center justify-between">
                  <span class="data-label">Публичный ключ</span>
                  <button
                    type="button"
                    class="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 font-semibold"
                    @click="copyToClipboard(vaultStore.selectedCipher.sshKey.publicKey, 'Публичный ключ')"
                  >
                    <Copy class="w-3 h-3" />
                    <span>Копировать</span>
                  </button>
                </div>
                <pre class="font-mono text-[11px] text-slate-300 bg-black/30 p-2.5 rounded-lg border border-slate-800 break-all whitespace-pre-wrap select-all">{{ vaultStore.selectedCipher.sshKey.publicKey }}</pre>
              </div>

              <!-- Private Key -->
              <div v-if="vaultStore.selectedCipher.sshKey.privateKey" class="data-row">
                <div class="flex items-center justify-between">
                  <span class="data-label">Приватный ключ</span>
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      class="text-xs text-slate-400 hover:text-sky-400 flex items-center gap-1"
                      @click="showDetailSshPrivate = !showDetailSshPrivate"
                    >
                      <component :is="showDetailSshPrivate ? EyeOff : Eye" class="w-3.5 h-3.5" />
                      <span>{{ showDetailSshPrivate ? 'Скрыть' : 'Показать' }}</span>
                    </button>
                    <button
                      type="button"
                      class="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 font-semibold"
                      @click="copyToClipboard(vaultStore.selectedCipher.sshKey.privateKey, 'Приватный ключ')"
                    >
                      <Copy class="w-3 h-3" />
                      <span>Копировать</span>
                    </button>
                  </div>
                </div>
                <pre
                  v-if="showDetailSshPrivate"
                  class="font-mono text-[10.5px] text-amber-300/90 bg-black/40 p-2.5 rounded-lg border border-amber-900/40 break-all whitespace-pre-wrap select-all max-h-48 overflow-y-auto"
                >{{ vaultStore.selectedCipher.sshKey.privateKey }}</pre>
                <div
                  v-else
                  class="p-2.5 rounded-lg bg-black/20 border border-slate-800 text-xs text-slate-500 font-mono flex items-center gap-2"
                >
                  <Lock class="w-3.5 h-3.5 text-amber-500/70" />
                  <span>••••••••••••••••••••••••••••••••••••••••••••</span>
                </div>
              </div>
            </template>

            <!-- Card Info -->
            <template v-if="vaultStore.selectedCipher.type === 3 && vaultStore.selectedCipher.card">
              <div v-if="vaultStore.selectedCipher.card.cardholderName" class="data-row">
                <div class="data-label">Владелец карты</div>
                <div class="data-val-group">
                  <span class="data-value">{{ vaultStore.selectedCipher.card.cardholderName }}</span>
                  <button type="button" class="btn-copy" @click="copyToClipboard(vaultStore.selectedCipher.card.cardholderName, 'Владелец карты')">
                    <Copy class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div v-if="vaultStore.selectedCipher.card.brand" class="data-row">
                <div class="data-label">Платёжная система</div>
                <div class="data-value">{{ vaultStore.selectedCipher.card.brand }}</div>
              </div>
              <div v-if="vaultStore.selectedCipher.card.number" class="data-row">
                <div class="data-label">Номер карты</div>
                <div class="data-val-group">
                  <span class="data-value font-mono">
                    {{ showCardNumber ? vaultStore.selectedCipher.card.number : `•••• •••• •••• ${vaultStore.selectedCipher.card.number.slice(-4)}` }}
                  </span>
                  <button
                    type="button"
                    class="btn-copy"
                    @click="runWithReprompt(() => { showCardNumber = !showCardNumber })"
                    title="Показать / скрыть"
                  >
                    <component :is="showCardNumber ? EyeOff : Eye" class="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    class="btn-copy"
                    @click="copyToClipboard(vaultStore.selectedCipher.card!.number!, 'Номер карты', true)"
                  >
                    <Copy class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div
                v-if="vaultStore.selectedCipher.card.expMonth || vaultStore.selectedCipher.card.expYear"
                class="data-row"
              >
                <div class="data-label">Срок действия</div>
                <div class="data-value">
                  {{ vaultStore.selectedCipher.card.expMonth }} / {{ vaultStore.selectedCipher.card.expYear }}
                </div>
              </div>
              <div v-if="vaultStore.selectedCipher.card.code" class="data-row">
                <div class="data-label">CVV / CVC код</div>
                <div class="data-val-group">
                  <span class="data-value font-mono">
                    {{ showCardCode ? vaultStore.selectedCipher.card.code : '•••' }}
                  </span>
                  <button type="button" class="btn-copy" @click="showCardCode = !showCardCode" title="Показать / скрыть">
                    <component :is="showCardCode ? EyeOff : Eye" class="w-3.5 h-3.5" />
                  </button>
                  <button type="button" class="btn-copy" @click="copyToClipboard(vaultStore.selectedCipher.card.code, 'CVV')">
                    <Copy class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </template>

            <!-- Identity Info (Type 4) -->
            <template v-if="vaultStore.selectedCipher.type === 4 && vaultStore.selectedCipher.identity">
              <div
                v-if="vaultStore.selectedCipher.identity.firstName || vaultStore.selectedCipher.identity.lastName"
                class="data-row"
              >
                <div class="data-label">ФИО</div>
                <div class="data-val-group">
                  <span class="data-value">
                    {{
                      [
                        vaultStore.selectedCipher.identity.title,
                        vaultStore.selectedCipher.identity.firstName,
                        vaultStore.selectedCipher.identity.middleName,
                        vaultStore.selectedCipher.identity.lastName,
                      ]
                        .filter(Boolean)
                        .join(' ')
                    }}
                  </span>
                </div>
              </div>
              <div v-if="vaultStore.selectedCipher.identity.username" class="data-row">
                <div class="data-label">Логин</div>
                <div class="data-val-group">
                  <span class="data-value">{{ vaultStore.selectedCipher.identity.username }}</span>
                  <button type="button" class="btn-copy" @click="copyToClipboard(vaultStore.selectedCipher.identity.username, 'Логин')">
                    <Copy class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div v-if="vaultStore.selectedCipher.identity.email" class="data-row">
                <div class="data-label">Email</div>
                <div class="data-val-group">
                  <span class="data-value">{{ vaultStore.selectedCipher.identity.email }}</span>
                  <button type="button" class="btn-copy" @click="copyToClipboard(vaultStore.selectedCipher.identity.email, 'Email')">
                    <Copy class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div v-if="vaultStore.selectedCipher.identity.phone" class="data-row">
                <div class="data-label">Телефон</div>
                <div class="data-val-group">
                  <span class="data-value">{{ vaultStore.selectedCipher.identity.phone }}</span>
                  <button type="button" class="btn-copy" @click="copyToClipboard(vaultStore.selectedCipher.identity.phone, 'Телефон')">
                    <Copy class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div v-if="vaultStore.selectedCipher.identity.company" class="data-row">
                <div class="data-label">Компания</div>
                <div class="data-value">{{ vaultStore.selectedCipher.identity.company }}</div>
              </div>
              <div
                v-if="
                  vaultStore.selectedCipher.identity.address1 ||
                  vaultStore.selectedCipher.identity.city ||
                  vaultStore.selectedCipher.identity.country
                "
                class="data-row"
              >
                <div class="data-label">Адрес</div>
                <div class="data-value">
                  {{
                    [
                      vaultStore.selectedCipher.identity.address1,
                      vaultStore.selectedCipher.identity.address2,
                      vaultStore.selectedCipher.identity.city,
                      vaultStore.selectedCipher.identity.state,
                      vaultStore.selectedCipher.identity.postalCode,
                      vaultStore.selectedCipher.identity.country,
                    ]
                      .filter(Boolean)
                      .join(', ')
                  }}
                </div>
              </div>
            </template>

            <!-- Bank Account Viewer (Type 6) -->
            <template v-if="vaultStore.selectedCipher.type === 6 && vaultStore.selectedCipher.bankAccount">
              <div v-if="vaultStore.selectedCipher.bankAccount.bankName" class="data-row">
                <div class="data-label">Банк</div>
                <div class="data-value">{{ vaultStore.selectedCipher.bankAccount.bankName }}</div>
              </div>
              <div v-if="vaultStore.selectedCipher.bankAccount.nameOnAccount" class="data-row">
                <div class="data-label">Владелец</div>
                <div class="data-value">{{ vaultStore.selectedCipher.bankAccount.nameOnAccount }}</div>
              </div>
              <div v-if="vaultStore.selectedCipher.bankAccount.accountNumber" class="data-row">
                <div class="data-label">Номер счёта</div>
                <div class="data-val-group">
                  <span class="data-value font-mono">{{ vaultStore.selectedCipher.bankAccount.accountNumber }}</span>
                  <button type="button" class="btn-copy" @click="copyToClipboard(vaultStore.selectedCipher.bankAccount.accountNumber, 'Номер счёта')">
                    <Copy class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div v-if="vaultStore.selectedCipher.bankAccount.iban" class="data-row">
                <div class="data-label">IBAN</div>
                <div class="data-val-group">
                  <span class="data-value font-mono">{{ vaultStore.selectedCipher.bankAccount.iban }}</span>
                  <button type="button" class="btn-copy" @click="copyToClipboard(vaultStore.selectedCipher.bankAccount.iban, 'IBAN')">
                    <Copy class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div v-if="vaultStore.selectedCipher.bankAccount.swiftCode" class="data-row">
                <div class="data-label">SWIFT / BIC</div>
                <div class="data-value font-mono">{{ vaultStore.selectedCipher.bankAccount.swiftCode }}</div>
              </div>
            </template>

            <!-- Driver's License Viewer (Type 7) -->
            <template v-if="vaultStore.selectedCipher.type === 7 && vaultStore.selectedCipher.driversLicense">
              <div class="data-row">
                <div class="data-label">Владелец</div>
                <div class="data-value">{{ [vaultStore.selectedCipher.driversLicense.firstName, vaultStore.selectedCipher.driversLicense.lastName].filter(Boolean).join(' ') || '—' }}</div>
              </div>
              <div v-if="vaultStore.selectedCipher.driversLicense.licenseNumber" class="data-row">
                <div class="data-label">Номер удостоверения</div>
                <div class="data-val-group">
                  <span class="data-value font-mono">{{ vaultStore.selectedCipher.driversLicense.licenseNumber }}</span>
                  <button type="button" class="btn-copy" @click="copyToClipboard(vaultStore.selectedCipher.driversLicense.licenseNumber, 'Номер ВУ')">
                    <Copy class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div v-if="vaultStore.selectedCipher.driversLicense.issuingCountry || vaultStore.selectedCipher.driversLicense.expirationDate" class="data-row">
                <div class="data-label">Выдано / Срок</div>
                <div class="data-value">{{ [vaultStore.selectedCipher.driversLicense.issuingCountry, vaultStore.selectedCipher.driversLicense.expirationDate].filter(Boolean).join(' • ') }}</div>
              </div>
            </template>

            <!-- Passport Viewer (Type 8) -->
            <template v-if="vaultStore.selectedCipher.type === 8 && vaultStore.selectedCipher.passport">
              <div class="data-row">
                <div class="data-label">Владелец</div>
                <div class="data-value">{{ [vaultStore.selectedCipher.passport.surname, vaultStore.selectedCipher.passport.givenName].filter(Boolean).join(' ') || '—' }}</div>
              </div>
              <div v-if="vaultStore.selectedCipher.passport.passportNumber" class="data-row">
                <div class="data-label">Номер паспорта</div>
                <div class="data-val-group">
                  <span class="data-value font-mono">{{ vaultStore.selectedCipher.passport.passportNumber }}</span>
                  <button type="button" class="btn-copy" @click="copyToClipboard(vaultStore.selectedCipher.passport.passportNumber, 'Номер паспорта')">
                    <Copy class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div v-if="vaultStore.selectedCipher.passport.issuingCountry || vaultStore.selectedCipher.passport.expirationDate" class="data-row">
                <div class="data-label">Страна / Срок</div>
                <div class="data-value">{{ [vaultStore.selectedCipher.passport.issuingCountry, vaultStore.selectedCipher.passport.expirationDate].filter(Boolean).join(' • ') }}</div>
              </div>
            </template>

            <!-- Notes -->
            <div v-if="vaultStore.selectedCipher.notes" class="data-row">
              <div class="data-label">Заметки</div>
              <div class="notes-content">
                {{ vaultStore.selectedCipher.notes }}
              </div>
            </div>

            <!-- Custom Fields Viewer -->
            <div v-if="vaultStore.selectedCipher.fields?.length" class="data-row space-y-2">
              <div class="data-label">Настраиваемые поля</div>
              <div
                v-for="(cf, idx) in vaultStore.selectedCipher.fields"
                :key="idx"
                class="flex items-center justify-between gap-2 p-2 rounded-lg bg-black/25 border border-slate-800/80 text-xs"
              >
                <span class="text-slate-400 font-medium">{{ cf.name }}</span>
                <div class="flex items-center gap-1.5">
                  <span class="font-mono text-slate-200">
                    {{ cf.type === 1 && !showHiddenFields[idx] ? '••••••••' : cf.value }}
                  </span>
                  <button
                    v-if="cf.type === 1"
                    type="button"
                    class="btn-copy"
                    @click="runWithReprompt(() => { showHiddenFields[idx] = !showHiddenFields[idx] })"
                  >
                    <component :is="showHiddenFields[idx] ? EyeOff : Eye" class="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    class="btn-copy"
                    @click="copyToClipboard(cf.value, cf.name, cf.type === 1)"
                  >
                    <Copy class="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Passkeys (FIDO2 Credentials) -->
            <div v-if="vaultStore.selectedCipher.login?.fido2Credentials?.length" class="data-row">
              <div class="data-label flex items-center gap-1.5">
                <KeyRound class="w-3.5 h-3.5 text-sky-400" />
                <span>Passkeys (FIDO2): {{ vaultStore.selectedCipher.login.fido2Credentials.length }}</span>
              </div>
              <div
                v-for="(pk, idx) in vaultStore.selectedCipher.login.fido2Credentials"
                :key="idx"
                class="text-xs text-slate-300 bg-black/25 border border-slate-800 rounded p-2 mt-1"
              >
                {{ pk.rpName || pk.rpId || 'Passkey' }} • {{ pk.userName || pk.credentialId }}
              </div>
            </div>

            <!-- Encrypted Attachments -->
            <div class="data-row">
              <div class="flex items-center justify-between mb-1.5">
                <span class="data-label flex items-center gap-1.5 !mb-0">
                  <Paperclip class="w-3.5 h-3.5 text-amber-400" />
                  <span>Вложения ({{ vaultStore.selectedCipher.attachments?.length || 0 }})</span>
                </span>
                <input ref="attachmentInputRef" type="file" class="hidden" @change="handleAttachmentUpload" />
                <button
                  v-if="!vaultStore.selectedCipher.deletedDate"
                  type="button"
                  class="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1"
                  :disabled="uploadingAttachment"
                  @click="attachmentInputRef?.click()"
                >
                  <Upload class="w-3.5 h-3.5" />
                  <span>{{ uploadingAttachment ? 'Загрузка...' : 'Прикрепить файл' }}</span>
                </button>
              </div>
              <div
                v-for="att in (vaultStore.selectedCipher.attachments || [])"
                :key="att.id"
                class="flex items-center justify-between text-xs bg-black/25 border border-slate-800 rounded-lg px-2.5 py-1.5 mt-1"
              >
                <span class="truncate text-slate-200">{{ att.fileName }} <span class="text-slate-500">({{ att.sizeName || att.size }})</span></span>
                <div class="flex items-center gap-2 shrink-0">
                  <button type="button" class="text-sky-400 hover:text-sky-300" @click="handleAttachmentDownload(att)" title="Скачать">
                    <Download class="w-3.5 h-3.5" />
                  </button>
                  <button type="button" class="text-rose-400 hover:text-rose-300" @click="handleAttachmentDelete(att.id)" title="Удалить">
                    <Trash2 class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Password History -->
            <div v-if="vaultStore.selectedCipher.passwordHistory?.length" class="data-row">
              <button
                type="button"
                class="text-xs text-slate-400 hover:text-sky-400 flex items-center gap-1.5"
                @click="showHistory = !showHistory"
              >
                <History class="w-3.5 h-3.5" />
                <span>История паролей ({{ vaultStore.selectedCipher.passwordHistory.length }})</span>
              </button>
              <div v-if="showHistory" class="mt-2 space-y-1.5">
                <div
                  v-for="(h, idx) in vaultStore.selectedCipher.passwordHistory"
                  :key="idx"
                  class="flex items-center justify-between text-[11px] bg-black/30 border border-slate-800 rounded px-2.5 py-1.5"
                >
                  <div>
                    <div class="font-mono text-slate-200">{{ h.password }}</div>
                    <div class="text-slate-500">{{ new Date(h.lastUsedDate).toLocaleString('ru-RU') }}</div>
                  </div>
                  <button type="button" class="btn-copy" @click="copyToClipboard(h.password, 'Предыдущий пароль', true)">
                    <Copy class="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 3C. Empty State Placeholder -->
        <div v-else class="empty-placeholder">
          <img :src="openStorageSrc" alt="Vault Open" class="placeholder-lock" />
          <h3 class="placeholder-title">Хранилище разблокировано</h3>
          <p class="placeholder-desc">
            Выберите элемент в списке слева или нажмите «Новый элемент» для создания записи
          </p>
        </div>
      </section>
    </div>

    <!-- Create / Rename Folder Modal -->
    <div v-if="showFolderModal" class="modal-backdrop" @click.self="showFolderModal = false">
      <div class="modal-card">
        <h3 class="modal-title">
          {{ editingFolderId ? 'Переименовать папку' : 'Создать новую папку' }}
        </h3>
        <p class="modal-desc">
          {{ editingFolderId ? 'Введите новое название папки:' : 'Название папки будет зашифровано нулевым разглашением:' }}
        </p>
        <input
          v-model="newFolderName"
          type="text"
          placeholder="Например: Личные, Работа, Серверы"
          class="cyber-input mb-4"
          @keyup.enter="handleCreateOrUpdateFolder"
          autofocus
        />
        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="cyber-btn-secondary"
            @click="showFolderModal = false"
          >
            Отмена
          </button>
          <button
            type="button"
            class="cyber-btn-primary"
            @click="handleCreateOrUpdateFolder"
          >
            {{ editingFolderId ? 'Сохранить' : 'Создать' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Master Password Reprompt Modal -->
    <div v-if="repromptAction" class="modal-backdrop" @click.self="repromptAction = null">
      <div class="modal-card">
        <h3 class="modal-title">Подтверждение мастер-пароля</h3>
        <p class="modal-desc">Эта запись защищена повторным запросом мастер-пароля (Master Password Reprompt).</p>
        <div v-if="repromptError" class="text-xs text-rose-400 mb-3">{{ repromptError }}</div>
        <input
          v-model="repromptPassword"
          type="password"
          placeholder="Введите мастер-пароль"
          class="cyber-input mb-4"
          @keyup.enter="confirmReprompt"
          autofocus
        />
        <div class="flex justify-end gap-2">
          <button type="button" class="cyber-btn-secondary" @click="repromptAction = null">Отмена</button>
          <button type="button" class="cyber-btn-primary" :disabled="repromptVerifying" @click="confirmReprompt">
            {{ repromptVerifying ? 'Проверка...' : 'Подтвердить' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Share / Organization Collections Modal -->
    <div v-if="showShareModal" class="modal-backdrop" @click.self="showShareModal = false">
      <div class="modal-card">
        <h3 class="modal-title">
          {{ vaultStore.selectedCipher?.organizationId ? 'Коллекции организации' : 'Перенести в организацию' }}
        </h3>
        <p class="modal-desc">
          Запись шифруется ключом организации. Выберите целевую организацию и коллекции:
        </p>
        <div v-if="!vaultStore.selectedCipher?.organizationId" class="mb-3">
          <label class="detail-label">Организация</label>
          <select v-model="shareOrgId" class="cyber-select">
            <option v-for="o in authStore.organizations" :key="o.id" :value="o.id">{{ o.name }}</option>
          </select>
        </div>
        <div class="mb-4 max-h-48 overflow-y-auto space-y-1.5 border border-slate-800 rounded-lg p-2 bg-black/20">
          <div v-if="availableOrgCollections.length === 0" class="text-xs text-slate-500 p-2">Нет доступных коллекций</div>
          <label
            v-for="col in availableOrgCollections"
            :key="col.id"
            class="flex items-center gap-2 text-xs text-slate-200 p-1.5 rounded hover:bg-slate-800/60 cursor-pointer"
          >
            <input type="checkbox" :value="col.id" v-model="shareCollectionIds" class="accent-sky-500" />
            <span>{{ col.name }}</span>
          </label>
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" class="cyber-btn-secondary" @click="showShareModal = false">Отмена</button>
          <button type="button" class="cyber-btn-primary" :disabled="isSharingCipher" @click="handleConfirmShare">
            {{ isSharingCipher ? 'Сохранение...' : 'Применить' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Integrated Tool & Settings Modals -->
    <ToolModalShell
      :open="activeToolModal === 'settings'"
      title="Настройки аккаунта и безопасности"
      subtitle="Профиль, защита Argon2id, 2FA, экспорт и внешний вид"
      max-width="860px"
      accent="sky"
      @close="activeToolModal = null"
    >
      <template #icon><Settings class="w-5 h-5" /></template>
      <SettingsView :modal="true" :initial-tab="settingsInitialTab" @close="activeToolModal = null" />
    </ToolModalShell>

    <ToolModalShell
      :open="activeToolModal === 'generator'"
      title="Генератор паролей Novus"
      subtitle="Криптографическая генерация высокой энтропии (CSPRNG)"
      max-width="640px"
      accent="indigo"
      @close="activeToolModal = null"
    >
      <template #icon><Wand2 class="w-5 h-5" /></template>
      <GeneratorView :modal="true" />
    </ToolModalShell>

    <ToolModalShell
      :open="activeToolModal === 'sentinel'"
      title="Novus Sentinel • Аудит безопасности"
      subtitle="Локальный Zero-Knowledge анализ уязвимостей хранилища"
      max-width="780px"
      accent="amber"
      @close="activeToolModal = null"
    >
      <template #icon><Sparkles class="w-5 h-5" /></template>
      <SentinelView
        :modal="true"
        @select-item="(id) => { vaultStore.selectedCipherId = id; isEditing = false; }"
        @close="activeToolModal = null"
      />
    </ToolModalShell>

    <ToolModalShell
      :open="activeToolModal === 'send'"
      title="Novus Send • Защищённая передача"
      subtitle="Сквозное шифрование текстов и файлов с автоудалением"
      max-width="760px"
      accent="teal"
      @close="activeToolModal = null"
    >
      <template #icon><Send class="w-5 h-5" /></template>
      <SendView :modal="true" />
    </ToolModalShell>

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
.vault-app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-height: 100vh;
  overflow: hidden;
  background-color: var(--page-bg, #010811);
  color: var(--text-primary, #f8fafc);
}

/* Header */
.app-header {
  height: 52px;
  border-bottom: 1px solid var(--card-border, #1e293b);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: var(--header-bg, rgba(10, 18, 35, 0.92));
  backdrop-filter: blur(12px);
  z-index: 50;
}

.header-left {
  display: flex;
  align-items: center;
}

.header-logo {
  height: 32px;
  width: auto;
  object-fit: contain;
}

.header-search {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  max-width: 400px;
}

.search-icon {
  position: absolute;
  left: 10px;
  width: 15px;
  height: 15px;
  color: var(--text-muted, #64748b);
  pointer-events: none;
}

.search-input {
  width: 100%;
  height: 34px;
  background: var(--input-bg, rgba(3, 7, 18, 0.8));
  border: 1px solid var(--input-border, #334155);
  border-radius: 8px;
  padding: 0 12px 0 32px;
  font-size: 12.5px;
  color: var(--text-primary, #f8fafc);
  outline: none;
  transition: all 0.2s ease;
}

.search-input:focus {
  border-color: #38bdf8;
  box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.25);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-icon-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  color: var(--text-secondary, #94a3b8);
  cursor: pointer;
  transition: all 0.2s ease;
}

.header-icon-btn:hover {
  background: var(--hover-bg, rgba(255, 255, 255, 0.06));
  color: var(--text-primary, #f8fafc);
}

.theme-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 10px;
  border-radius: 9px;
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  background: var(--input-bg, rgba(15, 23, 42, 0.6));
  border: 1px solid var(--card-border, rgba(56, 189, 248, 0.22));
  color: var(--text-primary, #f8fafc);
  transition: all 0.18s ease;
}

.theme-pill:hover {
  border-color: #38bdf8;
  background: var(--active-bg, rgba(14, 165, 233, 0.12));
}

.profile-pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 32px;
  padding: 0 9px 0 4px;
  border-radius: 9px;
  background: var(--input-bg, rgba(15, 23, 42, 0.6));
  border: 1px solid var(--card-border, rgba(56, 189, 248, 0.22));
  color: var(--text-primary, #f8fafc);
  cursor: pointer;
  transition: all 0.18s ease;
}

.profile-pill:hover {
  border-color: #38bdf8;
  background: var(--active-bg, rgba(14, 165, 233, 0.12));
}

.avatar-circle {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: linear-gradient(135deg, #0284c7 0%, #38bdf8 100%);
  color: #ffffff;
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.profile-pill-email {
  font-size: 11.5px;
  font-weight: 600;
  max-width: 130px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Dropdown Popovers */
.dropdown-popover {
  position: absolute;
  top: calc(100% + 6px);
  background: var(--card-bg, #0b1329);
  border: 1px solid var(--card-border, rgba(56, 189, 248, 0.3));
  border-radius: 10px;
  padding: 4px;
  box-shadow: 0 15px 35px -5px rgba(0, 0, 0, 0.7);
  z-index: 100;
  min-width: 180px;
}

.dropdown-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--text-primary, #f8fafc);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
}

.dropdown-item:hover {
  background: var(--hover-bg, rgba(255, 255, 255, 0.08));
}

/* Workspace 3-Column */
.workspace-body {
  display: grid;
  grid-template-columns: 240px 330px 1fr;
  flex: 1;
  overflow: hidden;
}

/* 1. Sidebar Nav */
.sidebar-nav {
  border-right: 1px solid var(--card-border, #1e293b);
  background: var(--sidebar-bg, #070e1c);
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
}

.nav-section {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-section-title {
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-muted, #64748b);
  letter-spacing: 0.05em;
  padding: 0 8px;
  margin-bottom: 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 8px;
  font-size: 12.5px;
  color: var(--text-secondary, #94a3b8);
  background: transparent;
  border: none;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.15s ease;
}

.nav-item:hover {
  background: var(--hover-bg, rgba(255, 255, 255, 0.05));
  color: var(--text-primary, #ffffff);
}

.nav-item.active {
  background: var(--active-bg, rgba(14, 165, 233, 0.15));
  border: 1px solid var(--active-border, rgba(56, 189, 248, 0.35));
  color: #38bdf8;
  font-weight: 600;
}

.badge {
  font-size: 10.5px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-secondary, #94a3b8);
}

.divider {
  height: 1px;
  background: var(--card-border, rgba(56, 189, 248, 0.12));
  margin: 4px 4px;
}

/* Folder List Row */
.folder-add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: rgba(14, 165, 233, 0.12);
  border: 1px solid rgba(56, 189, 248, 0.3);
  color: #38bdf8;
  cursor: pointer;
  transition: all 0.15s ease;
}

.folder-add-btn:hover {
  background: rgba(14, 165, 233, 0.25);
  border-color: #38bdf8;
  color: #7dd3fc;
}

.folder-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-radius: 8px;
  transition: all 0.15s ease;
}

.folder-row:hover {
  background: var(--hover-bg, rgba(255, 255, 255, 0.04));
}

.folder-row.active {
  background: var(--active-bg, rgba(14, 165, 233, 0.14));
  border: 1px solid var(--active-border, rgba(56, 189, 248, 0.35));
}

.folder-row.active span {
  color: #38bdf8;
  font-weight: 600;
}

/* 2. Middle List Pane */
.items-list-pane {
  border-right: 1px solid var(--card-border, #1e293b);
  display: flex;
  flex-direction: column;
  background: var(--page-bg, #010811);
  overflow: hidden;
}

.pane-header {
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  border-bottom: 1px solid var(--card-border, #1e293b);
}

.items-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.item-card {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px 9px;
  border-radius: 10px;
  background: transparent;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.15s ease;
}

.item-card:hover {
  background: var(--hover-bg, rgba(255, 255, 255, 0.04));
}

.item-card.active {
  background: var(--active-bg, rgba(14, 165, 233, 0.12));
  border-color: var(--active-border, rgba(56, 189, 248, 0.35));
}

.quick-copy-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.14s ease;
}

.item-card:hover .quick-copy-actions,
.item-card.active .quick-copy-actions {
  opacity: 1;
}

.quick-copy-btn {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-muted, #64748b);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;
}

.quick-copy-btn:hover {
  color: #38bdf8;
  background: rgba(56, 189, 248, 0.14);
  border-color: rgba(56, 189, 248, 0.3);
}

.item-icon-box {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.item-info {
  flex: 1;
  min-width: 0;
}

.item-name {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-primary, #f8fafc);
}

.item-sub {
  font-size: 11px;
  color: var(--text-secondary, #94a3b8);
}

.star-btn {
  background: transparent;
  border: none;
  color: #475569;
  cursor: pointer;
  padding: 4px;
}

.star-btn.active {
  color: #f59e0b;
}

.star-btn:hover {
  color: #fbbf24;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 50px 20px;
  text-align: center;
}

.empty-icon-wrap {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: rgba(14, 165, 233, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}

.empty-title {
  font-size: 13.5px;
  font-weight: 600;
  margin: 0 0 4px 0;
}

.empty-desc {
  font-size: 11.5px;
  color: var(--text-muted, #64748b);
  max-width: 200px;
  margin: 0;
}

/* 3. Right Detail Pane */
.detail-pane {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--page-bg, #010811);
}

.view-container,
.edit-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.detail-header {
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  border-bottom: 1px solid var(--card-border, #1e293b);
  background: var(--header-bg, rgba(10, 18, 35, 0.92));
}

.detail-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 680px;
}

.data-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.data-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted, #64748b);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.data-val-group {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--input-bg, rgba(3, 7, 18, 0.8));
  border: 1px solid var(--input-border, #1e293b);
  border-radius: 8px;
  padding: 8px 12px;
}

.data-value {
  flex: 1;
  font-size: 13px;
  color: var(--text-primary, #f8fafc);
  word-break: break-all;
}

.data-link {
  flex: 1;
  font-size: 13px;
  color: #38bdf8;
  text-decoration: none;
}

.data-link:hover {
  text-decoration: underline;
}

.btn-copy {
  background: transparent;
  border: none;
  color: var(--text-muted, #64748b);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-copy:hover {
  color: #38bdf8;
  background: rgba(255, 255, 255, 0.06);
}

/* Edit Form Specific */
.field-box {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-label {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--text-secondary, #cbd5e1);
}

.cyber-input-wrapper {
  position: relative !important;
  display: flex !important;
  align-items: center !important;
  width: 100% !important;
}

.password-toggle-btn {
  position: absolute !important;
  right: 8px !important;
  top: 50% !important;
  transform: translateY(-50%) !important;
  width: 28px !important;
  height: 28px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  background: transparent !important;
  border: none !important;
  color: var(--text-muted, #94a3b8) !important;
  cursor: pointer !important;
  border-radius: 6px !important;
  transition: all 0.2s ease !important;
}

.password-toggle-btn:hover {
  color: #38bdf8 !important;
  background: rgba(56, 189, 248, 0.12) !important;
}

.btn-generate {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  background: rgba(14, 165, 233, 0.12);
  border: 1px solid rgba(56, 189, 248, 0.3);
  border-radius: 6px;
  color: #38bdf8;
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-generate:hover {
  background: rgba(14, 165, 233, 0.24);
  border-color: #38bdf8;
  color: #7dd3fc;
}

/* Live TOTP Card */
.totp-card {
  background: rgba(14, 165, 233, 0.08);
  border: 1px solid rgba(56, 189, 248, 0.35);
  border-radius: 12px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.totp-digits {
  font-size: 24px;
  font-family: monospace;
  font-weight: 800;
  letter-spacing: 0.1em;
  color: #38bdf8;
}

.totp-timer-badge {
  font-size: 11px;
  font-weight: 700;
  background: rgba(14, 165, 233, 0.2);
  color: #38bdf8;
  padding: 2px 8px;
  border-radius: 999px;
}

.totp-progress-track {
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
}

.totp-progress-fill {
  height: 100%;
  background: #38bdf8;
  transition: width 1s linear;
}

.notes-content {
  background: var(--input-bg, rgba(3, 7, 18, 0.8));
  border: 1px solid var(--input-border, #1e293b);
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 12.5px;
  white-space: pre-wrap;
  color: var(--text-secondary, #cbd5e1);
}

/* Empty Placeholder */
.empty-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 40px;
  text-align: center;
}

.placeholder-lock {
  width: 72px;
  height: 72px;
  object-fit: contain;
  margin-bottom: 16px;
  opacity: 0.85;
}

.placeholder-title {
  font-size: 16px;
  font-weight: 700;
  margin: 0 0 6px 0;
}

.placeholder-desc {
  font-size: 12px;
  color: var(--text-muted, #64748b);
  max-width: 280px;
  margin: 0;
}

/* Toast */
.toast-popup {
  position: fixed;
  bottom: 24px;
  right: 24px;
  background: rgba(15, 23, 42, 0.95);
  border: 1px solid rgba(56, 189, 248, 0.4);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  padding: 10px 16px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  font-weight: 600;
  color: #f8fafc;
  z-index: 9999;
}

.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: all 0.2s ease;
}

.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

/* Modal */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(6px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.modal-card {
  width: 100%;
  max-width: 400px;
  background: var(--card-bg, #0b1329);
  border: 1px solid var(--card-border, rgba(56, 189, 248, 0.3));
  border-radius: 14px;
  padding: 22px;
  box-shadow: 0 20px 45px rgba(0, 0, 0, 0.6);
}

.modal-title {
  font-size: 15px;
  font-weight: 700;
  margin: 0 0 6px 0;
}

.modal-desc {
  font-size: 12px;
  color: var(--text-secondary, #94a3b8);
  margin: 0 0 14px 0;
}
</style>
