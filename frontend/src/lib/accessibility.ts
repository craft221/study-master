/**
 * Accessibility Utilities - ARIA Helpers
 * Complete ARIA implementation for Study Master
 */

// ============================================
// ARIA ANNOUNCER (Screen Reader Announcements)
// ============================================

/**
 * Announce a message to screen readers
 * @param message - Message to announce
 * @param priority - 'polite' (default) or 'assertive'
 */
export function announce(message: string, priority: 'polite' | 'assertive' = 'polite') {
  // Create or get existing announcer
  let announcer = document.getElementById('aria-live-announcer')

  if (!announcer) {
    announcer = document.createElement('div')
    announcer.id = 'aria-live-announcer'
    announcer.setAttribute('role', 'status')
    announcer.setAttribute('aria-live', priority)
    announcer.setAttribute('aria-atomic', 'true')
    announcer.className = 'sr-only' // Visually hidden
    document.body.appendChild(announcer)
  }

  // Update aria-live if priority changed
  if (announcer.getAttribute('aria-live') !== priority) {
    announcer.setAttribute('aria-live', priority)
  }

  // Clear and announce
  announcer.textContent = ''
  setTimeout(() => {
    announcer!.textContent = message
  }, 100)
}

// ============================================
// ARIA LABEL GENERATORS
// ============================================

/**
 * Generate accessible label for a card
 */
export function generateCardLabel(params: {
  title: string
  description?: string
  status?: string
  count?: number
}) {
  const parts = [params.title]

  if (params.description) {
    parts.push(params.description)
  }

  if (params.status) {
    parts.push(`Status: ${params.status}`)
  }

  if (params.count !== undefined) {
    parts.push(`${params.count} items`)
  }

  return parts.join(', ')
}

/**
 * Generate accessible label for a button
 */
export function generateButtonLabel(params: {
  action: string
  target?: string
  context?: string
}) {
  const parts = [params.action]

  if (params.target) {
    parts.push(params.target)
  }

  if (params.context) {
    parts.push(`(${params.context})`)
  }

  return parts.join(' ')
}

/**
 * Generate accessible label for form field
 */
export function generateFieldLabel(params: {
  label: string
  required?: boolean
  hint?: string
}) {
  const parts = [params.label]

  if (params.required) {
    parts.push('(required)')
  }

  if (params.hint) {
    parts.push(params.hint)
  }

  return parts.join(', ')
}

// ============================================
// ARIA ATTRIBUTES HELPERS
// ============================================

/**
 * Get ARIA attributes for a button
 */
export function getButtonAria(params: {
  label: string
  description?: string
  pressed?: boolean
  expanded?: boolean
  controls?: string
  disabled?: boolean
}) {
  const aria: Record<string, any> = {
    'aria-label': params.label,
  }

  if (params.description) {
    aria['aria-describedby'] = params.description
  }

  if (params.pressed !== undefined) {
    aria['aria-pressed'] = params.pressed
  }

  if (params.expanded !== undefined) {
    aria['aria-expanded'] = params.expanded
  }

  if (params.controls) {
    aria['aria-controls'] = params.controls
  }

  if (params.disabled) {
    aria['aria-disabled'] = true
  }

  return aria
}

/**
 * Get ARIA attributes for a modal/dialog
 */
export function getDialogAria(params: {
  labelledBy?: string
  describedBy?: string
  role?: 'dialog' | 'alertdialog'
}) {
  return {
    role: params.role || 'dialog',
    'aria-modal': true,
    ...(params.labelledBy && { 'aria-labelledby': params.labelledBy }),
    ...(params.describedBy && { 'aria-describedby': params.describedBy }),
  }
}

/**
 * Get ARIA attributes for a navigation landmark
 */
export function getNavigationAria(params: {
  label: string
  current?: 'page' | 'step' | 'location' | 'date' | 'time' | boolean
}) {
  const aria: Record<string, any> = {
    role: 'navigation',
    'aria-label': params.label,
  }

  if (params.current) {
    aria['aria-current'] = params.current
  }

  return aria
}

/**
 * Get ARIA attributes for a tab/tablist
 */
export function getTabAria(params: {
  selected: boolean
  controls: string
  id: string
}) {
  return {
    role: 'tab',
    'aria-selected': params.selected,
    'aria-controls': params.controls,
    id: params.id,
    tabIndex: params.selected ? 0 : -1,
  }
}

export function getTabPanelAria(params: {
  labelledBy: string
  id: string
  hidden: boolean
}) {
  return {
    role: 'tabpanel',
    'aria-labelledby': params.labelledBy,
    id: params.id,
    hidden: params.hidden,
    tabIndex: 0,
  }
}

/**
 * Get ARIA attributes for a list
 */
export function getListAria(params: {
  label: string
  itemCount?: number
}) {
  return {
    role: 'list',
    'aria-label': params.label,
    ...(params.itemCount && { 'aria-setsize': params.itemCount }),
  }
}

export function getListItemAria(params: {
  position?: number
  total?: number
  level?: number
}) {
  return {
    role: 'listitem',
    ...(params.position && { 'aria-posinset': params.position }),
    ...(params.total && { 'aria-setsize': params.total }),
    ...(params.level && { 'aria-level': params.level }),
  }
}

// ============================================
// FOCUS MANAGEMENT
// ============================================

