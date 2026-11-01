<script setup>
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Img,
  Text,
  Hr,
} from '@vue-email/components';

defineProps({
  previewText: {
    type: String,
    default: 'NovusWarden Security Notification',
  },
});
</script>

<template>
  <Html lang="en">
    <Head />
    <Body style="background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 24px 0;">
      <Container style="max-width: 580px; margin: 0 auto; background-color: #1e293b; border-radius: 12px; border: 1px solid #334155; overflow: hidden; padding: 32px 28px;">
        <!-- Header -->
        <Section style="text-align: center; margin-bottom: 28px;">
          <Img
            src="https://raw.githubusercontent.com/SGC-NOVUS/novuswarden/main/resources/vaultwarden-logo-white.svg"
            width="180"
            alt="NovusWarden"
            style="margin: 0 auto; display: block;"
          />
        </Section>

        <!-- Main Content Slot -->
        <Section>
          <slot />
        </Section>

        <Hr style="border-color: #334155; margin: 32px 0 20px 0;" />

        <!-- Footer -->
        <Section style="text-align: center;">
          <Text style="font-size: 12px; color: #94a3b8; line-height: 18px; margin: 0;">
            NovusWarden Control Plane • Enterprise Security by <strong>SGC-NOVUS</strong>
          </Text>
          <Text style="font-size: 11px; color: #64748b; line-height: 16px; margin: 8px 0 0 0;">
            This is an automated security transmission. If you did not request this action, please review your account settings immediately.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
</template>

