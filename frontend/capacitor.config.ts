import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tstechstack.ksmart360',
  appName: 'Ksmart360',
  webDir: 'build',
  // La app carga la web en vivo desde el dominio de producción (Vercel), así
  // cualquier cambio que se despliega en la web aparece de inmediato en la app
  // instalada, sin necesidad de reconstruir/reinstalar el APK. Los cambios
  // NATIVOS (cáscara Android, plugins de hardware Sunmi a futuro) sí requieren
  // un APK nuevo — para eso está el chequeo de versión (MobileUpdateChecker).
  server: {
    url: 'https://www.appjeylor.com',
    cleartext: false,
  },
};

export default config;
