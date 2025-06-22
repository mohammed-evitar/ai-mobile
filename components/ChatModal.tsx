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
  Animated,
  Easing,
  PanResponder,
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
import TrackPlayer from 'react-native-track-player';
import RNFS from 'react-native-fs';
import {
  Capability,
  PitchAlgorithm,
  AppKilledPlaybackBehavior,
} from 'react-native-track-player';
import SubscriptionModal from './SubscriptionModal';

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentNews: any;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  audioUrl?: string;
  completeAudioUrl?: string;
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

// Add a queue type for better type safety
interface AudioQueueItem {
  url: string;
  messageId: string;
}

// Constants for audio optimization
const AUDIO_BUFFER_SIZE = 1024; // Small buffer size for lower latency
const AUDIO_FORMAT = {
  android: {
    // Android-specific audio format settings
    sampleRate: 44100,
    channelConfig: 'mono',
    audioFormat: 'ENCODING_PCM_16BIT',
  },
  ios: {
    // iOS-specific audio format settings
    sampleRate: 44100,
    numberOfChannels: 1,
    bitDepth: 16,
  },
};

// Add a function to check if file exists
const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    const exists = await RNFS.exists(filePath);
    return exists;
  } catch (error) {
    console.error('❌ Error checking file existence:', error);
    return false;
  }
};

// Add a function to safely delete a file
const safeDeleteFile = async (filePath: string) => {
  try {
    const exists = await fileExists(filePath);
    if (exists) {
      await RNFS.unlink(filePath);
      console.log('🧹 Cleaned up temporary audio file:', filePath);
    } else {
      console.log('ℹ️ File already deleted:', filePath);
    }
  } catch (error) {
    console.error('❌ Error cleaning up temporary file:', error);
  }
};

