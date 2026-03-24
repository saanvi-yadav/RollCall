/**
 * Local Storage Utility Functions
 * Provides standardized methods for storing and retrieving data from browser localStorage
 */

// Admin Dashboard Data
export const adminStorageKeys = {
  STUDENTS: "students",
  TEACHERS: "teachers",
  COURSES: "courses",
  ASSIGNMENTS: "assignments",
};

// Student Dashboard Data
export const studentStorageKeys = {
  ATTENDANCE_STATS: "studentAttendanceStats",
  SUBJECT_ATTENDANCE: "studentSubjectAttendance",
  ATTENDANCE_HISTORY: "studentAttendanceHistory",
  WARNINGS: "studentWarnings",
};

// Teacher Dashboard Data
export const teacherStorageKeys = {
  ATTENDANCE_STATUS: "teacherAttendanceStatus",
  ATTENDANCE_RECORDS: "teacherAttendanceRecords",
};

/**
 * Get item from localStorage
 * @param {string} key - The storage key
 * @param {any} defaultValue - Default value if key doesn't exist
 * @returns {any} - Parsed value or default value
 */
export const getFromStorage = (key, defaultValue = null) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error(`Error retrieving from localStorage (${key}):`, error);
    return defaultValue;
  }
};

/**
 * Save item to localStorage
 * @param {string} key - The storage key
 * @param {any} value - The value to store (will be JSON stringified)
 * @returns {boolean} - Success/failure status
 */
export const saveToStorage = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Error saving to localStorage (${key}):`, error);
    return false;
  }
};

/**
 * Remove item from localStorage
 * @param {string} key - The storage key
 * @returns {boolean} - Success/failure status
 */
export const removeFromStorage = (key) => {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error(`Error removing from localStorage (${key}):`, error);
    return false;
  }
};

/**
 * Clear all localStorage data (Optional - for testing/reset purposes)
 * @returns {boolean} - Success/failure status
 */
export const clearAllStorage = () => {
  try {
    localStorage.clear();
    console.log("All localStorage data cleared");
    return true;
  } catch (error) {
    console.error("Error clearing localStorage:", error);
    return false;
  }
};

/**
 * Get all storage keys and their data
 * @returns {object} - Object containing all storage data
 */
export const getAllStorageData = () => {
  try {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const value = localStorage.getItem(key);
      data[key] = JSON.parse(value);
    }
    return data;
  } catch (error) {
    console.error("Error retrieving all storage data:", error);
    return {};
  }
};

/**
 * Export all data as JSON file
 * Useful for backup purposes
 */
export const exportStorageAsFile = (filename = "attendance_backup.json") => {
  try {
    const data = getAllStorageData();
    const element = document.createElement("a");
    element.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2)));
    element.setAttribute("download", filename);
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    console.log("Data exported successfully");
    return true;
  } catch (error) {
    console.error("Error exporting data:", error);
    return false;
  }
};

/**
 * Import data from JSON file
 * Restores previously backed up data
 */
export const importStorageFromFile = (file) => {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = JSON.parse(e.target.result);
        for (const key in data) {
          localStorage.setItem(key, JSON.stringify(data[key]));
        }
        console.log("Data imported successfully");
        resolve(true);
      };
      reader.onerror = () => {
        reject(new Error("Error reading file"));
      };
      reader.readAsText(file);
    } catch (error) {
      console.error("Error importing data:", error);
      reject(error);
    }
  });
};
