import { createRouter, createWebHistory } from "vue-router";
import HomeView from "../views/HomeView.vue";
import LoginView from "@/views/LoginView.vue";
import ConversationView from "@/views/ConversationView.vue";
// import BuildEnv from "@/components/BuildEnv.vue";
import Construct from "@/views/Construct.vue";
import ConstructWAgent from "@/views/ConstructWAgent.vue";
import store from "@/store";

function islogin(to, from, next) {
  if (!store.state.user) {
    next();
  } else {
    next(false);
  }
}

const routes = [
  {
    path: "/home",
    name: "home",
    component: HomeView,
    meta: {
      requiresAuth: true,
      title: "C2STEM | Home",
    },
  },
  {
    path: "/",
    name: "login",
    component: LoginView,
    beforeEnter: islogin,
    meta: { title: "C2STEM | Login" },
  },
  {
    path: "/conversations",
    name: "conversation",
    component: ConversationView,
  },
  {
    path: "/construct",
    name: "Construct",
    component: Construct,
    meta: {
      requiresAuth: true,
      title: "C2STEM | Construct",
    },
  },
  {
    path: "/constructAgent",
    name: "ConstructAgent",
    component: ConstructWAgent,
    meta: {
      requiresAuth: true,
      title: "C2STEM | Construct",
    },
  },
];

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes,
});

router.beforeEach((to, from, next) => {
  const loggedIn = store.state.user;
  if (to.meta && to.meta.title) {
    document.title = to.meta.title || "C2STEM";
  }
  if (to.matched.some((record) => record.meta.requiresAuth) && !loggedIn) {
    next("/");
  } else {
    next();
  }
});
export default router;
