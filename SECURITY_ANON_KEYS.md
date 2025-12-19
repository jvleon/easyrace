# Seguridad con Anon Keys en Supabase

## ❓ Pregunta Frecuente: ¿Es seguro usar Anon Keys?

**Respuesta corta: SÍ, es completamente seguro si RLS está bien configurado.**

---

## 🔐 ¿Qué son las Anon Keys?

Las **anon keys** (claves anónimas) de Supabase son:
- ✅ **Públicas por diseño** - Están diseñadas para estar en el código del cliente
- ✅ **Limitadas por RLS** - Su poder viene de las políticas RLS, no de ser secretas
- ✅ **Solo lectura/escritura básica** - No tienen permisos de administrador

**Es como tener la llave de la puerta principal, pero cada habitación tiene su propia cerradura (RLS).**

---

## 🛡️ ¿Cómo funciona la seguridad?

### Sin RLS (INSEGURO):
```
Cliente con anon key → Puede hacer CUALQUIER cosa
- Leer todos los datos
- Modificar cualquier registro
- Eliminar cualquier cosa
```

### Con RLS (SEGURO):
```
Cliente con anon key → Solo puede hacer lo que RLS permite
- Leer solo eventos publicados ✅
- Insertar competidores con validaciones ✅
- NO puede leer otros competidores ❌
- NO puede modificar eventos ❌
- NO puede eliminar nada ❌
```

---

## ✅ Configuración Segura para EasyRace

### 1. **Events (Eventos)**
```sql
-- ✅ PERMITIR: Lectura de eventos publicados
-- ❌ BLOQUEAR: Modificación desde cliente
```
**Resultado**: Los usuarios pueden ver eventos, pero no modificarlos.

### 2. **Competitors (Competidores)**
```sql
-- ✅ PERMITIR: INSERT con validaciones (a través de función RPC)
-- ❌ BLOQUEAR: SELECT directo (no pueden ver otros competidores)
-- ❌ BLOQUEAR: UPDATE/DELETE desde cliente
```
**Resultado**: Los usuarios pueden registrarse, pero no pueden:
- Ver otros competidores
- Modificar registros existentes
- Eliminar registros

### 3. **Categories, Kits, Clubs**
```sql
-- ✅ PERMITIR: Solo lectura
-- ❌ BLOQUEAR: Modificación
```
**Resultado**: Los usuarios pueden ver opciones, pero no modificarlas.

---

## 🔒 ¿Por qué es seguro?

### 1. **RLS filtra a nivel de base de datos**
Aunque un atacante tenga tu anon key, **no puede**:
- Ver datos que RLS bloquea
- Insertar datos que no pasen las validaciones de RLS
- Modificar datos sin permisos

### 2. **Funciones RPC ejecutan en el servidor**
Tu función `insert_competitor`:
- ✅ Ejecuta código en Supabase (no en el cliente)
- ✅ Puede validar datos antes de insertar
- ✅ Puede usar `SECURITY DEFINER` para permisos elevados
- ✅ No puede ser modificada por el cliente

### 3. **Validaciones múltiples**
```
Cliente → Validación frontend → Edge Function/RPC → Validación RLS → Base de datos
```
Cada capa valida, no solo confías en el cliente.

---

## 📋 Ejemplo Práctico

### Escenario: Usuario intenta registrarse

**1. Cliente envía datos:**
```javascript
await supabase.rpc('insert_competitor', {
  event_id: 'abc-123',
  email: 'user@example.com',
  // ... otros datos
});
```

**2. Función RPC valida:**
```sql
-- ✅ Evento existe y está publicado?
-- ✅ No excede max_competitors?
-- ✅ Email no está duplicado?
-- ✅ Categoría pertenece al evento?
```

**3. RLS valida:**
```sql
-- ✅ WITH CHECK: Evento está publicado?
-- ✅ WITH CHECK: Datos válidos?
```

**4. Si todo pasa → INSERT exitoso**
**Si algo falla → Error, no se inserta nada**

---

## ⚠️ ¿Qué NO hacer?

### ❌ MAL: Permitir INSERT directo sin RLS
```sql
-- SIN RLS o política muy permisiva
INSERT INTO competitors VALUES (...); -- Cualquiera puede insertar cualquier cosa
```

### ❌ MAL: Permitir SELECT sin restricciones
```sql
-- Política muy permisiva
SELECT * FROM competitors; -- Cualquiera puede ver todos los competidores
```

### ❌ MAL: No validar en funciones RPC
```sql
-- Función sin validaciones
CREATE FUNCTION insert_competitor(data jsonb) ...
  INSERT INTO competitors ... -- Sin validar nada
```

---

## ✅ ¿Qué SÍ hacer?

### ✅ BIEN: RLS restrictivo + Funciones RPC
```sql
-- RLS bloquea SELECT/UPDATE/DELETE directos
-- Función RPC valida y permite INSERT controlado
```

### ✅ BIEN: Validaciones en múltiples capas
```
Frontend → Edge Function → RPC Function → RLS → Database
```

### ✅ BIEN: Rate limiting
```typescript
// En Edge Function
if (attempts > 5) {
  return new Response('Rate limit', { status: 429 });
}
```

---

## 🎯 Resumen para EasyRace

### Tu situación actual:
- ✅ Usas `supabase.rpc('insert_competitor')` - **BIEN**
- ✅ No hay autenticación de usuarios - **OK, no es necesario**
- ✅ Usas anon keys - **OK, es normal y seguro**

### Lo que necesitas:
1. ✅ **Habilitar RLS** en todas las tablas
2. ✅ **Políticas restrictivas** para SELECT/UPDATE/DELETE
3. ✅ **Políticas permisivas con validaciones** para INSERT
4. ✅ **Validaciones en funciones RPC** (ya lo tienes)

### Resultado:
- ✅ Usuarios pueden registrarse (INSERT con validaciones)
- ❌ Usuarios NO pueden ver otros competidores (SELECT bloqueado)
- ❌ Usuarios NO pueden modificar datos (UPDATE bloqueado)
- ❌ Usuarios NO pueden eliminar datos (DELETE bloqueado)

---

## 📚 Referencias

- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Anon Key Security](https://supabase.com/docs/guides/platform/security)
- [OWASP: Broken Access Control](https://owasp.org/Top10/A01_2021-Broken_Access_Control/)

---

## 🚀 Próximos Pasos

1. **Ejecutar `RLS_SECURE_POLICIES.sql`** en Supabase Dashboard
2. **Verificar políticas** con `scripts/check-rls.sql`
3. **Probar registros** para asegurar que funcionan
4. **Intentar SELECT directo** para verificar que está bloqueado

**Conclusión**: Usar anon keys es seguro si RLS está bien configurado. No necesitas autenticación de usuarios para tener seguridad.




