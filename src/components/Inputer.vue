<script setup>
import {  reactive, ref, computed, watch, watchEffect, nextTick, onMounted, onUpdated } from '../MyVue';

// defineProps({
//   msg: String,
// })

const title = ref('Inputer Component');
const text = ref('test1');

// watch
const $stopWatch = watch(() => [text.value], (newVal, oldVal) => {
  console.log(`watch: text changed ${oldVal} => ${newVal}`);
});

const onChange = e => {
  text.value = e.target.value
}

onMounted(() => {
  console.log(`onMounted:Inputer`);
});

onUpdated(() => {
  console.log(`onUpdated:Inputer`);
});
</script>

<template>
  <div class="sub-test">
    <h2>{{ title }}</h2>
    <div class="card">
      <div>Value is {{ text }}</div>
      <input type="text" :value="text.value" @change="onChange" />
    </div>
  </div>
</template>

<style scoped>
.read-the-docs {
  color: #888;
}
</style>
