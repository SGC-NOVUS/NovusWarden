<script setup>
import { EText } from 'vue-email';

defineProps({
  img_src: { type: String, default: '{{img_src}}' },
  acting_address: { type: String, default: '{{ acting_address }}' },
  existing_address: { type: String, default: '{{ existing_address }}' },
  tSubject: { type: String, default: '{{t "tpl.email.change_email_existing.subject" locale=lang}}' },
  tIntro: { type: String, default: '{{t "tpl.email.change_email_existing.body_intro" locale=lang}}' },
  tMid: { type: String, default: '{{t "tpl.email.change_email_existing.body_intro_mid" locale=lang}}' },
  tSuf: { type: String, default: '{{t "tpl.email.change_email_existing.body_intro_suffix" locale=lang}}' },
  tIgnore: { type: String, default: '{{t "tpl.email.change_email_existing.body_ignore" locale=lang}}' },
});
</script>

<template>
  <EmailLayout :img-src="img_src" :heading="tSubject">
    <EText class="nw-text" style="font-size: 15px; color: #334155; line-height: 24px; text-align: center;">{{ tIntro }} ({{ acting_address }}) {{ tMid }} ({{ existing_address }}). {{ tSuf }} ({{ existing_address }}).</EText>
    <EText class="nw-muted" style="font-size: 13px; color: #64748b; text-align: center;">{{ tIgnore }}</EText>
  </EmailLayout>
</template>
