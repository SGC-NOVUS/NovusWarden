import { createApp } from 'vue';
import { createPinia } from 'pinia';
import WebAuthnMobileApp from './WebAuthnMobileApp.vue';
import '../style.css';

const app = createApp(WebAuthnMobileApp);
app.use(createPinia());
app.mount('#app');
