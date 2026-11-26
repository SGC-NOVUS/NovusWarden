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
    <ESection class="nw-box-danger" style="background-color: #fef2f2; padding: 18px 20px; border-radius: 8px; border: 1px solid #fca5a5">
      <EText class="nw-text-danger" style="font-size: 13px; color: #991b1b; margin: 4px 0"><strong class="nw-strong" style="color: #0f172a">{{ tDate }}:</strong> {{ datetime }}</EText>
      <EText class="nw-text-danger" style="font-size: 13px; color: #991b1b; margin: 4px 0"><strong class="nw-strong" style="color: #0f172a">{{ tIp }}:</strong> {{ ip }}</EText>
    </ESection>
    <EText class="nw-muted" style="font-size: 13px; color: #64748b; text-align: center">{{ tIgnore }}</EText>
  </EmailLayout>
</template>
