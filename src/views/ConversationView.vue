<template>
  <div class="container">
    <div class="row">
      <form class="row g-3">
        <div class="col-auto">
          <button
            type="button"
            class="btn btn-primary mb-3"
            @click="getAllUsers"
          >
            Get Conversations for all Users
          </button>
        </div>
        <div class="col-auto">
          <label for="username" class="visually-hidden">Username</label>
          <input
            v-model="username"
            type="text"
            class="form-control"
            id="username"
            placeholder="username"
          />
        </div>
        <div class="col-auto">
          <button
            type="button"
            class="btn btn-primary mb-3"
            @click="getFilteredUser"
          >
            Get User Conversation
          </button>
        </div>
      </form>
    </div>
    <div class="row">
      <div v-if="isVisible" class="accordion" id="accordionFlushExample">
        <div
          v-for="(value, key) in getConversations"
          :key="key"
          class="accordion-item"
        >
          <h2 class="accordion-header">
            <button
              class="accordion-button collapsed"
              type="button"
              data-bs-toggle="collapse"
              :data-bs-target="'#flush-collapseOne' + key"
              aria-expanded="false"
              :aria-controls="'flush-collapseOne' + key"
            >
              {{ key }}
            </button>
          </h2>
          <div
            :id="'flush-collapseOne' + key"
            class="accordion-collapse collapse"
            data-bs-parent="#accordionFlushExample"
          >
            <div class="accordion-body">
              <p v-for="(el, index) in value" :key="index">
                {{ el }}
                {{ " " }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import Conversation from "@/services/Conversation";
export default {
  name: "ConversationView",
  data() {
    return {
      username: "",
      dataVisible: true,
      conversations: {},
    };
  },
  computed: {
    isVisible() {
      return this.dataVisible;
    },
    getConversations() {
      return this.conversations;
    },
  },
  methods: {
    async getAllUsers() {
      let response = await Conversation.getAllUserConversations();
      if (response) {
        this.conversations = response.data;
        this.dataVisible = true;
      }
    },
    async getFilteredUser() {
      if (this.username.length > 1) {
        let response = await Conversation.getUserConversationById(
          this.username
        );
        if (response) {
          this.conversations = response.data;
          this.dataVisible = true;
        }
      } else {
        alert("Enter Username");
      }
    },
  },
};
</script>

<style scoped>
div {
  min-height: 0;
}
.container {
  width: 100%;
  height: fit-content;
  background: white;
}
.row {
  margin: 10px;
  justify-content: center;
}
</style>
