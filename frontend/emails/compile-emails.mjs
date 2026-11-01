/**
 * NovusWarden vue-email pre-compiler
 * 
 * Compiles modern, responsive Vue 3 Email components into production-ready,
 * inlined HTML Handlebars templates (*.html.hbs) for native Rust rendering.
 * 
 * Zero Node.js runtime overhead: all compilation happens at build time.
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

async function compileAllEmails() {
  console.log('🚀 Starting NovusWarden Vue-Email compilation...');
  try {
    const files = await fs.readdir(TEMPLATES_SRC);
    const vueTemplates = files.filter(f => f.endsWith('.vue'));

    console.log(`Found ${vueTemplates.length} Vue email templates to compile.`);

    for (const template of vueTemplates) {
      const baseName = template.replace('.vue', '');
      const targetPath = path.join(OUTPUT_DIR, `${baseName}.html.hbs`);

      try {
        const { html } = await emailCompiler.render(template, {
          // Provide mock Handlebars tokens so the compiler retains literal {{token}} tags
          url: '{{url}}',
          token: '{{token}}',
          org_name: '{{org_name}}',
          device_type: '{{device_type}}',
          ip_address: '{{ip_address}}',
          date: '{{datetime}}',
          hint: '{{hint}}',
        });

        // Restore any escaped Handlebars tags
        const processedHtml = html
          .replace(/%7B%7B/g, '{{')
          .replace(/%7D%7D/g, '}}')
          .replace(/&#x7B;&#x7B;/g, '{{')
          .replace(/&#x7D;&#x7D;/g, '}}');

        await fs.writeFile(targetPath, processedHtml, 'utf-8');
        console.log(`  ✓ Compiled: ${template} -> ${path.basename(targetPath)}`);
      } catch (err) {
        console.warn(`  ⚠ Pre-compiling fallback for ${template}:`, err.message);
      }
    }

    console.log('✨ Vue-Email compilation completed successfully!');
  } catch (err) {
    console.error('Failed to compile email templates:', err);
    process.exit(1);
  }
}

compileAllEmails();

