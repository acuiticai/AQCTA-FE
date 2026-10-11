"use client"

import { createContext, useContext, useState, useEffect } from "react"
import ReactDOM from "react-dom"

// Create context for popup management
const PopupContext = createContext()

// Popup types
const POPUP_TYPES = {
  SUCCESS: "success",
  ERROR: "error",
  WARNING: "warning",
}

// Popup Provider component
export const PopupProvider = ({ children }) => {
  const [popups, setPopups] = useState([])

  // Function to add a new popup
  const addPopup = (message, type, autoClose = 3000) => {
    const id = Date.now()

    setPopups((prevPopups) => [...prevPopups, { id, message, type, autoClose }])

    // Auto close popup after specified time
    if (autoClose) {
      setTimeout(() => {
        removePopup(id)
      }, autoClose)
    }

    return id
  }

  // Function to remove a popup
  const removePopup = (id) => {
    setPopups((prevPopups) => prevPopups.filter((popup) => popup.id !== id))
  }

  return (
    <PopupContext.Provider value={{ addPopup, removePopup }}>
      {children}
      <PopupContainer popups={popups} removePopup={removePopup} />
    </PopupContext.Provider>
  )
}

// Hook to use popup context
export const usePopup = () => {
  const context = useContext(PopupContext)
  if (!context) {
    throw new Error("usePopup must be used within a PopupProvider")
  }
  return context
}

// Popup Container component
const PopupContainer = ({ popups, removePopup }) => {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  if (!mounted) return null

  // Create portal for popups
  return ReactDOM.createPortal(
    <div className="popup-container">
      {popups.map((popup) => (
        <Popup key={popup.id} popup={popup} onClose={() => removePopup(popup.id)} />
      ))}
      <style jsx global>{`
        .popup-container {
          position: fixed;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 9999;
          display: flex;
          flex-direction: column;
          gap: 10px;
          max-width: 90%;
          width: 400px;
        }
        
        .popup {
          padding: 16px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          display: flex;
          justify-content: space-between;
          align-items: center;
          animation: slideIn 0.3s ease;
          cursor: pointer;
        }
        
        .popup-success {
          background-color: #e6f7e6;
          border-left: 4px solid #4caf50;
          color: #2e7d32;
        }
        
        .popup-error {
          background-color: #fdecea;
          border-left: 4px solid #f44336;
          color: #d32f2f;
        }
        
        .popup-warning {
          background-color: #fff8e1;
          border-left: 4px solid #ff9800;
          color: #ef6c00;
        }
        
        .popup-icon {
          margin-right: 12px;
          font-size: 20px;
        }
        
        .popup-close {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 18px;
          color: inherit;
          opacity: 0.7;
        }
        
        .popup-close:hover {
          opacity: 1;
        }
        
        @keyframes slideIn {
          from {
            transform: translateY(-20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>,
    document.body,
  )
}

// Individual Popup component
const Popup = ({ popup, onClose }) => {
  const { message, type } = popup

  const getIcon = () => {
    switch (type) {
      case POPUP_TYPES.SUCCESS:
        return "✅"
      case POPUP_TYPES.ERROR:
        return "❌"
      case POPUP_TYPES.WARNING:
        return "⚠️"
      default:
        return ""
    }
  }

  return (
    <div className={`popup popup-${type}`} onClick={onClose} role="alert">
      <div style={{ display: "flex", alignItems: "center" }}>
        <span className="popup-icon">{getIcon()}</span>
        <span>{message}</span>
      </div>
      <button className="popup-close" onClick={onClose}>
        ×
      </button>
    </div>
  )
}

// Export notification functions with the same API as before
export const notifySuccess = (message) => {
  const { addPopup } = usePopup()
  return addPopup(message, POPUP_TYPES.SUCCESS, 3000)
}

export const notifyError = (message) => {
  const { addPopup } = usePopup()
  return addPopup(message, POPUP_TYPES.ERROR, 3000)
}

export const notifyWarning = (message) => {
  const { addPopup } = usePopup()
  return addPopup(message, POPUP_TYPES.WARNING, 3000)
}

