import React, {useEffect, useState} from 'react';
import {View, ActivityIndicator} from 'react-native';
import {useRoute} from '@react-navigation/native';
import apiService from '../services/apiService';
import tw from './tailwind';
import SubscriptionModal from '../components/SubscriptionModal';

interface User {
  _id: string;
  name: string;
  email: string;
  newsPreferences: Record<string, string[]>;
  picture?: string;
  firstName: string;
  lastName: string;
  isVip: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SubscriptionResponse {
  success: boolean;
  result: {
    user: User;
    trialDaysLeft: number;
    subscriptionStatus: 'trial' | 'active' | 'expired';
    isSubscriptionExpired: boolean;
  };
}

interface WithSubscriptionCheckProps {
  subscriptionData?: {
    trialDaysLeft?: number;
  };
}

const withSubscriptionCheck = <P extends object>(
  WrappedComponent: React.ComponentType<P & WithSubscriptionCheckProps>,
) => {
  return function WithSubscriptionCheck(props: P) {
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(true);
    const route = useRoute();
    const [subscriptionData, setSubscriptionData] = useState<any>(null);

    useEffect(() => {
      checkSubscription();
    }, []);

    const checkSubscription = async () => {
      try {
        const response = await apiService.get<SubscriptionResponse>(
          '/user/details',
        );
        if (response.success) {
          setSubscriptionData(response.result);
        }
      } catch (error) {
        console.error('Error checking subscription:', error);
      } finally {
        setLoading(false);
      }
    };

    if (loading) {
      return (
        <View style={tw`flex-1 items-center justify-center bg-[#07050E]`}>
          <ActivityIndicator size="large" color="#4C4AE3" />
        </View>
      );
    }

    // If subscription is expired and not on profile page, render the wrapped component with the modal
    if (
      subscriptionData?.isSubscriptionExpired &&
      showModal &&
      route.name !== 'Profile'
    ) {
      return (
        <View style={tw`flex-1`}>
          <WrappedComponent {...props} subscriptionData={subscriptionData} />
          <SubscriptionModal
            visible={showModal}
            onClose={() => setShowModal(false)}
          />
        </View>
      );
    }

    // If subscription is valid or on profile page, render the wrapped component
    return (
      <WrappedComponent
        {...props}
        subscriptionData={subscriptionData || undefined}
      />
    );
  };
};

export default withSubscriptionCheck;
