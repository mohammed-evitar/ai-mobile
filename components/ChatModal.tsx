import React, {useRef, useEffect, useState, useCallback} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  PermissionsAndroid,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import LinearGradient from 'react-native-linear-gradient';
import tw from '../utils/tailwind';
import {getImageName} from '../utils/imageUtils';
import {imageMap} from '../utils/imageMap';
import apiService from '../services/apiService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import {io} from 'socket.io-client';
import {Event, State, useTrackPlayerEvents} from 'react-native-track-player';
import {
  setupChatPlayer,
  playChatAudio,
  stopChatAudio,
  cleanupChatPlayer,
} from '../services/chatTrackPlayerService';

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentNews: any;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  audioUrl?: string;
  _id?: string;
  transcribedText?: string;
}

interface ChatHistoryResponse {
  _id: string;
  email: string;
  newsId: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
  __v: number;
}

const ChatModal: React.FC<ChatModalProps> = ({
  isOpen,
  onClose,
  currentNews,
}) => {
  const scrollViewRef = useRef<ScrollView>(null);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isFreePlan, setIsFreePlan] = useState(false);
  const [hasUsedFreeExchange, setHasUsedFreeExchange] = useState(false);
  const audioRecorderPlayer = useRef(new AudioRecorderPlayer()).current;
  const [_recordedAudioUri, setRecordedAudioUri] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [_isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<any>(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const audioQueueRef = useRef<string[]>([]);

  useEffect(() => {
    const getUserEmail = async () => {
      try {
        const userData = await AsyncStorage.getItem('user');
        if (userData) {
          const user = JSON.parse(userData);
          setUserEmail(user.email);
          setIsFreePlan(user.isFreePlan);
          setHasUsedFreeExchange(user.hasUsedFreeExchange);
        }
      } catch (error) {
        console.error('Error getting user email:', error);
      }
    };
    getUserEmail();
  }, []);

  const loadChatHistory = useCallback(async () => {
    if (!currentNews?._id || !userEmail) return;

    try {
      setIsLoadingHistory(true);
      const response = await apiService.get<ChatHistoryResponse>(
        `/chat/${currentNews._id}`,
        {
          email: userEmail,
        },
      );

      if (response?.messages) {
        setChatMessages(response.messages);
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
      // Don't show error to user, just keep empty state
    } finally {
      setIsLoadingHistory(false);
    }
  }, [currentNews?._id, userEmail]);

  useEffect(() => {
    if (isOpen && currentNews && userEmail) {
      loadChatHistory();
    }
  }, [isOpen, currentNews, userEmail, loadChatHistory]);

  useEffect(() => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({animated: true});
    }
  }, [chatMessages]);

  const stopModalAudio = useCallback(async () => {
    try {
      await stopChatAudio();
      audioQueueRef.current = [];
      console.log('🛑 Chat audio stopped');
    } catch (error) {
      console.error('❌ Error stopping chat audio:', error);
    }
  }, []);

  const playStreamingAudio = useCallback(
    async (audioUrl: string) => {
      if (!isPlayerReady) {
        console.log('⏳ Queueing audio for later playback');
        audioQueueRef.current.push(audioUrl);
        return;
      }

      try {
        await playChatAudio(audioUrl);
        console.log('▶️ Chat audio playback started');
      } catch (error) {
        console.error('❌ Error playing chat audio:', error);
        Alert.alert('Audio Error', 'Failed to play audio response');
      }
    },
    [isPlayerReady],
  );

  // Initialize chat's TrackPlayer
  useEffect(() => {
    let isMounted = true;

    const setupPlayer = async () => {
      try {
        const success = await setupChatPlayer();
        if (isMounted && success) {
          setIsPlayerReady(true);
          console.log('✅ Chat TrackPlayer initialized');

          // Play any queued audio
          if (audioQueueRef.current.length > 0) {
            console.log('🎵 Playing queued audio...');
            const nextAudio = audioQueueRef.current.shift();
            if (nextAudio) {
              await playStreamingAudio(nextAudio);
            }
          }
        }
      } catch (error) {
        console.error('❌ Error initializing chat TrackPlayer:', error);
        if (isMounted) {
          setIsPlayerReady(false);
        }
      }
    };

    if (isOpen) {
      setupPlayer();
    }

    // Cleanup when modal closes
    return () => {
      isMounted = false;
      if (isPlayerReady) {
        cleanupChatPlayer();
        setIsPlayerReady(false);
        audioQueueRef.current = [];
      }
    };
  }, [isOpen, playStreamingAudio, isPlayerReady]);

  // Update socket event handlers
  useEffect(() => {
    if (!isOpen || !userEmail || !currentNews?._id) return;

    console.log('Initializing socket connection...');
    const socketInstance = io('http://192.168.184.97:8080', {
      transports: ['websocket'],
      withCredentials: true,
    });

    socketRef.current = socketInstance;

    socketInstance.on('connect', () => {
      console.log('✅ Socket connected successfully');
      setIsConnected(true);
      console.log('Joining chat room:', {
        newsId: currentNews._id,
        email: userEmail,
      });
      socketInstance.emit('join-chat', {
        newsId: currentNews._id,
        email: userEmail,
      });
    });

    socketInstance.on('disconnect', () => {
      console.log('❌ Socket disconnected');
      setIsConnected(false);
      setIsStreaming(false);
    });

    socketInstance.on('ai-response', async (data: any) => {
      console.log('📥 Received AI response:', {
        hasContent: !!data.content,
        hasAudio: !!data.audio,
        isComplete: data.isComplete,
        hasTranscription: !!data.transcribedText,
        audioLength: data.audio?.length,
        isPlayerReady,
      });

      const {content, audio, isComplete, transcribedText} = data;

      if (transcribedText) {
        console.log(
          '📝 Updating user message with transcription:',
          transcribedText,
        );
        setChatMessages(prev => {
          const newMessages = [...prev];
          const lastUserMessage = newMessages[newMessages.length - 1];
          if (lastUserMessage && lastUserMessage.role === 'user') {
            lastUserMessage.content = transcribedText;
            lastUserMessage.transcribedText = transcribedText;
          }
          return newMessages;
        });
      }

      if (audio && !transcribedText) {
        try {
          console.log('🔊 Processing streaming audio...');
          setIsStreaming(true);

          const audioUrl = `data:audio/mp3;base64,${audio}`;
          await playStreamingAudio(audioUrl);
        } catch (error) {
          console.error('❌ Error playing audio chunk:', error);
          Alert.alert('Audio Error', 'Failed to play audio response');
        }
      }

      setChatMessages(prev => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];

        if (lastMessage && lastMessage.role === 'assistant') {
          console.log('📝 Updating existing assistant message');
          lastMessage.content = content;
        } else {
          console.log('📝 Adding new assistant message');
          newMessages.push({
            role: 'assistant',
            content: content,
          });
        }

        return newMessages;
      });

      if (isComplete) {
        console.log('✅ Response complete');
        setIsStreaming(false);
        setIsProcessing(false);
        await stopModalAudio();
      }
    });

    socketInstance.on('chat-update', (data: any) => {
      console.log('📥 Received chat update:', {
        hasUserAudio: !!data.userAudioUrl,
        hasAiAudio: !!data.aiAudioUrl,
      });

      const {userAudioUrl, aiAudioUrl} = data;

      setChatMessages(prev => {
        const newMessages = [...prev];
        const lastUserMessage = newMessages[newMessages.length - 2];
        const lastAssistantMessage = newMessages[newMessages.length - 1];

        if (lastUserMessage && lastUserMessage.role === 'user') {
          console.log('🔊 Updating user message with audio URL');
          lastUserMessage.audioUrl = userAudioUrl;
        }

        if (lastAssistantMessage && lastAssistantMessage.role === 'assistant') {
          console.log('🔊 Updating assistant message with audio URL');
          lastAssistantMessage.audioUrl = aiAudioUrl;
        }

        return newMessages;
      });
    });

    socketInstance.on('error', (error: any) => {
      console.error('❌ Socket error:', {
        message: error?.message,
        details: error,
      });
      setIsProcessing(false);
      setIsStreaming(false);
      Alert.alert('Error', error?.message || 'An error occurred');
    });

    return () => {
      console.log('Cleaning up socket connection...');
      socketInstance.disconnect();
    };
  }, [
    isOpen,
    userEmail,
    currentNews?._id,
    playStreamingAudio,
    stopModalAudio,
    isPlayerReady,
  ]);

  // Add TrackPlayer event listener for playback state changes
  useTrackPlayerEvents([Event.PlaybackState], async event => {
    if (event.state === State.Stopped || event.state === State.Ended) {
      // Reset the playing audio ID when playback ends
      setPlayingAudioId(null);
    }
  });

  const handleSend = async () => {
    if (!chatInput.trim() || isStreaming || !currentNews || !userEmail) {
      return;
    }

    if (isFreePlan && hasUsedFreeExchange) {
      Alert.alert(
        'Upgrade Required',
        'Please upgrade to premium for unlimited exchanges.',
        [{text: 'OK'}],
      );
      return;
    }

    try {
      setIsStreaming(true);
      const newMessage: ChatMessage = {role: 'user', content: chatInput};
      setChatMessages(prev => [...prev, newMessage]);
      setChatInput('');

      setChatMessages(prev => [...prev, {role: 'assistant', content: ''}]);

      await apiService.stream(
        `/chat/${currentNews._id}/message`,
        {
          message: chatInput,
          newsId: currentNews._id,
          email: userEmail,
        },
        (data: any) => {
          if (data?.content) {
            setChatMessages(prev => {
              const newMessages = [...prev];
              const lastMessage = newMessages[newMessages.length - 1];
              if (lastMessage?.role === 'assistant') {
                lastMessage.content = data.content;
              }
              return [...newMessages];
            });
          }
        },
      );
    } catch (error) {
      setChatMessages(prev => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage?.role === 'assistant') {
          lastMessage.content =
            'Sorry, there was an error processing your message. Please try again.';
        }
        return [...newMessages];
      });
    } finally {
      setIsStreaming(false);
    }
  };

  const requestAudioPermission = async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Microphone Permission',
          message: 'This app needs access to your microphone to record audio.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  };

  const startRecording = async () => {
    const hasPermission = await requestAudioPermission();
    if (!hasPermission) {
      Alert.alert('Permission Required', 'Microphone permission is required!');
      return;
    }

    if (!socketRef.current?.connected) {
      Alert.alert('Error', 'Not connected to server');
      return;
    }

    try {
      setIsRecording(true);
      // Configure audio recording with MP3 format
      const audioSet = {
        AudioEncoderAndroid: 3, // AAC
        AudioSourceAndroid: 6, // MIC
        AVEncoderAudioQualityKeyIOS: 0x7f, // high quality
        AVNumberOfChannelsKeyIOS: 1,
        AVFormatIDKeyIOS: 'aac' as any, // Force type to match AudioSet
      };

      const result = await audioRecorderPlayer.startRecorder(
        undefined,
        audioSet,
      );
      setRecordedAudioUri(result);
      console.log('Recording started at:', result);
    } catch (error) {
      console.error('Error starting recording:', error);
      setIsRecording(false);
      Alert.alert(
        'Recording Error',
        'Failed to start recording. Please try again.',
        [{text: 'OK'}],
      );
    }
  };

  const stopRecording = async () => {
    if (!isRecording) return;
    try {
      const result = await audioRecorderPlayer.stopRecorder();
      setIsRecording(false);
      setRecordedAudioUri(result);
      console.log('Recording stopped. File saved at:', result);

      // Add a temporary user message
      setChatMessages(prev => [
        ...prev,
        {
          role: 'user',
          content: '🎤 Transcribing your message...',
          transcribedText: '🎤 Transcribing your message...',
        },
      ]);

      // Send the audio file
      await sendAudioMessage(result);
    } catch (error) {
      console.error('Error stopping recording:', error);
      setIsRecording(false);
      Alert.alert(
        'Recording Error',
        'Failed to save recording. Please try again.',
        [{text: 'OK'}],
      );
    }
  };

  const sendAudioMessage = async (audioUri: string) => {
    if (!currentNews?._id || !userEmail || !socketRef.current?.connected) {
      console.log('❌ Cannot send audio message:', {
        hasNewsId: !!currentNews?._id,
        hasEmail: !!userEmail,
        isConnected: socketRef.current?.connected,
      });
      Alert.alert('Error', 'Not connected to server');
      return;
    }

    try {
      console.log('🎤 Starting to process audio message...');
      setIsProcessing(true);

      // Read the audio file
      console.log('📂 Reading audio file from:', audioUri);
      const response = await fetch(audioUri);
      const responseData = await response.blob();

      // Create a new blob with the correct MIME type
      const audioBlob = new Blob([responseData], {type: 'audio/m4a'} as any);

      // Convert to base64
      const reader = new FileReader();
      reader.onload = () => {
        const base64data = reader.result as string;

        // Send through WebSocket
        socketRef.current.emit('audio-message', {
          newsId: currentNews._id,
          email: userEmail,
          audioData: base64data,
          isMobile: true,
          timestamp: new Date().toISOString(),
          language: 'en',
        });
      };

      reader.readAsDataURL(audioBlob);

      console.log('✅ Audio message sent successfully');
      setIsProcessing(false);
    } catch (error) {
      console.error('❌ Error sending audio message:', error);
      Alert.alert('Error', 'Failed to send audio message');
      setIsProcessing(false);
    }
  };

  // Update the toggleAudio function
  const toggleAudio = async (audioUrl: string, messageId: string) => {
    if (!isPlayerReady) {
      console.error('❌ Modal TrackPlayer not ready');
      return;
    }

    try {
      if (playingAudioId === messageId) {
        await stopChatAudio();
        setPlayingAudioId(null);
      } else {
        // Stop any currently playing audio
        if (playingAudioId) {
          await stopChatAudio();
        }
        await playChatAudio(audioUrl);
        setPlayingAudioId(messageId);
      }
    } catch (error) {
      console.error('Error playing audio:', error);
      Alert.alert('Error', 'Failed to play audio. Please try again.');
    }
  };

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={tw`flex-1`}>
        <View style={tw`flex-1 bg-black/60`}>
          <View
            style={tw`flex-1 mt-20 bg-[#040439] rounded-t-3xl overflow-hidden`}>
            {/* Header */}
            <View
              style={tw`flex-row items-center justify-between p-4 border-b border-[#2D283A] bg-[#0A0830]`}>
              <View style={tw`flex-row items-center gap-3`}>
                <View
                  style={tw`bg-gradient-to-r from-blue-600 to-indigo-600 p-2 rounded-lg`}>
                  <Icon name="comments" size={20} color="#fff" />
                </View>
                <Text style={tw`text-white font-medium text-lg`}>
                  Ask about this news
                </Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                style={tw`p-2 rounded-lg bg-[#1C1829]`}>
                <Icon name="times" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* News Preview */}
            {currentNews && (
              <View style={tw`p-4 bg-[#0A0830] border-b border-[#2D283A]`}>
                <View style={tw`flex-row items-center gap-4`}>
                  <Image
                    source={imageMap[getImageName({}, currentNews.category)]}
                    style={tw`w-14 h-14 rounded-xl`}
                  />
                  <View style={tw`flex-1`}>
                    <Text
                      style={tw`text-white font-semibold text-base`}
                      numberOfLines={1}>
                      {currentNews.headline}
                    </Text>
                    <Text
                      style={tw`text-gray-400 text-sm mt-1`}
                      numberOfLines={2}>
                      {currentNews.description}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Chat Messages */}
            <ScrollView
              ref={scrollViewRef}
              style={tw`flex-1 p-4`}
              contentContainerStyle={tw`gap-4`}
              keyboardShouldPersistTaps="handled">
              {isLoadingHistory ? (
                <View style={tw`flex-1 items-center justify-center py-10`}>
                  <Icon name="spinner" size={24} color="#6366f1" />
                  <Text style={tw`text-gray-400 text-sm mt-2`}>
                    Loading chat history...
                  </Text>
                </View>
              ) : chatMessages.length === 0 ? (
                <View style={tw`flex-1 items-center justify-center py-10`}>
                  <View style={tw`bg-blue-500/20 p-5 rounded-full mb-4`}>
                    <Icon name="comments" size={44} color="#6366f1" />
                  </View>
                  <Text
                    style={tw`text-gray-300 text-base font-medium text-center`}>
                    Ask questions about this news story
                  </Text>
                  <Text style={tw`text-gray-400 text-sm mt-2 text-center`}>
                    Free plan: 1 exchange allowed
                  </Text>
                </View>
              ) : (
                chatMessages.map((msg, index) => (
                  <View
                    key={index}
                    style={tw`flex-row ${
                      msg.role === 'user' ? 'justify-end' : 'justify-start'
                    } mb-4`}>
                    {msg.role === 'user' ? (
                      <LinearGradient
                        colors={['#2563eb', '#4f46e5']}
                        start={{x: 0, y: 0}}
                        end={{x: 1, y: 0}}
                        style={tw`rounded-2xl max-w-[80%] shadow-lg relative`}>
                        <Text style={tw`text-white text-sm leading-6  p-3`}>
                          {msg.content}
                        </Text>
                      </LinearGradient>
                    ) : (
                      <View
                        style={tw`bg-[#342F43] rounded-2xl p-3 max-w-[80%] shadow-lg relative`}>
                        <Text style={tw`text-white text-sm leading-6`}>
                          {msg.content}
                        </Text>
                        {msg.audioUrl && (
                          <TouchableOpacity
                            onPress={() =>
                              toggleAudio(
                                msg.audioUrl!,
                                msg._id || `msg-${index}`,
                              )
                            }
                            style={tw``}>
                            <LinearGradient
                              colors={['#2563eb', '#4f46e5']}
                              start={{x: 0, y: 0}}
                              end={{x: 1, y: 0}}
                              style={tw`rounded-full w-8 h-8 shadow-lg relative items-center justify-center`}>
                              <View style={tw`items-center justify-center`}>
                                <Icon
                                  name={
                                    playingAudioId ===
                                    (msg._id || `msg-${index}`)
                                      ? 'pause'
                                      : 'play'
                                  }
                                  size={16}
                                  color="#fff"
                                />
                              </View>
                            </LinearGradient>
                          </TouchableOpacity>
                        )}
                        {(playingAudioId === (msg._id || `msg-${index}`) ||
                          (isStreaming &&
                            index === chatMessages.length - 1)) && (
                          <View
                            style={tw`absolute -top-2 -right-2 flex-row items-center gap-1 bg-blue-600 px-2 py-1 rounded-full`}>
                            <View style={tw`flex-row items-center gap-0.5`}>
                              <View
                                style={tw`w-1 h-2 bg-white rounded-full animate-pulse`}
                              />
                              <View
                                style={tw`w-1 h-3 bg-white rounded-full animate-pulse`}
                              />
                              <View
                                style={tw`w-1 h-4 bg-white rounded-full animate-pulse`}
                              />
                              <View
                                style={tw`w-1 h-3 bg-white rounded-full animate-pulse`}
                              />
                              <View
                                style={tw`w-1 h-2 bg-white rounded-full animate-pulse`}
                              />
                            </View>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                ))
              )}
            </ScrollView>

            {/* Input Area */}
            <View style={tw`p-4 pb-6 border-t border-[#2D283A] bg-[#0A0830]`}>
              {isFreePlan && hasUsedFreeExchange && (
                <View style={tw`flex-row items-center justify-between mb-3`}>
                  <Text style={tw`text-gray-300 text-sm flex-1 mr-2`}>
                    Upgrade to premium for unlimited exchanges and more
                    features.
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      Alert.alert(
                        'Upgrade Required',
                        'Please upgrade to premium for unlimited exchanges.',
                        [{text: 'OK'}],
                      );
                    }}
                    style={tw`bg-gradient-to-r from-[#4C4AE3] to-[#6366f1] px-3 py-1 rounded-lg`}>
                    <Text style={tw`text-white text-sm font-medium`}>
                      Upgrade
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
              <View
                style={tw`flex-row items-center gap-2 bg-[#1C1829] rounded-xl p-3 border border-[#2D283A] shadow-lg`}>
                <TextInput
                  style={tw`flex-1 text-white text-base px-2 py-2 min-h-[24px] max-h-[120px]`}
                  placeholder="Ask a question about this news..."
                  placeholderTextColor="#4A4655"
                  value={chatInput}
                  onChangeText={setChatInput}
                  multiline
                  maxLength={500}
                  selectionColor="#6366f1"
                  cursorColor="#6366f1"
                  editable={!isStreaming && !isProcessing}
                />
                <View style={tw`flex-row items-center gap-2`}>
                  <View style={tw`items-center`}>
                    <TouchableOpacity
                      onPress={isRecording ? stopRecording : startRecording}
                      disabled={isProcessing}
                      style={tw`p-2 rounded-lg ${
                        isRecording
                          ? 'bg-gradient-to-r from-[#4C4AE3] to-[#6366f1]'
                          : 'bg-gradient-to-r from-[#4C4AE3] to-[#6366f1]'
                      } ${isProcessing ? 'opacity-50' : ''}`}>
                      {isRecording && (
                        <View
                          style={tw`absolute inset-1 rounded-lg border-2 border-blue-400 animate-pulse opacity-75`}
                        />
                      )}
                      <Icon
                        name={isRecording ? 'stop' : 'microphone'}
                        size={20}
                        color="#fff"
                      />
                    </TouchableOpacity>
                    <Text style={tw`text-[8px] text-gray-400 mt-1`}>
                      {isRecording ? 'Stop' : 'Record'}
                    </Text>
                  </View>
                  <View style={tw`items-center`}>
                    <TouchableOpacity
                      onPress={handleSend}
                      disabled={
                        isStreaming || !chatInput.trim() || isProcessing
                      }
                      style={tw`p-2 rounded-lg bg-gradient-to-r from-[#4C4AE3] to-[#6366f1] ${
                        isStreaming || !chatInput.trim() || isProcessing
                          ? 'opacity-50'
                          : ''
                      }`}>
                      {isStreaming ? (
                        <Icon name="spinner" size={20} color="#fff" />
                      ) : (
                        <Icon name="paper-plane" size={20} color="#fff" />
                      )}
                    </TouchableOpacity>
                    <Text style={tw`text-[8px] text-gray-400 mt-1`}>
                      {isStreaming ? 'Thinking...' : 'Send'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default ChatModal;
