<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.ts';
import { useVaultStore } from '../stores/vault.ts';
import { useThemeStore } from '../stores/theme.ts';
import { useI18n } from '@shared/i18n.ts';
import { confirmDialog } from '@shared/dialogs.ts';
import { api } from '../api/client.ts';
import { generateKeyPair, encryptWithPublicKey } from '../crypto/asymmetric.ts';
import { encrypt, decrypt } from '../crypto/symmetric.ts';
import { deriveMasterKey, hashMasterPassword, KdfConfig } from '../crypto/kdf.ts';
import { getRandomBytes } from '../crypto/utils.ts';
import {
  Building2,
  ArrowLeft,
  Plus,
  Users,
  FolderKanban,
  ShieldCheck,
  Activity,
  Download,
  Trash2,
  UserPlus,
  CheckCircle2,
  Ban,
  RotateCcw,
  Sun,
  Moon,
  Monitor,
  Globe,
  RefreshCw,
  Layers,
  KeyRound,
} from 'lucide-vue-next';

const router = useRouter();
const authStore = useAuthStore();
const vaultStore = useVaultStore();
const themeStore = useThemeStore();
const { t, locale, cycleLocale } = useI18n();

const activeOrgId = ref<string>(authStore.organizations[0]?.id || '');
const activeTab = ref<'overview' | 'members' | 'collections' | 'groups' | 'policies' | 'events' | 'twoFactor'>('overview');
const loading = ref(false);
const toast = ref<string | null>(null);

function showToast(msg: string) {
  toast.value = msg;
  setTimeout(() => {
    toast.value = null;
  }, 3200);
}

const activeOrg = computed(() => authStore.organizations.find((o) => o.id === activeOrgId.value) || null);
const orgSymKey = computed(() => (activeOrgId.value ? authStore.orgKeys[activeOrgId.value] || null : null));

const orgDetails = ref<any>(null);
const members = ref<any[]>([]);
const collections = ref<Array<{ id: string; name: string; readOnly?: boolean; hidePasswords?: boolean }>>([]);
const groups = ref<any[]>([]);
const policies = ref<any[]>([]);
const events = ref<any[]>([]);

// Create Org modal
const showCreateModal = ref(false);
const createOrgName = ref('');
const createOrgEmail = ref(authStore.savedEmail || '');
const createOrgCollection = ref('Общая коллекция');
const creatingOrg = ref(false);

// Edit / Delete Org
const editOrgName = ref('');
const editOrgEmail = ref('');
const deleteOrgPassword = ref('');

// Invite member
const inviteEmails = ref('');
const inviteType = ref<number>(2); // 0=Owner, 1=Admin, 2=User, 3=Manager

// Create collection
const newCollectionName = ref('');

// Create group
const newGroupName = ref('');
const newGroupAccessAll = ref(false);

// Duo 2FA
const duoPassword = ref('');
const duoInfo = ref<{ enabled: boolean; host: string; clientId: string; clientSecret: string; token: string } | null>(null);

const POLICY_CATALOG = [
  { type: 0, name: 'Требовать 2FA (Two-Step Login)', desc: 'Обязательная двухфакторная аутентификация для всех участников.' },
  { type: 1, name: 'Политика сложности мастер-пароля', desc: 'Минимальная длина и требования к символам мастер-пароля.' },
  { type: 2, name: 'Политика генератора паролей', desc: 'Принудительные параметры минимальной длины и наборов символов.' },
  { type: 3, name: 'Только одна организация (Single Org)', desc: 'Запретить участникам вступление в сторонние организации.' },
  { type: 5, name: 'Запрет личного хранилища (Personal Ownership)', desc: 'Новые записи должны сохраняться только в организации.' },
  { type: 6, name: 'Запрет Bitwarden Send (Disable Send)', desc: 'Отключить создание и отправку Send-ссылок.' },
  { type: 7, name: 'Ограничения параметров Send', desc: 'Запретить скрытие email в настройках Send.' },
  { type: 8, name: 'Восстановление аккаунта администратором', desc: 'Разрешить администраторам сбрасывать пароль подтверждённых участников.' },
  { type: 14, name: 'Запретить разблокировку по PIN', desc: 'Требовать ввод мастер-пароля вместо PIN-кода.' },
];

