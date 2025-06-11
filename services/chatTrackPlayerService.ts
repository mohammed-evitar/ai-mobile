import TrackPlayer from 'react-native-track-player';

let isInitialized = false;

export const setupChatPlayer = async () => {
  try {
    if (!isInitialized) {
      // Only setup if not already initialized
      await TrackPlayer.setupPlayer({
        autoHandleInterruptions: false,
        waitForBuffer: true,
      });
      isInitialized = true;
      console.log('✅ Chat TrackPlayer setup completed');
    }
    return true;
  } catch (error: any) {
    // If we get an error about already being initialized, that's fine
    if (error?.message?.includes('already been initialized')) {
      isInitialized = true;
      return true;
    }
    console.error('Error setting up chat player:', error);
    return false;
  }
};

export const buildChatQueue = (audioUrl: string) => {
  return [
    {
      id: 'chat-audio',
      url: audioUrl,
      title: 'AI Response',
      artist: 'AI Assistant',
    },
  ];
};

export const playChatAudio = async (audioUrl: string) => {
  try {
    // Stop any existing playback first
    await TrackPlayer.stop();
    await TrackPlayer.reset();

    const queue = buildChatQueue(audioUrl);
    await TrackPlayer.add(queue);
    await TrackPlayer.play();
  } catch (error) {
    console.error('Error playing chat audio:', error);
    throw error;
  }
};

export const stopChatAudio = async () => {
  try {
    await TrackPlayer.stop();
    await TrackPlayer.reset();
  } catch (error) {
    console.error('Error stopping chat audio:', error);
  }
};

export const cleanupChatPlayer = async () => {
  try {
    await TrackPlayer.stop();
    await TrackPlayer.reset();
    isInitialized = false;
    console.log('🛑 Chat TrackPlayer cleaned up');
  } catch (error) {
    console.error('Error cleaning up chat player:', error);
  }
};
