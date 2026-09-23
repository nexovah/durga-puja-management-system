import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../lib/auth';
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
import { VendorListScreen } from '../screens/VendorListScreen';
import { VendorDetailScreen } from '../screens/VendorDetailScreen';
import { LoanListScreen } from '../screens/LoanListScreen';
import { LoanFormScreen } from '../screens/LoanFormScreen';
import { TaskListScreen } from '../screens/TaskListScreen';
import { TaskFormScreen } from '../screens/TaskFormScreen';
import { EstimationListScreen } from '../screens/EstimationListScreen';
import { EstimationFormScreen } from '../screens/EstimationFormScreen';
import { MenuScreen } from '../screens/MenuScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { ReportsScreen } from '../screens/ReportsScreen';
import { ReportDetailScreen } from '../screens/ReportDetailScreen';

const Stack = createNativeStackNavigator();

export function RootNavigator() {
  const { user, loading } = useAuth();

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {loading ? (
          <Stack.Screen name="Splash" component={SplashScreen} />
        ) : !user ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
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
            <Stack.Screen name="VendorList" component={VendorListScreen} />
            <Stack.Screen name="VendorDetail" component={VendorDetailScreen} />
            <Stack.Screen name="LoanList" component={LoanListScreen} />
            <Stack.Screen name="LoanForm" component={LoanFormScreen} />
            <Stack.Screen name="TaskList" component={TaskListScreen} />
            <Stack.Screen name="TaskForm" component={TaskFormScreen} />
            <Stack.Screen name="EstimationList" component={EstimationListScreen} />
            <Stack.Screen name="EstimationForm" component={EstimationFormScreen} />
            <Stack.Screen name="Menu" component={MenuScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="Reports" component={ReportsScreen} />
            <Stack.Screen name="ReportDetail" component={ReportDetailScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
