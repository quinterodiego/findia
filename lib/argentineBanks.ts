// Lista completa de bancos de Argentina
export const argentineBanks = [
  // Bancos Nacionales
  { name: 'Banco de la Nación Argentina', code: 'BNA' },
  { name: 'Banco Central de la República Argentina', code: 'BCRA' },
  
  // Bancos Privados Grandes
  { name: 'Banco Santander Argentina', code: 'SAN' },
  { name: 'Banco Galicia', code: 'GAL' },
  { name: 'Banco BBVA Argentina', code: 'BBVA' },
  { name: 'Banco Macro', code: 'MACRO' },
  { name: 'Banco Itaú Argentina', code: 'ITAU' },
  { name: 'Banco HSBC Argentina', code: 'HSBC' },
  { name: 'Banco ICBC Argentina', code: 'ICBC' },
  { name: 'Banco Patagonia', code: 'PATAGONIA' },
  { name: 'Banco Supervielle', code: 'SUPERVIELLE' },
  { name: 'Banco Comafi', code: 'COMAFI' },
  { name: 'Banco Credicoop', code: 'CREDICOOP' },
  { name: 'Banco de la Ciudad de Buenos Aires', code: 'CABA' },
  
  // Bancos Regionales
  { name: 'Banco de Córdoba', code: 'CORDOBA' },
  { name: 'Banco de Santa Fe', code: 'SANTAFE' },
  { name: 'Banco de Entre Ríos', code: 'ENTRERIOS' },
  { name: 'Banco de La Pampa', code: 'LAPAMPA' },
  { name: 'Banco de San Juan', code: 'SANJUAN' },
  { name: 'Banco de San Luis', code: 'SANLUIS' },
  { name: 'Banco de Mendoza', code: 'MENDOZA' },
  { name: 'Banco de Tucumán', code: 'TUCUMAN' },
  { name: 'Banco de Salta', code: 'SALTA' },
  { name: 'Banco de Jujuy', code: 'JUJUY' },
  { name: 'Banco de Catamarca', code: 'CATAMARCA' },
  { name: 'Banco de La Rioja', code: 'LARIOJA' },
  { name: 'Banco de Santiago del Estero', code: 'SANTIAGO' },
  { name: 'Banco de Formosa', code: 'FORMOSA' },
  { name: 'Banco de Chaco', code: 'CHACO' },
  { name: 'Banco de Corrientes', code: 'CORRIENTES' },
  { name: 'Banco de Misiones', code: 'MISIONES' },
  { name: 'Banco de Neuquén', code: 'NEUQUEN' },
  { name: 'Banco de Río Negro', code: 'RIONEGRO' },
  { name: 'Banco de Chubut', code: 'CHUBUT' },
  { name: 'Banco de Santa Cruz', code: 'SANTACRUZ' },
  { name: 'Banco de Tierra del Fuego', code: 'TIERRADELFUEGO' },
  
  // Bancos Internacionales
  { name: 'Citibank Argentina', code: 'CITI' },
  { name: 'Deutsche Bank Argentina', code: 'DEUTSCHE' },
  { name: 'Standard Bank Argentina', code: 'STANDARD' },
  { name: 'Banco do Brasil Argentina', code: 'BRASIL' },
  
  // Fintech y Bancos Digitales
  { name: 'Ualá', code: 'UALA' },
  { name: 'MODO', code: 'MODO' },
  { name: 'Brubank', code: 'BRUBANK' },
  { name: 'Rebanking', code: 'REBANKING' },
  { name: 'Wilobank', code: 'WILOBANK' },
  { name: 'Openbank Argentina', code: 'OPENBANK' },
  
  // Cooperativas de Crédito
  { name: 'Banco Credicoop Cooperativo', code: 'CREDICOOP_COOP' },
  { name: 'Banco de la Provincia de Buenos Aires', code: 'PROVINCIA' },
  
  // Otros Bancos
  { name: 'Banco Hipotecario', code: 'HIPOTECARIO' },
  { name: 'Banco de Inversión y Comercio Exterior', code: 'BICE' },
  { name: 'Banco de Valores', code: 'VALORES' },
  { name: 'Banco de Servicios Financieros', code: 'BSF' },
  { name: 'Banco de la República Oriental del Uruguay', code: 'BROU' },
  
  // Tarjetas de Crédito y Financieras
  { name: 'Visa Argentina', code: 'VISA' },
  { name: 'Mastercard Argentina', code: 'MASTERCARD' },
  { name: 'American Express Argentina', code: 'AMEX' },
  { name: 'Tarjeta Naranja', code: 'NARANJA' },
  { name: 'Cencosud', code: 'CENCOSUD' },
  { name: 'Carrefour', code: 'CARREFOUR' },
  { name: 'Falabella', code: 'FALABELLA' },
  { name: 'Coto', code: 'COTO' },
  { name: 'Jumbo', code: 'JUMBO' },
  { name: 'Disco', code: 'DISCO' },
  { name: 'Vea', code: 'VEA' },
  { name: 'La Anónima', code: 'ANONIMA' },
  
  // Otros
  { name: 'Otro', code: 'OTHER' }
]

// Función para buscar bancos por nombre
export const searchBanks = (query: string) => {
  if (!query) return argentineBanks
  
  return argentineBanks.filter(bank => 
    bank.name.toLowerCase().includes(query.toLowerCase()) ||
    bank.code.toLowerCase().includes(query.toLowerCase())
  )
}

// Función para obtener banco por código
export const getBankByCode = (code: string) => {
  return argentineBanks.find(bank => bank.code === code)
}

// Función para obtener banco por nombre
export const getBankByName = (name: string) => {
  return argentineBanks.find(bank => bank.name === name)
}
