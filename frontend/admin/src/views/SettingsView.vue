<script setup lang="ts">
import { ref } from 'vue';

function handleBackupDb() {
  window.open('/admin/config/backup_db', '_blank');
}

function handleExportUsers() {
  window.open('/admin/users/export', '_blank');
}
</script>

<template>
  <div>
    <div style="margin-bottom: 24px;">
      <h1 style="font-size: 24px; font-weight: 700; color: #f9fafb; margin: 0 0 6px 0;">
        Настройки и параметры системы
      </h1>
      <p style="font-size: 14px; color: #9ca3af; margin: 0;">
        Управление всеми параметрами сервера NovusWarden, резервным копированием базы данных и политиками безопасности.
      </p>
    </div>

    <div style="display: grid; gap: 20px;">
      <!-- Main Configuration Access -->
      <div style="background-color: #111827; border: 1px solid #1f2937; border-radius: 8px; padding: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px;">
          <div style="max-width: 800px;">
            <h2 style="font-size: 16px; font-weight: 600; color: #f9fafb; margin: 0 0 8px 0;">
              Центральный конфигуратор параметров (100+ настроек)
            </h2>
            <p style="font-size: 13px; color: #9ca3af; margin: 0 0 16px 0; line-height: 20px;">
              Все детальные флаги окружения и runtime-настройки (SMTP-почта, параметры KDF, WebSockets, политики самостоятельной регистрации, 2FA, иконки, время жизни сессий) полностью настраиваются в центральной классической панели управления с валидацией значений.
            </p>
          </div>
          <a
            href="/admin"
            style="background-color: #2563eb; color: white; padding: 10px 20px; border-radius: 6px; font-size: 13px; font-weight: 600; text-decoration: none; display: inline-flex; align-items: center; gap: 8px;"
          >
            Открыть конфигуратор параметров ↗
          </a>
        </div>
      </div>

      <!-- Database Maintenance & Export -->
      <div style="background-color: #111827; border: 1px solid #1f2937; border-radius: 8px; padding: 24px;">
        <h2 style="font-size: 16px; font-weight: 600; color: #f9fafb; margin: 0 0 8px 0;">
          Резервное копирование и экспорт данных
        </h2>
        <p style="font-size: 13px; color: #9ca3af; margin: 0 0 16px 0; line-height: 20px;">
          Создание резервной копии базы данных или экспорт зашифрованных дампов учётных записей пользователей.
        </p>
        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
          <button
            @click="handleBackupDb"
            style="background-color: #1f2937; color: #38bdf8; border: 1px solid #374151; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;"
          >
            💾 Создать бэкап базы данных
          </button>
          <button
            @click="handleExportUsers"
            style="background-color: #1f2937; color: #34d399; border: 1px solid #374151; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;"
          >
            📥 Экспорт полного дампа пользователей (JSON)
          </button>
        </div>
      </div>

      <!-- Subscriptions Hub Shortcut -->
      <div style="background-color: #111827; border: 1px solid #1f2937; border-radius: 8px; padding: 24px;">
        <h2 style="font-size: 16px; font-weight: 600; color: #f9fafb; margin: 0 0 8px 0;">
          Монетизация, тарифы и лицензии (B2C & B2B)
        </h2>
        <p style="font-size: 13px; color: #9ca3af; margin: 0 0 16px 0; line-height: 20px;">
          Управление тарифными планами для конечных пользователей (B2C), корпоративными подписками организаций (B2B), лимитами хранилища и выпуск автономных офлайн-лицензий <code style="color: #38bdf8;">.novuslic</code>.
        </p>
        <router-link
          to="/subscriptions"
          style="display: inline-block; background-color: #1f2937; color: #fbbf24; border: 1px solid #b45309; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; text-decoration: none;"
        >
          Перейти в центр подписок и лицензий →
        </router-link>
      </div>
    </div>
  </div>
</template>
