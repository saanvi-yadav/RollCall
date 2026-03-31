const AcademicConfig = require("../models/AcademicConfig");

const normalizeList = (items = [], upperCase = false) =>
  [...new Set(
    items
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .map((item) => (upperCase ? item.toUpperCase() : item)),
  )].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

const startOfDay = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const normalizeAcademicEvents = (events = []) =>
  (Array.isArray(events) ? events : [])
    .map((event) => ({
      title: String(event?.title || "").trim(),
      type: String(event?.type || "").trim(),
      startDate: event?.startDate ? startOfDay(event.startDate) : null,
      endDate: event?.endDate ? startOfDay(event.endDate) : null,
      notes: String(event?.notes || "").trim(),
    }))
    .filter((event) => event.title && event.type && event.startDate && event.endDate)
    .map((event) => ({
      ...event,
      endDate: event.endDate < event.startDate ? event.startDate : event.endDate,
    }))
    .sort((left, right) => left.startDate - right.startDate);

const getOrCreateConfig = async () => {
  let config = await AcademicConfig.findOne({ key: "default" });

  if (!config) {
    config = await AcademicConfig.create({
      key: "default",
      departments: [],
      semesters: [],
      sections: [],
      academicEvents: [],
    });
  }

  return config;
};

const getAcademicConfig = async (req, res) => {
  try {
    const config = await getOrCreateConfig();
    res.json(config);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to fetch academic configuration" });
  }
};

const updateAcademicConfig = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admin can update academic configuration" });
    }

    const { departments = [], semesters = [], sections = [], academicEvents = [] } = req.body;

    const config = await AcademicConfig.findOneAndUpdate(
      { key: "default" },
      {
        key: "default",
        departments: normalizeList(departments),
        semesters: normalizeList(semesters),
        sections: normalizeList(sections, true),
        academicEvents: normalizeAcademicEvents(academicEvents),
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    res.json(config);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to update academic configuration" });
  }
};

module.exports = {
  getAcademicConfig,
  updateAcademicConfig,
};
