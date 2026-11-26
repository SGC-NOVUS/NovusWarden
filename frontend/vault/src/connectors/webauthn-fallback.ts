import { createApp } from 'vue';
import { createPinia } from 'pinia';
import WebAuthnFallbackApp from './WebAuthnFallbackApp.vue';
import '../style.css';

const app = createApp(WebAuthnFallbackApp);
app.use(createPinia());
app.mount('#app');
