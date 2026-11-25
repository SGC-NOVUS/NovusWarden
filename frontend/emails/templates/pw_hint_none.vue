<script setup>
import { EText } from 'vue-email';

defineProps({
  img_src: { type: String, default: '{{img_src}}' },
  url: { type: String, default: '{{url}}' },
  tSubject: { type: String, default: '{{t "tpl.email.pw_hint_none.subject_html" locale=lang}}' },
  tIntro: { type: String, default: '{{t "tpl.email.pw_hint_none.body_intro" locale=lang}}' },
  tRecPre: { type: String, default: '{{t "tpl.email.pw_hint_none.body_recovery_html_prefix" locale=lang}}' },
  tRecLink: { type: String, default: '{{t "tpl.email.pw_hint_none.body_recovery_html_link" locale=lang}}' },
  tRecSuf: { type: String, default: '{{t "tpl.email.pw_hint_none.body_recovery_suffix" locale=lang}}' },
  tIgnore: { type: String, default: '{{t "tpl.email.pw_hint_none.body_ignore" locale=lang}}' },
});
</script>

<template>
  <EmailLayout :img-src="img_src" :heading="tSubject">
    <EText class="nw-text" style="font-size: 15px; color: #334155; text-align: center">{{ tIntro }}</EText>
    <EText class="nw-text" style="font-size: 14px; color: #334155; text-align: center">{{ tRecPre }} <a :href="`${url}/#/recover-delete`" style="color: #0284c7">{{ tRecLink }}</a> {{ tRecSuf }}</EText>
    <EText class="nw-muted" style="font-size: 13px; color: #64748b; text-align: center">{{ tIgnore }}</EText>
  </EmailLayout>
</template>
