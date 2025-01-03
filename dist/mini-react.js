"use strict";
// 用立即执行函数包裹起来 避免污染全局变量
(function () {
    // 第一步：bable/tsc将jsx编译成react.createElement形式，执行后生成虚拟DOM (vdom)
    function createElement(type, props, ...children) {
        return {
            type,
            props: {
                ...props,
                children: children.map((child) => {
                    const isTextNode = typeof child === "string" || typeof child === "number";
                    return isTextNode ? createTextNode(child) : child;
                }),
            },
        };
    }
    function createTextNode(nodeValue) {
        return {
            type: "TEXT_ELEMENT",
            props: {
                nodeValue,
                children: [],
            },
        };
    }
    // 第二步：reconcile 通过调度器调度，根据时间分片放到多个任务里完成
    let nextUnitOfWork = null; // 指向下一个要处理的 fiber 节点
    let wipRoot = null; // 指向当前正在处理的fiber链表的根节点
    let currentRoot = null; // 指向之前的历史fiber链表的根节点, 用来对比决定 dom 节点的增删改
    let deletions = null; // 更新后需要删除的元素的数组
    function render(element, container) {
        wipRoot = {
            dom: container,
            props: {
                children: [element],
            },
            alternate: currentRoot, // 对应 旧的 fiber 节点
        };
        deletions = [];
        nextUnitOfWork = wipRoot; // 设置初始 nextUnitOfWork
    }
    function workLoop(deadline) {
        let shouldYield = false;
        while (nextUnitOfWork && !shouldYield) {
            nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
            shouldYield = deadline.timeRemaining() < 1; // 每次跑的时候判断下 timeRemaing 是否接近 0，是的话就中断循环，等下次 requestIdleCallback 的回调再继续处理 nextUnitOfWork 指向的 fiber 节点
        }
        if (!nextUnitOfWork && wipRoot) { // reconcile 结束,  执行 commit 
            commitRoot();
        }
        requestIdleCallback(workLoop);
    }
    requestIdleCallback(workLoop);
    // 处理每个 fiber 节点，会按照 child、sibling、return 的顺序返回
    function performUnitOfWork(fiber) {
        const isFunctionComponent = fiber.type instanceof Function; // 判断是函数组件还是原生标签
        if (isFunctionComponent) {
            updateFunctionComponent(fiber);
        }
        else {
            updateHostComponent(fiber);
        }
        if (fiber.child) {
            return fiber.child;
        }
        let nextFiber = fiber;
        while (nextFiber) {
            if (nextFiber.sibling) {
                return nextFiber.sibling;
            }
            nextFiber = nextFiber.return;
        }
    }
    let wipFiber = null; // wipFiber 指向当前处理的 fiber
    let stateHookIndex = null;
    // 初始化/更新 函数组件的fiber节点 fiber节点没有dom
    // 传入 props 调用,继续 reconcile 函数组件的返回值
    function updateFunctionComponent(fiber) {
        wipFiber = fiber;
        stateHookIndex = 0; // ,  更新时重置为空
        wipFiber.stateHooks = []; // 存储 useState 的 hook 的值,  更新时重置为空
        wipFiber.effectHooks = []; // 存储 useEffect 的 hook 的值,  更新时重置为空
        const children = [fiber.type(fiber.props)];
        reconcileChildren(fiber, children);
    }
    // 初始化/更新原生组件的fiber节点  fiber节点有dom
    // 创建它对应的 dom 节点
    function updateHostComponent(fiber) {
        if (!fiber.dom) {
            fiber.dom = createDom(fiber);
        }
        reconcileChildren(fiber, fiber.props.children);
    }
    function createDom(fiber) {
        const dom = fiber.type == "TEXT_ELEMENT"
            ? document.createTextNode("")
            : document.createElement(fiber.type);
        updateDom(dom, {}, fiber.props);
        return dom;
    }
    const isEvent = (key) => key.startsWith("on");
    const isProperty = (key) => key !== "children" && !isEvent(key);
    const isNew = (prev, next) => (key) => prev[key] !== next[key];
    const isGone = (prev, next) => (key) => !(key in next);
    // 删除旧的事件监听器，旧的属性，然后添加新的属性、新的事件监听器
    function updateDom(dom, prevProps, nextProps) {
        // 移除不存在的和变化的事件监听器
        Object.keys(prevProps)
            .filter(isEvent)
            .filter((key) => !(key in nextProps) || isNew(prevProps, nextProps)(key))
            .forEach((name) => {
            const eventType = name.toLowerCase().substring(2);
            dom.removeEventListener(eventType, prevProps[name]);
        });
        // 移除不存在的属性
        Object.keys(prevProps)
            .filter(isProperty)
            .filter(isGone(prevProps, nextProps))
            .forEach((name) => {
            dom[name] = "";
        });
        // 设置新的和变化的属性
        Object.keys(nextProps)
            .filter(isProperty)
            .filter(isNew(prevProps, nextProps))
            .forEach((name) => {
            dom[name] = nextProps[name];
        });
        // 添加新的和变化的事件监听器
        Object.keys(nextProps)
            .filter(isEvent)
            .filter(isNew(prevProps, nextProps))
            .forEach((name) => {
            const eventType = name.toLowerCase().substring(2);
            dom.addEventListener(eventType, nextProps[name]);
        });
    }
    // fiber链表是边构成边执行的
    // 遍历比较新旧两组fiber节点的子元素 ， 打上删除/新增/更新 三种标记effectTag
    function reconcileChildren(wipFiber, elements) {
        let index = 0;
        let oldFiber = wipFiber.alternate?.child;
        let prevSibling = null;
        while (index < elements.length || oldFiber != null) {
            const element = elements[index];
            let newFiber = null;
            const sameType = element?.type == oldFiber?.type; // 判断节点 type
            // 一样就修改
            if (sameType) {
                newFiber = {
                    type: oldFiber.type,
                    props: element.props,
                    dom: oldFiber.dom,
                    return: wipFiber,
                    alternate: oldFiber,
                    effectTag: "UPDATE",
                };
            }
            // 不一样就创建 新的 fiber 节点
            if (element && !sameType) {
                newFiber = {
                    type: element.type,
                    props: element.props,
                    dom: null,
                    return: wipFiber,
                    alternate: null,
                    effectTag: "PLACEMENT",
                };
            }
            // 不一样就删除 旧的 fiber 节点
            if (oldFiber && !sameType) {
                oldFiber.effectTag = "DELETION";
                deletions.push(oldFiber);
            }
            if (oldFiber) {
                oldFiber = oldFiber.sibling;
            }
            if (index === 0) {
                wipFiber.child = newFiber;
            }
            else if (element) {
                prevSibling.sibling = newFiber;
            }
            prevSibling = newFiber;
            index++;
        }
    }
    // 每次调用 useState 时会在 stateHooks 添加一个stateHook元素，并用stateHookIndex索引记录位置
    function useState(initialState) {
        const currentFiber = wipFiber;
        const oldHook = wipFiber.alternate?.stateHooks[stateHookIndex];
        const stateHook = {
            state: oldHook ? oldHook.state : initialState, // 存 state 值
            queue: oldHook ? oldHook.queue : [], // 存放 修改 state 的函数
        };
        stateHook.queue.forEach((action) => {
            stateHook.state = action(stateHook.state); // 依次执行修改 state 的函数 到了最终的 state 值
        });
        stateHook.queue = []; // 修改完 state 之后清空 queue
        stateHookIndex++;
        wipFiber.stateHooks.push(stateHook);
        function setState(action) {
            const isFunction = typeof action === "function";
            stateHook.queue.push(isFunction ? action : () => action);
            wipRoot = {
                ...currentFiber,
                alternate: currentFiber,
            };
            nextUnitOfWork = wipRoot; // 开始新的一轮渲染
        }
        return [stateHook.state, setState];
    }
    function useEffect(callback, deps) {
        const effectHook = {
            callback,
            deps,
            cleanup: undefined,
        };
        wipFiber.effectHooks.push(effectHook);
    }
    function commitRoot() {
        deletions.forEach(commitWork); // 删除节点
        commitWork(wipRoot.child);
        commitEffectHooks();
        currentRoot = wipRoot;
        wipRoot = null;
        deletions = [];
    }
    // 按照 child、sibling 的顺序来递归遍历 fiber 链表
    function commitWork(fiber) {
        if (!fiber) {
            return;
        }
        let domParentFiber = fiber.return;
        while (!domParentFiber.dom) { // 不断向上找，找到可以挂载的 dom 节点
            domParentFiber = domParentFiber.return;
        }
        const domParent = domParentFiber.dom;
        // 按照增删改的 effectTag 
        if (fiber.effectTag === "PLACEMENT" && fiber.dom != null) {
            domParent.appendChild(fiber.dom);
        }
        else if (fiber.effectTag === "UPDATE" && fiber.dom != null) {
            updateDom(fiber.dom, fiber.alternate.props, fiber.props);
        }
        else if (fiber.effectTag === "DELETION") {
            commitDeletion(fiber, domParent);
        }
        commitWork(fiber.child);
        commitWork(fiber.sibling);
    }
    function commitDeletion(fiber, domParent) {
        if (fiber.dom) { // 函数式组件没 dom， 不断 .child 向下找
            domParent.removeChild(fiber.dom);
        }
        else {
            commitDeletion(fiber.child, domParent);
        }
    }
    function isDepsEqual(deps, newDeps) {
        if (deps.length !== newDeps.length) {
            return false;
        }
        for (let i = 0; i < deps.length; i++) {
            if (deps[i] !== newDeps[i]) {
                return false;
            }
        }
        return true;
    }
    function commitEffectHooks() {
        function runCleanup(fiber) {
            if (!fiber)
                return;
            fiber.alternate?.effectHooks?.forEach((hook, index) => {
                const deps = fiber.effectHooks[index].deps;
                if (!hook.deps || !isDepsEqual(hook.deps, deps)) { // 如果没有依赖或者依赖发生变化，则执行 cleanup
                    hook.cleanup?.();
                }
            });
            runCleanup(fiber.child);
            runCleanup(fiber.sibling);
        }
        function run(fiber) {
            if (!fiber)
                return;
            fiber.effectHooks?.forEach((newHook, index) => {
                if (!fiber.alternate) { // 首次渲染  执行所有的 effect  , 并且将返回的函数 保存为cleanup
                    newHook.cleanup = newHook.callback();
                    return;
                }
                if (!newHook.deps) { // 没传入 deps 
                    newHook.cleanup = newHook.callback();
                }
                if (newHook.deps.length > 0) {
                    const oldHook = fiber.alternate?.effectHooks[index];
                    if (!isDepsEqual(oldHook.deps, newHook.deps)) { // deps 数组变化
                        newHook.cleanup = newHook.callback();
                    }
                }
            });
            run(fiber.child);
            run(fiber.sibling);
        }
        runCleanup(wipRoot);
        run(wipRoot);
    }
    const MiniReact = {
        createElement,
        render,
        useState,
        useEffect,
    };
    window.MiniReact = MiniReact;
})();
//# sourceMappingURL=mini-react.js.map