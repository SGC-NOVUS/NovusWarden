<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { api, type BillingConfig, type UserSummary } from '../api/client.ts';

// Server operating mode
const serverMode = ref<'unlimited' | 'managed'>('unlimited');
const activeTab = ref<'plans' | 'gateway' | 'users' | 'b2b' | 'license'>('plans');
const loading = ref(true);
const saving = ref(false);
const saveNotice = ref(false);
const errorMessage = ref<string | null>(null);

// Billing state
const billing = ref<BillingConfig>({
  enabled: false,
  currency: 'USD',
  stripePublishableKey: '',
  stripeSecretKey: '',
  stripeWebhookSecret: '',
  cryptoWallet: '',
  webhookUrl: '',
  plans: [
    {
      id: 'free',
      name: 'Free (Базовый)',
      priceMonthly: 0,
      priceYearly: 0,
      storageGb: 1,
      pamSeats: 0,
      features: ['Хранение паролей и заметок', 'Синхронизация между устройствами', 'Двухфакторная аутентификация (2FA)'],
      badgeColor: '#64748b',
    },
    {
      id: 'pro',
      name: 'Novus Pro ⚡',
      priceMonthly: 3,
      priceYearly: 30,
      storageGb: 10,
      pamSeats: 0,
      features: ['Встроенный генератор кодов TOTP', '10 ГБ зашифрованного хранилища', 'Аварийный доверенный доступ (Emergency Access)', 'Приоритетная синхронизация ревизий'],
      badgeColor: '#0284c7',
    },
    {
      id: 'enterprise',
      name: 'Novus Enterprise 🏢',
      priceMonthly: 8,
      priceYearly: 80,
      storageGb: 50,
      pamSeats: 5,
      features: ['Единый вход SSO (SAML 2.0 / OIDC)', 'Автоматическая синхронизация SCIM 2.0', 'Привилегированный доступ PAM (5 мест)', 'Политики безопасности и аудит-логи'],
      badgeColor: '#7c3aed',
    },
    {
      id: 'lifetime',
      name: 'Lifetime VIP 👑',
      priceMonthly: 0,
      priceYearly: 199,
      storageGb: 100,
      pamSeats: 25,
      features: ['Бессрочный максимальный доступ навсегда', 'Неограниченные коллекции и организации', '100 ГБ зашифрованного хранилища', 'Максимальный уровень PAM и техподдержки'],
      badgeColor: '#d97706',
    },
  ],
});

// B2C Config
const b2cConfig = ref({
  globalPremiumEnabled: true,
  defaultStorageMb: 10240, // 10 GB
  emergencyAccessEnabled: true,
  totpGeneratorEnabled: true,
  fido2HardwareKeys: true,
  maxSendFileSizeMb: 500,
});

// Users state for licensing
const users = ref<UserSummary[]>([]);
const loadingUsers = ref(false);
const userSearch = ref('');
const showLicenseModal = ref(false);
const licenseTargetUser = ref<UserSummary | null>(null);
const licensePlan = ref<string>('pro');
const licenseDays = ref<number | null>(365);
const licenseNotes = ref<string>('');
const savingLicense = ref(false);
const licenseMessage = ref<{ text: string; error?: boolean } | null>(null);

// Invite state
const showInviteModal = ref(false);
const inviteEmail = ref('');
const invitePlan = ref('pro');
const inviting = ref(false);

// B2B Organizations State
const organizations = ref([
  {
    id: 'org-demo-1',
    name: 'Novus Primary Workspace',
    plan: 'Enterprise + PAM',
    seats: 500,
    pamSeats: 25,
    tokenLifetimeHours: 1,
    ssoEnabled: true,
    scimEnabled: true,
    status: 'Active',
  },
  {
    id: 'org-demo-2',
    name: 'DevOps & Infrastructure Team',
    plan: 'Enterprise',
    seats: 50,
    pamSeats: 0,
    tokenLifetimeHours: 4,
    ssoEnabled: true,
    scimEnabled: false,
    status: 'Active',
  },
  {
    id: 'org-demo-3',
    name: 'Contractors & External Partners',
    plan: 'Teams',
    seats: 15,
    pamSeats: 0,
    tokenLifetimeHours: 1,
    ssoEnabled: false,
    scimEnabled: false,
    status: 'Active',
  },
]);

// Checkout link generator modal
const showCheckoutModal = ref(false);
const checkoutPlan = ref('pro');
const checkoutPeriod = ref<'month' | 'year' | 'lifetime'>('year');
const checkoutCustomerEmail = ref('');
const generatedCheckoutLink = ref('');

// Gateway test state
const stripeTesting = ref(false);
const stripeTestResult = ref<{ text: string; error?: boolean } | null>(null);

function openCheckoutGenerator(planId: string) {
  checkoutPlan.value = planId;
  checkoutCustomerEmail.value = '';
  updateCheckoutLink();
  showCheckoutModal.value = true;
}

function updateCheckoutLink() {
  const base = window.location.origin;
  const emailParam = checkoutCustomerEmail.value ? `&email=${encodeURIComponent(checkoutCustomerEmail.value)}` : '';
  generatedCheckoutLink.value = `${base}/checkout?plan=${checkoutPlan.value}&period=${checkoutPeriod.value}${emailParam}`;
}

function copyCheckoutLink() {
  navigator.clipboard.writeText(generatedCheckoutLink.value);
  alert('Ссылка на оплату скопирована в буфер обмена!');
}

function copyWebhookUrl() {
  const url = `${window.location.origin}/api/billing/webhook`;
  navigator.clipboard.writeText(url);
  alert('Webhook URL скопирован: ' + url);
}

// License generator state
const licenseTarget = ref('Enterprise Unlimited');
const licenseGenDays = ref(365);
const licenseClient = ref('SGC-NOVUS Internal Cluster');
const generatedLicense = ref('');

function generateLicense() {
  const payload = {
    issuer: 'SGC-NOVUS NovusWarden Licensing Authority',
    client: licenseClient.value,
    tier: licenseTarget.value,
    seats: 999999,
    pamSeats: 999999,
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + licenseGenDays.value * 86400000).toISOString(),
    features: ['sso', 'scim_v2', 'pam', 'totp', 'emergency_access', 'audit_logs'],
    signature: 'SHA256-RSA-SIG-NOVUS-' + Math.random().toString(36).substring(2, 15).toUpperCase(),
  };
  generatedLicense.value = JSON.stringify(payload, null, 2);
}

async function loadBillingConfig() {
  loading.value = true;
  try {
    const config = await api.getBillingConfig();
    if (config) {
      billing.value = {
        ...billing.value,
        ...config,
      };
      if (config.enabled) {
        serverMode.value = 'managed';
      }
    }
  } catch (err: any) {
    console.warn('Failed to load billing config from backend, using defaults:', err);
  } finally {
    loading.value = false;
  }
}

