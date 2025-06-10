import React, {useRef, useState, useEffect, useCallback, useMemo} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  FlatList,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from '../services/apiService';
import {getImageName} from '../utils/imageUtils';
import Icon from 'react-native-vector-icons/FontAwesome5';
import LinearGradient from 'react-native-linear-gradient';
import tw from '../utils/tailwind';
import {fonts} from '../utils/fonts';
import withAuthCheck from '../utils/withAuthCheck';
import moment from 'moment';
import {imageMap} from '../utils/imageMap';
import BottomAudioPlayer from '../components/BottomAudioPlayer';

type RootStackParamList = {
  Home: undefined;
  Login: undefined;
  NewsPreference: undefined;
  NewsDetails: {news: any[]; newsId: string};
};

type HomeScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Home'
>;

interface HomeScreenProps {
  user?: any; // Make user prop optional
  navigation?: any;
  route?: any;
}

// Dummy data
// const dummyCategories = [
//   'Politics',
//   'Technology',
//   'Sports',
//   'Health',
//   'Science',
//   'Entertainment',
//   'Business',
//   'World News',
// ];

// Skeleton Card Component for loading state
const SkeletonCard = ({
  variant = 'recent',
}: {
  variant?: 'recent' | 'trending';
}) => (
  <View
    style={[
      variant === 'recent'
        ? tw`rounded-xl p-2.5 w-45 h-16 flex-row items-center gap-2`
        : tw`rounded-xl p-2.5 mx-5 my-1.5 h-18 flex-row items-center gap-2`,
      {backgroundColor: 'rgba(255, 255, 255, 0.1)'},
    ]}>
    <View
      style={[
        tw`w-12 h-12 rounded-md`,
        {backgroundColor: 'rgba(255, 255, 255, 0.2)'},
      ]}
    />
    <View style={tw`flex-1`}>
      <View
        style={[
          tw`h-3 rounded mb-1`,
          {backgroundColor: 'rgba(255, 255, 255, 0.2)', width: '80%'},
        ]}
      />
      <View
        style={[
          tw`h-3 rounded`,
          {backgroundColor: 'rgba(255, 255, 255, 0.1)', width: '60%'},
        ]}
      />
    </View>
  </View>
);

