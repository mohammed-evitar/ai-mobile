import React from 'react';
import {View, Text, TouchableOpacity, Image} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../App';
import StarIcon from '../components/StarIcon';
import tw from '../utils/tailwind';
import {fonts} from '../utils/fonts';

type NewsPreferenceScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'NewsPreference'
>;
type NewsPreferenceScreenRouteProp = RouteProp<
  RootStackParamList,
  'NewsPreference'
>;

const NewsPreference = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NewsPreferenceScreenNavigationProp>();
  const route = useRoute<NewsPreferenceScreenRouteProp>();
  const {user} = route.params;

  const handleTalkWithAIClick = () => {
    navigation.navigate('TalkWithAI', {
      firstName: user?.firstName,
      email: user?.email,
    });
  };

  const handleManualSelection = () => {
    navigation.navigate('ManualSelectionPage', {user});
  };

  return (
    <View
      style={tw`flex-1 bg-background items-center px-6 pt-[${insets.top}px]`}>
      <View style={tw`items-center pt-11`}>
        <Text
          style={[
            tw`text-2xl mb-3 text-white`,
            {fontFamily: fonts.ThabitBold.regular, fontWeight: '600'},
          ]}>
          Hello {user?.name}
        </Text>
        <Text
          style={[
            tw`text-base text-white text-center`,
            {fontFamily: fonts.Thabit.regular},
          ]}>
          To start onboarding, choose your preferred option.
        </Text>
      </View>

      <View style={tw`mt-8 items-center w-full`}>
        <TouchableOpacity
          style={tw`mt-9 bg-cardbg px-9 py-2 rounded-3xl flex-row justify-center items-center gap-2`}
          onPress={handleManualSelection}>
          <Text
            style={[tw`text-lg text-white`, {fontFamily: fonts.Inter.medium}]}>
            Manual Selection
          </Text>
        </TouchableOpacity>

        <Text
          style={[
            tw`m-5 text-base text-white`,
            {fontFamily: fonts.Thabit.regular},
          ]}>
          or
        </Text>

        <TouchableOpacity
          style={tw`flex-row items-center gap-2`}
          onPress={handleTalkWithAIClick}>
          <Text
            style={[
              tw`text-[#947EFB] text-sm`,
              {fontFamily: fonts.Inter.medium},
            ]}>
            We Recommend Talk with AI
          </Text>
          <StarIcon />
        </TouchableOpacity>
      </View>

      <Image
        source={require('../assets/ai-model.png')}
        style={tw`mt-4 w-[276px] h-[276px]`}
        resizeMode="contain"
      />
    </View>
  );
};

export default NewsPreference;
