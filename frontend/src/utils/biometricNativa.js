// Biometría NATIVA para la app instalada (Capacitor + Android BiometricPrompt /
// Face ID). WebAuthn no funciona dentro del WebView, así que aquí usamos el
// plugin nativo: la huella/rostro se valida en el dispositivo y libera un token
// guardado en el Keystore, que se canjea contra el backend por un JWT.
import { Capacitor } from '@capacitor/core';
import { NativeBiometric } from '@capgo/capacitor-native-biometric';
import apiClient from '../api';
import { setBiometricUser, clearBiometricUser } from './quickAccess';

// "server" es la llave bajo la que el plugin guarda la credencial en el Keystore.
const SERVER = 'ksmart360.biometric';

/** True solo si estamos en la app nativa y el dispositivo tiene biometría. */
export async function nativoDisponible() {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const r = await NativeBiometric.isAvailable();
    return !!(r && r.isAvailable);
  } catch {
    return false;
  }
}

// Muestra el prompt de huella/rostro. Lanza si el usuario cancela o falla.
async function verificarIdentidad() {
  await NativeBiometric.verifyIdentity({
    reason: 'Confirma tu identidad para continuar',
    title: 'Ksmart360',
    subtitle: 'Acceso con huella o Face ID',
    description: '',
  });
}

/**
 * Activa la biometría en este dispositivo: valida la huella, pide un token al
 * backend y lo guarda en el Keystore protegido por biometría.
 */
export async function registrarNativo(deviceName = null) {
  await verificarIdentidad();
  const { data } = await apiClient.post('/auth/biometric-native/register', {
    device_name: deviceName || 'Este dispositivo',
  });
  await NativeBiometric.setCredentials({
    username: data.username,
    password: data.token,
    server: SERVER,
  });
  localStorage.setItem('biometric_enabled', 'true');
  localStorage.setItem('biometric_native', 'true');
  // El dueño de la credencial lo dicta el backend (evita ligarla a la cuenta
  // equivocada en un dispositivo compartido).
  setBiometricUser(data.username);
  return { success: true, message: '¡Biometría activada en este dispositivo!', device_name: data.device_name };
}

/**
 * Inicia sesión con biometría: valida la huella, recupera el token del Keystore
 * y lo canjea por un JWT. Devuelve { access_token, ... } igual que el login.
 */
export async function loginNativo() {
  await verificarIdentidad();
  const cred = await NativeBiometric.getCredentials({ server: SERVER });
  if (!cred || !cred.password) {
    throw new Error('No hay una credencial biométrica registrada en este dispositivo.');
  }
  const { data } = await apiClient.post('/auth/biometric-native/login', { token: cred.password });
  return data;
}

/** Desactiva la biometría en este dispositivo (backend + Keystore + flag local). */
export async function desactivarNativo() {
  try { await apiClient.delete('/auth/biometric-native'); } catch { /* ignore */ }
  try { await NativeBiometric.deleteCredentials({ server: SERVER }); } catch { /* ignore */ }
  localStorage.removeItem('biometric_enabled');
  localStorage.removeItem('biometric_native');
  clearBiometricUser();
}
