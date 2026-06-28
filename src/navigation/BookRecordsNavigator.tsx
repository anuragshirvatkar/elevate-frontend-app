import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { BookRecordsStackParamList } from './types';
import BookRecordsScreen from '../screens/drawer/BookRecordsScreen';
import BookRecordDetailScreen from '../screens/drawer/BookRecordDetailScreen';

const Stack = createNativeStackNavigator<BookRecordsStackParamList>();

const BookRecordsNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="BookRecordsList" component={BookRecordsScreen} />
    <Stack.Screen name="BookRecordDetail" component={BookRecordDetailScreen} />
  </Stack.Navigator>
);

export default BookRecordsNavigator;
