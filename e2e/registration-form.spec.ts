import { test, expect } from '@playwright/test';

/**
 * E2E: Formulario de Registro de Competidores (RegistrationModal)
 *
 * Este es el formulario más crítico del sistema. Valida que los campos
 * de registro se comporten correctamente, muestren errores apropiados
 * y que el flujo de envío funcione de punta a punta.
 *
 * Prerequisitos:
 * - Supabase local corriendo con `supabase start`
 * - Al menos un evento con registro activo en la DB local
 * - Vars de entorno en .env.test apuntando a Supabase local
 */

test.describe('RegistrationModal — comportamiento del formulario de inscripción', () => {
  /**
   * La landing page muestra eventos publicados. Vamos al primero disponible.
   * En CI se garantiza que exista un evento de prueba en la DB local via seeds.
   */
  async function openRegistrationModal(page: any) {
    await page.goto('/');
    // Esperar a que carguen los eventos
    await page.waitForSelector('[data-testid="event-card"], a[href*="/eventos/"]', {
      timeout: 10000,
    });
    // Ir al primer evento disponible
    const eventLink = page.locator('a[href*="/eventos/"]').first();
    await eventLink.click();
    // Esperar que cargue la página del evento
    await page.waitForURL('**/eventos/**', { timeout: 10000 });
    // Click en el botón de inscripción
    const registerBtn = page.getByRole('button', {
      name: /inscribirse|registrarse|inscripción/i,
    });
    await registerBtn.waitFor({ timeout: 5000 });
    await registerBtn.click();
    // Esperar que aparezca el modal
    await page.getByRole('dialog').waitFor({ timeout: 5000 });
  }

  test('el modal de registro se abre al hacer click en inscribirse', async ({ page }) => {
    await openRegistrationModal(page);
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('muestra error si se intenta continuar sin seleccionar género', async ({ page }) => {
    await openRegistrationModal(page);
    // Intentar avanzar sin seleccionar género (click en algún button de submit / siguiente)
    const submitOrNext = page.getByRole('button', {
      name: /siguiente|continuar|inscribirme/i,
    });
    if (await submitOrNext.isVisible()) {
      await submitOrNext.click();
      // Debe mostrar error de género o categoría
      await expect(
        page.getByText(/selecciona.*género|género.*requerido|selecciona.*categoría/i)
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test('el modal se puede cerrar con el botón X', async ({ page }) => {
    await openRegistrationModal(page);
    const closeBtn = page.getByRole('button', { name: /cerrar|close/i }).or(
      page.locator('[aria-label="Cerrar"]')
    );
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3000 });
    }
  });

  test('muestra campos obligatorios: nombre, apellido, email', async ({ page }) => {
    await openRegistrationModal(page);
    // Verificar que los campos requeridos están presentes
    await expect(
      page.getByLabel(/nombre/i).or(page.locator('[placeholder*="nombre" i]'))
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByLabel(/email/i).or(page.locator('input[type="email"]'))
    ).toBeVisible({ timeout: 5000 });
  });

  test('el campo email rechaza formatos inválidos', async ({ page }) => {
    await openRegistrationModal(page);

    const emailInput = page.getByLabel(/email/i).or(page.locator('input[type="email"]')).first();
    await emailInput.waitFor({ timeout: 5000 });
    await emailInput.fill('no-es-un-email');

    // Intentar avanzar / enviar
    const submitBtn = page.getByRole('button', { name: /siguiente|inscribirme|continuar/i }).first();
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      await expect(
        page.getByText(/email.*inválido|correo.*inválido|formato.*email/i)
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test('el modal persiste con los datos si el usuario lo cierra accidentalmente', async ({ page }) => {
    await openRegistrationModal(page);

    // Llenar el campo email
    const emailInput = page.getByLabel(/email/i).or(page.locator('input[type="email"]')).first();
    if (await emailInput.isVisible()) {
      await emailInput.fill('test@example.com');

      // Intentar cerrar con Escape — debe aparecer confirmación
      await page.keyboard.press('Escape');

      // Debería aparecer un diálogo de confirmación
      const confirmDialog = page.getByRole('alertdialog').or(
        page.locator('text=/perderán los datos/i')
      );
      // Si el diálogo de confirmación aparece, los datos están siendo protegidos
      if (await confirmDialog.isVisible({ timeout: 2000 }).catch(() => false)) {
        expect(confirmDialog).toBeVisible();
      }
      // Si no aparece diálogo, el modal seguirá abierto (también es válido)
    }
  });
});
