# Auditoría de Seguridad - EasyRace Landing Page

## Resumen Ejecutivo

Esta auditoría identifica vulnerabilidades potenciales basadas en el **OWASP Top 10 2021** y mejores prácticas de seguridad para aplicaciones web con:
- **Frontend**: Astro + React
- **Backend**: Supabase (PostgreSQL)
- **Hosting**: Estático

---

## 🔴 CRÍTICO - Vulnerabilidades Encontradas

### 1. Cross-Site Scripting (XSS) - A03:2021 – Injection

**Ubicación**: `src/components/EventDetail.tsx` (líneas 473, 531)

**Problema**:
```tsx
dangerouslySetInnerHTML={{ __html: slateToHtml(event.page_description) }}
dangerouslySetInnerHTML={{ __html: group.stravaEmbed }}
```

**Riesgo**: 
- **ALTO**: Permite ejecución de código JavaScript malicioso
- Si un atacante puede inyectar contenido en `page_description` o `stravaEmbed`, puede ejecutar scripts

**Mitigación Actual**:
- ✅ `slateToHtml` usa `escapeHtml` para escapar caracteres HTML
- ⚠️ Pero `stravaEmbed` se inserta directamente sin sanitización

**Recomendación**:
1. **Inmediato**: Sanitizar `stravaEmbed` con DOMPurify
2. **Validar**: Que solo admins puedan modificar estos campos
3. **Implementar**: Content Security Policy (CSP) headers

---

### 2. SQL Injection - A03:2021 – Injection

**Ubicación**: Todas las consultas a Supabase

**Problema Potencial**:
- Supabase usa parámetros preparados, pero hay que verificar:
  - Uso de `.rpc()` con parámetros
  - Consultas dinámicas con interpolación de strings

**Revisar**:
```typescript
// ✅ SEGURO - Usa parámetros
.eq('slug', currentSlug)

// ⚠️ VERIFICAR - RPC calls
supabase.rpc('get_competitors_count', {
  event_id_param: eventData.id
})
```

**Recomendación**:
1. Verificar que todas las RPC functions usen parámetros tipados
2. Nunca construir queries con template strings
3. Revisar Edge Functions para validación de inputs

---

### 3. Exposición de Datos Sensibles - A01:2021 – Broken Access Control

**Ubicación**: `src/lib/supabase.ts`

**Estado**: ✅ **NO ES UN PROBLEMA** si RLS está configurado correctamente

**Aclaración Importante**:
- Las anon keys **están diseñadas** para estar en el código del cliente
- La seguridad viene de **RLS (Row Level Security)**, no de ocultar las keys
- Ya estás usando `supabase.rpc('insert_competitor')` que es la práctica correcta

**Riesgo**:
- **ALTO**: Solo si RLS NO está configurado
- **BAJO**: Si RLS está bien configurado (ver `RLS_SECURE_POLICIES.sql`)

**Recomendación**:
1. **Verificar RLS en todas las tablas** (ver `SECURITY_ANON_KEYS.md` para más detalles):
   ```sql
   -- Verificar políticas RLS
   SELECT tablename, policyname, permissive, roles, cmd, qual 
   FROM pg_policies 
   WHERE schemaname = 'public';
   ```

2. **Asegurar que** (ver `RLS_SECURE_POLICIES.sql` para políticas completas):
   - `competitors`: INSERT permitido solo a través de función RPC con validaciones, SELECT bloqueado
   - `events`: Solo lectura pública para eventos publicados, modificación bloqueada
   - `categories`: Solo lectura pública
   - **INSERT permitido** pero solo a través de funciones RPC con validaciones (ya lo estás haciendo ✅)

---

### 4. Validación de Inputs Insuficiente - A03:2021 – Injection

**Ubicación**: `src/components/RegistrationModal.tsx`

**Problemas Encontrados**:
- ✅ Validación de email básica
- ✅ Validación de archivos (tipo y tamaño)
- ⚠️ Validación de strings puede ser mejorada
- ⚠️ No hay rate limiting en el cliente

**Recomendación**:
1. Implementar validación más estricta:
   ```typescript
   // Validar longitud máxima
   if (value.length > 255) throw new Error('Campo muy largo');
   
   // Validar caracteres permitidos
   if (!/^[a-zA-Z0-9\s\-áéíóúÁÉÍÓÚñÑ]+$/.test(value)) {
     throw new Error('Caracteres inválidos');
   }
   ```

2. Implementar rate limiting en Edge Functions

---

### 5. Falta de Rate Limiting - A04:2021 – Insecure Design

**Ubicación**: Formularios de registro y validación

**Riesgo**:
- **MEDIO**: Ataques de fuerza bruta
- Spam de registros
- DoS por múltiples requests

**Recomendación**:
1. Implementar rate limiting en Edge Functions:
   ```typescript
   // En Edge Function
   const rateLimitKey = `${email}-${eventId}`;
   const attempts = await redis.get(rateLimitKey);
   if (attempts > 5) {
     return new Response('Rate limit exceeded', { status: 429 });
   }
   ```

2. Usar Supabase Rate Limiting o Cloudflare

---

## 🟡 MEDIO - Mejoras Recomendadas

### 6. Content Security Policy (CSP) Faltante

