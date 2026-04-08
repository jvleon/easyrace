import { useState, useEffect, useRef } from 'react'

interface ChatBubbleProps {
  onClick: () => void
  isOpen: boolean
  showHint?: boolean
  hasEventNav?: boolean
}

const SCROLL_THRESHOLD = 300 // px to scroll before showing hint
const IDLE_DELAY = 5000 // ms before dimming

export default function ChatBubble({ onClick, isOpen, showHint, hasEventNav }: ChatBubbleProps) {
  const [hasScrolled, setHasScrolled] = useState(false)
  const [isIdle, setIsIdle] = useState(true)
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Track scroll to show hint only after scrolling
  useEffect(() => {
    if (!showHint || hasScrolled) return

    const handleScroll = () => {
      if (window.scrollY > SCROLL_THRESHOLD) {
        setHasScrolled(true)
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [showHint, hasScrolled])

  // Idle opacity: start idle, wake on hover/touch, dim again after delay
  const resetIdleTimer = () => {
    setIsIdle(false)
    if (idleTimer.current) clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => setIsIdle(true), IDLE_DELAY)
  }

  useEffect(() => {
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current)
    }
  }, [])

  if (isOpen) return null

  const showHintText = showHint && hasScrolled

  return (
    <div
      className={`fixed right-4 z-40 flex flex-col items-end gap-2 transition-opacity duration-500 ${
        hasEventNav ? 'bottom-20 sm:bottom-6' : 'bottom-6'
      } ${isIdle && !showHintText ? 'opacity-50' : 'opacity-100'}`}
      onMouseEnter={resetIdleTimer}
      onTouchStart={resetIdleTimer}
    >
      {showHintText && (
        <button
          onClick={onClick}
          className="bg-gray-900 text-gray-200 text-sm px-4 py-2 rounded-xl shadow-lg border border-gray-700 animate-fade-in cursor-pointer hover:bg-gray-800 transition-colors max-w-[220px] text-right leading-snug"
        >
          <span className="sm:hidden">¿Necesitas ayuda?</span>
          <span className="hidden sm:inline">¿Necesitas ayuda? Haz clic aquí para conversar</span>
        </button>
      )}
      <button
        onClick={onClick}
        className="w-14 h-14 rounded-full bg-orange-primary hover:bg-red-fire transition-colors duration-200 shadow-lg hover:shadow-xl flex items-center justify-center group relative"
        aria-label="Abrir chat de ayuda"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-6 h-6 text-white group-hover:scale-110 transition-transform"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <span className="absolute inset-0 rounded-full bg-orange-primary animate-ping opacity-20" />
      </button>
    </div>
  )
}
