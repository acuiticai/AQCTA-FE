/**
 * Notification Sound Utility
 * Creates notification sounds programmatically using Web Audio API
 */

class NotificationSound {
  constructor() {
    this.audioContext = null;
    this.isInitialized = false;
  }

  // Initialize audio context
  init() {
    if (this.isInitialized) return;

    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.isInitialized = true;
    } catch (error) {
      console.warn("Could not initialize audio context:", error);
    }
  }

  // Play notification sound
  play(type = 'default') {
    if (!this.isInitialized) {
      this.init();
    }

    if (!this.audioContext) {
      console.warn("Audio context not available");
      return;
    }

    try {
      switch (type) {
        case 'success':
          this.playSuccessSound();
          break;
        case 'warning':
          this.playWarningSound();
          break;
        case 'error':
          this.playErrorSound();
          break;
        default:
          this.playDefaultSound();
      }
    } catch (error) {
      console.warn("Could not play notification sound:", error);
    }
  }

  // Default notification sound (pleasant chime)
  playDefaultSound() {
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    // Create a pleasant chime sound
    oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
    oscillator.frequency.setValueAtTime(1000, this.audioContext.currentTime + 0.1);
    oscillator.frequency.setValueAtTime(600, this.audioContext.currentTime + 0.2);
    
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.1, this.audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);
    
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.5);
  }

  // Success notification sound
  playSuccessSound() {
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.frequency.setValueAtTime(523, this.audioContext.currentTime); // C5
    oscillator.frequency.setValueAtTime(659, this.audioContext.currentTime + 0.1); // E5
    oscillator.frequency.setValueAtTime(784, this.audioContext.currentTime + 0.2); // G5
    
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.08, this.audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.4);
    
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.4);
  }

  // Warning notification sound
  playWarningSound() {
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime); // A4
    oscillator.frequency.setValueAtTime(415, this.audioContext.currentTime + 0.1); // Ab4
    oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime + 0.2); // A4
    
    oscillator.type = 'triangle';
    
    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.06, this.audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
    
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.3);
  }

  // Error notification sound
  playErrorSound() {
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.frequency.setValueAtTime(220, this.audioContext.currentTime); // A3
    oscillator.frequency.setValueAtTime(196, this.audioContext.currentTime + 0.1); // G3
    oscillator.frequency.setValueAtTime(175, this.audioContext.currentTime + 0.2); // F3
    
    oscillator.type = 'sawtooth';
    
    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.05, this.audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
    
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.3);
  }

  // Play a sequence of beeps (for urgent notifications)
  playUrgentSound() {
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        this.playDefaultSound();
      }, i * 200);
    }
  }

  // Cleanup
  cleanup() {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.isInitialized = false;
  }
}

// Create singleton instance
const notificationSound = new NotificationSound();

export default notificationSound; 