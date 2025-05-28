import {Platform} from 'react-native';

export const fonts = {
  Thabit: {
    regular: Platform.select({
      ios: 'Thabit',
      android: 'Thabit',
    }),
  },
  ThabitBold: {
    regular: Platform.select({
      ios: 'Thabit-Bold',
      android: 'ThabitBold',
    }),
  },

  Winong: {
    regular: Platform.select({
      ios: 'winongextendeddemo',
      android: 'winongextendeddemo',
    }),
  },
  Inter: {
    regular: Platform.select({
      ios: 'Inter-Regular',
      android: 'Inter-Regular',
    }),
    medium: Platform.select({
      ios: 'Inter-Medium',
      android: 'Inter-Medium',
    }),
    semiBold: Platform.select({
      ios: 'Inter-SemiBold',
      android: 'Inter-SemiBold',
    }),
    bold: Platform.select({
      ios: 'Inter-Bold',
      android: 'Inter-Bold',
    }),
  },
};
