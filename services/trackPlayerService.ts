import TrackPlayer, {Capability} from 'react-native-track-player';
import {imageMap} from '../utils/imageMap';
import {getImageName} from '../utils/imageUtils';
import {NewsItem, SpeechItem} from '../types/news';

interface QueueItem {
  id: string;
  url: string;
  title: string;
  artist: string;
  artwork?: any;
  newsIndex: number;
  speechIndex: number;
  speaker?: string;
  sentence: string;
}

export const setupPlayer = async () => {
  try {
    await TrackPlayer.setupPlayer();
    await TrackPlayer.updateOptions({
      capabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
      ],
      compactCapabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
      ],
    });
  } catch (error) {
    console.log('Error setting up player:', error);
  }
};

export const buildQueue = (news: NewsItem[], isVoxBuzzOn: boolean) => {
  const queue: QueueItem[] = [];

  news.forEach((newsItem: NewsItem, newsIndex: number) => {
    if (isVoxBuzzOn && newsItem.conversation) {
      // Add conversation items
      newsItem.conversation.forEach((convItem, convIndex: number) => {
        queue.push({
          id: `${newsItem._id}-${convIndex}`,
          url: convItem.audioUrl,
          title: newsItem.headline,
          artist: convItem.speaker,
          artwork: imageMap[getImageName({}, newsItem.category)],
          sentence: convItem.sentence,
          newsIndex,
          speechIndex: convIndex,
        });
      });
    } else {
      // Add extended speech items
      newsItem.extended_speech?.speech.forEach(
        (speechItem: SpeechItem, speechIndex: number) => {
          queue.push({
            id: `${newsItem._id}-${speechIndex}`,
            url: speechItem.audioUrl,
            title: newsItem.headline,
            artist: 'News Reader',
            artwork: imageMap[getImageName({}, newsItem.category)],
            sentence: speechItem.sentence,
            newsIndex,
            speechIndex,
          });
        },
      );
    }
  });

  return queue;
};

export const getCurrentNews = (queue: QueueItem[], currentIndex: number) => {
  const currentTrack = queue[currentIndex];
  if (!currentTrack) return null;

  return {
    headline: currentTrack.title,
    category: currentTrack.artist,
    sentence: currentTrack.sentence,
    speaker: currentTrack.speaker,
  };
};
