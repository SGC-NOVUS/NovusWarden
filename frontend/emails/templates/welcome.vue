<script setup>
import { EText, ESection, EButton } from 'vue-email';

defineProps({
  url: { type: String, default: '{{url}}' },
  img_src: { type: String, default: '{{img_src}}' },
  tSubject: { type: String, default: '{{t "tpl.email.welcome.subject" locale=lang}}' },
  tBodyIntro: { type: String, default: '{{t "tpl.email.welcome.body_intro" locale=lang}}' },
  tBodySuffix: { type: String, default: '{{t "tpl.email.welcome.body_intro_suffix" locale=lang}}' },
  tBodyIgnore: { type: String, default: '{{t "tpl.email.welcome.body_ignore" locale=lang}}' },
});
</script>

<template>
  <EmailLayout :img-src="img_src" :heading="tSubject">
    <EText class="nw-text" style="font-size: 15px; color: #334155; line-height: 24px; margin-bottom: 24px; text-align: center">
      {{ tBodyIntro }} <strong class="nw-strong" style="color: #0f172a">{{ url }}</strong>. {{ tBodySuffix }}
    </EText>
    <ESection style="text-align: center; margin: 28px 0">
      <EButton :href="url" style="background-color: #2563eb; color: #ffffff; font-weight: 600; font-size: 15px; text-decoration: none; padding: 12px 28px; border-radius: 8px; display: inline-block">
        NovusWarden
      </EButton>
    </ESection>
    <EText class="nw-muted" style="font-size: 13px; color: #64748b; line-height: 20px; text-align: center">
      {{ tBodyIgnore }}<br />
      <span class="nw-link" style="color: #0284c7; word-break: break-all">{{ url }}</span>
    </EText>
  </EmailLayout>
</template>
