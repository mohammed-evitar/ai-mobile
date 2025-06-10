import React, {useRef, useState} from 'react';
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

type RootStackParamList = {
  Home: undefined;
  Login: undefined;
  NewsPreference: undefined;
};

type HomeScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Home'
>;

interface HomeScreenProps {
  user: any; // User data from withAuthCheck HOC
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

  // Recent News API integration
  const [recentNews, setRecentNews] = useState<any[]>([]);
  const [isLoadingRecentNews, setIsLoadingRecentNews] = useState(false);

  // Subscription data - you may want to get this from user object or separate API
  const subscriptionData = {
    isSubscriptionExpired: false, // This should come from your subscription logic
  };

  // Use user data from HOC
  console.log('Authenticated user:', user);

  // Get user's selected categories/interests
  const getUserCategories = () => {
    if (!user?.newsPreferences) return [];

    // Handle different possible data structures
    if (Array.isArray(user.newsPreferences)) {
      return user.newsPreferences;
    }

    if (typeof user.newsPreferences === 'object') {
      // If it's an object, get the keys (category names)
      const categories = Object.keys(user.newsPreferences);
      // Filter out any categories that might be set to false
      return categories.filter(
        category => user.newsPreferences[category] !== false,
      );
    }

    return [];
  };

  // Get flattened subcategories for API calls
  const getFlattenedPreferences = () => {
    if (!user?.newsPreferences) return [];

    // Handle different possible data structures
    if (Array.isArray(user.newsPreferences)) {
      return user.newsPreferences;
    }

    if (typeof user.newsPreferences === 'object') {
      // Extract all values from the newsPreferences object and flatten them
      const allPreferences: string[] = [];

      Object.values(user.newsPreferences).forEach((value: any) => {
        if (Array.isArray(value)) {
          // If value is an array, add all items
          allPreferences.push(...value);
        } else if (value && typeof value === 'string') {
          // If value is a string, add it
          allPreferences.push(value);
        }
      });

      return allPreferences;
    }

    return [];
  };

  const userCategories = getUserCategories(); // For display
  const flattenedPreferences = getFlattenedPreferences(); // For API
  console.log('User categories (for display):', userCategories);
  console.log('Flattened preferences (for API):', flattenedPreferences);

  const recentCategoryCount = useRef<{[key: string]: number}>({});
  const trendingCategoryCount = useRef<{[key: string]: number}>({});
  const imagesRef = useRef<{[key: string]: string}>({});

  const [trendingNews, setTrendingNews] = useState<any[]>([]);
  const [isLoadingTrendingNews, setIsLoadingTrendingNews] = useState(false);

