-- Vista para verificar si un email ya está registrado en un evento
-- Esta vista permite validar que solo un competidor por email pueda registrarse en cada evento
CREATE OR REPLACE VIEW competitor_email_check AS
SELECT 
  event_id,
  email,
  COUNT(*) as count
FROM competitors
WHERE email IS NOT NULL
GROUP BY event_id, email;

-- Comentario: Esta vista se usa para validar que un email solo pueda registrarse una vez por evento
-- Ejemplo de uso:
-- SELECT * FROM competitor_email_check WHERE event_id = '...' AND email = '...' AND count > 0;

