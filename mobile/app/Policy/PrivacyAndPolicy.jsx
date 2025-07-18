import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AntDesign } from '@expo/vector-icons';

const PrivacyAndPolicy = () => {
  const navigation = useNavigation();

  const openExternalLink = (url) => {
    Linking.openURL(url).catch(err => console.error("Failed to open URL:", err));
  };

  return (
    <View className="flex-1 bg-white">
      {/* Header with back button */}
      <View className="bg-fire py-4 px-6 flex-row items-center">
        <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
          <AntDesign name="arrowleft" size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-bold flex-1">Privacy Policy</Text>
      </View>

      {/* Content */}
      <ScrollView className="flex-1 px-6 py-4" showsVerticalScrollIndicator={false}>
        <Text className="text-lg font-bold mb-4 text-gray-800">Last Updated: June 2023</Text>
        
        <Text className="text-base mb-6 text-gray-700">
          At Fire Response, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, 
          and safeguard your information when you use our emergency response application.
        </Text>

        <PrivacySection title="1. Information We Collect">
          We may collect personal information such as:
          <BulletPoint text="Contact information (email, phone number)" />
          <BulletPoint text="Location data for emergency services" />
          <BulletPoint text="Device information (model, OS version)" />
          <BulletPoint text="Usage data and analytics" />
        </PrivacySection>

        <PrivacySection title="2. How We Use Your Information">
          Your information helps us to:
          <BulletPoint text="Provide emergency response services" />
          <BulletPoint text="Improve app functionality and user experience" />
          <BulletPoint text="Send critical safety alerts and updates" />
          <BulletPoint text="Respond to your inquiries and support requests" />
        </PrivacySection>

        <PrivacySection title="3. Data Sharing & Disclosure">
          We may share information with:
          <BulletPoint text="Emergency services when you report an incident" />
          <BulletPoint text="Trusted service providers who assist our operations" />
          <BulletPoint text="Legal authorities when required by law" />
          We never sell your personal data to third parties.
        </PrivacySection>

        <PrivacySection title="4. Data Security">
          We implement:
          <BulletPoint text="Industry-standard encryption protocols" />
          <BulletPoint text="Regular security audits" />
          <BulletPoint text="Access controls to protect your information" />
          However, no electronic transmission is completely secure.
        </PrivacySection>

        <PrivacySection title="5. Your Rights">
          You have the right to:
          <BulletPoint text="Access and request a copy of your data" />
          <BulletPoint text="Correct inaccurate information" />
          <BulletPoint text="Request deletion of your data" />
          <BulletPoint text="Opt-out of non-essential communications" />
        </PrivacySection>

        <PrivacySection title="6. Children's Privacy">
          Our app is not intended for children under 13. We do not knowingly collect information from children without parental consent.
        </PrivacySection>

        <PrivacySection title="7. Changes to This Policy">
          We may update this policy periodically. We'll notify you of significant changes through the app or via email.
        </PrivacySection>

        <View className="mt-6 mb-8 bg-gray-50 p-4 rounded-lg">
          <Text className="text-base font-semibold mb-2 text-gray-800">Contact Us</Text>
          <Text className="text-gray-700 mb-1">
            For privacy-related questions, contact our Data Protection Officer at:
          </Text>
          <TouchableOpacity onPress={() => openExternalLink('mailto:privacy@fireresponse.com')}>
            <Text className="text-fire underline">privacy@fireresponse.com</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

// Reusable components
const PrivacySection = ({ title, children }) => (
  <View className="mb-6">
    <Text className="text-lg font-bold mb-2 text-gray-800">{title}</Text>
    <Text className="text-base text-gray-700">{children}</Text>
  </View>
);

const BulletPoint = ({ text }) => (
  <View className="flex-row items-start ml-4 mt-1">
    <Text className="text-gray-700">• </Text>
    <Text className="text-base text-gray-700 flex-1">{text}</Text>
  </View>
);

export default PrivacyAndPolicy;