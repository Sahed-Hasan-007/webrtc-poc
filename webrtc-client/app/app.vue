<template>
  <div class="app-root">
    <NuxtRouteAnnouncer />
    <NuxtPage />
  </div>
</template>

<style>
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #0f0f0f;
  color: #e5e5e5;
  min-height: 100dvh;
}

.app-root {
  min-height: 100dvh;
}
</style>
