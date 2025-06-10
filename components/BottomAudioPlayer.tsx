import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import TrackPlayer, {
  Event,
  useTrackPlayerEvents,
} from 'react-native-track-player';
import Icon from 'react-native-vector-icons/FontAwesome5';
import {setupPlayer} from '../services/trackPlayerService';

interface SpeechItem {
  sentence: string;
  audioUrl: string;
  _id: string;
}

interface Speech {
  summary: string;
  speech: SpeechItem[];
  _id: string;
}

interface ConversationItem {
  speaker: string;
  sentence: string;
  audioUrl: string;
  _id: string;
}

interface RawConversationItem {
  speaker: string;
  text: string;
  generateVoxDex: boolean;
}

interface NewsItem {
  date: string;
  headline: string;
  description: string;
  category: string;
  speech: Speech;
  extended_speech: Speech;
  conversation: ConversationItem[];
  rawConversation: RawConversationItem[];
  generateVoxDex: boolean;
  _id: string;
}

interface BottomAudioPlayerProps {
  visible: boolean;
  onClose: () => void;
  news: NewsItem[];
  onTrackChange?: (newsId: string) => void;
  isVoxDeux?: boolean;
}

const {width} = Dimensions.get('window');

const BottomAudioPlayer: React.FC<BottomAudioPlayerProps> = ({
  visible,
  onClose,
  news,
  onTrackChange,
  isVoxDeux = false,
}) => {
  console.log('news, isVoxDeux', news, isVoxDeux);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentNews, setCurrentNews] = useState<NewsItem | null>(null);
  const [currentSentence, setCurrentSentence] = useState<string>('');

  // Initialize player when component mounts
  useEffect(() => {
    setupPlayer();
    return () => {
      TrackPlayer.reset();
    };
  }, []);

  // Only reload tracks when player is opened or mode changes, not on every news/onTrackChange change
  useEffect(() => {
    const loadTracks = async () => {
      try {
        console.log('loadTracks called. news:', news, 'isVoxDeux:', isVoxDeux);
        const firstNews = news[0];
        setCurrentNews(firstNews);
        if (isVoxDeux) {
          setCurrentSentence(firstNews.conversation[0]?.sentence || '');
        } else {
          setCurrentSentence(firstNews.speech.speech[0]?.sentence || '');
        }
        onTrackChange?.(firstNews._id);

        await TrackPlayer.reset();

        const transitionAudioUrl =
          'https://d279zq803tcyfh.cloudfront.net/transition.mp3';
        const allTracks: Array<{
          id: string;
          url: string;
          title: string;
          artist: string;
          newsIndex: number;
          speechIndex: number;
          speaker?: string;
        }> = [];
        news.forEach((newsItem, newsIndex) => {
          if (isVoxDeux) {
            newsItem.conversation.forEach((convItem, convIndex) => {
              allTracks.push({
                id: `${newsIndex}-${convIndex}-${convItem._id}`,
                url: convItem.audioUrl,
                title: newsItem.headline,
                artist: newsItem.category,
                newsIndex: newsIndex,
                speechIndex: convIndex,
                speaker: convItem.speaker,
              });
            });
          } else {
            newsItem.speech.speech.forEach((speechItem, speechIndex) => {
              allTracks.push({
                id: speechItem._id,
                url: speechItem.audioUrl,
                title: newsItem.headline,
                artist: newsItem.category,
                newsIndex: newsIndex,
                speechIndex: speechIndex,
              });
            });
          }
          // Add transition audio after each article except the last one (in BOTH modes)
          if (newsIndex < news.length - 1) {
            allTracks.push({
              id: `transition-${newsIndex}`,
              url: transitionAudioUrl,
              title: 'Transition',
              artist: 'Transition',
              newsIndex: newsIndex,
              speechIndex: -1,
            });
          }
        });
        console.log('Built allTracks:', allTracks);
        await TrackPlayer.add(allTracks);
        const queue = await TrackPlayer.getQueue();
        console.log('TrackPlayer queue after add:', queue);
        await TrackPlayer.play();
        setIsPlaying(true);
      } catch (error) {
        console.log('Error loading tracks:', error);
        setIsPlaying(false);
      }
    };

    if (visible && news.length > 0) {
      loadTracks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, isVoxDeux]); // Do NOT include news or onTrackChange to avoid unwanted resets

  // Handle track changes
  useTrackPlayerEvents([Event.PlaybackTrackChanged], async event => {
    if (event.nextTrack !== undefined) {
      const track = await TrackPlayer.getTrack(event.nextTrack);
      console.log(
        'PlaybackTrackChanged: event.nextTrack:',
        event.nextTrack,
        'track:',
        track,
      );
      if (track) {
        const newsItem = news[track.newsIndex];
        console.log('newsItem for this track:', newsItem);
        setCurrentNews(newsItem);
        if (isVoxDeux) {
          const sentence =
            newsItem.conversation[track.speechIndex]?.sentence || '';
          setCurrentSentence(sentence);
          console.log(
            'VoxDeux mode: newsIndex:',
            track.newsIndex,
            'speechIndex:',
            track.speechIndex,
            'sentence:',
            sentence,
          );
        } else {
          const sentence =
            newsItem.speech.speech[track.speechIndex]?.sentence || '';
          setCurrentSentence(sentence);
          console.log(
            'Standard mode: newsIndex:',
            track.newsIndex,
            'speechIndex:',
            track.speechIndex,
            'sentence:',
            sentence,
          );
        }
        onTrackChange?.(newsItem._id);
        console.log(
          'currentNews:',
          newsItem,
          'currentSentence:',
          isVoxDeux
            ? newsItem.conversation[track.speechIndex]?.sentence
            : newsItem.speech.speech[track.speechIndex]?.sentence,
        );
      }
      const queue = await TrackPlayer.getQueue();
      console.log('TrackPlayer queue on PlaybackTrackChanged:', queue);
      console.log('Full news array:', news);
      // Ensure playback continues
      setTimeout(() => {
        TrackPlayer.play();
      }, 100);
    }
  });

  const togglePlayback = async () => {
    if (isPlaying) {
      await TrackPlayer.pause();
    } else {
      await TrackPlayer.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleClose = async () => {
    await TrackPlayer.reset();
    setIsPlaying(false);
    setCurrentSentence('');
    onClose();
  };

  if (!visible) return null;

  return (
    <View style={styles.container}>
      <View style={styles.playerContainer}>
        <View style={styles.controls}>
          <TouchableOpacity onPress={togglePlayback}>
            <Icon name={isPlaying ? 'pause' : 'play'} size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>
            {currentNews?.headline || 'No audio playing'}
          </Text>
          <Text style={styles.category}>{currentNews?.category || ''}</Text>
          <Text style={styles.sentence} numberOfLines={2}>
            {currentSentence}
          </Text>
          {/* Show speaker if in VoxDeux mode */}
          {isVoxDeux && (
            <Text style={[styles.category, {fontStyle: 'italic'}]}>
              Speaker:{' '}
              {(() => {
                const newsIdx = currentNews
                  ? news.findIndex(n => n._id === currentNews._id)
                  : -1;
                if (newsIdx !== -1 && news[newsIdx].conversation) {
                  const convIdx = news[newsIdx].conversation.findIndex(
                    c => c.sentence === currentSentence,
                  );
                  return news[newsIdx].conversation[convIdx]?.speaker || '';
                }
                return '';
              })()}
            </Text>
          )}
        </View>

        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
          <Icon name="times" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  playerContainer: {
    backgroundColor: '#1a1a1a',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  info: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
    textAlign: 'center',
    width: width - 80,
  },
  category: {
    color: '#888',
    fontSize: 14,
    marginBottom: 8,
  },
  sentence: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    width: width - 80,
    opacity: 0.8,
  },
  closeButton: {
    position: 'absolute',
    top: 20,
    right: 20,
  },
});

export default BottomAudioPlayer;
