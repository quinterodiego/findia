// Script de prueba para verificar la creación de deudas
// Ejecutar con: node test-debt-creation.js

const testDebtCreation = async () => {
  try {
    console.log('🧪 Probando creación de deudas...\n');

    // 1. Verificar variables de entorno
    console.log('1️⃣ Verificando variables de entorno...');
    const envResponse = await fetch('http://localhost:3000/api/debug/env');
    const envData = await envResponse.json();
    console.log('Variables de entorno:', envData.envStatus);
    
    if (!envData.envStatus.GOOGLE_SHEETS_ID.includes('✅') || 
        !envData.envStatus.GOOGLE_SERVICE_ACCOUNT_EMAIL.includes('✅') || 
        !envData.envStatus.GOOGLE_PRIVATE_KEY.includes('✅')) {
      console.error('❌ Variables de entorno faltantes');
      return;
    }
    console.log('✅ Variables de entorno OK\n');

    // 2. Probar endpoint de test-debt
    console.log('2️⃣ Probando endpoint de test-debt...');
    const testResponse = await fetch('http://localhost:3000/api/debug/test-debt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const testData = await testResponse.json();
    
    if (testResponse.ok) {
      console.log('✅ Test de creación de deuda exitoso');
      console.log('Deuda creada:', testData.testDebt);
      console.log('Total de deudas:', testData.totalDebts);
    } else {
      console.error('❌ Error en test de creación:', testData);
    }

  } catch (error) {
    console.error('❌ Error en el test:', error.message);
  }
};

// Ejecutar solo si se llama directamente
if (typeof window === 'undefined') {
  testDebtCreation();
}

