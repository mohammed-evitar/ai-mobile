/* eslint-disable @typescript-eslint/no-unused-vars */
import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import tw from '../utils/tailwind';
import {fonts} from '../utils/fonts';
import {borderAndBgcolors} from '../constants/borderAndBgcolors';
import {newsCategories} from '../constants/newsCategories';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../App';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from '../services/apiService';

type ManualSelectionNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'ManualSelectionPage'
>;

export default function ManualSelectionPage({route}: {route: any}) {
  const navigation = useNavigation<ManualSelectionNavigationProp>();
  const {user, isEditMode = false} = route?.params || {};
  const [selectedSubcategories, setSelectedSubcategories] = useState<{
    [key: string]: string[];
  }>({});
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [tempSelectedSubcategories, setTempSelectedSubcategories] = useState<
    string[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);

  // Open modal and set temp subcategories
  const handleCategoryPress = (category: any) => {
    setSelectedCategory(category);
    setTempSelectedSubcategories(
      (selectedSubcategories as any)[category] || [],
    );
  };

  // Toggle subcategory in modal
  const toggleSubcategory = (subcategory: any) => {
    setTempSelectedSubcategories((prev: any) =>
      prev.includes(subcategory)
        ? prev.filter((item: any) => item !== subcategory)
        : [...prev, subcategory],
    );
  };

  // Close modal and save selection
  const handleDone = () => {
    if (selectedCategory) {
      setSelectedSubcategories(prev => ({
        ...prev,
        [selectedCategory]: tempSelectedSubcategories,
      }));
      setSelectedCategory(null);
      setTempSelectedSubcategories([]);
    }
  };

  // Close modal without saving
  const handleCloseModal = () => {
    setSelectedCategory(null);
    setTempSelectedSubcategories([]);
  };

  const onContinue = async () => {
    try {
      setIsLoading(true);
      // Get user from AsyncStorage
      const userString = await AsyncStorage.getItem('user');
      const localUser = userString ? JSON.parse(userString) : null;

      if (!localUser) {
        throw new Error('User not found');
      }

      // Update user preferences
      const res = await apiService.put<{result: any}>('/user', {
        email: localUser.email,
        ...localUser,
        newsPreferences: selectedSubcategories,
      });

      // Update user in AsyncStorage
      if (res?.result) {
        await AsyncStorage.setItem('user', JSON.stringify(res.result));
      }

      // Navigate based on mode
      if (isEditMode) {
        navigation.navigate('Profile');
      } else {
        navigation.navigate('Home');
      }
    } catch (err) {
      console.error('Error updating user preferences:', err);
      Alert.alert('Error', 'Failed to update preferences. Please try again.', [
        {text: 'OK'},
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView
      style={tw`flex-1 bg-background px-6 py-9`}
      contentContainerStyle={tw`justify-start`}>
      {/* Back Button */}
      <TouchableOpacity
        style={tw`mb-4 flex-row items-center mt-10`}
        onPress={() => navigation.goBack()}>
        <Text
          style={[tw`text-lg text-white`, {fontFamily: fonts.Thabit.regular}]}>
          ← Back
        </Text>
      </TouchableOpacity>
      <View>
        <Text
          style={[
            tw`text-2xl mb-1 text-white`,
            {fontFamily: fonts.ThabitBold.regular, fontWeight: '600'},
          ]}>
          Almost There!
        </Text>
        <Text
          style={[
            tw`text-base text-white`,
            {fontFamily: fonts.Thabit.regular},
          ]}>
          Choose at least two news categories that match your interests to get
          started.
        </Text>
        <View style={tw`flex-row flex-wrap gap-3 mt-5`}>
          {Object.keys(newsCategories).map((category, index) => {
            const isSelected =
              (selectedSubcategories as any)[category]?.length > 0;
            return (
              <TouchableOpacity
                key={index}
                style={[
                  tw`relative rounded-full px-5 py-1`,
                  {
                    backgroundColor:
                      borderAndBgcolors[index % borderAndBgcolors.length].bg,
                    borderWidth: 1,
                    borderColor:
                      borderAndBgcolors[index % borderAndBgcolors.length]
                        .border,
                  },
                ]}
                onPress={() => handleCategoryPress(category)}>
                <Text style={[tw`text-white text-base`]}>{category}</Text>
                {/* X icon for selected state (placeholder) */}
                {isSelected && (
                  <TouchableOpacity
                    style={tw`absolute -top-2 -right-2 bg-white rounded-full w-5 h-5 items-center justify-center`}
                    onPress={() =>
                      setSelectedSubcategories(prev => ({
                        ...prev,
                        [category]: [],
                      }))
                    }>
                    <Text
                      style={[
                        tw`text-black text-base`,
                        {lineHeight: 20, textAlign: 'center'},
                      ]}>
                      ×
                    </Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      {/* Modal for subcategory selection */}
      <Modal visible={!!selectedCategory} transparent animationType="fade">
        <View
          style={tw`flex-1 bg-black bg-opacity-75 justify-center items-center p-4`}>
          <View
            style={tw`bg-[#110F17] text-white p-6 rounded-lg max-w-md w-full relative shadow-lg`}>
            <TouchableOpacity
              style={tw`absolute top-2 right-2`}
              onPress={handleCloseModal}>
              <Text style={tw`text-gray-400 text-2xl mr-2`}>×</Text>
            </TouchableOpacity>
            <Text
              style={[
                tw`text-base font-semibold mb-4 text-white`,
                {fontFamily: fonts.Thabit.regular, lineHeight: 20},
              ]}>
              Choose Your News Interests in {selectedCategory}:
            </Text>
            <View style={tw`flex-row flex-wrap gap-3`}>
              {/* Subcategory chips */}
              {selectedCategory &&
                (newsCategories as any)[selectedCategory].map(
                  (subcategory: any, subIndex: any) => (
                    <TouchableOpacity
                      key={subIndex}
                      onPress={() => toggleSubcategory(subcategory)}
                      style={[
                        tw`px-4 py-1 rounded-full border border-white text-sm flex-row items-center gap-1`,
                        tempSelectedSubcategories.includes(subcategory)
                          ? tw`bg-btn_color`
                          : tw`bg-gray-700`,
                      ]}>
                      <Text style={tw`text-white text-base`}>
                        {subcategory}
                      </Text>
                      {tempSelectedSubcategories.includes(subcategory) && (
                        <Text style={tw`text-white ml-1 text-base`}>×</Text>
                      )}
                    </TouchableOpacity>
                  ),
                )}
            </View>
            <TouchableOpacity
              style={[
                tw`mt-4 w-full py-2 rounded items-center`,
                tempSelectedSubcategories.length < 1
                  ? tw`bg-[#4C4AE3] opacity-50`
                  : tw`bg-[#4C4AE3]`,
              ]}
              onPress={handleDone}
              disabled={tempSelectedSubcategories.length < 1}>
              <Text style={tw`text-white font-semibold`}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {/* Loading Overlay */}
      {isLoading && (
        <View
          style={tw`absolute inset-0 bg-black/50 items-center justify-center z-50`}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={[tw`text-white mt-4`, {fontFamily: fonts.Inter.medium}]}>
            Crafting your daily headlines 📰✨
          </Text>
        </View>
      )}
      {/* Bottom buttons */}
      <View style={tw`flex-row gap-4 mt-20 mb-10 justify-center`}>
        {isEditMode ? (
          <>
            <TouchableOpacity
              style={tw`bg-gray-700 px-8 py-2 rounded-3xl`}
              onPress={() => navigation.goBack()}>
              <Text style={tw`text-lg text-white`}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={tw`bg-btn_color px-8 py-2 rounded-3xl`}
              onPress={onContinue}>
              <Text style={tw`text-lg text-white`}>Save</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[
              tw`bg-btn_color px-28 py-2 rounded-3xl`,
              Object.values(selectedSubcategories).filter(
                (arr: any) => arr.length > 0,
              ).length < 2 && tw`opacity-50`,
            ]}
            disabled={
              Object.values(selectedSubcategories).filter(
                (arr: any) => arr.length > 0,
              ).length < 2 || isLoading
            }
            onPress={onContinue}>
            <Text style={tw`text-lg text-white`}>Continue</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}
