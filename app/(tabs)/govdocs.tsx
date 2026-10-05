import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSettings } from "@/context/SettingsContext";

const openLink = (url: string, t: (key: string) => string) => {
  Alert.alert(
    t("govOpenTitle"),
    t("govOpenBody"),
    [
      { text: t("cancel"), style: "cancel" },
      { text: t("continueBtn"), onPress: () => Linking.openURL(url) }
    ]
  );
};

export default function govdocs() {
  const { t } = useSettings();
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
          <Text style={styles.headerTitle}>{t("govTitle")}</Text>

          <TouchableOpacity 
            style={styles.websiteLink} 
            activeOpacity={0.8}
            onPress={() => openLink("https://www.ncsc.gov.ph", t)}
          >
            <View style={styles.iconWrapper}>
              <MaterialCommunityIcons
                name="id-card"
                size={60}
                color="#2356E1"
              />
            </View>

            <View style={styles.textWrapper}>
              <Text style={styles.linkText}>{t("govNcsc")}</Text>
            </View>
            
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.websiteLink} 
            activeOpacity={0.8}
            onPress={() => openLink("https://www.dswd.gov.ph", t)}
          >
            <View style={styles.iconWrapper}>
              <MaterialCommunityIcons
                name="account-group"
                size={60}
                color="#2356E1"
              />
            </View>

            <View style={styles.textWrapper}>
              <Text style={styles.linkText}>{t("govDswd")}</Text>
            </View>
            
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.websiteLink} 
            activeOpacity={0.8}
            onPress={() => openLink("https://valenzuela.gov.ph/office-of-senior-citizens-affairs/", t)}
          >
            <View style={styles.iconWrapper}>
              <MaterialCommunityIcons
                name="account-tie"
                size={60}
                color="#2356E1"
              />
            </View>

            <View style={styles.textWrapper}>
              <Text style={styles.linkText}>{t("govOsca")}</Text>
            </View>
            
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.websiteLink} 
            activeOpacity={0.8}
            onPress={() => openLink("https://www.philhealth.gov.ph", t)}
          >
            <View style={styles.iconWrapper}>
              <MaterialCommunityIcons
                name="hospital"
                size={60}
                color="#2356E1"
              />
            </View>

            <View style={styles.textWrapper}>
              <Text style={styles.linkText}>{t("govPhilhealth")}</Text>
            </View>
            
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.websiteLink} 
            activeOpacity={0.8}
            onPress={() => openLink("https://doh.gov.ph", t)}
          >
            <View style={styles.iconWrapper}>
              <MaterialCommunityIcons
                name="hospital-box"
                size={60}
                color="#2356E1"
              />
            </View>

            <View style={styles.textWrapper}>
              <Text style={styles.linkText}>{t("govDoh")}</Text>
            </View>
            
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.websiteLink} 
            activeOpacity={0.8}
            onPress={() => openLink("https://www.sss.gov.ph", t)}
          >
            <View style={styles.iconWrapper}>
              <MaterialCommunityIcons
                name="credit-card"
                size={60}
                color="#2356E1"
              />
            </View>

            <View style={styles.textWrapper}>
              <Text style={styles.linkText}>{t("govSss")}</Text>
            </View>
            
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.websiteLink} 
            activeOpacity={0.8}
            onPress={() => openLink("https://www.gsis.gov.ph", t)}
          >
            <View style={styles.iconWrapper}>
              <MaterialCommunityIcons
                name="cash"
                size={60}
                color="#2356E1"
              />
            </View>

            <View style={styles.textWrapper}>
              <Text style={styles.linkText}>{t("govGsis")}</Text>
            </View>
            
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.websiteLink} 
            activeOpacity={0.8}
            onPress={() => openLink("https://psa.gov.ph", t)}
          >
            <View style={styles.iconWrapper}>
              <MaterialCommunityIcons
                name="file-document"
                size={60}
                color="#2356E1"
              />
            </View>

            <View style={styles.textWrapper}>
              <Text style={styles.linkText}>{t("govPsa")}</Text>
            </View>
            
          </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F4F6F9",
  },
  scrollView: {
    flex: 1,
    marginBottom: 75,
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 20,
  },
  websiteLink: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
    minHeight: 84,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  iconWrapper: {
    backgroundColor: "rgba(255,255,255,0.2)",
    padding: 4,
    borderRadius: 12,
  },
  textWrapper: {
    flex: 1,
    marginLeft: 14,
  },
  linkText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
    lineHeight: 26,
  },
})
