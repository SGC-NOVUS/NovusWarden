<script setup lang="ts">
import { ref } from 'vue';
</script>

<template>
  <div>
    <div style="margin-bottom: 24px;">
      <h1 style="font-size: 24px; font-weight: 700; color: #f9fafb; margin: 0 0 6px 0;">
        Организации и коллекции
      </h1>
      <p style="font-size: 14px; color: #9ca3af; margin: 0;">
        Корпоративные общие хранилища, коллекции групп и распределение прав участников.
      </p>
    </div>

    <div style="background-color: #111827; border: 1px solid #1f2937; border-radius: 8px; padding: 24px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h2 style="font-size: 16px; font-weight: 600; color: #f9fafb; margin: 0;">
          Управление организациями
        </h2>
      </div>

      <p style="font-size: 13px; color: #9ca3af; line-height: 20px;">
        Для просмотра детальных параметров коллекций, назначений политик и управления правами доступа конкретных организаций используйте классический инспектор организаций или веб-хранилище Bitwarden.
      </p>

      <div style="margin-top: 16px; display: flex; gap: 12px; flex-wrap: wrap;">
        <a
          href="/admin/organizations/overview"
          target="_blank"
          style="display: inline-block; background-color: #2563eb; color: white; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; text-decoration: none;"
        >
          Инспектор организаций (Classic) ↗
        </a>
        <router-link
          to="/subscriptions"
          style="display: inline-block; background-color: #1f2937; color: #fbbf24; border: 1px solid #b45309; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; text-decoration: none;"
        >
          Тарифы B2B для организаций →
        </router-link>
      </div>
    </div>
  </div>
</template>
