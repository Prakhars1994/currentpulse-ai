'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Link2,
  Image as ImageIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo,
  Redo,
} from 'lucide-react'

function ToolbarButton({
  onClick,
  isActive = false,
  icon: Icon,
  label,
  disabled = false,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`p-2 rounded hover:bg-gray-100 transition-colors ${
        isActive ? 'bg-gray-200 text-blue-600' : 'text-gray-700'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      title={label}
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}

export default function RichTextEditor({
  content,
  onChange,
  placeholder = 'Write your content here...',
}) {
  const editor = useEditor({
    immediatelyRender: false,

    extensions: [
      StarterKit.configure({
        link: false,
        underline: false,
      }),

      Image,

      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline',
        },
      }),

      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),

      Underline,

      Placeholder.configure({
        placeholder,
      }),
    ],

    content: content || '',

    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },

    editorProps: {
      attributes: {
        class:
          'prose max-w-none focus:outline-none min-h-[200px] p-4',
      },
    },
  })

  if (!editor) return null

  return (
    <div className="border border-gray-300 rounded-md overflow-hidden">
      <div className="flex flex-wrap items-center gap-1 p-2 border-b border-gray-300 bg-gray-50">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          icon={Bold}
          label="Bold"
        />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          icon={Italic}
          label="Italic"
        />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive('underline')}
          icon={UnderlineIcon}
          label="Underline"
        />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive('strike')}
          icon={Strikethrough}
          label="Strikethrough"
        />

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          icon={List}
          label="Bullet List"
        />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          icon={ListOrdered}
          label="Numbered List"
        />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive('blockquote')}
          icon={Quote}
          label="Quote"
        />

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          isActive={editor.isActive({ textAlign: 'left' })}
          icon={AlignLeft}
          label="Align Left"
        />

        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          isActive={editor.isActive({ textAlign: 'center' })}
          icon={AlignCenter}
          label="Align Center"
        />

        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          isActive={editor.isActive({ textAlign: 'right' })}
          icon={AlignRight}
          label="Align Right"
        />

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <ToolbarButton
          onClick={() => {
            const url = window.prompt('Enter image URL:')
            if (url) {
              editor.chain().focus().setImage({ src: url }).run()
            }
          }}
          icon={ImageIcon}
          label="Add Image"
        />

        <ToolbarButton
          onClick={() => {
            const previousUrl = editor.getAttributes('link').href
            const url = window.prompt('Enter URL:', previousUrl || '')

            if (url === null) return

            if (url === '') {
              editor.chain().focus().unsetLink().run()
              return
            }

            editor.chain().focus().setLink({ href: url }).run()
          }}
          isActive={editor.isActive('link')}
          icon={Link2}
          label="Add Link"
        />

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          icon={Undo}
          label="Undo"
          disabled={!editor.can().undo()}
        />

        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          icon={Redo}
          label="Redo"
          disabled={!editor.can().redo()}
        />
      </div>

      <EditorContent editor={editor} />
    </div>
  )
}