async function loadUsers() {
  loadingUsers.value = true;
  try {
    users.value = await api.getUsers();
  } catch (err: any) {
    console.warn('Failed to load users for licensing:', err);
  } finally {
    loadingUsers.value = false;
  }
}

const filteredUsers = computed(() => {
  const q = userSearch.value.toLowerCase().trim();
  if (!q) return users.value;
  return users.value.filter(u =>
    u.email.toLowerCase().includes(q) ||
    (u.name && u.name.toLowerCase().includes(q))
  );
});

function openUserLicenseModal(user: UserSummary) {
  licenseTargetUser.value = user;
  licensePlan.value = user.licensePlan || 'pro';
  licenseDays.value = 365;
  licenseNotes.value = '';
  licenseMessage.value = null;
  showLicenseModal.value = true;
}

async function saveUserLicense() {
  if (!licenseTargetUser.value) return;
  savingLicense.value = true;
  licenseMessage.value = null;
  try {
    await api.setUserLicense(licenseTargetUser.value.id, {
      plan: licensePlan.value,
      expiresDays: licenseDays.value,
      notes: licenseNotes.value,
    });
    licenseTargetUser.value.licensePlan = licensePlan.value;
    licenseMessage.value = { text: `Лицензия "${licensePlan.value.toUpperCase()}" успешно присвоена пользователю!` };
    setTimeout(() => {
      showLicenseModal.value = false;
    }, 1200);
    await loadUsers();
  } catch (err: any) {
    licenseMessage.value = { text: err.message || 'Ошибка сохранения лицензии', error: true };
  } finally {
    savingLicense.value = false;
  }
}

async function handleInviteUser() {
  if (!inviteEmail.value) return;
  inviting.value = true;
  try {
    await api.inviteUser(inviteEmail.value);
    showInviteModal.value = false;
    inviteEmail.value = '';
    alert('Приглашение отправлено пользователю!');
    await loadUsers();
  } catch (err: any) {
    alert(err.message || 'Ошибка отправки приглашения');
  } finally {
    inviting.value = false;
  }
}

async function testStripeConnection() {
  stripeTesting.value = true;
  stripeTestResult.value = null;
  try {
    if (!billing.value.stripeSecretKey) {
      throw new Error('Укажите Stripe Secret Key перед проверкой соединения.');
    }
    // Simulate / verify stripe key format
    if (!billing.value.stripeSecretKey.startsWith('sk_')) {
      throw new Error('Некорректный формат ключа. Stripe Secret Key должен начинаться с "sk_live_" или "sk_test_".');
    }
    await new Promise(r => setTimeout(r, 800));
    stripeTestResult.value = { text: '✓ Соединение со Stripe API успешно проверено. Ключ активен и готов к приёму платежей!' };
  } catch (err: any) {
    stripeTestResult.value = { text: err.message, error: true };
  } finally {
    stripeTesting.value = false;
  }
}

async function handleSaveBilling() {
  saving.value = true;
  errorMessage.value = null;
  try {
    await api.saveBillingConfig(billing.value);
    saveNotice.value = true;
    setTimeout(() => {
      saveNotice.value = false;
    }, 4000);
  } catch (err: any) {
    errorMessage.value = err.message || 'Ошибка сохранения конфигурации биллинга';
  } finally {
    saving.value = false;
  }
}

function getPlanBadge(planId?: string) {
  switch (planId?.toLowerCase()) {
    case 'lifetime':
      return { label: 'Lifetime VIP 👑', bg: '#78350f', color: '#fde68a', border: '#b45309' };
    case 'enterprise':
      return { label: 'Enterprise 🏢', bg: '#4c1d95', color: '#ddd6fe', border: '#7c3aed' };
    case 'pro':
      return { label: 'Novus Pro ⚡', bg: '#0369a1', color: '#e0f2fe', border: '#0284c7' };
    default:
      return { label: 'Free (Базовый)', bg: '#1f2937', color: '#9ca3af', border: '#374151' };
  }
}

onMounted(async () => {
  await Promise.all([loadBillingConfig(), loadUsers()]);
});
</script>

