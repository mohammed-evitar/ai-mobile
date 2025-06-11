import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  SafeAreaView,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/FontAwesome5';
import LinearGradient from 'react-native-linear-gradient';
import tw from '../utils/tailwind';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from '../services/apiService';
import {fonts} from '../utils/fonts';
import TermsScreen from './TermsScreen';
import withSubscriptionCheck from '../utils/withSubscriptionCheck';
import SubscriptionModal from '../components/SubscriptionModal';

type RootStackParamList = {
  Login: undefined;
  NewsPreference: {edit?: boolean};
  Terms: undefined;
};

type ProfileScreenNavigationProp =
  NativeStackNavigationProp<RootStackParamList>;

interface ProfileScreenProps {
  subscriptionData?: {
    trialDaysLeft?: number;
    subscriptionStatus?: 'trial' | 'active' | 'expired';
    daysUntilExpiry?: number;
    subscriptionStartDate?: string;
    subscriptionPlan?: string;
    isSubscriptionExpired?: boolean;
  };
}

const ProfileScreen: React.FC<ProfileScreenProps> = ({subscriptionData}) => {
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const [user, setUser] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

  useEffect(() => {
    (async () => {
      const userData = await AsyncStorage.getItem('user');
      console.log('userData', userData);
      if (userData) {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        setFirstName(parsedUser.firstName || '');
        setLastName(parsedUser.lastName || '');
        setEmail(parsedUser.email || '');
      }
    })();
  }, []);

  console.log('subscriptionData', subscriptionData);

  const handleLogout = async () => {
    await AsyncStorage.removeItem('user');
    await AsyncStorage.removeItem('token');
    navigation.reset({index: 0, routes: [{name: 'Login'}]});
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const res: any = await apiService.put('/user', {
        email: user.email,
        newsPreferences: user.newsPreferences,
        firstName,
        lastName,
      });
      await AsyncStorage.setItem('user', JSON.stringify(res?.result));
      setUser(res?.result);
      setEditing(false);
    } catch (error) {
      Alert.alert('Error', 'Error updating profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={tw`flex-1 bg-[#07050E]`}>
      <LinearGradient colors={['#07050E', '#17171D']} style={tw`flex-1`}>
        {/* Header */}
        <View style={tw`w-full flex-row items-center gap-6 px-5 py-4`}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={tw`bg-[#FFFFFF1C] rounded-lg p-2`}>
            <Icon name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          {editing ? (
            <View style={tw`flex-row items-center gap-4`}>
              <Text
                style={[
                  tw`text-white text-2xl tracking-wider`,
                  {fontFamily: fonts.ThabitBold.regular},
                ]}>
                Edit Profile
              </Text>
              <TouchableOpacity
                onPress={handleSave}
                disabled={loading}
                style={tw`ml-4`}>
                <Text style={tw`text-[#7087FF] font-semibold`}>
                  {loading ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text
              style={[
                tw`text-white text-2xl tracking-wider`,
                {fontFamily: fonts.ThabitBold.regular},
              ]}>
              My Profile
            </Text>
          )}
        </View>

        <ScrollView style={tw`flex-1`} showsVerticalScrollIndicator={false}>
          {/* Profile / Edit Section */}
          {!editing ? (
            <View style={tw`flex-col items-center mt-8 px-5`}>
              {user && (
                <View style={tw`relative`}>
                  <Image
                    source={
                      user.picture
                        ? {uri: user.picture}
                        : require('../assets/justmodel.png')
                    }
                    style={tw`w-30 h-30 rounded-full border-2 border-gray-500`}
                  />
                  {subscriptionData?.subscriptionStatus === 'active' &&
                    subscriptionData?.trialDaysLeft === null && (
                      <View
                        style={tw`absolute top-1 right-1 bg-gradient-to-b from-[#4C4AE3] to-[#8887EE] rounded-full p-2`}>
                        <Icon name="crown" size={12} color="#fff" />
                      </View>
                    )}
                </View>
              )}
              <View style={tw`mt-4 flex-col gap-4`}>
                <View>
                  <Text style={[tw`text-white text-lg text-center`]}>
                    {user?.firstName} {user?.lastName}
                  </Text>
                  <Text style={[tw`text-[#FFFFFF80] text-center`]}>
                    {user?.email}
                  </Text>
                </View>

                {/* Subscription Info */}
                {subscriptionData && (
                  <View style={tw`flex-col gap-3`}>
                    <View style={tw`flex-row items-center gap-2`}>
                      <Icon name="crown" size={16} color="#4C4AE3" />
                      <Text style={[tw`text-sm text-[#FFFFFF80]`]}>
                        {subscriptionData?.subscriptionStatus === 'active'
                          ? 'Premium Plan'
                          : subscriptionData?.subscriptionStatus === 'trial'
                          ? 'Free Trial'
                          : subscriptionData?.subscriptionStatus ===
                              'expired' && subscriptionData?.subscriptionPlan
                          ? 'Premium Expired'
                          : 'Free Plan'}
                      </Text>
                    </View>

                    {(!subscriptionData?.subscriptionStatus ||
                      subscriptionData?.subscriptionStatus !== 'active') && (
                      <TouchableOpacity
                        onPress={() => setShowSubscriptionModal(true)}
                        style={tw` rounded-xl bg-gradient-to-b from-[#4C4AE3] to-[#8887EE]`}>
                        <LinearGradient
                          colors={['#4C4AE3', '#8887EE']}
                          style={tw`w-full h-full absolute rounded-xl`}
                        />
                        <Text
                          style={[
                            tw`text-white text-sm text-center px-5 py-2`,
                          ]}>
                          {subscriptionData?.subscriptionStatus === 'expired' &&
                          subscriptionData?.subscriptionPlan
                            ? 'Renew Premium'
                            : 'Upgrade to Premium'}
                        </Text>
                      </TouchableOpacity>
                    )}

                    <View style={tw`flex-row justify-between items-center`}>
                      <Text style={[tw`text-[#FFFFFF80] text-sm`]}>
                        Plan Status
                      </Text>
                      <Text
                        style={[
                          tw`font-medium text-sm ${
                            subscriptionData?.subscriptionStatus === 'active'
                              ? 'text-green-400'
                              : subscriptionData?.subscriptionStatus === 'trial'
                              ? 'text-blue-400'
                              : subscriptionData?.subscriptionStatus ===
                                'expired'
                              ? 'text-red-400'
                              : 'text-[#FFFFFF80]'
                          }`,
                        ]}>
                        {subscriptionData?.subscriptionStatus === 'active'
                          ? 'Active'
                          : subscriptionData?.subscriptionStatus === 'trial'
                          ? 'Trial'
                          : subscriptionData?.subscriptionStatus === 'expired'
                          ? 'Expired'
                          : 'Free'}
                      </Text>
                    </View>

                    {subscriptionData?.subscriptionStatus === 'active' && (
                      <>
                        <View style={tw`flex-row justify-between items-center`}>
                          <Text style={[tw`text-[#FFFFFF80] text-sm`]}>
                            Expires
                          </Text>
                          <Text
                            style={[
                              tw`font-medium text-sm ${
                                subscriptionData?.daysUntilExpiry &&
                                subscriptionData.daysUntilExpiry < 5
                                  ? 'text-red-400'
                                  : 'text-white'
                              }`,
                            ]}>
                            {subscriptionData?.daysUntilExpiry
                              ? `In ${subscriptionData.daysUntilExpiry} days`
                              : 'N/A'}
                          </Text>
                        </View>

                        <View style={tw`flex-row items-center gap-2`}>
                          <Text style={[tw`text-[#FFFFFF80] text-sm`]}>
                            Start Date
                          </Text>
                          <Text style={[tw`font-medium text-white text-sm`]}>
                            {subscriptionData?.subscriptionStartDate
                              ? new Date(
                                  subscriptionData.subscriptionStartDate,
                                ).toLocaleDateString('en-US', {
                                  day: 'numeric',
                                  month: 'long',
                                  year: 'numeric',
                                })
                              : 'N/A'}
                          </Text>
                        </View>
                      </>
                    )}

                    {subscriptionData?.trialDaysLeft !== null && (
                      <View style={tw`flex-row justify-between items-center`}>
                        <Text style={[tw`text-[#FFFFFF80] text-sm`]}>
                          Trial Ends In
                        </Text>
                        <Text
                          style={[
                            tw`font-medium text-sm ${
                              subscriptionData?.trialDaysLeft &&
                              subscriptionData.trialDaysLeft <= 2
                                ? 'text-red-400'
                                : 'text-white'
                            }`,
                          ]}>
                          {subscriptionData?.trialDaysLeft} days
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </View>
          ) : (
            <View style={tw`w-full px-5 mt-8 space-y-6`}>
              <View style={tw`flex-col gap-2`}>
                <Text style={[tw`font-medium text-sm`]}>Full Name</Text>
                <View style={tw`flex-col gap-4`}>
                  <TextInput
                    value={firstName}
                    onChangeText={setFirstName}
                    style={[
                      tw`w-full p-3 rounded-lg bg-[#1C1A28] border border-[#484355] text-white`,
                    ]}
                    placeholder="First Name"
                    placeholderTextColor="#FFFFFF"
                  />
                  <TextInput
                    value={lastName}
                    onChangeText={setLastName}
                    style={[
                      tw`w-full p-3 rounded-lg bg-[#1C1A28] border border-[#484355] text-white`,
                    ]}
                    placeholder="Last Name"
                    placeholderTextColor="#FFFFFF"
                  />
                </View>
              </View>
              <View style={tw`flex-col gap-2`}>
                <Text style={[tw`font-medium text-sm`]}>Email</Text>
                <TextInput
                  value={email}
                  editable={false}
                  style={[
                    tw`w-full p-3 rounded-lg bg-[#1C1A28] border border-[#484355] text-white opacity-70`,
                  ]}
                  placeholder="Email"
                  placeholderTextColor="#FFFFFF"
                />
              </View>
            </View>
          )}

          {/* Options or Footer */}
          {!editing ? (
            <View style={tw`w-full px-5 flex-col mt-8 space-y-4 gap-3`}>
              <TouchableOpacity
                onPress={() => setEditing(true)}
                style={tw`flex-row items-center justify-between bg-[#242229] py-4 px-3 rounded-lg`}>
                <View style={tw`flex-row items-center gap-2`}>
                  <Icon name="user" size={20} color="#fff" />
                  <Text style={[tw`text-white`]}>Edit Profile</Text>
                </View>
                <Icon name="chevron-right" size={14} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate('NewsPreference', {edit: true})
                }
                style={tw`flex-row items-center justify-between bg-[#242229] py-4 px-3 rounded-lg`}>
                <View style={tw`flex-row items-center gap-2`}>
                  <Icon name="cog" size={20} color="#fff" />
                  <Text style={[tw`text-white`]}>Your Preferences</Text>
                </View>
                <Icon name="chevron-right" size={14} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowTerms(true)}
                style={tw`flex-row items-center justify-between bg-[#242229] py-4 px-3 rounded-lg`}>
                <View style={tw`flex-row items-center gap-2`}>
                  <Icon name="info-circle" size={20} color="#fff" />
                  <Text style={[tw`text-white`]}>Terms of Service</Text>
                </View>
                <Icon name="chevron-right" size={14} color="#fff" />
              </TouchableOpacity>
              <View
                style={tw`flex justify-center w-full mt-4 mb-6 items-center`}>
                <TouchableOpacity
                  onPress={handleLogout}
                  style={tw`flex-row items-center justify-center gap-2 py-3 px-6 rounded-3xl bg-[#221F27] w-32 mx-auto`}>
                  <Icon name="sign-out-alt" size={20} color="#FF4F4F" />
                  <Text style={[tw`text-[#FF4F4F]`]}>Logout</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={tw`flex justify-center mt-10 w-full mb-6`}>
              <TouchableOpacity
                onPress={() => setEditing(false)}
                style={tw`flex-row items-center gap-2 py-3 px-8 rounded-3xl bg-[#221F27]`}>
                <Text style={[tw`text-[#FF4F4F]`]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </LinearGradient>

      <TermsScreen
        visible={showTerms}
        onClose={() => setShowTerms(false)}
        onAccept={() => setShowTerms(false)}
        hideAgreement={true}
      />
      <SubscriptionModal
        visible={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
      />
    </SafeAreaView>
  );
};

export default withSubscriptionCheck(ProfileScreen);
