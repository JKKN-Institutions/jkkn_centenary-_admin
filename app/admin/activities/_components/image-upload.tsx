/**
 * Image Upload Component
 * Single image upload with preview and Supabase storage integration
 */

'use client'

import { useState, useRef, useEffect } from 'react'
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { uploadImage, deleteFile } from '@/lib/services/storage-service'
import { testStorageConnection } from '@/lib/services/storage-test'
import { compressImage } from '@/lib/services/image-compression'

interface ImageUploadProps {
  value: string
  onChange: (url: string) => void
  bucket: 'activity-images' | 'testimonial-avatars'
  folder?: string
}

export function ImageUpload({ value, onChange, bucket, folder }: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadStage, setUploadStage] = useState<'idle' | 'compressing' | 'uploading'>('idle')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Test storage connection on mount
  useEffect(() => {
    testStorageConnection().then(result => {
      console.log('[ImageUpload] Storage connection test:', result)
      if (!result.success) {
        toast.error('Storage connection issue: ' + result.message)
      }
    })
  }, [])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Prevent multiple simultaneous uploads
    if (isUploading) {
      console.warn('[ImageUpload] Upload already in progress, ignoring...')
      toast.warning('Please wait for current upload to complete')
      return
    }

    // Check network connectivity
    if (!navigator.onLine) {
      toast.error('No internet connection. Please check your network and try again.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    console.log('[ImageUpload] File selected:', {
      name: file.name,
      type: file.type,
      size: file.size,
      bucket,
      folder
    })

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      toast.error(`Invalid file type. Please select: ${allowedTypes.map(t => t.split('/')[1].toUpperCase()).join(', ')}`)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    // Validate file size based on bucket
    const maxSize = bucket === 'activity-images' ? 10 * 1024 * 1024 : 2 * 1024 * 1024
    const maxSizeMB = maxSize / (1024 * 1024)
    if (file.size > maxSize) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2)
      toast.error(`Image size (${fileSizeMB}MB) exceeds ${maxSizeMB}MB limit`)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    try {
      console.log('[ImageUpload] Starting upload process...')
      setIsUploading(true)
      setUploadStage('compressing')

      // Delete old image if exists
      if (value) {
        try {
          console.log('[ImageUpload] Deleting old image:', value)
          await deleteFile(value, bucket)
        } catch (deleteError) {
          console.warn('[ImageUpload] Failed to delete old image:', deleteError)
          // Continue with upload even if delete fails
        }
      }

      // Compress image before upload to improve speed
      console.log('[ImageUpload] Compressing image...')
      const compressedFile = await compressImage(file, {
        maxWidth: 1920,
        maxHeight: 1080,
        quality: 0.7,
        maxSizeMB: 2,
        timeoutMs: 15000, // 15 second compression timeout
      })

      // Upload compressed image with timeout wrapper
      setUploadStage('uploading')
      console.log('[ImageUpload] Uploading compressed image...')
      console.log('[ImageUpload] Network status:', navigator.onLine ? 'Online' : 'Offline')

      // Create a timeout promise (30 seconds - reduced for better UX)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Upload timeout: The upload is taking too long. Please check your internet connection and try again.'))
        }, 30000) // 30 second timeout
      })

      // Race between upload and timeout (use compressed file)
      const url = await Promise.race([
        uploadImage(compressedFile, bucket, folder),
        timeoutPromise
      ])

      console.log('[ImageUpload] Upload successful! URL:', url)
      onChange(url)
      toast.success('Image uploaded successfully')
    } catch (error) {
      console.error('[ImageUpload] Upload error:', error)
      console.error('[ImageUpload] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace',
        error
      })

      // Extract meaningful error message
      let errorMessage = 'Failed to upload image'

      if (error instanceof Error) {
        // Check for specific error types
        if (error.message.includes('new row violates row-level security policy')) {
          errorMessage = 'Permission denied: You do not have access to upload images'
        } else if (error.message.includes('File size exceeds')) {
          errorMessage = error.message
        } else if (error.message.includes('Invalid file type')) {
          errorMessage = error.message
        } else if (error.message.includes('Bucket not found')) {
          errorMessage = 'Storage configuration error: Bucket not found'
        } else if (error.message.includes('duplicate key')) {
          errorMessage = 'File already exists. Please try again'
        } else {
          errorMessage = `Upload failed: ${error.message}`
        }
      }

      toast.error(errorMessage, {
        duration: 5000,
        description: 'Please try again or contact support if the problem persists'
      })
    } finally {
      setIsUploading(false)
      setUploadStage('idle')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemove = async () => {
    if (!value) return

    try {
      setIsUploading(true)

      // Try to delete from storage
      const deleted = await deleteFile(value, bucket)

      // Always clear the value, even if storage delete fails
      // The deleteFile function now handles invalid URLs gracefully
      onChange('')

      if (deleted) {
        toast.success('Image removed successfully')
      } else {
        // Delete returned false but didn't throw - URL was cleared
        toast.success('Image removed')
      }
    } catch (error) {
      console.error('[ImageUpload] Remove error:', error)

      // Even if delete fails, clear the URL value
      // This allows users to remove invalid/broken image references
      onChange('')

      // Extract meaningful error message
      let errorMessage = 'Image reference cleared'

      if (error instanceof Error) {
        if (error.message.includes('new row violates row-level security policy')) {
          errorMessage = 'Permission denied, but image reference was cleared'
        } else if (error.message.includes('Object not found') || error.message.includes('not found')) {
          errorMessage = 'Image removed (was not found in storage)'
        } else {
          errorMessage = 'Image reference cleared (storage delete failed)'
        }
      }

      toast.success(errorMessage)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      {value ? (
        <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
          <img
            src={value}
            alt="Uploaded image"
            className="w-full h-full object-cover"
          />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2"
            onClick={handleRemove}
            disabled={isUploading}
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <X className="h-4 w-4" />
            )}
          </Button>
        </div>
      ) : (
        <div
          className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="flex flex-col items-center gap-2">
            {isUploading ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {uploadStage === 'compressing' ? 'Compressing image...' : 'Uploading...'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {uploadStage === 'compressing'
                    ? 'Optimizing for faster upload'
                    : 'Please wait, this may take a moment'}
                </p>
              </>
            ) : (
              <>
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium">Click to upload image</p>
                <p className="text-xs text-muted-foreground">
                  {bucket === 'activity-images'
                    ? 'JPEG, JPG, PNG, WEBP, GIF up to 10MB'
                    : 'JPEG, JPG, PNG, WEBP up to 2MB'}
                </p>
              </>
            )}
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
        disabled={isUploading}
      />
    </div>
  )
}
