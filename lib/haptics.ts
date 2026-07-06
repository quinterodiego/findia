// Vibración táctil — solo funciona en Android. iOS PWA no soporta navigator.vibrate aún.
// Se usa en acciones que merecen feedback físico (confirmar, eliminar, error).

const vibrate = (pattern: number | number[]) => {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
};

export const haptics = {
  // Tap suave: confirmar una acción
  tap: () => vibrate(10),

  // Doble tap: éxito / guardado
  success: () => vibrate([10, 50, 10]),

  // Advertencia: antes de eliminar
  warning: () => vibrate([30, 40, 30]),

  // Error: operación fallida
  error: () => vibrate([50, 30, 50, 30, 50]),

  // Celebración: meta cumplida / deuda saldada
  celebrate: () => vibrate([10, 30, 10, 30, 10, 60, 20]),
};
