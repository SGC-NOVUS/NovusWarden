import { createRouter, createWebHashHistory } from 'vue-router';
import DashboardView from '../views/DashboardView.vue';
import UsersView from '../views/UsersView.vue';
import OrganizationsView from '../views/OrganizationsView.vue';
import SettingsView from '../views/SettingsView.vue';
import DiagnosticsView from '../views/DiagnosticsView.vue';
import SubscriptionsView from '../views/SubscriptionsView.vue';
import DocsView from '../views/DocsView.vue';
import LoginView from '../views/LoginView.vue';
import { api, authState } from '../api/client.ts';

const routes = [
  { path: '/', name: 'dashboard', component: DashboardView },
  { path: '/login', name: 'login', component: LoginView },
  { path: '/users', name: 'users', component: UsersView },
  { path: '/organizations', name: 'organizations', component: OrganizationsView },
  { path: '/subscriptions', name: 'subscriptions', component: SubscriptionsView },
  { path: '/settings', name: 'settings', component: SettingsView },
  { path: '/diagnostics', name: 'diagnostics', component: DiagnosticsView },
  { path: '/docs', name: 'docs', component: DocsView },
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

router.beforeEach(async (to, _from, next) => {
  if (!authState.value.checked) {
    await api.checkSession();
  }
  if (to.path === '/docs') {
    return next();
  }
  if (to.path === '/login') {
    if (!authState.value.needsAuth && authState.value.isAuthenticated) {
      return next('/');
    }
    return next();
  }
  if (authState.value.needsAuth) {
    return next({ path: '/login', query: { redirect: to.fullPath } });
  }
  next();
});


