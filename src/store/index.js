import { createStore } from "vuex";
import { Room } from "livekit-client";

const store = createStore({
  state: {
    livekitRoom: Room,
  },
  getters: {
    getLiveKitRoom(state) {
      return state.livekitRoom;
    },
  },
  mutations: {
    addLivekitRoom(state, data) {
      state.livekitRoom = data.room;
    },
  },
  actions: {
    addLivekitRoom(context, data) {
      context.commit("addLivekitRoom", data);
    },
  },
  modules: {},
});
export default store;
