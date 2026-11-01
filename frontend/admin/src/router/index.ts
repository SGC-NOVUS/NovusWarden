import { createRouter, createWebHashHistory } from 'vue-router';
import DashboardView from '../views/DashboardView.vue';
import UsersView from '../views/UsersView.vue';
import OrganizationsView from '../views/OrganizationsView.vue';
import SettingsView from '../views/SettingsView.vue';
import DiagnosticsView from '../views/DiagnosticsView.vue';
import SubscriptionsView from '../views/SubscriptionsView.vue';

const routes = [
  { path: '/', name: 'dashboard', component: DashboardView },
  { path: '/users', name: 'users', component: UsersView },
  { path: '/organizations', name: 'organizations', component: OrganizationsView },
  { path: '/subscriptions', name: 'subscriptions', component: SubscriptionsView },
  { path: '/settings', name: 'settings', component: SettingsView },
  { path: '/diagnostics', name: 'diagnostics', component: DiagnosticsView },
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

