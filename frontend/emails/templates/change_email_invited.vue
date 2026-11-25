<script setup>
import { EText, ESection, EButton } from 'vue-email';
import EmailLayout from './EmailLayout.vue';

defineProps({
  img_src: { type: String, default: '{{img_src}}' },
  url: { type: String, default: '{{url}}' },
  acting_address: { type: String, default: '{{ acting_address }}' },
  existing_address: { type: String, default: '{{ existing_address }}' },
  tSubject: { type: String, default: '{{t "tpl.email.change_email_invited.subject" locale=lang}}' },
  tIntro: { type: String, default: '{{t "tpl.email.change_email_invited.body_intro" locale=lang}}' },
  tMid: { type: String, default: '{{t "tpl.email.change_email_invited.body_intro_mid" locale=lang}}' },
  tSuf: { type: String, default: '{{t "tpl.email.change_email_invited.body_intro_suffix" locale=lang}}' },
  tDelIntro: { type: String, default: '{{t "tpl.email.change_email_invited.body_delete_intro" locale=lang}}' },
  tCta: { type: String, default: '{{t "tpl.email.change_email_invited.cta" locale=lang}}' },
  tAfter: { type: String, default: '{{t "tpl.email.change_email_invited.body_after" locale=lang}}' },
  tIgnore: { type: String, default: '{{t "tpl.email.change_email_invited.body_ignore" locale=lang}}' },
});
</script>

<template>
  <EmailLayout :img-src="img_src" :heading="tSubject">
    <EText class="nw-text" style="font-size: 15px; color: #334155; line-height: 24px; text-align: center;">{{ tIntro }} ({{ acting_address }}) {{ tMid }} ({{ existing_address }}). {{ tSuf }}</EText>
    <EText class="nw-text" style="font-size: 15px; color: #334155; line-height: 24px; text-align: center;">{{ tDelIntro }} ({{ existing_address }}):</EText>
    <ESection style="text-align: center; margin: 24px 0;"><EButton data-testid="recover-delete" :href="`${url}/#/recover-delete`" style="background-color: #dc2626; color: #ffffff; font-weight: 600; padding: 12px 28px; border-radius: 8px;">{{ tCta }}</EButton></ESection>
    <EText class="nw-text" style="font-size: 14px; color: #334155; text-align: center;">{{ tAfter }}</EText>
    <EText class="nw-muted" style="font-size: 13px; color: #64748b; text-align: center;">{{ tIgnore }}</EText>
  </EmailLayout>
</template>
