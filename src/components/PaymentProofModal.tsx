import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { uploadPaymentProofToCloudflare } from '../utils/cloudflare';
import { FiX, FiCheckCircle, FiAlertCircle, FiLoader, FiUpload } from 'react-icons/fi';

interface PaymentProofModalProps {
  eventId: string;
  eventSlug: string;
  isOpen: boolean;
  onClose: () => void;
}

interface ValidationResult {
  success: boolean;
  competitor_id: string | null;
  is_registered: boolean;
  has_payment_proof: boolean;
  payment_confirmed: boolean;
  email_exists?: boolean;
  phone_exists?: boolean;
}

export default function PaymentProofModal({
  eventId,
  eventSlug,
  isOpen,
  onClose,
}: PaymentProofModalProps) {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);

  // Resetear estado al abrir/cerrar el modal
  const handleClose = () => {
    setEmail('');
    setEmailError(null);
    setIsValidating(false);
    setValidationResult(null);
    setSelectedFile(null);
    setIsUploading(false);
    setUploadSuccess(false);
    setError(null);
    setShowReplaceConfirm(false);
    onClose();
  };

  const validateEmail = (emailValue: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailValue);
  };

  const handleEmailBlur = async () => {
    if (!email.trim()) {
      setEmailError(null);
      return;
    }

    if (!validateEmail(email)) {
      setEmailError('Correo electrónico inválido');
      return;
    }

    setEmailError(null);
    // No validar automáticamente, solo cuando el usuario haga clic en "Validar"
  };

  const handleValidate = async () => {
    if (!email.trim()) {
      setEmailError('El correo electrónico es requerido');
      return;
    }

    if (!validateEmail(email)) {
      setEmailError('Correo electrónico inválido');
      return;
    }

    try {
      setIsValidating(true);
      setError(null);
      setEmailError(null);

      const { data, error: validateError } = await supabase.functions.invoke('validate-competitor', {
        body: {
          email,
          event_id: eventId,
        },
      });

      if (validateError) {
        throw validateError;
      }

      const result = data as ValidationResult;
      setValidationResult(result);

      if (!result.is_registered) {
        setError('No estás registrado en este evento. Por favor, regístrate primero.');
      } else if (result.payment_confirmed) {
        setError(null); // Se mostrará mensaje de éxito
      } else if (result.has_payment_proof && !result.payment_confirmed) {
        // Ya tiene comprobante pero no está confirmado, preguntar si desea reemplazarlo
        setShowReplaceConfirm(true);
        setError(null);
      }
    } catch (err: any) {
      console.error('Error validating competitor:', err);
      if (err.status === 429) {
        setError('Demasiadas solicitudes. Intenta más tarde.');
      } else {
        setError(err.message || 'Error al validar. Por favor, intenta de nuevo.');
      }
      setValidationResult(null);
    } finally {
      setIsValidating(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      return;
    }

    // Validar tipo de archivo
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      setError('Solo se permiten archivos JPEG, JPG o PNG');
      setSelectedFile(null);
      return;
    }

    // Validar tamaño (2MB máximo)
    const maxSize = 2 * 1024 * 1024; // 2 MB
    if (file.size > maxSize) {
      setError('La imagen debe ser menor a 2MB');
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    setError(null);
  };

  const handleUpload = async () => {
    if (!validationResult?.competitor_id) {
      setError('Debes validar tu correo primero');
      return;
    }

    if (!selectedFile) {
      setError('Debes seleccionar un archivo');
      return;
    }

    try {
      setIsUploading(true);
      setError(null);

      // Subir a Cloudflare usando la función de utilidad
      const imageUrl = await uploadPaymentProofToCloudflare(selectedFile, eventSlug, eventId);

      // Actualizar el competidor usando la edge function upload-payment-proof
      const formData = new FormData();
      formData.append('competitor_id', validationResult.competitor_id);
      formData.append('payment_proof', selectedFile);

      const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/upload-payment-proof`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'apikey': supabaseAnonKey,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }));
        if (response.status === 429) {
          throw new Error('Demasiadas solicitudes. Intenta más tarde.');
        } else if (response.status === 400) {
          throw new Error(errorData.error || 'Error al subir comprobante');
        }
        throw new Error(errorData.error || 'Error al subir comprobante');
      }

      const result = await response.json();
      setUploadSuccess(true);
      setError(null);
      setShowReplaceConfirm(false);

      // Cerrar modal después de 5 segundos
      setTimeout(() => {
        handleClose();
      }, 5000);
    } catch (err: any) {
      console.error('Error uploading payment proof:', err);
      setError(err.message || 'Error al subir comprobante. Por favor, intenta de nuevo.');
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black-asphalt/80 backdrop-blur-sm animate-fade-in"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="bg-black-asphalt border border-white-pure/20 rounded-lg shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-black-asphalt border-b border-white-pure/20 p-6 flex justify-between items-center">
          <h2 id="modal-title" className="text-2xl font-bold text-white-pure">
            Enviar Comprobante de Pago
          </h2>
          <button
            onClick={handleClose}
            className="text-white-pure/70 hover:text-white-pure transition-colors"
            aria-label="Cerrar"
          >
            <FiX size={24} />
          </button>
        </div>

        <div className="p-6">
          {uploadSuccess ? (
            <div className="text-center py-8">
              <FiCheckCircle className="mx-auto text-green-500 mb-4" size={48} />
              <p className="text-white-pure text-lg font-semibold mb-2">
                Comprobante enviado exitosamente
              </p>
              <p className="text-white-pure/70 text-sm">
                Recibirás un correo de confirmación cuando tu pago sea confirmado.
              </p>
            </div>
          ) : validationResult?.payment_confirmed ? (
            <div className="text-center py-8">
              <FiCheckCircle className="mx-auto text-green-500 mb-4" size={48} />
              <p className="text-white-pure text-lg font-semibold mb-2">
                Pago confirmado
              </p>
              <p className="text-white-pure/70 text-sm">
                Tu pago ya fue confirmado. No es necesario enviar otro comprobante.
              </p>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-6 p-4 bg-red-fire/20 border border-red-fire rounded-lg flex items-start">
                  <FiAlertCircle className="text-red-fire mr-3 mt-0.5" size={20} />
                  <p className="text-white-pure text-sm">{error}</p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-white-pure text-sm font-medium mb-2">
                    Correo electrónico <span className="text-red-fire ml-1">*</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setEmailError(null);
                      setError(null);
                      setValidationResult(null);
                      setShowReplaceConfirm(false);
                    }}
                    onBlur={handleEmailBlur}
                    className="w-full px-4 py-2 bg-white-pure/10 border border-white-pure/20 rounded-lg text-white-pure focus:outline-none focus:ring-2 focus:ring-orange-primary focus:border-transparent"
                    placeholder="tu@email.com"
                  />
                  {emailError && (
                    <p className="mt-1 text-sm text-red-fire">{emailError}</p>
                  )}
                </div>

                {!validationResult && (
                  <button
                    onClick={handleValidate}
                    disabled={isValidating || !email.trim()}
                    className="w-full px-6 py-2 bg-orange-primary hover:bg-red-fire text-white-pure rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isValidating ? (
                      <>
                        <FiLoader className="animate-spin" />
                        Validando...
                      </>
                    ) : (
                      'Validar'
                    )}
                  </button>
                )}

                {validationResult?.is_registered && !validationResult.payment_confirmed && (
                  <>
                    {showReplaceConfirm ? (
                      <div className="space-y-4">
                        <div className="p-4 bg-yellow-500/20 border border-yellow-500 rounded-lg">
                          <p className="text-white-pure text-sm">
                            Ya tienes un comprobante de pago registrado. ¿Deseas reemplazarlo?
                            El comprobante anterior será eliminado.
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setShowReplaceConfirm(false)}
                            className="flex-1 px-4 py-2 border border-white-pure/20 rounded-lg text-white-pure hover:bg-white-pure/10 transition-colors"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={() => setShowReplaceConfirm(false)}
                            className="flex-1 px-4 py-2 bg-orange-primary hover:bg-red-fire text-white-pure rounded-lg font-semibold transition-colors"
                          >
                            Continuar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-white-pure text-sm font-medium mb-2">
                            Comprobante de pago <span className="text-red-fire ml-1">*</span>
                          </label>
                          <input
                            type="file"
                            accept="image/jpeg,image/jpg,image/png"
                            onChange={handleFileChange}
                            className="w-full px-4 py-2 bg-white-pure/10 border border-white-pure/20 rounded-lg text-white-pure file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-orange-primary file:text-white-pure hover:file:bg-red-fire focus:outline-none focus:ring-2 focus:ring-orange-primary"
                          />
                          <p className="mt-2 text-white-pure/60 text-xs">
                            Solo JPEG, JPG o PNG. Máximo 2MB.
                          </p>
                          {selectedFile && (
                            <p className="mt-2 text-white-pure/80 text-sm">
                              Archivo seleccionado: {selectedFile.name}
                            </p>
                          )}
                        </div>

                        <button
                          onClick={handleUpload}
                          disabled={isUploading || !selectedFile}
                          className="w-full px-6 py-2 bg-orange-primary hover:bg-red-fire text-white-pure rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {isUploading ? (
                            <>
                              <FiLoader className="animate-spin" />
                              Subiendo...
                            </>
                          ) : (
                            <>
                              <FiUpload />
                              Subir Comprobante
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

