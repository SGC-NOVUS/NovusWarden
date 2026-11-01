<script setup lang="ts">
import { ref } from 'vue';

// Server operating mode
const serverMode = ref<'unlimited' | 'managed'>('unlimited');
const activeTab = ref<'b2c' | 'b2b' | 'license'>('b2b');

// B2C Config
const b2cConfig = ref({
  globalPremiumEnabled: true,
  defaultStorageMb: 10240, // 10 GB
  emergencyAccessEnabled: true,
  totpGeneratorEnabled: true,
  fido2HardwareKeys: true,
  maxSendFileSizeMb: 500,
});

// B2B Organizations Mock State
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

// License generator state
const licenseTarget = ref('Enterprise Unlimited');
const licenseDays = ref(365);
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
    expiresAt: new Date(Date.now() + licenseDays.value * 86400000).toISOString(),
    features: ['sso', 'scim_v2', 'pam', 'totp', 'emergency_access', 'audit_logs'],
    signature: 'SHA256-RSA-SIG-NOVUS-' + Math.random().toString(36).substring(2, 15).toUpperCase(),
  };
  generatedLicense.value = JSON.stringify(payload, null, 2);
}

const saveNotice = ref(false);
function saveConfig() {
  saveNotice.value = true;
  setTimeout(() => {
    saveNotice.value = false;
  }, 3000);
}
</script>

