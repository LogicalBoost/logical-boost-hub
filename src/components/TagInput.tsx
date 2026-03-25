'use client'

import { useState, useRef, type KeyboardEvent } from 'react'

interface TagInputProps {
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  /** Optional color for the tag border/text (CSS color string) */
  tagColor?: string
}

export default function TagInput({ tags, onChange, placeholder = 'Type and press Enter', tagColor }: TagInputProps) {
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const val = input.trim()
      if (val && !tags.includes(val)) {
        onChange([...tags, val])
      }
      setInput('')
    }
    if (e.key === 'Backspace' && input === '' && tags.length > 0) {
      onChange(tags.slice(0, -1))
    }
  }

  function removeTag(index: number) {
    onChange(tags.filter((_, i) => i !== index))
  }

  const tagStyle = tagColor
    ? { borderColor: tagColor, color: tagColor }
    : {}

  return (
    <div className="tag-input-container" onClick={() => inputRef.current?.focus()}>
      {tags.map((tag, i) => (
        <span key={`${tag}-${i}`} className="tag-input-tag" style={tagStyle}>
          {tag}
          <button
            type="button"
            className="tag-input-remove"
            onClick={(e) => { e.stopPropagation(); removeTag(i) }}
          >
            &times;
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        className="tag-input-field"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={tags.length === 0 ? placeholder : ''}
      />
    </div>
  )
}
