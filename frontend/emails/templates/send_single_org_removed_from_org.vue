<script setup>
import { EText } from 'vue-email';

defineProps({
  img_src: { type: String, default: '{{img_src}}' },
  org_name: { type: String, default: '{{org_name}}' },
  tSubjPre: { type: String, default: '{{t "tpl.email.send_single_org_removed.subject_prefix" locale=lang}}' },
  tSubjSuf: { type: String, default: '{{t "tpl.email.send_single_org_removed.subject_suffix" locale=lang}}' },
  tIntroPre: { type: String, default: '{{t "tpl.email.send_single_org_removed.body_intro_prefix" locale=lang}}' },
  tIntroMid: { type: String, default: '{{t "tpl.email.send_single_org_removed.body_intro_mid" locale=lang}}' },
  tIntroSuf: { type: String, default: '{{t "tpl.email.send_single_org_removed.body_intro_suffix" locale=lang}}' },
});
</script>

<template>
  <EmailLayout variant="danger" :img-src="img_src" :heading="`${tSubjPre} ${org_name} ${tSubjSuf}`">
    <EText class="nw-text" style="font-size: 15px; color: #334155; text-align: center">{{ tIntroPre }} <strong style="color: #0f172a">{{ org_name }}</strong> {{ tIntroMid }} {{ org_name }} {{ tIntroSuf }}</EText>
  </EmailLayout>
</template>
