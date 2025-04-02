/**
 * 响应式系统核心实现
 * Vue3的响应式系统核心数据结构是WeakMap→Map→Set的结构
 * 
 */


let activeEffect = null;

/*
Vue3响应式系统采用WeakMap作为核心数据结构，主要基于以下设计考量：

1.‌自动内存管理机制‌: 
WeakMap的键名是弱引用，当目标对象不再被外部引用时，其关联的依赖映射会被自动回收，避免内存泄漏‌34
对比普通Map，若使用强引用存储对象键，即使对象已无实际用途也无法被GC回收‌34
 
‌2.防止重复代理‌:
通过WeakMap缓存已代理对象（如reactiveMap），当重复调用reactive(obj)时直接返回缓存代理，避免重复创建代理对象的性能损耗‌45
 
3.‌键类型约束特性‌:
WeakMap仅允许对象类型作为键名，与响应式系统处理对象类型数据的核心场景完全匹配‌46
基础类型数据通过ref转换为对象形式处理，与WeakMap特性形成互补（如ref内部调用reactive包装对象）‌7
*/
const targetMap = new WeakMap();
let isMounted = false;

/**
 * 用栈保存嵌套依赖，当前取最新effect
 */
const effectStack = [];


// 基本响应式对象
export function reactive(obj) {
    return new Proxy(obj, {
        get(target, key, receiver) {
            track(target, key)
            return Reflect.get(target, key, receiver)
        },
        set(target, key, value, receiver) {
            Reflect.set(target, key, value, receiver)
            trigger(target, key)
            return true
        }
    })
}

// ref
export function ref(value) {
    // 对象类型用 reactive 包装
    const wrappedValue = reactive({ value });

    // 返回带有 __v_isRef 标记的对象
    return {
        __v_isRef: true,
        get value() {
            return wrappedValue.value;
        },
        set value(newVal) {
            wrappedValue.value = newVal;
        }
    };
    // return reactive({ value })
}

// isRef 实现
function isRef(obj) {
    return !!obj?.__v_isRef;
}

// 收集依赖
function track(target, key) {
    if (!activeEffect) return;
    let depMap = targetMap.get(target);
    if (!depMap) {
        depMap = new Map();
        targetMap.set(target, depMap);
    }
    let depSet = depMap.get(key);
    if (!depSet) {
        depSet = new Set();
        depMap.set(key, depSet);
    }
    depSet.add(activeEffect);
    activeEffect.deps.add(depSet);
}

// 触发更新
let updatePendding = false;
const updateQueue = new Set();
function trigger(target, key) {
    let depMap = targetMap.get(target);
    if (!depMap) return;
    let depSet = depMap.get(key);
    if (!depSet) return;
    const effects = new Set(depSet);

    effects.forEach(effect => {
        if (effect.scheduler) {
            effect.scheduler()
        } else {
            updateQueue.add(effect);
        }
    });

    if (!updatePendding) {
        updatePendding = true;
        queueMicrotask(() => {
            updatePendding = false;
            updateQueue.forEach(effect => {
                effect.run();
            });
            updateQueue.clear()
        });
    }
}

// effect
class ReactiveEffect {
    constructor(fn, scheduler) {
        this.fn = fn
        this.deps = new Set()
        this.scheduler = scheduler
    }

    run() {
        let res;
        try {
            this.cleanup();
            effectStack.push(this);
            activeEffect = this;
            res = this.fn();
        } finally {
            effectStack.pop();
            activeEffect = effectStack[effectStack.length - 1]
        }
        return res;
    }

    cleanup() {
        this.deps.forEach(dep => dep.delete(this));
        this.deps.length = 0;
    }
}

/**
 * 1.当依赖数据变化时触发调度更新标识
 * 2.再次读取依赖值时触发effect函数，从而更新值
 * 3.存在依赖嵌套，故此需要处理嵌套effect
 */
export function computed(gatter) {
    let dirty = true;
    let cacheValue;

    const computedObj = reactive({ value: null });
    const computedEffect = new ReactiveEffect(gatter, () => {
        dirty = true;
        trigger(computedObj, 'value');
    });

    return {
        __v_isRef: true,
        get value() {
            track(computedObj, 'value');
            if (dirty) {
                cacheValue = computedEffect.run();
                dirty = false;
            }
            return cacheValue;
        }
    }
}

