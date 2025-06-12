/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Animated,
  PermissionsAndroid,
  Platform,
  Alert,
  Modal,
} from 'react-native';
import {
  useNavigation,
  useRoute,
  RouteProp,
  useFocusEffect,
} from '@react-navigation/native';
import TrackPlayer, {
  useTrackPlayerEvents,
  Event,
  Capability,
  AppKilledPlaybackBehavior,
  State,
} from 'react-native-track-player';
import apiService from '../services/apiService';
import type {RootStackParamList} from '../App';
import {fonts} from '../utils/fonts';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Step =
  | 'intro'
  | 'recording1'
  | 'recording1Submitted'
  | 'recording2Instruction'
  | 'recording2'
  | 'recording2Submitted';

const AudioPulse = () => {
  const scale1 = useRef(new Animated.Value(1)).current;
  const scale2 = useRef(new Animated.Value(1)).current;
  const scale3 = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const createPulse = (animatedValue: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(animatedValue, {
            toValue: 1.5,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(animatedValue, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ).start();

    createPulse(scale1, 0);
    createPulse(scale2, 300);
    createPulse(scale3, 600);

    return () => {
      scale1.stopAnimation();
      scale2.stopAnimation();
      scale3.stopAnimation();
    };
  }, [scale1, scale2, scale3]);

  return (
    <View style={styles.audioAnimation} pointerEvents="none">
      <Animated.View
        style={[
          styles.pulseCircle,
          styles.pulse1,
          {transform: [{scale: scale1}]},
        ]}
      />
      <Animated.View
        style={[
          styles.pulseCircle,
          styles.pulse2,
          {transform: [{scale: scale2}]},
        ]}
      />
      <Animated.View
        style={[
          styles.pulseCircle,
          styles.pulse3,
          {transform: [{scale: scale3}]},
        ]}
      />
      <View style={styles.pulseDot} />
    </View>
  );
};

// Define mic and pulse sizes
const MIC_SIZE = 60; // match your micIcon size
const PULSE_SIZE = 72; // slightly larger for the border effect

const MicPulse = () => {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.25,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [scale]);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: PULSE_SIZE,
        height: PULSE_SIZE,
        borderRadius: PULSE_SIZE / 2,
        borderWidth: 2,
        borderColor: '#6366F1', // indigo-500
        opacity: 0.7,
        top: (MIC_SIZE - PULSE_SIZE) / 2,
        left: (MIC_SIZE - PULSE_SIZE) / 2,
        transform: [{scale}],
        zIndex: 1,
      }}
      pointerEvents="none"
    />
  );
};

const getUniqueRecordingPath = () => {
  const timestamp = Date.now();
  let dir, ext;
  if (Platform.OS === 'ios') {
    dir = RNFS.CachesDirectoryPath;
    ext = 'm4a';
  } else {
    dir = RNFS.ExternalCachesDirectoryPath;
    ext = 'm4a';
  }
  return `${dir}/sound-${timestamp}.${ext}`;
};

