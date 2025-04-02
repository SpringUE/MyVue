<script setup>
import {  reactive, ref, computed, watch, watchEffect, nextTick, onMounted, onUpdated } from '../MyVue';

const props = defineProps({
  number: Number,
})

const title = ref('Inputer Component');
const text = ref('test1');

// watch
watch(() => [text.value], (newVal, oldVal) => {
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
  <div class="inputer">
    <h2>{{ title }}</h2>
    <section>
      <p>props.number is {{ number }}</p>
      <p>Value is {{ text }}</p>
      <input type="text" :value="text.value" @change="onChange" />
    </section>
  </div>
</template>

<style scoped>

</style>
