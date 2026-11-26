<script setup>
import { EText } from 'vue-email';

defineProps({
  img_src: { type: String, default: '{{img_src}}' },
  url: { type: String, default: '{{url}}' },
  grantee_email: { type: String, default: '{{grantee_email}}' },
  tSubjPre: { type: String, default: '{{t "tpl.email.ea_invite_accepted.subject_prefix" locale=lang}}' },
  tSubjSuf: { type: String, default: '{{t "tpl.email.ea_invite_accepted.subject_suffix" locale=lang}}' },
  tIntroPre: { type: String, default: '{{t "tpl.email.ea_invite_accepted.body_intro_prefix" locale=lang}}' },
  tIntroSuf: { type: String, default: '{{t "tpl.email.ea_invite_accepted.body_intro_suffix" locale=lang}}' },
  tConfPre: { type: String, default: '{{t "tpl.email.ea_invite_accepted.body_confirm_html_prefix" locale=lang}}' },
  tConfLink: { type: String, default: '{{t "tpl.email.ea_invite_accepted.body_confirm_html_link" locale=lang}}' },
  tConfSuf: { type: String, default: '{{t "tpl.email.ea_invite_accepted.body_confirm_suffix" locale=lang}}' },
  tIgnore: { type: String, default: '{{t "tpl.email.ea_invite_accepted.body_ignore" locale=lang}}' },
});
</script>

<template>
  <EmailLayout :img-src="img_src" :heading="`${tSubjPre} ${grantee_email} ${tSubjSuf}`">
    <EText class="nw-text" style="font-size: 15px; color: #334155; text-align: center">{{ tIntroPre }} {{ grantee_email }} {{ tIntroSuf }}</EText>
    <EText class="nw-text" style="font-size: 15px; color: #334155; text-align: center">{{ tConfPre }} <a class="nw-link" :href="`${url}/`" style="color: #0284c7">{{ tConfLink }}</a>, {{ tConfSuf }}</EText>
    <EText class="nw-muted" style="font-size: 13px; color: #64748b; text-align: center">{{ tIgnore }}</EText>
  </EmailLayout>
</template>
