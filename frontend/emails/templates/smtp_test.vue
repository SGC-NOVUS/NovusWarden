<script setup>
import { EText } from 'vue-email';

defineProps({
  url: { type: String, default: '{{url}}' },
  img_src: { type: String, default: '{{img_src}}' },
  tSubject: { type: String, default: '{{t "tpl.email.smtp_test.subject" locale=lang}}' },
  tBodyIntro: { type: String, default: '{{t "tpl.email.smtp_test.body_intro_html" locale=lang}}' },
  tBodyOk: { type: String, default: '{{t "tpl.email.smtp_test.body_ok" locale=lang}}' },
});
</script>

<template>
  <EmailLayout :img-src="img_src" :heading="tSubject" variant="success">
    <EText class="nw-text" style="font-size: 15px; color: #334155; line-height: 24px; text-align: center; margin-bottom: 16px;">
      {{ tBodyIntro }} <a :href="url" class="nw-link" style="color: #0284c7;">{{ url }}</a>.
    </EText>
    <EText class="nw-heading-success" style="font-size: 14px; color: #059669; line-height: 22px; text-align: center; font-weight: 600;">
      {{ tBodyOk }}
    </EText>
  </EmailLayout>
</template>
