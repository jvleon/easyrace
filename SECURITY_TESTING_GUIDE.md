# 🔒 Guía de Pruebas de Seguridad - EasyRace

Esta guía documenta todos los ataques realizados durante la auditoría de seguridad, cómo se ejecutaron, y cómo automatizarlos para pruebas futuras.

---

## 📋 Tabla de Contenidos

1. [Tipos de Ataques Probados](#tipos-de-ataques-probados)
2. [Scripts de Automatización](#scripts-de-automatización)
3. [Cómo Ejecutar las Pruebas](#cómo-ejecutar-las-pruebas)
4. [Resultados Esperados](#resultados-esperados)
5. [Interpretación de Resultados](#interpretación-de-resultados)

---

## 🎯 Tipos de Ataques Probados

### 1. SQL Injection

**Descripción**: Intentar inyectar código SQL malicioso en parámetros de consulta.

**Payloads Probados**:
```javascript
"' OR '1'='1"
"'; DROP TABLE competitors; --"
"' UNION SELECT * FROM competitors --"
"1' OR '1'='1' --"
"admin'--"
"' OR 1=1--"
```

**Código de Prueba**:
```javascript
const sqlPayloads = [
  "' OR '1'='1",
  "'; DROP TABLE competitors; --",
  "' UNION SELECT * FROM competitors --",
  // ...
];

for (const payload of sqlPayloads) {
  const url = `${SUPABASE_URL}/rest/v1/events?slug=eq.${encodeURIComponent(payload)}`;
  const response = await fetch(url, {
    headers: { 'apikey': ANON_KEY }
  });
  
  // Si devuelve 401 o 400, está protegido
  const isProtected = response.status === 401 || response.status === 400;
}
```

**Resultado Esperado**: ✅ `401 Unauthorized` o `400 Bad Request`

---

### 2. IDOR (Insecure Direct Object References)

**Descripción**: Intentar acceder a datos de otros usuarios usando UUIDs predecibles.

**UUIDs Probados**:
```javascript
'00000000-0000-0000-0000-000000000000'
'11111111-1111-1111-1111-111111111111'
'ffffffff-ffff-ffff-ffff-ffffffffffff'
'762f026b-037d-4a6c-8fb6-e769f8e404b3' // UUID conocido
```

**Código de Prueba**:
```javascript
const commonUUIDs = [
  '00000000-0000-0000-0000-000000000000',
  // ...
];

for (const uuid of commonUUIDs) {
  const url = `${SUPABASE_URL}/rest/v1/events?id=eq.${uuid}&select=*`;
  const response = await fetch(url, {
    headers: { 'apikey': ANON_KEY }
  });
  
  // Si devuelve 401 o array vacío, está protegido
  const isProtected = response.status === 401 || 
                     response.body === '[]';
}
```

**Resultado Esperado**: ✅ `401 Unauthorized` o `[]` (array vacío)

---

### 3. Path Traversal

**Descripción**: Intentar acceder a archivos fuera del directorio permitido usando `../`.

**Payloads Probados**:
```javascript
'/liability-waivers/../competitors'
'/liability-waivers/../../'
'/liability-waivers/../../../'
'/liability-waivers/../../../../etc/passwd'
'/liability-waivers/..%2F..%2F' // URL encoded
'/liability-waivers/%2e%2e%2f%2e%2e%2f' // Double encoding
'/liability-waivers/....//....//' // Double slash bypass
```

**Código de Prueba**:
```javascript
const pathTraversalPayloads = [
  '/liability-waivers/../competitors',
  // ...
];

for (const path of pathTraversalPayloads) {
  const url = `${SUPABASE_URL}/storage/v1/object/public${path}`;
  const response = await fetch(url);
  
  // 400 o 404 significa que está protegido
  const isProtected = response.status === 400 || 
                     response.status === 404;
}
```

**Resultado Esperado**: ✅ `400 Bad Request` o `404 Not Found`

---

### 4. Acceso No Autorizado a Tablas

**Descripción**: Intentar acceder directamente a tablas sin autenticación válida.

**Tablas Probadas**:
```javascript
['competitors', 'events', 'categories', 'kits', 
 'competitor_pairs', 'clubs', 'profiles']
```

**Código de Prueba**:
```javascript
const tables = ['competitors', 'events', /* ... */];

for (const table of tables) {
  // Sin autenticación
  const responseNoAuth = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?select=*&limit=10`
  );
  
  // Con key inválida
  const responseInvalidKey = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?select=*&limit=10`,
    { headers: { 'apikey': 'invalid_key_12345' } }
  );
  
  const isProtected = responseNoAuth.status === 401 &&
                     responseInvalidKey.status === 401;
}
```

**Resultado Esperado**: ✅ `401 Unauthorized` en ambos casos

---

### 5. Manipulación de Funciones RPC

**Descripción**: Intentar llamar funciones RPC con parámetros maliciosos.

**Payloads Probados**:
```javascript
{ p_event_id: "' OR '1'='1", ... } // SQL injection
{ p_event_id: 123, ... } // Tipo incorrecto
{ p_event_id: null, ... } // Valores null
{ p_event_id: "{}", ... } // JSON como string
```

**Código de Prueba**:
```javascript
const maliciousPayloads = [
  { p_event_id: "' OR '1'='1", p_competitor_1_id: "test", p_competitor_2_id: "test" },
  { p_event_id: 123, p_competitor_1_id: 456, p_competitor_2_id: 789 },
  // ...
];

for (const payload of maliciousPayloads) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/create_competitor_pair`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': ANON_KEY
      },
      body: JSON.stringify(payload)
    }
  );
  
  const isProtected = response.status === 401 || 
                     response.status === 400 ||
                     response.body.includes('invalid input');
}
```

**Resultado Esperado**: ✅ `401 Unauthorized` o `400 Bad Request` con mensaje de validación

---

### 6. XSS (Cross-Site Scripting)

**Descripción**: Intentar inyectar scripts maliciosos en campos de formulario.

**Payloads Probados**:
```javascript
"<script>alert('XSS')</script>"
"<img src=x onerror=alert('XSS')>"
"<svg onload=alert('XSS')>"
"javascript:alert('XSS')"
"<iframe src=javascript:alert('XSS')>"
```

**Código de Prueba (Navegador)**:
```javascript
// En el navegador con Puppeteer
const xssPayloads = [
  "<script>alert('XSS')</script>",
  // ...
];

