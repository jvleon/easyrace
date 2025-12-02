import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { parseRegistrationConfig, type ParsedField } from '../utils/registrationConfigParser';
import { uploadIdPhotoToCloudflare } from '../utils/cloudflare';
import { FiX, FiCheckCircle, FiAlertCircle, FiLoader } from 'react-icons/fi';

interface Category {
  id: string;
  name: string;
  price: number | null;
  gender: string | null; // 'male', 'female', or null (mixed)
}

interface Club {
  id: string;
  name: string;
}

interface EventPricing {
  general_price: number | null;
  currency: string;
  categories: Category[];
}

interface RegistrationModalProps {
  eventId: string;
  eventSlug: string; // Slug del evento para Cloudflare
  registrationConfig: any;
  isOpen: boolean;
  onClose: () => void;
  eventPricing?: EventPricing | null;
}

export default function RegistrationModal({
  eventId,
  eventSlug,
  registrationConfig,
  isOpen,
  onClose,
  eventPricing,
}: RegistrationModalProps) {
  const [fields, setFields] = useState<ParsedField[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]); // Todas las categorías sin filtrar
  const [clubs, setClubs] = useState<Club[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [clubSelectionMode, setClubSelectionMode] = useState<'select' | 'manual'>('select');
  const [selectedClubId, setSelectedClubId] = useState<string>('');
  const [manualClubName, setManualClubName] = useState<string>('');
  const [selectedGender, setSelectedGender] = useState<string>(''); // 'male' o 'female'
  const [acceptedTerms, setAcceptedTerms] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      const parsedFields = parseRegistrationConfig(registrationConfig);
      // Ordenar campos: obligatorios primero, opcionales después
      const sortedFields = [
        ...parsedFields.filter((f) => f.required),
        ...parsedFields.filter((f) => !f.required),
      ];
      setFields(sortedFields);
      setFormData({});
      setErrors({});
      setSuccess(false);
      setSuccessMessage('');
      setSubmitError(null);
      setClubSelectionMode('select');
      setSelectedClubId('');
      setManualClubName('');
      setSelectedGender('');
      setAcceptedTerms(false);
      loadCategories();
      loadClubs();
    }
  }, [isOpen, registrationConfig, eventId]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, price, gender')
        .eq('event_id', eventId)
        .order('name');

      if (error) throw error;
      const loadedCategories = (data || []) as Category[];
      setAllCategories(loadedCategories);
      // Inicialmente no hay categorías visibles hasta que se seleccione un género
      setCategories([]);
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar categorías según el género seleccionado
  useEffect(() => {
    if (!selectedGender) {
      setCategories([]);
      return;
    }

    // Mostrar categorías del género seleccionado + categorías mixtas (gender null)
    const filtered = allCategories.filter(
      (cat) => cat.gender === selectedGender || cat.gender === null
    );
    setCategories(filtered);
  }, [selectedGender, allCategories]);

  const loadClubs = async () => {
    try {
      const { data, error } = await supabase
        .from('clubs')
        .select('id, name')
        .order('name');

      if (error) {
        console.error('Error loading clubs:', error);
        return;
      }
      setClubs(data || []);
    } catch (error) {
      console.error('Error loading clubs:', error);
    }
  };

  const handleChange = (name: string, value: any) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validatePhone = (phone: string): boolean => {
    // Remover espacios, guiones y paréntesis
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    // Validar que sean exactamente 10 dígitos
    return /^\d{10}$/.test(cleaned);
  };

  const formatPhone = (phone: string): string => {
    // Remover todo excepto dígitos
    return phone.replace(/\D/g, '');
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validar género (siempre requerido)
    if (!selectedGender) {
      newErrors.gender = 'El género es requerido';
    }

    // Validar categoría (siempre requerida después de seleccionar género)
    if (selectedGender && !formData.category_id) {
      newErrors.category_id = 'La categoría es requerida';
    }

    fields.forEach((field) => {
      // Saltar validación de gender y category_id ya que se validan arriba
      if (field.name === 'gender' || field.name === 'category_id') {
        return;
      }

      if (field.required) {
        const value = formData[field.name];
        if (!value || (typeof value === 'string' && value.trim() === '')) {
          newErrors[field.name] = `${field.label} es requerido`;
        }
      }

      if (field.type === 'email' && formData[field.name]) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData[field.name])) {
          newErrors[field.name] = 'Correo electrónico inválido';
        }
      }

      // Validar teléfonos de 10 dígitos
      if ((field.type === 'tel' || field.name === 'phone' || field.name === 'emergency_contact_phone') && formData[field.name]) {
        const phoneValue = formData[field.name];
        if (!validatePhone(phoneValue)) {
          newErrors[field.name] = 'El teléfono debe tener exactamente 10 dígitos';
        }
      }
    });

    // Validar club
    if (fields.some((f) => f.name === 'club_id' || f.name === 'club')) {
      if (clubSelectionMode === 'select' && !selectedClubId) {
        // Solo validar si es requerido
        const clubField = fields.find((f) => f.name === 'club_id' || f.name === 'club');
        if (clubField?.required) {
          newErrors.club = 'Debes seleccionar un equipo o escribir uno manualmente';
        }
      } else if (clubSelectionMode === 'manual' && !manualClubName.trim()) {
        const clubField = fields.find((f) => f.name === 'club_id' || f.name === 'club');
        if (clubField?.required) {
          newErrors.club = 'Debes escribir el nombre del equipo';
        }
      }
    }

    // Validar términos y condiciones
    if (!acceptedTerms) {
      newErrors.terms = 'Debes aceptar los términos y condiciones para registrarte';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFileChange = async (name: string, file: File | null) => {
    if (!file) {
      handleChange(name, null);
      return;
    }

    // Validar tamaño antes de intentar subir (2MB máximo)
    const maxSize = 2 * 1024 * 1024; // 2 MB
    if (file.size > maxSize) {
      setErrors((prev) => ({
        ...prev,
        [name]: 'La imagen debe ser menor a 2MB',
      }));
      return;
    }

    try {
      setLoading(true);
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });

      // Subir a Cloudflare Images
      const imageUrl = await uploadIdPhotoToCloudflare(file, eventSlug, eventId);
      
      // Guardar la URL en el formulario
      handleChange(name, imageUrl);
    } catch (error: any) {
      console.error('Error uploading file to Cloudflare:', error);
      setErrors((prev) => ({
        ...prev,
        [name]: error.message || 'Error al subir la imagen. Por favor, intenta de nuevo.',
      }));
    } finally {
      setLoading(false);
    }
  };

  const checkEventIsFree = (): boolean => {
    if (!eventPricing) return false;
    
    // Verificar precio general
    if (eventPricing.general_price !== null && eventPricing.general_price > 0) {
      return false;
    }
    
    // Verificar precios de categorías
    // Si no hay categorías, considerar gratis si el precio general es 0 o null
    if (!eventPricing.categories || eventPricing.categories.length === 0) {
      return eventPricing.general_price === null || eventPricing.general_price === 0;
    }
    
    // Verificar que todas las categorías sean gratis (precio null o 0)
    const hasPaidCategories = eventPricing.categories.some(
      (cat) => cat.price !== null && cat.price > 0
    );
    
    return !hasPaidCategories;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError(null);

      // Preparar datos del competidor
      const competitorData: Record<string, any> = {
        event_id: eventId,
        gender: selectedGender, // Asegurar que el género se guarde
        category_id: formData.category_id, // Asegurar que la categoría se guarde
      };

      // Agregar datos del formulario
      Object.keys(formData).forEach((key) => {
        if (formData[key] !== null && formData[key] !== undefined && formData[key] !== '') {
          competitorData[key] = formData[key];
        }
      });

      // Manejar club/equipo
      if (clubSelectionMode === 'select' && selectedClubId) {
        if (selectedClubId === 'independent') {
          competitorData.club = 'Independiente';
          competitorData.club_id = null;
        } else {
          competitorData.club_id = selectedClubId;
        }
      } else if (clubSelectionMode === 'manual' && manualClubName.trim()) {
        competitorData.club = manualClubName.trim();
        competitorData.club_id = null;
      }

      // Formatear teléfonos (solo dígitos)
      if (competitorData.phone) {
        competitorData.phone = formatPhone(competitorData.phone);
      }
      if (competitorData.emergency_contact_phone) {
        competitorData.emergency_contact_phone = formatPhone(competitorData.emergency_contact_phone);
      }

      const { error } = await supabase.from('competitors').insert([competitorData]);

      if (error) throw error;

      // Verificar si el evento es gratis
      const isFree = checkEventIsFree();
      
      if (isFree) {
        setSuccessMessage('¡Registro exitoso! Te has registrado correctamente en el evento.');
      } else {
        setSuccessMessage(
          '¡Registro exitoso! Recuerda realizar tu pago y enviar el comprobante al organizador para confirmar tu participación.'
        );
      }

      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setSuccessMessage('');
        setFormData({});
        setSelectedClubId('');
        setManualClubName('');
      }, 5000);
    } catch (error: any) {
      console.error('Error submitting registration:', error);
      setSubmitError(error.message || 'Error al registrar. Por favor, intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // Separar campos obligatorios y opcionales
  const requiredFields = fields.filter((f) => f.required);
  const optionalFields = fields.filter((f) => !f.required);
  const hasClubField = fields.some((f) => f.name === 'club_id' || f.name === 'club');
  const clubField = fields.find((f) => f.name === 'club_id' || f.name === 'club');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black-asphalt/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="bg-black-asphalt border border-white-pure/20 rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-black-asphalt border-b border-white-pure/20 p-6 flex justify-between items-center">
          <h2 id="modal-title" className="text-2xl font-bold text-white-pure">Registro de Competidor</h2>
          <button
            onClick={onClose}
            className="text-white-pure/70 hover:text-white-pure transition-colors"
            aria-label="Cerrar"
          >
            <FiX size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {success ? (
            <div className="text-center py-8">
              <FiCheckCircle className="mx-auto text-green-500 mb-4" size={48} />
              <p className="text-white-pure text-lg font-semibold mb-2">
                {successMessage || '¡Registro exitoso!'}
              </p>
            </div>
          ) : (
            <>
              {submitError && (
                <div className="mb-6 p-4 bg-red-fire/20 border border-red-fire rounded-lg flex items-start">
                  <FiAlertCircle className="text-red-fire mr-3 mt-0.5" size={20} />
                  <p className="text-white-pure text-sm">{submitError}</p>
                </div>
              )}

              <div className="space-y-4">
                {/* Selector de género - siempre visible al inicio */}
                <div className="space-y-2">
                  <label className="block text-white-pure text-sm font-medium mb-2">
                    Género <span className="text-red-fire ml-1">*</span>
                  </label>
                  <select
                    value={selectedGender}
                    onChange={(e) => {
                      setSelectedGender(e.target.value);
                      handleChange('gender', e.target.value);
                      // Limpiar categoría seleccionada cuando cambia el género
                      handleChange('category_id', '');
                    }}
                    required
                    className="w-full px-4 py-2 bg-black-asphalt border border-white-pure/20 rounded-lg text-white-pure focus:outline-none focus:ring-2 focus:ring-orange-primary focus:border-transparent"
                    style={{ backgroundColor: '#212121', color: '#FFF' }}
                  >
                    <option value="" style={{ backgroundColor: '#212121', color: '#FFF' }}>Selecciona tu género</option>
                    <option value="male" style={{ backgroundColor: '#212121', color: '#FFF' }}>Masculino</option>
                    <option value="female" style={{ backgroundColor: '#212121', color: '#FFF' }}>Femenino</option>
                  </select>
                  {errors.gender && (
                    <p className="mt-1 text-sm text-red-fire">{errors.gender}</p>
                  )}
                </div>

                {/* Selector de categoría - solo visible después de seleccionar género */}
                {selectedGender && (
                  <div className="space-y-2">
                    <label className="block text-white-pure text-sm font-medium mb-2">
                      Categoría <span className="text-red-fire ml-1">*</span>
                    </label>
                    <select
                      value={formData.category_id || ''}
                      onChange={(e) => handleChange('category_id', e.target.value)}
                      required
                      className="w-full px-4 py-2 bg-black-asphalt border border-white-pure/20 rounded-lg text-white-pure focus:outline-none focus:ring-2 focus:ring-orange-primary focus:border-transparent"
                      style={{ backgroundColor: '#212121', color: '#FFF' }}
                    >
                      <option value="" style={{ backgroundColor: '#212121', color: '#FFF' }}>Selecciona una categoría</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id} style={{ backgroundColor: '#212121', color: '#FFF' }}>
                          {cat.name} {cat.price !== null && cat.price > 0 ? `- $${cat.price} ${eventPricing?.currency || 'MXN'}` : ''}
                        </option>
                      ))}
                    </select>
                    {errors.category_id && (
                      <p className="mt-1 text-sm text-red-fire">{errors.category_id}</p>
                    )}
                    {categories.length === 0 && selectedGender && (
                      <p className="mt-1 text-sm text-white-pure/70">No hay categorías disponibles para este género</p>
                    )}
                  </div>
                )}

                {/* Campos obligatorios */}
                {requiredFields.length > 0 && (
                  <>
                    {requiredFields
                      .filter((field) => field.name !== 'gender' && field.name !== 'category_id') // Excluir gender y category_id ya que se manejan arriba
                      .map((field) => {
                      if (field.name === 'club_id' || field.name === 'club') {
                        return (
                          <div key={field.name} className="space-y-2">
                            <label className="block text-white-pure text-sm font-medium mb-2">
                              {field.label}
                              {field.required && <span className="text-red-fire ml-1">*</span>}
                            </label>
                            
                            <div className="flex gap-2 mb-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setClubSelectionMode('select');
                                  setManualClubName('');
                                  handleChange('club', '');
                                }}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                  clubSelectionMode === 'select'
                                    ? 'bg-orange-primary text-white-pure'
                                    : 'bg-white-pure/10 text-white-pure/70 hover:bg-white-pure/20'
                                }`}
                              >
                                Seleccionar equipo
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setClubSelectionMode('manual');
                                  setSelectedClubId('');
                                  handleChange('club_id', '');
                                }}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                  clubSelectionMode === 'manual'
                                    ? 'bg-orange-primary text-white-pure'
                                    : 'bg-white-pure/10 text-white-pure/70 hover:bg-white-pure/20'
                                }`}
                              >
                                Escribir manualmente
                              </button>
                            </div>

                            {clubSelectionMode === 'select' ? (
                              <select
                                value={selectedClubId}
                                onChange={(e) => {
                                  setSelectedClubId(e.target.value);
                                  handleChange('club_id', e.target.value);
                                  handleChange('club', '');
                                }}
                                required={field.required}
                                className="w-full px-4 py-2 bg-black-asphalt border border-white-pure/20 rounded-lg text-white-pure focus:outline-none focus:ring-2 focus:ring-orange-primary focus:border-transparent"
                                style={{ backgroundColor: '#212121', color: '#FFF' }}
                              >
                                <option value="" style={{ backgroundColor: '#212121', color: '#FFF' }}>Selecciona un equipo</option>
                                <option value="independent" style={{ backgroundColor: '#212121', color: '#FFF' }}>Independiente</option>
                                {clubs.map((club) => (
                                  <option key={club.id} value={club.id} style={{ backgroundColor: '#212121', color: '#FFF' }}>
                                    {club.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type="text"
                                value={manualClubName}
                                onChange={(e) => {
                                  setManualClubName(e.target.value);
                                  handleChange('club', e.target.value);
                                  handleChange('club_id', '');
                                }}
                                placeholder="Escribe el nombre del equipo"
                                required={field.required}
                                className="w-full px-4 py-2 bg-white-pure/10 border border-white-pure/20 rounded-lg text-white-pure focus:outline-none focus:ring-2 focus:ring-orange-primary focus:border-transparent"
                              />
                            )}

                            {errors.club && (
                              <p className="mt-1 text-sm text-red-fire">{errors.club}</p>
                            )}
                          </div>
                        );
                      }

                      return renderField(field);
                    })}
                  </>
                )}

                {/* Campos opcionales */}
                {optionalFields
                  .filter((field) => field.name !== 'gender' && field.name !== 'category_id') // Excluir gender y category_id
                  .map((field) => {
                  if (field.name === 'club_id' || field.name === 'club') {
                    return (
                      <div key={field.name} className="space-y-2">
                        <label className="block text-white-pure text-sm font-medium mb-2">
                          {field.label}
                        </label>
                        
                        <div className="flex gap-2 mb-2">
                          <button
                            type="button"
                            onClick={() => {
                              setClubSelectionMode('select');
                              setManualClubName('');
                              handleChange('club', '');
                            }}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                              clubSelectionMode === 'select'
                                ? 'bg-orange-primary text-white-pure'
                                : 'bg-white-pure/10 text-white-pure/70 hover:bg-white-pure/20'
                            }`}
                          >
                            Seleccionar equipo
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setClubSelectionMode('manual');
                              setSelectedClubId('');
                              handleChange('club_id', '');
                            }}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                              clubSelectionMode === 'manual'
                                ? 'bg-orange-primary text-white-pure'
                                : 'bg-white-pure/10 text-white-pure/70 hover:bg-white-pure/20'
                            }`}
                          >
                            Escribir manualmente
                          </button>
                        </div>

                        {clubSelectionMode === 'select' ? (
                          <select
                            value={selectedClubId}
                            onChange={(e) => {
                              setSelectedClubId(e.target.value);
                              handleChange('club_id', e.target.value);
                              handleChange('club', '');
                            }}
                            className="w-full px-4 py-2 bg-black-asphalt border border-white-pure/20 rounded-lg text-white-pure focus:outline-none focus:ring-2 focus:ring-orange-primary focus:border-transparent"
                            style={{ backgroundColor: '#212121', color: '#FFF' }}
                          >
                            <option value="" style={{ backgroundColor: '#212121', color: '#FFF' }}>Selecciona un equipo (opcional)</option>
                            <option value="independent" style={{ backgroundColor: '#212121', color: '#FFF' }}>Independiente</option>
                            {clubs.map((club) => (
                              <option key={club.id} value={club.id} style={{ backgroundColor: '#212121', color: '#FFF' }}>
                                {club.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={manualClubName}
                            onChange={(e) => {
                              setManualClubName(e.target.value);
                              handleChange('club', e.target.value);
                              handleChange('club_id', '');
                            }}
                            placeholder="Escribe el nombre del equipo"
                            className="w-full px-4 py-2 bg-white-pure/10 border border-white-pure/20 rounded-lg text-white-pure focus:outline-none focus:ring-2 focus:ring-orange-primary focus:border-transparent"
                          />
                        )}
                      </div>
                    );
                  }

                  return renderField(field);
                })}
              </div>

              {/* Checkbox de Términos y Condiciones */}
              <div className="mt-6 mb-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => {
                      setAcceptedTerms(e.target.checked);
                      if (errors.terms) {
                        setErrors((prev) => {
                          const newErrors = { ...prev };
                          delete newErrors.terms;
                          return newErrors;
                        });
                      }
                    }}
                    className="mt-1 w-5 h-5 text-orange-primary bg-black-asphalt border-white-pure/20 rounded focus:ring-orange-primary focus:ring-2"
                    required
                  />
                  <span className="text-white-pure/90 text-sm">
                    Acepto los{' '}
                    <a
                      href="/terminos-y-condiciones"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-orange-primary hover:text-red-fire underline"
                    >
                      términos y condiciones
                    </a>
                    {' '}y el{' '}
                    <a
                      href="/aviso-de-privacidad"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-orange-primary hover:text-red-fire underline"
                    >
                      aviso de privacidad
                    </a>
                    <span className="text-red-fire ml-1">*</span>
                  </span>
                </label>
                {errors.terms && (
                  <p className="mt-1 text-sm text-red-fire">{errors.terms}</p>
                )}
              </div>

              <div className="mt-6 flex gap-4 justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2 border border-white-pure/20 rounded-lg text-white-pure hover:bg-white-pure/10 transition-colors"
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting || loading || !acceptedTerms}
                  className="px-6 py-2 bg-orange-primary hover:bg-red-fire text-white-pure rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <FiLoader className="animate-spin" />
                      Registrando...
                    </>
                  ) : (
                    'Registrarse'
                  )}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );

  function renderField(field: ParsedField) {
    // No renderizar gender y category_id aquí, se manejan arriba
    if (field.name === 'gender' || field.name === 'category_id') {
      return null;
    }

    return (
      <div key={field.name}>
        <label
          htmlFor={field.name}
          className="block text-white-pure text-sm font-medium mb-2"
        >
          {field.label}
          {field.required && <span className="text-red-fire ml-1">*</span>}
        </label>

        {field.type === 'select' && field.name === 'gender' ? (
          <select
            id={field.name}
            name={field.name}
            value={formData[field.name] || ''}
            onChange={(e) => handleChange(field.name, e.target.value)}
            required={field.required}
            className="w-full px-4 py-2 bg-black-asphalt border border-white-pure/20 rounded-lg text-white-pure focus:outline-none focus:ring-2 focus:ring-orange-primary focus:border-transparent"
            style={{ backgroundColor: '#212121', color: '#FFF' }}
          >
            <option value="" style={{ backgroundColor: '#212121', color: '#FFF' }}>Selecciona</option>
            {field.options?.map((opt) => (
              <option key={opt.value} value={opt.value} style={{ backgroundColor: '#212121', color: '#FFF' }}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : field.type === 'select' && field.name === 'blood_type' ? (
          <select
            id={field.name}
            name={field.name}
            value={formData[field.name] || ''}
            onChange={(e) => handleChange(field.name, e.target.value)}
            required={field.required}
            className="w-full px-4 py-2 bg-black-asphalt border border-white-pure/20 rounded-lg text-white-pure focus:outline-none focus:ring-2 focus:ring-orange-primary focus:border-transparent"
            style={{ backgroundColor: '#212121', color: '#FFF' }}
          >
            <option value="" style={{ backgroundColor: '#212121', color: '#FFF' }}>Selecciona tipo de sangre</option>
            {field.options?.map((opt) => (
              <option key={opt.value} value={opt.value} style={{ backgroundColor: '#212121', color: '#FFF' }}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : field.type === 'textarea' ? (
          <textarea
            id={field.name}
            name={field.name}
            value={formData[field.name] || ''}
            onChange={(e) => handleChange(field.name, e.target.value)}
            required={field.required}
            rows={4}
            className="w-full px-4 py-2 bg-white-pure/10 border border-white-pure/20 rounded-lg text-white-pure focus:outline-none focus:ring-2 focus:ring-orange-primary focus:border-transparent resize-y"
          />
        ) : field.type === 'file' ? (
          <input
            type="file"
            id={field.name}
            name={field.name}
            accept="image/*"
            onChange={(e) => handleFileChange(field.name, e.target.files?.[0] || null)}
            required={field.required}
            className="w-full px-4 py-2 bg-white-pure/10 border border-white-pure/20 rounded-lg text-white-pure file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-orange-primary file:text-white-pure hover:file:bg-red-fire focus:outline-none focus:ring-2 focus:ring-orange-primary"
            // Restricción de tamaño: máximo 2MB
            data-max-size={2 * 1024 * 1024}
          />
        ) : (
          <input
            type={field.type}
            id={field.name}
            name={field.name}
            value={formData[field.name] || ''}
            onChange={(e) => {
              // Formatear teléfonos mientras se escribe
              if (field.type === 'tel' || field.name === 'phone' || field.name === 'emergency_contact_phone') {
                const value = e.target.value.replace(/\D/g, '');
                if (value.length <= 10) {
                  handleChange(field.name, value);
                }
              } else {
                handleChange(field.name, e.target.value);
              }
            }}
            maxLength={field.type === 'tel' ? 10 : undefined}
            required={field.required}
            className="w-full px-4 py-2 bg-white-pure/10 border border-white-pure/20 rounded-lg text-white-pure focus:outline-none focus:ring-2 focus:ring-orange-primary focus:border-transparent"
          />
        )}

        {errors[field.name] && (
          <p className="mt-1 text-sm text-red-fire">{errors[field.name]}</p>
        )}
      </div>
    );
  }
}
