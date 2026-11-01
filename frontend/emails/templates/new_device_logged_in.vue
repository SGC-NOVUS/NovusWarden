<script setup>
import { Section, Text, Heading } from '@vue-email/components';
import EmailLayout from './EmailLayout.vue';

defineProps({
  device_type: {
    type: String,
    default: '{{device_type}}',
  },
  ip_address: {
    type: String,
    default: '{{ip_address}}',
  },
  datetime: {
    type: String,
    default: '{{datetime}}',
  },
});
</script>

<template>
  <EmailLayout preview-text="Security Alert: New Device Login Detected">
    <Heading as="h1" style="font-size: 22px; font-weight: 700; color: #f8fafc; text-align: center; margin: 0 0 16px 0;">
      New Device Access Detected
    </Heading>
    <Text style="font-size: 15px; color: #cbd5e1; line-height: 24px; text-align: center; margin-bottom: 24px;">
      A new device has signed into your NovusWarden account. Details of the session:
    </Text>
    <Section style="background-color: #0f172a; padding: 20px; border-radius: 8px; border: 1px solid #334155; margin-bottom: 24px;">
      <Text style="font-size: 14px; color: #94a3b8; margin: 4px 0;">
        <strong style="color: #f1f5f9;">Device Type:</strong> {{ device_type }}
      </Text>
      <Text style="font-size: 14px; color: #94a3b8; margin: 4px 0;">
        <strong style="color: #f1f5f9;">IP Address:</strong> {{ ip_address }}
      </Text>
      <Text style="font-size: 14px; color: #94a3b8; margin: 4px 0;">
        <strong style="color: #f1f5f9;">Timestamp:</strong> {{ datetime }}
      </Text>
    </Section>
    <Text style="font-size: 13px; color: #ef4444; line-height: 20px; text-align: center;">
      If you did not initiate this login, change your master password and deauthorize active sessions in your vault immediately.
    </Text>
  </EmailLayout>
</template>

