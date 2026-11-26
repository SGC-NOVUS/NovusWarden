<script setup>
import { EText, ESection, EButton } from 'vue-email';

defineProps({
  img_src: { type: String, default: '{{img_src}}' },
  url: { type: String, default: '{{url}}' },
  ip_address: { type: String, default: '{{ip_address}}' },
  location: { type: String, default: '{{location}}' },
  user_agent: { type: String, default: '{{user_agent}}' },
  datetime: { type: String, default: '{{datetime}}' },
  unlock_url: { type: String, default: '{{unlock_url}}' },
  tHeading: { type: String, default: '{{t "tpl.email.admin_lockout_alert.heading" locale=lang}}' },
  tIntroPre: { type: String, default: '{{t "tpl.email.admin_lockout_alert.body_intro_prefix" locale=lang}}' },
  tIntroStrong: { type: String, default: '{{t "tpl.email.admin_lockout_alert.body_intro_strong" locale=lang}}' },
  tIntroSuf: { type: String, default: '{{t "tpl.email.admin_lockout_alert.body_intro_suffix" locale=lang}}' },
  tLabelIp: { type: String, default: '{{t "tpl.email.admin_lockout_alert.label_ip" locale=lang}}' },
  tLabelLoc: { type: String, default: '{{t "tpl.email.admin_lockout_alert.label_location" locale=lang}}' },
  tLabelUa: { type: String, default: '{{t "tpl.email.admin_lockout_alert.label_ua" locale=lang}}' },
  tLabelDt: { type: String, default: '{{t "tpl.email.admin_lockout_alert.label_datetime" locale=lang}}' },
  tLabelHost: { type: String, default: '{{t "tpl.email.admin_lockout_alert.label_host" locale=lang}}' },
  tCta: { type: String, default: '{{t "tpl.email.admin_lockout_alert.cta" locale=lang}}' },
});
</script>

<template>
  <EmailLayout variant="danger" :img-src="img_src" :heading="tHeading">
    <EText class="nw-text" style="font-size: 14px; color: #334155; line-height: 22px; text-align: center">
      {{ tIntroPre }} <strong class="nw-strong" style="color: #0f172a">{{ tIntroStrong }}</strong>. {{ tIntroSuf }}
    </EText>
    <ESection class="nw-box-danger" style="background-color: #fef2f2; padding: 18px 20px; border-radius: 8px; border: 1px solid #fca5a5">
      <EText class="nw-text-danger" style="font-size: 13px; color: #991b1b; margin: 4px 0"><strong class="nw-strong" style="color: #0f172a">{{ tLabelIp }}:</strong> {{ ip_address }}</EText>
      <EText class="nw-text-danger" style="font-size: 13px; color: #991b1b; margin: 4px 0"><strong class="nw-strong" style="color: #0f172a">{{ tLabelLoc }}:</strong> {{ location }}</EText>
      <EText class="nw-text-danger" style="font-size: 13px; color: #991b1b; margin: 4px 0"><strong class="nw-strong" style="color: #0f172a">{{ tLabelUa }}:</strong> {{ user_agent }}</EText>
      <EText class="nw-text-danger" style="font-size: 13px; color: #991b1b; margin: 4px 0"><strong class="nw-strong" style="color: #0f172a">{{ tLabelDt }}:</strong> {{ datetime }}</EText>
      <EText class="nw-text-danger" style="font-size: 13px; color: #991b1b; margin: 4px 0"><strong class="nw-strong" style="color: #0f172a">{{ tLabelHost }}:</strong> <a class="nw-link" :href="url" style="color: #0284c7">{{ url }}</a></EText>
    </ESection>
    <ESection style="text-align: center; margin: 24px 0">
      <EButton :href="unlock_url" style="background-color: #2563eb; color: #ffffff; font-weight: 700; padding: 12px 28px; border-radius: 8px">{{ tCta }}</EButton>
    </ESection>
    <EText class="nw-muted" style="font-size: 12px; color: #64748b; text-align: center; word-break: break-all">{{ unlock_url }}</EText>
  </EmailLayout>
</template>
