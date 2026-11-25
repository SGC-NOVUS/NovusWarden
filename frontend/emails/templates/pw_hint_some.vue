<script setup>
import { EText, ESection } from 'vue-email';
import EmailLayout from './EmailLayout.vue';

defineProps({
  img_src: { type: String, default: '{{img_src}}' },
  url: { type: String, default: '{{url}}' },
  hint: { type: String, default: '{{hint}}' },
  tSubject: { type: String, default: '{{t "tpl.email.pw_hint_some.subject" locale=lang}}' },
  tIntro: { type: String, default: '{{t "tpl.email.pw_hint_some.body_intro" locale=lang}}' },
  tHint: { type: String, default: '{{t "tpl.email.pw_hint_some.body_hint" locale=lang}}' },
  tLoginHtml: { type: String, default: '{{t "tpl.email.pw_hint_some.body_login_html" locale=lang}}' },
  tLoginLink: { type: String, default: '{{t "tpl.email.pw_hint_some.body_login_link" locale=lang}}' },
  tRecPre: { type: String, default: '{{t "tpl.email.pw_hint_none.body_recovery_html_prefix" locale=lang}}' },
  tRecLink: { type: String, default: '{{t "tpl.email.pw_hint_none.body_recovery_html_link" locale=lang}}' },
  tRecSuf: { type: String, default: '{{t "tpl.email.pw_hint_none.body_recovery_suffix" locale=lang}}' },
  tIgnore: { type: String, default: '{{t "tpl.email.pw_hint_some.body_ignore" locale=lang}}' },
});
</script>

<template>
  <EmailLayout :img-src="img_src" :heading="tSubject">
    <EText class="nw-text" style="font-size: 15px; color: #334155; text-align: center;">{{ tIntro }}</EText>
    <ESection class="nw-box" style="background-color: #f8fafc; padding: 18px 20px; border-radius: 8px; border: 1px solid #cbd5e1;">
      <EText style="font-size: 15px; color: #0284c7; text-align: center;">{{ tHint }}: <strong>"{{ hint }}"</strong></EText>
      <EText class="nw-text" style="font-size: 14px; color: #334155; text-align: center;">{{ tLoginHtml }}: <a :href="`${url}/`" style="color: #0284c7;">{{ tLoginLink }}</a></EText>
    </ESection>
    <EText class="nw-text" style="font-size: 14px; color: #334155; text-align: center;">{{ tRecPre }} <a :href="`${url}/#/recover-delete`" style="color: #0284c7;">{{ tRecLink }}</a> {{ tRecSuf }}</EText>
    <EText class="nw-muted" style="font-size: 13px; color: #64748b; text-align: center;">{{ tIgnore }}</EText>
  </EmailLayout>
</template>
