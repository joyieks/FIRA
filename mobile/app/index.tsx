import React, { useEffect, useRef, useState } from "react";
import { Animated, View, Image } from "react-native";
import { useRouter } from "expo-router";

export const options = {
  headerShown: false,
};

const LOGO_SIZE = 140;

export default function Index() {
  const router = useRouter();
  const [showText, setShowText] = useState(false);
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslate = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    const logoTimer = setTimeout(() => {
      setShowText(true);
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(textTranslate, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start();
    }, 3000);

    const navTimer = setTimeout(() => {
      router.replace("/get-started/getstarted");
    }, 8000);

    return () => {
      clearTimeout(logoTimer);
      clearTimeout(navTimer);
    };
  }, [textOpacity, textTranslate, router]);

  return (
    <View className="flex-1 bg-black justify-center items-center">
      <View className="flex-row items-center justify-center">
        <Image
          source={require("../assets/images/logoonly2.png")}
          style={{ width: LOGO_SIZE, height: LOGO_SIZE }}
          className="mr-2"
          resizeMode="contain"
        />
        {showText && (
          <Animated.View
            className="justify-center items-start"
            style={{
              opacity: textOpacity,
              transform: [{ translateY: textTranslate }],
            }}
          >
            <Animated.Text className="text-white text-[36px] font-bold leading-10 text-left">
              PROJECT
            </Animated.Text>
            <Animated.Text className="text-white text-[36px] font-bold leading-10 text-left">
              FIRA
            </Animated.Text>
          </Animated.View>
        )}
      </View>
    </View>
  );
}