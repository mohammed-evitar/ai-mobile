import React, {useState, useRef, useEffect} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  Modal,
  SafeAreaView,
  Animated,
  Dimensions,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import tw from '../utils/tailwind';
import {fonts} from '../utils/fonts';
import {getImageName} from '../utils/imageUtils';
import {imageMap} from '../utils/imageMap';
import TrackPlayer, {
  Event,
  useTrackPlayerEvents,
} from 'react-native-track-player';
import {setupPlayer, buildQueue} from '../services/trackPlayerService';
import {NewsItem} from '../types/news';
import LinearGradient from 'react-native-linear-gradient';

interface RouteParams {
  news: NewsItem[];
  newsId: string;
}

const NewsDetailsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const {news, newsId} = route.params as RouteParams;

  const [isVoxBuzzOn, setIsVoxBuzzOn] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentNews, setCurrentNews] = useState<NewsItem | null>(null);
  const [showProModal, setShowProModal] = useState(false);
  const [allSubtitles, setAllSubtitles] = useState<
    {text: string; index: number}[]
  >([]);
  const [currentSubtitleIndex, setCurrentSubtitleIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const {height} = Dimensions.get('window');

  const isPlayingRef = useRef(false);

  useEffect(() => {
    const setupAndPlay = async () => {
      try {
        await setupPlayer();
        if (news && newsId) {
          const initialNews = news.find(item => item._id === newsId);
          if (initialNews) {
            setCurrentNews(initialNews);
            setCurrentSubtitleIndex(0); // Set initial subtitle index

            // Use buildQueue to handle extended speech
            const queue = buildQueue([initialNews], false); // false for standard mode
            await TrackPlayer.reset();
            await TrackPlayer.add(queue);

            // Start playback
            await TrackPlayer.play();
            setIsPlaying(true);
            isPlayingRef.current = true;

            // Scroll to first subtitle after a short delay to ensure layout is complete
            setTimeout(() => {
              scrollViewRef.current?.scrollTo({y: 0, animated: false});
            }, 100);
          }
        }
      } catch (error) {
        console.error('Error setting up player:', error);
      }
    };

    setupAndPlay();

    return () => {
      TrackPlayer.reset();
    };
  }, [news, newsId]);

  useEffect(() => {
    if (currentNews) {
      const subtitles = isVoxBuzzOn
        ? currentNews.conversation?.map((c, index) => ({
            text: c.sentence,
            index,
          })) || []
        : currentNews.extended_speech.speech.map((s, index) => ({
            text: s.sentence,
            index,
          }));
      setAllSubtitles(subtitles);
      // Reset scroll position when news changes
      scrollViewRef.current?.scrollTo({y: 0, animated: false});
      setCurrentSubtitleIndex(0);
    }
  }, [currentNews, isVoxBuzzOn]);

  useTrackPlayerEvents(
    [Event.PlaybackTrackChanged, Event.PlaybackQueueEnded],
    async event => {
      if (event.type === Event.PlaybackQueueEnded) {
        // Auto play next article
        const currentIndex = news.findIndex(
          item => item._id === currentNews?._id,
        );
        if (currentIndex < news.length - 1) {
          const nextNews = news[currentIndex + 1];

          // Play transition sound
          await TrackPlayer.reset();
          await TrackPlayer.add({
            id: 'transition',
            url: 'https://d279zq803tcyfh.cloudfront.net/transition.mp3',
            title: 'Article Transition',
            artist: 'System',
            newsIndex: -1,
            speechIndex: -1,
            sentence: '',
          });
          await TrackPlayer.play();

          // Wait for transition to finish
          await new Promise(resolve => setTimeout(resolve, 500));

          setCurrentNews(nextNews);

          // Reset and rebuild queue with next news
          const queue = buildQueue([nextNews], isVoxBuzzOn);
          await TrackPlayer.reset();
          await TrackPlayer.add(queue);
          await TrackPlayer.play();
          setIsPlaying(true);
          isPlayingRef.current = true;
        }
      } else if (
        event.type === Event.PlaybackTrackChanged &&
        event.nextTrack !== undefined
      ) {
        const track = await TrackPlayer.getTrack(event.nextTrack);
        if (track) {
          // Update current subtitle index
          setCurrentSubtitleIndex(track.speechIndex);

          // Fade out current subtitle
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            // Fade in new subtitle
            Animated.timing(fadeAnim, {
              toValue: 1,
              duration: 200,
              useNativeDriver: true,
            }).start();
          });

          // Scroll to current subtitle
          scrollViewRef.current?.scrollTo({
            y: track.speechIndex * 80, // Approximate height of each subtitle
            animated: true,
          });
        }
      }
    },
  );

  const handlePlayAudio = async () => {
    if (!isPlaying) {
      setIsPlaying(true);
      isPlayingRef.current = true;
      await TrackPlayer.play();
    } else {
      setIsPlaying(false);
      isPlayingRef.current = false;
      await TrackPlayer.pause();
    }
  };

  const handleBackwardNews = async () => {
    try {
      const currentIndex = news.findIndex(
        item => item._id === currentNews?._id,
      );
      if (currentIndex > 0) {
        const prevNews = news[currentIndex - 1];
        setCurrentNews(prevNews);

        // Reset and rebuild queue with previous news
        const queue = buildQueue([prevNews], isVoxBuzzOn);
        await TrackPlayer.reset();
        await TrackPlayer.add(queue);
        await TrackPlayer.play();
        setIsPlaying(true);
        isPlayingRef.current = true;
      }
    } catch (e) {
      console.log('Error skipping to previous story:', e);
    }
  };

  const handleForwardNews = async () => {
    try {
      const currentIndex = news.findIndex(
        item => item._id === currentNews?._id,
      );
      if (currentIndex < news.length - 1) {
        const nextNews = news[currentIndex + 1];
        setCurrentNews(nextNews);

        // Reset and rebuild queue with next news
        const queue = buildQueue([nextNews], isVoxBuzzOn);
        await TrackPlayer.reset();
        await TrackPlayer.add(queue);
        await TrackPlayer.play();
        setIsPlaying(true);
        isPlayingRef.current = true;
      }
    } catch (e) {
      console.log('Error skipping to next story:', e);
    }
  };

  const handleVoxBuzzToggle = async (desiredVoxBuzzOn: boolean) => {
    if (desiredVoxBuzzOn === isVoxBuzzOn) return;

    // Check if current news supports VoxDeux
    if (desiredVoxBuzzOn && currentNews && !currentNews.generateVoxDex) {
      setShowProModal(true);
      return;
    }

    try {
      // Pause current playback if any
      await TrackPlayer.pause();

      // Update mode
      setIsVoxBuzzOn(desiredVoxBuzzOn);

      if (!currentNews) return;

      // Reset and rebuild queue based on mode
      const queue = buildQueue([currentNews], desiredVoxBuzzOn);
      await TrackPlayer.reset();
      await TrackPlayer.add(queue);

      // Start playing immediately
      await TrackPlayer.play();
      setIsPlaying(true);
      isPlayingRef.current = true;
    } catch (error) {
      console.log('Error during mode transition:', error);
    }
  };

  return (
    <SafeAreaView style={tw`flex-1 bg-[#040439]`}>
      <View style={tw`flex-1`}>
        {/* Background Effects */}
        <Image
          source={require('../assets/audiopage-left.png')}
          style={tw`absolute top-40 left-0 h-[500px]`}
          resizeMode="contain"
        />
        <Image
          source={require('../assets/audiopage-right.png')}
          style={tw`absolute top-10 right-0 h-[500px]`}
          resizeMode="contain"
        />

        {/* Header */}
        <View
          style={tw`flex-row items-center px-5 py-6 gap-2 bg-[#040439] z-10`}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={tw`bg-white/10 rounded-lg p-2`}>
            <Icon name="arrow-left" size={20} color="#fff" />
          </TouchableOpacity>
          <Text
            style={[
              tw`text-white text-base flex-1`,
              {fontFamily: fonts.ThabitBold.regular},
            ]}
            numberOfLines={1}>
            {currentNews?.headline || 'Loading...'}
          </Text>
        </View>

        {/* Mode Toggle */}
        <View style={tw`relative bg-[#040439] z-10`}>
          <View style={tw`h-px bg-[#555593]`} />
          <View
            style={tw`absolute -top-3 self-center bg-[#38386f] rounded-full p-1 flex-row`}>
            <TouchableOpacity
              onPress={() => handleVoxBuzzToggle(false)}
              style={tw`rounded-full`}>
              {!isVoxBuzzOn ? (
                <LinearGradient
                  colors={['#1e3a8a', '#6366f1']}
                  start={{x: 0, y: 0}}
                  end={{x: 1, y: 0}}
                  style={tw`rounded-full`}>
                  <Text style={tw`text-white text-xs px-3 py-1`}>Standard</Text>
                </LinearGradient>
              ) : (
                <Text style={tw`text-white text-xs px-3 py-1`}>Standard</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleVoxBuzzToggle(true)}
              style={tw` rounded-full`}>
              {isVoxBuzzOn ? (
                <LinearGradient
                  colors={['#1e3a8a', '#6366f1']}
                  start={{x: 0, y: 0}}
                  end={{x: 1, y: 0}}
                  style={tw`rounded-full`}>
                  <Text style={tw`text-white text-xs px-3 py-1`}>Vox Deux</Text>
                </LinearGradient>
              ) : (
                <Text style={tw`text-white text-xs px-3 py-1`}>Vox Deux</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Content */}
        <ScrollView
          ref={scrollViewRef}
          style={tw`flex-1`}
          contentContainerStyle={tw`pb-48 pt-4`}
          showsVerticalScrollIndicator={false}>
          <View style={tw`px-6 min-h-[${height * 0.6}px] justify-start mt-16`}>
            {allSubtitles.map((subtitle, index) => (
              <Text
                key={`subtitle-${index}`}
                style={[
                  tw`text-center text-base`,
                  index === currentSubtitleIndex
                    ? tw`text-white font-medium`
                    : tw`text-white/40`,
                  index === allSubtitles.length - 1 ? tw`mb-24` : tw`mb-6`,
                ]}>
                {subtitle.text}
              </Text>
            ))}
          </View>
        </ScrollView>

        {/* Player Controls */}
        <View style={tw`absolute bottom-0 left-0 right-0 bg-[#040439] pt-4 `}>
          <View style={tw`h-px bg-[#555593] mb-5`} />

          {/* Current News Card with Model */}
          {currentNews && (
            <View style={tw`px-4 mb-3`}>
              <View
                style={tw`bg-white/10 rounded-xl p-3 flex-row items-center relative`}>
                <Image
                  source={imageMap[getImageName({}, currentNews.category)]}
                  style={tw`w-12 h-12 rounded-md`}
                />
                <View style={tw`flex-1 ml-3`}>
                  <Text
                    style={tw`text-white text-sm font-medium`}
                    numberOfLines={1}>
                    {currentNews.headline}
                  </Text>
                  <Text style={tw`text-white/50 text-xs`} numberOfLines={2}>
                    {currentNews.description}
                  </Text>
                </View>
                <Image
                  source={require('../assets/justmodel.png')}
                  style={[tw`w-32 h-48 absolute -right-4 -top-20`]}
                  resizeMode="contain"
                />
              </View>
            </View>
          )}

          <View style={tw`flex-row justify-center items-center gap-6`}>
            <TouchableOpacity
              onPress={handleBackwardNews}
              style={tw`bg-white/10 p-2.5 rounded-lg transform scale-90`}>
              <Icon name="backward" size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handlePlayAudio}
              style={tw`p-4 rounded-full bg-[#4C68F5] active:bg-[#3a3ad1] shadow-lg shadow-[#4C4AE3]/30`}>
              <Icon
                name={isPlaying ? 'pause' : 'play'}
                size={24}
                color="#fff"
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleForwardNews}
              style={tw`bg-white/10 p-2.5 rounded-lg transform scale-90`}>
              <Icon name="forward" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Premium Modal */}
        <Modal
          visible={showProModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowProModal(false)}>
          <View style={tw`flex-1 bg-black/50 justify-center items-center`}>
            <View
              style={tw`bg-[#1a1a1a] rounded-xl p-6 m-4 w-[90%] max-w-[400px]`}>
              <Text style={tw`text-white text-xl font-bold mb-4 text-center`}>
                Premium Feature
              </Text>
              <Text style={tw`text-white/80 text-base mb-6 text-center`}>
                This news article is available in Vox Deux mode for premium
                users only.
              </Text>
              <TouchableOpacity
                onPress={() => setShowProModal(false)}
                style={tw`bg-[#4C4AE3] py-3 rounded-lg`}>
                <Text style={tw`text-white text-center font-medium`}>
                  Continue with Standard Mode
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
};

export default NewsDetailsScreen;