// Add back the helper function to check if URL is local file
const isLocalFileUrl = (url: string): boolean => {
  return url.startsWith('file://');
};

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
  const [currentNewsId, setCurrentNewsId] = useState<string | null>(null);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const audioRecorderPlayer = useRef(new AudioRecorderPlayer()).current;
  const [_recordedAudioUri, setRecordedAudioUri] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [_isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<any>(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const audioQueueRef = useRef<AudioQueueItem[]>([]);
  const [socketError, setSocketError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const reconnectAttemptsRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 3;
  const RECONNECT_DELAY = 1000; // 1 second
  const isPlayingRef = useRef(false);
  const filesToCleanupRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const activeAudioFilesRef = useRef<Set<string>>(new Set());
  const [isBuffering, setIsBuffering] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(
    null,
  );

  // Create refs for values that need to be accessed in socket callbacks
  const chatMessagesRef = useRef(chatMessages);
  const isStreamingRef = useRef(isStreaming);
  const isProcessingRef = useRef(isProcessing);
  const isPlayerReadyRef = useRef(isPlayerReady);

  // Update refs when values change
  useEffect(() => {
    chatMessagesRef.current = chatMessages;
    isStreamingRef.current = isStreaming;
    isProcessingRef.current = isProcessing;
    isPlayerReadyRef.current = isPlayerReady;
  }, [chatMessages, isStreaming, isProcessing, isPlayerReady]);

  useEffect(() => {
    const getUserEmail = async () => {
      try {
        const userData = await AsyncStorage.getItem('user');
        if (userData) {
          const user = JSON.parse(userData);
          setUserEmail(user.email);
          setIsFreePlan(
            user.isFreePlan ||
              !user.subscriptionStatus ||
              user.subscriptionStatus !== 'active',
          );
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
      // Check if we're switching to a different news story
      if (currentNewsId !== currentNews._id) {
        // Clear previous chat messages when switching to a different news story
        setChatMessages([]);
        setCurrentNewsId(currentNews._id);
      }
      loadChatHistory();
    }
  }, [isOpen, currentNews, userEmail, loadChatHistory, currentNewsId]);

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
    } catch (error) {}
  }, []);

  // Update the cleanup function to be more selective
  const scheduleFileCleanup = useCallback(
    (filePath: string, delay: number = 5000) => {
      // Don't schedule cleanup if this is an active audio file
      if (activeAudioFilesRef.current.has(filePath)) {
        console.log('🔒 Keeping audio file for replay:', filePath);
        return;
      }

      // Clear any existing cleanup timeout for this file
      const existingTimeout = filesToCleanupRef.current.get(filePath);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // Schedule new cleanup
      const timeout = setTimeout(async () => {
        // Only clean up if the file is not in active files
        if (!activeAudioFilesRef.current.has(filePath)) {
          await safeDeleteFile(filePath);
          filesToCleanupRef.current.delete(filePath);
        }
      }, delay);

      filesToCleanupRef.current.set(filePath, timeout);
    },
    [],
  );

  // Update processAudioQueue to handle both local and remote URLs
  const processAudioQueue = useCallback(async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) {
      return;
    }

    try {
      isPlayingRef.current = true;
      const nextAudio = audioQueueRef.current[0];

      // Only check file existence for local files
      if (isLocalFileUrl(nextAudio.url)) {
        const filePath = nextAudio.url.replace('file://', '');
        const exists = await fileExists(filePath);
        if (!exists) {
          console.error('❌ Audio file not found:', filePath);
          // Remove from queue and try next
          audioQueueRef.current.shift();
          isPlayingRef.current = false;
          processAudioQueue();
          return;
        }
      }

      console.log('🎵 Processing next audio in queue:', {
        messageId: nextAudio.messageId,
        queueLength: audioQueueRef.current.length,
        url: nextAudio.url.substring(0, 50) + '...',
        isLocalFile: isLocalFileUrl(nextAudio.url),
      });

      // Stop any existing playback
      await stopChatAudio();

      // Create a track object with optimized settings
      const track = {
        url: nextAudio.url,
        title: 'AI Response',
        artist: 'Assistant',
        duration: 0,
        isLiveStream: true,
      };

      // Set up the track and start playback
      await TrackPlayer.reset();
      await TrackPlayer.add(track);
      await TrackPlayer.play();
      setPlayingAudioId(nextAudio.messageId);

      // Add event listener for playback completion
      const subscription = TrackPlayer.addEventListener(
        Event.PlaybackState,
        async (event: any) => {
          if (event.state === State.Stopped || event.state === State.Ended) {
            console.log('🎵 Audio playback completed:', nextAudio.messageId);
            subscription.remove();

            // Remove the completed audio from queue
            audioQueueRef.current.shift();
            setPlayingAudioId(null);
            isPlayingRef.current = false;

            // Only clean up local files after a delay to allow for replay
            if (isLocalFileUrl(nextAudio.url)) {
              const filePath = nextAudio.url.replace('file://', '');
              // Schedule cleanup after a longer delay (30 seconds) to allow for replay
              scheduleFileCleanup(filePath, 30000);
            }

            // Process next audio if available
            if (audioQueueRef.current.length > 0) {
              console.log('🎵 Queue not empty, processing next audio...');
              processAudioQueue();
            }
          } else if (event.state === State.Error) {
            subscription.remove();

            // Remove the failed audio from queue
            audioQueueRef.current.shift();
            setPlayingAudioId(null);
            isPlayingRef.current = false;

            // Only clean up local files
            if (isLocalFileUrl(nextAudio.url)) {
              const filePath = nextAudio.url.replace('file://', '');
              await safeDeleteFile(filePath);
            }

            Alert.alert(
              'Audio Error',
              'Failed to play audio. Moving to next response.',
            );
            // Try next audio
            processAudioQueue();
          }
        },
      );
    } catch (error) {
      console.error('❌ Error processing audio queue:', error);
      // Remove the failed audio from queue
      const failedAudio = audioQueueRef.current.shift();
      if (failedAudio) {
        if (isLocalFileUrl(failedAudio.url)) {
          const filePath = failedAudio.url.replace('file://', '');
          await safeDeleteFile(filePath);
        }
      }
      isPlayingRef.current = false;
      // Try next audio
      processAudioQueue();
    }
  }, []);

  // Update handleAiResponse to track active audio files
  const handleAiResponse = async (data: any) => {
    console.log('📥 Received AI response:', {
      hasContent: !!data.content,
      hasAudio: !!data.audio,
      isComplete: data.isComplete,
      hasTranscription: !!data.transcribedText,
      audioLength: data.audio?.length,
      isPlayerReady: isPlayerReadyRef.current,
      currentPlayingId: playingAudioId,
      messageId: data.messageId,
      hostedAudioUrl: data.hostedAudioUrl,
    });

    const {
      content,
      audio,
      isComplete,
      transcribedText,
      messageId,
      hostedAudioUrl,
    } = data;

    // Set streaming state immediately when we receive a response
    if (!isStreaming) {
      setIsStreaming(true);
      setStreamingMessageId(messageId);
    }

    // Handle transcription first if available
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

    // Handle audio if available
    if (audio) {
      try {
        console.log('🔊 Processing audio response...');

        // Create a temporary file path
        const tempFilePath = `${
          RNFS.CachesDirectoryPath
        }/ai_response_${Date.now()}.mp3`;

        // Write base64 audio to file
        const base64Data = audio.replace(/^data:audio\/\w+;base64,/, '');
        await RNFS.writeFile(tempFilePath, base64Data, 'base64');
        console.log('🔊 Created temporary audio file:', tempFilePath);

        // Add to active files BEFORE updating messages
        activeAudioFilesRef.current.add(tempFilePath);

        // Update the last assistant message with audio URL and messageId
        setChatMessages(prev => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage && lastMessage.role === 'assistant') {
            console.log(
              '📝 Updating assistant message with audio URL and messageId:',
              messageId,
            );
            // During streaming, use the temporary file
            lastMessage.audioUrl = `file://${tempFilePath}`;
            lastMessage._id = messageId;

            // If this is the final chunk and we have a hosted URL, store it
            if (isComplete && hostedAudioUrl) {
              console.log(
                '✅ Storing hosted audio URL for replay:',
                hostedAudioUrl,
              );
              lastMessage.audioUrl = hostedAudioUrl; // Update to use hosted URL
              lastMessage.completeAudioUrl = hostedAudioUrl;
            }
          }
          return newMessages;
        });

        // Add to audio queue with backend messageId
        audioQueueRef.current.push({
          url: `file://${tempFilePath}`,
          messageId,
        });
        console.log('🎵 Added audio to queue:', {
          messageId,
          queueLength: audioQueueRef.current.length,
          isStreaming: true,
        });

        // Start processing queue if not already playing
        if (!isPlayingRef.current) {
          setPlayingAudioId(messageId); // Set playing state immediately for streaming
          processAudioQueue();
        }
      } catch (error) {
        console.error('❌ Error processing audio:', error);
        Alert.alert('Audio Error', 'Failed to process audio response');
        setIsStreaming(false);
        setStreamingMessageId(null);
      }
    }

    // Update message content
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

    // Handle completion
    if (isComplete) {
      console.log('✅ Response complete');
      setIsStreaming(false);
      setStreamingMessageId(null);
      setIsProcessing(false);

      // If we have a hosted URL, update the message to use it
      if (hostedAudioUrl) {
        setChatMessages(prev => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage && lastMessage.role === 'assistant') {
            console.log('🔄 Updating to hosted audio URL:', hostedAudioUrl);
            lastMessage.audioUrl = hostedAudioUrl;
            lastMessage.completeAudioUrl = hostedAudioUrl;
          }
          return newMessages;
        });
      }

      // Only stop audio if we're not playing a queued audio
      if (audioQueueRef.current.length === 0) {
        await stopModalAudio();
      }
    }
  };

  const handleChatUpdate = (data: any) => {
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
  };

  const handleError = (error: any) => {
    console.error('❌ Socket error:', {
      message: error?.message,
      details: error,
    });
    setIsProcessing(false);
    setIsStreaming(false);
    Alert.alert('Error', error?.message || 'An error occurred');
  };

  // Update socket connection effect to use the handlers
  useEffect(() => {
    if (!isOpen || !userEmail || !currentNews?._id) {
      return;
    }

    let socketInstance: any = null;
    let reconnectTimeout: NodeJS.Timeout;

    const connectSocket = () => {
      if (socketInstance?.connected) {
        return;
      }

      setIsConnecting(true);
      setSocketError(null);

      console.log('Initializing socket connection...');
      socketInstance = io('http://192.168.252.97:8080', {
        transports: ['websocket'],
        withCredentials: true,
        reconnection: false,
      });

      socketRef.current = socketInstance;

      // Connection event handlers
      socketInstance.on('connect', () => {
        console.log('✅ Socket connected successfully');
        setIsConnected(true);
        setIsConnecting(false);
        reconnectAttemptsRef.current = 0;

        console.log('Joining chat room:', {
          newsId: currentNews._id,
          email: userEmail,
        });
        socketInstance.emit('join-chat', {
          newsId: currentNews._id,
          email: userEmail,
        });
      });

      socketInstance.on('connect_error', (error: Error) => {
        console.error('❌ Socket connection error:', error);
        setSocketError('Failed to connect to chat server');
        setIsConnecting(false);
        setIsConnected(false);

        // Implement exponential backoff for reconnection
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          const delay =
            RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current);
          reconnectTimeout = setTimeout(() => {
            reconnectAttemptsRef.current += 1;
            connectSocket();
          }, delay);
        } else {
          Alert.alert(
            'Connection Error',
            'Unable to connect to chat server. Please try again later.',
            [{text: 'OK', onPress: onClose}],
          );
        }
      });

      // Attach event listeners using the handlers from component scope
      socketInstance.on('ai-response', handleAiResponse);
      socketInstance.on('chat-update', handleChatUpdate);
      socketInstance.on('error', handleError);
      socketInstance.on('disconnect', () => {
        console.log('❌ Socket disconnected');
        setIsConnected(false);
        setIsStreaming(false);
      });
    };

    // Initial connection
    connectSocket();

    // Cleanup function
    return () => {
      console.log('Cleaning up socket connection...');

      // Clear any pending reconnection
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }

      // Remove all event listeners
      if (socketInstance) {
        socketInstance.off('connect');
        socketInstance.off('connect_error');
        socketInstance.off('ai-response');
        socketInstance.off('chat-update');
        socketInstance.off('error');
        socketInstance.off('disconnect');

        // Only disconnect if we're still connected
        if (socketInstance.connected) {
          socketInstance.disconnect();
        }
      }

      socketRef.current = null;
      setIsConnected(false);
      setIsConnecting(false);
      setSocketError(null);
      reconnectAttemptsRef.current = 0;
    };
  }, [isOpen, userEmail, currentNews?._id]);

  // Add TrackPlayer event listener for playback state changes
  useTrackPlayerEvents(
    [Event.PlaybackState, Event.PlaybackTrackChanged, Event.PlaybackError],
    async event => {
      if (event.type === Event.PlaybackState) {
        if (event.state === State.Buffering) {
          console.log('⏳ Audio buffering...');
          setIsBuffering(true);
        } else if (event.state === State.Playing) {
          console.log('▶️ Audio playing');
          setIsBuffering(false);
        } else if (event.state === State.Paused) {
          console.log('⏸️ Audio paused');
          setIsBuffering(false);
        } else if (
          event.state === State.Stopped ||
          event.state === State.Ended
        ) {
          console.log('⏹️ Audio stopped/ended');
          setIsBuffering(false);
          // Reset the playing audio ID when stopped
          if (playingAudioId) {
            setPlayingAudioId(null);
          }
        }
      } else if (event.type === Event.PlaybackError) {
        setIsBuffering(false);
      }
    },
  );

  const handleSend = async () => {
    if (!chatInput.trim() || isStreaming || !currentNews || !userEmail) {
      return;
    }

    if (!canSendMessage()) {
      setShowSubscriptionModal(true);
      return;
    }

    try {
      setIsStreaming(true);
      const newMessage: ChatMessage = {role: 'user', content: chatInput};
      setChatMessages(prev => [...prev, newMessage]);

      // Clear the input field immediately after sending
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
    // Check if user can record based on premium status
    if (!canRecordAudio()) {
      setShowSubscriptionModal(true);
      return;
    }

    // Stop any playing audio first
    if (playingAudioId) {
      console.log('🛑 Stopping current audio playback before recording');
      await stopChatAudio();
      setPlayingAudioId(null);
      isPlayingRef.current = false;
      audioQueueRef.current = [];
    }

    const hasPermission = await requestAudioPermission();
    if (!hasPermission) {
      Alert.alert('Permission Required', 'Microphone permission is required!');
      return;
    }

    // Check socket connection and attempt to reconnect if needed
    const socket = socketRef.current;
    if (!socket?.connected) {
      console.log('Socket not connected, attempting to connect...');
      setIsConnecting(true);
      setSocketError(null);

      try {
        // Create new socket instance if none exists
        if (!socket) {
          const newSocket = io('http://192.168.0.114:8080', {
            transports: ['websocket'],
            withCredentials: true,
            reconnection: false,
          });

          // Set up event handlers
          newSocket.on('connect', () => {
            console.log('✅ Socket connected successfully');
            setIsConnected(true);
            setIsConnecting(false);
            reconnectAttemptsRef.current = 0;

            // Join chat room after connection
            if (currentNews?._id && userEmail) {
              console.log('Joining chat room:', {
                newsId: currentNews._id,
                email: userEmail,
              });
              newSocket.emit('join-chat', {
                newsId: currentNews._id,
                email: userEmail,
              });
            }

            // Start recording after successful connection
            startRecordingAfterConnection();
          });

          newSocket.on('connect_error', (error: Error) => {
            console.error('❌ Socket connection error:', error);
            setSocketError('Failed to connect to chat server');
            setIsConnecting(false);
            setIsConnected(false);
            Alert.alert(
              'Connection Error',
              'Unable to connect to chat server. Please try again.',
              [{text: 'OK'}],
            );
          });

          // Set up other event handlers
          newSocket.on('ai-response', handleAiResponse);
          newSocket.on('chat-update', handleChatUpdate);
          newSocket.on('error', handleError);
          newSocket.on('disconnect', () => {
            console.log('❌ Socket disconnected');
            setIsConnected(false);
            setIsStreaming(false);
          });

          socketRef.current = newSocket;
        } else {
          // If socket exists but disconnected, try to reconnect
          socket.connect();
        }

        // Wait for connection with timeout
        const connectionTimeout = setTimeout(() => {
          if (!socketRef.current?.connected) {
            setIsConnecting(false);
            setSocketError('Connection timeout');
            Alert.alert(
              'Connection Error',
              'Unable to connect to chat server. Please try again.',
              [{text: 'OK'}],
            );
          }
        }, 5000); // 5 second timeout

        return; // Exit early, recording will start after connection
      } catch (error) {
        console.error('Error establishing socket connection:', error);
        setIsConnecting(false);
        setSocketError('Connection failed');
        Alert.alert(
          'Connection Error',
          'Failed to connect to chat server. Please try again.',
          [{text: 'OK'}],
        );
        return;
      }
    }

    // If we're already connected, start recording immediately
    await startRecordingAfterConnection();
  };

  // Separate function to handle the actual recording start
  const startRecordingAfterConnection = async () => {
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
      console.log('Error stopping recording:', error);
      setIsRecording(false);
      Alert.alert(
        'Recording Error',
        'Failed to save recording. Please try again.',
        [{text: 'OK'}],
      );
    }
  };

  const sendAudioMessage = async (audioUri: string) => {
    // Check if user can send audio based on premium status
    if (!canRecordAudio()) {
      setShowSubscriptionModal(true);
      return;
    }

    const socket = socketRef.current;
    if (!currentNews?._id || !userEmail || !socket?.connected) {
      console.log('❌ Cannot send audio message:', {
        hasNewsId: !!currentNews?._id,
        hasEmail: !!userEmail,
        isConnected: socket?.connected,
      });
      Alert.alert('Error', 'Not connected to chat server');
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
        socket.emit('audio-message', {
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
    console.log('🎵 Toggle audio called:', {
      messageId,
      isPlayerReady: isPlayerReadyRef.current,
      currentPlayingId: playingAudioId,
      url: audioUrl.substring(0, 50) + '...',
      isLocalFile: isLocalFileUrl(audioUrl),
      isStreaming,
      streamingMessageId,
    });

    if (!isPlayerReadyRef.current) {
      console.error('❌ Modal TrackPlayer not ready');
      Alert.alert('Error', 'Audio player is not ready. Please try again.');
      return;
    }

    try {
      // Find the message to get the current audio URL
      const message = chatMessages.find(
        msg => (msg._id || `msg-${chatMessages.indexOf(msg)}`) === messageId,
      );

      // If streaming is complete, use the hosted URL
      const audioUrlToPlay =
        !isStreaming && message?.completeAudioUrl
          ? message.completeAudioUrl
          : audioUrl;

      console.log('🎵 Audio URL to play:', {
        messageId,
        isStreaming,
        usingHostedUrl: !isStreaming && !!message?.completeAudioUrl,
        url: audioUrlToPlay.substring(0, 50) + '...',
      });

      // If clicking the same audio that was playing
      if (playingAudioId === messageId) {
        console.log('🛑 Same audio clicked, stopping playback');
        await stopChatAudio();
        setPlayingAudioId(null);
        isPlayingRef.current = false;

        // If this was streaming, clear the queue and reset streaming state
        if (isStreaming && streamingMessageId === messageId) {
          console.log('🛑 Stopping streaming audio');
          audioQueueRef.current = [];
          setIsStreaming(false);
          setStreamingMessageId(null);
        }
        return;
      }

      // Always stop current playback first if there is any
      if (playingAudioId) {
        console.log('🛑 Stopping current audio playback:', playingAudioId);
        await stopChatAudio();
        setPlayingAudioId(null);
        isPlayingRef.current = false;
      }

      // For local files, verify existence before playing
      if (isLocalFileUrl(audioUrlToPlay)) {
        const filePath = audioUrlToPlay.replace('file://', '');
        const exists = await fileExists(filePath);
        if (!exists) {
          // If file doesn't exist but it's an active file, it might be in the process of being created
          if (activeAudioFilesRef.current.has(filePath)) {
            console.log(
              '⏳ Audio file is being prepared, please try again in a moment',
            );
            Alert.alert(
              'Please Wait',
              'Audio is being prepared. Please try again in a moment.',
            );
            return;
          }
          console.error('❌ Audio file not found:', filePath);
          Alert.alert('Error', 'Audio file not found. Please try again.');
          return;
        }
      }

      // Clear current queue and add this audio
      console.log('🎵 Starting new audio playback:', {
        messageId,
        usingHostedUrl: !isStreaming && !!message?.completeAudioUrl,
        url: audioUrlToPlay.substring(0, 50) + '...',
      });

      audioQueueRef.current = [
        {
          url: audioUrlToPlay,
          messageId,
        },
      ];

      // If this was streaming, reset streaming state
      if (isStreaming && streamingMessageId === messageId) {
        console.log('🔄 Resetting streaming state for replay');
        setIsStreaming(false);
        setStreamingMessageId(null);
      }

      // Start playback
      processAudioQueue();
    } catch (error) {
      console.error('❌ Error playing audio:', error);
      Alert.alert('Error', 'Failed to play audio. Please try again.');
    }
  };

  // Update the TrackPlayer initialization
  useEffect(() => {
    let isMounted = true;
    let setupTimeout: NodeJS.Timeout;

    const setupPlayer = async () => {
      try {
        console.log('🎵 Setting up chat TrackPlayer...');

        // Configure TrackPlayer with valid options
        await TrackPlayer.updateOptions({
          android: {
            appKilledPlaybackBehavior:
              AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
          },
          capabilities: [Capability.Play, Capability.Pause, Capability.Stop],
          compactCapabilities: [
            Capability.Play,
            Capability.Pause,
            Capability.Stop,
          ],
        });

        const success = await setupChatPlayer();
        console.log('🎵 Chat TrackPlayer setup result:', success);

        if (isMounted && success) {
          setIsPlayerReady(true);
          isPlayerReadyRef.current = true;
          console.log('✅ Chat TrackPlayer initialized and ready');

          // Pre-warm the player by adding a silent track
          const silentTrack = {
            url: 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAASAAAeMwAUFBQUFCIiIiIiIjAwMDAwPz8/Pz8/TU1NTU1NW1tbW1tbaGhoaGhoaHd3d3d3d4aGhoaGhpSUlJSUlKGhoaGhoa+vr6+vr7+/v7+/v8rKysrKytTU1NTU1OPj4+Pj4/Ly8vLy8v///////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAYAAAAAAAAAHjOZTf9C//MUZAAAAAGkAAAAAAAAA0gAAAAATEFN//MUZAMAAAGkAAAAAAAAA0gAAAAARTEFN//MUZAYAAAGkAAAAAAAAA0gAAAAARTEFN//MUZAkAAAGkAAAAAAAAA0gAAAAARTEFN//MUZAkAAAGkAAAAAAAAA0gAAAAARTEFN//MUZAkAAAGkAAAAAAAAA0gAAAAARTEFN//MUZAkAAAGkAAAAAAAAA0gAAAAARTEFN',
            title: 'Silent Track',
            artist: 'System',
            duration: 0.1,
          };

          await TrackPlayer.reset();
          await TrackPlayer.add(silentTrack);
          console.log('🎵 TrackPlayer pre-warmed');

          // Process any queued audio
          if (audioQueueRef.current.length > 0) {
            console.log('🎵 Processing queued audio after initialization...');
            processAudioQueue();
          }
        } else {
          console.error('❌ Chat TrackPlayer setup failed');
          if (isMounted) {
            setIsPlayerReady(false);
            isPlayerReadyRef.current = false;
          }
        }
      } catch (error) {
        console.error('❌ Error initializing chat TrackPlayer:', error);
        if (isMounted) {
          setIsPlayerReady(false);
          isPlayerReadyRef.current = false;
        }
      }
    };

    // Pre-initialize the player when the modal opens
    if (isOpen) {
      console.log('🎵 Modal opened, setting up TrackPlayer...');
      // Small delay to ensure UI is ready
      setupTimeout = setTimeout(setupPlayer, 100);
    }

    // Cleanup when modal closes
    return () => {
      console.log('🎵 Modal closing, cleaning up TrackPlayer...');
      isMounted = false;
      if (setupTimeout) {
        clearTimeout(setupTimeout);
      }
      if (isPlayerReady) {
        cleanupChatPlayer();
        setIsPlayerReady(false);
        isPlayerReadyRef.current = false;
        audioQueueRef.current = [];
      }
    };
  }, [isOpen, processAudioQueue]);

  // Add cleanup effect for when modal closes
  useEffect(() => {
    if (!isOpen) {
      // Stop any playing audio when modal closes
      const cleanup = async () => {
        try {
          isStreamingRef.current = false;
          setIsStreaming(false);
          console.log('🛑 Modal closing, stopping audio playback...');
          await stopChatAudio();
          setPlayingAudioId(null);
          setStreamingMessageId(null);
          isPlayingRef.current = false;
          setIsBuffering(false);
          audioQueueRef.current = [];

          // Clear all cleanup timeouts
          filesToCleanupRef.current.forEach(timeout => {
            clearTimeout(timeout);
          });
          filesToCleanupRef.current.clear();

          // Clean up all active files
          activeAudioFilesRef.current.forEach(async filePath => {
            await safeDeleteFile(filePath);
          });
          activeAudioFilesRef.current.clear();
        } catch (error) {
          console.error('❌ Error cleaning up audio on modal close:', error);
        }
      };

      cleanup();
    }
  }, [isOpen]);

  // Update the modal close handler
  const handleModalClose = useCallback(async () => {
    try {
      // Stop any playing audio
      await stopChatAudio();
      setPlayingAudioId(null);
      isPlayingRef.current = false;
      setIsBuffering(false);
      audioQueueRef.current = [];
    } catch (error) {
      console.log('❌ Error stopping audio on modal close:', error);
    }
    onClose();
  }, [onClose]);

  // Animation values for both states
  const bufferAnim = useRef(new Animated.Value(0)).current;
  const playAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const spinValue = useRef(new Animated.Value(0)).current;
  const recordingAnim = useRef(new Animated.Value(0)).current;

  // Spin interpolation for loading animation
  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Recording animation interpolation
  const recordingScale = recordingAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.1, 1],
  });

  const recordingOpacity = recordingAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0.7, 1],
  });

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
          handleModalClose();
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

  // Effect for buffering animation (wavy dots)
  useEffect(() => {
    let animation: Animated.CompositeAnimation;

    if (isBuffering) {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(bufferAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
          Animated.timing(bufferAnim, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
        ]),
      );
      animation.start();
    }

    return () => {
      if (animation) {
        animation.stop();
      }
    };
  }, [isBuffering]);

  // Effect for playback animation (dynamic waves)
  useEffect(() => {
    let animation: Animated.CompositeAnimation;

    if (playingAudioId && !isBuffering) {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(playAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
          Animated.timing(playAnim, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
        ]),
      );
      animation.start();
    }

    return () => {
      if (animation) {
        animation.stop();
      }
    };
  }, [playingAudioId, isBuffering]);

  // Effect for send button spin animation
  useEffect(() => {
    let animation: Animated.CompositeAnimation;

    if (isStreaming) {
      animation = Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      );
      animation.start();
    } else {
      spinValue.setValue(0);
    }

    return () => {
      if (animation) {
        animation.stop();
      }
    };
  }, [isStreaming]);

  // Effect for recording animation
  useEffect(() => {
    let animation: Animated.CompositeAnimation;

    if (isRecording) {
      animation = Animated.loop(
        Animated.timing(recordingAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
      );
      animation.start();
    } else {
      recordingAnim.setValue(0);
    }

    return () => {
      if (animation) {
        animation.stop();
      }
    };
  }, [isRecording]);

  // Update the BufferingDots component with wavy animation
  const BufferingDots = () => {
    // Create separate animation values for each dot
    const dot1Anim = useRef(new Animated.Value(0)).current;
    const dot2Anim = useRef(new Animated.Value(0)).current;
    const dot3Anim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      // Create wave-like animation sequence
      const createWaveAnimation = (anim: Animated.Value, delay: number) => {
        return Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(anim, {
              toValue: 1,
              duration: 600,
              useNativeDriver: true,
              easing: Easing.inOut(Easing.ease),
            }),
            Animated.timing(anim, {
              toValue: 0,
              duration: 600,
              useNativeDriver: true,
              easing: Easing.inOut(Easing.ease),
            }),
          ]),
        );
      };

      // Start animations with different delays for wave effect
      const anim1 = createWaveAnimation(dot1Anim, 0);
      const anim2 = createWaveAnimation(dot2Anim, 200);
      const anim3 = createWaveAnimation(dot3Anim, 400);

      anim1.start();
      anim2.start();
      anim3.start();

      return () => {
        anim1.stop();
        anim2.stop();
        anim3.stop();
      };
    }, []);

    const getDotStyle = (anim: Animated.Value) => ({
      transform: [
        {
          translateY: anim.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [0, -6, 0],
          }),
        },
        {
          scale: anim.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [1, 1.2, 1],
          }),
        },
      ],
      opacity: anim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0.4, 1, 0.4],
      }),
    });

    return (
      <View style={tw`flex-row items-center gap-1`}>
        <Animated.View
          style={[tw`w-1.5 h-1.5 rounded-full bg-white`, getDotStyle(dot1Anim)]}
        />
        <Animated.View
          style={[tw`w-1.5 h-1.5 rounded-full bg-white`, getDotStyle(dot2Anim)]}
        />
        <Animated.View
          style={[tw`w-1.5 h-1.5 rounded-full bg-white`, getDotStyle(dot3Anim)]}
        />
      </View>
    );
  };

  // Helper component for playback waves
  const PlaybackWaves = () => {
    const waveStyle = (index: number) => ({
      transform: [
        {
          scale: playAnim.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [1, 1.2 + index * 0.1, 1],
          }),
        },
      ],
      opacity: playAnim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0.3, 0.7 - index * 0.1, 0.3],
      }),
    });

    return (
      <View style={tw`flex-row items-center gap-0.5`}>
        {[0, 1, 2].map(index => (
          <Animated.View
            key={index}
            style={[tw`w-1 h-3 bg-white rounded-full`, waveStyle(index)]}
          />
        ))}
      </View>
    );
  };

  // Add this helper function before the return statement
  const shouldShowAudioIndicator = (msg: ChatMessage, index: number) => {
    if (isStreamingRef.current) {
      console.log('WALLA HABIBI', index, chatMessages.length - 1);
      if (index == chatMessages.length - 1) {
        return {showWaves: true, isBuffering: false};
      }
    }
    const messageId = msg._id || `msg-${index}`;
    const isCurrentMessagePlaying = playingAudioId === messageId;
    const isCurrentlyStreaming =
      isStreaming && streamingMessageId === messageId;
    const isLastAssistantMessage =
      msg.role === 'assistant' && msg === chatMessages[chatMessages.length - 1];

    // Add debug logging
    console.log('Audio indicator state:', {
      messageId,
      isCurrentMessagePlaying,
      isCurrentlyStreaming,
      isLastAssistantMessage,
      isStreaming,
      streamingMessageId,
      playingAudioId,
      isBuffering,
    });

    return {
      isBuffering:
        isBuffering && (isCurrentMessagePlaying || isCurrentlyStreaming),
      showWaves:
        (isCurrentMessagePlaying || isCurrentlyStreaming) && !isBuffering,
    };
  };

  // Helper functions to check user permissions
  const canSendMessage = () => {
    if (!isFreePlan) return true; // Premium users can always send
    // Count user messages from chat history
    const userMessageCount = chatMessages.filter(
      msg => msg.role === 'user',
    ).length;
    return userMessageCount < 1; // Free plan allows 1 exchange (1 user message)
  };

  const canRecordAudio = () => {
    if (!isFreePlan) return true; // Premium users can always record
    // Count user messages from chat history
    const userMessageCount = chatMessages.filter(
      msg => msg.role === 'user',
    ).length;
    return userMessageCount < 1; // Free plan allows 1 exchange (1 user message)
  };

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="slide"
      onRequestClose={handleModalClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={tw`flex-1`}>
        <View style={tw`flex-1 bg-black/60`}>
          <Animated.View
            style={[
              tw`flex-1 mt-20 bg-[#040439] rounded-t-3xl overflow-hidden`,
              {
                transform: [{translateY}],
              },
            ]}>
            {/* Header */}
            <View
              style={tw`flex-row items-center justify-between p-4 border-b border-[#2D283A] bg-[#0A0830]`}
              {...panResponder.panHandlers}>
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
                onPress={handleModalClose}
                style={tw`p-2 rounded-xl bg-[#2D283A] border border-[#FFFFFF15] shadow-sm`}
                activeOpacity={0.7}>
                <Icon name="times" size={16} color="#9CA3AF" />
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
                    {isFreePlan
                      ? `Free plan: ${
                          chatMessages.filter(msg => msg.role === 'user').length
                        }/1 exchanges used`
                      : 'Premium: Unlimited exchanges'}
                  </Text>
                </View>
              ) : (
                chatMessages.map((msg, index) => {
                  return (
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
                            <>
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
                                    {isBuffering &&
                                    playingAudioId ===
                                      (msg._id || `msg-${index}`) ? (
                                      <Icon
                                        name="spinner"
                                        size={16}
                                        color="#fff"
                                      />
                                    ) : (
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
                                    )}
                                  </View>
                                </LinearGradient>
                              </TouchableOpacity>

                              {(() => {
                                const messageId = msg._id || `msg-${index}`;
                                const isCurrentMessagePlaying =
                                  playingAudioId === messageId;
                                if (!isCurrentMessagePlaying) return null;

                                const {isBuffering, showWaves} =
                                  shouldShowAudioIndicator(msg, index);

                                return (
                                  <View
                                    style={tw`absolute -top-2 -right-2 items-center justify-center bg-blue-600 px-2 py-1 rounded-full`}>
                                    {isBuffering ? (
                                      <BufferingDots />
                                    ) : (
                                      showWaves && <PlaybackWaves />
                                    )}
                                  </View>
                                );
                              })()}
                            </>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </ScrollView>

            {/* Input Area */}
            <View style={tw`p-4 pb-6 border-t border-[#2D283A] bg-[#0A0830]`}>
              {isFreePlan &&
                chatMessages.filter(msg => msg.role === 'user').length >= 1 && (
                  <View style={tw`flex-row items-center justify-between mb-3`}>
                    <Text style={tw`text-gray-300 text-sm flex-1 mr-2`}>
                      Upgrade to premium for unlimited exchanges and more
                      features.
                    </Text>
                    <TouchableOpacity
                      onPress={() => setShowSubscriptionModal(true)}
                      style={tw`rounded-lg overflow-hidden`}>
                      <LinearGradient
                        colors={['#4C4AE3', '#6366f1']}
                        start={{x: 0, y: 0}}
                        end={{x: 1, y: 0}}
                        style={tw`rounded-lg`}>
                        <Text
                          style={tw`text-white text-sm font-medium  px-3 py-1`}>
                          Upgrade
                        </Text>
                      </LinearGradient>
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
                  editable={!isStreaming && !isProcessing && canSendMessage()}
                />
                <View style={tw`flex-row items-center gap-2`}>
                  <View style={tw`items-center`}>
                    <TouchableOpacity
                      onPress={isRecording ? stopRecording : startRecording}
                      disabled={isProcessing || !canRecordAudio()}
                      style={tw`p-2 rounded-lg ${
                        isRecording
                          ? 'bg-gradient-to-r from-[#4C4AE3] to-[#6366f1]'
                          : 'bg-gradient-to-r from-[#4C4AE3] to-[#6366f1]'
                      } ${
                        isProcessing || !canRecordAudio() ? 'opacity-50' : ''
                      }`}>
                      {isRecording && (
                        <Animated.View
                          style={[
                            tw`absolute inset-1 rounded-lg border-2 border-blue-400 opacity-75`,
                            {
                              opacity: recordingOpacity,
                              transform: [{scale: recordingScale}],
                            },
                          ]}
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
                        isStreaming ||
                        !chatInput.trim() ||
                        isProcessing ||
                        !canSendMessage()
                      }
                      style={tw`p-2 rounded-lg bg-gradient-to-r from-[#4C4AE3] to-[#6366f1] ${
                        isStreaming ||
                        !chatInput.trim() ||
                        isProcessing ||
                        !canSendMessage()
                          ? 'opacity-50'
                          : ''
                      }`}>
                      {isStreaming ? (
                        <Animated.View style={{transform: [{rotate: spin}]}}>
                          <Icon name="spinner" size={20} color="#fff" />
                        </Animated.View>
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
          </Animated.View>
        </View>

        {/* Connection status indicators */}
        {isConnecting && (
          <View
            style={tw`absolute top-2 left-1/2 transform -translate-x-1/2 bg-blue-500/90 px-3 py-1 rounded-full`}>
            <Text style={tw`text-white text-sm`}>Connecting...</Text>
          </View>
        )}

        {socketError && (
          <View
            style={tw`absolute top-2 left-1/2 transform -translate-x-1/2 bg-red-500/90 px-3 py-1 rounded-full`}>
            <Text style={tw`text-white text-sm`}>{socketError}</Text>
          </View>
        )}

        {/* Subscription Modal */}
        {showSubscriptionModal && (
          <SubscriptionModal
            visible={showSubscriptionModal}
            onClose={() => setShowSubscriptionModal(false)}
          />
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default ChatModal;
