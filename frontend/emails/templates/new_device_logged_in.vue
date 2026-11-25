<script setup>
import { EText, ESection } from 'vue-email';

defineProps({
  url: { type: String, default: '{{url}}' },
  img_src: { type: String, default: '{{img_src}}' },
  device_name: { type: String, default: '{{device_name}}' },
  device_type: { type: String, default: '{{device_type}}' },
  ip: { type: String, default: '{{ip}}' },
  datetime: { type: String, default: '{{datetime}}' },
  tSubjectPrefix: { type: String, default: '{{t "tpl.email.new_device.subject_prefix" locale=lang}}' },
  tBodyIntro: { type: String, default: '{{t "tpl.email.new_device.body_intro" locale=lang}}' },
  tLabelDate: { type: String, default: '{{t "tpl.email.new_device.label_date" locale=lang}}' },
  tLabelIp: { type: String, default: '{{t "tpl.email.new_device.label_ip" locale=lang}}' },
  tLabelDeviceName: { type: String, default: '{{t "tpl.email.new_device.label_device_name" locale=lang}}' },
  tLabelDeviceType: { type: String, default: '{{t "tpl.email.new_device.label_device_type" locale=lang}}' },
  tDeauthPrefix: { type: String, default: '{{t "tpl.email.new_device.body_deauth_html_prefix" locale=lang}}' },
  tDeauthLink: { type: String, default: '{{t "tpl.email.new_device.body_deauth_html_link" locale=lang}}' },
  tDeauthSuffix: { type: String, default: '{{t "tpl.email.new_device.body_deauth_suffix" locale=lang}}' },
});
</script>

<template>
  <EmailLayout :img-src="img_src" :heading="`${tSubjectPrefix} ${device_name}`">
    <EText class="nw-text" style="font-size: 15px; color: #334155; line-height: 24px; text-align: center; margin-bottom: 20px;">
      {{ tBodyIntro }}
    </EText>
    <ESection class="nw-box" style="background-color: #f8fafc; padding: 18px 20px; border-radius: 8px; border: 1px solid #cbd5e1; margin-bottom: 20px;">
      <EText class="nw-text" style="font-size: 14px; color: #334155; margin: 4px 0;"><strong class="nw-strong" style="color: #0f172a;">{{ tLabelDeviceName }}:</strong> {{ device_name }}</EText>
      <EText class="nw-text" style="font-size: 14px; color: #334155; margin: 4px 0;"><strong class="nw-strong" style="color: #0f172a;">{{ tLabelDeviceType }}:</strong> {{ device_type }}</EText>
      <EText class="nw-text" style="font-size: 14px; color: #334155; margin: 4px 0;"><strong class="nw-strong" style="color: #0f172a;">{{ tLabelIp }}:</strong> {{ ip }}</EText>
      <EText class="nw-text" style="font-size: 14px; color: #334155; margin: 4px 0;"><strong class="nw-strong" style="color: #0f172a;">{{ tLabelDate }}:</strong> {{ datetime }}</EText>
    </ESection>
    <EText class="nw-muted" style="font-size: 13px; color: #64748b; line-height: 20px; text-align: center;">
      {{ tDeauthPrefix }} <a class="nw-link" :href="url" style="color: #0284c7;">{{ tDeauthLink }}</a> {{ tDeauthSuffix }}
    </EText>
  </EmailLayout>
</template>
