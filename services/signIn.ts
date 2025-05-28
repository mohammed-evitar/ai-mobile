import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import {handleAuthentication} from './authService';
import {NavigationProp} from '@react-navigation/native';

export const signIn = async (navigation: NavigationProp<any>) => {
  try {
    await GoogleSignin.hasPlayServices();
    const {data} = (await GoogleSignin.signIn()) as any;
    console.log('data', data);
    // Map the Google Sign-In response to our UserInfo interface
    const mappedUserInfo = {
      name: data.user.name,
      email: data.user.email,
      photo: data.user.photo,
      givenName: data.user.givenName,
      familyName: data.user.familyName,
    };

    // Handle authentication with our backend
    await handleAuthentication(navigation, mappedUserInfo);
  } catch (error: any) {
    if (error.code) {
      switch (error.code) {
        case statusCodes.IN_PROGRESS:
          console.log('Sign in already in progress');
          break;
        case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
          console.log('Play services not available or outdated');
          break;
        default:
          console.error('Google Sign-In Error:', error);
      }
    } else {
      console.error('Unexpected error during sign in:', error);
    }
  }
};
