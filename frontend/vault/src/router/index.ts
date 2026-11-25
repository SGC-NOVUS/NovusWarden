// NovusWarden Vault Vue 3 Router
import { createRouter, createWebHashHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth.ts';

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      redirect: () => {
        const auth = useAuthStore();
        return auth.isAuthenticated ? '/vault' : '/login';
      },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
    },
    {
      path: '/signup',
      name: 'signup',
      component: () => import('../views/RegisterView.vue'),
    },
    {
      path: '/finish-signup',
      name: 'finish-signup',
      component: () => import('../views/RegisterView.vue'),
    },
    {
      path: '/vault',
      name: 'vault',
      component: () => import('../views/VaultView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/generator',
      name: 'generator',
      component: () => import('../views/GeneratorView.vue'),
    },
    {
      path: '/sentinel',
      name: 'sentinel',
      component: () => import('../views/SentinelView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/send',
      name: 'send',
      component: () => import('../views/SendView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/send/:sendId/:key?',
      name: 'send-access',
      component: () => import('../views/SendAccessView.vue'),
    },
    {
      path: '/organizations',
      name: 'organizations',
      component: () => import('../views/OrganizationsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../views/SettingsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/docs',
      name: 'docs',
      component: () => import('../views/DocsView.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/login',
    },
  ],
});

router.beforeEach((to, from, next) => {
  const auth = useAuthStore();
  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    next({ name: 'login', query: { redirect: to.fullPath } });
  } else if ((to.name === 'login' || to.name === 'signup') && auth.isAuthenticated) {
    next({ name: 'vault' });
  } else {
    next();
  }
});

export default router;