  React.useEffect(() => {
    loadUserData();
    // Call getRNews and getTNews when component mounts if user has categories
    if (flattenedPreferences.length > 0) {
      getRNews(flattenedPreferences);
      getTNews(flattenedPreferences);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadUserData = async () => {
    try {
      // User data is already available from HOC, but keep existing logic for compatibility
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        console.log('Local user data loaded');
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await apiService.clearToken();
      navigation.reset({
        index: 0,
        routes: [{name: 'Login'}],
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handlePlayAudio = () => {
    setIsPlaying(!isPlaying);
  };

  const handlePlayAudio1 = (newsId: string) => {
    setCurNewsID(newsId);
  };

  const renderCategoryItem = ({item}: {item: string}) => (
    <TouchableOpacity
      style={tw`bg-cardbg rounded-2xl px-4 py-2 border border-gray-600`}>
      <Text style={tw`text-white text-sm font-medium`}>{item}</Text>
    </TouchableOpacity>
  );

  // mapConvo function to process the news data
  const mapConvo = (newsData: any[]) => {
    // This function should process the conversation data
    // You may need to adjust this based on your specific requirements
    return newsData.map((item: any) => ({
      ...item,
      // Add any additional processing here
    }));
  };

  // Get Recent News function exactly as specified
  const getRNews = async (newsPreferences: any) => {
    if (subscriptionData?.isSubscriptionExpired) return;

    try {
      setIsLoadingRecentNews(true);
      const unixTimestamp = moment.utc().unix();
      console.log('Unix timestamp:', unixTimestamp);
      console.log('Sending newsPreferences to API:', newsPreferences);
      console.log(
        'newsPreferences as comma-separated string:',
        newsPreferences.join(','),
      );

      const response: any = await apiService.get('user/recent-news', {
        newsPreferences: newsPreferences.join(','),
      });

      console.log('API Response:', response); // Print response to console

      // First filter the news
      const filteredNews = response?.result.filter(
        (n: any) =>
          (n?.generateVoxDex && n?.conversation?.length) || !n?.generateVoxDex,
      );

      // Then sort the filtered news to put items with generateVoxDex and conversation length at the top
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
      setRecentNews([]); // Just set empty array, no dummy data
    } finally {
      setIsLoadingRecentNews(false);
    }
  };

  const getTNews = async (newsPreferences: any) => {
    if (subscriptionData?.isSubscriptionExpired) return;

    try {
      setIsLoadingTrendingNews(true);
      const unixTimestamp = moment.utc().unix();
      const response: any = await apiService.get('user/trending-news', {
        newsPreferences: newsPreferences.join(','),
        clientUnixTimestamp: unixTimestamp,
      });

      // First filter the news
      const filteredNews = response?.result.filter(
        (n: any) =>
          (n?.generateVoxDex && n?.conversation?.length) || !n?.generateVoxDex,
      );

      // Then sort the filtered news to put items with generateVoxDex and conversation length at the top
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

  const renderRecentNewsItem = ({item}: {item: any}) => {
    let imageName = getImageName(recentCategoryCount.current, item.category);

    if (!imagesRef.current[item._id]) {
      imagesRef.current[item._id] = imageName;
    }
    imageName = imagesRef.current[item._id];

    console.log('imageName', imageName);

    return (
      <TouchableOpacity
        style={[
          tw`rounded-xl p-2.5 w-45 h-16 flex-row items-center gap-2`,
          {backgroundColor: 'rgba(255, 255, 255, 0.1)'},
        ]}
        onPress={() => handlePlayAudio1(item._id)}>
        <Image source={imageMap[imageName]} style={tw`w-12 h-12 rounded-md`} />
        <Text style={tw`text-white text-sm flex-1 leading-4`}>
          {item.headline.length > 30
            ? item.headline.substring(0, 30) + '..'
            : item.headline}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderTrendingNewsItem = ({
    item,
    index,
  }: {
    item: any;
    index: number;
  }) => {
    let imageName = getImageName(trendingCategoryCount.current, item.category);

    if (!imagesRef.current[item._id]) {
      imagesRef.current[item._id] = imageName;
    }
    imageName = imagesRef.current[item._id];

    const isActive = item._id === curNewsID;

    return (
      <TouchableOpacity
        style={[
          tw`rounded-xl p-2.5 mx-5 my-1.5 h-18 flex-row items-center gap-2 relative`,
          {backgroundColor: isActive ? '#6f70aa' : 'rgba(255, 255, 255, 0.1)'},
        ]}
        onPress={() => handlePlayAudio1(item._id)}>
        {isActive && (
          <View
            style={[
              tw`absolute -top-1 right-0 px-2 py-0.5 rounded-xl z-10`,
              {backgroundColor: '#4C4AE3'},
            ]}>
            <Text style={tw`text-white text-xs font-bold`}>tell me more</Text>
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
            ) : trendingNews.length > 0 ? (
              trendingNews.map((item, index) => (
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
          style={[
            tw`m-5 p-4 rounded-xl items-center`,
            {backgroundColor: '#dc2626'},
          ]}
          onPress={handleLogout}>
          <Text style={tw`text-white text-base font-semibold`}>Logout</Text>
        </TouchableOpacity>

        <View style={tw`h-25`} />
      </ScrollView>
    </View>
  );
};

export default withAuthCheck(HomeScreen);