async function safeOrgDecrypt(val: string): Promise<string> {
  if (!val) return '';
  if (!orgSymKey.value) return val;
  try {
    return await decrypt(val, orgSymKey.value);
  } catch {
    return val;
  }
}

async function loadActiveOrgData() {
  if (!authStore.token || !activeOrgId.value) return;
  loading.value = true;
  try {
    const [details, usersRes, colsRes, grpRes, polRes, evtRes] = await Promise.all([
      api.getOrganization(authStore.token, activeOrgId.value).catch(() => null),
      api.getOrgUsers(authStore.token, activeOrgId.value),
      api.getOrgCollectionsDetails(authStore.token, activeOrgId.value),
      api.getOrgGroupsDetails(authStore.token, activeOrgId.value),
      api.getOrgPolicies(authStore.token, activeOrgId.value),
      api.getOrgEvents(authStore.token, activeOrgId.value),
    ]);
    orgDetails.value = details;
    editOrgName.value = details?.name || activeOrg.value?.name || '';
    editOrgEmail.value = details?.billingEmail || '';
    members.value = usersRes;

    const decCols = [];
    for (const c of colsRes) {
      decCols.push({ ...c, name: await safeOrgDecrypt(c.name) });
    }
    collections.value = decCols;
    groups.value = grpRes;
    policies.value = polRes;
    events.value = evtRes;
  } finally {
    loading.value = false;
  }
}

watch(activeOrgId, () => {
  duoInfo.value = null;
  loadActiveOrgData();
});

onMounted(async () => {
  await vaultStore.sync();
  if (!activeOrgId.value && authStore.organizations.length > 0) {
    activeOrgId.value = authStore.organizations[0].id;
  }
  await loadActiveOrgData();
});

async function handleCreateOrganization() {
  if (!authStore.token || !createOrgName.value.trim() || !createOrgEmail.value.trim()) {
    showToast('Укажите название организации и billing email');
    return;
  }
  creatingOrg.value = true;
  try {
    let myPubKey = '';
    if (authStore.profile?.id) {
      const pk = await api.getUserPublicKey(authStore.token, authStore.profile.id);
      myPubKey = pk.publicKey;
    }
    if (!myPubKey) throw new Error('Не найден публичный RSA-ключ пользователя');

    const rawOrgSymKey = getRandomBytes(64);
    const wrappedOrgKeyForOwner = await encryptWithPublicKey(rawOrgSymKey, myPubKey);
    const orgRsaPair = await generateKeyPair(rawOrgSymKey);
    const encCollectionName = (await encrypt(createOrgCollection.value.trim() || 'Default Collection', rawOrgSymKey)).toString();

    const created = await api.createOrganization(authStore.token, {
      name: createOrgName.value.trim(),
      billingEmail: createOrgEmail.value.trim(),
      collectionName: encCollectionName,
      key: wrappedOrgKeyForOwner,
      keys: {
        publicKey: orgRsaPair.publicKey,
        encryptedPrivateKey: orgRsaPair.encryptedPrivateKey,
      },
      planType: 5, // Enterprise
    });

    showCreateModal.value = false;
    createOrgName.value = '';
    await vaultStore.sync();
    activeOrgId.value = created.id;
    showToast(`Организация «${created.name}» создана`);
  } catch (err: any) {
    showToast(err?.message || 'Ошибка создания организации');
  } finally {
    creatingOrg.value = false;
  }
}

async function handleUpdateOrg() {
  if (!authStore.token || !activeOrgId.value) return;
  try {
    await api.updateOrganization(authStore.token, activeOrgId.value, {
      name: editOrgName.value.trim(),
      billingEmail: editOrgEmail.value.trim(),
    });
    await vaultStore.sync();
    await loadActiveOrgData();
    showToast('Настройки организации сохранены');
  } catch (err: any) {
    showToast(err?.message || 'Ошибка сохранения настроек');
  }
}

