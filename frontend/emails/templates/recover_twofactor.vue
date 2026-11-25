<script setup>
import { EText, ESection } from 'vue-email';

defineProps({
  img_src: { type: String, default: '{{img_src}}' },
  ip: { type: String, default: '{{ip}}' },
  datetime: { type: String, default: '{{datetime}}' },
  tSubjPre: { type: String, default: '{{t "tpl.email.recover_twofactor.subject_prefix" locale=lang}}' },
  tIntro: { type: String, default: '{{t "tpl.email.recover_twofactor.body_intro" locale=lang}}' },
  tDate: { type: String, default: '{{t "tpl.email.recover_twofactor.label_date" locale=lang}}' },
  tIp: { type: String, default: '{{t "tpl.email.recover_twofactor.label_ip" locale=lang}}' },
  tIgnore: { type: String, default: '{{t "tpl.email.recover_twofactor.body_ignore" locale=lang}}' },
});
</script>

<template>
  <EmailLayout variant="danger" :img-src="img_src" :heading="`${tSubjPre} ${ip}`">
    <EText class="nw-text" style="font-size: 15px; color: #334155; text-align: center">{{ tIntro }}</EText>
    <ESection style="background-color: #1e1b2e; padding: 18px 20px; border-radius: 8px; border: 1px solid #7f1d1d">
      <EText style="font-size: 13px; color: #cbd5e1; margin: 4px 0"><strong style="color: #0f172a">{{ tDate }}:</strong> {{ datetime }}</EText>
      <EText style="font-size: 13px; color: #cbd5e1; margin: 4px 0"><strong style="color: #0f172a">{{ tIp }}:</strong> {{ ip }}</EText>
    </ESection>
    <EText class="nw-muted" style="font-size: 13px; color: #64748b; text-align: center">{{ tIgnore }}</EText>
  </EmailLayout>
</template>
