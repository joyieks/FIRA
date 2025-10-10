import React, { useEffect } from "react";
import { View, Image } from "react-native";
import { useRouter } from "expo-router";

export const options = {
  headerShown: false,
};

const LOGO_SIZE = 300;

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    const navTimer = setTimeout(() => {
      router.replace("/get-started/getstarted");
    }, 5000);

    return () => {
      clearTimeout(navTimer);
    };
  }, [router]);

  return (
    <View className="flex-1 bg-black justify-center items-center">
      <Image
        source={require("../assets/gif/logogif.gif")}
        style={{ width: LOGO_SIZE, height: LOGO_SIZE }}
        resizeMode="contain"
      />
    </View>
  );
}