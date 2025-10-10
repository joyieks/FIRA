import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const TermsAndConditions = () => {
  const navigation = useNavigation();

  const handleAccept = () => {
    // In a real app, you might store acceptance in state/backend
    navigation.goBack(); // Or navigate to where the user came from
  };

  const openExternalLink = (url) => {
    Linking.openURL(url).catch(err => console.error("Failed to open URL:", err));
  };

  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="bg-fire py-4 px-6">
        <Text className="text-white text-xl font-bold">Terms & Conditions</Text>
      </View>

      {/* Content */}
      <ScrollView className="flex-1 px-6 py-4">
        <Text className="text-lg font-bold mb-4">Last Updated: June 2023</Text>
        
        <Text className="text-base mb-6">
          Welcome to Fire Response! These Terms and Conditions outline the rules and regulations for the use of our application.
        </Text>

        <Section title="1. Acceptance of Terms">
          By accessing or using our app, you agree to be bound by these Terms. If you disagree, please do not use our app.
        </Section>

        <Section title="2. User Responsibilities">
          You agree to use the app only for lawful purposes and in ways that don't infringe the rights of others.
        </Section>

        <Section title="3. Emergency Services">
          While our app provides fire response information, it does not replace professional emergency services. Always call local emergency numbers in critical situations.
        </Section>

        <Section title="4. Data Privacy">
          We collect and process personal data as described in our <Text 
            className="text-fire underline" 
            onPress={() => openExternalLink('https://example.com/privacy')}
          >
            Privacy Policy
          </Text>.
        </Section>

        <Section title="5. Intellectual Property">
          All content and features in the app are owned by Fire Response or its licensors and are protected by copyright laws.
        </Section>

        <Section title="6. Limitation of Liability">
          Fire Response shall not be liable for any indirect, incidental, or consequential damages resulting from app use.
        </Section>

        <Section title="7. Changes to Terms">
          We may modify these Terms at any time. Continued use after changes constitutes acceptance of the new Terms.
        </Section>

        <Text className="text-base mt-6 mb-8">
          If you have any questions about these Terms, please contact us at{' '}
          <Text 
            className="text-fire underline" 
            onPress={() => openExternalLink('mailto:legal@fireresponse.com')}
          >
            legal@fireresponse.com
          </Text>.
        </Text>
      </ScrollView>

      {/* Footer */}
      <View className="border-t border-gray-200 p-4">
        <TouchableOpacity 
          className="bg-fire py-3 rounded-lg items-center"
          onPress={handleAccept}
        >
          <Text className="text-white font-bold text-lg">I Accept</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Reusable section component
const Section = ({ title, children }) => (
  <View className="mb-6">
    <Text className="text-lg font-bold mb-2">{title}</Text>
    <Text className="text-base">{children}</Text>
  </View>
);

export default TermsAndConditions;