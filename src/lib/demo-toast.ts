// Simple toast notification for demo mode actions
let toastTimeout: ReturnType<typeof setTimeout> | null = null

export function showToast(message: string) {
  // Remove existing toast
  const existing = document.getElementById('demo-toast')
  if (existing) existing.remove()
  if (toastTimeout) clearTimeout(toastTimeout)

  const toast = document.createElement('div')
  toast.id = 'demo-toast'
  toast.style.cssText = `
    position: fixed; bottom: 24px; right: 24px; z-index: 9999;
    background: #16161f; border: 1px solid #6366f1; border-radius: 8px;
    padding: 12px 20px; color: #f0f0f5; font-size: 14px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4); max-width: 400px;
    animation: slideIn 0.2s ease-out;
  `
  toast.textContent = message
  document.body.appendChild(toast)

  toastTimeout = setTimeout(() => {
    toast.style.opacity = '0'
    toast.style.transition = 'opacity 0.3s'
    setTimeout(() => toast.remove(), 300)
  }, 3000)
}

export function demoAction(actionName: string) {
  showToast(`Demo mode: "${actionName}" requires Supabase connection`)
}