export function watch(gatter, cb) {
    let ov;
    const watchEffect = new ReactiveEffect(gatter, () => {
        const nv = watchEffect.run();
        cb(nv, ov);
        ov = nv;
    });

    ov = watchEffect.run();
    return () => {
        watchEffect.cleanup();
    }
}

export function watchEffect(gatter) {
    const watchEffect = new ReactiveEffect(gatter);
    watchEffect.run();
    return () => {
        watchEffect.cleanup();
    }
}

// nextTick的实现
let nextTickPending = false
const nextTickCallbacks = []
// 核心实现函数
export const nextTick = (fn) => {
    nextTickCallbacks.push(() => {
        if (fn) fn()
    })

    return new Promise((resolve, reject) => {
        if (!nextTickPending) {
            nextTickPending = true
            // 微任务触发
            Promise.resolve().then(() => {
                try {
                    flushCallbacks();
                    resolve()
                } catch (error) {
                    reject(error)
                }
            })
        }
    })
}

// 批量执行回调
function flushCallbacks() {
    nextTickPending = false
    const copies = nextTickCallbacks.slice(0)
    nextTickCallbacks.length = 0
    copies.forEach(cb => cb())
}

function renderVNode(vNodeOld, vnode, parent) {
    let el;

    // 处理文本节点
    if (typeof vnode === 'string' || vnode.text) {
        el = document.createTextNode(vnode.text || vnode);
    }
    else if (typeof vnode.type === 'object') {
        if (vNodeOld?.component?.isMounted) {
            vnode.component = vNodeOld.component;
            vnode.component.updateContainer(parent);
            // 以存在节点直接挂载到父容器
            parent.appendChild(vnode.component.vnode.el);
            return;
        } else {
            const { render } = createRenderer();
            render(vnode, parent);
            el = vnode.component.vnode.el;
        }
    }
    else if (typeof vnode.type === 'symbol') {
        el = document.createTextNode(vnode.children || vnode);
    }
    else {
        // 创建元素节点
        el = document.createElement(vnode.type);

        // 设置元素属性
        if (vnode.props) {
            setProps(el, vnode.props);
        }

        // 递归渲染子节点
        if (vnode.children) {
            [].concat(vnode.children || []).forEach((child, index) => {
                let childEl;
                if (typeof child.type === 'object') {
                    const vChildNodeOld = vNodeOld?.children?.find(x =>  x.type.__hmrId === child.type.__hmrId);
                    childEl = renderVNode(vChildNodeOld, child, el);
                } else {
                    childEl = renderVNode(null, child, el);
                }
            });
        }
    }

    const oldEl = vNodeOld?.component?.vnode?.el || vNodeOld?.el;
    try {
        if (oldEl && el !== oldEl) {
            // 替换节点
            parent.replaceChild(el, oldEl);
        } else {
            // 将节点挂载到父容器
            parent.appendChild(el);
        }

    } catch (error) {
        console.error(error)
    }
    return el;
}

function setProps(el, props) {
    for (const key in props) {
        if (key === 'class') {
            el.className = props[key]; // 处理类名
        } else if (key === 'style') {
            const style = props.style;
            if (typeof style === 'string') {
                el.style.cssText = style; // 字符串形式样式
            } else {
                Object.assign(el.style, style); // 合并样式对象
            }
        } else if (key.startsWith('on')) {
            // 处理事件监听
            const eventName = key.slice(2).toLowerCase();
            el.addEventListener(eventName, props[key]);
        } else {
            // 设置其他HTML属性
            el.setAttribute(key, props[key]);
        }
    }
}


// 生命周期队列管理
let currentInstance = null;
function createHookQueue() {
    return {
        mounted: [],
        updated: []
    };
}

const getCurrentInstance = () => currentInstance;

