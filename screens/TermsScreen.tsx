import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  Switch,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import LinearGradient from 'react-native-linear-gradient';
import tw from '../utils/tailwind';
import {fonts} from '../utils/fonts';

interface TermsScreenProps {
  visible: boolean;
  onClose: () => void;
  onAccept: () => void;
  hideAgreement?: boolean;
}

const TermsScreen: React.FC<TermsScreenProps> = ({
  visible,
  onClose,
  onAccept,
  hideAgreement = false,
}) => {
  const [isChecked, setIsChecked] = useState(false);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}>
      <View style={tw`flex-1 bg-black/50`}>
        <View
          style={[
            tw`flex-1 mt-20 bg-[#07050E] rounded-t-3xl`,
            {maxHeight: Dimensions.get('window').height * 0.9},
          ]}>
          <LinearGradient
            colors={['#07050E', '#17171D']}
            style={tw`flex-1 rounded-t-3xl`}>
            {/* Header */}
            <View style={tw`flex-row items-center gap-6 px-5 py-4`}>
              <TouchableOpacity
                onPress={onClose}
                style={tw`bg-[#FFFFFF1C] rounded-lg p-2`}>
                <Icon name="arrow-left" size={24} color="#fff" />
              </TouchableOpacity>
              <Text
                style={[
                  tw`text-white text-2xl tracking-wider`,
                  {fontFamily: fonts.ThabitBold.regular},
                ]}>
                Terms of Service
              </Text>
            </View>

            <ScrollView
              style={tw`flex-1 px-5`}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={tw`pb-8`}>
              <View style={tw`space-y-6`}>
                <View>
                  <Text
                    style={[
                      tw`text-xl font-semibold text-white mb-2`,
                      {fontFamily: fonts.ThabitBold.regular},
                    ]}>
                    Voxmax Terms of Service
                  </Text>
                  <Text
                    style={[
                      tw`text-[#FFFFFF80] text-sm`,
                      {fontFamily: fonts.Thabit.regular},
                    ]}>
                    Last updated: {new Date().toLocaleDateString()}
                  </Text>
                </View>

                <View style={tw`space-y-4`}>
                  <Text
                    style={[
                      tw`text-sm text-[#FFFFFFCC]`,
                      {fontFamily: fonts.Thabit.regular},
                    ]}>
                    Welcome to Voxmax. By purchasing and using our premium
                    content subscription, you agree to the following terms:
                  </Text>

                  <View style={tw`space-y-3`}>
                    <Text
                      style={[
                        tw`font-semibold text-white`,
                        {fontFamily: fonts.ThabitBold.regular},
                      ]}>
                      1. Subscription Service
                    </Text>
                    <Text
                      style={[
                        tw`text-sm text-[#FFFFFFCC]`,
                        {fontFamily: fonts.Thabit.regular},
                      ]}>
                      You receive access to Voxmax premium news content for the
                      duration of one calendar month (28-31 days, depending on
                      the month). This is a one-time purchase; it will not renew
                      automatically. Your access will expire at the end of the
                      calendar month unless you purchase again. There are no
                      additional charges or subscriptions beyond this single
                      payment.
                    </Text>

                    <Text
                      style={[
                        tw`font-semibold text-white`,
                        {fontFamily: fonts.ThabitBold.regular},
                      ]}>
                      2. Payment
                    </Text>
                    <Text
                      style={[
                        tw`text-sm text-[#FFFFFFCC]`,
                        {fontFamily: fonts.Thabit.regular},
                      ]}>
                      Payment is processed by our payment provider. When you
                      purchase, you authorize Voxmax to charge the full
                      subscription fee at checkout. The charge will appear on
                      your bank statement under a descriptor we set. All fees
                      are charged at time of purchase, and you will not be
                      billed again unless you buy another subscription.
                    </Text>

                    <Text
                      style={[
                        tw`font-semibold text-white`,
                        {fontFamily: fonts.ThabitBold.regular},
                      ]}>
                      3. No Refunds
                    </Text>
                    <Text
                      style={[
                        tw`text-sm text-[#FFFFFFCC]`,
                        {fontFamily: fonts.Thabit.regular},
                      ]}>
                      Because digital content access is provided immediately,
                      all sales are final. No refunds or exchanges will be given
                      once a purchase is complete. By buying the subscription,
                      you acknowledge and accept this no-refund policy.
                    </Text>

                    <Text
                      style={[
                        tw`font-semibold text-white`,
                        {fontFamily: fonts.ThabitBold.regular},
                      ]}>
                      4. Access and Use
                    </Text>
                    <Text
                      style={[
                        tw`text-sm text-[#FFFFFFCC]`,
                        {fontFamily: fonts.Thabit.regular},
                      ]}>
                      During your active period, you may view and use Voxmax
                      content on your personal devices. Your access is for
                      personal, non-commercial use only. You may not
                      redistribute, copy, or sell the content.
                    </Text>

                    <Text
                      style={[
                        tw`font-semibold text-white`,
                        {fontFamily: fonts.ThabitBold.regular},
                      ]}>
                      5. Account Responsibility
                    </Text>
                    <Text
                      style={[
                        tw`text-sm text-[#FFFFFFCC]`,
                        {fontFamily: fonts.Thabit.regular},
                      ]}>
                      You are responsible for your account and any activity
                      under it. Keep your login credentials secure. If your
                      payment fails or card expires, your access may end
                      immediately at 30 days.
                    </Text>

                    <Text
                      style={[
                        tw`font-semibold text-white`,
                        {fontFamily: fonts.ThabitBold.regular},
                      ]}>
                      6. Changes to Service
                    </Text>
                    <Text
                      style={[
                        tw`text-sm text-[#FFFFFFCC]`,
                        {fontFamily: fonts.Thabit.regular},
                      ]}>
                      We may update or change content at any time. We can also
                      modify or discontinue the service, though we will strive
                      to notify users of major changes.
                    </Text>

                    <Text
                      style={[
                        tw`font-semibold text-white`,
                        {fontFamily: fonts.ThabitBold.regular},
                      ]}>
                      7. Disputes and Chargebacks
                    </Text>
                    <Text
                      style={[
                        tw`text-sm text-[#FFFFFFCC]`,
                        {fontFamily: fonts.Thabit.regular},
                      ]}>
                      We encourage you to contact our support before disputing a
                      charge. If you believe a charge is unauthorized or
                      incorrect, please email us.
                    </Text>

                    <Text
                      style={[
                        tw`font-semibold text-white`,
                        {fontFamily: fonts.ThabitBold.regular},
                      ]}>
                      8. Liability
                    </Text>
                    <Text
                      style={[
                        tw`text-sm text-[#FFFFFFCC]`,
                        {fontFamily: fonts.Thabit.regular},
                      ]}>
                      Voxmax provides content "as is." We make no warranties
                      about the content's accuracy or availability. We are not
                      liable for damages related to your use of the service.
                    </Text>

                    <Text
                      style={[
                        tw`font-semibold text-white`,
                        {fontFamily: fonts.ThabitBold.regular},
                      ]}>
                      9. Governing Law
                    </Text>
                    <Text
                      style={[
                        tw`text-sm text-[#FFFFFFCC]`,
                        {fontFamily: fonts.Thabit.regular},
                      ]}>
                      This agreement is governed by U.S. federal law and the
                      laws of California, without regard to conflict of laws
                      rules.
                    </Text>
                  </View>
                </View>

                {!hideAgreement && (
                  <View style={tw`space-y-4 pt-4`}>
                    <View style={tw`flex-row items-start gap-3`}>
                      <Switch
                        value={isChecked}
                        onValueChange={setIsChecked}
                        trackColor={{false: '#FFFFFF1A', true: '#4C4AE3'}}
                        thumbColor={isChecked ? '#8887EE' : '#FFFFFF80'}
                      />
                      <Text
                        style={[
                          tw`text-sm text-[#FFFFFFCC] flex-1`,
                          {fontFamily: fonts.Thabit.regular},
                        ]}>
                        I have read and agree to the Voxmax Terms of Service. I
                        understand that this is a one-time purchase and no
                        refunds will be provided.
                      </Text>
                    </View>

                    <View style={tw`flex-row justify-center gap-4`}>
                      <TouchableOpacity
                        onPress={onClose}
                        style={tw`px-6 py-2 rounded-xl bg-[#FFFFFF1A]`}>
                        <Text
                          style={[
                            tw`text-white`,
                            {fontFamily: fonts.Thabit.regular},
                          ]}>
                          Decline
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          if (isChecked) {
                            onAccept();
                          }
                        }}
                        style={tw`px-6 py-2 rounded-xl ${
                          isChecked
                            ? 'bg-gradient-to-b from-[#4C4AE3] to-[#8887EE]'
                            : 'bg-[#FFFFFF1A]'
                        }`}>
                        <Text
                          style={[
                            tw`${
                              isChecked ? 'text-white' : 'text-[#FFFFFF80]'
                            }`,
                            {fontFamily: fonts.Thabit.regular},
                          ]}>
                          Accept Terms
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            </ScrollView>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
};

export default TermsScreen;
