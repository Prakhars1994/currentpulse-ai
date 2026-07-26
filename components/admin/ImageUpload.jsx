'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { supabase } from '@/lib/supabase'
import { X, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import { v4 as uuidv4 } from 'uuid'

export default function ImageUpload({
  imageUrl,
  onImageUpload,
  onImageRemove,
}) {
  const [uploading, setUploading] = useState(false)

  const onDrop = useCallback(
    async (acceptedFiles) => {
      if (acceptedFiles.length === 0 || uploading) return

      const file = acceptedFiles[0]

      if (!file.type.startsWith('image/')) {
        toast.error('Please upload an image file')
        return
      }

      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be less than 5MB')
        return
      }

      setUploading(true)

      try {
        const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg'
        const fileName = `${uuidv4()}.${fileExt}`
        const filePath = `articles/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('article-images')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type,
          })

        if (uploadError) {
          throw uploadError
        }

        const { data } = supabase.storage
          .from('article-images')
          .getPublicUrl(filePath)

        if (!data?.publicUrl) {
          throw new Error('Unable to generate image URL')
        }

        onImageUpload(data.publicUrl)
        toast.success('Image uploaded successfully!')
      } catch (error) {
        console.error('Error uploading image:', error)

        toast.error(
          error instanceof Error
            ? error.message
            : 'Failed to upload image'
        )
      } finally {
        setUploading(false)
      }
    },
    [onImageUpload, uploading]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpeg', '.jpg'],
      'image/png': ['.png'],
      'image/gif': ['.gif'],
      'image/webp': ['.webp'],
    },
    maxFiles: 1,
    multiple: false,
    disabled: uploading,
  })

  if (imageUrl) {
    return (
      <div className="relative inline-block">
        <img
          src={imageUrl}
          alt="Uploaded article image"
          className="h-32 w-32 rounded-lg border border-gray-300 object-cover"
        />

        <button
          type="button"
          onClick={onImageRemove}
          aria-label="Remove uploaded image"
          className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white transition hover:bg-red-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div
      {...getRootProps()}
      className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
        uploading
          ? 'cursor-not-allowed border-gray-300 bg-gray-100 opacity-70'
          : isDragActive
            ? 'cursor-pointer border-blue-500 bg-blue-50'
            : 'cursor-pointer border-gray-300 hover:border-gray-400'
      }`}
    >
      <input {...getInputProps()} />

      {uploading ? (
        <div className="flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-500" />

          <span className="ml-2 text-gray-600">
            Uploading...
          </span>
        </div>
      ) : (
        <div>
          <Upload className="mx-auto h-12 w-12 text-gray-400" />

          <p className="mt-2 text-sm text-gray-600">
            Drag and drop an image here, or click to select
          </p>

          <p className="text-xs text-gray-500">
            PNG, JPG, GIF or WEBP — maximum 5MB
          </p>
        </div>
      )}
    </div>
  )
}