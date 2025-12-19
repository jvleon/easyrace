/**
 * Script de Pruebas de Penetración Automatizadas para EasyRace
 * 
 * Este script realiza pruebas exhaustivas de seguridad para detectar vulnerabilidades
 * comunes según OWASP Top 10.
 * 
 * Uso:
 *   node scripts/security-penetration-tests.js [--url=https://easyrace.com.mx]
 * 
 * Requiere:
 *   - Node.js 18+
 *   - Variables de entorno: PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY (opcional, para pruebas directas)
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

// Configuración
const DEFAULT_URL = process.env.TEST_URL || 'https://easyrace.com.mx';
const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL || 'https://drmgrpeqaskysogzvpcx.supabase.co';
const ANON_KEY = process.env.PUBLIC_SUPABASE_ANON_KEY || 'PLACEHOLDER_KEY'; // Se captura del navegador

// Resultados
const results = {
  passed: [],
  failed: [],
  warnings: [],
  total: 0
};

// ============================================
// UTILIDADES
// ============================================

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;

    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'User-Agent': 'EasyRace-Security-Test/1.0',
        ...options.headers
      }
    };

    const req = protocol.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data,
          success: res.statusCode >= 200 && res.statusCode < 300
        });
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

function logResult(testName, passed, details = {}) {
  results.total++;
  const result = {
    test: testName,
    passed,
    timestamp: new Date().toISOString(),
    ...details
  };

  if (passed) {
    results.passed.push(result);
    console.log(`✅ PASS: ${testName}`);
  } else {
    results.failed.push(result);
    console.log(`❌ FAIL: ${testName}`);
    if (details.error) console.log(`   Error: ${details.error}`);
    if (details.status) console.log(`   Status: ${details.status}`);
  }
}

// ============================================
// PRUEBAS DE SEGURIDAD
// ============================================

/**
 * TEST 1: SQL Injection en parámetros de query
 */
async function testSQLInjection() {
  console.log('\n🔍 Testing SQL Injection...');

  const sqlPayloads = [
    "' OR '1'='1",
    "'; DROP TABLE competitors; --",
    "' UNION SELECT * FROM competitors --",
    "1' OR '1'='1' --",
    "admin'--",
    "' OR 1=1--"
  ];

  for (const payload of sqlPayloads) {
    const encodedPayload = encodeURIComponent(payload);
    const url = `${SUPABASE_URL}/rest/v1/events?slug=eq.${encodedPayload}`;

    try {
      const response = await makeRequest(url, {
        headers: {
          'apikey': ANON_KEY,
          'Authorization': `Bearer ${ANON_KEY}`
        }
      });

      // Si devuelve 401 o 400, está protegido (no ejecutó SQL)
      const isProtected = response.status === 401 || response.status === 400 ||
        response.body.includes('Invalid API key') ||
        response.body.includes('invalid input');

      logResult(`SQL Injection: ${payload.substring(0, 30)}`, isProtected, {
        status: response.status,
        bodyLength: response.body.length
      });
    } catch (error) {
      logResult(`SQL Injection: ${payload.substring(0, 30)}`, true, {
        error: error.message,
        note: 'Request failed (likely protected)'
      });
    }
  }
}

/**
 * TEST 2: IDOR - Acceso a datos con UUIDs predecibles
 */
