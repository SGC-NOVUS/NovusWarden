<script setup>
import { EText } from 'vue-email';

defineProps({
  img_src: { type: String, default: '{{img_src}}' },
  url: { type: String, default: '{{url}}' },
  grantor_name: { type: String, default: '{{grantor_name}}' },
  tSubjPre: { type: String, default: '{{t "tpl.email.ea_recovery_approved.subject_prefix" locale=lang}}' },
  tSubjSuf: { type: String, default: '{{t "tpl.email.ea_recovery_approved.subject_suffix" locale=lang}}' },
  tMid: { type: String, default: '{{t "tpl.email.ea_recovery_approved.body_intro_mid" locale=lang}}' },
  tLink: { type: String, default: '{{t "tpl.email.ea_recovery_approved.body_intro_link" locale=lang}}' },
  tSuf: { type: String, default: '{{t "tpl.email.ea_recovery_approved.body_intro_suffix" locale=lang}}' },
});
</script>

<template>
  <EmailLayout :img-src="img_src" :heading="`${tSubjPre} ${grantor_name} ${tSubjSuf}`">
    <EText class="nw-text" style="font-size: 15px; color: #334155; text-align: center"><strong style="color: #0f172a">{{ grantor_name }}</strong> {{ tMid }} <a :href="`${url}/`" style="color: #0284c7">{{ tLink }}</a> {{ tSuf }}</EText>
  </EmailLayout>
</template>
