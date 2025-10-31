/**
 * Formatea un número con formato argentino/español:
 * - Punto (.) para separar miles
 * - Coma (,) para decimales
 * 
 * Ejemplos:
 * - 3500000.59 -> "3.500.000,59"
 * - 1500.5 -> "1.500,50"
 * - 100 -> "100"
 */
export function formatNumber(
  value: number,
  options: {
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    showCurrency?: boolean;
  } = {}
): string {
  const {
    minimumFractionDigits = 0,
    maximumFractionDigits = 2,
    showCurrency = false,
  } = options;

  if (isNaN(value) || value === null || value === undefined) {
    return showCurrency ? '$0' : '0';
  }

  // Formatear el número manualmente para garantizar formato consistente
  const numStr = Math.abs(value).toFixed(maximumFractionDigits);
  const parts = numStr.split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1];

  // Agregar puntos para separar miles (de derecha a izquierda cada 3 dígitos)
  let formattedInteger = '';
  for (let i = integerPart.length - 1; i >= 0; i--) {
    const position = integerPart.length - 1 - i;
    if (position > 0 && position % 3 === 0) {
      formattedInteger = '.' + formattedInteger;
    }
    formattedInteger = integerPart[i] + formattedInteger;
  }

  // Formatear parte decimal con mínimo de dígitos
  let formattedDecimal = '';
  if (maximumFractionDigits > 0) {
    formattedDecimal = decimalPart || '';
    while (formattedDecimal.length < minimumFractionDigits) {
      formattedDecimal += '0';
    }
    formattedDecimal = formattedDecimal.substring(0, maximumFractionDigits);
  }

  // Combinar partes
  let result = formattedInteger;
  if (formattedDecimal && formattedDecimal !== '0'.repeat(formattedDecimal.length)) {
    result += ',' + formattedDecimal;
  } else if (minimumFractionDigits > 0) {
    result += ',' + '0'.repeat(minimumFractionDigits);
  }

  // Agregar signo negativo si es necesario
  if (value < 0) {
    result = '-' + result;
  }

  const currencySymbol = showCurrency ? '$' : '';
  
  return `${currencySymbol}${result}`;
}

/**
 * Formatea un número como moneda (agrega el símbolo $)
 */
export function formatCurrency(
  value: number,
  options: {
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  } = {}
): string {
  return formatNumber(value, { ...options, showCurrency: true });
}

