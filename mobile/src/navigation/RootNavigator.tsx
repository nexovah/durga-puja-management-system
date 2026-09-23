import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SplashScreen } from '../screens/SplashScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { ChandaListScreen } from '../screens/ChandaListScreen';
import { ChandaFormScreen } from '../screens/ChandaFormScreen';
import { MembersListScreen } from '../screens/MembersListScreen';
import { MemberFormScreen } from '../screens/MemberFormScreen';
import { DonationAdListScreen } from '../screens/DonationAdListScreen';
import { DonationAdFormScreen } from '../screens/DonationAdFormScreen';
import { ExpensesListScreen } from '../screens/ExpensesListScreen';
import { ExpenseFormScreen } from '../screens/ExpenseFormScreen';

const Stack = createNativeStackNavigator();

// One shared stack — every screen above is a plain cross-platform RN
// component (View/Text/TextInput/FlatList/ScrollView), so the native
// stack's default push/slide transition looks and behaves the same on
// iOS and Android without any platform branching.
export function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />

        <Stack.Screen name="ChandaList" component={ChandaListScreen} />
        <Stack.Screen name="ChandaForm" component={ChandaFormScreen} />

        <Stack.Screen name="MembersList" component={MembersListScreen} />
        <Stack.Screen name="MemberForm" component={MemberFormScreen} />

        <Stack.Screen name="DonationList" component={DonationAdListScreen} initialParams={{ category: 'donation' }} />
        <Stack.Screen name="AdsList" component={DonationAdListScreen} initialParams={{ category: 'ads' }} />
        <Stack.Screen name="DonationAdForm" component={DonationAdFormScreen} />

        <Stack.Screen name="ExpensesList" component={ExpensesListScreen} />
        <Stack.Screen name="ExpenseForm" component={ExpenseFormScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
