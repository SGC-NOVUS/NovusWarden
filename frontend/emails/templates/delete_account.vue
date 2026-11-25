<script setup>
import { EText, ESection, EButton } from 'vue-email';

defineProps({
  url: { type: String, default: '{{url}}' },
  img_src: { type: String, default: '{{img_src}}' },
  user_id: { type: String, default: '{{user_id}}' },
  token: { type: String, default: '{{token}}' },
  email: { type: String, default: '{{email}}' },
  tSubject: { type: String, default: '{{t "tpl.email.delete_account.subject" locale=lang}}' },
  tBodyIntro: { type: String, default: '{{t "tpl.email.delete_account.body_intro" locale=lang}}' },
  tCta: { type: String, default: '{{t "tpl.email.delete_account.cta" locale=lang}}' },
  tBodyIgnore: { type: String, default: '{{t "tpl.email.delete_account.body_ignore" locale=lang}}' },
});
</script>

<template>
  <EmailLayout variant="danger" :img-src="img_src" :heading="tSubject">
    <EText class="nw-text" style="font-size: 15px; color: #334155; line-height: 24px; margin-bottom: 24px; text-align: center">
      {{ tBodyIntro }}
    </EText>
    <ESection style="text-align: center; margin: 28px 0">
      <EButton :href="`${url}/#/verify-recover-delete?userId=${user_id}&token=${token}&email=${email}`" style="background-color: #dc2626; color: #ffffff; font-weight: 600; font-size: 15px; text-decoration: none; padding: 12px 28px; border-radius: 8px; display: inline-block">
        {{ tCta }}
      </EButton>
    </ESection>
    <EText class="nw-muted" style="font-size: 13px; color: #64748b; line-height: 20px; text-align: center">
      {{ tBodyIgnore }}
    </EText>
  </EmailLayout>
</template>
