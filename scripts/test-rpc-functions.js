/**
 * Script de Pruebas para Funciones RPC
 * Ejecutar con: node scripts/test-rpc-functions.js
 * 
 * Requiere: Variables de entorno de Supabase configuradas
 * 
 * NOTA: Este script requiere que las funciones RPC ya estén creadas en Supabase
 * Ejecutar primero: supabase/migrations/20250112000000_create_secure_rpc_functions.sql
 */

// Intentar cargar variables de entorno
let supabaseUrl, supabaseKey;

try {
  // Intentar con dotenv si está disponible
  try {
    require('dotenv').config();
  } catch (e) {
    // dotenv no está instalado, continuar sin él
  }

  supabaseUrl = process.env.PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  supabaseKey = process.env.PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: Variables de entorno de Supabase no configuradas');
    console.error('   Configura PUBLIC_SUPABASE_URL y PUBLIC_SUPABASE_ANON_KEY');
    console.error('   O pásalas como argumentos:');
    console.error('   PUBLIC_SUPABASE_URL=... PUBLIC_SUPABASE_ANON_KEY=... node scripts/test-rpc-functions.js');
    process.exit(1);
  }
} catch (e) {
  console.error('❌ Error cargando configuración:', e.message);
  process.exit(1);
}

// Intentar importar Supabase
let supabase;
try {
  const { createClient } = require('@supabase/supabase-js');
  supabase = createClient(supabaseUrl, supabaseKey);
} catch (e) {
  console.error('❌ Error: @supabase/supabase-js no está instalado');
  console.error('   Ejecuta: npm install @supabase/supabase-js');
  process.exit(1);
}

const tests = {
  // Test 1: Verificar que las funciones existen
  functionsExist: {
    name: 'Verificar existencia de funciones RPC',
    async check() {
      const functions = [
        'create_competitor_pair',
        'increment_kit_sold_quantity',
        'update_competitor_pair_id'
      ];

      const results = [];
      
      for (const funcName of functions) {
        try {
          // Intentar llamar la función con parámetros inválidos para verificar que existe
          // Si la función no existe, dará error de "function does not exist"
          // Si existe, dará error de validación (que es lo que queremos)
          const { error } = await supabase.rpc(funcName, {
            p_event_id: '00000000-0000-0000-0000-000000000000',
            p_competitor_1_id: '00000000-0000-0000-0000-000000000000',
            p_competitor_2_id: '00000000-0000-0000-0000-000000000000'
          });

          if (error && error.message.includes('does not exist')) {
            results.push({
              function: funcName,
              status: 'MISSING',
              error: 'Función no existe'
            });
          } else {
            // Si da otro error, la función existe (solo falló la validación)
            results.push({
              function: funcName,
              status: 'EXISTS',
              error: null
            });
          }
        } catch (e) {
          if (e.message && e.message.includes('does not exist')) {
            results.push({
              function: funcName,
              status: 'MISSING',
              error: 'Función no existe'
            });
          } else {
            results.push({
              function: funcName,
              status: 'EXISTS',
              error: null
            });
          }
        }
      }

      return results;
    }
  },

  // Test 2: Verificar validaciones de create_competitor_pair
  createPairValidations: {
    name: 'Verificar validaciones de create_competitor_pair',
    async check() {
      const invalidTests = [
        {
          name: 'IDs iguales (debe fallar)',
          params: {
            p_event_id: '00000000-0000-0000-0000-000000000000',
            p_competitor_1_id: '11111111-1111-1111-1111-111111111111',
            p_competitor_2_id: '11111111-1111-1111-1111-111111111111' // Mismo ID
          },
          expectedError: 'diferentes'
        },
        {
          name: 'Evento inexistente (debe fallar)',
          params: {
            p_event_id: '00000000-0000-0000-0000-000000000000',
            p_competitor_1_id: '11111111-1111-1111-1111-111111111111',
            p_competitor_2_id: '22222222-2222-2222-2222-222222222222'
          },
          expectedError: 'Evento no encontrado'
        }
      ];

      const results = [];
      
      for (const test of invalidTests) {
        const { error } = await supabase.rpc('create_competitor_pair', test.params);
        
        if (error) {
          const hasExpectedError = error.message.toLowerCase().includes(test.expectedError.toLowerCase());
          results.push({
            test: test.name,
            status: hasExpectedError ? 'PASS' : 'FAIL',
            error: error.message,
            expected: test.expectedError
          });
        } else {
          results.push({
            test: test.name,
            status: 'FAIL',
            error: 'No se generó error cuando debería',
            expected: test.expectedError
          });
        }
      }

      return results;
    }
  },

  // Test 3: Verificar validaciones de increment_kit_sold_quantity
  incrementKitValidations: {
    name: 'Verificar validaciones de increment_kit_sold_quantity',
    async check() {
      const invalidTests = [
        {
          name: 'Kit inexistente (debe fallar)',
          params: {
            p_kit_id: '00000000-0000-0000-0000-000000000000',
            p_event_id: '11111111-1111-1111-1111-111111111111',
            p_quantity: 1
          },
          expectedError: 'Kit no encontrado'
        },
        {
          name: 'Cantidad negativa (debe fallar)',
          params: {
            p_kit_id: '11111111-1111-1111-1111-111111111111',
            p_event_id: '22222222-2222-2222-2222-222222222222',
            p_quantity: -1
          },
          expectedError: 'mayor a 0'
        }
      ];

      const results = [];
      
      for (const test of invalidTests) {
        const { error } = await supabase.rpc('increment_kit_sold_quantity', test.params);
        
        if (error) {
          const hasExpectedError = error.message.toLowerCase().includes(test.expectedError.toLowerCase());
          results.push({
            test: test.name,
            status: hasExpectedError ? 'PASS' : 'FAIL',
            error: error.message,
            expected: test.expectedError
          });
        } else {
          results.push({
            test: test.name,
            status: 'FAIL',
            error: 'No se generó error cuando debería',
            expected: test.expectedError
          });
        }
      }

      return results;
    }
  }
};

