<script setup>
import { EText } from 'vue-email';

defineProps({
  img_src: { type: String, default: '{{img_src}}' },
  url: { type: String, default: '{{url}}' },
  email: { type: String, default: '{{email}}' },
  org_name: { type: String, default: '{{org_name}}' },
  tSubjPre: { type: String, default: '{{t "tpl.email.invite_accepted.subject_prefix" locale=lang}}' },
  tSubjSuf: { type: String, default: '{{t "tpl.email.invite_accepted.subject_suffix" locale=lang}}' },
  tIntroPre: { type: String, default: '{{t "tpl.email.invite_accepted.body_intro_prefix" locale=lang}}' },
  tIntroMid: { type: String, default: '{{t "tpl.email.invite_accepted.body_intro_mid" locale=lang}}' },
  tLoginPre: { type: String, default: '{{t "tpl.email.invite_accepted.body_login_html_prefix" locale=lang}}' },
  tLoginLink: { type: String, default: '{{t "tpl.email.invite_accepted.body_login_html_link" locale=lang}}' },
  tLoginSuf: { type: String, default: '{{t "tpl.email.invite_accepted.body_login_suffix" locale=lang}}' },
  tIgnore: { type: String, default: '{{t "tpl.email.invite_accepted.body_ignore" locale=lang}}' },
});
</script>

<template>
  <EmailLayout :img-src="img_src" :heading="`${tSubjPre} ${org_name} ${tSubjSuf}`">
    <EText class="nw-text" style="font-size: 15px; color: #334155; text-align: center;">{{ tIntroPre }} {{ email }} {{ tIntroMid }} <strong style="color: #0f172a;">{{ org_name }}</strong>.</EText>
    <EText class="nw-text" style="font-size: 15px; color: #334155; text-align: center;">{{ tLoginPre }} <a :href="`${url}/`" style="color: #0284c7;">{{ tLoginLink }}</a> {{ tLoginSuf }}</EText>
    <EText class="nw-muted" style="font-size: 13px; color: #64748b; text-align: center;">{{ tIgnore }}</EText>
  </EmailLayout>
</template>
