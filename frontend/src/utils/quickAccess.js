// Registro de accesos rápidos (PIN / biometría) POR USUARIO en este dispositivo.
//
// Problema que resuelve: antes las credenciales rápidas se guardaban como flags
// globales (`pin_configured`, `pin_length`, `biometric_enabled`). En un equipo
// compartido —el caso normal en un POS— eso provocaba que:
//   · El teclado de PIN apareciera para un usuario que NO tiene PIN, usando la
//     longitud del PIN de otro, y fallara siempre.
//   · El botón de huella apareciera para cualquier usuario y, al tocarlo,
//     iniciara sesión con la cuenta de OTRA persona (el token biométrico vive
//     en el Keystore del dispositivo, no en la cuenta escrita).
//   · Al eliminar el PIN, quedaran flags huérfanas.
//
// Ahora se guarda un mapa { usuario: { pin: true, pinLength } } y, aparte, el
// único usuario con biometría registrada en este dispositivo (el Keystore solo
// guarda una credencial).

const KEY_MAP  = 'ksmart_quick_access';   // { [username]: { pin: bool, pinLength: number } }
const KEY_BIO  = 'biometric_username';    // usuario dueño de la credencial biométrica

/** Normaliza el usuario igual que el login (trim + minúsculas). */
export function normalizeUser(u) {
  return String(u || '').trim().toLowerCase();
}

function readMap() {
  try {
    const raw = localStorage.getItem(KEY_MAP);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeMap(map) {
  try {
    localStorage.setItem(KEY_MAP, JSON.stringify(map));
  } catch { /* almacenamiento lleno o bloqueado: no es crítico */ }
}

/**
 * Migra las flags globales antiguas al mapa por usuario. Se ejecuta sola la
 * primera vez; sin esto, quien ya tenía un PIN configurado lo perdería de la UI.
 */
function migrarLegacy() {
  const legacyPin = localStorage.getItem('pin_configured') === 'true';
  if (legacyPin) {
    const owner = normalizeUser(localStorage.getItem('pin_username') || localStorage.getItem('last_username'));
    if (owner) {
      const map = readMap();
      if (!map[owner]) {
        map[owner] = { pin: true, pinLength: parseInt(localStorage.getItem('pin_length') || '4', 10) };
        writeMap(map);
      }
    }
    localStorage.removeItem('pin_configured');
    localStorage.removeItem('pin_length');
    localStorage.removeItem('pin_username');
  }
  // Biometría: si había flag global sin dueño, se le asigna el último usuario.
  if (localStorage.getItem('biometric_enabled') === 'true' && !localStorage.getItem(KEY_BIO)) {
    const owner = normalizeUser(localStorage.getItem('last_username'));
    if (owner) localStorage.setItem(KEY_BIO, owner);
  }
}
migrarLegacy();

// ─── PIN ──────────────────────────────────────────────────────────────────────

/** @returns {{configured: boolean, length: number}} para ese usuario. */
export function getPinInfo(username) {
  const u = normalizeUser(username);
  if (!u) return { configured: false, length: 4 };
  const entry = readMap()[u];
  return {
    configured: !!(entry && entry.pin),
    length: (entry && entry.pinLength) || 4,
  };
}

export function setPinForUser(username, length) {
  const u = normalizeUser(username);
  if (!u) return;
  const map = readMap();
  map[u] = { ...(map[u] || {}), pin: true, pinLength: length };
  writeMap(map);
}

export function removePinForUser(username) {
  const u = normalizeUser(username);
  if (!u) return;
  const map = readMap();
  delete map[u];
  writeMap(map);
}

// ─── Biometría (una credencial por dispositivo) ───────────────────────────────

/** Usuario dueño de la huella/Face ID registrada en este dispositivo, o ''. */
export function getBiometricUser() {
  return normalizeUser(localStorage.getItem(KEY_BIO));
}

export function setBiometricUser(username) {
  const u = normalizeUser(username);
  if (u) localStorage.setItem(KEY_BIO, u);
}

export function clearBiometricUser() {
  localStorage.removeItem(KEY_BIO);
}

/**
 * True si la biometría de este dispositivo sirve para el usuario escrito.
 * Si el campo está vacío, se permite (el usuario aún no eligió cuenta y la
 * biometría le dirá con cuál entra).
 */
export function biometricMatchesUser(username) {
  const owner = getBiometricUser();
  if (!owner) return false;
  const u = normalizeUser(username);
  return !u || u === owner;
}
