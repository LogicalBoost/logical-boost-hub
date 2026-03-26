'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { showToast } from '@/lib/demo-toast'

const ACCEPTED_TYPES = [
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml',
]
const ACCEPTED_EXTENSIONS = '.png,.jpg,.jpeg,.gif,.webp,.svg'
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

interface LogoUploadProps {
  clientId: string
  currentLogoUrl: string | null
  onUploadComplete: (url: string) => void
}

export default function LogoUpload({ clientId, currentLogoUrl, onUploadComplete }: LogoUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentLogoUrl)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Sync previewUrl when currentLogoUrl prop changes (e.g. client switch, data load)
  useEffect(() => {
    if (currentLogoUrl) {
      setPreviewUrl(currentLogoUrl)
    }
  }, [currentLogoUrl])

  const handleFile = useCallback(async (file: File) => {
    // Validate type
    if (!ACCEPTED_TYPES.includes(file.type)) {
      showToast('Unsupported file type. Use PNG, JPG, GIF, WebP, or SVG.')
      return
    }

    // Validate size
    if (file.size > MAX_SIZE) {
      showToast('File too large. Maximum 5MB.')
      return
    }

    setUploading(true)

    // Create a preview immediately
    const localPreview = URL.createObjectURL(file)
    setPreviewUrl(localPreview)

    try {
      // Generate unique filename
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
      const fileName = `${clientId}/logo-${Date.now()}.${ext}`

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('client-assets')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
        })

      if (uploadError) {
        throw uploadError
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('client-assets')
        .getPublicUrl(fileName)

      const publicUrl = urlData.publicUrl

      // Save logo URL to client record
      const { error: updateError } = await supabase
        .from('clients')
        .update({ logo_url: publicUrl })
        .eq('id', clientId)

      if (updateError) {
        throw updateError
      }

      setPreviewUrl(publicUrl)
      onUploadComplete(publicUrl)
      showToast('Logo uploaded successfully!')
    } catch (err) {
      showToast('Upload failed: ' + (err as Error).message)
      setPreviewUrl(currentLogoUrl)
    } finally {
      setUploading(false)
      URL.revokeObjectURL(localPreview)
    }
  }, [clientId, currentLogoUrl, onUploadComplete])

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFile(files[0])
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFile(files[0])
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div>
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !uploading && fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: 8,
          padding: previewUrl ? 16 : 32,
          textAlign: 'center',
          cursor: uploading ? 'wait' : 'pointer',
          background: dragOver ? 'rgba(16, 185, 129, 0.05)' : 'transparent',
          transition: 'all 0.2s',
          minHeight: 120,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        {uploading ? (
          <>
            <div style={{ fontSize: 24 }}>&#9881;&#65039;</div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Uploading...</div>
          </>
        ) : previewUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Client logo"
              style={{
                maxWidth: '100%',
                maxHeight: 120,
                objectFit: 'contain',
                borderRadius: 4,
              }}
            />
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              Click or drag a new file to replace
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 32, opacity: 0.5 }}>&#128444;&#65039;</div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 500 }}>
              Drag logo here or click to browse
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              PNG, JPG, GIF, WebP, SVG (max 5MB)
            </div>
          </>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
    </div>
  )
}
