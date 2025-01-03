"use strict";
const { render } = window.MiniReact;
function App() {
    const count = 1;
    return MiniReact.createElement("div", null,
        MiniReact.createElement("p", null, count),
        MiniReact.createElement("button", null, "\u52A0\u4E00"));
}
render(MiniReact.createElement(App, null), document.getElementById('root'));
//# sourceMappingURL=index.js.map