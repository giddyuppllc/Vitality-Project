import { cn } from '@/lib/utils'
import { type InputHTMLAttributes, forwardRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, type, ...props }, ref) => {
    // When the field is a password, render an inline show/hide toggle that
    // flips the underlying input type between "password" and "text" without
    // touching any value/validation/submit logic.
    const isPassword = type === 'password'
    const [revealed, setRevealed] = useState(false)
    const effectiveType = isPassword ? (revealed ? 'text' : 'password') : type

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-sm font-medium text-white/70">{label}</label>
        )}
        <div className="relative">
          <input
            ref={ref}
            type={effectiveType}
            className={cn(
              'w-full px-4 py-2.5 rounded-xl',
              'bg-dark-700 border border-white/10 text-white',
              'placeholder:text-white/30',
              'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent',
              'transition-all duration-200',
              // leave room for the toggle button so long values don't slide under it
              isPassword && 'pr-11',
              error && 'border-red-500 focus:ring-red-500',
              className
            )}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              tabIndex={-1}
              aria-label={revealed ? 'Hide password' : 'Show password'}
              aria-pressed={revealed}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-white/40 hover:text-white/80 transition-colors focus:outline-none focus-visible:text-white"
            >
              {revealed ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        {!error && hint && <p className="text-xs text-white/40">{hint}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'
