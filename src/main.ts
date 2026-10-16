import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import { configureSession } from './api/client';
import { useAuthStore } from './stores/auth';
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import './style.css';

const app = createApp(App);
app.use(createPinia());

const auth = useAuthStore();
auth.restore();

// Cualquier 401 cierra la sesión; App.vue se encarga de llevar al login.
configureSession({
  getToken: () => auth.token,
  onUnauthorized: () => {
    if (auth.isAuthenticated) auth.logout('expired');
  },
});

app.use(router);
app.mount('#app');
