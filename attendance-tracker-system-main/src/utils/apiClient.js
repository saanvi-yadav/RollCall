/**
 * API utility for making requests to the backend
 * Base URL: http://localhost:5000/api
 */

const API_BASE_URL = "http://localhost:5000/api";

/**
 * Get the JWT token from localStorage
 */
const getToken = () => {
  return localStorage.getItem("authToken");
};

const getStoredUser = () => {
  const storedUser = localStorage.getItem("currentUser");

  if (!storedUser) {
    return null;
  }

  try {
    return JSON.parse(storedUser);
  } catch (error) {
    console.error("Failed to parse current user:", error);
    return null;
  }
};

/**
 * Make an API request with common headers
 */
const apiCall = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = getToken();

  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "API request failed");
    }

    return await response.json();
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error);
    throw error;
  }
};

const buildQueryString = (params = {}) => {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.append(key, value);
    }
  });

  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
};

/**
 * User APIs
 */
export const userAPI = {
  register: async (userData) => {
    return apiCall("/users/register", {
      method: "POST",
      body: JSON.stringify(userData),
    });
  },

  login: async (email, password, role) => {
    return apiCall("/users/login", {
      method: "POST",
      body: JSON.stringify({ email, password, role }),
    });
  },

  changePassword: async (currentPassword, newPassword) => {
    return apiCall("/users/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  updateProfile: async (profileData) => {
    return apiCall("/users/profile", {
      method: "PUT",
      body: JSON.stringify(profileData),
    });
  },
};

/**
 * Attendance APIs
 */
export const attendanceAPI = {
  markAttendance: async (status) => {
    return apiCall("/attendance/mark", {
      method: "POST",
      body: JSON.stringify({ status }),
    });
  },

  getMyAttendance: async () => {
    return apiCall("/attendance/my", {
      method: "GET",
    });
  },

  getAttendanceStats: async () => {
    return apiCall("/attendance/stats", {
      method: "GET",
    });
  },

  getAttendanceByDate: async (date) => {
    return apiCall(`/attendance/by-date?date=${date}`, {
      method: "GET",
    });
  },

  getAllAttendanceRecords: async (filters = {}) => {
    return apiCall(`/attendance/all${buildQueryString(filters)}`, {
      method: "GET",
    });
  },

  getStudentAttendance: async (studentId) => {
    return apiCall(`/attendance/student/${studentId}`, {
      method: "GET",
    });
  },

  getClassAttendanceReport: async (classId) => {
    return apiCall(`/attendance/class/${classId}/report`, {
      method: "GET",
    });
  },

  getClassAttendanceSession: async (classId, date) => {
    return apiCall(`/attendance/class/${classId}/session?date=${date}`, {
      method: "GET",
    });
  },
};

/**
 * Course APIs
 */
export const courseAPI = {
  getAllCourses: async () => {
    return apiCall("/courses", {
      method: "GET",
    });
  },

  getProfessorCourses: async () => {
    return apiCall("/courses/professor", {
      method: "GET",
    });
  },

  createCourse: async (courseData) => {
    return apiCall("/courses", {
      method: "POST",
      body: JSON.stringify(courseData),
    });
  },

  updateCourse: async (courseId, courseData) => {
    return apiCall(`/courses/${courseId}`, {
      method: "PUT",
      body: JSON.stringify(courseData),
    });
  },

  deleteCourse: async (courseId) => {
    return apiCall(`/courses/${courseId}`, {
      method: "DELETE",
    });
  },
};

/**
 * Class APIs
 */
export const classAPI = {
  getAllClasses: async () => {
    return apiCall("/classes", {
      method: "GET",
    });
  },

  getProfessorClasses: async () => {
    return apiCall("/classes/professor", {
      method: "GET",
    });
  },

  getStudentClasses: async () => {
    return apiCall("/classes/student", {
      method: "GET",
    });
  },

  getClassStudents: async (classId) => {
    return apiCall(`/classes/${classId}/students`, {
      method: "GET",
    });
  },

  createClass: async (classData) => {
    return apiCall("/classes", {
      method: "POST",
      body: JSON.stringify(classData),
    });
  },

  updateClass: async (classId, classData) => {
    return apiCall(`/classes/${classId}`, {
      method: "PUT",
      body: JSON.stringify(classData),
    });
  },

  deleteClass: async (classId) => {
    return apiCall(`/classes/${classId}`, {
      method: "DELETE",
    });
  },

  addStudentToClass: async (classId, studentId) => {
    return apiCall("/classes/add-student", {
      method: "POST",
      body: JSON.stringify({ classId, studentId }),
    });
  },

  markClassAttendance: async (classId, attendanceData, date) => {
    return apiCall("/classes/mark-attendance", {
      method: "POST",
      body: JSON.stringify({ classId, attendanceData, date }),
    });
  },

  updateClassAttendance: async (classId, attendanceData, date) => {
    return apiCall("/classes/mark-attendance", {
      method: "PUT",
      body: JSON.stringify({ classId, attendanceData, date }),
    });
  },
};

/**
 * Admin APIs
 */
export const adminAPI = {
  getAllStudents: async () => {
    return apiCall("/admin/students", {
      method: "GET",
    });
  },

  getAllProfessors: async () => {
    return apiCall("/admin/professors", {
      method: "GET",
    });
  },

  getDashboardStats: async () => {
    return apiCall("/admin/stats", {
      method: "GET",
    });
  },

  createUser: async (userData) => {
    return apiCall("/admin/users", {
      method: "POST",
      body: JSON.stringify(userData),
    });
  },

  updateUser: async (userId, userData) => {
    return apiCall(`/admin/users/${userId}`, {
      method: "PUT",
      body: JSON.stringify(userData),
    });
  },

  deleteUser: async (userId) => {
    return apiCall(`/admin/users/${userId}`, {
      method: "DELETE",
    });
  },
};

export const notificationAPI = {
  getNotifications: async () => {
    return apiCall("/notifications", {
      method: "GET",
    });
  },

  createNotification: async (notificationData) => {
    return apiCall("/notifications", {
      method: "POST",
      body: JSON.stringify(notificationData),
    });
  },
};

export const settingsAPI = {
  getAcademicConfig: async () => {
    return apiCall("/academic-config", {
      method: "GET",
    });
  },

  updateAcademicConfig: async (configData) => {
    return apiCall("/academic-config", {
      method: "PUT",
      body: JSON.stringify(configData),
    });
  },
};

/**
 * Helper function to save auth token
 */
export const setAuthToken = (token) => {
  localStorage.setItem("authToken", token);
};

/**
 * Helper function to clear auth token
 */
export const clearAuthToken = () => {
  localStorage.removeItem("authToken");
};

export const getCurrentUser = () => {
  return getStoredUser();
};

export const setCurrentUser = (user) => {
  localStorage.setItem("currentUser", JSON.stringify(user));
};

export const clearCurrentUser = () => {
  localStorage.removeItem("currentUser");
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = () => {
  return !!getToken() && !!getStoredUser();
};