async function handleDeleteOrg() {
  if (!authStore.token || !activeOrgId.value || !deleteOrgPassword.value) {
    showToast('Введите мастер-пароль для подтверждения удаления организации');
    return;
  }
  const ok = await confirmDialog({
    title: 'Удалить организацию?',
    message: `Организация «${activeOrg.value?.name}», её коллекции и общие записи будут удалены безвозвратно.`,
    confirmLabel: 'Удалить организацию',
    danger: true,
  });
  if (!ok) return;
  try {
    const pre = await api.prelogin(authStore.savedEmail);
    const cfg: KdfConfig = {
      kdfType: pre.Kdf ?? pre.kdf ?? 0,
      iterations: pre.KdfIterations ?? pre.kdfIterations ?? 600000,
      memory: pre.KdfMemory ?? pre.kdfMemory ?? undefined,
      parallelism: pre.KdfParallelism ?? pre.kdfParallelism ?? undefined,
    };
    const mk = await deriveMasterKey(deleteOrgPassword.value, authStore.savedEmail, cfg);
    const hash = await hashMasterPassword(mk, deleteOrgPassword.value);
    await api.deleteOrganization(authStore.token, activeOrgId.value, hash);
    deleteOrgPassword.value = '';
    await vaultStore.sync();
    activeOrgId.value = authStore.organizations[0]?.id || '';
    showToast('Организация удалена');
  } catch (err: any) {
    showToast(err?.message || 'Не удалось удалить организацию');
  }
}

async function handleInviteMember() {
  if (!authStore.token || !activeOrgId.value || !inviteEmails.value.trim()) return;
  const emails = inviteEmails.value
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);
  try {
    await api.inviteOrgUser(authStore.token, activeOrgId.value, {
      emails,
      type: inviteType.value,
      groups: [],
      collections: [],
    });
    inviteEmails.value = '';
    await loadActiveOrgData();
    showToast('Приглашение отправлено');
  } catch (err: any) {
    showToast(err?.message || 'Ошибка приглашения участника');
  }
}

async function handleConfirmMember(m: any) {
  if (!authStore.token || !activeOrgId.value || !orgSymKey.value) {
    showToast('Ключ организации не расшифрован в текущей сессии');
    return;
  }
  try {
    const pk = await api.getUserPublicKey(authStore.token, m.userId);
    const encOrgKey = await encryptWithPublicKey(orgSymKey.value, pk.publicKey);
    await api.confirmOrgUser(authStore.token, activeOrgId.value, m.id, encOrgKey);
    await loadActiveOrgData();
    showToast(`Участник ${m.email} подтверждён с ключом организации`);
  } catch (err: any) {
    showToast(err?.message || 'Ошибка подтверждения участника');
  }
}

async function handleChangeMemberRole(m: any, nextRole: number) {
  if (!authStore.token || !activeOrgId.value) return;
  try {
    await api.editOrgUser(authStore.token, activeOrgId.value, m.id, { type: nextRole, groups: [], collections: [] });
    await loadActiveOrgData();
    showToast('Роль участника обновлена');
  } catch (err: any) {
    showToast(err?.message || 'Ошибка изменения роли');
  }
}

async function handleRevokeRestoreMember(m: any) {
  if (!authStore.token || !activeOrgId.value) return;
  try {
    if (m.status < 0) {
      await api.restoreOrgUser(authStore.token, activeOrgId.value, m.id);
      showToast('Доступ участника восстановлен');
    } else {
      await api.revokeOrgUser(authStore.token, activeOrgId.value, m.id);
      showToast('Доступ участника отозван');
    }
    await loadActiveOrgData();
  } catch (err: any) {
    showToast(err?.message || 'Ошибка изменения статуса участника');
  }
}

async function handleDeleteMember(m: any) {
  if (!authStore.token || !activeOrgId.value) return;
  const ok = await confirmDialog({
    title: 'Удалить участника?',
    message: `Участник ${m.email} потеряет доступ к коллекциям этой организации.`,
    confirmLabel: 'Удалить',
    danger: true,
  });
  if (!ok) return;
  try {
    await api.deleteOrgUser(authStore.token, activeOrgId.value, m.id);
    await loadActiveOrgData();
    showToast('Участник удалён из организации');
  } catch (err: any) {
    showToast(err?.message || 'Ошибка удаления участника');
  }
}

async function handleCreateCollection() {
  if (!authStore.token || !activeOrgId.value || !newCollectionName.value.trim() || !orgSymKey.value) {
    showToast('Введите название коллекции (и убедитесь, что ключ организации разблокирован)');
    return;
  }
  try {
    const encName = (await encrypt(newCollectionName.value.trim(), orgSymKey.value)).toString();
    await api.createOrgCollection(authStore.token, activeOrgId.value, encName);
    newCollectionName.value = '';
    await vaultStore.sync();
    await loadActiveOrgData();
    showToast('Коллекция создана');
  } catch (err: any) {
    showToast(err?.message || 'Ошибка создания коллекции');
  }
}