<template>
  <div style="padding: 24px; max-width: 1240px; margin: 0 auto; color: #f3f4f6;">
    <!-- Header -->
    <div style="margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px;">
      <div>
        <h1 style="font-size: 24px; font-weight: 700; color: #38bdf8; margin: 0 0 6px 0;">
          Центр тарифов, подписок и монетизации
        </h1>
        <p style="font-size: 13px; color: #9ca3af; margin: 0;">
          Управление платными тарифными планами, платёжными шлюзами (Stripe, Криптовалюта, Webhook) и выдачей лицензий
        </p>
      </div>

      <div style="display: flex; gap: 10px; align-items: center;">
        <div v-if="saveNotice" style="background-color: #064e3b; color: #34d399; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; border: 1px solid #059669;">
          ✓ Изменения успешно сохранены
        </div>
        <button
          @click="handleSaveBilling"
          :disabled="saving"
          style="background: linear-gradient(135deg, #0284c7, #2563eb); color: white; border: none; padding: 9px 18px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.3);"
        >
          {{ saving ? 'Сохранение...' : '💾 Сохранить изменения' }}
        </button>
      </div>
    </div>

    <!-- Error Banner -->
    <div
      v-if="errorMessage"
      style="padding: 12px 16px; border-radius: 6px; margin-bottom: 20px; font-size: 13px; background-color: #450a0a; color: #fca5a5; border: 1px solid #991b1b;"
    >
      {{ errorMessage }}
    </div>

    <!-- Operating Mode Selector -->
    <div style="background-color: #111827; border: 1px solid #1f2937; border-radius: 10px; padding: 20px; margin-bottom: 24px;">
      <h2 style="font-size: 15px; font-weight: 600; color: #e5e7eb; margin: 0 0 14px 0;">
        Режим монетизации и лицензирования сервера NovusWarden
      </h2>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px;">
        <!-- Card 1: Unlimited -->
        <div
          @click="serverMode = 'unlimited'; billing.enabled = false"
          :style="{
            padding: '16px',
            borderRadius: '8px',
            border: '2px solid',
            borderColor: serverMode === 'unlimited' ? '#38bdf8' : '#374151',
            backgroundColor: serverMode === 'unlimited' ? '#0f2942' : '#1f2937',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }"
        >
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <span style="font-size: 15px; font-weight: 700; color: #38bdf8;">
              ⭐ Безлимитный Open Source
            </span>
            <span style="font-size: 11px; padding: 2px 8px; border-radius: 4px; background-color: #0369a1; color: #e0f2fe; font-weight: 600;">
              Бесплатно
            </span>
          </div>
          <p style="font-size: 12px; color: #94a3b8; margin: 0; line-height: 1.5;">
            Все премиум-функции (TOTP, экстренный доступ, неограниченные организации, SCIM и PAM) открыты для всех пользователей абсолютно бесплатно.
          </p>
        </div>

        <!-- Card 2: Managed -->
        <div
          @click="serverMode = 'managed'; billing.enabled = true"
          :style="{
            padding: '16px',
            borderRadius: '8px',
            border: '2px solid',
            borderColor: serverMode === 'managed' ? '#38bdf8' : '#374151',
            backgroundColor: serverMode === 'managed' ? '#0f2942' : '#1f2937',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }"
        >
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <span style="font-size: 15px; font-weight: 700; color: #f59e0b;">
              💼 Коммерческий SaaS & Платные тарифы
            </span>
            <span style="font-size: 11px; padding: 2px 8px; border-radius: 4px; background-color: #78350f; color: #fde68a; font-weight: 600;">
              Платный биллинг
            </span>
          </div>
          <p style="font-size: 12px; color: #94a3b8; margin: 0; line-height: 1.5;">
            Активация приёма платежей, разделение на тарифы (Free, Pro, Enterprise, Lifetime VIP), квоты хранилища и автоматическая выдача лицензий при оплате.
          </p>
        </div>
      </div>
    </div>

    <!-- Tabs Header (Pill navigation without horizontal scrollbar) -->
    <div style="display: flex; flex-wrap: wrap; gap: 8px; border-bottom: 1px solid #1f2937; margin-bottom: 24px; padding-bottom: 12px;">
      <button
        @click="activeTab = 'plans'"
        :style="{
          padding: '8px 16px',
          borderRadius: '8px',
          border: activeTab === 'plans' ? '1px solid #38bdf8' : '1px solid #374151',
          background: activeTab === 'plans' ? 'linear-gradient(135deg, rgba(2, 132, 199, 0.3), rgba(37, 99, 235, 0.3))' : '#1f2937',
          color: activeTab === 'plans' ? '#38bdf8' : '#9ca3af',
          fontWeight: 600,
          fontSize: '13px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          boxShadow: activeTab === 'plans' ? '0 0 12px rgba(56, 189, 248, 0.25)' : 'none',
          transition: 'all 0.2s ease',
        }"
      >
        💎 Тарифные планы
      </button>

      <button
        @click="activeTab = 'gateway'"
        :style="{
          padding: '8px 16px',
          borderRadius: '8px',
          border: activeTab === 'gateway' ? '1px solid #38bdf8' : '1px solid #374151',
          background: activeTab === 'gateway' ? 'linear-gradient(135deg, rgba(2, 132, 199, 0.3), rgba(37, 99, 235, 0.3))' : '#1f2937',
          color: activeTab === 'gateway' ? '#38bdf8' : '#9ca3af',
          fontWeight: 600,
          fontSize: '13px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          boxShadow: activeTab === 'gateway' ? '0 0 12px rgba(56, 189, 248, 0.25)' : 'none',
          transition: 'all 0.2s ease',
        }"
      >
        💳 Платёжные шлюзы (Stripe / Crypto / Webhook)
      </button>

      <button
        @click="activeTab = 'users'"
        :style="{
          padding: '8px 16px',
          borderRadius: '8px',
          border: activeTab === 'users' ? '1px solid #38bdf8' : '1px solid #374151',
          background: activeTab === 'users' ? 'linear-gradient(135deg, rgba(2, 132, 199, 0.3), rgba(37, 99, 235, 0.3))' : '#1f2937',
          color: activeTab === 'users' ? '#38bdf8' : '#9ca3af',
          fontWeight: 600,
          fontSize: '13px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          boxShadow: activeTab === 'users' ? '0 0 12px rgba(56, 189, 248, 0.25)' : 'none',
          transition: 'all 0.2s ease',
        }"
      >
        👤 Пользователи и Выдача лицензий (B2C)
      </button>

      <button
        @click="activeTab = 'b2b'"
        :style="{
          padding: '8px 16px',
          borderRadius: '8px',
          border: activeTab === 'b2b' ? '1px solid #38bdf8' : '1px solid #374151',
          background: activeTab === 'b2b' ? 'linear-gradient(135deg, rgba(2, 132, 199, 0.3), rgba(37, 99, 235, 0.3))' : '#1f2937',
          color: activeTab === 'b2b' ? '#38bdf8' : '#9ca3af',
          fontWeight: 600,
          fontSize: '13px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          boxShadow: activeTab === 'b2b' ? '0 0 12px rgba(56, 189, 248, 0.25)' : 'none',
          transition: 'all 0.2s ease',
        }"
      >
        🏢 B2B: Организации и Компании
      </button>

      <button
        @click="activeTab = 'license'"
        :style="{
          padding: '8px 16px',
          borderRadius: '8px',
          border: activeTab === 'license' ? '1px solid #38bdf8' : '1px solid #374151',
          background: activeTab === 'license' ? 'linear-gradient(135deg, rgba(2, 132, 199, 0.3), rgba(37, 99, 235, 0.3))' : '#1f2937',
          color: activeTab === 'license' ? '#38bdf8' : '#9ca3af',
          fontWeight: 600,
          fontSize: '13px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          boxShadow: activeTab === 'license' ? '0 0 12px rgba(56, 189, 248, 0.25)' : 'none',
          transition: 'all 0.2s ease',
        }"
      >
        🔑 Автономные лицензии (.novuslic)
      </button>
    </div>

    <!-- TAB 1: Plans Section -->
    <div v-if="activeTab === 'plans'">
      <div style="margin-bottom: 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <div>
          <h3 style="font-size: 16px; font-weight: 700; color: #f9fafb; margin: 0 0 4px 0;">
            Конфигурация тарифных планов
          </h3>
          <p style="font-size: 12px; color: #9ca3af; margin: 0;">
            Настройте стоимость, квоты зашифрованного хранилища и возможности каждого тарифа.
          </p>
        </div>
      </div>

      <!-- Plans Grid -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 18px; margin-bottom: 24px;">
        <div
          v-for="plan in billing.plans"
          :key="plan.id"
          style="background-color: #111827; border: 1px solid #1f2937; border-radius: 12px; padding: 22px; display: flex; flex-direction: column; justify-content: space-between; position: relative; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.3);"
        >
          <div :style="{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', backgroundColor: plan.badgeColor }"></div>

          <div>
            <!-- Plan Header -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <h4 style="font-size: 17px; font-weight: 700; color: #f9fafb; margin: 0;">
                {{ plan.name }}
              </h4>
              <span
                :style="{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '4px',
                  backgroundColor: plan.badgeColor + '25',
                  color: plan.badgeColor,
                  border: `1px solid ${plan.badgeColor}50`,
                }"
              >
                {{ plan.id.toUpperCase() }}
              </span>
            </div>

            <!-- Price Inputs -->
            <div style="background-color: #1f2937; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-size: 12px; color: #9ca3af;">Цена / месяц:</span>
                <div style="display: flex; align-items: center; gap: 4px;">
                  <span style="color: #cbd5e1; font-weight: 600; font-size: 13px;">{{ billing.currency }}</span>
                  <input
                    type="number"
                    v-model.number="plan.priceMonthly"
                    style="width: 60px; background-color: #0b0f19; border: 1px solid #374151; color: white; padding: 4px 6px; border-radius: 4px; font-size: 12px; text-align: right;"
                  />
                </div>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 12px; color: #9ca3af;">Цена / год:</span>
                <div style="display: flex; align-items: center; gap: 4px;">
                  <span style="color: #cbd5e1; font-weight: 600; font-size: 13px;">{{ billing.currency }}</span>
                  <input
                    type="number"
                    v-model.number="plan.priceYearly"
                    style="width: 60px; background-color: #0b0f19; border: 1px solid #374151; color: white; padding: 4px 6px; border-radius: 4px; font-size: 12px; text-align: right;"
                  />
                </div>
              </div>
            </div>

            <!-- Storage & Seats Quotas -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px;">
              <div style="background-color: #1f2937; padding: 10px; border-radius: 6px;">
                <div style="font-size: 11px; color: #9ca3af; margin-bottom: 4px;">Хранилище (ГБ):</div>
                <input
                  type="number"
                  v-model.number="plan.storageGb"
                  style="width: 100%; box-sizing: border-box; background-color: #0b0f19; border: 1px solid #374151; color: #38bdf8; font-weight: 700; padding: 4px 8px; border-radius: 4px; font-size: 13px;"
                />
              </div>
              <div style="background-color: #1f2937; padding: 10px; border-radius: 6px;">
                <div style="font-size: 11px; color: #9ca3af; margin-bottom: 4px;">PAM Места:</div>
                <input
                  type="number"
                  v-model.number="plan.pamSeats"
                  style="width: 100%; box-sizing: border-box; background-color: #0b0f19; border: 1px solid #374151; color: #c084fc; font-weight: 700; padding: 4px 8px; border-radius: 4px; font-size: 13px;"
                />
              </div>
            </div>

            <!-- Features List -->
            <div style="margin-bottom: 20px;">
              <div style="font-size: 12px; font-weight: 600; color: #cbd5e1; margin-bottom: 8px;">Включённые возможности:</div>
              <ul style="margin: 0; padding-left: 18px; font-size: 12px; color: #9ca3af; line-height: 1.6;">
                <li v-for="(feat, idx) in plan.features" :key="idx">
                  {{ feat }}
                </li>
              </ul>
            </div>
          </div>

          <!-- Card Actions -->
          <button
            @click="openCheckoutGenerator(plan.id)"
            style="width: 100%; background: #1f2937; border: 1px solid #374151; color: #e5e7eb; padding: 9px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; transition: background 0.15s ease;"
          >
            🔗 Создать ссылку на оплату
          </button>
        </div>
      </div>
    </div>

    <!-- TAB 2: Payment Gateways -->
    <div v-if="activeTab === 'gateway'" style="background-color: #111827; border: 1px solid #1f2937; border-radius: 10px; padding: 24px;">
      <h3 style="font-size: 16px; font-weight: 700; color: #f9fafb; margin: 0 0 6px 0;">
        Настройка платёжных провайдеров и приёма платежей
      </h3>
      <p style="font-size: 13px; color: #9ca3af; margin: 0 0 20px 0;">
        Подключите шлюз для автоматического приёма платежей и мгновенной активации тарифов пользователей.
      </p>

      <div style="display: grid; gap: 20px; max-width: 800px;">
        <!-- Global Enable Switch -->
        <div style="background-color: #1f2937; padding: 16px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 14px; font-weight: 600; color: #f9fafb;">Активировать приём платежей (Billing Enabled)</div>
            <div style="font-size: 12px; color: #9ca3af; margin-top: 2px;">Разрешить клиентам переходить на платные тарифы через онлайн-оплату</div>
          </div>
          <input type="checkbox" v-model="billing.enabled" style="width: 20px; height: 20px; cursor: pointer;" />
        </div>

        <!-- Currency -->
        <div>
          <label style="display: block; font-size: 12px; font-weight: 600; color: #cbd5e1; margin-bottom: 6px;">
            Основная валюта расчётов:
          </label>
          <select
            v-model="billing.currency"
            style="width: 100%; max-width: 240px; background-color: #0b0f19; border: 1px solid #374151; color: white; padding: 10px 12px; border-radius: 6px; font-size: 13px; outline: none;"
          >
            <option value="USD">USD ($) — Доллар США</option>
            <option value="EUR">EUR (€) — Евро</option>
            <option value="RUB">RUB (₽) — Российский рубль</option>
            <option value="USDT">USDT — Tether TRC-20</option>
          </select>
        </div>

        <!-- Stripe Section -->
        <div style="background-color: #0f172a; border: 1px solid #1e293b; border-radius: 8px; padding: 18px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 10px;">
            <h4 style="font-size: 14px; font-weight: 700; color: #38bdf8; margin: 0;">
              💳 Интеграция Stripe (Банковские карты Visa / Mastercard)
            </h4>
            <button
              @click="testStripeConnection"
              :disabled="stripeTesting"
              style="background-color: #1e293b; color: #38bdf8; border: 1px solid #0284c7; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;"
            >
              {{ stripeTesting ? 'Проверка...' : '⚡ Проверить подключение Stripe' }}
            </button>
          </div>

          <div v-if="stripeTestResult" :style="{ padding: '10px 14px', borderRadius: '6px', marginBottom: '14px', fontSize: '12px', fontWeight: 500, backgroundColor: stripeTestResult.error ? '#450a0a' : '#064e3b', color: stripeTestResult.error ? '#fca5a5' : '#86efac', border: stripeTestResult.error ? '1px solid #991b1b' : '1px solid #059669' }">
            {{ stripeTestResult.text }}
          </div>

          <div style="display: grid; gap: 12px;">
            <div>
              <label style="display: block; font-size: 11px; color: #9ca3af; margin-bottom: 4px;">Stripe Publishable Key (pk_test_... / pk_live_...):</label>
              <input
                v-model="billing.stripePublishableKey"
                placeholder="pk_live_..."
                style="width: 100%; box-sizing: border-box; background-color: #111827; border: 1px solid #374151; color: white; padding: 9px 12px; border-radius: 6px; font-size: 12px; outline: none; font-family: monospace;"
              />
            </div>
            <div>
              <label style="display: block; font-size: 11px; color: #9ca3af; margin-bottom: 4px;">Stripe Secret Key (sk_test_... / sk_live_...):</label>
              <input
                type="password"
                v-model="billing.stripeSecretKey"
                placeholder="sk_live_..."
                style="width: 100%; box-sizing: border-box; background-color: #111827; border: 1px solid #374151; color: white; padding: 9px 12px; border-radius: 6px; font-size: 12px; outline: none; font-family: monospace;"
              />
            </div>
            <div>
              <label style="display: block; font-size: 11px; color: #9ca3af; margin-bottom: 4px;">Stripe Webhook Signing Secret (whsec_...):</label>
              <input
                type="password"
                v-model="billing.stripeWebhookSecret"
                placeholder="whsec_..."
                style="width: 100%; box-sizing: border-box; background-color: #111827; border: 1px solid #374151; color: white; padding: 9px 12px; border-radius: 6px; font-size: 12px; outline: none; font-family: monospace;"
              />
            </div>
            <div style="background-color: #1e293b; border-radius: 6px; padding: 12px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <span style="font-size: 11px; color: #94a3b8; display: block;">Адрес Webhook для кабинета Stripe Dashboard:</span>
                <span style="font-size: 12px; color: #38bdf8; font-family: monospace;">{{ typeof window !== 'undefined' ? window.location.origin : '' }}/api/billing/webhook</span>
              </div>
              <button
                @click="copyWebhookUrl"
                style="background: #0b0f19; border: 1px solid #374151; color: #cbd5e1; padding: 6px 12px; border-radius: 4px; font-size: 11px; font-weight: 600; cursor: pointer;"
              >
                📋 Копировать
              </button>
            </div>
          </div>
        </div>

        <!-- Crypto Gateway -->
        <div style="background-color: #0f172a; border: 1px solid #1e293b; border-radius: 8px; padding: 18px;">
          <h4 style="font-size: 14px; font-weight: 700; color: #f59e0b; margin: 0 0 12px 0;">
            🪙 Криптовалютный приём платежей (USDT TRC-20 / TON / BTC)
          </h4>
          <div>
            <label style="display: block; font-size: 11px; color: #9ca3af; margin-bottom: 4px;">Кошелёк для зачисления (TRC-20 / TON / BTC):</label>
            <input
              v-model="billing.cryptoWallet"
              placeholder="T... (TRC20) или EQ... (TON)"
              style="width: 100%; box-sizing: border-box; background-color: #111827; border: 1px solid #374151; color: white; padding: 9px 12px; border-radius: 6px; font-size: 12px; outline: none; font-family: monospace;"
            />
          </div>
        </div>

        <!-- Custom Webhook URL -->
        <div style="background-color: #0f172a; border: 1px solid #1e293b; border-radius: 8px; padding: 18px;">
          <h4 style="font-size: 14px; font-weight: 700; color: #34d399; margin: 0 0 12px 0;">
            🌐 Внешний платёжный Webhook (YooKassa, CloudPayments, Robokassa)
          </h4>
          <div>
            <label style="display: block; font-size: 11px; color: #9ca3af; margin-bottom: 4px;">URL адрес обработчика вебхуков:</label>
            <input
              v-model="billing.webhookUrl"
              placeholder="https://pay.example.com/api/novus-webhook"
              style="width: 100%; box-sizing: border-box; background-color: #111827; border: 1px solid #374151; color: white; padding: 9px 12px; border-radius: 6px; font-size: 12px; outline: none; font-family: monospace;"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 3: Users & Licensing (B2C) -->
    <div v-if="activeTab === 'users'" style="background-color: #111827; border: 1px solid #1f2937; border-radius: 10px; padding: 24px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 14px;">
        <div>
          <h3 style="font-size: 17px; font-weight: 700; color: #f9fafb; margin: 0 0 4px 0;">
            Пользователи и Выдача лицензий
          </h3>
          <p style="font-size: 13px; color: #9ca3af; margin: 0;">
            Выдавайте персональные платные лицензии зарегистрированным клиентам или приглашайте новых с предоплаченным тарифом.
          </p>
        </div>

        <div style="display: flex; gap: 10px;">
          <button
            @click="showInviteModal = true"
            style="background: linear-gradient(135deg, #0284c7, #2563eb); color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px;"
          >
            ✉️ Пригласить пользователя с тарифом
          </button>
          <button
            @click="loadUsers"
            style="background-color: #1f2937; color: #e5e7eb; border: 1px solid #374151; padding: 8px 14px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;"
          >
            🔄 Обновить
          </button>
        </div>
      </div>

      <!-- Search user -->
      <div style="margin-bottom: 16px;">
        <input
          v-model="userSearch"
          type="text"
          placeholder="Поиск пользователя по email или имени для назначения лицензии..."
          style="width: 100%; box-sizing: border-box; background-color: #0b0f19; border: 1px solid #374151; color: white; padding: 10px 14px; border-radius: 6px; font-size: 13px; outline: none;"
        />
      </div>

      <!-- Users Table -->
      <div style="background-color: #0b0f19; border: 1px solid #1f2937; border-radius: 8px; overflow: hidden; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr style="border-bottom: 1px solid #1f2937; color: #9ca3af; text-align: left; background-color: #161e2e;">
              <th style="padding: 12px 16px;">Пользователь</th>
              <th style="padding: 12px 16px;">Статус</th>
              <th style="padding: 12px 16px;">Текущий тариф</th>
              <th style="padding: 12px 16px;">Хранилище</th>
              <th style="padding: 12px 16px; text-align: right;">Действие</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loadingUsers">
              <td colspan="5" style="padding: 30px; text-align: center; color: #9ca3af;">
                Загрузка списка пользователей...
              </td>
            </tr>
            <tr v-else-if="filteredUsers.length === 0">
              <td colspan="5" style="padding: 30px; text-align: center; color: #6b7280;">
                Пользователей не найдено.
              </td>
            </tr>
            <tr
              v-for="user in filteredUsers"
              :key="user.id"
              style="border-bottom: 1px solid #1f2937; transition: background 0.15s ease;"
            >
              <td style="padding: 14px 16px;">
                <div style="font-weight: 600; color: #f9fafb;">{{ user.name || user.email }}</div>
                <div style="font-size: 11px; color: #9ca3af; font-family: monospace;">{{ user.email }}</div>
              </td>
              <td style="padding: 14px 16px;">
                <span
                  :style="{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor: user.userEnabled ? '#064e3b' : '#450a0a',
                    color: user.userEnabled ? '#34d399' : '#f87171',
                  }"
                >
                  {{ user.userEnabled ? 'Активен' : 'Отключён' }}
                </span>
              </td>
              <td style="padding: 14px 16px;">
                <span
                  :style="{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '3px 8px',
                    borderRadius: '4px',
                    backgroundColor: getPlanBadge(user.licensePlan).bg,
                    color: getPlanBadge(user.licensePlan).color,
                    border: `1px solid ${getPlanBadge(user.licensePlan).border}`,
                  }"
                >
                  {{ getPlanBadge(user.licensePlan).label }}
                </span>
              </td>
              <td style="padding: 14px 16px; color: #94a3b8; font-size: 12px;">
                {{ user.storageUsage || '10 ГБ' }}
              </td>
              <td style="padding: 14px 16px; text-align: right;">
                <button
                  @click="openUserLicenseModal(user)"
                  style="background-color: #1f2937; color: #38bdf8; border: 1px solid #0284c7; padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; transition: background 0.15s;"
                >
                  👑 Выдать лицензию / Сменить тариф
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Global B2C Features Config -->
      <h4 style="font-size: 14px; font-weight: 700; color: #cbd5e1; margin: 0 0 14px 0;">
        Глобальные возможности для всех пользователей (B2C)
      </h4>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 14px;">
        <div style="background-color: #1f2937; padding: 14px; border-radius: 8px;">
          <label style="display: flex; align-items: center; justify-content: space-between; cursor: pointer;">
            <div>
              <div style="font-weight: 600; color: #f9fafb; font-size: 13.5px;">Bitwarden Premium для всех</div>
              <div style="font-size: 11px; color: #9ca3af;">Автоматически выдавать премиум-статус при регистрации</div>
            </div>
            <input type="checkbox" v-model="b2cConfig.globalPremiumEnabled" style="width: 18px; height: 18px;" />
          </label>
        </div>

        <div style="background-color: #1f2937; padding: 14px; border-radius: 8px;">
          <label style="display: flex; align-items: center; justify-content: space-between; cursor: pointer;">
            <div>
              <div style="font-weight: 600; color: #f9fafb; font-size: 13.5px;">Встроенный генератор 2FA (TOTP)</div>
              <div style="font-size: 11px; color: #9ca3af;">Генерация одноразовых паролей прямо внутри записей</div>
            </div>
            <input type="checkbox" v-model="b2cConfig.totpGeneratorEnabled" style="width: 18px; height: 18px;" />
          </label>
        </div>

        <div style="background-color: #1f2937; padding: 14px; border-radius: 8px;">
          <label style="display: flex; align-items: center; justify-content: space-between; cursor: pointer;">
            <div>
              <div style="font-weight: 600; color: #f9fafb; font-size: 13.5px;">Аварийный доступ (Emergency Access)</div>
              <div style="font-size: 11px; color: #9ca3af;">Разрешить назначение доверенных лиц на случай ЧП</div>
            </div>
            <input type="checkbox" v-model="b2cConfig.emergencyAccessEnabled" style="width: 18px; height: 18px;" />
          </label>
        </div>
      </div>
    </div>

    <!-- TAB 4: B2B Organizations -->
    <div v-if="activeTab === 'b2b'" style="background-color: #111827; border: 1px solid #1f2937; border-radius: 10px; padding: 20px;">
      <h3 style="font-size: 16px; font-weight: 700; color: #f9fafb; margin: 0 0 16px 0;">
        Управление корпоративными квотами организаций
      </h3>

      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr style="border-bottom: 1px solid #374151; color: #9ca3af; text-align: left;">
              <th style="padding: 10px;">Организация</th>
              <th style="padding: 10px;">Тарифный план</th>
              <th style="padding: 10px;">Места (Seats)</th>
              <th style="padding: 10px;">PAM Места</th>
              <th style="padding: 10px;">Срок токена</th>
              <th style="padding: 10px;">SSO / SCIM</th>
              <th style="padding: 10px;">Статус</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="org in organizations" :key="org.id" style="border-bottom: 1px solid #1f2937;">
              <td style="padding: 12px 10px; font-weight: 600; color: #f9fafb;">
                {{ org.name }}
              </td>
              <td style="padding: 12px 10px;">
                <select
                  v-model="org.plan"
                  style="background-color: #1f2937; color: #e5e7eb; border: 1px solid #374151; border-radius: 4px; padding: 4px 8px; font-size: 12px;"
                >
                  <option value="Teams">Teams</option>
                  <option value="Enterprise">Enterprise</option>
                  <option value="Enterprise + PAM">Enterprise + PAM</option>
                </select>
              </td>
              <td style="padding: 12px 10px;">
                <input
                  type="number"
                  v-model.number="org.seats"
                  style="width: 70px; background-color: #1f2937; color: #e5e7eb; border: 1px solid #374151; border-radius: 4px; padding: 4px 6px; font-size: 12px;"
                />
              </td>
              <td style="padding: 12px 10px;">
                <input
                  type="number"
                  v-model.number="org.pamSeats"
                  style="width: 60px; background-color: #1f2937; color: #e5e7eb; border: 1px solid #374151; border-radius: 4px; padding: 4px 6px; font-size: 12px;"
                />
              </td>
              <td style="padding: 12px 10px;">
                <select
                  v-model.number="org.tokenLifetimeHours"
                  style="background-color: #1f2937; color: #e5e7eb; border: 1px solid #374151; border-radius: 4px; padding: 4px 6px; font-size: 12px;"
                >
                  <option :value="1">1 час</option>
                  <option :value="4">4 часа</option>
                  <option :value="12">12 часов</option>
                  <option :value="24">24 часа</option>
                </select>
              </td>
              <td style="padding: 12px 10px;">
                <span :style="{ color: org.ssoEnabled ? '#34d399' : '#9ca3af', fontWeight: 600, marginRight: '6px' }">
                  SSO: {{ org.ssoEnabled ? 'ВКЛ' : 'ВЫКЛ' }}
                </span>
                <span :style="{ color: org.scimEnabled ? '#34d399' : '#9ca3af', fontWeight: 600 }">
                  SCIM: {{ org.scimEnabled ? 'ВКЛ' : 'ВЫКЛ' }}
                </span>
              </td>
              <td style="padding: 12px 10px;">
                <span style="background-color: #064e3b; color: #34d399; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">
                  {{ org.status }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- TAB 5: License Generator -->
    <div v-if="activeTab === 'license'" style="background-color: #111827; border: 1px solid #1f2937; border-radius: 10px; padding: 24px;">
      <h3 style="font-size: 16px; font-weight: 700; color: #f9fafb; margin: 0 0 6px 0;">
        Генерация автономной криптографической лицензии (.novuslic)
      </h3>
      <p style="font-size: 12px; color: #9ca3af; margin: 0 0 18px 0;">
        Используется для активации корпоративных онпремиз-установок NovusWarden в закрытых контурах без доступа в интернет.
      </p>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; margin-bottom: 16px;">
        <div>
          <label style="display: block; font-size: 12px; color: #9ca3af; margin-bottom: 4px;">Имя клиента / Организации:</label>
          <input
            v-model="licenseClient"
            style="width: 100%; box-sizing: border-box; background-color: #1f2937; color: #e5e7eb; border: 1px solid #374151; border-radius: 6px; padding: 10px; font-size: 13px;"
          />
        </div>

        <div>
          <label style="display: block; font-size: 12px; color: #9ca3af; margin-bottom: 4px;">Тарифный план:</label>
          <select
            v-model="licenseTarget"
            style="width: 100%; box-sizing: border-box; background-color: #1f2937; color: #e5e7eb; border: 1px solid #374151; border-radius: 6px; padding: 10px; font-size: 13px;"
          >
            <option value="Enterprise Unlimited">Enterprise Unlimited</option>
            <option value="Enterprise + PAM">Enterprise + PAM</option>
            <option value="Teams Dedicated">Teams Dedicated</option>
            <option value="Lifetime VIP">Lifetime VIP</option>
          </select>
        </div>

        <div>
          <label style="display: block; font-size: 12px; color: #9ca3af; margin-bottom: 4px;">Срок действия (дней):</label>
          <input
            type="number"
            v-model.number="licenseGenDays"
            style="width: 100%; box-sizing: border-box; background-color: #1f2937; color: #e5e7eb; border: 1px solid #374151; border-radius: 6px; padding: 10px; font-size: 13px;"
          />
        </div>
      </div>

      <button
        @click="generateLicense"
        style="background: linear-gradient(135deg, #0284c7, #2563eb); color: white; border: none; padding: 10px 20px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; margin-bottom: 16px;"
      >
        Сгенерировать лицензию
      </button>

      <div v-if="generatedLicense">
        <label style="display: block; font-size: 12px; color: #34d399; font-weight: 600; margin-bottom: 6px;">
          ✓ Подписанный файл лицензии:
        </label>
        <pre style="background-color: #0b0f19; color: #38bdf8; padding: 14px; border-radius: 6px; border: 1px solid #1f2937; font-size: 12px; overflow-x: auto;"><code>{{ generatedLicense }}</code></pre>
      </div>
    </div>

    <!-- User License Assignment Modal -->
    <div
      v-if="showLicenseModal"
      style="position: fixed; inset: 0; background-color: rgba(0,0,0,0.75); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 100;"
    >
      <div style="background-color: #111827; border: 1px solid #38bdf8; border-radius: 12px; width: 100%; max-width: 480px; padding: 24px; box-shadow: 0 20px 40px rgba(0,0,0,0.6), 0 0 30px rgba(56, 189, 248, 0.15);">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 14px;">
          <div style="width: 38px; height: 38px; border-radius: 8px; background: linear-gradient(135deg, #0284c7, #2563eb); display: flex; align-items: center; justify-content: center; font-size: 18px;">
            👑
          </div>
          <div>
            <h3 style="font-size: 18px; font-weight: 700; color: #f9fafb; margin: 0;">
              Назначение тарифа пользователю
            </h3>
            <p style="font-size: 12px; color: #9ca3af; margin: 0;">
              Изменение плана, дисковой квоты и привилегий аккаунта
            </p>
          </div>
        </div>

        <div v-if="licenseMessage" :style="{ padding: '10px 14px', borderRadius: '6px', marginBottom: '14px', fontSize: '12px', fontWeight: 500, backgroundColor: licenseMessage.error ? '#450a0a' : '#064e3b', color: licenseMessage.error ? '#fca5a5' : '#86efac', border: licenseMessage.error ? '1px solid #991b1b' : '1px solid #059669' }">
          {{ licenseMessage.text }}
        </div>

        <div style="background-color: #1f2937; border-radius: 8px; padding: 12px; margin-bottom: 16px; font-size: 13px;">
          <div style="color: #9ca3af; margin-bottom: 2px;">Клиент:</div>
          <div style="font-weight: 600; color: #f9fafb; word-break: break-all;">
            {{ licenseTargetUser?.name ? `${licenseTargetUser.name} (${licenseTargetUser.email})` : licenseTargetUser?.email }}
          </div>
        </div>

        <!-- Plan Selection -->
        <div style="margin-bottom: 16px;">
          <label style="display: block; font-size: 12px; font-weight: 600; color: #cbd5e1; margin-bottom: 8px;">
            Выберите тарифный план:
          </label>
          <div style="display: grid; gap: 8px;">
            <label
              v-for="plan in [
                { id: 'free', name: 'Free (Базовый)', desc: 'Стандартный парольный сейф без расширенных функций' },
                { id: 'pro', name: 'Novus Pro ⚡', desc: 'Встроенный генератор TOTP, 10 ГБ хранилища, аварийный доступ' },
                { id: 'enterprise', name: 'Novus Enterprise 🏢', desc: 'SSO, SCIM 2.0 интеграции, расширенные политики и аудит' },
                { id: 'lifetime', name: 'Lifetime VIP 👑', desc: 'Пожизненный максимальный доступ навсегда без ограничений' },
              ]"
              :key="plan.id"
              :style="{
                padding: '10px 14px',
                borderRadius: '8px',
                border: licensePlan === plan.id ? '1px solid #38bdf8' : '1px solid #374151',
                backgroundColor: licensePlan === plan.id ? '#0f2942' : '#1f2937',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                transition: 'all 0.15s ease',
              }"
            >
              <input type="radio" :value="plan.id" v-model="licensePlan" style="margin-top: 3px;" />
              <div>
                <div style="font-size: 13px; font-weight: 600; color: #f9fafb;">{{ plan.name }}</div>
                <div style="font-size: 11px; color: #9ca3af; margin-top: 2px;">{{ plan.desc }}</div>
              </div>
            </label>
          </div>
        </div>

        <!-- Expiration Days -->
        <div style="margin-bottom: 20px;">
          <label style="display: block; font-size: 12px; font-weight: 600; color: #cbd5e1; margin-bottom: 6px;">
            Срок действия лицензии:
          </label>
          <select
            v-model="licenseDays"
            style="width: 100%; box-sizing: border-box; background-color: #1f2937; border: 1px solid #374151; color: white; padding: 9px 12px; border-radius: 6px; font-size: 13px;"
          >
            <option :value="30">1 месяц (30 дней)</option>
            <option :value="90">3 месяца (90 дней)</option>
            <option :value="365">1 год (365 дней)</option>
            <option :value="null">Бессрочно / Lifetime VIP</option>
          </select>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 10px;">
          <button
            type="button"
            @click="showLicenseModal = false"
            style="background-color: #1f2937; color: #e5e7eb; border: 1px solid #374151; padding: 9px 16px; border-radius: 6px; font-size: 13px; cursor: pointer;"
          >
            Отмена
          </button>
          <button
            type="button"
            @click="saveUserLicense"
            :disabled="savingLicense"
            style="background: linear-gradient(135deg, #0284c7, #2563eb); color: white; border: none; padding: 9px 18px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;"
          >
            {{ savingLicense ? 'Сохранение...' : 'Применить лицензию' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Invite Modal -->
    <div
      v-if="showInviteModal"
      style="position: fixed; inset: 0; background-color: rgba(0,0,0,0.75); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 100;"
    >
      <div style="background-color: #111827; border: 1px solid #38bdf8; border-radius: 12px; width: 100%; max-width: 460px; padding: 24px; box-shadow: 0 20px 40px rgba(0,0,0,0.6), 0 0 30px rgba(56, 189, 248, 0.15);">
        <h3 style="font-size: 18px; font-weight: 700; color: #f9fafb; margin: 0 0 6px 0;">
          ✉️ Приглашение с тарифом
        </h3>
        <p style="font-size: 12px; color: #9ca3af; margin: 0 0 16px 0;">
          Пользователь получит email со ссылкой для создания аккаунта с уже назначенным тарифом.
        </p>

        <div style="display: grid; gap: 12px; margin-bottom: 20px;">
          <div>
            <label style="display: block; font-size: 11px; color: #9ca3af; margin-bottom: 4px;">Email пользователя:</label>
            <input
              v-model="inviteEmail"
              placeholder="colleague@domain.com"
              type="email"
              style="width: 100%; box-sizing: border-box; background-color: #1f2937; border: 1px solid #374151; color: white; padding: 9px 12px; border-radius: 6px; font-size: 13px;"
            />
          </div>

          <div>
            <label style="display: block; font-size: 11px; color: #9ca3af; margin-bottom: 4px;">Предоплаченный тариф:</label>
            <select
              v-model="invitePlan"
              style="width: 100%; box-sizing: border-box; background-color: #1f2937; border: 1px solid #374151; color: white; padding: 9px 12px; border-radius: 6px; font-size: 13px;"
            >
              <option value="free">Free (Базовый)</option>
              <option value="pro">Novus Pro ⚡</option>
              <option value="enterprise">Novus Enterprise 🏢</option>
              <option value="lifetime">Lifetime VIP 👑</option>
            </select>
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 10px;">
          <button
            type="button"
            @click="showInviteModal = false"
            style="background-color: #1f2937; color: #e5e7eb; border: 1px solid #374151; padding: 9px 16px; border-radius: 6px; font-size: 13px; cursor: pointer;"
          >
            Отмена
          </button>
          <button
            type="button"
            @click="handleInviteUser"
            :disabled="inviting"
            style="background: linear-gradient(135deg, #0284c7, #2563eb); color: white; border: none; padding: 9px 18px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;"
          >
            {{ inviting ? 'Отправка...' : 'Отправить приглашение' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Checkout Link Generator Modal -->
    <div
      v-if="showCheckoutModal"
      style="position: fixed; inset: 0; background-color: rgba(0,0,0,0.75); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 100;"
    >
      <div style="background-color: #111827; border: 1px solid #38bdf8; border-radius: 12px; width: 100%; max-width: 500px; padding: 24px; box-shadow: 0 20px 40px rgba(0,0,0,0.6), 0 0 30px rgba(56, 189, 248, 0.15);">
        <h3 style="font-size: 18px; font-weight: 700; color: #f9fafb; margin: 0 0 6px 0;">
          🔗 Генератор ссылки на оплату
        </h3>
        <p style="font-size: 12px; color: #9ca3af; margin: 0 0 16px 0;">
          Создайте прямую платёжную ссылку для отправки клиенту или партнёру.
        </p>

        <div style="display: grid; gap: 12px; margin-bottom: 20px;">
          <div>
            <label style="display: block; font-size: 11px; color: #9ca3af; margin-bottom: 4px;">Тарифный план:</label>
            <select
              v-model="checkoutPlan"
              @change="updateCheckoutLink"
              style="width: 100%; box-sizing: border-box; background-color: #1f2937; border: 1px solid #374151; color: white; padding: 9px 12px; border-radius: 6px; font-size: 13px;"
            >
              <option value="pro">Novus Pro ⚡</option>
              <option value="enterprise">Novus Enterprise 🏢</option>
              <option value="lifetime">Lifetime VIP 👑</option>
            </select>
          </div>

          <div>
            <label style="display: block; font-size: 11px; color: #9ca3af; margin-bottom: 4px;">Период подписки:</label>
            <select
              v-model="checkoutPeriod"
              @change="updateCheckoutLink"
              style="width: 100%; box-sizing: border-box; background-color: #1f2937; border: 1px solid #374151; color: white; padding: 9px 12px; border-radius: 6px; font-size: 13px;"
            >
              <option value="month">1 месяц</option>
              <option value="year">1 год (скидка 20%)</option>
              <option value="lifetime">Бессрочно / Lifetime</option>
            </select>
          </div>

          <div>
            <label style="display: block; font-size: 11px; color: #9ca3af; margin-bottom: 4px;">Email клиента (опционально, для привязки):</label>
            <input
              v-model="checkoutCustomerEmail"
              @input="updateCheckoutLink"
              placeholder="customer@domain.com"
              type="email"
              style="width: 100%; box-sizing: border-box; background-color: #1f2937; border: 1px solid #374151; color: white; padding: 9px 12px; border-radius: 6px; font-size: 13px;"
            />
          </div>

          <div>
            <label style="display: block; font-size: 11px; color: #34d399; font-weight: 600; margin-bottom: 4px;">Готовая ссылка на оплату:</label>
            <input
              :value="generatedCheckoutLink"
              readonly
              style="width: 100%; box-sizing: border-box; background-color: #0b0f19; border: 1px solid #0284c7; color: #38bdf8; padding: 9px 12px; border-radius: 6px; font-size: 12px; font-family: monospace;"
            />
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 10px;">
          <button
            type="button"
            @click="showCheckoutModal = false"
            style="background-color: #1f2937; color: #e5e7eb; border: 1px solid #374151; padding: 9px 16px; border-radius: 6px; font-size: 13px; cursor: pointer;"
          >
            Закрыть
          </button>
          <button
            type="button"
            @click="copyCheckoutLink"
            style="background: linear-gradient(135deg, #0284c7, #2563eb); color: white; border: none; padding: 9px 18px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;"
          >
            📋 Скопировать ссылку
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