const nameInput = await page.$('input[type="text"]');
for (const payload of xssPayloads) {
  await nameInput.fill(payload);
  
  // Verificar si el script se ejecutó
  const alertTriggered = await page.evaluate(() => {
    // Interceptar alert
    let triggered = false;
    window.alert = () => { triggered = true; };
    return triggered;
  });
  
  const isProtected = !alertTriggered;
}
```

**Resultado Esperado**: ✅ Scripts no se ejecutan, se tratan como texto plano

---

### 7. Exposición de API Keys

**Descripción**: Buscar si las API keys están expuestas en el código fuente.

**Lugares Revisados**:
- Código fuente HTML
- Scripts JavaScript cargados
- Variables globales de `window`
- `localStorage` y `sessionStorage`
- Headers HTTP

**Código de Prueba**:
```javascript
// Buscar en código fuente
const sourceCode = await page.content();
const jwtPattern = /eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}/g;
const jwtMatches = sourceCode.match(jwtPattern);

// Buscar en window
const windowVars = await page.evaluate(() => {
  const vars = {};
  for (let key in window) {
    if (key.toLowerCase().includes('supabase')) {
      const value = window[key];
      if (typeof value === 'string' && value.startsWith('eyJ')) {
        vars[key] = value;
      }
    }
  }
  return vars;
});

const isProtected = (!jwtMatches || jwtMatches.length === 0) &&
                   Object.keys(windowVars).length === 0;
```

**Resultado Esperado**: ✅ No se encuentran keys en código fuente

---

## 🛠️ Scripts de Automatización

### Script 1: Pruebas HTTP (Node.js)

**Archivo**: `scripts/security-penetration-tests.js`

**Uso**:
```bash
# Con variables de entorno
PUBLIC_SUPABASE_URL=https://drmgrpeqaskysogzvpcx.supabase.co \
PUBLIC_SUPABASE_ANON_KEY=tu_key_aqui \
node scripts/security-penetration-tests.js

# O con URL personalizada
TEST_URL=https://easyrace.com.mx node scripts/security-penetration-tests.js
```

**Pruebas Incluidas**:
- ✅ SQL Injection
- ✅ IDOR
- ✅ Path Traversal
- ✅ Acceso no autorizado
- ✅ Manipulación RPC
- ✅ Acceso a Storage

---

### Script 2: Pruebas en Navegador (Puppeteer)

**Archivo**: `scripts/browser-security-tests.js`

**Instalación**:
```bash
npm install puppeteer
```

**Uso**:
```bash
node scripts/browser-security-tests.js
```

**Pruebas Incluidas**:
- ✅ XSS en formularios
- ✅ Exposición de API Keys
- ✅ Interceptación de requests
- ✅ Manipulación de datos
- ✅ Headers de seguridad
- ✅ Exposición de información en errores

---

## 🚀 Cómo Ejecutar las Pruebas

### Opción 1: Ejecución Individual

```bash
# Pruebas HTTP
node scripts/security-penetration-tests.js

