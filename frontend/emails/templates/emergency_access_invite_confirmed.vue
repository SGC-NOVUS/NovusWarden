<script setup>
import { EText } from 'vue-email';
import EmailLayout from './EmailLayout.vue';

defineProps({
  img_src: { type: String, default: '{{img_src}}' },
  url: { type: String, default: '{{url}}' },
  grantor_name: { type: String, default: '{{grantor_name}}' },
  tSubjPre: { type: String, default: '{{t "tpl.email.ea_invite_confirmed.subject_prefix" locale=lang}}' },
  tSubjSuf: { type: String, default: '{{t "tpl.email.ea_invite_confirmed.subject_suffix" locale=lang}}' },
  tIntroPre: { type: String, default: '{{t "tpl.email.ea_invite_confirmed.body_intro_prefix" locale=lang}}' },
  tAccPre: { type: String, default: '{{t "tpl.email.ea_invite_confirmed.body_access_html_prefix" locale=lang}}' },
  tAccLink: { type: String, default: '{{t "tpl.email.ea_invite_confirmed.body_access_html_link" locale=lang}}' },
});
</script>

<template>
  <EmailLayout :img-src="img_src" :heading="`${tSubjPre} ${grantor_name} ${tSubjSuf}`">
    <EText class="nw-text" style="font-size: 15px; color: #334155; text-align: center;">{{ tIntroPre }} <strong style="color: #0f172a;">{{ grantor_name }}</strong>.</EText>
    <EText class="nw-text" style="font-size: 15px; color: #334155; text-align: center;">{{ tAccPre }} <a :href="`${url}/`" style="color: #0284c7;">{{ tAccLink }}</a>.</EText>
  </EmailLayout>
</template>
