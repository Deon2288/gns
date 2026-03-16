import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { Text } from 'react-native';

import DeviceListScreen from './screens/DeviceListScreen';
import MapScreen from './screens/MapScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

/**
 * DevicesStack wraps DeviceList and Map screens in a native stack navigator.
 */
function DevicesStack() {
    return (
        <Stack.Navigator
            screenOptions={{
                headerStyle: { backgroundColor: '#111827' },
                headerTintColor: '#f9fafb',
                headerTitleStyle: { fontWeight: 'bold' },
            }}
        >
            <Stack.Screen name="DeviceList" component={DeviceListScreen} options={{ title: 'Devices' }} />
            <Stack.Screen name="Map" component={MapScreen} options={{ title: 'Live Map' }} />
        </Stack.Navigator>
    );
}

/**
 * App is the root component of the GNS mobile application.
 */
export default function App() {
    return (
        <NavigationContainer>
            <StatusBar style="light" />
            <Tab.Navigator
                screenOptions={{
                    headerShown: false,
                    tabBarStyle: { backgroundColor: '#111827', borderTopColor: '#1f2937' },
                    tabBarActiveTintColor: '#3b82f6',
                    tabBarInactiveTintColor: '#6b7280',
                }}
            >
                <Tab.Screen
                    name="Devices"
                    component={DevicesStack}
                    options={{
                        tabBarLabel: 'Devices',
                        tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>📱</Text>,
                    }}
                />
                <Tab.Screen
                    name="LiveMap"
                    component={MapScreen}
                    options={{
                        tabBarLabel: 'Live Map',
                        tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>🗺️</Text>,
                        headerShown: true,
                        headerStyle: { backgroundColor: '#111827' },
                        headerTintColor: '#f9fafb',
                        title: 'Live Map',
                    }}
                />
            </Tab.Navigator>
        </NavigationContainer>
    );
}