/**
 * Trap focus within an element (for modals)
 */
export function trapFocus(element: HTMLElement) {
  const focusableElements = element.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  )

  const firstFocusable = focusableElements[0]
  const lastFocusable = focusableElements[focusableElements.length - 1]

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return

    if (e.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstFocusable) {
        e.preventDefault()
        lastFocusable.focus()
      }
    } else {
      // Tab
      if (document.activeElement === lastFocusable) {
        e.preventDefault()
        firstFocusable.focus()
      }
    }
  }

  element.addEventListener('keydown', handleKeyDown)

  // Focus first element
  firstFocusable?.focus()

  // Return cleanup function
  return () => {
    element.removeEventListener('keydown', handleKeyDown)
  }
}

/**
 * Return focus to previously focused element
 */
export function returnFocus(element: HTMLElement | null) {
  if (element && typeof element.focus === 'function') {
    element.focus()
  }
}

/**
 * Get all focusable elements within a container
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
    )
  )
}

// ============================================
// SEMANTIC HTML HELPERS
// ============================================

/**
 * Get proper heading level (h1-h6)
 */
export function getHeadingLevel(level: number): 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' {
  const clampedLevel = Math.max(1, Math.min(6, level))
  return `h${clampedLevel}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
}

// ============================================
// SCREEN READER UTILITIES
// ============================================

/**
 * Check if screen reader is likely active
 */
export function isScreenReaderActive(): boolean {
  // Check for common screen reader indicators
  return Boolean(
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    document.querySelector('[aria-live]') ||
    navigator.userAgent.includes('JAWS') ||
    navigator.userAgent.includes('NVDA')
  )
}

/**
 * Get screen reader only CSS classes
 */
export const srOnlyClasses = 'absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0'

// ============================================
// KEYBOARD NAVIGATION HELPERS
// ============================================

/**
 * Handle arrow key navigation in a list
 */
export function handleArrowNavigation(
  event: KeyboardEvent,
  items: HTMLElement[],
  currentIndex: number
): number {
  let newIndex = currentIndex

  switch (event.key) {
    case 'ArrowUp':
      event.preventDefault()
      newIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1
      break
    case 'ArrowDown':
      event.preventDefault()
      newIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0
      break
    case 'Home':
      event.preventDefault()
      newIndex = 0
      break
    case 'End':
      event.preventDefault()
      newIndex = items.length - 1
      break
  }

  items[newIndex]?.focus()
  return newIndex
}

/**
 * Check if element is keyboard accessible
 */
export function isKeyboardAccessible(element: HTMLElement): boolean {
  const tabIndex = element.getAttribute('tabindex')
  const isInteractive = [
    'button',
    'a',
    'input',
    'select',
    'textarea',
  ].includes(element.tagName.toLowerCase())

  return isInteractive || (tabIndex !== null && tabIndex !== '-1')
}

// ============================================
// ARIA LIVE REGIONS
// ============================================

/**
 * Create a live region for dynamic updates
 */
export function createLiveRegion(id: string, priority: 'polite' | 'assertive' = 'polite'): HTMLElement {
  let region = document.getElementById(id)

  if (!region) {
    region = document.createElement('div')
    region.id = id
    region.setAttribute('role', 'status')
    region.setAttribute('aria-live', priority)
    region.setAttribute('aria-atomic', 'true')
    region.className = srOnlyClasses
    document.body.appendChild(region)
  }

  return region
}

/**
 * Update live region content
 */
export function updateLiveRegion(id: string, message: string) {
  const region = document.getElementById(id)
  if (region) {
    // Clear first for screen readers to re-announce
    region.textContent = ''
    setTimeout(() => {
      region.textContent = message
    }, 100)
  }
}

// ============================================
// ERROR HANDLING
// ============================================

/**
 * Get ARIA attributes for form errors
 */
export function getErrorAria(params: {
  fieldId: string
  errorId: string
  hasError: boolean
}) {
  return {
    'aria-invalid': params.hasError,
    'aria-describedby': params.hasError ? params.errorId : undefined,
  }
}

/**
 * Announce form error to screen readers
 */
export function announceError(fieldLabel: string, errorMessage: string) {
  announce(`Error in ${fieldLabel}: ${errorMessage}`, 'assertive')
}

/**
 * Announce form success
 */
export function announceSuccess(message: string) {
  announce(message, 'polite')
}

// ============================================
// LOADING STATES
// ============================================

/**
 * Get ARIA attributes for loading states
 */
export function getLoadingAria(params: {
  loading: boolean
  label?: string
}) {
  return {
    'aria-busy': params.loading,
    ...(params.label && { 'aria-label': params.label }),
  }
}

/**
 * Announce loading state change
 */
export function announceLoadingState(isLoading: boolean, context?: string) {
  if (isLoading) {
    announce(`Loading${context ? ` ${context}` : ''}...`, 'polite')
  } else {
    announce(`${context || 'Content'} loaded`, 'polite')
  }
}

// ============================================
// UTILS
// ============================================

/**
 * Generate unique ID for ARIA relationships
 */
export function generateId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Check if reduced motion is preferred
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Check if high contrast mode is active
 */
export function prefersHighContrast(): boolean {
  return window.matchMedia('(prefers-contrast: high)').matches
}
