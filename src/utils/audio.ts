export const playNotificationSound = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    
    // If the browser blocks audio before interaction, the context state will be 'suspended'
    const ctx = new AudioContext();
    
    // Play a pleasant double-chime (Major third interval)
    const playNote = (freq: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      // Use a mixture of sine and triangle for a slightly richer "bell" tone
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);
      
      // Envelope
      gain.gain.setValueAtTime(0, ctx.currentTime + startTime);
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + startTime + 0.02);
      // Long exponential decay
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(ctx.currentTime + startTime);
      osc.stop(ctx.currentTime + startTime + duration);
    };
    
    // Play C6 (1046Hz) and E6 (1318Hz)
    playNote(1046.50, 0, 0.4); 
    playNote(1318.51, 0.1, 0.6);
  } catch (e) {
    console.warn('Notification sound failed to play:', e);
  }
};
