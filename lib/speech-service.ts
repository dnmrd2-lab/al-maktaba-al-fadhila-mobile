export type SpeechOptions = {
  language?: string;
  rate?: number;
  pitch?: number;
  onStart?: () => void;
  onDone?: () => void;
  onError?: (error: Error) => void;
};

/**
 * Clean text for Arabic text-to-speech by removing formatting noise and links.
 */
export function sanitizeTextForSpeech(text: string): string {
  if (!text) return "";
  return text
    .replace(/<[^>]+>/g, " ") // strip HTML tags
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // replace markdown links with label
    .replace(/https?:\/\/\S+/g, " ") // strip standalone URLs
    .replace(/[#*`_~[\]()]/g, " ") // strip markdown symbols
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Reads Arabic or multilingual text aloud using expo-speech,
 * with fallback to Web SpeechSynthesis where applicable.
 */
export async function speakArabicText(
  text: string,
  options?: SpeechOptions,
): Promise<void> {
  const clean = sanitizeTextForSpeech(text);
  if (!clean) return;

  const lang = options?.language || "ar-SA";
  const rate = options?.rate ?? 0.9;
  const pitch = options?.pitch ?? 1.0;

  // Web SpeechSynthesis check
  const isWeb = typeof window !== "undefined" && typeof window.speechSynthesis !== "undefined";
  if (isWeb && window.speechSynthesis) {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.lang = lang;
      utterance.rate = rate;
      utterance.pitch = pitch;

      if (options?.onStart) utterance.onstart = () => options.onStart?.();
      if (options?.onDone) utterance.onend = () => options.onDone?.();
      if (options?.onError) utterance.onerror = (e) => options.onError?.(new Error(String(e.error || e)));

      window.speechSynthesis.speak(utterance);
      return;
    } catch {
      // fallback
    }
  }

  // Native / Expo Speech
  try {
    const Speech = await import("expo-speech");
    await Speech.stop();
    Speech.speak(clean, {
      language: lang,
      rate,
      pitch,
      onStart: options?.onStart,
      onDone: options?.onDone,
      onError: options?.onError,
    });
  } catch (err: any) {
    options?.onError?.(err instanceof Error ? err : new Error(String(err)));
  }
}

/**
 * Stops any ongoing text-to-speech playback.
 */
export async function stopArabicSpeech(): Promise<void> {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
  try {
    const Speech = await import("expo-speech");
    await Speech.stop();
  } catch {
    // ignore
  }
}

/**
 * Checks if speech is currently active.
 */
export async function isSpeaking(): Promise<boolean> {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    if (window.speechSynthesis.speaking) return true;
  }
  try {
    const Speech = await import("expo-speech");
    return await Speech.isSpeakingAsync();
  } catch {
    return false;
  }
}

export type VoiceRecognitionCallbacks = {
  onStart?: () => void;
  onResult: (transcript: string) => void;
  onError?: (error: string) => void;
  onEnd?: () => void;
};

export type VoiceRecognitionSession = {
  stop: () => void;
};

export function isVoiceRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition
  );
}

export function startArabicVoiceRecognition(
  callbacks: VoiceRecognitionCallbacks,
): VoiceRecognitionSession | null {
  if (typeof window === "undefined") return null;

  const SpeechRecognitionClass =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  if (!SpeechRecognitionClass) {
    callbacks.onError?.("خاصية التعرف الصوتي المباشر غير مدعومة في هذه البيئة. يمكنك استخدام زر الميكروفون في لوحة المفاتيح.");
    return null;
  }

  try {
    const recognition = new SpeechRecognitionClass();
    recognition.lang = "ar-SA";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      callbacks.onStart?.();
    };

    recognition.onresult = (event: any) => {
      const results = event.results;
      if (results && results[0] && results[0][0]) {
        const transcript = String(results[0][0].transcript || "").trim();
        if (transcript) {
          callbacks.onResult(transcript);
        }
      }
    };

    recognition.onerror = (event: any) => {
      callbacks.onError?.(event.error || "حدث خطأ أثناء الاستماع للصوت.");
    };

    recognition.onend = () => {
      callbacks.onEnd?.();
    };

    recognition.start();

    return {
      stop: () => {
        try {
          recognition.stop();
        } catch {
          // ignore
        }
      },
    };
  } catch (err: any) {
    callbacks.onError?.(err?.message || "تعذر بدء جلسة الاستماع الصوتية.");
    return null;
  }
}
