/**
 * NovusWarden vue-email pre-compiler
 *
 * Compiles responsive Vue 3 Email components into production-ready,
 * inlined HTML Handlebars templates (*.html.hbs) for native Rust rendering.
 */

import { config } from '@vue-email/compiler';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMPLATES_SRC = path.resolve(__dirname, 'templates');
const OUTPUT_DIR = path.resolve(__dirname, '../../src/static/templates/email');

const emailCompiler = config(TEMPLATES_SRC, {
  verbose: false,
  options: {
    baseUrl: 'https://vault.novuswarden.internal',
  },
});

const SUBJECT_HEADERS = {
  welcome: '{{t "tpl.email.welcome.subject" locale=lang}}',
  welcome_must_verify: '{{t "tpl.email.welcome_must_verify.subject" locale=lang}}',
  register_verify_email: '{{t "tpl.email.register_verify.subject" locale=lang}}',
  verify_email: '{{t "tpl.email.verify_email.subject" locale=lang}}',
  twofactor_email: '{{t "tpl.email.twofactor.subject" locale=lang}}',
  new_device_logged_in: '{{t "tpl.email.new_device.subject_prefix" locale=lang}} {{{device_name}}}',
  incomplete_2fa_login: '{{t "tpl.email.incomplete_2fa.subject_prefix" locale=lang}} {{{device_name}}}',
  recover_twofactor: '{{t "tpl.email.recover_twofactor.subject_prefix" locale=lang}} {{ip}}',
  delete_account: '{{t "tpl.email.delete_account.subject" locale=lang}}',
  protected_action: '{{t "tpl.email.protected_action.subject" locale=lang}}',
  smtp_test: '{{t "tpl.email.smtp_test.subject" locale=lang}}',
  change_email: '{{t "tpl.email.change_email.subject" locale=lang}}',
  change_email_existing: '{{t "tpl.email.change_email_existing.subject" locale=lang}}',
  change_email_invited: '{{t "tpl.email.change_email_invited.subject" locale=lang}}',
  sso_change_email: '{{t "tpl.email.sso_change_email.subject" locale=lang}}',
  pw_hint_none: '{{t "tpl.email.pw_hint_none.subject_html" locale=lang}}',
  pw_hint_some: '{{t "tpl.email.pw_hint_some.subject" locale=lang}}',
  admin_account_recovery: '{{t "tpl.email.admin_account_recovery.subject_prefix" locale=lang}} {{org_name}} {{t "tpl.email.admin_account_recovery.subject_suffix" locale=lang}}',
  admin_login_alert: '{{t "tpl.email.admin_login_alert.subject" locale=lang}}',
  admin_lockout_alert: '{{t "tpl.email.admin_lockout_alert.subject" locale=lang}}',
  send_org_invite: '{{t "tpl.email.send_org_invite.subject_prefix" locale=lang}} {{{org_name}}}',
  invite_accepted: '{{t "tpl.email.invite_accepted.subject_prefix" locale=lang}} {{{org_name}}} {{t "tpl.email.invite_accepted.subject_suffix" locale=lang}}',
  invite_confirmed: '{{t "tpl.email.invite_confirmed.subject_prefix" locale=lang}} {{{org_name}}} {{t "tpl.email.invite_confirmed.subject_suffix" locale=lang}}',
  send_2fa_removed_from_org: '{{t "tpl.email.send_2fa_removed.subject_prefix" locale=lang}} {{{org_name}}} {{t "tpl.email.send_2fa_removed.subject_suffix" locale=lang}}',
  send_single_org_removed_from_org: '{{t "tpl.email.send_single_org_removed.subject_prefix" locale=lang}} {{{org_name}}} {{t "tpl.email.send_single_org_removed.subject_suffix" locale=lang}}',
  send_emergency_access_invite: '{{t "tpl.email.ea_invite.subject_prefix" locale=lang}} {{{grantor_name}}}',
  emergency_access_invite_accepted: '{{t "tpl.email.ea_invite_accepted.subject_prefix" locale=lang}} {{{grantee_email}}} {{t "tpl.email.ea_invite_accepted.subject_suffix" locale=lang}}',
  emergency_access_invite_confirmed: '{{t "tpl.email.ea_invite_confirmed.subject_prefix" locale=lang}} {{{grantor_name}}} {{t "tpl.email.ea_invite_confirmed.subject_suffix" locale=lang}}',
  emergency_access_recovery_approved: '{{t "tpl.email.ea_recovery_approved.subject_prefix" locale=lang}} {{{grantor_name}}} {{t "tpl.email.ea_recovery_approved.subject_suffix" locale=lang}}',
  emergency_access_recovery_initiated: '{{t "tpl.email.ea_recovery_initiated.subject_prefix" locale=lang}} {{{grantee_name}}} {{t "tpl.email.ea_recovery_initiated.subject_suffix" locale=lang}}',
  emergency_access_recovery_rejected: '{{t "tpl.email.ea_recovery_rejected.subject_prefix" locale=lang}} {{{grantor_name}}} {{t "tpl.email.ea_recovery_rejected.subject_suffix" locale=lang}}',
  emergency_access_recovery_reminder: '{{t "tpl.email.ea_recovery_reminder.subject_prefix" locale=lang}} {{{grantee_name}}} {{t "tpl.email.ea_recovery_reminder.subject_suffix" locale=lang}}',
  emergency_access_recovery_timed_out: '{{t "tpl.email.ea_recovery_timed_out.subject_prefix" locale=lang}} {{{grantee_name}}} {{t "tpl.email.ea_recovery_timed_out.subject_suffix" locale=lang}}',
};