# Pruebas en navegador
node scripts/browser-security-tests.js
```

### Opción 2: Ejecución Completa

Crear un script `scripts/run-all-security-tests.sh`:

```bash
#!/bin/bash

echo "🚀 Ejecutando todas las pruebas de seguridad..."

# Pruebas HTTP
echo "📡 Ejecutando pruebas HTTP..."
node scripts/security-penetration-tests.js

# Pruebas en navegador
echo "🌐 Ejecutando pruebas en navegador..."
node scripts/browser-security-tests.js

echo "✅ Pruebas completadas"
```

### Opción 3: Integración con CI/CD

Agregar a `.github/workflows/security-tests.yml`:

```yaml
name: Security Tests

on:
  schedule:
    - cron: '0 0 * * 0' # Semanal
  workflow_dispatch:

jobs:
  security-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm install puppeteer
      - run: node scripts/security-penetration-tests.js
      - run: node scripts/browser-security-tests.js
      - uses: actions/upload-artifact@v3
        with:
          name: security-test-results
          path: |
            security-test-results.json
            browser-security-test-results.json
```

---

## 📊 Resultados Esperados

### Pruebas HTTP

```
🚀 Iniciando pruebas de penetración de seguridad...
📍 URL: https://easyrace.com.mx
🔗 Supabase: https://drmgrpeqaskysogzvpcx.supabase.co

🔍 Testing SQL Injection...
✅ PASS: SQL Injection: ' OR '1'='1
✅ PASS: SQL Injection: '; DROP TABLE competitors; --
...

🔍 Testing IDOR...
✅ PASS: IDOR Event: 00000000-0000-0000-0000-000000000000
...

============================================================
📊 RESUMEN DE PRUEBAS
============================================================
Total de pruebas: 55
✅ Pasadas: 55
❌ Fallidas: 0
⚠️  Advertencias: 0

📈 Tasa de éxito: 100.00%
✅ Sistema altamente protegido

📄 Resultados guardados en: security-test-results.json
```

### Pruebas en Navegador

```
🚀 Iniciando pruebas de seguridad en navegador...
📍 URL: https://easyrace.com.mx

🔍 Testing XSS in Forms...
✅ PASS: XSS: <script>alert('XSS')</script>
...

🔍 Testing API Key Exposure...
✅ PASS: API Key Exposure
...

============================================================
📊 RESUMEN DE PRUEBAS EN NAVEGADOR
============================================================
Total de pruebas: 6
✅ Pasadas: 6
❌ Fallidas: 0

📈 Tasa de éxito: 100.00%

📄 Resultados guardados en: browser-security-test-results.json
```

---

## 📈 Interpretación de Resultados

### Tasa de Éxito

- **≥ 95%**: ✅ Sistema altamente protegido
- **80-94%**: ⚠️ Sistema protegido con algunas áreas de mejora
- **< 80%**: ❌ Sistema requiere mejoras de seguridad urgentes

### Resultados Individuales

Cada prueba devuelve:
- ✅ **PASS**: La vulnerabilidad está protegida
- ❌ **FAIL**: La vulnerabilidad existe y necesita corrección

### Archivos de Resultados

Los resultados se guardan en:
- `security-test-results.json`: Resultados de pruebas HTTP
- `browser-security-test-results.json`: Resultados de pruebas en navegador

Formato:
```json
{
  "passed": [
    {
      "test": "SQL Injection: ' OR '1'='1",
      "passed": true,
      "timestamp": "2025-12-12T04:37:00.000Z",
      "status": 401
    }
  ],
  "failed": [],
  "total": 55
}
```

---

## 🔄 Mantenimiento

### Frecuencia Recomendada

- **Semanal**: Ejecutar pruebas automatizadas
- **Mensual**: Revisar y actualizar payloads de ataque
- **Trimestral**: Auditoría completa de seguridad

### Actualización de Payloads

Cuando aparezcan nuevas vulnerabilidades conocidas, agregar payloads a los arrays correspondientes en los scripts.

### Monitoreo Continuo

Integrar las pruebas en CI/CD para ejecutarlas automáticamente en cada deploy o semanalmente.

---

## 📚 Referencias

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/database/security)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/security.html)

---

*Última actualización: 12 de Diciembre, 2025*




