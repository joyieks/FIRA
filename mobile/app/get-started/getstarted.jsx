import React, { useRef, useState } from "react";
import { View, Text, TouchableOpacity, Image, Dimensions, ScrollView } from "react-native";
import { useRouter } from "expo-router";

export const options = {
  headerShown: false,
};

const { width } = Dimensions.get('window');

const slides = [
  {
    title: "Instant Fire Hazard Reporting",
    description: "Capture and submit photos of fire incidents.",
    icon: require('../../assets/images/getstart1.png')
  },
  {
    title: "Real-time Mapping & Alerts",
    description: "Validated hazards show up on a live map, and push notifications alert residents and LGUs.",
    icon: require('../../assets/images/getstart2.png')
  },
  {
    title: "Community Engagement",
    description: "Collaborate with neighbors and authorities for a safer environment.",
    icon: require('../../assets/images/getstart3.png')
  }
];

const GetStarted = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const router = useRouter();
  const scrollRef = useRef();

  const onScrollEnd = (e) => {
    const contentOffsetX = e.nativeEvent.contentOffset.x;
    const newIndex = Math.round(contentOffsetX / width);
    setCurrentIndex(newIndex);
  };

  const scrollTo = (index) => {
    scrollRef.current?.scrollTo({ x: index * width, animated: true });
    setCurrentIndex(index);
  };

  return (
    <View className="flex-1 bg-white">
      {/* Scrollable Slides */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        className="flex-1"
      >
        {slides.map((slide, index) => (
          <View key={index} className="flex-1 items-center justify-center px-8" style={{ width }}>
            <Image source={slide.icon} className="w-full h-72 mb-8" resizeMode="contain" />
            <Text className="text-2xl font-bold text-gray-800 text-center mb-4">
              {slide.title}
            </Text>
            <Text className="text-lg text-gray-600 text-center px-4">
              {slide.description}
            </Text>
          </View>
        ))}
      </ScrollView>

      {/* Pagination Indicators */}
      <View className="flex-row justify-center mb-8">
        {slides.map((_, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => scrollTo(index)}
            className={`w-2 h-2 rounded-full mx-1 ${currentIndex === index ? 'bg-fire' : 'bg-gray-300'}`}
          />
        ))}
      </View>

      {/* Buttons Section - show on all slides */}
      <View className="px-6 pb-10">
        <TouchableOpacity
          className="bg-fire py-4 rounded-xl items-center mb-4 shadow-lg shadow-fire/20"
          onPress={() => router.push("/Authentication/registration")}
        >
          <Text className="text-white font-bold text-lg">Register</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="border border-fire py-4 rounded-xl items-center hover:bg-fire hover:text-white"
          onPress={() => router.push("/Authentication/login")}
        >
          <Text className="text-fire font-semibold hover:text-white">Log In</Text>
        </TouchableOpacity>
      </View>

      {/* Skip Button (shown on all slides except last) */}
      {currentIndex !== slides.length - 1 && (
        <TouchableOpacity
          className="absolute top-10 right-6 px-4 py-2"
          onPress={() => scrollTo(slides.length - 1)}
        >
          <Text className="text-fire font-semibold">Skip</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

export default GetStarted;