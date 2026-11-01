<script setup>
import { Section, Text, Heading, Button } from '@vue-email/components';
import EmailLayout from './EmailLayout.vue';

defineProps({
  url: {
    type: String,
    default: '{{url}}',
  },
});
</script>

<template>
  <EmailLayout preview-text="Welcome to NovusWarden">
    <Heading as="h1" style="font-size: 22px; font-weight: 700; color: #f8fafc; text-align: center; margin: 0 0 16px 0;">
      Welcome to NovusWarden
    </Heading>
    <Text style="font-size: 15px; color: #cbd5e1; line-height: 24px; margin-bottom: 24px; text-align: center;">
      Your self-hosted, enterprise-secured vault has been provisioned. Access your credentials, secure notes, and shared organization collections from any official Bitwarden client.
    </Text>
    <Section style="text-align: center; margin: 32px 0;">
      <Button
        :href="url"
        style="background-color: #3b82f6; color: #ffffff; font-weight: 600; font-size: 15px; text-decoration: none; padding: 12px 28px; border-radius: 8px; display: inline-block;"
      >
        Open Your Vault
      </Button>
    </Section>
    <Text style="font-size: 13px; color: #94a3b8; line-height: 20px; text-align: center;">
      If the button above does not work, copy and paste this URL into your browser:<br />
      <span style="color: #60a5fa; word-break: break-all;">{{ url }}</span>
    </Text>
  </EmailLayout>
</template>

