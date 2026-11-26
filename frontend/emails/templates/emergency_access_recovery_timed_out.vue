<script setup>
import { EText } from 'vue-email';

defineProps({
  img_src: { type: String, default: '{{img_src}}' },
  url: { type: String, default: '{{url}}' },
  grantee_name: { type: String, default: '{{grantee_name}}' },
  atype: { type: String, default: '{{atype}}' },
  tSubjPre: { type: String, default: '{{t "tpl.email.ea_recovery_timed_out.subject_prefix" locale=lang}}' },
  tSubjSuf: { type: String, default: '{{t "tpl.email.ea_recovery_timed_out.subject_suffix" locale=lang}}' },
  tMid: { type: String, default: '{{t "tpl.email.ea_recovery_timed_out.body_intro_mid" locale=lang}}' },
  tSufPre: { type: String, default: '{{t "tpl.email.ea_recovery_timed_out.body_intro_suffix_prefix" locale=lang}}' },
  tLink: { type: String, default: '{{t "tpl.email.ea_recovery_timed_out.body_intro_link" locale=lang}}' },
  tSuf: { type: String, default: '{{t "tpl.email.ea_recovery_timed_out.body_intro_suffix" locale=lang}}' },
});
</script>

<template>
  <EmailLayout variant="danger" :img-src="img_src" :heading="`${tSubjPre} ${grantee_name} ${tSubjSuf}`">
    <EText class="nw-text" style="font-size: 15px; color: #334155; text-align: center"><strong class="nw-strong" style="color: #0f172a">{{ grantee_name }}</strong> {{ tMid }} <strong class="nw-strong" style="color: #0f172a">{{ atype }}</strong> {{ tSufPre }} <a class="nw-link" :href="`${url}/`" style="color: #0284c7">{{ tLink }}</a> {{ tSuf }}</EText>
  </EmailLayout>
</template>
