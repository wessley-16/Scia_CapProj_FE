import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { SafeAreaView } from "react-native-safe-area-context";
export default function Appointment() {
  const [selectedDate, setSelectedDate] = useState('');

  return (
    <SafeAreaView style={styles.safeArea}>  
      <View style={styles.container}>
        <Text style={styles.headerTitle}>Schedule Appointment</Text>

        <View style={styles.calendarWrapper}>
          <Calendar
            // Minimum date that can be selected, dates before minDate will be grayed out.
            // Using today's date so users can't book in the past.
            minDate={new Date().toDateString()}
            
            // Handler which gets executed on day press
            onDayPress={(day: any) => {
              setSelectedDate(day.dateString);
            }}
            
            // Mark specific dates as styled
            markedDates={{
              [selectedDate]: {
                selected: true,
                disableTouchEvent: true,
                selectedColor: '#2563EB', // Blue to match your Home screen theme
                selectedTextColor: 'white',
              },
            }}
            
            // Customize the styling of the calendar
            theme={{
              backgroundColor: '#ffffff',
              calendarBackground: '#ffffff',
              textSectionTitleColor: '#b6c1cd',
              selectedDayBackgroundColor: '#2563EB',
              selectedDayTextColor: '#ffffff',
              todayTextColor: '#2563EB',
              dayTextColor: '#2d4150',
              textDisabledColor: '#d9e1e8',
              dotColor: '#2563EB',
              selectedDotColor: '#ffffff',
              arrowColor: '#2563EB',
              monthTextColor: '#1F2937',
              textDayFontFamily: 'Inter-Medium', // Assuming you have this from before
              textMonthFontFamily: 'Inter-Bold',
              textDayHeaderFontFamily: 'Inter-Medium',
              textDayFontWeight: '300',
              textMonthFontWeight: 'bold',
              textDayHeaderFontWeight: '300',
              textDayFontSize: 14,
              textMonthFontSize: 16,
              textDayHeaderFontSize: 12,
            }}
          />
        </View>

        {/* Display the selected date */}
        {selectedDate ? (
          <View style={styles.selectedDateContainer}>
            <Text style={styles.selectedDateLabel}>Selected Date:</Text>
            <Text style={styles.selectedDateText}>{selectedDate}</Text>
          </View>
        ) : null}

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F4F6F9', // Matches the Home screen background
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 20,
    fontFamily: 'Inter-Bold', // Remove if font isn't loaded globally
  },
  calendarWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'white',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    paddingBottom: 10, // Slight padding at bottom inside the wrapper
  },
  selectedDateContainer: {
    marginTop: 24,
    backgroundColor: '#EFF6FF', // Light blue tint like your reminder card
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedDateLabel: {
    fontSize: 16,
    color: '#4B5563',
    fontFamily: 'Inter-Medium',
  },
  selectedDateText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E3A8A',
  },
});