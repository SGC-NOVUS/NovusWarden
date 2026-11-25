<script setup>
import { EText, ESection, EButton } from 'vue-email';

defineProps({
  img_src: { type: String, default: '{{img_src}}' },
  url: { type: String, default: '{{url}}' },
  org_name: { type: String, default: '{{org_name}}' },
  tSubjPre: { type: String, default: '{{t "tpl.email.invite_confirmed.subject_prefix" locale=lang}}' },
  tSubjSuf: { type: String, default: '{{t "tpl.email.invite_confirmed.subject_suffix" locale=lang}}' },
  tIntroPre: { type: String, default: '{{t "tpl.email.invite_confirmed.body_intro_prefix" locale=lang}}' },
  tColHtml: { type: String, default: '{{t "tpl.email.invite_confirmed.body_collections_html" locale=lang}}' },
  tLoginLink: { type: String, default: '{{t "tpl.email.invite_confirmed.body_login_link" locale=lang}}' },
});
</script>

<template>
  <EmailLayout :img-src="img_src" :heading="`${tSubjPre} ${org_name} ${tSubjSuf}`">
    <EText class="nw-text" style="font-size: 15px; color: #334155; text-align: center;">{{ tIntroPre }} <strong style="color: #0f172a;">{{ org_name }}</strong>.</EText>
    <EText class="nw-text" style="font-size: 15px; color: #334155; text-align: center;">{{ tColHtml }}</EText>
    <ESection style="text-align: center; margin: 28px 0;"><EButton :href="`${url}/`" style="background-color: #3b82f6; color: #ffffff; font-weight: 600; padding: 12px 28px; border-radius: 8px;">{{ tLoginLink }}</EButton></ESection>
  </EmailLayout>
</template>
