import React, {useEffect, useState, useRef} from 'react';
import {View, Text, TouchableOpacity, Dimensions, Animated} from 'react-native';
import TrackPlayer, {
  Event,
  useTrackPlayerEvents,
} from 'react-native-track-player';
import Icon from 'react-native-vector-icons/FontAwesome5';
import {setupPlayer} from '../services/trackPlayerService';
import tw from '../utils/tailwind';

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
  news: NewsItem[];
  onTrackChange?: (newsId: string) => void;
  isVoxDeux?: boolean;
}

const {width} = Dimensions.get('window');

const BottomAudioPlayer: React.FC<BottomAudioPlayerProps> = ({
  visible,
  news,
  onTrackChange,
  isVoxDeux = false,
}) => {
  console.log('news, isVoxDeux', news, isVoxDeux);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentNews, setCurrentNews] = useState<NewsItem | null>(null);
  const [currentSentence, setCurrentSentence] = useState<string>('');
  const slideAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  // Initialize player when component mounts
  useEffect(() => {
    setupPlayer();
    return () => {
      TrackPlayer.reset();
      setIsPlaying(false);
      setCurrentNews(null);
      setCurrentSentence('');
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

  // Handle track changes with animation
  useTrackPlayerEvents([Event.PlaybackTrackChanged], async event => {
    if (event.nextTrack !== undefined) {
      // Start fade out and slide animation
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: -20,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(async () => {
        const track = await TrackPlayer.getTrack(event.nextTrack);
        if (track) {
          const newsItem = news[track.newsIndex];
          setCurrentNews(newsItem);
          if (isVoxDeux) {
            const sentence =
              newsItem.conversation[track.speechIndex]?.sentence || '';
            setCurrentSentence(sentence);
          } else {
            const sentence =
              newsItem.speech.speech[track.speechIndex]?.sentence || '';
            setCurrentSentence(sentence);
          }
          onTrackChange?.(newsItem._id);

          // Reset position and start fade in animation
          slideAnim.setValue(20);
          Animated.parallel([
            Animated.timing(opacityAnim, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }),
          ]).start();
        }
      });
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

  const handleNextStory = async () => {
    try {
      const queue = await TrackPlayer.getQueue();
      const currentTrackIndex = await TrackPlayer.getCurrentTrack();
      if (queue.length === 0 || currentTrackIndex === null) return;
      const currentTrack = queue[currentTrackIndex];
      const nextNewsIndex = currentTrack.newsIndex + 1;
      const nextStoryIndex = queue.findIndex(
        t => t.newsIndex === nextNewsIndex && t.speechIndex === 0,
      );
      if (nextStoryIndex !== -1) {
        await TrackPlayer.skip(nextStoryIndex);
        await TrackPlayer.play();
      }
    } catch (e) {
      console.log('Error skipping to next story:', e);
    }
  };

  const handlePreviousStory = async () => {
    try {
      const queue = await TrackPlayer.getQueue();
      const currentTrackIndex = await TrackPlayer.getCurrentTrack();
      if (queue.length === 0 || currentTrackIndex === null) return;
      const currentTrack = queue[currentTrackIndex];
      const prevNewsIndex = currentTrack.newsIndex - 1;
      const prevStoryIndex = queue.findIndex(
        t => t.newsIndex === prevNewsIndex && t.speechIndex === 0,
      );
      if (prevStoryIndex !== -1) {
        await TrackPlayer.skip(prevStoryIndex);
        await TrackPlayer.play();
      }
    } catch (e) {
      console.log('Error skipping to previous story:', e);
    }
  };

  if (!visible) return null;

  return (
    <View style={tw`absolute bottom-0 left-0 right-0`}>
      {/* Top chip/box */}
      <View style={tw`items-center mb-1.5`}>
        <View style={tw`bg-[#1a1a1a] px-5 py-1.5 rounded-full`}>
          <Text style={tw`text-white/80 text-xs font-medium`}>
            {isVoxDeux ? 'VoxDeux' : 'Standard'}
          </Text>
        </View>
      </View>

      {/* Main player container */}
      <View style={tw`bg-[#1a1a1a] pt-3 px-4 pb-6 rounded-t-[20px] shadow-lg`}>
        <View style={tw`items-center`}>
          <Text
            style={tw`text-white/60 text-xs font-medium mb-2 text-center w-[${
              width - 80
            }px]`}
            numberOfLines={1}>
            {currentNews?.headline || 'No audio playing'}
          </Text>

          <Animated.View
            style={[
              tw`w-[${width - 80}px] mb-4`,
              {
                opacity: opacityAnim,
                transform: [{translateY: slideAnim}],
              },
            ]}>
            <Text style={tw`text-white text-[15px] leading-5 text-center`}>
              {currentSentence}
            </Text>
          </Animated.View>

          {isVoxDeux && (
            <Text style={tw`text-white/60 text-xs italic mb-4`}>
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

          <View style={tw`flex-row justify-center items-center gap-8`}>
            <TouchableOpacity
              onPress={handlePreviousStory}
              style={tw`p-2.5 rounded-full bg-white/5 active:bg-white/10 shadow-sm`}>
              <Icon name="backward" size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={togglePlayback}
              style={tw`p-3.5 rounded-full bg-[#4C4AE3] active:bg-[#3a3ad1] shadow-lg shadow-[#4C4AE3]/30`}>
              <Icon
                name={isPlaying ? 'pause' : 'play'}
                size={22}
                color="#fff"
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleNextStory}
              style={tw`p-2.5 rounded-full bg-white/5 active:bg-white/10 shadow-sm`}>
              <Icon name="forward" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
};

export default BottomAudioPlayer;
