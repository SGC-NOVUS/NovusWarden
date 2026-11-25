<script setup>
import { EText, ESection, EButton } from 'vue-email';
import EmailLayout from './EmailLayout.vue';

defineProps({
  img_src: { type: String, default: '{{img_src}}' },
  url: { type: String, default: '{{{url}}}' },
  org_name: { type: String, default: '{{org_name}}' },
  tSubjPre: { type: String, default: '{{t "tpl.email.send_org_invite.subject_prefix" locale=lang}}' },
  tIntroPre: { type: String, default: '{{t "tpl.email.send_org_invite.body_intro_prefix" locale=lang}}' },
  tIntroSuf: { type: String, default: '{{t "tpl.email.send_org_invite.body_intro_suffix" locale=lang}}' },
  tCta: { type: String, default: '{{t "tpl.email.send_org_invite.body_cta_html" locale=lang}}' },
  tIgnore: { type: String, default: '{{t "tpl.email.send_org_invite.body_ignore" locale=lang}}' },
});
</script>

<template>
  <EmailLayout :img-src="img_src" :heading="`${tSubjPre} ${org_name}`">
    <EText class="nw-text" style="font-size: 15px; color: #334155; text-align: center;">{{ tIntroPre }} <strong style="color: #0f172a;">{{ org_name }}</strong> {{ tIntroSuf }}</EText>
    <ESection style="text-align: center; margin: 28px 0;"><EButton data-testid="invite" :href="url" style="background-color: #3b82f6; color: #ffffff; font-weight: 600; padding: 12px 28px; border-radius: 8px;">{{ tCta }}</EButton></ESection>
    <EText class="nw-muted" style="font-size: 13px; color: #64748b; text-align: center;">{{ tIgnore }}</EText>
  </EmailLayout>
</template>
