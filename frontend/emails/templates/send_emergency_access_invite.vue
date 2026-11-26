<script setup>
import { EText, ESection, EButton } from 'vue-email';

defineProps({
  img_src: { type: String, default: '{{img_src}}' },
  url: { type: String, default: '{{{url}}}' },
  grantor_name: { type: String, default: '{{grantor_name}}' },
  tSubjPre: { type: String, default: '{{t "tpl.email.ea_invite.subject_prefix" locale=lang}}' },
  tIntroPre: { type: String, default: '{{t "tpl.email.ea_invite.body_intro_prefix" locale=lang}}' },
  tIntroSuf: { type: String, default: '{{t "tpl.email.ea_invite.body_intro_suffix" locale=lang}}' },
  tCta: { type: String, default: '{{t "tpl.email.ea_invite.body_cta_html" locale=lang}}' },
  tIgnorePre: { type: String, default: '{{t "tpl.email.ea_invite.body_ignore_prefix" locale=lang}}' },
  tIgnoreSuf: { type: String, default: '{{t "tpl.email.ea_invite.body_ignore_suffix" locale=lang}}' },
});
</script>

<template>
  <EmailLayout :img-src="img_src" :heading="`${tSubjPre} ${grantor_name}`">
    <EText class="nw-text" style="font-size: 15px; color: #334155; text-align: center">{{ tIntroPre }} <strong class="nw-strong" style="color: #0f172a">{{ grantor_name }}</strong>. {{ tIntroSuf }}</EText>
    <ESection style="text-align: center; margin: 28px 0"><EButton data-testid="emergency" :href="url" style="background-color: #3b82f6; color: #ffffff; font-weight: 600; padding: 12px 28px; border-radius: 8px">{{ tCta }}</EButton></ESection>
    <EText class="nw-muted" style="font-size: 13px; color: #64748b; text-align: center">{{ tIgnorePre }} {{ grantor_name }}, {{ tIgnoreSuf }}</EText>
  </EmailLayout>
</template>
