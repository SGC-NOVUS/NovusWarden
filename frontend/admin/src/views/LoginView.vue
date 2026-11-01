<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { api, authState } from '../api/client.ts';

const router = useRouter();
const route = useRoute();

const token = ref('');
const showPassword = ref(false);
const loading = ref(false);
const errorMessage = ref<string | null>(null);

async function handleLogin() {
  if (!token.value.trim()) return;
  loading.value = true;
  errorMessage.value = null;

  try {
    await api.login(token.value);
    const redirect = (route.query.redirect as string) || '/';
    await router.push(redirect);
  } catch (err: any) {
    errorMessage.value = err.message || 'Ошибка авторизации';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div style="width: 100%; display: flex; align-items: center; justify-content: center;">
    <div
      style="width: 100%; max-width: 440px; background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(16px); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 16px; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(14, 165, 233, 0.15); padding: 28px 30px; color: #f8fafc;"
    >
      <!-- Logo & Branding -->
      <div style="text-align: center; margin-bottom: 20px;">
        <div
          style="display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; border-radius: 14px; background: linear-gradient(135deg, rgba(2, 132, 199, 0.2), rgba(37, 99, 235, 0.3)); border: 1px solid rgba(56, 189, 248, 0.5); box-shadow: 0 0 20px rgba(56, 189, 248, 0.3); margin-bottom: 12px;"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        </div>
        <h1 style="font-size: 21px; font-weight: 700; color: #f8fafc; margin: 0 0 4px 0; letter-spacing: -0.5px;">
          NovusWarden Control Plane
        </h1>
        <p style="font-size: 13px; color: #94a3b8; margin: 0;">
          Авторизация главного администратора
        </p>
        <div
          style="display: inline-flex; align-items: center; gap: 6px; margin-top: 8px; padding: 3px 10px; border-radius: 999px; background: rgba(14, 165, 233, 0.1); border: 1px solid rgba(56, 189, 248, 0.25); font-size: 11px; font-weight: 600; color: #38bdf8;"
        >
          <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background-color: #38bdf8; box-shadow: 0 0 8px #38bdf8;"></span>
          Защита Novus Sentinel • Макс. 2 попытки
        </div>
      </div>

      <!-- Error Alert -->
      <div
        v-if="errorMessage"
        style="background: rgba(239, 68, 68, 0.15); border: 1px solid #ef4444; border-radius: 10px; padding: 10px 14px; margin-bottom: 16px; display: flex; align-items: flex-start; gap: 8px;"
      >
        <svg style="flex-shrink: 0; margin-top: 2px;" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <div style="font-size: 12px; line-height: 1.4; color: #fca5a5;">
          {{ errorMessage }}
        </div>
      </div>

      <!-- Login Form -->
      <form @submit.prevent="handleLogin" style="margin-top: 4px;">
        <div style="margin-bottom: 16px;">
          <label for="admin-token" style="display: block; font-size: 12px; font-weight: 600; color: #cbd5e1; margin-bottom: 6px;">
            Токен доступа администратора
          </label>
          <div style="position: relative;">
            <div style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); pointer-events: none; color: #64748b;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 2l-2 2m-1.5 1.5L12 11l-4 4-3-3-3 3 2 2 3-3 4 4 1.5-1.5"></path>
                <circle cx="15.5" cy="8.5" r="2.5"></circle>
              </svg>
            </div>
            <input
              id="admin-token"
              name="token"
              autocomplete="current-password"
              :type="showPassword ? 'text' : 'password'"
              v-model="token"
              placeholder="Введите мастер-токен администратора..."
              autofocus
              required
              style="width: 100%; box-sizing: border-box; background: #0f172a; border: 1px solid #334155; color: #f8fafc; border-radius: 8px; padding: 11px 40px 11px 38px; font-size: 13.5px; outline: none; transition: border-color 0.2s, box-shadow 0.2s;"
            />
            <button
              type="button"
              id="toggle-pwd-btn"
              @click="showPassword = !showPassword"
              style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; color: #64748b; cursor: pointer; padding: 4px;"
              title="Показать/скрыть токен"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </button>
          </div>
        </div>

        <button
          type="submit"
          :disabled="loading"
          style="width: 100%; background: linear-gradient(135deg, #0284c7 0%, #2563eb 100%); color: #ffffff; border: none; padding: 11px 16px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 18px; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35); transition: all 0.2s;"
        >
          <span>{{ loading ? 'Авторизация...' : 'Войти в систему' }}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </button>
      </form>

      <div style="margin-top: 20px; text-align: center; border-top: 1px solid #1e293b; padding-top: 14px;">
        <p style="font-size: 11px; color: #64748b; margin: 0;">
          Защищено сквозным шифрованием и политикой Zero-Trust • <strong>SGC-NOVUS</strong>
        </p>
      </div>
    </div>
  </div>
</template>

