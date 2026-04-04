<script setup lang="ts">
import { RouterLink, RouterView, useRoute } from "vue-router";

const route = useRoute();
</script>

<template>
  <div class="page" :class="{ 'page--wide': route.name === 'customize' }">
    <header class="topbar">
      <RouterLink class="brand" to="/">neko-vue</RouterLink>
      <nav class="nav" aria-label="Demo pages">
        <RouterLink class="nav-link" to="/" exact-active-class="nav-link--active"
          >NekoPet</RouterLink
        >
        <RouterLink class="nav-link" to="/composable" active-class="nav-link--active"
          >useNeko</RouterLink
        >
        <RouterLink class="nav-link" to="/customize" active-class="nav-link--active"
          >Customize</RouterLink
        >
      </nav>
    </header>
    <p class="warn" role="note">One pet per page · refresh if HMR leaves a stray.</p>
    <main class="main">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  padding: 0.75rem 1rem 1.5rem;
  font-family: system-ui, sans-serif;
  max-width: 44rem;
}
.topbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1rem;
  padding-bottom: 0.5rem;
  margin-bottom: 0.35rem;
  border-bottom: 1px solid #e2e8f0;
}
.brand {
  font-size: 0.95rem;
  font-weight: 700;
  color: #0f172a;
  text-decoration: none;
  letter-spacing: -0.02em;
}
.brand:hover {
  color: #2563eb;
}
.nav {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 0.65rem;
  margin-left: auto;
}
.nav-link {
  font-size: 0.875rem;
  font-weight: 500;
  color: #2563eb;
  text-decoration: none;
  padding: 0.2rem 0.35rem;
  border-radius: 0.25rem;
}
.nav-link:hover {
  text-decoration: underline;
  background: #f1f5f9;
}
.nav-link--active {
  color: #1e3a8a;
  text-decoration: underline;
  background: #f8fafc;
}
.warn {
  font-size: 0.7rem;
  color: #94a3b8;
  margin: 0 0 0.75rem;
  line-height: 1.3;
}
.page--wide {
  max-width: 62rem;
}
.main {
  padding-top: 0;
}
code {
  font-size: 0.9em;
}
</style>