<template>
  <div style="padding: 24px; max-width: 1200px; margin: 0 auto; color: #f3f4f6;">
    <!-- Header -->
    <div style="margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-start;">
      <div>
        <h1 style="font-size: 22px; font-weight: 700; color: #38bdf8; margin: 0 0 6px 0;">
          Управление подписками и лицензиями (B2C & B2B)
        </h1>
        <p style="font-size: 13px; color: #9ca3af; margin: 0;">
          Конфигурация тарифных планов, квот организаций и параметров премиум-доступа NovusWarden
        </p>
      </div>

      <div v-if="saveNotice" style="background-color: #064e3b; color: #34d399; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; border: 1px solid #059669;">
        ✓ Настройки успешно сохранены
      </div>
    </div>

    <!-- Operating Mode Selector -->
    <div style="background-color: #111827; border: 1px solid #1f2937; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
      <h2 style="font-size: 15px; font-weight: 600; color: #e5e7eb; margin: 0 0 14px 0;">
        Режим работы биллинговой системы NovusWarden
      </h2>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
        <!-- Card 1: Unlimited -->
        <div
          @click="serverMode = 'unlimited'"
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
              ⭐ Безлимитный Open Source (По умолчанию)
            </span>
            <span style="font-size: 11px; padding: 2px 8px; border-radius: 4px; background-color: #0369a1; color: #e0f2fe; font-weight: 600;">
              Рекомендуемый
            </span>
          </div>
          <p style="font-size: 12px; color: #94a3b8; margin: 0; line-height: 1.5;">
            Все премиум-функции (TOTP, экстренный доступ, неограниченные организации, SCIM и PAM заглушки) открыты для всех пользователей и компаний абсолютно бесплатно ($0.00).
          </p>
        </div>

        <!-- Card 2: Managed -->
        <div
          @click="serverMode = 'managed'"
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
              💼 Управляемые квоты и лицензии (SaaS / Private Cloud)
            </span>
            <span style="font-size: 11px; padding: 2px 8px; border-radius: 4px; background-color: #78350f; color: #fde68a; font-weight: 600;">
              Корпоративный
            </span>
          </div>
          <p style="font-size: 12px; color: #94a3b8; margin: 0; line-height: 1.5;">
            Разделение физических лиц (B2C) и организаций (B2B) по тарифным планам с контролем квот мест, PAM-лицензий и хранилища.
          </p>
        </div>
      </div>
    </div>

    <!-- Tabs Header -->
    <div style="display: flex; gap: 8px; border-bottom: 1px solid #1f2937; margin-bottom: 20px;">
      <button
        @click="activeTab = 'b2b'"
        :style="{
          padding: '10px 18px',
          border: 'none',
          background: 'none',
          color: activeTab === 'b2b' ? '#38bdf8' : '#9ca3af',
          borderBottom: activeTab === 'b2b' ? '2px solid #38bdf8' : '2px solid transparent',
          fontWeight: 600,
          fontSize: '14px',
          cursor: 'pointer',
        }"
      >
        🏢 B2B: Организации и Компании
      </button>

      <button
        @click="activeTab = 'b2c'"
        :style="{
          padding: '10px 18px',
          border: 'none',
          background: 'none',
          color: activeTab === 'b2c' ? '#38bdf8' : '#9ca3af',
          borderBottom: activeTab === 'b2c' ? '2px solid #38bdf8' : '2px solid transparent',
          fontWeight: 600,
          fontSize: '14px',
          cursor: 'pointer',
        }"
      >
        👤 B2C: Индивидуальные пользователи и Семьи
      </button>

      <button
        @click="activeTab = 'license'"
        :style="{
          padding: '10px 18px',
          border: 'none',
          background: 'none',
          color: activeTab === 'license' ? '#38bdf8' : '#9ca3af',
          borderBottom: activeTab === 'license' ? '2px solid #38bdf8' : '2px solid transparent',
          fontWeight: 600,
          fontSize: '14px',
          cursor: 'pointer',
        }"
      >
        🔑 Генератор офлайн-лицензий (.novuslic)
      </button>
    </div>

    <!-- B2B Section -->
    <div v-if="activeTab === 'b2b'" style="background-color: #111827; border: 1px solid #1f2937; border-radius: 8px; padding: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h3 style="font-size: 15px; font-weight: 600; color: #f3f4f6; margin: 0;">
          Управление корпоративными тарифами организаций
        </h3>
        <button
          @click="saveConfig"
          style="background-color: #0284c7; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;"
        >
          Сохранить изменения
        </button>
      </div>

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
                v-model="org.seats"
                style="width: 70px; background-color: #1f2937; color: #e5e7eb; border: 1px solid #374151; border-radius: 4px; padding: 4px 6px; font-size: 12px;"
              />
            </td>
            <td style="padding: 12px 10px;">
              <input
                type="number"
                v-model="org.pamSeats"
                style="width: 60px; background-color: #1f2937; color: #e5e7eb; border: 1px solid #374151; border-radius: 4px; padding: 4px 6px; font-size: 12px;"
              />
            </td>
            <td style="padding: 12px 10px;">
              <select
                v-model="org.tokenLifetimeHours"
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

    <!-- B2C Section -->
    <div v-if="activeTab === 'b2c'" style="background-color: #111827; border: 1px solid #1f2937; border-radius: 8px; padding: 20px;">
      <h3 style="font-size: 15px; font-weight: 600; color: #f3f4f6; margin: 0 0 16px 0;">
        Настройки функционала для физических лиц (B2C)
      </h3>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
        <div style="background-color: #1f2937; padding: 14px; border-radius: 6px;">
          <label style="display: flex; align-items: center; justify-content: space-between; cursor: pointer;">
            <div>
              <div style="font-weight: 600; color: #f9fafb; font-size: 14px;">Bitwarden Premium для всех пользователей</div>
              <div style="font-size: 12px; color: #9ca3af;">Автоматически выдавать премиум-статус при регистрации</div>
            </div>
            <input type="checkbox" v-model="b2cConfig.globalPremiumEnabled" style="width: 18px; height: 18px;" />
          </label>
        </div>

        <div style="background-color: #1f2937; padding: 14px; border-radius: 6px;">
          <label style="display: flex; align-items: center; justify-content: space-between; cursor: pointer;">
            <div>
              <div style="font-weight: 600; color: #f9fafb; font-size: 14px;">Встроенный генератор 2FA (TOTP)</div>
              <div style="font-size: 12px; color: #9ca3af;">Генерация одноразовых паролей прямо внутри записей</div>
            </div>
            <input type="checkbox" v-model="b2cConfig.totpGeneratorEnabled" style="width: 18px; height: 18px;" />
          </label>
        </div>

        <div style="background-color: #1f2937; padding: 14px; border-radius: 6px;">
          <label style="display: flex; align-items: center; justify-content: space-between; cursor: pointer;">
            <div>
              <div style="font-weight: 600; color: #f9fafb; font-size: 14px;">Аварийный доступ (Emergency Access)</div>
              <div style="font-size: 12px; color: #9ca3af;">Разрешить назначение доверенных лиц на случай ЧП</div>
            </div>
            <input type="checkbox" v-model="b2cConfig.emergencyAccessEnabled" style="width: 18px; height: 18px;" />
          </label>
        </div>

        <div style="background-color: #1f2937; padding: 14px; border-radius: 6px;">
          <label style="display: flex; align-items: center; justify-content: space-between;">
            <div>
              <div style="font-weight: 600; color: #f9fafb; font-size: 14px;">Квота хранилища вложений (МБ)</div>
              <div style="font-size: 12px; color: #9ca3af;">Лимит зашифрованных файлов на пользователя</div>
            </div>
            <input
              type="number"
              v-model="b2cConfig.defaultStorageMb"
              style="width: 100px; background-color: #111827; color: #e5e7eb; border: 1px solid #374151; border-radius: 4px; padding: 4px 8px; font-size: 13px;"
            />
          </label>
        </div>
      </div>

      <div style="margin-top: 18px; display: flex; justify-content: flex-end;">
        <button
          @click="saveConfig"
          style="background-color: #0284c7; color: white; border: none; padding: 8px 18px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;"
        >
          Сохранить настройки B2C
        </button>
      </div>
    </div>

    <!-- License Generator Section -->
    <div v-if="activeTab === 'license'" style="background-color: #111827; border: 1px solid #1f2937; border-radius: 8px; padding: 20px;">
      <h3 style="font-size: 15px; font-weight: 600; color: #f3f4f6; margin: 0 0 14px 0;">
        Генерация автономной криптографической лицензии (.novuslic)
      </h3>
      <p style="font-size: 12px; color: #9ca3af; margin: 0 0 16px 0;">
        Используется для активации корпоративных онпремиз-установок NovusWarden в закрытых контурах без доступа в интернет.
      </p>

      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; margin-bottom: 16px;">
        <div>
          <label style="display: block; font-size: 12px; color: #9ca3af; margin-bottom: 4px;">Имя клиента / Организации:</label>
          <input
            v-model="licenseClient"
            style="width: 100%; box-sizing: border-box; background-color: #1f2937; color: #e5e7eb; border: 1px solid #374151; border-radius: 4px; padding: 8px; font-size: 13px;"
          />
        </div>

        <div>
          <label style="display: block; font-size: 12px; color: #9ca3af; margin-bottom: 4px;">Тарифный план:</label>
          <select
            v-model="licenseTarget"
            style="width: 100%; box-sizing: border-box; background-color: #1f2937; color: #e5e7eb; border: 1px solid #374151; border-radius: 4px; padding: 8px; font-size: 13px;"
          >
            <option value="Enterprise Unlimited">Enterprise Unlimited</option>
            <option value="Enterprise + PAM">Enterprise + PAM</option>
            <option value="Teams Dedicated">Teams Dedicated</option>
          </select>
        </div>

        <div>
          <label style="display: block; font-size: 12px; color: #9ca3af; margin-bottom: 4px;">Срок действия (дней):</label>
          <input
            type="number"
            v-model="licenseDays"
            style="width: 100%; box-sizing: border-box; background-color: #1f2937; color: #e5e7eb; border: 1px solid #374151; border-radius: 4px; padding: 8px; font-size: 13px;"
          />
        </div>
      </div>

      <button
        @click="generateLicense"
        style="background-color: #0284c7; color: white; border: none; padding: 8px 18px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; margin-bottom: 16px;"
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
  </div>
</template>