**Recomendación**:
Agregar headers CSP en `astro.config.mjs`:
```javascript
export default defineConfig({
  vite: {
    server: {
      headers: {
        "Content-Security-Policy": 
          "default-src 'self'; " +
          "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com; " +
          "style-src 'self' 'unsafe-inline'; " +
          "img-src 'self' data: https://imagedelivery.net https://*.cloudflare.com; " +
          "connect-src 'self' https://*.supabase.co https://*.supabase.in; " +
          "frame-src https://www.strava.com;"
      }
    }
  }
});
```

---

### 7. Validación de Archivos Mejorada

**Ubicación**: `src/utils/cloudflare.ts`

**Mejoras**:
1. Validar magic bytes (no solo extensión)
2. Escanear con antivirus (opcional)
3. Limitar tipos MIME más estrictamente

---

### 8. Logging y Monitoreo

**Recomendación**:
1. Implementar logging de eventos críticos:
   - Registros fallidos
   - Intentos de acceso no autorizados
   - Errores de validación

2. Configurar alertas en Supabase Dashboard

---

## 🟢 BAJO - Buenas Prácticas

### 9. Headers de Seguridad

**Recomendación**: Agregar en producción:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`

---

### 10. Validación de Tipos TypeScript

**Estado**: ✅ Bueno - Usa TypeScript
**Mejora**: Agregar validación runtime con Zod o Yup

---

## 📋 Checklist de Verificación Pre-Producción

### Supabase (Backend)
- [ ] **RLS habilitado** en todas las tablas
- [ ] **Políticas RLS** configuradas correctamente:
  - [ ] `events`: Solo lectura pública para `status = 'published'`
  - [ ] `competitors`: Solo INSERT desde Edge Functions, no desde cliente
  - [ ] `categories`: Solo lectura pública
  - [ ] `kits`: Solo lectura pública
- [ ] **Edge Functions** tienen validación de inputs
- [ ] **Rate limiting** configurado en Edge Functions
- [ ] **Backups** automáticos configurados
- [ ] **Logs** habilitados y monitoreados

### Frontend (Astro/React)
- [ ] **CSP headers** configurados
- [ ] **Sanitización** de `stravaEmbed` implementada
- [ ] **Validación** de inputs mejorada
- [ ] **Variables de entorno** no expuestas en el bundle
- [ ] **Error handling** no expone información sensible
- [ ] **HTTPS** forzado en producción

### Archivos y Uploads
- [ ] **Validación** de tipos de archivo (magic bytes)
- [ ] **Límites** de tamaño implementados
- [ ] **Nombres de archivo** sanitizados
- [ ] **Cloudflare Images** configurado con restricciones

### Testing
- [ ] **Pruebas de penetración** básicas realizadas
- [ ] **OWASP ZAP** o similar ejecutado
- [ ] **Análisis estático** de código (SonarQube, Snyk)
- [ ] **Dependencias** actualizadas y sin vulnerabilidades conocidas

---

## 🛠️ Plan de Acción Inmediato

### Prioridad 1 (Antes de Producción)
1. ✅ Sanitizar `stravaEmbed` con DOMPurify
2. ✅ Verificar y configurar RLS en todas las tablas
3. ✅ Implementar CSP headers
4. ✅ Agregar rate limiting en Edge Functions

### Prioridad 2 (Primera semana)
1. Mejorar validación de inputs
2. Implementar logging de seguridad
3. Configurar monitoreo y alertas
4. Revisar y actualizar dependencias

### Prioridad 3 (Primer mes)
1. Implementar pruebas de seguridad automatizadas
2. Configurar escaneo de vulnerabilidades continuo
3. Documentar procedimientos de respuesta a incidentes
4. Capacitar al equipo en seguridad

---

## 🔍 Herramientas Recomendadas

### Testing
- **OWASP ZAP**: Escaneo automático de vulnerabilidades
- **Burp Suite**: Testing manual avanzado
- **Snyk**: Análisis de dependencias
- **SonarQube**: Análisis estático de código

### Monitoreo
- **Supabase Dashboard**: Logs y métricas
- **Sentry**: Error tracking
- **Cloudflare Analytics**: Análisis de tráfico y amenazas

### Validación
- **DOMPurify**: Sanitización de HTML
- **Zod**: Validación de esquemas TypeScript
- **Helmet.js**: Headers de seguridad (si se usa Express)

---

## 📚 Referencias

- [OWASP Top 10 2021](https://owasp.org/Top10/)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/platform/security)
- [Astro Security](https://docs.astro.build/en/guides/security/)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/security.html)

## 📄 Documentos Relacionados

- **`SECURITY_ANON_KEYS.md`**: Explicación detallada sobre seguridad con anon keys
- **`RLS_SECURE_POLICIES.sql`**: Políticas RLS seguras que permiten registros públicos
- **`scripts/check-rls.sql`**: Script para verificar configuración de RLS

---

## Notas Finales

Los 100+ issues reportados por Supabase probablemente incluyen:
- Advertencias de RLS no configurado
- Sugerencias de índices faltantes
- Recomendaciones de optimización
- Advertencias de versiones de PostgreSQL

**No todos son críticos**, pero deben revisarse caso por caso.

**Recomendación**: Revisar el dashboard de Supabase y priorizar los issues marcados como "Security" o "High Priority".

