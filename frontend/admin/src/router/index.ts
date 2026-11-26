import { createRouter, createWebHashHistory } from 'vue-router';
import { api, authState } from '../api/client.ts';

const routes = [
  { path: '/', name: 'dashboard', component: () => import('../views/DashboardView.vue') },
  { path: '/login', name: 'login', component: () => import('../views/LoginView.vue') },
  { path: '/users', name: 'users', component: () => import('../views/UsersView.vue') },
  { path: '/organizations', name: 'organizations', component: () => import('../views/OrganizationsView.vue') },
  { path: '/subscriptions', name: 'subscriptions', component: () => import('../views/SubscriptionsView.vue') },
  { path: '/settings', name: 'settings', component: () => import('../views/SettingsView.vue') },
  { path: '/diagnostics', name: 'diagnostics', component: () => import('../views/DiagnosticsView.vue') },
  { path: '/docs', name: 'docs', component: () => import('../views/DocsView.vue') },
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
