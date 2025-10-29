/**
 * ProjectXMLParser - Parses project XML to extract sprite information
 *
 * Takes an XML string as input and extracts sprite data from <sprites><sprite>...</sprite></sprites> tags.
 * Returns a dictionary with collabId as key and name as value.
 */
class ProjectXMLParser {
  /**
   * Constructor
   * @param {string} xmlString - The XML string to parse
   */
  constructor(xmlString) {
    this.xmlString = xmlString;
    this.sprites = {};
  }

  /**
   * Parse the XML and extract sprites
   * @returns {Object} Dictionary with collabId as key and name as value
   */
  parse() {
    // Create a DOM parser
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(this.xmlString, "text/xml");

    // Check for parsing errors
    const parserError = xmlDoc.querySelector("parsererror");
    if (parserError) {
      console.error("Error parsing XML:", parserError.textContent);
      return this.sprites;
    }

    // Find all sprite elements
    const spriteElements = xmlDoc.querySelectorAll("sprites > sprite");

    // Extract collabId and name from each sprite
    spriteElements.forEach((sprite) => {
      const collabId = sprite.getAttribute("collabId");
      const name = sprite.getAttribute("name");

      if (collabId && name) {
        this.sprites[collabId] = name;
      }
    });

    return this.sprites;
  }

  /**
   * Get the parsed sprites dictionary
   * @returns {Object} Dictionary with collabId as key and name as value
   */
  getSprites() {
    return this.sprites;
  }
}

// Export for use in other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = ProjectXMLParser;
}

export default ProjectXMLParser;
