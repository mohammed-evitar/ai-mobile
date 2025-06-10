import React, {useState, useRef, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  SafeAreaView,
  FlatList,
} from 'react-native';
import {
  useNavigation,
  useRoute,
  useFocusEffect,
} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/FontAwesome5';
import tw from '../utils/tailwind';
import {fonts} from '../utils/fonts';
import {getImageName} from '../utils/imageUtils';
import {imageMap} from '../utils/imageMap';
import LinearGradient from 'react-native-linear-gradient';
import apiService from '../services/apiService';
import BottomAudioPlayer from '../components/BottomAudioPlayer';
import AsyncStorage from '@react-native-async-storage/async-storage';

type RootStackParamList = {
  Home: undefined;
  NewsDetails: {news: any[]; newsId: string};
};

type CategoryScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'NewsDetails'
>;

interface RouteParams {
  categoryName: string;
}

const CategoryScreen = () => {
  const navigation = useNavigation<CategoryScreenNavigationProp>();
  const route = useRoute();
  const {categoryName} = route.params as RouteParams;

  const [news, setNews] = useState<any[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [curNewsID, setCurNewsID] = useState<string | null>(null);
  const [showAudioPlayer, setShowAudioPlayer] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null);

  const categoryCount = useRef<{[key: string]: number}>({});
  const imagesRef = useRef<{[key: string]: string}>({});

  // Reset states when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      setIsPlaying(false);
      setShowAudioPlayer(false);
      setCurNewsID(null);
    }, []),
  );

  const getNews = useCallback(async () => {
    try {
      setIsLoading(true);
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        const parsedUser = JSON.parse(userData);
        setTrialDaysLeft(parsedUser.trialDaysLeft);

        const newsPreferences = parsedUser.newsPreferences[categoryName];
        const response: any = await apiService.post('user/category-news/', {
          newsPreferences,
        });

        const filteredNews = response?.news
          .filter(
            (n: any) =>
              (n?.generateVoxDex && n?.conversation?.length) ||
              !n?.generateVoxDex,
          )
          .filter((n: any) => n?.conversation)
          .map((n: any) => ({
            ...n,
            conversation: n?.conversation.map((c: any) => ({
              ...c,
              newsId: n._id,
            })),
          }));

        const sortedNews = [...filteredNews].sort((a, b) => {
          const aHasVoxDex = a?.generateVoxDex && a?.conversation?.length;
          const bHasVoxDex = b?.generateVoxDex && b?.conversation?.length;

          if (aHasVoxDex && !bHasVoxDex) return -1;
          if (!aHasVoxDex && bHasVoxDex) return 1;
          return 0;
        });

        setNews(sortedNews);
      }
    } catch (error) {
      console.error('Error fetching category news:', error);
      setNews([]);
    } finally {
      setIsLoading(false);
    }
  }, [categoryName]);

  useEffect(() => {
    getNews();
  }, [getNews]);

  const handlePlayAudio = () => {
    if (!isPlaying) {
      setShowAudioPlayer(true);
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
      setShowAudioPlayer(false);
      setCurNewsID(null);
    }
  };

  const handlePlayNews = (newsId: string) => {
    navigation.navigate('NewsDetails', {
      news: news,
      newsId,
    });
  };

  const renderNewsItem = ({item, index}: {item: any; index: number}) => {
    let imageName = getImageName(categoryCount.current, item.category);

    if (!imagesRef.current[item._id]) {
      imagesRef.current[item._id] = imageName;
    }
    imageName = imagesRef.current[item._id];

    const isActive = item._id === curNewsID;

    return (
      <TouchableOpacity
        onPress={() => handlePlayNews(item._id)}
        style={[
          tw`rounded-xl p-2.5 mx-5 my-1.5 h-18 flex-row items-center gap-2 relative`,
          {
            backgroundColor: isActive ? '#6f70aa' : 'rgba(255, 255, 255, 0.1)',
          },
        ]}>
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
        <Image source={imageMap[imageName]} style={tw`w-12 h-13 rounded-md`} />
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
  };

  return (
    <SafeAreaView style={tw`flex-1 bg-[#0A0710]`}>
      {/* Header */}
      <View style={tw`flex-row items-center px-5 py-4 w-full pr-7 gap-9`}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={tw`bg-[#1a1a1a] rounded-lg p-2`}>
          <Icon name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text
          style={[
            tw`text-white text-[20px] tracking-wider flex-1`,
            {fontFamily: fonts.ThabitBold.regular},
          ]}>
          {categoryName}
        </Text>
        {trialDaysLeft !== undefined && trialDaysLeft !== null && (
          <TouchableOpacity>
            <LinearGradient
              colors={['#4C4AE3', '#8887EE']}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 0}}
              style={tw`rounded-xl`}>
              <Text
                style={tw`text-white text-xs font-semibold px-4 py-1.5`}
                numberOfLines={1}
                adjustsFontSizeToFit>
                {trialDaysLeft} days left in trial
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      <View style={tw`flex-1`}>
        {!!news.length && (
          <View style={tw`flex-row justify-end pr-5 mb-2`}>
            <TouchableOpacity
              onPress={handlePlayAudio}
              style={tw`opacity-${
                isLoading || news.length === 0 ? '50' : '100'
              }`}
              disabled={isLoading || news.length === 0}>
              <LinearGradient
                colors={['#4C4AE3', '#8887EE']}
                start={{x: 0, y: 0}}
                end={{x: 0, y: 1}}
                style={tw`rounded-3xl`}>
                <View style={tw`flex-row items-center gap-1 px-3.5 py-1`}>
                  <Icon
                    name={!isPlaying ? 'play' : 'pause'}
                    size={12}
                    color="#ffffff"
                  />
                  <Text style={tw`text-white text-xs font-semibold`}>
                    {!isPlaying ? 'Play all' : 'Stop'}
                  </Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {isLoading ? (
          // Loading skeleton
          Array.from({length: 5}, (_, index) => (
            <View
              key={index}
              style={[
                tw`rounded-xl p-2.5 mx-5 my-1.5 h-18 flex-row items-center gap-2`,
                {backgroundColor: 'rgba(255, 255, 255, 0.1)'},
              ]}>
              <View
                style={[
                  tw`w-12 h-13 rounded-md`,
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
          ))
        ) : (
          <FlatList
            data={news}
            renderItem={renderNewsItem}
            keyExtractor={item => item._id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={tw`pb-32`}
          />
        )}
      </View>

      {/* Audio Player */}
      {showAudioPlayer && (
        <BottomAudioPlayer
          visible={showAudioPlayer}
          news={news}
          onTrackChange={setCurNewsID}
          onClose={() => {
            setShowAudioPlayer(false);
            setIsPlaying(false);
            setCurNewsID(null);
          }}
        />
      )}
    </SafeAreaView>
  );
};

export default CategoryScreen;
