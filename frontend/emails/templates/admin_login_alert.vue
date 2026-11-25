<script setup>
import { EText, ESection } from 'vue-email';

defineProps({
  img_src: { type: String, default: '{{img_src}}' },
  url: { type: String, default: '{{url}}' },
  ip_address: { type: String, default: '{{ip_address}}' },
  location: { type: String, default: '{{location}}' },
  user_agent: { type: String, default: '{{user_agent}}' },
  datetime: { type: String, default: '{{datetime}}' },
  tHeading: { type: String, default: '{{t "tpl.email.admin_login_alert.heading" locale=lang}}' },
  tIntro: { type: String, default: '{{t "tpl.email.admin_login_alert.body_intro" locale=lang}}' },
  tLabelIp: { type: String, default: '{{t "tpl.email.admin_login_alert.label_ip" locale=lang}}' },
  tLabelLoc: { type: String, default: '{{t "tpl.email.admin_login_alert.label_location" locale=lang}}' },
  tLabelUa: { type: String, default: '{{t "tpl.email.admin_login_alert.label_ua" locale=lang}}' },
  tLabelDt: { type: String, default: '{{t "tpl.email.admin_login_alert.label_datetime" locale=lang}}' },
  tLabelHost: { type: String, default: '{{t "tpl.email.admin_login_alert.label_host" locale=lang}}' },
});
</script>

<template>
  <EmailLayout :img-src="img_src" :heading="tHeading">
    <EText class="nw-text" style="font-size: 14px; color: #334155; line-height: 22px; text-align: center;">{{ tIntro }}</EText>
    <ESection class="nw-box" style="background-color: #f8fafc; padding: 18px 20px; border-radius: 8px; border: 1px solid #cbd5e1;">
      <EText class="nw-text" style="font-size: 13px; color: #334155; margin: 4px 0;"><strong class="nw-strong" style="color: #0f172a;">{{ tLabelIp }}:</strong> {{ ip_address }}</EText>
      <EText class="nw-text" style="font-size: 13px; color: #334155; margin: 4px 0;"><strong class="nw-strong" style="color: #0f172a;">{{ tLabelLoc }}:</strong> {{ location }}</EText>
      <EText class="nw-text" style="font-size: 13px; color: #334155; margin: 4px 0;"><strong class="nw-strong" style="color: #0f172a;">{{ tLabelUa }}:</strong> {{ user_agent }}</EText>
      <EText class="nw-text" style="font-size: 13px; color: #334155; margin: 4px 0;"><strong class="nw-strong" style="color: #0f172a;">{{ tLabelDt }}:</strong> {{ datetime }}</EText>
      <EText class="nw-text" style="font-size: 13px; color: #334155; margin: 4px 0;"><strong class="nw-strong" style="color: #0f172a;">{{ tLabelHost }}:</strong> <a class="nw-link" :href="url" style="color: #0284c7;">{{ url }}</a></EText>
    </ESection>
  </EmailLayout>
</template>
