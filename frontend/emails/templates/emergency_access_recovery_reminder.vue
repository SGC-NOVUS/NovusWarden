<script setup>
import { EText } from 'vue-email';

defineProps({
  img_src: { type: String, default: '{{img_src}}' },
  url: { type: String, default: '{{url}}' },
  grantee_name: { type: String, default: '{{grantee_name}}' },
  atype: { type: String, default: '{{atype}}' },
  days_left: { type: String, default: '{{days_left}}' },
  tSubjPre: { type: String, default: '{{t "tpl.email.ea_recovery_reminder.subject_prefix" locale=lang}}' },
  tSubjSuf: { type: String, default: '{{t "tpl.email.ea_recovery_reminder.subject_suffix" locale=lang}}' },
  tMid: { type: String, default: '{{t "tpl.email.ea_recovery_reminder.body_intro_mid" locale=lang}}' },
  tSufPre: { type: String, default: '{{t "tpl.email.ea_recovery_reminder.body_intro_suffix_prefix" locale=lang}}' },
  tLink: { type: String, default: '{{t "tpl.email.ea_recovery_reminder.body_intro_link" locale=lang}}' },
  tSuf: { type: String, default: '{{t "tpl.email.ea_recovery_reminder.body_intro_suffix" locale=lang}}' },
  tWaitPre: { type: String, default: '{{t "tpl.email.ea_recovery_reminder.body_wait_prefix" locale=lang}}' },
  tWaitSuf: { type: String, default: '{{t "tpl.email.ea_recovery_reminder.body_wait_suffix" locale=lang}}' },
});
</script>

<template>
  <EmailLayout variant="danger" :img-src="img_src" :heading="`${tSubjPre} ${grantee_name} ${tSubjSuf}`">
    <EText class="nw-text" style="font-size: 15px; color: #334155; text-align: center"><strong style="color: #0f172a">{{ grantee_name }}</strong> {{ tMid }} <strong style="color: #0f172a">{{ atype }}</strong> {{ tSufPre }} <a :href="`${url}/`" style="color: #0284c7">{{ tLink }}</a> {{ tSuf }}</EText>
    <EText style="font-size: 14px; color: #94a3b8; text-align: center">{{ tWaitPre }} <strong style="color: #0f172a">{{ days_left }}</strong> {{ tWaitSuf }}</EText>
  </EmailLayout>
</template>
