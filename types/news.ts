export interface SpeechItem {
  sentence: string;
  audioUrl: string;
  _id: string;
}

export interface Speech {
  summary: string;
  speech: SpeechItem[];
  _id: string;
}

export interface NewsItem {
  _id: string;
  headline: string;
  description: string;
  category: string;
  speech: Speech;
  extended_speech: Speech;
  conversation?: Array<{
    _id: string;
    audioUrl: string;
    sentence: string;
    speaker: string;
  }>;
  generateVoxDex?: boolean;
}