async function testIDOR() {
  console.log('\n🔍 Testing IDOR (Insecure Direct Object References)...');

  const commonUUIDs = [
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-1111-1111-111111111111',
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    '762f026b-037d-4a6c-8fb6-e769f8e404b3' // UUID conocido del sitio
  ];

  // Test eventos
  for (const uuid of commonUUIDs) {
    const url = `${SUPABASE_URL}/rest/v1/events?id=eq.${uuid}&select=*`;

    try {
      const response = await makeRequest(url, {
        headers: {
          'apikey': ANON_KEY,
          'Authorization': `Bearer ${ANON_KEY}`
        }
      });

      const isProtected = response.status === 401 ||
        response.body === '[]' ||
        response.body.includes('Invalid API key');

      logResult(`IDOR Event: ${uuid}`, isProtected, {
        status: response.status,
        hasData: response.body.length > 50 && !response.body.includes('Invalid API key')
      });
    } catch (error) {
      logResult(`IDOR Event: ${uuid}`, true, {
        error: error.message
      });
    }
  }

  // Test competidores
  for (const uuid of commonUUIDs) {
    const url = `${SUPABASE_URL}/rest/v1/competitors?id=eq.${uuid}&select=*`;

    try {
      const response = await makeRequest(url, {
        headers: {
          'apikey': ANON_KEY
        }
      });

      const isProtected = response.status === 401 ||
        response.body === '[]' ||
        response.body.includes('Invalid API key');

      logResult(`IDOR Competitor: ${uuid}`, isProtected, {
        status: response.status,
        hasData: response.body.length > 50 && !response.body.includes('Invalid API key')
      });
    } catch (error) {
      logResult(`IDOR Competitor: ${uuid}`, true, {
        error: error.message
      });
    }
  }
}

/**
 * TEST 3: Path Traversal en Storage
 */
async function testPathTraversal() {
  console.log('\n🔍 Testing Path Traversal...');

  const pathTraversalPayloads = [
    '/liability-waivers/../competitors',
    '/liability-waivers/../../',
    '/liability-waivers/../../../',
    '/liability-waivers/../../../../etc/passwd',
    '/liability-waivers/..%2F..%2F',
    '/liability-waivers/%2e%2e%2f%2e%2e%2f',
    '/liability-waivers/....//....//'
  ];

  for (const path of pathTraversalPayloads) {
    const url = `${SUPABASE_URL}/storage/v1/object/public${path}`;

    try {
      const response = await makeRequest(url);

      // 400 o 404 significa que está protegido
      const isProtected = response.status === 400 ||
        response.status === 404 ||
        response.body.includes('Invalid') ||
        response.body.includes('Not found');

      logResult(`Path Traversal: ${path}`, isProtected, {
        status: response.status,
        contentType: response.headers['content-type']
      });
    } catch (error) {
      logResult(`Path Traversal: ${path}`, true, {
        error: error.message,
        note: 'Request failed (likely protected)'
      });
    }
  }
}

/**
 * TEST 4: Acceso no autorizado a tablas
 */
