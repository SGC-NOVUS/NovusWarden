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

defineOptions({ inheritAttrs: false });

defineProps({
  imgSrc: { type: String, default: '{{img_src}}' },
  heading: { type: String, default: '' },
  variant: { type: String, default: 'default' }, // 'default' | 'danger' | 'success'
  tFooterTagline: { type: String, default: '{{t "tpl.email.common.footer_tagline" locale=lang}}' },
  tFooterDisclaimer: { type: String, default: '{{t "tpl.email.common.footer_disclaimer" locale=lang}}' },
});
</script>

<template>
  <EHtml lang="{{lang}}">
    <EHead>
      <meta name="color-scheme" content="light dark" />
      <meta name="supported-color-schemes" content="light dark" />
      <component :is="'style'">
        :root { color-scheme: light dark; supported-color-schemes: light dark; }
        @media (prefers-color-scheme: dark) {
          .nw-body { background-color: #0b1120 !important; }
          .nw-card { background-color: #1e293b !important; border-color: #334155 !important; }
          .nw-card-danger { background-color: #1e293b !important; border-color: #7f1d1d !important; }
          .nw-heading { color: #f8fafc !important; }
          .nw-heading-danger { color: #f87171 !important; }
          .nw-heading-success { color: #34d399 !important; }
          .nw-text { color: #cbd5e1 !important; }
          .nw-text-danger { color: #fecaca !important; }
          .nw-strong { color: #f8fafc !important; }
          .nw-muted { color: #94a3b8 !important; }
          .nw-box { background-color: #0f172a !important; border-color: #334155 !important; }
          .nw-box-danger { background-color: #2a1218 !important; border-color: #991b1b !important; }
          .nw-hr { border-color: #334155 !important; }
          .nw-link, .nw-accent { color: #38bdf8 !important; }
          .nw-logo-frame { background-color: #ffffff !important; border-color: #334155 !important; }
        }
        [data-ogsc] .nw-body, [data-ogsb] .nw-body { background-color: #0b1120 !important; }
        [data-ogsc] .nw-card, [data-ogsb] .nw-card { background-color: #1e293b !important; border-color: #334155 !important; }
        [data-ogsc] .nw-card-danger, [data-ogsb] .nw-card-danger { background-color: #1e293b !important; border-color: #7f1d1d !important; }
        [data-ogsc] .nw-heading { color: #f8fafc !important; }
        [data-ogsc] .nw-heading-danger { color: #f87171 !important; }
        [data-ogsc] .nw-heading-success { color: #34d399 !important; }
        [data-ogsc] .nw-text { color: #cbd5e1 !important; }
        [data-ogsc] .nw-text-danger { color: #fecaca !important; }
        [data-ogsc] .nw-strong { color: #f8fafc !important; }
        [data-ogsc] .nw-muted { color: #94a3b8 !important; }
        [data-ogsc] .nw-box, [data-ogsb] .nw-box { background-color: #0f172a !important; border-color: #334155 !important; }
        [data-ogsc] .nw-box-danger, [data-ogsb] .nw-box-danger { background-color: #2a1218 !important; border-color: #991b1b !important; }
        [data-ogsc] .nw-link, [data-ogsc] .nw-accent { color: #38bdf8 !important; }
        [data-ogsc] .nw-logo-frame, [data-ogsb] .nw-logo-frame { background-color: #ffffff !important; border-color: #334155 !important; }
      </component>
    </EHead>
    <EBody class="nw-body" style="background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 24px 0">
      <EContainer
        :class="variant === 'danger' ? 'nw-card nw-card-danger' : 'nw-card'"
        :style="{
          maxWidth: '580px',
          margin: '0 auto',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: `1px solid ${variant === 'danger' ? '#fca5a5' : '#cbd5e1'}`,
          overflow: 'hidden',
          padding: '32px 28px',
        }"
      >
        <ESection style="text-align: center; margin-bottom: 24px">
          <div class="nw-logo-frame" style="display: inline-block; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 6px 14px">
            <EImg :src="`${imgSrc}logo-gray.png`" width="190" height="47" alt="NovusWarden" style="margin: 0 auto; display: block; border-radius: 6px" />
          </div>
        </ESection>

        <EHeading
          v-if="heading"
          as="h1"
          :class="variant === 'danger' ? 'nw-heading-danger' : variant === 'success' ? 'nw-heading-success' : 'nw-heading'"
          :style="{
            fontSize: '22px',
            fontWeight: 700,
            color: variant === 'danger' ? '#dc2626' : variant === 'success' ? '#059669' : '#0f172a',
            textAlign: 'center',
            margin: '0 0 16px 0',
          }"
        >
          {{ heading }}
        </EHeading>

        <slot />

        <EHr class="nw-hr" style="border-color: #e2e8f0; margin: 32px 0 20px 0" />
        <ESection style="text-align: center">
          <EText class="nw-muted" style="font-size: 12px; color: #475569; line-height: 18px; margin: 0">
            {{ tFooterTagline }}
          </EText>
          <EText class="nw-muted" style="font-size: 11px; color: #64748b; line-height: 16px; margin: 8px 0 0 0">
            {{ tFooterDisclaimer }}
          </EText>
        </ESection>
      </EContainer>
    </EBody>
  </EHtml>
</template>
