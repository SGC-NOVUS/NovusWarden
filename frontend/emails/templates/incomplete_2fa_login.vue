<script setup>
import { EText, ESection } from 'vue-email';
import EmailLayout from './EmailLayout.vue';

defineProps({
  img_src: { type: String, default: '{{img_src}}' },
  time_limit: { type: String, default: '{{time_limit}}' },
  datetime: { type: String, default: '{{datetime}}' },
  ip: { type: String, default: '{{ip}}' },
  device_name: { type: String, default: '{{device_name}}' },
  device_type: { type: String, default: '{{device_type}}' },
  tSubjPre: { type: String, default: '{{t "tpl.email.incomplete_2fa.subject_prefix" locale=lang}}' },
  tIntroPre: { type: String, default: '{{t "tpl.email.incomplete_2fa.body_intro_prefix" locale=lang}}' },
  tIntroSuf: { type: String, default: '{{t "tpl.email.incomplete_2fa.body_intro_suffix" locale=lang}}' },
  tDate: { type: String, default: '{{t "tpl.email.incomplete_2fa.label_date" locale=lang}}' },
  tIp: { type: String, default: '{{t "tpl.email.incomplete_2fa.label_ip" locale=lang}}' },
  tDevName: { type: String, default: '{{t "tpl.email.incomplete_2fa.label_device_name" locale=lang}}' },
  tDevType: { type: String, default: '{{t "tpl.email.incomplete_2fa.label_device_type" locale=lang}}' },
  tWarn: { type: String, default: '{{t "tpl.email.incomplete_2fa.body_warning" locale=lang}}' },
});
</script>

<template>
  <EmailLayout variant="danger" :img-src="img_src" :heading="`${tSubjPre} ${device_name}`">
    <EText class="nw-text" style="font-size: 15px; color: #334155; text-align: center;">{{ tIntroPre }} {{ time_limit }} {{ tIntroSuf }}</EText>
    <ESection style="background-color: #1e1b2e; padding: 18px 20px; border-radius: 8px; border: 1px solid #7f1d1d;">
      <EText style="font-size: 13px; color: #cbd5e1; margin: 4px 0;"><strong style="color: #0f172a;">{{ tDate }}:</strong> {{ datetime }}</EText>
      <EText style="font-size: 13px; color: #cbd5e1; margin: 4px 0;"><strong style="color: #0f172a;">{{ tIp }}:</strong> {{ ip }}</EText>
      <EText style="font-size: 13px; color: #cbd5e1; margin: 4px 0;"><strong style="color: #0f172a;">{{ tDevName }}:</strong> {{ device_name }}</EText>
      <EText style="font-size: 13px; color: #cbd5e1; margin: 4px 0;"><strong style="color: #0f172a;">{{ tDevType }}:</strong> {{ device_type }}</EText>
    </ESection>
    <EText class="nw-muted" style="font-size: 13px; color: #64748b; text-align: center;">{{ tWarn }}</EText>
  </EmailLayout>
</template>
