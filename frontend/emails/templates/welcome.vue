<script setup>
import {
  EHtml,
  EHead,
  EBody,
  EContainer,
  ESection,
  EImg,
  EText,
  EHr,
  EHeading,
  EButton,
} from 'vue-email';

defineProps({
  url: {
    type: String,
    default: '{{url}}',
  },
});
</script>

<template>
  <EHtml lang="en">
    <EHead />
    <EBody style="background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 24px 0;">
      <EContainer style="max-width: 580px; margin: 0 auto; background-color: #1e293b; border-radius: 12px; border: 1px solid #334155; overflow: hidden; padding: 32px 28px;">
        <ESection style="text-align: center; margin-bottom: 28px;">
          <EImg
            src="https://raw.githubusercontent.com/SGC-NOVUS/novuswarden/main/resources/vaultwarden-logo-white.svg"
            width="180"
            alt="NovusWarden"
            style="margin: 0 auto; display: block;"
          />
        </ESection>

        <EHeading as="h1" style="font-size: 22px; font-weight: 700; color: #f8fafc; text-align: center; margin: 0 0 16px 0;">
          Welcome to NovusWarden
        </EHeading>
        <EText style="font-size: 15px; color: #cbd5e1; line-height: 24px; margin-bottom: 24px; text-align: center;">
          Your self-hosted, enterprise-secured vault has been provisioned. Access your credentials, secure notes, and shared organization collections from any official Bitwarden client.
        </EText>
        <ESection style="text-align: center; margin: 32px 0;">
          <EButton
            :href="url"
            style="background-color: #3b82f6; color: #ffffff; font-weight: 600; font-size: 15px; text-decoration: none; padding: 12px 28px; border-radius: 8px; display: inline-block;"
          >
            Open Your Vault
          </EButton>
        </ESection>
        <EText style="font-size: 13px; color: #94a3b8; line-height: 20px; text-align: center;">
          If the button above does not work, copy and paste this URL into your browser:<br />
          <span style="color: #60a5fa; word-break: break-all;">{{ url }}</span>
        </EText>

        <EHr style="border-color: #334155; margin: 32px 0 20px 0;" />

        <ESection style="text-align: center;">
          <EText style="font-size: 12px; color: #94a3b8; line-height: 18px; margin: 0;">
            NovusWarden Control Plane • Enterprise Security by <strong>SGC-NOVUS</strong>
          </EText>
          <EText style="font-size: 11px; color: #64748b; line-height: 16px; margin: 8px 0 0 0;">
            This is an automated security transmission. If you did not request this action, please review your account settings immediately.
          </EText>
        </ESection>
      </EContainer>
    </EBody>
  </EHtml>
</template>
