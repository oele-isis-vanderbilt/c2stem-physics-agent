/**
 * EventXMLParser
 *
 * Parses a NetsBlox project XML string and returns an array of action objects
 * for a given username, ready to pass directly to ASTController.actionListener().
 */
export default {
  /**
   * @param {string} xmlString  Raw project XML from the NetsBlox server
   * @param {string} username   Logged-in username whose events to extract
   * @returns {Array<Object>}   Action objects for ASTController.actionListener()
   */
  parseXMLPeerContext(xmlString, username) {
    const allEvents = this._extractAllEvents(xmlString);
    if (!allEvents.length) return [];

    // Find the last username in the event list
    let lastUsername = null;
    for (let i = allEvents.length - 1; i >= 0; i--) {
      if (allEvents[i].username) {
        lastUsername = allEvents[i].username;
        break;
      }
    }

    let allowedUsernames;
    if (lastUsername && lastUsername.includes(username)) {
      // Logged-in user is the last contributor — also include the user before them
      let prevUsername = null;
      for (let i = allEvents.length - 1; i >= 0; i--) {
        const u = allEvents[i].username;
        if (u && !u.includes(username)) {
          prevUsername = u;
          break;
        }
      }
      allowedUsernames = new Set([username]);
      if (prevUsername) allowedUsernames.add(prevUsername);
    } else {
      // Logged-in user has no recent events — use whoever is last
      allowedUsernames = new Set([lastUsername]);
    }

    const filtered = allEvents.filter((e) =>
      Array.from(allowedUsernames).some((u) => e.username.includes(u))
    );

    console.log(
      `[EventXMLParser] parseXMLPeerContext: ${
        filtered.length
      } events for usernames [${Array.from(allowedUsernames).join(", ")}]`
    );
    return filtered;
  },

  _extractAllEvents(xmlString) {
    function parseArgs(argNodes, eventType) {
      return Array.from(argNodes).map((argNode) => {
        if (argNode.children.length > 0) {
          let obj = {};
          let underscoreValues = [];

          Array.from(argNode.children).forEach((child) => {
            if (/^_\d+$/.test(child.tagName)) {
              if (child.children.length > 0) {
                underscoreValues.push(parseArgs([child], eventType)[0]);
              } else {
                underscoreValues.push(parseValue(child, eventType));
              }
            } else {
              if (child.children.length > 0) {
                obj[child.tagName] = parseArgs([child], eventType)[0];
              } else {
                obj[child.tagName] = parseValue(child, eventType);
              }
            }
          });

          if (underscoreValues.length > 0) return underscoreValues;
          return obj;
        }

        return parseValue(argNode, eventType);
      });
    }

    function parseValue(node, eventType) {
      if (!node || node.textContent.trim() === "") return null;
      const value = node.textContent.trim();
      if (eventType === "setField") return value;
      if (!isNaN(value))
        return value.includes(".") ? parseFloat(value) : parseInt(value, 10);
      return value;
    }

    const SKIP_TYPES = new Set([
      "renameSprite",
      "addSprite",
      "removeSprite",
      "selectSprite",
      "selectTab",
      "addCostume",
      "duplicateSprite",
      "setCommentText",
      "setConceptLevel",
      "openProject",
      "setStageSize",
      "updateCostume",
      "setSpritePosition",
      "stopAllScripts",
      "pressStart",
      "startScript",
    ]);

    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlString, "text/xml");

      const parseError = xmlDoc.querySelector("parsererror");
      if (parseError) {
        console.error(
          "[EventXMLParser] DOMParser failed — malformed XML:",
          parseError.textContent.slice(0, 300)
        );
        console.error(
          "[EventXMLParser] xmlString length:",
          xmlString.length,
          "| tail:",
          xmlString.slice(-200)
        );
        return [];
      }

      const replayNode = xmlDoc.querySelector("replay");
      if (!replayNode) {
        console.warn(
          "[EventXMLParser] No <replay> tag found. Root element:",
          xmlDoc.documentElement?.tagName,
          "| xmlString length:",
          xmlString.length
        );
        return [];
      }

      const eventNodes = replayNode.getElementsByTagName("event");
      if (eventNodes.length === 0) {
        console.warn("[EventXMLParser] No <event> elements found in <replay>.");
        return [];
      }

      const events = [];
      for (let i = 0; i < eventNodes.length; i++) {
        const eventNode = eventNodes[i];
        const type = eventNode.getAttribute("type");
        const eventUsername = eventNode.getAttribute("username") || "";

        if (SKIP_TYPES.has(type)) continue;

        const args = parseArgs(eventNode.getElementsByTagName("arg"), type);

        // XML events have no `owner` attribute — derive it so ASTController
        // doesn't crash when calling action.owner.split("/")[0].
        // For addBlock, args[1] is the target sprite/stage id (e.g. "item_0").
        // For all other types, the session user token is a safe fallback.
        const sessionUser = eventNode.getAttribute("user") || "item_0";
        const owner =
          type === "addBlock" && args[1] && typeof args[1] === "string"
            ? args[1]
            : sessionUser;

        events.push({
          type,
          args,
          owner,
          user: sessionUser,
          username: eventUsername,
          id: Number(eventNode.getAttribute("id")),
          time: Number(eventNode.getAttribute("time")),
        });
      }

      return events;
    } catch (e) {
      console.error("[EventXMLParser] Error parsing XML:", e);
      return [];
    }
  },

  parseXML(xmlString, username) {
    const allEvents = this._extractAllEvents(xmlString);
    const events = allEvents.filter((e) => e.username.includes(username));
    console.log(
      `[EventXMLParser] ${events.length} replayable events found for "${username}"`
    );
    return events;
  },
};
