import React, {useState} from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import tw from '../utils/tailwind';
import {fonts} from '../utils/fonts';
import Icon from 'react-native-vector-icons/AntDesign';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../App';
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import {IOS_CLIENT_ID, WEB_CLIENT_ID} from '../services/key';
import {handleAuthentication} from '../services/authService';

GoogleSignin.configure({
  webClientId: WEB_CLIENT_ID,
  iosClientId: IOS_CLIENT_ID,
  offlineAccess: true,
  scopes: ['profile', 'email'],
  forceCodeForRefreshToken: true,
});

type LoginScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Login'
>;

export default function LoginScreen() {
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      await GoogleSignin.hasPlayServices();
      const res = await GoogleSignin.signIn();
      console.log('Google Sign-In Response:', res);

      if (!res || !res.data) {
        console.log('No user data received from Google Sign-In');
        setIsLoading(false);
        return;
      }

      const user: any = res.data.user;
      // Map the Google Sign-In response to our UserInfo interface
      const mappedUserInfo = {
        name: user.name,
        email: user.email,
        photo: user.photo,
        givenName: user.givenName,
        familyName: user.familyName,
      };

      // Handle authentication with our backend
      await handleAuthentication(navigation, mappedUserInfo);
    } catch (error: any) {
      setIsLoading(false);
      console.log('Google Sign-In Error:', error);
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        console.log('User cancelled the login flow');
      } else if (error.code === statusCodes.IN_PROGRESS) {
        console.log('Sign in is in progress');
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        console.log('Play services not available');
      } else {
        console.log('Other error:', error.message);
      }
    }
  };

  return (
    <View style={tw`flex-1 bg-background`}>
      {/* Loading Overlay */}
      {isLoading && (
        <View
          style={tw`absolute inset-0 bg-black/50 items-center justify-center z-50`}>
          <ActivityIndicator size="large" color="#947EFB" />
          <Text style={[tw`text-white mt-4`, {fontFamily: fonts.Inter.medium}]}>
            Just a moment... Signing you in...
          </Text>
        </View>
      )}

      {/* Logo Image */}
      <View style={tw`absolute inset-0 items-center justify-center mb-24`}>
        <Image
          source={require('../assets/loginpage.png')}
          style={tw`w-[500px] h-[500px]`}
          resizeMode="contain"
        />
        <Text
          style={[
            tw`text-3xl text-white absolute`,
            {fontFamily: fonts.Winong.regular},
          ]}>
          AI NEWS
        </Text>
      </View>

      {/* Content */}
      <View style={tw`flex-1 items-center justify-end pb-34`}>
        <Text
          style={[
            tw`text-2xl mb-1 text-white`,
            {fontFamily: fonts.ThabitBold.regular},
          ]}>
          Login
        </Text>
        <Text style={[tw`text-base text-[#848387]`]}>
          To access your account
        </Text>

        <TouchableOpacity
          onPress={handleGoogleSignIn}
          style={tw`mt-9 z-20 bg-cardbg px-9 py-2 rounded-3xl flex-row items-center justify-center`}>
          <Icon name="google" size={20} color="white" style={tw`mr-2`} />
          <Text
            style={[tw`text-lg text-white`, {fontFamily: fonts.Inter.medium}]}>
            Continue with Google
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
