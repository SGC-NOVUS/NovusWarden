<script setup>
import { EText } from 'vue-email';

defineProps({
  img_src: { type: String, default: '{{img_src}}' },
  org_name: { type: String, default: '{{org_name}}' },
  user_name: { type: String, default: '{{user_name}}' },
  tSubjPre: { type: String, default: '{{t "tpl.email.admin_account_recovery.subject_prefix" locale=lang}}' },
  tSubjSuf: { type: String, default: '{{t "tpl.email.admin_account_recovery.subject_suffix" locale=lang}}' },
  tResetPwPre: { type: String, default: '{{t "tpl.email.admin_account_recovery.body_reset_password_prefix" locale=lang}}' },
  tResetPwSuf: { type: String, default: '{{t "tpl.email.admin_account_recovery.body_reset_password_suffix" locale=lang}}' },
  tReset2fa: { type: String, default: '{{t "tpl.email.admin_account_recovery.body_reset_2fa" locale=lang}}' },
  tFallback2fa: { type: String, default: '{{t "tpl.email.admin_account_recovery.body_fallback_2fa" locale=lang}}' },
  tIgnore: { type: String, default: '{{t "tpl.email.admin_account_recovery.body_ignore" locale=lang}}' },
  ifResetPw: { type: String, default: '{{#if reset_password}}' },
  ifReset2fa: { type: String, default: '{{#if reset_2fa}}' },
  ifFallback: { type: String, default: '{{#if fallback_2fa_email}}' },
  endIf: { type: String, default: '{{/if}}' },
});
</script>

<template>
  <EmailLayout :img-src="img_src" :heading="`${tSubjPre} ${org_name} ${tSubjSuf}`">
    <EText class="nw-text" style="font-size: 15px; color: #334155; line-height: 24px; text-align: center">
      {{ ifResetPw }}{{ tResetPwPre }} <strong class="nw-strong" style="color: #0f172a">{{ user_name }}</strong> {{ tResetPwSuf }}{{ endIf }}
      {{ ifReset2fa }} {{ tReset2fa }}{{ ifFallback }} {{ tFallback2fa }}{{ endIf }}{{ endIf }}
    </EText>
    <EText class="nw-muted" style="font-size: 13px; color: #64748b; line-height: 20px; text-align: center">{{ tIgnore }}</EText>
  </EmailLayout>
</template>
