/**
 * Data table configs, one per lesson that has the data table tool, keyed by
 * lessonId (the lesson card's ?lessonId=...). Lessons not listed here have no
 * data table button.
 *
 * Column keys are stored with each student's saved rows: renaming a key loses
 * the saved values for that column, so add new keys instead.
 */
const DATA_TABLES = {
  lesson1: {
    title: "Mass vs stopping position",
    columns: [
      { key: "mass", label: "Mass", unit: "kg" },
      { key: "stopPos", label: "Stopping position", unit: "m" },
    ],
    plot: { x: "mass", y: ["stopPos"] },
  },
  lesson2: {
    title: "Mass vs velocity and energy",
    columns: [
      { key: "mass", label: "Mass", unit: "kg" },
      { key: "velocity", label: "Velocity", unit: "m/s" },
      { key: "pe", label: "Potential energy", unit: "J" },
      { key: "ke", label: "Kinetic energy", unit: "J" },
    ],
    plot: { x: "mass", y: ["velocity", "pe", "ke"] },
  },
};

export function getDataTable(lessonId) {
  return DATA_TABLES[lessonId] || null;
}

export function dataTableLessons() {
  return Object.keys(DATA_TABLES).map((id) => ({
    id,
    title: DATA_TABLES[id].title,
  }));
}
