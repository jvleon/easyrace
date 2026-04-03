import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { supabase } from '../../lib/supabase'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface ChatWindowProps {
  onClose: () => void
  onMinimize: () => void
  isVisible: boolean
  eventSlug?: string
  sessionId: string
}

const WELCOME_MESSAGE = '¡Hola! Soy **Crono**, el asistente virtual de EasyRace. Estoy aquí para ayudarte a resolver tus dudas sobre EasyRace y sus eventos.'

export default function ChatWindow({ onClose, onMinimize, isVisible, eventSlug, sessionId }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([
    { id: 'welcome', role: 'assistant', content: WELCOME_MESSAGE },
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [acceptedTerms, setAcceptedTerms] = useState(() =>
    typeof window !== 'undefined' && sessionStorage.getItem('easyrace_chat_terms') === '1'
  )
  const [termsChecked, setTermsChecked] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (acceptedTerms) {
      inputRef.current?.focus()
    }
  }, [acceptedTerms])

  const handleAcceptTerms = () => {
    if (!termsChecked) return
    setAcceptedTerms(true)
    sessionStorage.setItem('easyrace_chat_terms', '1')
  }

  const sendMessage = async () => {
    const trimmedInput = input.trim()
    if (!trimmedInput || sending) return

    setError(null)

    // Agregar mensaje del usuario al UI inmediatamente
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmedInput,
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setSending(true)

    try {
      const { data, error: fnError } = await supabase.functions.invoke('chat-agent', {
        body: {
          conversation_id: conversationId,
          session_id: sessionId,
          event_slug: eventSlug,
          message: trimmedInput,
          accepted_terms: !conversationId ? true : undefined,
        },
      })

      if (fnError) {
        throw new Error(fnError.message || 'Error al enviar mensaje')
      }

      if (data?.error) {
        throw new Error(data.error)
      }

      // Guardar conversation_id para mensajes siguientes
      if (data?.conversation_id && !conversationId) {
        setConversationId(data.conversation_id)
      }

      // Agregar respuesta del asistente
      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data?.message || 'Sin respuesta',
      }
      setMessages(prev => [...prev, assistantMsg])
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido'
      setError(errorMsg)
      // Remover el mensaje del usuario si fallo
      setMessages(prev => prev.filter(m => m.id !== userMsg.id))
      setInput(trimmedInput) // Restaurar input
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Pantalla de aceptar terminos
  if (!acceptedTerms) {
    return (
      <div className={`fixed bottom-6 right-6 z-40 w-[380px] max-w-[calc(100vw-2rem)] bg-gray-900 rounded-2xl shadow-2xl border border-gray-700 flex flex-col overflow-hidden max-[500px]:inset-2 max-[500px]:w-auto max-[500px]:rounded-xl ${!isVisible ? 'hidden' : ''}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            <span className="text-white font-medium text-sm">Asistente EasyRace</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onMinimize}
              className="text-gray-400 hover:text-white transition-colors p-1"
              aria-label="Minimizar chat"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                <path d="M5 12h14" />
              </svg>
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors p-1"
              aria-label="Cerrar chat"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Consent content */}
        <div className="p-5 flex flex-col gap-4">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-orange-primary/20 flex items-center justify-center mx-auto mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6 text-orange-primary">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <h3 className="text-white font-semibold text-lg">Asistente Virtual</h3>
            <p className="text-gray-400 text-sm mt-1">
              Soy un asistente con inteligencia artificial que puede ayudarte con preguntas sobre EasyRace y sus eventos.
            </p>
          </div>

          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={termsChecked}
              onChange={(e) => setTermsChecked(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-gray-600 text-orange-primary focus:ring-orange-primary bg-gray-800"
            />
            <span className="text-gray-300 text-sm leading-relaxed">
              Acepto los{' '}
              <a
                href="/terminos-y-condiciones"
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange-primary hover:text-orange-400 underline"
              >
                Términos y Condiciones
              </a>
              {' '}y el{' '}
              <a
                href="/aviso-de-privacidad"
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange-primary hover:text-orange-400 underline"
              >
                Aviso de Privacidad
              </a>
              {' '}para usar el chat.
            </span>
          </label>

          <button
            onClick={handleAcceptTerms}
            disabled={!termsChecked}
            className="w-full py-2.5 rounded-lg font-medium text-sm transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed bg-orange-primary hover:bg-red-fire text-white"
          >
            Iniciar conversación
          </button>
        </div>
      </div>
    )
  }

  // Chat activo
  return (
    <div className={`fixed bottom-6 right-6 z-40 w-[380px] max-w-[calc(100vw-2rem)] h-[520px] max-h-[calc(100vh-4rem)] bg-gray-900 rounded-2xl shadow-2xl border border-gray-700 flex flex-col overflow-hidden max-[500px]:inset-2 max-[500px]:w-auto max-[500px]:h-auto max-[500px]:rounded-xl ${!isVisible ? 'hidden' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400" />
          <span className="text-white font-medium text-sm">Asistente EasyRace</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onMinimize}
            className="text-gray-400 hover:text-white transition-colors p-1"
            aria-label="Minimizar chat"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <path d="M5 12h14" />
            </svg>
          </button>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1"
            aria-label="Cerrar chat"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'user' ? (
              <div className="max-w-[80%] rounded-xl rounded-br-sm px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words bg-orange-primary text-white">
                {msg.content}
              </div>
            ) : (
              <div className="max-w-[80%] rounded-xl rounded-bl-sm px-3.5 py-2.5 text-sm leading-relaxed break-words bg-gray-800 text-gray-200 chat-markdown">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            )}
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="bg-gray-800 text-gray-400 rounded-xl rounded-bl-sm px-3.5 py-2.5 text-sm">
              <span className="inline-flex gap-1">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="text-center">
            <p className="text-red-400 text-xs">{error}</p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-700 shrink-0">
        {input.length > 0 && (
          <div className={`text-right text-xs mb-1 ${input.length >= 450 ? 'text-red-400' : input.length >= 400 ? 'text-yellow-400' : 'text-gray-500'}`}>
            {input.length}/450
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu pregunta..."
            maxLength={450}
            disabled={sending}
            className="flex-1 bg-gray-800 text-white text-sm rounded-lg px-3.5 py-2.5 border border-gray-700 focus:border-orange-primary focus:outline-none placeholder-gray-500 disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            className="shrink-0 w-10 h-10 rounded-lg bg-orange-primary hover:bg-red-fire disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
            aria-label="Enviar mensaje"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-white">
              <path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
