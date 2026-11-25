<script setup>
import { EText, ESection } from 'vue-email';
import EmailLayout from './EmailLayout.vue';

defineProps({
  token: { type: String, default: '{{token}}' },
  img_src: { type: String, default: '{{img_src}}' },
  tSubject: { type: String, default: '{{t "tpl.email.twofactor.subject" locale=lang}}' },
  tBodyCode: { type: String, default: '{{t "tpl.email.twofactor.body_code" locale=lang}}' },
  tBodyUseCode: { type: String, default: '{{t "tpl.email.twofactor.body_use_code" locale=lang}}' },
});
</script>

<template>
  <EmailLayout :img-src="img_src" :heading="tSubject">
    <EText class="nw-text" style="font-size: 15px; color: #334155; line-height: 24px; text-align: center; margin-bottom: 20px;">
      {{ tBodyCode }}
    </EText>
    <ESection class="nw-box" style="text-align: center; margin: 24px 0; background-color: #f8fafc; padding: 18px 24px; border-radius: 8px; border: 1px dashed #2563eb;">
      <EText class="nw-link" style="font-family: monospace; font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #0284c7; margin: 0;">
        {{ token }}
      </EText>
    </ESection>
    <EText class="nw-muted" style="font-size: 13px; color: #64748b; line-height: 20px; text-align: center;">
      {{ tBodyUseCode }}
    </EText>
  </EmailLayout>
</template>
