export default {
  getAllIds(obj, ids = []) {
    // Base case: if obj is null or undefined, return current ids
    if (!obj) {
      return ids;
    }

    // If current object has an id, add it to the collection
    if (obj.id) {
      ids.push(obj.id);
    }

    // Recursively check the 'next' property
    if (obj.next) {
      this.getAllIds(obj.next, ids);
    }

    // Recursively check items in 'contained' array
    if (obj.contained && Array.isArray(obj.contained)) {
      obj.contained.forEach((item) => {
        this.getAllIds(item, ids);
      });
    }

    // Recursively check items in 'underlay' array
    if (obj.underlay && Array.isArray(obj.underlay)) {
      obj.underlay.forEach((item) => {
        this.getAllIds(item, ids);
      });
    }

    return ids;
  },
};
