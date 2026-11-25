<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { api } from '../api/client.ts';

const router = useRouter();
const route = useRoute();

const isLight = ref(document.documentElement.classList.contains('light'));
const lockUrl = computed(() => ['/vw_static', isLight.value ? 'novuswarden_storage_lock_white_crisp.webp' : 'novuswarden_storage_lock_black_crisp.webp'].join('/'));

onMounted(() => {
  const obs = new MutationObserver(() => {
    isLight.value = document.documentElement.classList.contains('light');
  });
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
});
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
      :style="{
        width: '100%',
        maxWidth: '430px',
        background: isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(10, 18, 35, 0.88)',
        backdropFilter: 'blur(20px)',
        border: isLight ? '1px solid rgba(2, 132, 199, 0.28)' : '1px solid rgba(56, 189, 248, 0.3)',
        borderRadius: '16px',
        boxShadow: isLight
          ? '0 20px 40px -10px rgba(2, 132, 199, 0.12), 0 0 25px rgba(56, 189, 248, 0.08)'
          : '0 20px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(14, 165, 233, 0.15)',
        padding: '26px 28px',
        color: isLight ? '#0f172a' : '#f8fafc',
        boxSizing: 'border-box',
        transition: 'all 0.2s ease'
      }"
    >
      <!-- Logo & Branding -->
      <div style="text-align: center; margin-bottom: 18px;">
        <div
          :style="{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '78px',
            height: '78px',
            borderRadius: '20px',
            overflow: 'hidden',
            border: isLight ? '1px solid rgba(2, 132, 199, 0.45)' : '1px solid rgba(56, 189, 248, 0.5)',
            boxShadow: isLight ? '0 4px 20px rgba(2, 132, 199, 0.2)' : '0 0 25px rgba(56, 189, 248, 0.35)',
            marginBottom: '12px',
            background: isLight ? '#ffffff' : '#020817'
          }"
        >
          <img :src="lockUrl" alt="NovusWarden Closed Storage" style="width: 92%; height: 92%; object-fit: contain; display: block; image-rendering: -webkit-optimize-contrast;" />
        </div>
        <h1
          :style="{
            fontSize: '20px',
            fontWeight: 700,
            color: isLight ? '#0f172a' : '#f8fafc',
            margin: '0 0 4px 0',
            letterSpacing: '-0.5px'
          }"
        >
          NovusWarden Control Plane
        </h1>
        <p
          :style="{
            fontSize: '13px',
            color: isLight ? '#475569' : '#94a3b8',
            margin: 0
          }"
        >
          Авторизация главного администратора
        </p>
        <div
          :style="{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            marginTop: '8px',
            padding: '3px 10px',
            borderRadius: '999px',
            background: isLight ? 'rgba(2, 132, 199, 0.1)' : 'rgba(14, 165, 233, 0.1)',
            border: isLight ? '1px solid rgba(2, 132, 199, 0.25)' : '1px solid rgba(56, 189, 248, 0.25)',
            fontSize: '11px',
            fontWeight: 600,
            color: isLight ? '#0284c7' : '#38bdf8'
          }"
        >
          <span
            :style="{
              display: 'inline-block',
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: isLight ? '#0284c7' : '#38bdf8',
              boxShadow: isLight ? '0 0 6px #0284c7' : '0 0 8px #38bdf8'
            }"
          ></span>
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
        <div style="margin-bottom: 14px;">
          <label
            for="admin-token"
            :style="{
              display: 'block',
              fontSize: '12px',
              fontWeight: 600,
              color: isLight ? '#334155' : '#cbd5e1',
              marginBottom: '6px'
            }"
          >
            Токен доступа администратора
          </label>
          <div style="position: relative;">
            <div
              :style="{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
                color: isLight ? '#94a3b8' : '#64748b'
              }"
            >
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
              :style="{
                width: '100%',
                boxSizing: 'border-box',
                background: isLight ? '#ffffff' : 'rgba(2, 6, 23, 0.85)',
                border: isLight ? '1px solid #cbd5e1' : '1px solid #334155',
                color: isLight ? '#0f172a' : '#f8fafc',
                borderRadius: '8px',
                padding: '10px 40px 10px 38px',
                fontSize: '13.5px',
                outline: 'none',
                transition: 'border-color 0.2s, box-shadow 0.2s'
              }"
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
                <circle cx="12" cy="3" r="3"></circle>
              </svg>
            </button>
          </div>
        </div>

        <button
          type="submit"
          :disabled="loading"
          style="width: 100%; background: linear-gradient(135deg, #0284c7 0%, #2563eb 100%); color: #ffffff; border: none; padding: 11px 16px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 16px; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35); transition: all 0.2s;"
        >
          <span>{{ loading ? 'Авторизация...' : 'Войти в систему' }}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </button>
      </form>

      <div
        :style="{
          marginTop: '16px',
          textAlign: 'center',
          borderTop: isLight ? '1px solid #e2e8f0' : '1px solid #1e293b',
          paddingTop: '12px'
        }"
      >
        <p
          :style="{
            fontSize: '11px',
            color: isLight ? '#64748b' : '#64748b',
            margin: 0
          }"
        >
          Защищено сквозным шифрованием и политикой Zero-Trust • <strong>SGC-NOVUS</strong>
        </p>
        <router-link
          to="/docs"
          style="display: inline-block; margin-top: 8px; font-size: 11.5px; font-weight: 600; color: #38bdf8; text-decoration: none;"
        >
          Документация, безопасность и прозрачность →
        </router-link>
      </div>
    </div>
  </div>
</template>

