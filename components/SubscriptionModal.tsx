import React, {useEffect, useRef} from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import LinearGradient from 'react-native-linear-gradient';
import tw from '../utils/tailwind';

interface SubscriptionModalProps {
  visible: boolean;
  onClose: () => void;
}

const features = [
  {
    icon: '✨',
    title: 'Personalized News',
    description: 'Get news tailored to your interests and preferences',
  },
  {
    icon: '🎯',
    title: 'Trending Topics',
    description: 'Stay updated with the most relevant trending topics',
  },
  {
    icon: '🤖',
    title: 'AI-Powered Insights',
    description: 'Access advanced AI features for deeper news analysis',
  },
  {
    icon: '🎧',
    title: 'Audio Experience',
    description: 'Listen to news articles with premium audio features',
  },
];

const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  visible,
  onClose,
}) => {
  // Animation values
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(20)).current;
  const crownScaleAnim = useRef(new Animated.Value(0)).current;
  const featuresOpacityAnim = useRef(new Animated.Value(0)).current;
  const featuresTranslateXAnim = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    if (visible) {
      // Reset animations
      scaleAnim.setValue(0.9);
      opacityAnim.setValue(0);
      translateYAnim.setValue(20);
      crownScaleAnim.setValue(0);
      featuresOpacityAnim.setValue(0);
      featuresTranslateXAnim.setValue(-20);

      // Start animations
      Animated.parallel([
        // Modal animation
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          damping: 20,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(translateYAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 20,
        }),
        // Crown animation
        Animated.spring(crownScaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          damping: 20,
          delay: 200,
        }),
        // Features animation
        Animated.timing(featuresOpacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
          delay: 400,
        }),
        Animated.spring(featuresTranslateXAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 20,
          delay: 400,
        }),
      ]).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}>
      <TouchableOpacity
        style={tw`flex-1 bg-black/50 justify-center items-center p-4`}
        activeOpacity={1}
        onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={e => e.stopPropagation()}>
          <Animated.View
            style={[
              tw`bg-[#07050E]/95 rounded-3xl p-4 w-full max-w-[90%] border border-[#FFFFFF1A]`,
              {maxHeight: Dimensions.get('window').height * 0.9},
              {
                transform: [{scale: scaleAnim}, {translateY: translateYAnim}],
                opacity: opacityAnim,
              },
            ]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={tw`flex-col items-center gap-3`}>
                {/* Crown Icon */}
                <Animated.View
                  style={[
                    tw`w-16 h-16 items-center justify-center`,
                    {
                      transform: [{scale: crownScaleAnim}],
                    },
                  ]}>
                  <LinearGradient
                    colors={['#4C4AE3', '#8887EE']}
                    style={tw`absolute w-full h-full rounded-full border-2 border-[#FFFFFF1A]`}></LinearGradient>
                  <Icon name="crown" size={32} color="#fff" />
                </Animated.View>

                {/* Title and Description */}
                <View style={tw`items-center`}>
                  <Text style={[tw`text-white text-xl font-semibold mb-1`]}>
                    Subscription Required
                  </Text>
                  <Text style={tw`text-[#FFFFFF80] text-sm mb-2 text-center`}>
                    Upgrade to premium to unlock all premium features.
                  </Text>
                  <View
                    style={tw`flex-row items-center gap-2 px-3 py-1.5 rounded-xl bg-[#FFFFFF0A] border border-[#FFFFFF1A]`}>
                    <Text style={[tw`text-[#4C4AE3] font-bold text-xl`]}>
                      $10
                    </Text>
                    <Text style={tw`text-[#FFFFFF80] text-xs -ml-1.5`}>
                      /month
                    </Text>
                  </View>
                </View>

                {/* Features Grid */}
                <Animated.View
                  style={[
                    tw`w-full mt-2`,
                    {
                      opacity: featuresOpacityAnim,
                      transform: [{translateX: featuresTranslateXAnim}],
                    },
                  ]}>
                  {features.map((feature, index) => (
                    <View
                      key={index}
                      style={tw`bg-[#FFFFFF0A] rounded-xl p-3 flex-row items-start gap-2 border border-[#FFFFFF1A] mb-3`}>
                      <Text style={tw`text-[#4C4AE3] text-lg mt-0.5`}>
                        {feature.icon}
                      </Text>
                      <View style={tw`flex-1`}>
                        <Text
                          style={[tw`text-white font-medium text-sm mb-0.5`]}>
                          {feature.title}
                        </Text>
                        <Text
                          style={tw`text-[#FFFFFF80] text-xs leading-tight`}>
                          {feature.description}
                        </Text>
                      </View>
                    </View>
                  ))}
                </Animated.View>

                {/* Buttons */}
                <View style={tw`w-full mt-4 gap-3`}>
                  <TouchableOpacity
                    style={tw`w-full`}
                    onPress={() => {
                      // Handle upgrade
                    }}>
                    <LinearGradient
                      colors={['#4C4AE3', '#8887EE']}
                      style={tw`rounded-xl  items-center border border-[#FFFFFF1A]`}>
                      <Text
                        style={[tw`text-white font-medium text-sm py-3 px-5`]}>
                        Upgrade Now
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>

                  <TouchableOpacity style={tw`w-full`} onPress={onClose}>
                    <View style={tw`rounded-xl py-3 px-5 items-center`}>
                      <Text style={[tw`text-[#FFFFFF80] font-medium text-sm`]}>
                        Maybe Later
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </Animated.View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

export default SubscriptionModal;
