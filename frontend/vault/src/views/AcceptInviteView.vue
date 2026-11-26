<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.ts';
import { useThemeStore } from '../stores/theme.ts';
import { api } from '../api/client.ts';
import { Building2, ShieldAlert, CheckCircle2, AlertCircle, LogIn, UserPlus } from 'lucide-vue-next';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const themeStore = useThemeStore();

const isEmergency = computed(() => route.name === 'accept-emergency');
const organizationId = computed(() => String(route.query.organizationId || ''));
const organizationUserId = computed(() => String(route.query.organizationUserId || ''));
const organizationName = computed(() => String(route.query.organizationName || 'Организация NovusWarden'));
const emergencyId = computed(() => String(route.query.id || ''));
const grantorName = computed(() => String(route.query.name || 'Владелец хранилища'));
const invitedEmail = computed(() => String(route.query.email || ''));
const token = computed(() => String(route.query.token || ''));

const loading = ref(false);
const accepted = ref(false);
const errorMessage = ref('');

const brandBannerSrc = computed(() =>
  themeStore.isDark
    ? '/vw_static/novuswarden_banner_black_trans.webp'
    : '/vw_static/novuswarden_banner_white_trans.webp'
);

async function handleAccept() {
  if (!authStore.token) {
    router.push({ name: 'login', query: { redirect: route.fullPath } });
    return;
  }
  if (!token.value) {
    errorMessage.value = 'Отсутствует криптографический токен приглашения в ссылке.';
    return;
  }

  loading.value = true;
  errorMessage.value = '';
  try {
    if (isEmergency.value) {
      if (!emergencyId.value) throw new Error('Не указан идентификатор экстренного доступа.');
      await api.acceptEmergencyInvite(authStore.token, emergencyId.value, token.value);
    } else {
      if (!organizationId.value || !organizationUserId.value) {
        throw new Error('Неполная ссылка приглашения в организацию.');
      }
      await api.acceptOrganizationInvite(
        authStore.token,
        organizationId.value,
        organizationUserId.value,
        token.value
      );
    }
    accepted.value = true;
  } catch (err: any) {
    errorMessage.value = err?.message || 'Не удалось принять приглашение';
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  if (!token.value) {
    errorMessage.value = 'Ссылка приглашения повреждена или устарела (отсутствует token).';
  }
});
</script>

<template>
  <div class="min-h-screen flex flex-col justify-between p-5 box-border">
    <header class="max-w-5xl w-full mx-auto flex justify-between items-center">
      <router-link to="/"><img :src="brandBannerSrc" alt="NovusWarden" class="h-9 object-contain" /></router-link>
    </header>

    <main class="flex-1 flex items-center justify-center py-8">
      <div class="invite-card">
        <div class="emblem">
          <CheckCircle2 v-if="accepted" class="w-8 h-8 text-emerald-400" />
          <ShieldAlert v-else-if="isEmergency" class="w-8 h-8 text-amber-400" />
          <Building2 v-else class="w-8 h-8 text-sky-400" />
        </div>

        <h1 class="text-xl font-bold m-0 mb-2">
          {{
            accepted
              ? 'Приглашение принято!'
              : isEmergency
              ? 'Приглашение на экстренный доступ'
              : 'Приглашение в организацию'
          }}
        </h1>

        <p class="text-xs text-slate-400 leading-relaxed m-0 mb-5">
          <template v-if="accepted">
            Доступ успешно подтверждён. После подтверждения администратором или владельцем вы сможете работать с общими данными.
          </template>
          <template v-else-if="isEmergency">
            Пользователь <strong class="text-slate-200">{{ grantorName }}</strong> пригласил вас стать доверенным контактом экстренного доступа
            <span v-if="invitedEmail"> для <strong class="text-sky-400">{{ invitedEmail }}</strong></span>.
          </template>
          <template v-else>
            Вас пригласили присоединиться к корпоративному пространству <strong class="text-slate-200">{{ organizationName }}</strong>
            <span v-if="invitedEmail"> (<span class="text-sky-400">{{ invitedEmail }}</span>)</span>.
          </template>
        </p>

        <div v-if="errorMessage" class="err-box" role="alert">
          <AlertCircle class="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
          <span class="text-left">{{ errorMessage }}</span>
        </div>

        <div v-if="accepted" class="w-full">
          <router-link to="/vault" class="cyber-btn-primary w-full no-underline">
            Перейти в хранилище
          </router-link>
        </div>

        <div v-else-if="authStore.isAuthenticated" class="w-full space-y-2.5">
          <button
            type="button"
            class="cyber-btn-primary w-full !h-10"
            :disabled="loading || !token"
            @click="handleAccept"
          >
            {{ loading ? 'Подтверждение...' : 'Принять приглашение' }}
          </button>
          <router-link to="/vault" class="cyber-btn-secondary w-full no-underline">
            Отмена
          </router-link>
        </div>

        <div v-else class="w-full space-y-2.5">
          <p class="text-[11.5px] text-slate-400 m-0 mb-2">
            Войдите в свой аккаунт NovusWarden (или зарегистрируйтесь с указанным email), чтобы завершить принятие приглашения:
          </p>
          <router-link
            :to="{ name: 'login', query: { redirect: route.fullPath } }"
            class="cyber-btn-primary w-full !h-10 no-underline"
          >
            <LogIn class="w-4 h-4" />
            <span>Войти и принять</span>
          </router-link>
          <router-link
            :to="{ name: 'signup', query: invitedEmail ? { email: invitedEmail } : undefined }"
            class="cyber-btn-secondary w-full !h-10 no-underline"
          >
            <UserPlus class="w-4 h-4" />
            <span>Создать аккаунт</span>
          </router-link>
        </div>
      </div>
    </main>

    <footer class="text-center text-[11px] text-slate-500">
      NovusWarden • System Generations Core Novus
    </footer>
  </div>
</template>

<style scoped>
.invite-card {
  width: 100%;
  max-width: 440px;
  padding: 28px;
  border-radius: 18px;
  background: var(--card-bg);
  border: 1px solid var(--card-border-strong);
  box-shadow: var(--card-shadow);
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.emblem {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: var(--input-bg);
  border: 1px solid rgba(56, 189, 248, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 14px;
}
.err-box {
  width: 100%;
  display: flex;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(244, 63, 94, 0.12);
  border: 1px solid rgba(244, 63, 94, 0.35);
  color: #fda4af;
  font-size: 12px;
  margin-bottom: 14px;
}
</style>
