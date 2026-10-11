"use client"

import { useState, createContext, useContext, useEffect, useRef } from "react"

const PopoverContext = createContext()

const Popover = ({ children, open, onOpenChange }) => {
  const [isOpen, setIsOpen] = useState(open || false)

  const handleOpenChange = (newOpen) => {
    setIsOpen(newOpen)
    if (onOpenChange) onOpenChange(newOpen)
  }

  return (
    <PopoverContext.Provider value={{ isOpen, setIsOpen: handleOpenChange }}>
      <div className="relative">{children}</div>
    </PopoverContext.Provider>
  )
}

const PopoverTrigger = ({ children, asChild, ...props }) => {
  const { isOpen, setIsOpen } = useContext(PopoverContext)

  return (
    <div onClick={() => setIsOpen(!isOpen)} {...props}>
      {children}
    </div>
  )
}

const PopoverContent = ({ children, className = "", align = "center", ...props }) => {
  const { isOpen, setIsOpen } = useContext(PopoverContext)
  const contentRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (contentRef.current && !contentRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen, setIsOpen])

  if (!isOpen) return null

  const alignClasses = {
    start: "",
    center: "left-1/2 transform -translate-x-1/2",
    end: "right-0",
  }

  return (
    <div
      ref={contentRef}
      className={`absolute top-full mt-2 z-50 min-w-[8rem] overflow-hidden rounded-md border bg-white p-1 shadow-lg ${alignClasses[align]} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

export { Popover, PopoverTrigger, PopoverContent }
