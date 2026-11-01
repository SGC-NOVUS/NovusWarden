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
} from 'vue-email';

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
          New Device Access Detected
        </EHeading>
        <EText style="font-size: 15px; color: #cbd5e1; line-height: 24px; text-align: center; margin-bottom: 24px;">
          A new device has signed into your NovusWarden account. Details of the session:
        </EText>
        <ESection style="background-color: #0f172a; padding: 20px; border-radius: 8px; border: 1px solid #334155; margin-bottom: 24px;">
          <EText style="font-size: 14px; color: #94a3b8; margin: 4px 0;">
            <strong style="color: #f1f5f9;">Device Type:</strong> {{ device_type }}
          </EText>
          <EText style="font-size: 14px; color: #94a3b8; margin: 4px 0;">
            <strong style="color: #f1f5f9;">IP Address:</strong> {{ ip_address }}
          </EText>
          <EText style="font-size: 14px; color: #94a3b8; margin: 4px 0;">
            <strong style="color: #f1f5f9;">Timestamp:</strong> {{ datetime }}
          </EText>
        </ESection>
        <EText style="font-size: 13px; color: #ef4444; line-height: 20px; text-align: center;">
          If you did not initiate this login, change your master password and deauthorize active sessions in your vault immediately.
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
