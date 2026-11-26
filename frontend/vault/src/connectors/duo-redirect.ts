import { createApp } from 'vue';
import { createPinia } from 'pinia';
import DuoRedirectApp from './DuoRedirectApp.vue';
import '../style.css';

const app = createApp(DuoRedirectApp);
app.use(createPinia());
app.mount('#app');
