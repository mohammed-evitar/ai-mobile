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
}

const {width} = Dimensions.get('window');

const BottomAudioPlayer: React.FC<BottomAudioPlayerProps> = ({
  visible,
  onClose,
  news,
  onTrackChange,
}) => {
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

  // Load tracks when player becomes visible
  useEffect(() => {
    const loadTracks = async () => {
      try {
        const firstNews = news[0];
        setCurrentNews(firstNews);
        setCurrentSentence(firstNews.speech.speech[0].sentence);
        onTrackChange?.(firstNews._id);

        await TrackPlayer.reset();

        // Add all speech tracks from all news articles
        const allTracks = news.flatMap((newsItem, newsIndex) =>
          newsItem.speech.speech.map((speechItem, speechIndex) => ({
            id: speechItem._id,
            url: speechItem.audioUrl,
            title: newsItem.headline,
            artist: newsItem.category,
            newsIndex: newsIndex,
            speechIndex: speechIndex,
          })),
        );

        await TrackPlayer.add(allTracks);
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
  }, [visible, news, onTrackChange]);

  // Handle track changes
  useTrackPlayerEvents([Event.PlaybackTrackChanged], async event => {
    if (event.nextTrack !== undefined) {
      const track = await TrackPlayer.getTrack(event.nextTrack);
      if (track) {
        const newsItem = news[track.newsIndex];
        setCurrentNews(newsItem);
        setCurrentSentence(newsItem.speech.speech[track.speechIndex].sentence);
        onTrackChange?.(newsItem._id);
      }
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