async function runTests() {
  console.log('🧪 Iniciando Pruebas de Funciones RPC\n');
  console.log('='.repeat(60));

  const results = {};

  for (const [key, test] of Object.entries(tests)) {
    console.log(`\n📋 ${test.name}...`);
    try {
      const testResults = await test.check();
      results[key] = testResults;

      if (Array.isArray(testResults)) {
        const passed = testResults.filter(r => r.status === 'PASS' || r.status === 'EXISTS').length;
        const failed = testResults.filter(r => r.status === 'FAIL' || r.status === 'MISSING').length;

        if (failed === 0) {
          console.log(`  ✅ Todos los tests pasaron (${passed})`);
        } else {
          console.log(`  ⚠️  ${passed} pasaron, ${failed} fallaron:`);
          testResults.forEach(result => {
            if (result.status === 'FAIL' || result.status === 'MISSING') {
              console.log(`    ❌ ${result.function || result.test}: ${result.error || result.expected}`);
            } else {
              console.log(`    ✅ ${result.function || result.test}`);
            }
          });
        }
      }
    } catch (error) {
      console.error(`  ❌ Error: ${error.message}`);
      results[key] = { error: error.message };
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Resumen:');

  const totalTests = Object.values(results)
    .filter(r => Array.isArray(r))
    .reduce((sum, arr) => sum + arr.length, 0);

  const passed = Object.values(results)
    .filter(r => Array.isArray(r))
    .flat()
    .filter(r => r.status === 'PASS' || r.status === 'EXISTS').length;

  const failed = Object.values(results)
    .filter(r => Array.isArray(r))
    .flat()
    .filter(r => r.status === 'FAIL' || r.status === 'MISSING').length;

  console.log(`  Total de tests: ${totalTests}`);
  console.log(`  ✅ Pasaron: ${passed}`);
  console.log(`  ❌ Fallaron: ${failed}`);

  if (failed > 0) {
    console.log('\n⚠️  Revisa la documentación en RPC_FUNCTIONS_DOCUMENTATION.md');
    process.exit(1);
  } else {
    console.log('\n✅ Todas las funciones RPC están correctamente implementadas');
    process.exit(0);
  }
}

runTests();

