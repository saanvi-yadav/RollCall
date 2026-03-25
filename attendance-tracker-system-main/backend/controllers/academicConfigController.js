const AcademicConfig = require("../models/AcademicConfig");

const normalizeList = (items = [], upperCase = false) =>
  [...new Set(
    items
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .map((item) => (upperCase ? item.toUpperCase() : item)),
  )].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

const getOrCreateConfig = async () => {
  let config = await AcademicConfig.findOne({ key: "default" });

  if (!config) {
    config = await AcademicConfig.create({
      key: "default",
      departments: [],
      semesters: [],
      sections: [],
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

    const { departments = [], semesters = [], sections = [] } = req.body;

    const config = await AcademicConfig.findOneAndUpdate(
      { key: "default" },
      {
        key: "default",
        departments: normalizeList(departments),
        semesters: normalizeList(semesters),
        sections: normalizeList(sections, true),
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
