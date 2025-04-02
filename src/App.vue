<script setup>
import Inputer from './components/Inputer.vue'
import {  reactive, ref, computed, watch, watchEffect, nextTick, onMounted, onUpdated } from './MyVue';

const state = reactive({ name: '', count: 0, watcher: 0 });
const number = ref(0);
const doubed = computed(() => { 
    return state.count * 2 + number.value
});

onMounted(({ el }) => {
    console.log('onMounted1:App');
});

onUpdated(({ el }) => {
    console.log('onUpdated1:App');
});

// 交互方法
const increment = () => {
    state.count++;
    state.name = `Updated ${state.count}`;

    nextTick(() => {
        console.log('nextTick count');
    });

};
const incrementNum = async () => {
  number.value++;
  await nextTick();
  console.log('nextTick number');
};
// watch
let $stopWatch = ref(null);
const startWatch = () => {
    // watch
    $stopWatch.value = watch(() => [state.count, number.value], (newVal, oldVal) => {
        console.log(`watch: count && number changed ${oldVal} => ${newVal}`);
        state.watcher++
    });
};
// stopWatch
const stopWatch = () => {
    // watch
    $stopWatch?.value?.();
    $stopWatch.value = null
};

watchEffect(() => {
    console.log(`watchEffect: ${state.count}`);
});

onUpdated(({ el }) => {
    console.log('onUpdated:App');
});

onMounted(({ el }) => {
    console.log('onMounted:App');
});
</script>

<template>
  <div class="vue3-reactive-demo">
    <h1>Vue3 reactive demo</h1>
    <p>count: {{state.count}}</p>
    <p>number: {{number}}</p>
    <p>Computed: {{doubed}} (count * 2 + number)</p>
    <p>watch: {{state.watcher}} times</p>
    <button @click="increment">Count+</button>
    <button @click="incrementNum">Num+</button>
    <button v-if="$stopWatch.value" @click="stopWatch">Stop Watch</button>
    <button v-else @click="startWatch">Start Watch</button>
    
    <Inputer :number="number" />

    <div class="read-the-doc">
      <p>
        Check out
        <a href="https://vuejs.org/guide/quick-start.html#local" target="_blank"
          >create-vue</a
        >, the official Vue + Vite starter
      </p>
      <p>
        Learn more about IDE Support for Vue in the
        <a
          href="https://vuejs.org/guide/scaling-up/tooling.html#ide-support"
          target="_blank"
          >Vue Docs Scaling up Guide</a
        >.
      </p>
      <p class="read-the-docs">Click on the Vite and Vue logos to learn more</p> 
    </div>
  </div>
</template>

<style scoped>
.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}
.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}
.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}
.read-the-doc {
  color: #888;
  font-size: 12px;
}
</style>