const HANDLEBARS_MOCK_PROPS = {
  url: '{{url}}',
  img_src: '{{img_src}}',
  token: '{{token}}',
  user_id: '{{user_id}}',
  email: '{{email}}',
  org_name: '{{org_name}}',
  device_type: '{{device_type}}',
  device_name: '{{device_name}}',
  ip: '{{ip}}',
  ip_address: '{{ip_address}}',
  location: '{{location}}',
  user_agent: '{{user_agent}}',
  unlock_url: '{{unlock_url}}',
  datetime: '{{datetime}}',
  hint: '{{hint}}',
  user_name: '{{user_name}}',
  acting_address: '{{acting_address}}',
  existing_address: '{{existing_address}}',
  grantor_name: '{{grantor_name}}',
  grantee_name: '{{grantee_name}}',
  grantee_email: '{{grantee_email}}',
  atype: '{{atype}}',
  wait_time_days: '{{wait_time_days}}',
  days_left: '{{days_left}}',
  time_limit: '{{time_limit}}',
};

async function compileAllEmails() {
  console.log('Starting NovusWarden Vue-Email compilation...');
  try {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    const files = await fs.readdir(TEMPLATES_SRC);
    const vueTemplates = files.filter((f) => f.endsWith('.vue') && f !== 'EmailLayout.vue');

    console.log(`Found ${vueTemplates.length} Vue email templates to compile.`);

    for (const template of vueTemplates) {
      const baseName = template.replace('.vue', '');
      const targetPath = path.join(OUTPUT_DIR, `${baseName}.html.hbs`);

      try {
        const { html } = await emailCompiler.render(template, { props: HANDLEBARS_MOCK_PROPS });

        // Restore any escaped Handlebars tags and quotes inside {{ ... }}
        const processedHtml = html
          .replace(/%7B%7B/g, '{{')
          .replace(/%7D%7D/g, '}}')
          .replace(/&#x7B;&#x7B;/g, '{{')
          .replace(/&#x7D;&#x7D;/g, '}}')
          .replace(/\{\{([^}]+)\}\}/g, (_, expr) =>
            `{{${expr
              .replace(/&quot;|&#34;|&#x22;/g, '"')
              .replace(/&#39;|&#x27;/g, "'")}}}`
          );

        const subject = SUBJECT_HEADERS[baseName] || `{{t "tpl.email.${baseName}.subject" locale=lang}}`;
        const finalOutput = `${subject}\n<!---------------->\n${processedHtml}\n`;

        await fs.writeFile(targetPath, finalOutput, 'utf-8');
        console.log(`  Compiled: ${template} -> ${path.basename(targetPath)}`);
      } catch (err) {
        console.error(`  Error compiling ${template}:`, err);
        throw err;
      }
    }

    console.log('Vue-Email compilation completed.');
  } catch (err) {
    console.error('Failed to compile email templates:', err);
    process.exit(1);
  }
}

compileAllEmails();