async function handleDeleteCollection(colId: string) {
  if (!authStore.token || !activeOrgId.value) return;
  const ok = await confirmDialog({
    title: 'Удалить коллекцию?',
    message: 'Коллекция будет удалена из организации.',
    confirmLabel: 'Удалить',
    danger: true,
  });
  if (!ok) return;
  try {
    await api.deleteOrgCollection(authStore.token, activeOrgId.value, colId);
    await vaultStore.sync();
    await loadActiveOrgData();
    showToast('Коллекция удалена');
  } catch (err: any) {
    showToast(err?.message || 'Ошибка удаления коллекции');
  }
}

async function handleCreateGroup() {
  if (!authStore.token || !activeOrgId.value || !newGroupName.value.trim()) return;
  try {
    await api.createOrgGroup(authStore.token, activeOrgId.value, {
      name: newGroupName.value.trim(),
      accessAll: newGroupAccessAll.value,
      collections: [],
      users: [],
    });
    newGroupName.value = '';
    await loadActiveOrgData();
    showToast('Группа создана');
  } catch (err: any) {
    showToast(err?.message || 'Ошибка создания группы');
  }
}

async function handleDeleteGroup(groupId: string) {
  if (!authStore.token || !activeOrgId.value) return;
  const ok = await confirmDialog({
    title: 'Удалить группу?',
    message: 'Группа доступа будет удалена из организации.',
    confirmLabel: 'Удалить',
    danger: true,
  });
  if (!ok) return;
  try {
    await api.deleteOrgGroup(authStore.token, activeOrgId.value, groupId);
    await loadActiveOrgData();
    showToast('Группа удалена');
  } catch (err: any) {
    showToast(err?.message || 'Ошибка удаления группы');
  }
}

function isPolicyEnabled(polType: number): boolean {
  return !!policies.value.find((p) => p.type === polType)?.enabled;
}

async function handleTogglePolicy(polType: number) {
  if (!authStore.token || !activeOrgId.value) return;
  const nextEnabled = !isPolicyEnabled(polType);
  const existingData = policies.value.find((p) => p.type === polType)?.data || null;
  try {
    await api.updateOrgPolicy(authStore.token, activeOrgId.value, polType, nextEnabled, existingData);
    await loadActiveOrgData();
    showToast(`Политика #${polType} ${nextEnabled ? 'включена' : 'отключена'}`);
  } catch (err: any) {
    showToast(err?.message || 'Ошибка обновления политики');
  }
}

