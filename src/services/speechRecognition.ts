export class SpeechRecognitionService {
  private recognition: any;
  private isListening: boolean = false;
  private onTranscriptCallback: (text: string) => void;

  constructor(onTranscript: (text: string) => void) {
    this.onTranscriptCallback = onTranscript;
    
    if ('webkitSpeechRecognition' in window) {
      this.recognition = new (window as any).webkitSpeechRecognition();
      this.setupRecognition();
    } else {
      throw new Error('Speech recognition not supported in this browser');
    }
  }

  private setupRecognition() {
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    this.recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        this.onTranscriptCallback(finalTranscript);
      }
    };

    this.recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
    };
  }

  public startListening() {
    if (!this.isListening) {
      this.recognition.start();
      this.isListening = true;
    }
  }

  public stopListening() {
    if (this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }
  }

  public isRecognitionSupported(): boolean {
    return 'webkitSpeechRecognition' in window;
  }
}
