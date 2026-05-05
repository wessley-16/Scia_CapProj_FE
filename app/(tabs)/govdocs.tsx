import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const openLink = (url: string) => {
  Alert.alert(
    "Open Website",
    "You will be redirected to an external website.",
    [
      { text: "Cancel", style: "cancel" },
      { text: "Continue", onPress: () => Linking.openURL(url) }
    ]
  );
};

export default function govdocs() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
          <Text style={styles.headerTitle}>Online Government Websites</Text>

          {/* NCSC Link */}
          <TouchableOpacity 
            style={styles.websiteLink} 
            activeOpacity={0.8}
            onPress={() => openLink("https://www.ncsc.gov.ph")}
          >
            <View style={styles.iconWrapper}>
              <MaterialCommunityIcons
                name="id-card"
                size={60}
                color="#2356E1"
              />
            </View>

            <View style={styles.textWrapper}>
              <Text style={styles.linkText}>National Commission of Senior Citizens</Text>
            </View>
            
          </TouchableOpacity>

          {/* DSWD Link */}
          <TouchableOpacity 
            style={styles.websiteLink} 
            activeOpacity={0.8}
            onPress={() => openLink("https://www.dswd.gov.ph")}
          >
            <View style={styles.iconWrapper}>
              <MaterialCommunityIcons
                name="account-group"
                size={60}
                color="#2356E1"
              />
            </View>

            <View style={styles.textWrapper}>
              <Text style={styles.linkText}>Department of Social Welfare and Development (DSWD)</Text>
            </View>
            
          </TouchableOpacity>

          {/* OSCA Link */}
          <TouchableOpacity 
            style={styles.websiteLink} 
            activeOpacity={0.8}
            onPress={() => openLink("https://valenzuela.gov.ph/office-of-senior-citizens-affairs/")}
          >
            <View style={styles.iconWrapper}>
              <MaterialCommunityIcons
                name="account-tie"
                size={60}
                color="#2356E1"
              />
            </View>

            <View style={styles.textWrapper}>
              <Text style={styles.linkText}>Valenzuela Office for Senior Citizens Affair (OSCA)</Text>
            </View>
            
          </TouchableOpacity>

          {/* PhilHealth Link */}
          <TouchableOpacity 
            style={styles.websiteLink} 
            activeOpacity={0.8}
            onPress={() => openLink("https://www.philhealth.gov.ph")}
          >
            <View style={styles.iconWrapper}>
              <MaterialCommunityIcons
                name="hospital"
                size={60}
                color="#2356E1"
              />
            </View>

            <View style={styles.textWrapper}>
              <Text style={styles.linkText}>Philippine Health Insurance Corporation (PhilHealth)</Text>
            </View>
            
          </TouchableOpacity>

          {/* DOH Link */}
          <TouchableOpacity 
            style={styles.websiteLink} 
            activeOpacity={0.8}
            onPress={() => openLink("https://doh.gov.ph")}
          >
            <View style={styles.iconWrapper}>
              <MaterialCommunityIcons
                name="hospital-box"
                size={60}
                color="#2356E1"
              />
            </View>

            <View style={styles.textWrapper}>
              <Text style={styles.linkText}>Department of Health (DOH)</Text>
            </View>
            
          </TouchableOpacity>

          {/* SSS Link */}
          <TouchableOpacity 
            style={styles.websiteLink} 
            activeOpacity={0.8}
            onPress={() => openLink("https://www.sss.gov.ph")}
          >
            <View style={styles.iconWrapper}>
              <MaterialCommunityIcons
                name="credit-card"
                size={60}
                color="#2356E1"
              />
            </View>

            <View style={styles.textWrapper}>
              <Text style={styles.linkText}>Social Security System (SSS)</Text>
            </View>
            
          </TouchableOpacity>

          {/* GSIS Link */}
          <TouchableOpacity 
            style={styles.websiteLink} 
            activeOpacity={0.8}
            onPress={() => openLink("https://www.gsis.gov.ph")}
          >
            <View style={styles.iconWrapper}>
              <MaterialCommunityIcons
                name="cash"
                size={60}
                color="#2356E1"
              />
            </View>

            <View style={styles.textWrapper}>
              <Text style={styles.linkText}>Government Service Insurance System (GSIS)</Text>
            </View>
            
          </TouchableOpacity>

          {/* PSA Link */}
          <TouchableOpacity 
            style={styles.websiteLink} 
            activeOpacity={0.8}
            onPress={() => openLink("https://psa.gov.ph")}
          >
            <View style={styles.iconWrapper}>
              <MaterialCommunityIcons
                name="file-document"
                size={60}
                color="#2356E1"
              />
            </View>

            <View style={styles.textWrapper}>
              <Text style={styles.linkText}>Philippine Statistics Authority (PSA)</Text>
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
    fontSize: 24,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 20,
  },
  websiteLink: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 16,
    padding: 8,
    marginBottom: 24,
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
    marginLeft: 12,
  },
  linkText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "black",
  },
})