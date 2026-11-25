<script setup>
import { EText } from 'vue-email';

defineProps({
  img_src: { type: String, default: '{{img_src}}' },
  grantor_name: { type: String, default: '{{grantor_name}}' },
  tSubjPre: { type: String, default: '{{t "tpl.email.ea_recovery_rejected.subject_prefix" locale=lang}}' },
  tSubjSuf: { type: String, default: '{{t "tpl.email.ea_recovery_rejected.subject_suffix" locale=lang}}' },
  tIntro: { type: String, default: '{{t "tpl.email.ea_recovery_rejected.body_intro" locale=lang}}' },
});
</script>

<template>
  <EmailLayout :img-src="img_src" :heading="`${tSubjPre} ${grantor_name} ${tSubjSuf}`">
    <EText class="nw-text" style="font-size: 15px; color: #334155; text-align: center"><strong style="color: #0f172a">{{ grantor_name }}</strong> {{ tIntro }}</EText>
  </EmailLayout>
</template>
