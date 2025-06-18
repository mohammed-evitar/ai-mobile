import React, {useState, useRef, useEffect} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  Animated,
  Dimensions,
  Clipboard,
  KeyboardAvoidingView,
  Platform,
  Linking,
  PanResponder,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import LinearGradient from 'react-native-linear-gradient';
import tw from '../utils/tailwind';
import {fonts} from '../utils/fonts';
import {getImageName} from '../utils/imageUtils';
import {imageMap} from '../utils/imageMap';
import apiService from '../services/apiService';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface NewsItem {
  headline: string;
  description: string;
  category?: string;
  url?: string;
  _id?: string;
}

interface SocialShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentNews: NewsItem | null;
}

interface User {
  name?: string;
  email?: string;
  profilePicture?: string;
  title?: string;
  username?: string;
}

const SocialShareModal: React.FC<SocialShareModalProps> = ({
  isOpen,
  onClose,
  currentNews,
}) => {
  const [selectedPlatform, setSelectedPlatform] = useState<'x' | 'linkedin'>(
    'x',
  );
  const [generatedContent, setGeneratedContent] = useState<string>('');
  const [editableContent, setEditableContent] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [quickThought, setQuickThought] = useState<string>('');
  const [tone, setTone] = useState<
    'friendly' | 'spicy' | 'professional' | 'sarcastic'
  >('friendly');
  const [showCopied, setShowCopied] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  const scrollViewRef = useRef<ScrollView>(null);
  const previewRef = useRef<View>(null);
  const {width} = Dimensions.get('window');
  const spinValue = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  // Load user data
  React.useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await AsyncStorage.getItem('user');
        if (userData) {
          setUser(JSON.parse(userData));
        }
      } catch (error) {
        console.error('Error loading user:', error);
      }
    };
    loadUser();
  }, []);

  // Animation for spinner
  useEffect(() => {
    if (isGenerating) {
      const spinAnimation = Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      );
      spinAnimation.start();
    } else {
      spinValue.setValue(0);
    }
  }, [isGenerating]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const handlePlatformSelect = (platform: 'x' | 'linkedin') => {
    setSelectedPlatform(platform);
    if (platform === 'linkedin') {
      scrollViewRef.current?.scrollToEnd({animated: true});
    }
  };

  const handleToneSelect = (
    selectedTone: 'friendly' | 'spicy' | 'professional' | 'sarcastic',
  ) => {
    setTone(selectedTone);
    scrollViewRef.current?.scrollToEnd({animated: true});
  };

  const generateContent = async () => {
    if (!currentNews?._id) return;

    setIsGenerating(true);

    try {
      const response = await apiService.post<{
        success: boolean;
        data: {
          generatedPost: string;
        };
      }>('/social-share/generate', {
        newsId: currentNews._id,
        userOpinion: quickThought || '',
        tone,
        platform: selectedPlatform,
      });

      console.log('Full API Response:', JSON.stringify(response, null, 2));

      if (!response?.success) {
        throw new Error('API request was not successful');
      }

      if (!response?.data) {
        throw new Error('No data received from API');
      }

      if (!response?.data?.generatedPost) {
        throw new Error('No post content in response');
      }

      setGeneratedContent(response.data.generatedPost);
      setEditableContent(response.data.generatedPost);
      setIsEditing(false);

      // Scroll to preview after a short delay
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({animated: true});
      }, 100);
    } catch (error) {
      console.error('Error generating content:', error);
      Alert.alert('Error', 'Failed to generate content. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    setEditableContent(generatedContent);
  };

  const handleSaveEdit = () => {
    setGeneratedContent(editableContent);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditableContent(generatedContent);
    setIsEditing(false);
  };

  const copyToClipboard = async () => {
    try {
      Clipboard.setString(generatedContent);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const getShareUrl = (platform: string) => {
    const encodedContent = encodeURIComponent(generatedContent);

    switch (platform) {
      case 'x':
        return `https://twitter.com/intent/tweet?text=${encodedContent}`;
      case 'linkedin':
        // LinkedIn doesn't support direct content embedding via URL
        // We'll use a fallback approach
        return `https://www.linkedin.com/feed/`;
      default:
        return '';
    }
  };

  const handleShare = async (platform: string) => {
    if (platform === 'linkedin') {
      // For LinkedIn, copy to clipboard first, then open LinkedIn
      copyToClipboard();

      // Wait a moment for copy to complete, then open LinkedIn
      setTimeout(async () => {
        try {
          await Linking.openURL('https://www.linkedin.com/feed/');
        } catch (error) {
          console.error('Error opening LinkedIn:', error);
          Alert.alert(
            'LinkedIn',
            'Content copied to clipboard! Please open LinkedIn manually to paste your post.',
          );
        }
      }, 500);
      return;
    }

    // For X (Twitter), use direct URL sharing
    const shareUrl = getShareUrl(platform);

    try {
      const supported = await Linking.canOpenURL(shareUrl);

      if (supported) {
        await Linking.openURL(shareUrl);
      } else {
        // Fallback: copy to clipboard and show alert
        copyToClipboard();
        Alert.alert(
          'Share',
          `Content copied to clipboard! Please paste it in ${
            platform === 'x' ? 'X (Twitter)' : 'LinkedIn'
          }.`,
        );
      }
    } catch (error) {
      console.error('Error opening URL:', error);
      // Fallback: copy to clipboard
      copyToClipboard();
      Alert.alert(
        'Share',
        `Content copied to clipboard! Please paste it in ${
          platform === 'x' ? 'X (Twitter)' : 'LinkedIn'
        }.`,
      );
    }
  };

  const getToneIcon = (toneType: string) => {
    switch (toneType) {
      case 'friendly':
        return 'smile';
      case 'spicy':
        return 'fire';
      case 'professional':
        return 'briefcase';
      case 'sarcastic':
        return 'bolt';
      default:
        return 'smile';
    }
  };

  const getToneColor = (toneType: string) => {
    switch (toneType) {
      case 'friendly':
        return '#4CAF50';
      case 'spicy':
        return '#FF5722';
      case 'professional':
        return '#2196F3';
      case 'sarcastic':
        return '#FFC107';
      default:
        return '#4CAF50';
    }
  };

  // Reset all state when modal opens or closes
  useEffect(() => {
    if (isOpen) {
      // Reset to initial state when modal opens
      setQuickThought('');
      setTone('friendly');
      setSelectedPlatform('x');
      setGeneratedContent('');
      setIsGenerating(false);
      setIsEditing(false);
      setEditableContent('');
      setShowCopied(false);
    }
  }, [isOpen]);

  // PanResponder for drag to close
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 10 && gestureState.vy > 0;
      },
      onPanResponderGrant: () => {
        translateY.setOffset(0);
        translateY.setValue(0);
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        translateY.flattenOffset();
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          // Close modal immediately when threshold is met
          onClose();
          // Then animate for visual effect
          Animated.timing(translateY, {
            toValue: 1000,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            translateY.setValue(0);
          });
        } else {
          // Snap back
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    }),
  ).current;

  if (!isOpen) return null;

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={tw`flex-1`}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        <View style={tw`flex-1 bg-black/50 backdrop-blur-sm`}>
          <Animated.View
            style={[
              tw`flex-1 mt-20 bg-background/95 backdrop-blur-sm rounded-t-3xl overflow-hidden border border-[#FFFFFF1A] shadow-2xl`,
              {
                transform: [{translateY}],
              },
            ]}>
            {/* Header */}
            <View
              style={tw`flex-row items-center justify-between p-4 border-b border-[#FFFFFF1A] bg-background/95 backdrop-blur-sm rounded-t-3xl`}
              {...panResponder.panHandlers}>
              <View style={tw`flex-row items-center gap-2`}>
                <View
                  style={tw`bg-gradient-to-r from-blue-600 to-indigo-600 p-2 rounded-lg`}>
                  <Icon name="magic" size={20} color="#fff" />
                </View>
                <Text style={tw`text-white font-medium text-lg`}>
                  Quick Share
                </Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                style={tw`p-2 rounded-lg bg-[#FFFFFF0A] border border-[#FFFFFF1A]`}>
                <Icon name="times" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView
              ref={scrollViewRef}
              style={tw`flex-1`}
              contentContainerStyle={tw`p-4 pb-20`}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled">
              {/* Quick Thought Input */}
              <View style={tw`mb-4`}>
                <TextInput
                  value={quickThought}
                  onChangeText={text => {
                    if (text.length <= 100) {
                      setQuickThought(text);
                    }
                  }}
                  placeholder="Share your thoughts... (optional)"
                  placeholderTextColor="#4A4655"
                  style={tw`w-full bg-[#FFFFFF0A] text-white rounded-xl p-3 min-h-[60px] border border-[#FFFFFF1A] text-sm`}
                  multiline
                  maxLength={100}
                  textAlignVertical="top"
                />
                <View style={tw`flex-row justify-between items-center mt-1`}>
                  <Text style={tw`text-xs text-[#FFFFFF80]`}>
                    What do you think about this news?
                  </Text>
                  <Text style={tw`text-xs text-[#FFFFFF80]`}>
                    {quickThought.length}/100
                  </Text>
                </View>
              </View>

              {/* Tone Selection */}
              <View style={tw`mb-4`}>
                <Text style={tw`text-[10px] text-[#FFFFFF80] mb-2`}>
                  Select tone
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={tw`flex-row gap-2`}>
                    {[
                      {key: 'friendly', label: 'Friendly', icon: 'smile'},
                      {key: 'spicy', label: 'Spicy', icon: 'fire'},
                      {
                        key: 'professional',
                        label: 'Professional',
                        icon: 'briefcase',
                      },
                      {key: 'sarcastic', label: 'Sarcastic', icon: 'bolt'},
                    ].map(toneOption => (
                      <TouchableOpacity
                        key={toneOption.key}
                        onPress={() => handleToneSelect(toneOption.key as any)}
                        style={[
                          tw`px-3 py-2 rounded-xl flex-row items-center gap-2`,
                          tone === toneOption.key
                            ? tw`bg-[#4C4AE3] text-white`
                            : tw`bg-[#FFFFFF0A] text-[#FFFFFF80] hover:bg-[#FFFFFF15] border border-[#FFFFFF1A]`,
                        ]}>
                        <Icon
                          name={toneOption.icon}
                          size={16}
                          color={tone === toneOption.key ? '#fff' : '#FFFFFF80'}
                        />
                        <Text
                          style={[
                            tw`text-sm`,
                            tone === toneOption.key
                              ? tw`text-white`
                              : tw`text-[#FFFFFF80]`,
                          ]}>
                          {toneOption.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              {/* Platform Selection */}
              <View style={tw`mb-4`}>
                <Text style={tw`text-[10px] text-[#FFFFFF80] mb-2`}>
                  Generate post for
                </Text>
                <View style={tw`flex-row gap-2 mb-4`}>
                  <TouchableOpacity
                    onPress={() => handlePlatformSelect('x')}
                    style={[
                      tw`flex-1 flex-row items-center justify-center gap-2 px-3 py-2.5 rounded-xl transition-all`,
                      selectedPlatform === 'x'
                        ? tw`bg-black text-white border-2 border-white shadow-lg scale-[1.02]`
                        : tw`bg-[#FFFFFF0A] text-[#FFFFFF80] hover:bg-[#FFFFFF15] border border-[#FFFFFF1A]`,
                    ]}>
                    <Icon
                      name="twitter"
                      size={16}
                      color={selectedPlatform === 'x' ? '#fff' : '#FFFFFF80'}
                    />
                    <Text
                      style={[
                        tw`text-sm font-medium`,
                        selectedPlatform === 'x'
                          ? tw`text-white`
                          : tw`text-[#FFFFFF80]`,
                      ]}>
                      X
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handlePlatformSelect('linkedin')}
                    style={[
                      tw`flex-1 flex-row items-center justify-center gap-2 px-3 py-2.5 rounded-xl transition-all`,
                      selectedPlatform === 'linkedin'
                        ? tw`bg-[#0077B5] text-white border-2 border-white shadow-lg scale-[1.02]`
                        : tw`bg-[#FFFFFF0A] text-[#FFFFFF80] hover:bg-[#FFFFFF15] border border-[#FFFFFF1A]`,
                    ]}>
                    <Icon
                      name="linkedin"
                      size={16}
                      color={
                        selectedPlatform === 'linkedin' ? '#fff' : '#FFFFFF80'
                      }
                    />
                    <Text
                      style={[
                        tw`text-sm font-medium`,
                        selectedPlatform === 'linkedin'
                          ? tw`text-white`
                          : tw`text-[#FFFFFF80]`,
                      ]}>
                      LinkedIn
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Generate Button */}
              <TouchableOpacity
                onPress={generateContent}
                disabled={isGenerating}
                style={[
                  tw`w-full py-3 rounded-xl hover:opacity-90 transition-all hover:scale-[1.02] disabled:opacity-50 flex-row items-center justify-center gap-2 border border-[#FFFFFF1A] shadow-lg`,
                  isGenerating && tw`opacity-50`,
                ]}>
                <LinearGradient
                  colors={['#4C4AE3', '#8887EE']}
                  start={{x: 0, y: 0}}
                  end={{x: 0, y: 1}}
                  style={tw`absolute inset-0 rounded-xl`}
                />
                {isGenerating ? (
                  <>
                    <Animated.View style={{transform: [{rotate: spin}]}}>
                      <Icon name="spinner" size={16} color="#fff" />
                    </Animated.View>
                    <Text style={tw`text-white text-sm font-medium`}>
                      Generating...
                    </Text>
                  </>
                ) : (
                  <>
                    <Icon name="magic" size={16} color="#fff" />
                    <Text style={tw`text-white text-sm font-medium`}>
                      {generatedContent ? 'Regenerate Post' : 'Generate Post'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Edit Mode */}
              {isEditing && (
                <View style={tw`mt-4`}>
                  <View style={tw`flex-row justify-between items-center mb-2`}>
                    <Text style={tw`text-white text-sm font-medium`}>
                      Edit your post
                    </Text>
                    <View style={tw`flex-row gap-2`}>
                      <TouchableOpacity
                        onPress={handleCancelEdit}
                        style={tw`px-3 py-1 rounded-lg bg-[#FFFFFF0A] border border-[#FFFFFF1A]`}>
                        <Text style={tw`text-[#FFFFFF80] text-sm`}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleSaveEdit}
                        style={tw`px-3 py-1 rounded-lg bg-[#4C4AE3]`}>
                        <Text style={tw`text-white text-sm`}>Save</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Platform-specific edit container */}
                  <View
                    style={[
                      tw`rounded-xl p-4 border`,
                      selectedPlatform === 'x'
                        ? tw`bg-black border-[#FFFFFF1A]`
                        : tw`bg-white border-[#FFFFFF1A]`,
                    ]}>
                    <View style={tw`flex-row items-start gap-2 mb-2`}>
                      <View
                        style={tw`w-8 h-8 rounded-full bg-[#4C68F5] items-center justify-center`}>
                        <Text style={tw`text-white font-semibold text-sm`}>
                          {user?.name?.charAt(0) ||
                            user?.email?.charAt(0) ||
                            'U'}
                        </Text>
                      </View>
                      <View style={tw`flex-1`}>
                        <View style={tw`flex-row items-center justify-between`}>
                          <View>
                            <Text
                              style={[
                                tw`font-bold text-sm`,
                                selectedPlatform === 'x'
                                  ? tw`text-white`
                                  : tw`text-black`,
                              ]}>
                              {user?.name || 'User'}
                            </Text>
                            <Text
                              style={[
                                tw`text-xs`,
                                selectedPlatform === 'x'
                                  ? tw`text-gray-400`
                                  : tw`text-gray-500`,
                              ]}>
                              {selectedPlatform === 'x'
                                ? `@${
                                    user?.username ||
                                    user?.email?.split('@')[0] ||
                                    'user'
                                  }`
                                : user?.title || 'AI News Enthusiast'}
                            </Text>
                          </View>
                          <Icon
                            name={
                              selectedPlatform === 'x' ? 'twitter' : 'linkedin'
                            }
                            size={16}
                            color={
                              selectedPlatform === 'x' ? '#fff' : '#0077B5'
                            }
                          />
                        </View>

                        <TextInput
                          value={editableContent}
                          onChangeText={setEditableContent}
                          placeholder="Edit your post..."
                          placeholderTextColor={
                            selectedPlatform === 'x' ? '#4A4655' : '#666'
                          }
                          style={[
                            tw`w-full rounded-xl p-3 min-h-[120px] text-sm mt-2`,
                            selectedPlatform === 'x'
                              ? tw`bg-[#FFFFFF0A] text-white border border-[#FFFFFF1A]`
                              : tw`bg-gray-50 text-black border border-gray-200`,
                          ]}
                          multiline
                          textAlignVertical="top"
                        />

                        {selectedPlatform === 'linkedin' && (
                          <View style={tw`bg-gray-100 rounded-xl p-2 mt-2`}>
                            <Text style={tw`font-semibold text-sm mb-1`}>
                              {currentNews?.headline}
                            </Text>
                            <Text style={tw`text-xs text-gray-600`}>
                              {currentNews?.description?.substring(0, 100)}...
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                </View>
              )}

              {/* Preview Section */}
              {generatedContent && !isEditing && (
                <View ref={previewRef} style={tw`mt-6`}>
                  {selectedPlatform === 'x' ? (
                    <View
                      style={tw`bg-black rounded-xl p-4 border border-[#FFFFFF1A]`}>
                      <View style={tw`flex-row items-start gap-2 mb-2`}>
                        <View
                          style={tw`w-8 h-8 rounded-full bg-[#4C68F5] items-center justify-center`}>
                          <Text style={tw`text-white font-semibold text-sm`}>
                            {user?.name?.charAt(0) ||
                              user?.email?.charAt(0) ||
                              'U'}
                          </Text>
                        </View>
                        <View style={tw`flex-1`}>
                          <View
                            style={tw`flex-row items-center justify-between`}>
                            <View>
                              <Text style={tw`text-white font-bold text-sm`}>
                                {user?.name || 'User'}
                              </Text>
                              <Text style={tw`text-gray-400 text-xs`}>
                                @
                                {user?.username ||
                                  user?.email?.split('@')[0] ||
                                  'user'}
                              </Text>
                            </View>
                            <Icon name="twitter" size={16} color="#fff" />
                          </View>
                          <TouchableOpacity
                            onPress={handleEdit}
                            activeOpacity={0.7}
                            style={tw`mt-2`}>
                            <Text style={tw`text-white text-sm`}>
                              {generatedContent}
                            </Text>
                            <Text style={tw`text-gray-500 text-xs mt-2 italic`}>
                              Tap to edit
                            </Text>
                          </TouchableOpacity>
                          <Text style={tw`text-gray-400 text-xs mt-2`}>
                            {new Date().toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </Text>
                        </View>
                      </View>
                      <View
                        style={tw`mt-3 pt-3 border-t border-gray-800 flex-row justify-end`}>
                        <TouchableOpacity
                          onPress={() => handleShare(selectedPlatform)}
                          style={tw`bg-gradient-to-b from-[#4C4AE3] to-[#8887EE] px-3 py-2 rounded-xl flex-row items-center gap-2`}>
                          <Icon name="share" size={14} color="#fff" />
                          <Text style={tw`text-white text-sm`}>Share</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View
                      style={tw`bg-white rounded-xl p-4 border border-[#FFFFFF1A]`}>
                      <View style={tw`flex-row items-start gap-2 mb-2`}>
                        <View
                          style={tw`w-8 h-8 rounded-full bg-[#4C68F5] items-center justify-center`}>
                          <Text style={tw`text-white font-semibold text-sm`}>
                            {user?.name?.charAt(0) ||
                              user?.email?.charAt(0) ||
                              'U'}
                          </Text>
                        </View>
                        <View style={tw`flex-1`}>
                          <View
                            style={tw`flex-row items-center justify-between`}>
                            <View>
                              <Text style={tw`text-black font-bold text-sm`}>
                                {user?.name || 'User'}
                              </Text>
                              <Text style={tw`text-gray-500 text-xs`}>
                                {user?.title || 'AI News Enthusiast'}
                              </Text>
                            </View>
                            <Icon name="linkedin" size={16} color="#0077B5" />
                          </View>
                          <TouchableOpacity
                            onPress={handleEdit}
                            activeOpacity={0.7}
                            style={tw`mt-2`}>
                            <Text style={tw`text-black text-sm`}>
                              {generatedContent}
                            </Text>
                            <Text style={tw`text-gray-500 text-xs mt-2 italic`}>
                              Tap to edit
                            </Text>
                          </TouchableOpacity>
                          <View style={tw`bg-gray-100 rounded-xl p-2 mt-2`}>
                            <Text style={tw`font-semibold text-sm mb-1`}>
                              {currentNews?.headline}
                            </Text>
                            <Text style={tw`text-xs text-gray-600`}>
                              {currentNews?.description?.substring(0, 100)}...
                            </Text>
                          </View>
                        </View>
                      </View>
                      <View style={tw`mt-3 pt-3 border-t border-gray-800`}>
                        <Text
                          style={tw`text-gray-600 text-xs mb-3 text-center`}>
                          LinkedIn doesn't support direct content sharing. Copy
                          your post and paste it in LinkedIn.
                        </Text>
                        <View style={tw`flex-row gap-2 justify-center`}>
                          <TouchableOpacity
                            onPress={copyToClipboard}
                            style={tw`px-3 py-2 rounded-xl flex-row items-center gap-2 bg-[#4C4AE3]`}>
                            {showCopied ? (
                              <>
                                <Icon name="check" size={14} color="#fff" />
                                <Text style={tw`text-white text-sm`}>
                                  Copied!
                                </Text>
                              </>
                            ) : (
                              <>
                                <Icon name="copy" size={14} color="#fff" />
                                <Text style={tw`text-white text-sm`}>
                                  Copy Post
                                </Text>
                              </>
                            )}
                          </TouchableOpacity>

                          <TouchableOpacity
                            onPress={async () => {
                              try {
                                await Linking.openURL(
                                  'https://www.linkedin.com/feed/',
                                );
                              } catch (error) {
                                console.error('Error opening LinkedIn:', error);
                                Alert.alert(
                                  'LinkedIn',
                                  'Please open LinkedIn manually to paste your post.',
                                );
                              }
                            }}
                            style={tw`px-3 py-2 rounded-xl flex-row items-center gap-2 bg-[#0077B5]`}>
                            <Icon
                              name="external-link-alt"
                              size={14}
                              color="#fff"
                            />
                            <Text style={tw`text-white text-sm`}>
                              Open LinkedIn
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default SocialShareModal;
