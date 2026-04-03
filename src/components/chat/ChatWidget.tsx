import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import ChatBubble from './ChatBubble'
import ChatWindow from './ChatWindow'

interface ChatWidgetProps {
  eventSlug?: string
}

/**
 * Widget principal del chatbot.
 * - En paginas de evento: pasa eventSlug y verifica modules_config.chatbot
 * - En paginas generales: sin eventSlug, siempre visible
 */
export default function ChatWidget({ eventSlug }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [isEnabled, setIsEnabled] = useState<boolean | null>(null)
  const [sessionId, setSessionId] = useState('')
  const [hasAcceptedTerms] = useState(() =>
    typeof window !== 'undefined' && sessionStorage.getItem('easyrace_chat_terms') === '1'
  )

  // Generar o recuperar session_id de localStorage
  useEffect(() => {
    const STORAGE_KEY = 'easyrace_chat_session_id'
    let id = localStorage.getItem(STORAGE_KEY)
    if (!id) {
      id = `chat_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      localStorage.setItem(STORAGE_KEY, id)
    }
    setSessionId(id)
  }, [])

  // Verificar si el chatbot esta habilitado para el evento
  useEffect(() => {
    if (!eventSlug) {
      // En paginas generales siempre habilitado
      setIsEnabled(true)
      return
    }

    // Obtener el slug real de la URL (patron de EventDetail)
    let currentSlug = eventSlug
    if (typeof window !== 'undefined' && eventSlug === 'dynamic') {
      const pathParts = window.location.pathname.split('/eventos/')
      if (pathParts.length > 1) {
        currentSlug = pathParts[1].split('/')[0]?.replace(/\/$/, '').trim() || eventSlug
      }
    }

    // Consultar modules_config del evento
    async function checkEnabled() {
      try {
        const { data, error } = await supabase
          .from('events')
          .select('modules_config')
          .eq('slug', currentSlug)
          .in('status', ['published', 'completed'])
          .single()

        if (error || !data) {
          setIsEnabled(false)
          return
        }

        const config = data.modules_config as Record<string, boolean> | null
        // Default: deshabilitado para eventos (debe ser habilitado explicitamente)
        setIsEnabled(config?.chatbot === true)
      } catch {
        setIsEnabled(false)
      }
    }

    checkEnabled()
  }, [eventSlug])

  // No renderizar hasta saber si esta habilitado
  if (isEnabled === null || !isEnabled || !sessionId) {
    return null
  }

  // Resolver slug real para pasar al chat
  let resolvedSlug = eventSlug
  if (typeof window !== 'undefined' && eventSlug === 'dynamic') {
    const pathParts = window.location.pathname.split('/eventos/')
    if (pathParts.length > 1) {
      resolvedSlug = pathParts[1].split('/')[0]?.replace(/\/$/, '').trim() || undefined
    }
  }

  const handleOpen = () => {
    setIsMounted(true)
    setIsOpen(true)
  }

  const handleMinimize = () => {
    setIsOpen(false)
  }

  const handleClose = () => {
    setIsOpen(false)
    setIsMounted(false)
  }

  return (
    <>
      <ChatBubble
        onClick={handleOpen}
        isOpen={isOpen}
        showHint={!hasAcceptedTerms && !isMounted}
      />
      {isMounted && (
        <ChatWindow
          onClose={handleClose}
          onMinimize={handleMinimize}
          isVisible={isOpen}
          eventSlug={resolvedSlug}
          sessionId={sessionId}
        />
      )}
    </>
  )
}