const HomeScreen = ({user}: HomeScreenProps) => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const [isVoxBuzzOn, setIsVoxBuzzOn] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [curNewsID, setCurNewsID] = useState<string | null>(null);
  const [trialDaysLeft] = useState(7);
  const [showAudioPlayer, setShowAudioPlayer] = useState(false);
  const [recentNews, setRecentNews] = useState<any[]>([]);
  const [isLoadingRecentNews, setIsLoadingRecentNews] = useState(false);
  const [trendingNews, setTrendingNews] = useState<any[]>([]);
  const [isLoadingTrendingNews, setIsLoadingTrendingNews] = useState(false);

  const recentCategoryCount = useRef<{[key: string]: number}>({});
  const trendingCategoryCount = useRef<{[key: string]: number}>({});
  const imagesRef = useRef<{[key: string]: string}>({});

  // Memoize user categories and preferences
  const userCategories = useMemo(() => {
    if (!user?.newsPreferences) return [];

    if (Array.isArray(user.newsPreferences)) {
      return user.newsPreferences;
    }

    if (typeof user.newsPreferences === 'object') {
      const categories = Object.keys(user.newsPreferences);
      return categories.filter(
        category => user.newsPreferences[category] !== false,
      );
    }

    return [];
  }, [user?.newsPreferences]);

  const flattenedPreferences = useMemo(() => {
    if (!user?.newsPreferences) return [];

    if (Array.isArray(user.newsPreferences)) {
      return user.newsPreferences;
    }

    if (typeof user.newsPreferences === 'object') {
      const allPreferences: string[] = [];
      Object.values(user.newsPreferences).forEach((value: any) => {
        if (Array.isArray(value)) {
          allPreferences.push(...value);
        } else if (value && typeof value === 'string') {
          allPreferences.push(value);
        }
      });
      return allPreferences;
    }

    return [];
  }, [user?.newsPreferences]);

  const loadUserData = useCallback(async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        console.log('Local user data loaded');
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  }, []);

  const handlePlayAudio = useCallback(() => {
    if (!isPlaying) {
      setShowAudioPlayer(true);
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
      setShowAudioPlayer(false);
      setCurNewsID(null);
    }
  }, [isPlaying]);

  const handlePlayAudio1 = useCallback(
    (newsId: string, isRecent: boolean = false) => {
      navigation.navigate('NewsDetails', {
        news: isRecent ? recentNews : trendingNews,
        newsId,
      });
    },
    [navigation, recentNews, trendingNews],
  );

  const renderCategoryItem = useCallback(
    ({item}: {item: string}) => (
      <TouchableOpacity
        style={tw`bg-cardbg rounded-2xl px-4 py-2 border border-gray-600`}>
        <Text style={tw`text-white text-sm font-medium`}>{item}</Text>
      </TouchableOpacity>
    ),
    [],
  );

  const renderRecentNewsItem = useCallback(
    ({item}: {item: any}) => {
      let imageName = getImageName(recentCategoryCount.current, item.category);

      if (!imagesRef.current[item._id]) {
        imagesRef.current[item._id] = imageName;
      }
      imageName = imagesRef.current[item._id];

      return (
        <TouchableOpacity
          style={[
            tw`rounded-xl p-2.5 w-45 h-16 flex-row items-center gap-2`,
            {backgroundColor: 'rgba(255, 255, 255, 0.1)'},
          ]}
          onPress={() => handlePlayAudio1(item._id, true)}>
          <Image
            source={imageMap[imageName]}
            style={tw`w-12 h-12 rounded-md`}
          />
          <Text style={tw`text-white text-sm flex-1 leading-4`}>
            {item.headline.length > 30
              ? item.headline.substring(0, 30) + '..'
              : item.headline}
          </Text>
        </TouchableOpacity>
      );
    },
    [handlePlayAudio1],
  );

  const renderTrendingNewsItem = useCallback(
    ({item, index}: {item: any; index: number}) => {
      let imageName = getImageName(
        trendingCategoryCount.current,
        item.category,
      );

      if (!imagesRef.current[item._id]) {
        imagesRef.current[item._id] = imageName;
      }
      imageName = imagesRef.current[item._id];

      const isActive = item._id === curNewsID;

      return (
        <TouchableOpacity
          style={[
            tw`rounded-xl p-2.5 mx-5 my-1.5 h-18 flex-row items-center gap-2 relative`,
            {
              backgroundColor: isActive
                ? '#6f70aa'
                : 'rgba(255, 255, 255, 0.1)',
            },
          ]}
          onPress={() => handlePlayAudio1(item._id, false)}>
          {isActive && (
            <View style={[tw`absolute -top-2 -right-1 py-0.5 rounded-xl z-10`]}>
              <LinearGradient
                colors={['#4C4AE3', '#8887EE']}
                start={{x: 0, y: 0}}
                end={{x: 0, y: 1}}
                style={tw`rounded-xl`}>
                <Text style={tw`text-white text-xs font-bold px-2 py-0.5`}>
                  tell me more
                </Text>
              </LinearGradient>
            </View>
          )}
          <Image
            source={imageMap[imageName]}
            style={tw`w-12 h-13 rounded-md`}
          />
          <View style={tw`flex-1`}>
            <Text style={[tw`text-xs mb-0.5`, {color: '#947EFB'}]}>
              #{index + 1}
            </Text>
            <Text style={tw`text-white text-sm font-medium`}>
              {item.headline.length > 15
                ? item.headline.substring(0, 15) + '..'
                : item.headline}
              <Text
                style={[tw`font-normal`, {color: 'rgba(255, 255, 255, 0.5)'}]}>
                {item.description.length > 38
                  ? item.description.substring(0, 38) + '..'
                  : item.description}
              </Text>
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [curNewsID, handlePlayAudio1],
  );

  // mapConvo function to process the news data
  const mapConvo = useCallback((convos: any) => {
    return convos
      .filter((n: any) => n?.conversation)
      .map((n: any) => ({
        ...n,
        conversation: n?.conversation.map((c: any) => ({
          ...c,
          newsId: n._id,
        })),
      }));
  }, []);

  useEffect(() => {
    const getRNews = async (newsPreferences: any) => {
      try {
        setIsLoadingRecentNews(true);
        const response: any = await apiService.get('user/recent-news', {
          newsPreferences: newsPreferences.join(','),
        });

        const filteredNews = response?.result.filter(
          (n: any) =>
            (n?.generateVoxDex && n?.conversation?.length) ||
            !n?.generateVoxDex,
        );

        const sortedNews = [...filteredNews].sort((a, b) => {
          const aHasVoxDex = a?.generateVoxDex && a?.conversation?.length;
          const bHasVoxDex = b?.generateVoxDex && b?.conversation?.length;

          if (aHasVoxDex && !bHasVoxDex) return -1;
          if (!aHasVoxDex && bHasVoxDex) return 1;
          return 0;
        });

        setRecentNews(mapConvo(sortedNews));
      } catch (error) {
        console.error('Error fetching recent news:', error);
        setRecentNews([]);
      } finally {
        setIsLoadingRecentNews(false);
      }
    };

    const getTNews = async (newsPreferences: any) => {
      try {
        setIsLoadingTrendingNews(true);
        const response: any = await apiService.get('user/trending-news', {
          newsPreferences: newsPreferences.join(','),
          clientUnixTimestamp: moment.utc().unix(),
        });

        const filteredNews = response?.result.filter(
          (n: any) =>
            (n?.generateVoxDex && n?.conversation?.length) ||
            !n?.generateVoxDex,
        );

        const sortedNews = [...filteredNews].sort((a, b) => {
          const aHasVoxDex = a?.generateVoxDex && a?.conversation?.length;
          const bHasVoxDex = b?.generateVoxDex && b?.conversation?.length;

          if (aHasVoxDex && !bHasVoxDex) return -1;
          if (!aHasVoxDex && bHasVoxDex) return 1;
          return 0;
        });

        setTrendingNews(mapConvo(sortedNews));
      } catch (error) {
        console.error('Error fetching trending news:', error);
        setTrendingNews([]);
      } finally {
        setIsLoadingTrendingNews(false);
      }
    };

    loadUserData();
    if (flattenedPreferences.length > 0) {
      getRNews(flattenedPreferences);
      getTNews(flattenedPreferences);
    }
  }, [flattenedPreferences, loadUserData, mapConvo]);

  // Add this before the trending topics section rendering
  const filteredTrendingNews = isVoxBuzzOn
    ? trendingNews.filter(
        n => n.generateVoxDex && n.conversation && n.conversation.length > 0,
      )
    : trendingNews;

  return (
    <View style={[tw`flex-1 p-0 m-0`, {backgroundColor: '#0A0710'}]}>
      {/* Background Image */}
      <Image
        source={require('../assets/homepageimage.png')}
        style={[tw`absolute top-32 left-0`, {width: '100%', height: '100%'}]}
        resizeMode="cover"
      />
      {/* Header */}
      <View style={tw`flex-row justify-between items-center px-5 pt-14 pb-4`}>
        <Text
          style={[
            tw`text-white text-3xl`,
            {fontFamily: fonts.ThabitBold.regular},
          ]}>
          AI News
        </Text>
        <View style={tw`flex-row items-center gap-3`}>
          {(user?.trialDaysLeft || trialDaysLeft) && (
            <TouchableOpacity>
              <LinearGradient
                start={{x: 0, y: 0}}
                colors={['#4C4AE3', '#8887EE']}
                end={{x: 1, y: 0}}
                style={[tw`rounded-xl `, {}]}>
                <Text
                  style={tw`text-white text-xs font-semibold px-4 py-1.5 `}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  allowFontScaling>
                  {user?.trialDaysLeft || trialDaysLeft} days left in trial !
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => navigation.navigate('NewsPreference')}>
            <Image
              source={
                user?.picture
                  ? {uri: user.picture}
                  : require('../assets/justmodel.png')
              }
              style={tw`w-10 h-10 rounded-full`}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={tw`flex-1`} showsVerticalScrollIndicator={false}>
        {/* Categories Section */}
        <Text style={tw`text-white text-base font-semibold ml-5 mt-2 mb-3`}>
          Your Interests 🔥
        </Text>
        {userCategories.length > 0 ? (
          <FlatList
            data={userCategories}
            renderItem={renderCategoryItem}
            keyExtractor={(item, index) => index.toString()}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={tw`pl-5 pr-5 gap-3`}
          />
        ) : (
          <View style={tw`mx-5 mb-4`}>
            <View
              style={[
                tw`rounded-xl p-4 border border-gray-600`,
                {backgroundColor: 'rgba(255, 255, 255, 0.1)'},
              ]}>
              <Text style={tw`text-white text-sm mb-2`}>
                No interests selected yet
              </Text>
              <Text style={tw`text-gray-400 text-xs mb-3`}>
                Select your news preferences to get personalized content
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('NewsPreference')}
                style={[
                  tw`px-4 py-2 rounded-lg`,
                  {backgroundColor: '#947EFB'},
                ]}>
                <Text style={tw`text-white text-xs font-semibold text-center`}>
                  Choose Interests
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Recent News Section */}
        <View style={tw`mt-5`}>
          <Text style={tw`text-white text-base font-semibold ml-5 mt-2 mb-3`}>
            Recent News
          </Text>
          {isLoadingRecentNews ? (
            <FlatList
              data={Array.from({length: 5}, (_, index) => ({index}))}
              renderItem={() => <SkeletonCard variant="recent" />}
              keyExtractor={(_, index) => index.toString()}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={tw`pl-5 pr-5 gap-3`}
            />
          ) : recentNews.length > 0 ? (
            <FlatList
              data={recentNews}
              renderItem={renderRecentNewsItem}
              keyExtractor={item => item._id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={tw`pl-5 pr-5 gap-3`}
            />
          ) : null}
        </View>

        {/* Mode Toggle */}
        <View style={tw`mt-9 relative`}>
          <View style={[tw`h-px`, {backgroundColor: '#4b4b55'}]} />
          <View
            style={[
              tw`absolute -top-4 self-center flex-row rounded-3xl py-0 px-0 `,
              {backgroundColor: '#4b4b55'},
            ]}>
            <TouchableOpacity
              style={tw`px-1 py-1 rounded-2xl`}
              onPress={() => setIsVoxBuzzOn(false)}>
              {!isVoxBuzzOn ? (
                <LinearGradient
                  colors={['#1e3a8a', '#6366f1']}
                  start={{x: 0, y: 0}}
                  end={{x: 1, y: 0}}
                  style={tw`rounded-2xl`}>
                  <Text style={tw`text-xs px-2 py-1 text-white`}>Standard</Text>
                </LinearGradient>
              ) : (
                <View style={tw`px-1 py-1`}>
                  <Text style={[tw`text-xs`, {color: '#9ca3af'}]}>
                    Standard
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={tw`px-1 py-1 rounded-2xl`}
              onPress={() => setIsVoxBuzzOn(true)}>
              {isVoxBuzzOn ? (
                <LinearGradient
                  colors={['#1e3a8a', '#6366f1']}
                  start={{x: 0, y: 0}}
                  end={{x: 1, y: 0}}
                  style={tw`rounded-2xl`}>
                  <Text style={tw`text-xs text-white px-2 py-1`}>Vox Deux</Text>
                </LinearGradient>
              ) : (
                <View style={tw`px-2 py-1`}>
                  <Text style={[tw`text-xs`, {color: '#9ca3af'}]}>
                    Vox Deux
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Trending Topics Section */}
        <View style={tw`mt-5 mb-2.5`}>
          <View style={tw`flex-row justify-between items-center px-5 mb-2`}>
            <Text style={tw`text-white text-base font-semibold`}>
              Trending Topics ⚡
            </Text>
            <TouchableOpacity onPress={handlePlayAudio}>
              <LinearGradient
                colors={['#4C4AE3', '#8887EE']}
                start={{x: 0, y: 0}}
                end={{x: 0, y: 1}}
                style={tw`rounded-3xl `}>
                <View
                  style={tw`flex-row items-center gap-1 px-3.5 py-1 gap-1  `}>
                  <Icon
                    name={!isPlaying ? 'play' : 'pause'}
                    size={12}
                    color="#ffffff"
                  />
                  <Text style={tw`text-white text-xs font-semibold `}>
                    {!isPlaying ? 'Play all' : 'Stop'}
                  </Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>
          <View>
            {isLoadingTrendingNews ? (
              Array.from({length: 5}, (_, index) => (
                <SkeletonCard key={index} variant="trending" />
              ))
            ) : filteredTrendingNews.length > 0 ? (
              filteredTrendingNews.map((item, index) => (
                <View key={item._id}>
                  {renderTrendingNewsItem({item, index})}
                </View>
              ))
            ) : (
              <Text style={tw`text-gray-400 text-center mt-4`}>
                No trending news found.
              </Text>
            )}
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          onPress={async () => {
            setShowAudioPlayer(false);
            setIsPlaying(false);
            setCurNewsID(null); // Reset the tell me more state
          }}
          style={[
            tw`m-5 p-4 rounded-xl items-center`,
            {backgroundColor: '#dc2626'},
          ]}>
          <Text style={tw`text-white text-base font-semibold`}>Logout</Text>
        </TouchableOpacity>

        <View style={tw`h-25`} />
      </ScrollView>

      {/* Audio Player */}
      {showAudioPlayer && (
        <BottomAudioPlayer
          visible={showAudioPlayer}
          news={
            isVoxBuzzOn
              ? trendingNews.filter(
                  n =>
                    n.generateVoxDex &&
                    n.conversation &&
                    n.conversation.length > 0,
                )
              : trendingNews
          }
          onTrackChange={setCurNewsID}
          isVoxDeux={isVoxBuzzOn}
          onClose={() => {
            setShowAudioPlayer(false);
            setIsPlaying(false);
            setCurNewsID(null);
          }}
        />
      )}
    </View>
  );
};

export default withAuthCheck(HomeScreen);
