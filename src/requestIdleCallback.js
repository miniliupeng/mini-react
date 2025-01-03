//浏览器一帧执行正常是16.6ms 如果执行时间大于这个值 可以认为浏览器处于繁忙状态。否则即代表空闲。
//因为requestAnimationFrame这个函数是和渲染保持同步的 可以通过函数获取帧的开始时间，然后使用帧率(开始时间+16.6ms)计算出帧的结束时间, 然后开启一个宏任务，当宏任务被执行时 比较当前的执行时间和帧结束的时间 判断出当前帧是否还有空闲
//因为是宏任务不会像微任务优先级那么高，可以被推迟到下一个事件循环中不会阻塞渲染。这里使用MessageChannel宏任务来实现。
//其实核心就是 获取一帧渲染剩余时间+让执行的任务不阻塞下一次渲染
window.requestIdleCallback =
  window.requestIdleCallback ||
  function (callback, params) {
    const channel = new MessageChannel(); // 建立宏任务的消息通道
    const port1 = channel.port1;
    const port2 = channel.port2;
    const timeout = params === undefined ? params.timeout : -1;
    let cb = callback;
    let frameDeadlineTime = 0; // 当前帧结束的时间
    const begin = performance.now();
    let cancelFlag = 0;
    const frameTime = 16.6;
    const runner = (timeStamp) => {
      // 获取当前帧结束的时间
      frameDeadlineTime = timeStamp + frameTime;
      if (cb) {
        port1.postMessage("task");
      }
    };
    port2.onmessage = () => {
      const timeRemaining = () => {
        const remain = frameDeadlineTime - performance.now();
        return remain > 0 ? remain : 0;
      };
      let didTimeout = false;
      if (timeout > 0) {
        didTimeout = performance.now() - begin > timeout;
      }
      // 没有可执行的回调 直接结束
      if (!cb) {
        return;
      }
      // 当前帧没有时间&没有超时 下次再执行
      if (timeRemaining() <= 1 && !didTimeout) {
        cancelFlag = requestAnimationFrame(runner);
        return cancelFlag;
      }
      //有剩余时间或者超时
      cb({
        didTimeout,
        timeRemaining,
      });
      cb = null;
    };
    cancelFlag = requestAnimationFrame(runner);
    return cancelFlag;
  };
