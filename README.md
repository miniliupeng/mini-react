# 1. 小册

1. npx tsc -w

2. npx http-server .

3. debugger in chrome


# 2. 真实源码

1. reconcile分为
 - beginWork：根据 fiber 节点的类型做处理，然后reconcileChildren 对比新旧 fiber，做下 diff，打上增删改的标记
 - 等 fiber 节点全部处理完，也就是没有 next 的 fiber 节点时， 调用completeWork： dom 的创建和组装， 存在 fiber.stateNode 属性上

2. commit 阶段
- before mutation
- mutation： 更新 dom
- layout

3. react 的 hook 的值是存放在 fiber.memoizedState 链表上的，每个 hook 对应一个节点，在其中存取值