<script setup>
import { EText, ESection } from 'vue-email';

defineProps({
  img_src: { type: String, default: '{{img_src}}' },
  token: { type: String, default: '{{token}}' },
  tSubject: { type: String, default: '{{t "tpl.email.change_email.subject" locale=lang}}' },
  tIntro: { type: String, default: '{{t "tpl.email.change_email.body_intro" locale=lang}}' },
  tIgnore: { type: String, default: '{{t "tpl.email.change_email.body_ignore" locale=lang}}' },
});
</script>

<template>
  <EmailLayout :img-src="img_src" :heading="tSubject">
    <EText class="nw-text" style="font-size: 15px; color: #334155; text-align: center;">{{ tIntro }}</EText>
    <ESection class="nw-box" style="text-align: center; margin: 24px 0; background-color: #f8fafc; padding: 18px 24px; border-radius: 8px; border: 1px dashed #3b82f6;">
      <EText style="font-family: monospace; font-size: 30px; font-weight: 800; letter-spacing: 6px; color: #0284c7; margin: 0;">{{ token }}</EText>
    </ESection>
    <EText class="nw-muted" style="font-size: 13px; color: #64748b; text-align: center;">{{ tIgnore }}</EText>
  </EmailLayout>
</template>
