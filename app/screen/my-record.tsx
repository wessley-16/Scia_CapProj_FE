import BackBar from "@/components/BackBar";
import SeniorRecordCard from "@/components/SeniorRecordCard";
import DigitalIDCard from "@/components/DigitalIDCard";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { useSeniorRecord } from "@/hooks/useSeniorRecord";
import React from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// "My Record": registry status + record QR, then the Digital ID once OSCA has verified the senior.
export default function MyRecordScreen() {
  const { colors: c } = useSettings();
  const { user } = useAuth();
  const { record } = useSeniorRecord();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={["top", "bottom"]}>
      <BackBar />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <SeniorRecordCard />
        {user && record?.status === "active" && (
          <View>
            <DigitalIDCard />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
