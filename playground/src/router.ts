import DemoCustomize from "./DemoCustomize.vue";
import DemoNekoPet from "./DemoNekoPet.vue";
import DemoUseNekoAnchor from "./DemoUseNekoAnchor.vue";
import { type RouteLocationNormalizedLoaded, createRouter, createWebHistory } from "vue-router";

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "component",
      component: DemoNekoPet,
      meta: { title: "NekoPet (component)" },
    },
    {
      path: "/composable",
      name: "composable",
      component: DemoUseNekoAnchor,
      meta: { title: "useNeko (composable)" },
    },
    {
      path: "/customize",
      name: "customize",
      component: DemoCustomize,
      meta: { title: "Customize (sandbox)" },
    },
  ],
});

router.afterEach((to: RouteLocationNormalizedLoaded) => {
  const raw = to.meta["title"];
  const suffix = typeof raw === "string" && raw.length > 0 ? raw : "";
  document.title = suffix ? `neko-vue — ${suffix}` : "neko-vue playground";
});
