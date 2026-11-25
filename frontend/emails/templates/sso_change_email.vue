<script setup>
import { EText } from 'vue-email';

defineProps({
  img_src: { type: String, default: '{{img_src}}' },
  url: { type: String, default: '{{url}}' },
  tSubject: { type: String, default: '{{t "tpl.email.sso_change_email.subject" locale=lang}}' },
  tIntro: { type: String, default: '{{t "tpl.email.sso_change_email.body_intro" locale=lang}}' },
  tSetPre: { type: String, default: '{{t "tpl.email.sso_change_email.body_settings_prefix" locale=lang}}' },
  tSetLink: { type: String, default: '{{t "tpl.email.sso_change_email.body_settings_link" locale=lang}}' },
});
</script>

<template>
  <EmailLayout :img-src="img_src" :heading="tSubject">
    <EText class="nw-text" style="font-size: 15px; color: #334155; line-height: 24px; text-align: center;">{{ tIntro }} {{ tSetPre }} <a :href="`${url}/`" style="color: #0284c7;">{{ tSetLink }}</a>.</EText>
  </EmailLayout>
</template>
