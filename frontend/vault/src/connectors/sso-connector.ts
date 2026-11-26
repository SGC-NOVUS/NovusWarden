import { createApp } from 'vue';
import { createPinia } from 'pinia';
import SsoConnectorApp from './SsoConnectorApp.vue';
import '../style.css';

const app = createApp(SsoConnectorApp);
app.use(createPinia());
app.mount('#app');