async function handleExportOrg() {
  if (!authStore.token || !activeOrgId.value) return;
  try {
    const raw = await api.exportOrgVault(authStore.token, activeOrgId.value);
    const outCols = [];
    for (const c of raw.collections || []) {
      outCols.push({ id: c.id, name: await safeOrgDecrypt(c.name) });
    }
    const outCiphers = [];
    for (const c of raw.ciphers || []) {
      outCiphers.push({
        id: c.id,
        type: c.type,
        name: await safeOrgDecrypt(c.name),
        notes: c.notes ? await safeOrgDecrypt(c.notes) : null,
        collectionIds: c.collectionIds || [],
      });
    }
    const blob = new Blob([JSON.stringify({ encrypted: false, collections: outCols, items: outCiphers }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `org_${activeOrg.value?.name || activeOrgId.value}_export.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Экспорт организации сохранён');
  } catch (err: any) {
    showToast(err?.message || 'Ошибка экспорта организации');
  }
}

async function handleLoadOrgDuo() {
  if (!authStore.token || !activeOrgId.value || !duoPassword.value) return;
  try {
    const pre = await api.prelogin(authStore.savedEmail);
    const cfg: KdfConfig = {
      kdfType: pre.Kdf ?? pre.kdf ?? 0,
      iterations: pre.KdfIterations ?? pre.kdfIterations ?? 600000,
      memory: pre.KdfMemory ?? pre.kdfMemory ?? undefined,
      parallelism: pre.KdfParallelism ?? pre.kdfParallelism ?? undefined,
    };
    const mk = await deriveMasterKey(duoPassword.value, authStore.savedEmail, cfg);
    const hash = await hashMasterPassword(mk, duoPassword.value);
    const res = await api.getOrgDuo2fa(authStore.token, activeOrgId.value, hash);
    duoInfo.value = {
      enabled: !!res.duo?.enabled,
      host: res.duo?.host || '',
      clientId: res.duo?.clientId || '',
      clientSecret: res.duo?.clientSecret || '',
      token: res.userVerificationToken || '',
    };
    duoPassword.value = '';
  } catch (err: any) {
    showToast(err?.message || 'Ошибка проверки Duo');
  }
}

async function handleSaveOrgDuo() {
  if (!authStore.token || !activeOrgId.value || !duoInfo.value) return;
  try {
    await api.saveOrgDuo2fa(authStore.token, activeOrgId.value, {
      host: duoInfo.value.host,
      clientId: duoInfo.value.clientId,
      clientSecret: duoInfo.value.clientSecret,
      userVerificationToken: duoInfo.value.token,
    });
    duoInfo.value.enabled = true;
    showToast('Настройки Duo организации сохранены');
  } catch (err: any) {
    showToast(err?.message || 'Ошибка сохранения Duo организации');
  }
}

const themeIcon = computed(() => (themeStore.mode === 'dark' ? Moon : themeStore.mode === 'light' ? Sun : Monitor));
const themeLabel = computed(() =>
  themeStore.mode === 'dark' ? t('theme.dark') : themeStore.mode === 'light' ? t('theme.light') : t('theme.system')
);
</script>

<template>
  <div class="org-page">
    <!-- Header -->
    <header class="org-header">
      <div class="flex items-center gap-3">
        <button type="button" class="cyber-btn-secondary !h-8 !px-3" @click="router.push('/vault')">
          <ArrowLeft class="w-4 h-4" />
          <span>{{ t('nav.backToVault') }}</span>
        </button>
        <div>
          <h1 class="text-base font-bold leading-tight flex items-center gap-2">
            <Building2 class="w-4 h-4 text-sky-400" />
            <span>{{ t('org.title') }}</span>
          </h1>
          <p class="text-xs text-slate-400 m-0">{{ t('org.subtitle') }}</p>
        </div>
      </div>

      <div class="flex items-center gap-2 flex-wrap">
        <select v-if="authStore.organizations.length" v-model="activeOrgId" class="cyber-select !h-8 !w-52 text-xs">
          <option v-for="o in authStore.organizations" :key="o.id" :value="o.id">{{ o.name }}</option>
        </select>

        <button type="button" class="cyber-btn-primary !h-8 !px-3" @click="showCreateModal = true">
          <Plus class="w-4 h-4" />
          <span>{{ t('org.createNew') }}</span>
        </button>

        <button type="button" class="cyber-btn-secondary !h-8 !px-2.5 text-xs" @click="cycleLocale" :title="t('lang.label')">
          <Globe class="w-3.5 h-3.5 text-sky-400" />
          <span>{{ locale.toUpperCase() }}</span>
        </button>

        <button type="button" class="cyber-btn-secondary !h-8 !px-2.5 text-xs" @click="themeStore.cycleTheme">
          <component :is="themeIcon" class="w-3.5 h-3.5 text-sky-400" />
          <span>{{ themeLabel }}</span>
        </button>
      </div>
    </header>

    <div v-if="toast" class="org-toast">{{ toast }}</div>

    <!-- Body -->
    <main class="org-body">
      <div v-if="authStore.organizations.length === 0" class="org-empty">
        <Building2 class="w-12 h-12 text-sky-400 mx-auto mb-3 opacity-80" />
        <h2 class="text-lg font-bold mb-1">У вас пока нет организаций</h2>
        <p class="text-xs text-slate-400 mb-4">Создайте организацию для общего доступа к паролям, коллекциям, группам и политикам безопасности.</p>
        <button type="button" class="cyber-btn-primary" @click="showCreateModal = true">
          <Plus class="w-4 h-4" />
          <span>{{ t('org.createNew') }}</span>
        </button>
      </div>

      <template v-else>
        <!-- Tabs -->
        <nav class="org-tabs">
          <button type="button" class="org-tab" :class="{ active: activeTab === 'overview' }" @click="activeTab = 'overview'">
            <Building2 class="w-3.5 h-3.5" /> {{ t('org.tab.overview') }}
          </button>
          <button type="button" class="org-tab" :class="{ active: activeTab === 'members' }" @click="activeTab = 'members'">
            <Users class="w-3.5 h-3.5" /> {{ t('org.tab.members') }} ({{ members.length }})
          </button>
          <button type="button" class="org-tab" :class="{ active: activeTab === 'collections' }" @click="activeTab = 'collections'">
            <FolderKanban class="w-3.5 h-3.5" /> {{ t('org.tab.collections') }} ({{ collections.length }})
          </button>
          <button type="button" class="org-tab" :class="{ active: activeTab === 'groups' }" @click="activeTab = 'groups'">
            <Layers class="w-3.5 h-3.5" /> {{ t('org.tab.groups') }} ({{ groups.length }})
          </button>
          <button type="button" class="org-tab" :class="{ active: activeTab === 'policies' }" @click="activeTab = 'policies'">
            <ShieldCheck class="w-3.5 h-3.5" /> {{ t('org.tab.policies') }}
          </button>
          <button type="button" class="org-tab" :class="{ active: activeTab === 'events' }" @click="activeTab = 'events'">
            <Activity class="w-3.5 h-3.5" /> {{ t('org.tab.events') }}
          </button>
          <button type="button" class="org-tab" :class="{ active: activeTab === 'twoFactor' }" @click="activeTab = 'twoFactor'">
            <KeyRound class="w-3.5 h-3.5" /> {{ t('org.tab.twoFactor') }}
          </button>
        </nav>

        <div v-if="loading" class="p-10 text-center text-xs text-slate-400">
          <RefreshCw class="w-5 h-5 animate-spin mx-auto mb-2 text-sky-400" />
          {{ t('common.loading') }}
        </div>

        <!-- TAB 1: Overview & Settings -->
        <section v-else-if="activeTab === 'overview'" class="space-y-4">
          <div class="org-card">
            <h3 class="org-card-title">Профиль организации</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <div>
                <label class="text-xs text-slate-400 block mb-1">Название</label>
                <input v-model="editOrgName" class="cyber-input" />
              </div>
              <div>
                <label class="text-xs text-slate-400 block mb-1">Billing Email</label>
                <input v-model="editOrgEmail" type="email" class="cyber-input" />
              </div>
            </div>
            <div class="flex flex-wrap gap-2">
              <button type="button" class="cyber-btn-primary" @click="handleUpdateOrg">{{ t('common.save') }}</button>
              <button type="button" class="cyber-btn-secondary" @click="handleExportOrg">
                <Download class="w-4 h-4" /> Экспорт хранилища организации (JSON)
              </button>
            </div>
          </div>

          <div class="org-card border-rose-500/40">
            <h3 class="org-card-title text-rose-400">Опасная зона: удаление организации</h3>
            <p class="text-xs text-slate-400 mb-3">Удаление полностью стирает все общие коллекции, группы, события и записи организации.</p>
            <div class="flex flex-wrap gap-2">
              <input v-model="deleteOrgPassword" type="password" placeholder="Мастер-пароль" class="cyber-input max-w-xs" />
              <button type="button" class="cyber-btn-danger" @click="handleDeleteOrg">
                <Trash2 class="w-4 h-4" /> Удалить организацию
              </button>
            </div>
          </div>
        </section>

        <!-- TAB 2: Members -->
        <section v-else-if="activeTab === 'members'" class="space-y-4">
          <div class="org-card">
            <h3 class="org-card-title">Пригласить участников</h3>
            <div class="flex flex-wrap gap-2">
              <input v-model="inviteEmails" placeholder="user1@company.com, user2@company.com" class="cyber-input flex-1 min-w-[220px]" />
              <select v-model.number="inviteType" class="cyber-select w-40">
                <option :value="2">User</option>
                <option :value="3">Manager</option>
                <option :value="1">Admin</option>
                <option :value="0">Owner</option>
              </select>
              <button type="button" class="cyber-btn-primary" @click="handleInviteMember">
                <UserPlus class="w-4 h-4" /> Пригласить
              </button>
            </div>
          </div>

          <div class="org-card space-y-2">
            <div v-if="members.length === 0" class="text-xs text-slate-400">Нет участников</div>
            <div
              v-for="m in members"
              :key="m.id"
              class="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-black/25 border border-slate-800 text-xs"
            >
              <div>
                <div class="font-semibold text-slate-200">{{ m.email }} <span v-if="m.name" class="text-slate-400">({{ m.name }})</span></div>
                <div class="text-[11px] text-slate-400 mt-0.5">
                  Статус: {{ m.status === 2 ? 'Подтверждён' : m.status === 1 ? 'Принят (ждёт подтверждения)' : m.status === 0 ? 'Приглашён' : 'Отозван' }}
                </div>
              </div>
              <div class="flex items-center gap-1.5 flex-wrap">
                <select :value="m.type" @change="(e: any) => handleChangeMemberRole(m, Number(e.target.value))" class="cyber-select !h-7 !w-28 text-[11px]">
                  <option :value="0">Owner</option>
                  <option :value="1">Admin</option>
                  <option :value="3">Manager</option>
                  <option :value="2">User</option>
                </select>
                <button v-if="m.status === 1" type="button" class="cyber-btn-primary !h-7 !px-2 text-[11px]" @click="handleConfirmMember(m)">
                  <CheckCircle2 class="w-3.5 h-3.5" /> Подтвердить
                </button>
                <button type="button" class="cyber-btn-secondary !h-7 !px-2 text-[11px]" @click="handleRevokeRestoreMember(m)">
                  <component :is="m.status < 0 ? RotateCcw : Ban" class="w-3.5 h-3.5" />
                  <span>{{ m.status < 0 ? 'Восст.' : 'Отозвать' }}</span>
                </button>
                <button type="button" class="cyber-btn-danger !h-7 !px-2 text-[11px]" @click="handleDeleteMember(m)">
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- TAB 3: Collections -->
        <section v-else-if="activeTab === 'collections'" class="org-card space-y-4">
          <div class="flex gap-2">
            <input v-model="newCollectionName" placeholder="Название новой коллекции (шифруется E2EE)" class="cyber-input flex-1" />
            <button type="button" class="cyber-btn-primary" @click="handleCreateCollection">
              <Plus class="w-4 h-4" /> {{ t('common.create') }}
            </button>
          </div>
          <div class="space-y-2">
            <div
              v-for="col in collections"
              :key="col.id"
              class="flex items-center justify-between p-3 rounded-lg bg-black/25 border border-slate-800 text-xs"
            >
              <div>
                <div class="font-semibold text-slate-200">{{ col.name }}</div>
                <div class="text-[11px] text-slate-400 font-mono">{{ col.id }}</div>
              </div>
              <button type="button" class="cyber-btn-danger !h-7 !px-2.5 text-[11px]" @click="handleDeleteCollection(col.id)">
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </section>

        <!-- TAB 4: Groups -->
        <section v-else-if="activeTab === 'groups'" class="org-card space-y-4">
          <div class="flex flex-wrap items-center gap-3">
            <input v-model="newGroupName" placeholder="Название группы" class="cyber-input flex-1 min-w-[200px]" />
            <label class="flex items-center gap-1.5 text-xs text-slate-300">
              <input v-model="newGroupAccessAll" type="checkbox" class="accent-sky-500" />
              <span>Доступ ко всем коллекциям</span>
            </label>
            <button type="button" class="cyber-btn-primary" @click="handleCreateGroup">
              <Plus class="w-4 h-4" /> {{ t('common.create') }}
            </button>
          </div>
          <div class="space-y-2">
            <div v-if="groups.length === 0" class="text-xs text-slate-400">Группы не созданы (либо отключены в настройках сервера `ORG_GROUPS_ENABLED`).</div>
            <div
              v-for="g in groups"
              :key="g.id"
              class="flex items-center justify-between p-3 rounded-lg bg-black/25 border border-slate-800 text-xs"
            >
              <div>
                <span class="font-semibold text-slate-200">{{ g.name }}</span>
                <span v-if="g.accessAll" class="ml-2 px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-[10px]">Все коллекции</span>
              </div>
              <button type="button" class="cyber-btn-danger !h-7 !px-2.5 text-[11px]" @click="handleDeleteGroup(g.id)">
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </section>

        <!-- TAB 5: Policies -->
        <section v-else-if="activeTab === 'policies'" class="org-card space-y-2">
          <div
            v-for="pol in POLICY_CATALOG"
            :key="pol.type"
            class="flex items-center justify-between gap-4 p-3 rounded-lg bg-black/25 border border-slate-800 text-xs"
          >
            <div>
              <div class="font-semibold text-slate-200">{{ pol.name }}</div>
              <div class="text-[11px] text-slate-400">{{ pol.desc }}</div>
            </div>
            <button
              type="button"
              :class="isPolicyEnabled(pol.type) ? 'cyber-btn-primary !h-7 !px-3' : 'cyber-btn-secondary !h-7 !px-3'"
              @click="handleTogglePolicy(pol.type)"
            >
              {{ isPolicyEnabled(pol.type) ? t('common.enabled') : t('common.disabled') }}
            </button>
          </div>
        </section>

        <!-- TAB 6: Audit Events -->
        <section v-else-if="activeTab === 'events'" class="org-card space-y-2">
          <div v-if="events.length === 0" class="text-xs text-slate-400">События не зафиксированы (проверьте настройку `ORG_EVENTS_ENABLED`).</div>
          <div
            v-for="ev in events"
            :key="ev.id"
            class="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded bg-black/25 border border-slate-800 text-xs"
          >
            <span>Событие #{{ ev.type }} • Пользователь {{ ev.actingUserId || ev.userId || 'System' }}</span>
            <span class="text-slate-400 font-mono text-[11px]">{{ ev.date }} • {{ ev.ipAddress || '—' }}</span>
          </div>
        </section>

        <!-- TAB 7: Org Duo 2FA -->
        <section v-else-if="activeTab === 'twoFactor'" class="org-card space-y-3">
          <h3 class="org-card-title">Duo 2FA уровня организации</h3>
          <div v-if="!duoInfo" class="flex flex-wrap gap-2">
            <input v-model="duoPassword" type="password" placeholder="Подтверждение мастер-паролем" class="cyber-input max-w-xs" />
            <button type="button" class="cyber-btn-primary" @click="handleLoadOrgDuo">Открыть настройки Duo</button>
          </div>
          <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input v-model="duoInfo.host" placeholder="API Hostname (api-xxxx.duosecurity.com)" class="cyber-input" />
            <input v-model="duoInfo.clientId" placeholder="Client ID (Integration Key)" class="cyber-input" />
            <input v-model="duoInfo.clientSecret" type="password" placeholder="Client Secret" class="cyber-input" />
            <div class="flex gap-2">
              <button type="button" class="cyber-btn-primary" @click="handleSaveOrgDuo">{{ t('common.save') }}</button>
              <button type="button" class="cyber-btn-secondary" @click="duoInfo = null">{{ t('common.cancel') }}</button>
            </div>
          </div>
        </section>
      </template>
    </main>

    <!-- Create Organization Modal -->
    <div v-if="showCreateModal" class="modal-backdrop" @click.self="showCreateModal = false">
      <div class="modal-card">
        <h3 class="modal-title">{{ t('org.createNew') }}</h3>
        <div class="space-y-3 mb-4">
          <input v-model="createOrgName" placeholder="Название организации" class="cyber-input" />
          <input v-model="createOrgEmail" type="email" placeholder="Billing Email" class="cyber-input" />
          <input v-model="createOrgCollection" placeholder="Начальная коллекция (например: Общая)" class="cyber-input" />
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" class="cyber-btn-secondary" @click="showCreateModal = false">{{ t('common.cancel') }}</button>
          <button type="button" class="cyber-btn-primary" :disabled="creatingOrg" @click="handleCreateOrganization">
            {{ creatingOrg ? t('common.loading') : t('common.create') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.org-page {
  min-height: 100vh;
  height: 100vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  background-color: var(--page-bg);
  color: var(--text-primary);
}
.org-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 12px 24px;
  background: var(--header-bg);
  border-bottom: 1px solid var(--card-border);
}
.org-body {
  max-width: 1120px;
  width: 100%;
  margin: 0 auto;
  padding: 20px 24px 48px;
}
.org-empty {
  text-align: center;
  padding: 56px 24px;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 14px;
}
.org-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 18px;
}
.org-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: 8px;
  font-size: 12.5px;
  font-weight: 600;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  color: var(--text-secondary);
  cursor: pointer;
}
.org-tab.active {
  background: var(--active-bg);
  border-color: var(--active-border);
  color: var(--text-primary);
}
.org-card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 18px 20px;
}
.org-card-title {
  font-size: 15px;
  font-weight: 700;
  margin: 0 0 12px 0;
}
.org-toast {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 60;
  background: var(--card-bg);
  border: 1px solid var(--active-border);
  color: var(--text-primary);
  padding: 10px 16px;
  border-radius: 10px;
  font-size: 13px;
  box-shadow: var(--card-shadow);
}
</style>