const TalkWithAIScreen: React.FC = () => {
  const route = useRoute<RouteProp<RootStackParamList, 'TalkWithAI'>>();
  const {firstName, email} = route.params;
  const [step, setStep] = useState<Step>('intro');
  const [instructionAudioUrl, setInstructionAudioUrl] = useState<string | null>(
    null,
  );
  const [isAudioPlaying, setIsAudioPlaying] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [transcript1, setTranscript1] = useState<string | null>(null);
  const [transcript2, setTranscript2] = useState<string | null>(null);
  const [onboardingIntro, setOnboardingIntro] = useState<string>('');
  const [displayText, setDisplayText] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordedAudioUri, setRecordedAudioUri] = useState<string>('');
  const [isLoadingIntroAudio, setIsLoadingIntroAudio] = useState(false);
  const [recording1Uri, setRecording1Uri] = useState<string | null>(null);
  const [recording2Uri, setRecording2Uri] = useState<string | null>(null);

  const navigation = useNavigation();

  const audioRecorderPlayer = useRef(new AudioRecorderPlayer()).current;

  const finalizingQuotes = [
    '“AI is personalizing your news feed...”',
    '“Almost there, making it all about you...”',
    '“Smart news, just for you!”',
    '“Hang tight, your preferences are being set...”',
  ];
  const [quoteIndex, setQuoteIndex] = useState(0);
  const slideAnim = useRef(new Animated.Value(-30)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setupPlayer();
    return () => {
      console.log('TalkWithAIScreen-resetting player');
      TrackPlayer.reset();
    };
  }, []);

  const setupPlayer = async () => {
    try {
      await TrackPlayer.setupPlayer();
      await TrackPlayer.updateOptions({
        android: {
          appKilledPlaybackBehavior:
            AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
        },
        capabilities: [Capability.Play, Capability.Pause, Capability.Stop],
        compactCapabilities: [Capability.Play, Capability.Pause],
      });
    } catch (error) {
      console.error('Error setting up player:', error);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      if (step === 'intro') {
        (async () => {
          setIsLoadingIntroAudio(true);
          try {
            console.log('Fetching intro audio for firstName:', firstName);
            const res = await apiService.post<any>('/user/name-to-audio', {
              firstName,
            });
            console.log('Intro audio fetched:', res.result.audioUrl);
            if (res.result.audioUrl) {
              setOnboardingIntro(res.result.sentence);
              setIsLoadingIntroAudio(false);
              setDisplayText(res.result.sentence);

              await playAudio(res.result.audioUrl);
              setDisplayText(
                "Let's make your news feed all about YOU. What topics get you excited? Sports? Business? Tech? Or something else?\nTap the mic, say what you love, then tap submit.",
              );
              await playAudio(
                'https://d279zq803tcyfh.cloudfront.net/onboarding/3e4d5dfe-f798-4dde-b903-9bf467742f97.mp3',
              );
              setStep('recording1');
            } else {
              console.error('No audio URL returned from API');
            }
          } catch (err) {
            console.error('Error fetching intro audio', err);
          }
        })();
      }
    }, [step, firstName]),
  );

  useTrackPlayerEvents(
    [Event.PlaybackTrackChanged, Event.PlaybackState],
    async (event: any) => {
      if (
        event.type === Event.PlaybackTrackChanged &&
        event.nextTrack === null
      ) {
        handleAudioEnd();
      }
    },
  );

  const playAudio = async (url: string): Promise<void> => {
    return new Promise(async (resolve, reject) => {
      try {
        await TrackPlayer.reset();
        await TrackPlayer.add({
          url,
          title: 'Audio',
          artist: 'AI Assistant',
        });
        await TrackPlayer.play();
        setIsAudioPlaying(true);

        const subscription = TrackPlayer.addEventListener(
          Event.PlaybackState,
          (event: any) => {
            if (event.state === State.Stopped || event.state === State.Ended) {
              setIsAudioPlaying(false);
              subscription.remove();
              resolve();
            }
          },
        );
      } catch (error) {
        setIsAudioPlaying(false);
        reject(error);
      }
    });
  };

  const handleAudioEnd = () => {
    console.log('Audio playback ended at step:', step);
    setIsAudioPlaying(false);
    setDisplayText('');
    if (step === 'recording1Submitted') {
      setStep('recording2');
      resetRecording();
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
    // On iOS, permissions are handled by Info.plist
    return true;
  };

  const startRecording = async () => {
    const hasPermission = await requestAudioPermission();
    if (!hasPermission) {
      Alert.alert('Permission Required', 'Microphone permission is required!');
      return;
    }
    try {
      setIsRecording(true);
      const result = await audioRecorderPlayer.startRecorder();
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

      const uniquePath = getUniqueRecordingPath();
      await RNFS.copyFile(result, uniquePath);
      console.log('Copied recording to unique path:', uniquePath);

      if (step === 'recording1') {
        setRecording1Uri(uniquePath);
      } else if (step === 'recording2') {
        setRecording2Uri(uniquePath);
      }
    } catch (error) {
      console.error('Error stopping recording:', error);
      setIsRecording(false);
      Alert.alert(
        'Recording Error',
        'Failed to save recording. Please try again.',
        [{text: 'OK', onPress: () => resetRecording()}],
      );
    }
  };

  const resetRecording = () => {
    setRecordedAudioUri('');
    setIsRecording(false);
  };

  const handleMicPress = async () => {
    if (isLoading) return;
    if (isRecording) {
      setIsLoading(true);
      await stopRecording();
      setIsLoading(false);
    } else if (step === 'recording1' || step === 'recording2') {
      resetRecording();
      await startRecording();
    }
  };

  const retakeRecording = () => {
    if (step === 'recording1') {
      setTranscript1(null);
    } else if (step === 'recording2') {
      setTranscript2(null);
    }
    resetRecording();
  };

  const submitRecording = async () => {
    console.log('Submitting recording at step:', step);
    setIsLoading(true);
    if (step === 'recording1') {
      setDisplayText(
        'Awesome! So tell me a bit about what kind of work you do. You can share about your industry and the nature of your job.\nTap the mic, say what you love, then tap submit.',
      );
      setStep('recording2Instruction');
      await playAudio(
        'https://d279zq803tcyfh.cloudfront.net/onboarding/841bbc74-247e-4326-a78c-062655261731.mp3',
      );

      setStep('recording2');
      setRecordedAudioUri('');
    } else if (step === 'recording2') {
      if (!recording2Uri && recordedAudioUri) {
        setRecording2Uri(recordedAudioUri);
      }
      setDisplayText(
        'Boom! your personal news hub is ready. Just sit back, listen and let us bring you the stories you care about.',
      );
      setRecordedAudioUri('');
      sendTranscripts();
      // Optionally play outro audio here
      setStep('recording2Submitted');
    }
    setIsLoading(false);
  };

  const sendTranscripts = async () => {
    try {
      // Check if we have both recordings
      if (!recording1Uri) {
        console.error('Missing recording1 URI');
        throw new Error('First recording is missing');
      }
      if (!recording2Uri) {
        console.error('Missing recording2 URI');
        throw new Error('Second recording is missing');
      }
      const formData = new FormData();
      // Use .m4a and audio/m4a for both platforms
      formData.append('audio1', {
        uri: recording1Uri,
        type: 'audio/m4a',
        name: 'audio1.m4a',
      } as any);

      formData.append('audio2', {
        uri: recording2Uri,
        type: 'audio/m4a',
        name: 'audio2.m4a',
      } as any);

      formData.append('email', email);

      console.log('Sending form data with files:', {
        audio1: recording1Uri ? 'present' : 'missing',
        audio2: recording2Uri ? 'present' : 'missing',
        email,
      });

      const res: any = await apiService.post('/transcribe', formData);
      console.log('TalkWithAIScreen-result', res);
      if (res && res?.user) {
        await AsyncStorage.setItem('user', JSON.stringify(res.user));
      }

      await TrackPlayer.stop();
      await TrackPlayer.reset();

      console.log('Transcripts sent successfully:', res);
      navigation.navigate('Home' as never);
    } catch (err) {
      console.error('Error sending transcripts:', err);
      Alert.alert(
        'Error',
        'There was a problem sending your recordings. Please try again.',
        [{text: 'OK', onPress: () => resetRecording()}],
      );
    }
  };

  const getSubtitleText = () => {
    if (displayText.startsWith('Boom')) {
      return '';
    }
    switch (step) {
      case 'intro':
        return "Nice to meet you! Let's make your news feed all about YOU.";
      case 'recording1':
        return 'Tell us what topics excite you. Tap the mic to start recording.';
      case 'recording1Submitted':
        return "Great! Now, listen carefully to what's next.";
      case 'recording2':
        return 'Now, tell us about your work or share about your industry. Tap the mic to start recording.';
      default:
        return '';
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (step === 'recording2Submitted') {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();

      interval = setInterval(() => {
        Animated.parallel([
          Animated.timing(slideAnim, {
            toValue: 30,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setQuoteIndex(prev => (prev + 1) % finalizingQuotes.length);
          slideAnim.setValue(-30);
          Animated.parallel([
            Animated.timing(slideAnim, {
              toValue: 0,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
              toValue: 1,
              duration: 400,
              useNativeDriver: true,
            }),
          ]).start();
        });
      }, 2000);
    } else {
      setQuoteIndex(0);
      slideAnim.setValue(-30);
      opacityAnim.setValue(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [step]);

  useFocusEffect(
    React.useCallback(() => {
      // On focus: do nothing
      return () => {
        // On blur/unmount: reset onboarding state
        setStep('intro');
        setTranscript1(null);
        setTranscript2(null);
        setOnboardingIntro('');
        setDisplayText('');
        setIsRecording(false);
        setRecordedAudioUri('');
        setIsLoadingIntroAudio(false);
        setRecording1Uri(null);
        setRecording2Uri(null);
        // Stop any audio playback
        TrackPlayer.stop();
      };
    }, []),
  );

  return (
    <View style={styles.container}>
      <Text style={[styles.title, {fontFamily: fonts.ThabitBold.regular}]}>
        Hello {firstName}!
      </Text>
      <Text style={[styles.subtitle, {fontFamily: fonts.Thabit.regular}]}>
        {getSubtitleText()}
      </Text>

      <View style={styles.modelContainer}>
        {isAudioPlaying && <AudioPulse />}
        <Image
          source={require('../assets/hdmodel.png')}
          style={styles.modelImage}
          resizeMode="contain"
        />
      </View>

      {step !== 'recording2Submitted' && isAudioPlaying && displayText && (
        <View style={styles.textContainer}>
          <Text style={styles.displayText}>{displayText}</Text>
        </View>
      )}

      {(step === 'recording1' || step === 'recording2') && (
        <View style={styles.recordingContainer}>
          {!isAudioPlaying && !isRecording && recordedAudioUri === '' && (
            <View
              style={{
                width: MIC_SIZE,
                height: MIC_SIZE,
                position: 'relative',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <TouchableOpacity
                onPress={handleMicPress}
                style={styles.micButton}>
                <Image
                  source={require('../assets/mic.png')}
                  style={styles.micIcon}
                />
              </TouchableOpacity>
            </View>
          )}
          {!isAudioPlaying && !isRecording && recordedAudioUri === '' && (
            <Text style={styles.micText}>Tap the mic to start recording</Text>
          )}
          {isRecording && (
            <View
              style={{
                width: MIC_SIZE,
                height: MIC_SIZE,
                position: 'relative',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <MicPulse />
              <TouchableOpacity
                onPress={handleMicPress}
                style={styles.micButton}>
                <Image
                  source={require('../assets/mic.png')}
                  style={styles.micIcon}
                />
              </TouchableOpacity>
            </View>
          )}
          {isRecording && (
            <Text style={styles.micText}>Tap to stop recording</Text>
          )}
          {!isRecording && recordedAudioUri !== '' && (
            <View style={styles.recordingControls}>
              <View style={styles.recordingStatus}>
                <View style={styles.checkIcon} />
                <Text style={styles.statusText}>Response Recorded</Text>
              </View>
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  onPress={retakeRecording}
                  style={[styles.button, styles.retakeButton]}>
                  <Text style={styles.buttonText}>Retake</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={submitRecording}
                  disabled={isLoading}
                  style={[styles.button, styles.submitButton]}>
                  <Text style={styles.buttonText}>
                    {isLoading ? 'Submitting...' : 'Submit'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      {step === 'recording2Submitted' && (
        <Modal visible transparent animationType="fade">
          <View
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.85)',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
            <Animated.Text
              style={[
                styles.loadingText,
                {
                  opacity: opacityAnim,
                  transform: [{translateY: slideAnim}],
                  fontSize: 20,
                  color: '#fff',
                  textAlign: 'center',
                  paddingHorizontal: 24,
                },
              ]}>
              {finalizingQuotes[quoteIndex]}
            </Animated.Text>
          </View>
        </Modal>
      )}

      {isLoadingIntroAudio && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#947EFB" />
          <Text style={styles.loadingText}>Loading instructions...</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: 100,
    flex: 1,
    backgroundColor: '#000',
    padding: 16,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 32,
  },
  modelContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  modelImage: {
    width: 270,
    height: 270,
  },
  audioAnimation: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseCircle: {
    position: 'absolute',
    borderRadius: 9999,
    borderWidth: 2,
    borderColor: '#947EFB',
  },
  pulse1: {
    width: 80,
    height: 80,
    borderWidth: 3,
    opacity: 0.7,
  },
  pulse2: {
    width: 110,
    height: 110,
    borderWidth: 3,
    opacity: 0.4,
  },
  pulse3: {
    width: 140,
    height: 140,
    borderWidth: 2,
    opacity: 0.3,
  },
  pulseDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#947EFB',
  },
  textContainer: {
    width: '100%',
    maxWidth: 600,
    marginTop: 16,
  },
  displayText: {
    fontSize: 14,
    color: '#D1D5DB',
    textAlign: 'center',
  },
  recordingContainer: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#000',
    padding: 24,
    borderRadius: 8,
    marginBottom: 32,
    alignItems: 'center',
  },
  micButton: {
    alignItems: 'center',
  },
  micIcon: {
    width: 60,
    height: 60,
  },
  micText: {
    marginTop: 8,
    fontSize: 14,
    color: '#D1D5DB',
    textAlign: 'center',
  },
  recordingControls: {
    alignItems: 'center',
    gap: 16,
  },
  recordingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkIcon: {
    width: 16,
    height: 16,
    backgroundColor: '#166534',
    borderRadius: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#166534',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 24,
  },
  retakeButton: {
    backgroundColor: '#374151',
  },
  submitButton: {
    backgroundColor: '#4F46E5',
  },
  buttonText: {
    fontSize: 16,
    color: '#fff',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
  },
  loadingText: {
    fontSize: 14,
    color: '#fff',
  },
});

export default TalkWithAIScreen;
