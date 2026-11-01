<script setup>
import { Section, Text, Heading } from '@vue-email/components';
import EmailLayout from './EmailLayout.vue';

defineProps({
  token: {
    type: String,
    default: '{{token}}',
  },
});
</script>

<template>
  <EmailLayout preview-text="Your NovusWarden Two-Factor Security Code">
    <Heading as="h1" style="font-size: 22px; font-weight: 700; color: #f8fafc; text-align: center; margin: 0 0 16px 0;">
      Two-Factor Authentication Code
    </Heading>
    <Text style="font-size: 15px; color: #cbd5e1; line-height: 24px; text-align: center; margin-bottom: 24px;">
      Use the one-time security code below to complete your login to NovusWarden.
    </Text>
    <Section style="text-align: center; margin: 28px 0; background-color: #0f172a; padding: 18px 24px; border-radius: 8px; border: 1px dashed #3b82f6;">
      <Text style="font-family: monospace; font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #60a5fa; margin: 0;">
        {{ token }}
      </Text>
    </Section>
    <Text style="font-size: 13px; color: #94a3b8; line-height: 20px; text-align: center;">
      This verification code is time-sensitive and will expire in a few minutes. Never share this code with anyone.
    </Text>
  </EmailLayout>
</template>

