import { Stack } from 'expo-router';
import { StatusBar } from 'react-native';

export default function RootLayout() {
  return (
    <>
      <StatusBar barStyle="dark-content" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F5F8F7' } }} />
    </>
  );
}