// 组件实例关联核心逻辑
export function defineProps(definition) {
    const instance = getCurrentInstance(); // 获取当前组件实例

    if (!instance) {
        throw new Error('defineProps() 必须在 setup() 函数内调用');
    }

    // 标准化 props 配置（基于之前的实现）
    const normalized = normalizeProps(definition);

    // 将配置挂载到组件实例
    instance.propsOptions = normalized;

    // 创建响应式 props 对象
    const props = createPropsProxy(instance, normalized);

    // 将 props 挂载到实例上下文
    instance.props = props;
    return props;
}

// 辅助函数实现
function normalizeProps(definition) {
    // 这里复用之前实现的 props 配置标准化逻辑
    const props = {};
    for (const key in definition) {
        const def = definition[key];
        props[key] = isPlainObject(def) ? def : { type: def };
    }
    return props;
}

function createPropsProxy(instance, propsOptions) {
    return new Proxy({}, {
        get(_, key) {
            // 实际值从组件实例的 props 中获取
            return instance.proxy.$props[key];
        },
        set() {
            // props 默认不可直接修改
            return false;
        }
    });
}


// 组合式API入口
function setupComponent(instance, setup) {
    // const hooks = createHookQueue();
    currentInstance = instance;

    // 创建上下文
    const context = {
        attrs: {},
        slots: {},
        expose: () => { }
    };

    // 执行setup函数
    const setupResult = setup(instance.props, context);

    // 处理返回状态
    instance.state = reactive(setupResult);
    currentInstance = null;
    return instance.state;
}

// 生命周期注册函数
export function onMounted(fn) {
    if (currentInstance) {
        currentInstance.hooks.mounted.push(fn);
    }
}

export function onUpdated(fn) {
    if (currentInstance) {
        currentInstance.hooks.updated.push(fn);
    }
}

// 组件实例类
class ComponentInstance {
    constructor() {
        this.state = null;
        this.props = null;
        this.hooks = createHookQueue();
        this.isMounted = false;
        this.vnode = null;
        this.update = null;
        this.updateContainer = null;
    }
}

// DOM操作（简版）
function patch(n1, n2, container) {
    if (!n1) {
        const el = renderVNode(null, n2, container)
        n2.el = el;
    } else {
        if (n2.children !== n1.children) {
            const el = renderVNode(n1, n2, container);
            n2.el = el;
        }
    }
}

// 创建渲染器
function createRenderer() {
    // 创建渲染副作用
    function setupRenderEffect(instance, container) {
        let currContainer = container;
        const renderEffect = new ReactiveEffect(() => {
            const _ctx = {};
            const _cache = [];
            const $props = instance.props || {};
            const $setup = instance.state;
            const $data = {};
            const $options = {};

            const vnode = instance.render.call(instance.state, _ctx, _cache, $props, $setup, $data, $options);
            if (!instance.isMounted) {
                // 首次挂载
                patch(null, vnode, currContainer);
                instance.isMounted = true;
                instance.hooks.mounted.forEach(hook => hook({ el: vnode.el }));
            } else {
                // 更新阶段
                patch(instance.vnode, vnode, currContainer);
                instance.hooks.updated.forEach(hook => hook({ el: vnode.el }));
            }
            instance.vnode = vnode;
        });

        instance.update = () => {
            renderEffect.run();
        }
        instance.updateContainer =  ($container) => {
            currContainer = $container;
        }

        instance.update();
    }

    // 挂载组件
    function mountComponent(vnode, container) {
        const instance = new ComponentInstance();
        vnode.component = instance;

        // 执行组合式API
        instance.render = vnode.type.render;
        instance.props = vnode.props;
        setupComponent(instance, vnode.type.setup);

        // 启动渲染
        setupRenderEffect(instance, container);
    }

    return {
        render(vnode, container) {
            if (vnode.type.setup) {
                mountComponent(vnode, container);
            } else {
                patch(null, vnode, container);
            }
        }
    };
}


// createApp
export function createApp(vNodeRoot) {
    const mount = (id) => {
        const vNode = { type: vNodeRoot }
        const { render } = createRenderer();
        console.log(vNode, 'vNodeRoot')
        render(vNode, document.querySelector(id));
    };

    return { mount }
}


export default {
    createApp, reactive, ref, isRef, computed, watch, watchEffect, nextTick, onMounted, onUpdated, defineProps
}