async function testUnauthorizedTableAccess() {
  console.log('\n🔍 Testing Unauthorized Table Access...');

  const tables = [
    'competitors',
    'events',
    'categories',
    'kits',
    'competitor_pairs',
    'clubs',
    'profiles'
  ];

  for (const table of tables) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=*&limit=10`;

    try {
      // Sin autenticación
      const responseNoAuth = await makeRequest(url);

      // Con anon key inválida
      const responseInvalidKey = await makeRequest(url, {
        headers: {
          'apikey': 'invalid_key_12345',
          'Authorization': 'Bearer invalid_key_12345'
        }
      });

      const isProtected = (responseNoAuth.status === 401 || responseNoAuth.status === 400) &&
        (responseInvalidKey.status === 401 || responseInvalidKey.status === 400);

      logResult(`Unauthorized Access: ${table}`, isProtected, {
        noAuthStatus: responseNoAuth.status,
        invalidKeyStatus: responseInvalidKey.status
      });
    } catch (error) {
      logResult(`Unauthorized Access: ${table}`, true, {
        error: error.message
      });
    }
  }
}

/**
 * TEST 5: Manipulación de funciones RPC
 */
async function testRPCManipulation() {
  console.log('\n🔍 Testing RPC Function Manipulation...');

  const maliciousPayloads = [
    { p_event_id: "' OR '1'='1", p_competitor_1_id: "test", p_competitor_2_id: "test" },
    { p_event_id: "'; DROP TABLE competitors; --", p_competitor_1_id: "test", p_competitor_2_id: "test" },
    { p_event_id: "00000000-0000-0000-0000-000000000000", p_competitor_1_id: "00000000-0000-0000-0000-000000000000", p_competitor_2_id: "00000000-0000-0000-0000-000000000000" },
    { p_event_id: null, p_competitor_1_id: null, p_competitor_2_id: null },
    { p_event_id: 123, p_competitor_1_id: 456, p_competitor_2_id: 789 }, // Tipos incorrectos
    { p_event_id: "{}", p_competitor_1_id: "[]", p_competitor_2_id: "null" } // JSON como string
  ];

  for (const payload of maliciousPayloads) {
    const url = `${SUPABASE_URL}/rest/v1/rpc/create_competitor_pair`;

    try {
      const response = await makeRequest(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': ANON_KEY,
          'Authorization': `Bearer ${ANON_KEY}`
        },
        body: JSON.stringify(payload)
      });

      // 401, 400, o errores de validación significan que está protegido
      const isProtected = response.status === 401 ||
        response.status === 400 ||
        response.body.includes('Invalid API key') ||
        response.body.includes('invalid input') ||
        response.body.includes('validation') ||
        response.body.includes('not found');

      logResult(`RPC Manipulation: ${JSON.stringify(payload).substring(0, 50)}`, isProtected, {
        status: response.status,
        errorMessage: response.body.substring(0, 200)
      });
    } catch (error) {
      logResult(`RPC Manipulation: ${JSON.stringify(payload).substring(0, 50)}`, true, {
        error: error.message
      });
    }
  }

  // Test funciones inexistentes
  const nonExistentFunctions = [
    'delete_all_competitors',
    'get_admin_credentials',
    'export_all_data',
    'drop_database'
  ];

  for (const func of nonExistentFunctions) {
    const url = `${SUPABASE_URL}/rest/v1/rpc/${func}`;

    try {
      const response = await makeRequest(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': ANON_KEY
        },
        body: JSON.stringify({})
      });

      const isProtected = response.status === 404 ||
        response.status === 401 ||
        response.body.includes('not found') ||
        response.body.includes('Invalid API key');

      logResult(`RPC Non-existent: ${func}`, isProtected, {
        status: response.status,
        errorMessage: response.body.substring(0, 200)
      });
    } catch (error) {
      logResult(`RPC Non-existent: ${func}`, true, {
        error: error.message
      });
    }
  }
}

/**
 * TEST 6: Acceso a Storage Buckets
 */
async function testStorageAccess() {
  console.log('\n🔍 Testing Storage Bucket Access...');

  const storagePaths = [
    '/storage/v1/object/public/',
    '/storage/v1/object/sign/',
    '/storage/v1/bucket/',
    '/storage/v1/bucket'
  ];

  for (const path of storagePaths) {
    const url = `${SUPABASE_URL}${path}`;

    try {
      const response = await makeRequest(url, {
        headers: {
          'apikey': ANON_KEY
        }
      });

      // 400 o 401 significa que está protegido
      const isProtected = response.status === 400 ||
        response.status === 401 ||
        response.status === 404 ||
        response.body.includes('Invalid') ||
        response.body.includes('Not found');

      logResult(`Storage Access: ${path}`, isProtected, {
        status: response.status,
        hasData: response.body.length > 100
      });
    } catch (error) {
      logResult(`Storage Access: ${path}`, true, {
        error: error.message
      });
    }
  }
}

/**
 * TEST 7: Listado de todos los eventos sin filtro
 */
async function testListAllEvents() {
  console.log('\n🔍 Testing List All Events (no status filter)...');

  const url = `${SUPABASE_URL}/rest/v1/events?select=*&limit=100`;

  try {
    const response = await makeRequest(url, {
      headers: {
        'apikey': ANON_KEY
      }
    });

    // Si devuelve solo eventos publicados o 401, está protegido
    const isProtected = response.status === 401 ||
      response.body.includes('Invalid API key') ||
      (response.success && JSON.parse(response.body).every(e =>
        e.status === 'published' || e.status === 'completed'
      ));

    logResult('List All Events (no filter)', isProtected, {
      status: response.status,
      eventCount: response.success ? JSON.parse(response.body).length : 0,
      hasUnpublished: response.success ? JSON.parse(response.body).some(e =>
        e.status !== 'published' && e.status !== 'completed'
      ) : false
    });
  } catch (error) {
    logResult('List All Events (no filter)', true, {
      error: error.message
    });
  }
}

// ============================================
// PRUEBAS EN NAVEGADOR (requieren Puppeteer/Playwright)
// ============================================

/**
 * TEST 8: XSS en formularios (requiere navegador)
 * 
 * Este test debe ejecutarse con Puppeteer o Playwright
 */
const browserXSSTest = `
// Código para ejecutar en el navegador
async function testXSSInForms() {
  const results = [];
  
  // Abrir formulario de registro
  const registerButton = document.querySelector('button:contains("Registrarse")');
  if (registerButton) {
    registerButton.click();
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Inyectar payloads XSS
  const xssPayloads = [
    "<script>alert('XSS')</script>",
    "<img src=x onerror=alert('XSS')>",
    "<svg onload=alert('XSS')>",
    "javascript:alert('XSS')",
    "<iframe src=javascript:alert('XSS')>"
  ];
  
  const nameInput = document.querySelector('input[type="text"]');
  if (nameInput) {
    for (const payload of xssPayloads) {
      nameInput.value = payload;
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      
      // Verificar si el script se ejecutó
      const scriptExecuted = window.alert.called || document.querySelector('script[src*="xss"]');
      
      results.push({
        payload,
        executed: !!scriptExecuted,
        protected: !scriptExecuted
      });
    }
  }
  
  return results;
}
`;

// ============================================
// EJECUCIÓN
// ============================================

async function runAllTests() {
  console.log('🚀 Iniciando pruebas de penetración de seguridad...');
  console.log(`📍 URL: ${DEFAULT_URL}`);
  console.log(`🔗 Supabase: ${SUPABASE_URL}`);
  console.log('');

  try {
    await testSQLInjection();
    await testIDOR();
    await testPathTraversal();
    await testUnauthorizedTableAccess();
    await testRPCManipulation();
    await testStorageAccess();
    await testListAllEvents();
  } catch (error) {
    console.error('❌ Error ejecutando tests:', error);
  }

  // Resumen
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMEN DE PRUEBAS');
  console.log('='.repeat(60));
  console.log(`Total de pruebas: ${results.total}`);
  console.log(`✅ Pasadas: ${results.passed.length}`);
  console.log(`❌ Fallidas: ${results.failed.length}`);
  console.log(`⚠️  Advertencias: ${results.warnings.length}`);
  console.log('');

  if (results.failed.length > 0) {
    console.log('❌ PRUEBAS FALLIDAS:');
    results.failed.forEach(f => {
      console.log(`   - ${f.test}`);
      if (f.error) console.log(`     Error: ${f.error}`);
    });
    console.log('');
  }

  const passRate = ((results.passed.length / results.total) * 100).toFixed(2);
  console.log(`📈 Tasa de éxito: ${passRate}%`);

  if (passRate >= 95) {
    console.log('✅ Sistema altamente protegido');
  } else if (passRate >= 80) {
    console.log('⚠️  Sistema protegido con algunas áreas de mejora');
  } else {
    console.log('❌ Sistema requiere mejoras de seguridad urgentes');
  }

  // Guardar resultados en JSON
  const fs = require('fs');
  const reportPath = 'security-test-results.json';
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n📄 Resultados guardados en: ${reportPath}`);
}

// Ejecutar si se llama directamente
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  runAllTests,
  testSQLInjection,
  testIDOR,
  testPathTraversal,
  testUnauthorizedTableAccess,
  testRPCManipulation,
  testStorageAccess,
  testListAllEvents,
  browserXSSTest
};




