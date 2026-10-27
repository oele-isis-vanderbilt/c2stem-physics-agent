export default {
  getAllIds(obj, ids = [], seen = new Set()) {
    // Base case: if obj is null or undefined (or already visited), return current ids
    if (!obj || seen.has(obj)) {
      return ids;
    }
    seen.add(obj);

    // If current object has an id, add it to the collection
    if (obj.id) {
      ids.push(obj.id);
    }

    // Recursively check the 'next' property
    if (obj.next) {
      this.getAllIds(obj.next, ids, seen);
    }

    // Recursively check items in 'contained' array
    if (obj.contained && Array.isArray(obj.contained)) {
      obj.contained.forEach((item) => {
        this.getAllIds(item, ids, seen);
      });
    }

    // Recursively check items in 'underlay' array
    if (obj.underlay && Array.isArray(obj.underlay)) {
      obj.underlay.forEach((item) => {
        this.getAllIds(item, ids, seen);
      });
    }

    return ids;
  },
};
